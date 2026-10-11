import * as THREE from 'three';
import { fbm, makeNoise } from '../../materials/noise';

/* ------------------------------------------------------------------ */
/*  Farm-only procedural textures (seamless, cached): baled straw,     */
/*  safeefah palm-leaf plait with dyed bands, and burlap.              */
/* ------------------------------------------------------------------ */

type RGB = [number, number, number];
interface Px {
  c: RGB;
  h: number;
  r: number;
}

const hex = (c: string): RGB => {
  const h = c.replace('#', '');
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
};
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export interface FarmTexSet {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

function tex(data: Uint8ClampedArray, size: number, srgb: boolean) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.getContext('2d')!.putImageData(new ImageData(data, size, size), 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

function generate(size: number, strength: number, sampler: (u: number, v: number, p: Px) => void): FarmTexSet {
  const n = size * size;
  const col = new Uint8ClampedArray(n * 4);
  const rough = new Uint8ClampedArray(n * 4);
  const h = new Float32Array(n);
  const p: Px = { c: [0, 0, 0], h: 0, r: 0.9 };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      p.h = 0;
      p.r = 0.9;
      sampler(x / size, y / size, p);
      const i = y * size + x;
      col[i * 4] = p.c[0] * 255;
      col[i * 4 + 1] = p.c[1] * 255;
      col[i * 4 + 2] = p.c[2] * 255;
      col[i * 4 + 3] = 255;
      rough[i * 4] = rough[i * 4 + 1] = rough[i * 4 + 2] = clamp01(p.r) * 255;
      rough[i * 4 + 3] = 255;
      h[i] = p.h;
    }
  const nrm = new Uint8ClampedArray(n * 4);
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      nrm[i] = (-dx / l) * 127.5 + 127.5;
      nrm[i + 1] = (dy / l) * 127.5 + 127.5;
      nrm[i + 2] = (1 / l) * 127.5 + 127.5;
      nrm[i + 3] = 255;
    }
  return { map: tex(col, size, true), normalMap: tex(nrm, size, false), roughnessMap: tex(rough, size, false) };
}

const cache = new Map<string, FarmTexSet>();
function cached(key: string, make: () => FarmTexSet) {
  let s = cache.get(key);
  if (!s) {
    s = make();
    cache.set(key, s);
  }
  return s;
}

/** Compressed straw: fibres run along U (the bale's long axis). */
export function strawTex() {
  return cached('straw', () => {
    const nz = makeNoise(31);
    const gold = hex('#C9A55C');
    const pale = hex('#E2CB8A');
    const dark = hex('#8E7238');
    return generate(256, 3.2, (u, v, p) => {
      const fib = fbm(nz, u * 0.5, v, 48, 3) * 0.5 + 0.5;
      const fine = fbm(nz, u * 0.25 + 0.3, v + 0.2, 128, 2) * 0.5 + 0.5;
      const clump = fbm(nz, u, v, 4, 3) * 0.5 + 0.5;
      let c = mix(gold, pale, clamp01(fib * 0.9 + clump * 0.3 - 0.25));
      c = mix(c, dark, clamp01((0.45 - fine) * 1.6) * 0.55);
      p.c = c;
      p.h = fib * 0.7 + fine * 0.5;
      p.r = 0.92;
    });
  });
}

/** Safeefah: plaited palm-leaf strips with dyed bands (U around, V up). */
export function safeefahTex() {
  return cached('safeefah', () => {
    const nz = makeNoise(37);
    const natural = hex('#C7A266');
    const light = hex('#DDC08A');
    const bands: RGB[] = [hex('#7C2626'), hex('#2F5F4A'), hex('#5B3566'), hex('#C7A266')];
    return generate(256, 2.6, (u, v, p) => {
      const x = u * 20;
      const y = v * 12;
      const row = Math.floor(y);
      const fy = y - row;
      // chevron plait: strands lean alternately left/right in successive rows
      const lean = row % 2 === 0 ? fy : 1 - fy;
      const s = x + lean * 0.9;
      const strand = s - Math.floor(s);
      const ridge = Math.sin(strand * Math.PI);
      const band = Math.floor(v * 4);
      const dyed = band % 2 === 1;
      const n = fbm(nz, u, v, 16, 2) * 0.5 + 0.5;
      let c = mix(natural, light, ridge * 0.5 + n * 0.25);
      if (dyed) c = mix(bands[(band >> 1) % bands.length], c, 0.18 + (1 - ridge) * 0.15);
      const groove = Math.min(fy, 1 - fy) < 0.06 ? 0.55 : 1;
      p.c = [c[0] * groove, c[1] * groove, c[2] * groove];
      p.h = ridge * 0.7 + (groove < 1 ? -0.3 : 0);
      p.r = 0.82;
    });
  });
}

/** Coarse burlap / hessian sacking. */
export function burlapTex() {
  return cached('burlap', () => {
    const nz = makeNoise(41);
    const base = hex('#A88A5E');
    const dark = hex('#6E5534');
    return generate(256, 2.0, (u, v, p) => {
      const wx = Math.sin(u * 48 * Math.PI * 2);
      const wy = Math.sin(v * 48 * Math.PI * 2);
      const over = wx * wy;
      const slub = fbm(nz, u, v * 0.25, 24, 2) * 0.5 + 0.5;
      const n = fbm(nz, u, v, 6, 3) * 0.5 + 0.5;
      const gap = Math.abs(wx) < 0.25 && Math.abs(wy) < 0.25 ? 1 : 0;
      p.c = mix(mix(base, dark, n * 0.35 + slub * 0.2), dark, gap * 0.6);
      p.h = over * 0.5 + 0.5 - gap * 0.4;
      p.r = 0.97;
    });
  });
}

/** Dates spread to dry: glossy amber-to-mahogany ellipses packed edge to edge. */
export function datesTex() {
  return cached('dates', () => {
    const size = 512;
    const col = document.createElement('canvas');
    const hgt = document.createElement('canvas');
    col.width = col.height = hgt.width = hgt.height = size;
    const c = col.getContext('2d')!;
    const h = hgt.getContext('2d')!;
    c.fillStyle = '#5A3418';
    c.fillRect(0, 0, size, size);
    h.fillStyle = '#000';
    h.fillRect(0, 0, size, size);
    const nz = makeNoise(43);
    let seed = 7;
    const r = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const tones = ['#8E4A1C', '#A0602A', '#B8762E', '#7E3A16', '#C08A3A', '#6B2E12'];
    for (let i = 0; i < 2600; i++) {
      const x = r() * size;
      const y = r() * size;
      const a = r() * Math.PI;
      const rx = 7 + r() * 3;
      const ry = 4.2 + r() * 1.6;
      const shade = fbm(nz, x / size, y / size, 4, 2) * 0.5 + 0.5;
      for (const ox of [-size, 0, size])
        for (const oy of [-size, 0, size]) {
          if (x + ox < -20 || x + ox > size + 20 || y + oy < -20 || y + oy > size + 20) continue;
          c.save();
          c.translate(x + ox, y + oy);
          c.rotate(a);
          const g = c.createRadialGradient(-rx * 0.3, -ry * 0.35, 0.5, 0, 0, rx);
          g.addColorStop(0, '#E0A060');
          g.addColorStop(0.25, tones[Math.floor(r() * tones.length)]);
          g.addColorStop(1, shade > 0.5 ? '#4A2410' : '#5A2E14');
          c.fillStyle = g;
          c.beginPath();
          c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
          c.fill();
          c.restore();
          h.save();
          h.translate(x + ox, y + oy);
          h.rotate(a);
          const hg = h.createRadialGradient(0, 0, 0, 0, 0, rx);
          hg.addColorStop(0, 'rgba(255,255,255,1)');
          hg.addColorStop(1, 'rgba(255,255,255,0)');
          h.fillStyle = hg;
          h.beginPath();
          h.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
          h.fill();
          h.restore();
        }
    }
    const hd = h.getImageData(0, 0, size, size).data;
    const nrm = new Uint8ClampedArray(size * size * 4);
    const at = (x: number, y: number) => hd[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const dx = (at(x + 1, y) - at(x - 1, y)) * 2.5;
        const dy = (at(x, y + 1) - at(x, y - 1)) * 2.5;
        const l = Math.hypot(dx, dy, 1);
        const i = (y * size + x) * 4;
        nrm[i] = (-dx / l) * 127.5 + 127.5;
        nrm[i + 1] = (dy / l) * 127.5 + 127.5;
        nrm[i + 2] = (1 / l) * 127.5 + 127.5;
        nrm[i + 3] = 255;
      }
    const map = new THREE.CanvasTexture(col);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 8;
    const rough = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      const v = 255 * (0.62 - hd[i * 4] / 255 * 0.32);
      rough[i * 4] = rough[i * 4 + 1] = rough[i * 4 + 2] = v;
      rough[i * 4 + 3] = 255;
    }
    return { map, normalMap: tex(nrm, size, false), roughnessMap: tex(rough, size, false) };
  });
}
