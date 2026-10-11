import * as THREE from 'three';
import { fbm, makeNoise } from '../../materials/noise';
import type { TexSet } from '../../materials/textures';

/* ------------------------------------------------------------------ */
/*  Studio-specific procedural textures (same approach as the shared   */
/*  generators: colour + height→normal + roughness, seamless, cached). */
/* ------------------------------------------------------------------ */

export type RGB = [number, number, number];

export function rgb(c: string): RGB {
  const h = c.replace('#', '');
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}
export const mixRGB = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

interface Px {
  c: RGB;
  h: number;
  r: number;
}

const cache = new Map<string, TexSet>();

function toTex(data: Uint8ClampedArray, size: number, srgb: boolean) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  cv.getContext('2d')!.putImageData(new ImageData(data, size, size), 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

function bake(key: string, size: number, fn: (u: number, v: number, p: Px) => void, normalStrength = 2): TexSet {
  const hit = cache.get(key);
  if (hit) return hit;
  const n = size * size;
  const col = new Uint8ClampedArray(n * 4);
  const rough = new Uint8ClampedArray(n * 4);
  const height = new Float32Array(n);
  const p: Px = { c: [0, 0, 0], h: 0, r: 0.8 };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      p.h = 0;
      p.r = 0.8;
      fn(x / size, y / size, p);
      const i = y * size + x;
      col[i * 4] = p.c[0] * 255;
      col[i * 4 + 1] = p.c[1] * 255;
      col[i * 4 + 2] = p.c[2] * 255;
      col[i * 4 + 3] = 255;
      const r = clamp01(p.r) * 255;
      rough[i * 4] = rough[i * 4 + 1] = rough[i * 4 + 2] = r;
      rough[i * 4 + 3] = 255;
      height[i] = p.h;
    }
  const nrm = new Uint8ClampedArray(n * 4);
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1)) * normalStrength;
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1)) * normalStrength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      nrm[i] = (-dx / l * 0.5 + 0.5) * 255;
      nrm[i + 1] = (dy / l * 0.5 + 0.5) * 255;
      nrm[i + 2] = (1 / l * 0.5 + 0.5) * 255;
      nrm[i + 3] = 255;
    }
  const set: TexSet = { map: toTex(col, size, true), normalMap: toTex(nrm, size, false), roughnessMap: toTex(rough, size, false) };
  cache.set(key, set);
  return set;
}

/** Iron-speckled clay / glaze body: near-white map (multiplied by vertex colours) with pits. */
export function speckleTex(strength = 1) {
  const nz = makeNoise(31);
  return bake(`speckle:${strength}`, 256, (u, v, p) => {
    const mott = fbm(nz, u, v, 4, 3) * 0.5 + 0.5;
    const s1 = fbm(nz, u + 0.37, v + 0.11, 64, 2);
    const s2 = fbm(nz, u + 0.71, v + 0.53, 32, 2);
    const speck = smooth(0.42, 0.62, s1) * 0.55 + smooth(0.5, 0.7, s2) * 0.35;
    const k = 1 - speck * 0.6 * strength - (mott - 0.5) * 0.08 * strength;
    p.c = [k, k * 0.985, k * 0.965];
    p.h = mott * 0.25 - speck * 0.4;
    p.r = 0.85;
  }, 1.2);
}

/** Wedging canvas: natural cotton duck stained with dried clay and slip. */
export function stainedCanvasTex() {
  const nz = makeNoise(41);
  const base = rgb('#D9CDB6');
  const clay = rgb('#9C8A78');
  const slip = rgb('#BDAE9C');
  return bake('canvas-stained', 512, (u, v, p) => {
    const wx = Math.sin(u * 90 * Math.PI * 2);
    const wy = Math.sin(v * 90 * Math.PI * 2);
    const blot = fbm(nz, u, v, 5, 4) * 0.5 + 0.5;
    const ring = smooth(0.58, 0.6, blot) * (1 - smooth(0.6, 0.66, blot));
    const st = smooth(0.52, 0.72, blot);
    const fine = fbm(nz, u + 0.3, v + 0.7, 48, 2);
    let c = mixRGB(base, slip, st * 0.45);
    c = mixRGB(c, clay, ring * 0.3 + smooth(0.75, 0.9, blot) * 0.25);
    const w = wx * wy * 0.018 + fine * 0.03;
    p.c = [c[0] + w, c[1] + w, c[2] + w];
    p.h = (wx * 0.5 + 0.5) * (wy * 0.5 + 0.5) * 0.25 + st * 0.2;
    p.r = 0.95 - st * 0.1;
  }, 1.1);
}

/**
 * Lime-plastered coral-stone wall: warm render with soft trowelled
 * undulation, mottled stains and faint vertical weathering streaks.
 */
export function heritagePlasterTex(base = '#DDC6A2', dark = '#BB9C74', seed = 51) {
  const nz = makeNoise(seed);
  const b = rgb(base);
  const d = rgb(dark);
  return bake(`hplaster:${base}:${dark}:${seed}`, 512, (u, v, p) => {
    const m = fbm(nz, u, v, 3, 4) * 0.5 + 0.5;
    const trowel = fbm(nz, u + 0.2, v * 0.5 + 0.4, 6, 2);
    const fine = fbm(nz, u + 0.31, v + 0.17, 64, 1);
    let c = mixRGB(b, d, clamp01(m * 0.5 + trowel * 0.12));
    const streak = (fbm(nz, u + 0.5, v * 0.08, 16, 1) * 0.5 + 0.5) * smooth(0.2, 1, 1 - v);
    c = mixRGB(c, d, smooth(0.55, 0.85, streak) * 0.22);
    const g = fine * 0.03;
    p.c = [c[0] + g, c[1] + g, c[2] + g * 0.9];
    p.h = m * 0.45 + trowel * 0.12 + fine * 0.1;
    p.r = 0.93 + fine * 0.05;
  }, 1.8);
}

/** Small square terracotta tile surface (used on instanced floor tiles). */
export function tileFaceTex() {
  const nz = makeNoise(61);
  return bake('tileface', 256, (u, v, p) => {
    const m = fbm(nz, u, v, 3, 4) * 0.5 + 0.5;
    const pit = fbm(nz, u + 0.4, v + 0.2, 48, 2);
    const wear = fbm(nz, u + 0.7, v + 0.1, 8, 3) * 0.5 + 0.5;
    const edge = Math.min(u, 1 - u, v, 1 - v);
    const chip = smooth(0.0, 0.06, edge + (wear - 0.5) * 0.05);
    const k = 0.9 + (m - 0.5) * 0.18 - smooth(0.45, 0.65, pit) * 0.12 + (1 - chip) * 0.06;
    p.c = [k, k * 0.97, k * 0.95];
    p.h = m * 0.3 - smooth(0.45, 0.65, pit) * 0.3 + chip * 0.4;
    p.r = 0.72 + wear * 0.18;
  }, 1.4);
}
