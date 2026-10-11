import * as THREE from 'three';
import { fbm, makeNoise, makeWorley, type Noise2 } from '../../materials/noise';
import type { TexSet } from '../../materials/textures';

/* ------------------------------------------------------------------ */
/*  Apiary-specific procedural textures (seamless, cached). Same        */
/*  approach as the shared generators: colour + normal + roughness.     */
/* ------------------------------------------------------------------ */

type RGB = [number, number, number];
const hex = (c: string): RGB => {
  const h = c.replace('#', '');
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
};
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Anisotropic periodic fbm (integer frequencies keep it seamless). */
function fbmA(nz: Noise2, u: number, v: number, fu: number, fv: number, oct = 3) {
  let amp = 1;
  let s = 0;
  let n = 0;
  let a = Math.max(1, Math.round(fu));
  let b = Math.max(1, Math.round(fv));
  for (let o = 0; o < oct; o++) {
    s += amp * nz(u * a, v * b, a, b);
    n += amp;
    amp *= 0.5;
    a *= 2;
    b *= 2;
  }
  return s / n;
}

interface Px {
  c: RGB;
  h: number;
  r: number;
  a: number;
}

function canvasTex(c: HTMLCanvasElement, srgb: boolean) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

function toTex(data: Uint8ClampedArray, size: number, srgb: boolean) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.getContext('2d')!.putImageData(new ImageData(data, size, size), 0, 0);
  return canvasTex(c, srgb);
}

function generate(size: number, sampler: (u: number, v: number, p: Px) => void, normalStrength = 2, wantAlpha = false): TexSet {
  const n = size * size;
  const color = new Uint8ClampedArray(n * 4);
  const height = new Float32Array(n);
  const rough = new Uint8ClampedArray(n * 4);
  const alpha = wantAlpha ? new Uint8ClampedArray(n * 4) : null;
  const p: Px = { c: [0, 0, 0], h: 0, r: 0.8, a: 1 };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      p.h = 0;
      p.r = 0.8;
      p.a = 1;
      sampler(x / size, y / size, p);
      const i = y * size + x;
      color[i * 4] = p.c[0] * 255;
      color[i * 4 + 1] = p.c[1] * 255;
      color[i * 4 + 2] = p.c[2] * 255;
      color[i * 4 + 3] = 255;
      height[i] = p.h;
      const rv = clamp01(p.r) * 255;
      rough[i * 4] = rough[i * 4 + 1] = rough[i * 4 + 2] = rv;
      rough[i * 4 + 3] = 255;
      if (alpha) {
        const av = clamp01(p.a) * 255;
        alpha[i * 4] = alpha[i * 4 + 1] = alpha[i * 4 + 2] = av;
        alpha[i * 4 + 3] = 255;
      }
    }
  // height → normal (Sobel)
  const nm = new Uint8ClampedArray(n * 4);
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1)) * normalStrength;
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1)) * normalStrength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      nm[i] = (-dx / l) * 127.5 + 127.5;
      nm[i + 1] = (dy / l) * 127.5 + 127.5;
      nm[i + 2] = (1 / l) * 127.5 + 127.5;
      nm[i + 3] = 255;
    }
  const out: TexSet = { map: toTex(color, size, true), normalMap: toTex(nm, size, false), roughnessMap: toTex(rough, size, false) };
  if (alpha) out.alphaMap = toTex(alpha, size, false);
  return out;
}

const cache = new Map<string, TexSet>();
function cached(key: string, make: () => TexSet) {
  const hit = cache.get(key);
  if (hit) return hit;
  const t = make();
  cache.set(key, t);
  return t;
}

/* --------------------------------- Sets --------------------------------- */

/** Weathered exterior paint over pine — neutral white, tinted per hive box. Grain runs along U. */
export function paintedWood(seed = 3) {
  return cached(`pw:${seed}`, () => {
    const nz = makeNoise(seed);
    const paint = hex('#F4F1EA');
    const wood = hex('#8B7559');
    return generate(
      384,
      (u, v, p) => {
        const warp = fbmA(nz, u, v, 2, 5, 3) * 1.4;
        const ring = Math.sin((v * 46 + warp * 5 + fbmA(nz, u, v, 1, 3, 2) * 3) * Math.PI) * 0.5 + 0.5;
        const fibre = fbmA(nz, u + 0.3, v, 3, 90, 2);
        const brush = fbmA(nz, u, v + 0.2, 6, 40, 2);
        const dirt = fbm(nz, u + 0.5, v + 0.1, 3, 3) * 0.5 + 0.5;
        const chipN = fbm(nz, u * 1 + 0.17, v + 0.61, 10, 3) * 0.5 + 0.5;
        const chip = smooth(0.7, 0.76, chipN + ring * 0.05);
        let c = mix(paint, mix(paint, hex('#C9BFAE'), 0.6), clamp01(dirt * 0.55 - 0.12));
        c = mix(c, mix(c, hex('#B8AD99'), 0.5), ring * 0.18 + brush * 0.04);
        c = mix(c, mix(wood, hex('#5E4C38'), ring * 0.6), chip);
        p.c = c;
        p.h = ring * 0.35 + fibre * 0.12 + brush * 0.08 - chip * 0.5;
        p.r = 0.58 + dirt * 0.12 + chip * 0.25 + brush * 0.05;
      },
      1.4,
    );
  });
}

/** Sedimentary strata for the foothills: banded ochre/brown layers, staggered joints, desert varnish. */
export function strata(seed = 21) {
  return cached(`st:${seed}`, () => {
    const nz = makeNoise(seed);
    const pal = ['#B68D60', '#C9A87D', '#9A714F', '#A97A52', '#A88A6A', '#CDB78F', '#9E7D5C', '#BC9A6E'].map(hex);
    const bands = 7;
    return generate(
      384,
      (u, v, p) => {
        const warp = fbmA(nz, u, v, 2, 2, 3) * 0.45 + fbmA(nz, u, v, 6, 3, 2) * 0.08;
        const b = v * bands + warp;
        const id = Math.floor(b);
        const f = b - id;
        const hid = ((id % bands) + bands) % bands;
        const base = pal[Math.floor(hash(hid + seed) * pal.length)];
        const next = pal[Math.floor(hash(hid + 1 + seed) * pal.length)];
        const lamin = Math.sin(f * Math.PI * (5 + Math.floor(hash(hid * 3.1) * 5))) * 0.5 + 0.5;
        const grit = fbm(nz, u + 0.2, v + 0.7, 48, 2);
        let c = mix(base, next, smooth(0.82, 1.0, f) * 0.6);
        c = mix(c, mix(c, hex('#6B5544'), 0.5), lamin * 0.12);
        // vertical joints, staggered per band
        const jn = Math.abs(nz(u * 5 + hid * 3.7, v * 2 + hid * 1.31, 5, 2) + fbmA(nz, u, v, 12, 4, 2) * 0.12);
        const joint = (1 - smooth(0.012, 0.04, jn)) * (hash(hid * 1.9 + seed) > 0.5 ? 0.55 : 0.12);
        // dark varnish streaks running down from ledges
        const streak = smooth(0.25, 0.8, fbmA(nz, u + 0.4, v, 22, 2, 2) * 0.5 + 0.5) * smooth(0.0, 0.6, 1 - f);
        c = mix(c, hex('#5D4A3B'), streak * 0.28 + joint * 0.45);
        const lit = fbm(nz, u, v, 5, 3) * 0.06;
        p.c = [c[0] + lit + grit * 0.03, c[1] + lit + grit * 0.028, c[2] + lit * 0.9 + grit * 0.025];
        // each band bulges; band boundaries are recessed ledge lines
        const bulge = Math.sin(f * Math.PI);
        p.h = bulge * 0.7 + lamin * 0.12 + grit * 0.18 - joint * 0.6;
        p.r = 0.88 + grit * 0.06;
      },
      3.2,
    );
  });
}

/** Desert pavement: silty soil packed with angular grit and scattered pebbles (no dimples). */
export function soil(seed = 81) {
  return cached(`so:${seed}`, () => {
    const nz = makeNoise(seed);
    const fine = makeWorley(seed, 46);
    const mid = makeWorley(seed + 3, 15);
    const pal = ['#A39278', '#B7A68B', '#8C7D69', '#C8B99F', '#9A8670', '#ADA08A', '#7F7363', '#D2C5AE'].map(hex);
    const base = hex('#9B8770');
    const dark = hex('#7A6852');
    return generate(
      384,
      (u, v, p) => {
        const mott = fbm(nz, u, v, 3, 4) * 0.5 + 0.5;
        const silt = fbm(nz, u + 0.4, v + 0.2, 90, 2);
        let c = mix(base, dark, clamp01(mott * 0.8 - 0.1));
        c = [c[0] + silt * 0.04, c[1] + silt * 0.035, c[2] + silt * 0.03];
        let h = silt * 0.08 + mott * 0.1;
        let r = 0.96;
        const f = fine(u, v);
        if (hash(f.id * 1.3) < 0.5) {
          // angular grit: polygonal cells shrunk toward their centre
          const edge = f.d2 - f.d1;
          const inside = smooth(0.08, 0.2, edge) * smooth(0.55, 0.35, f.d1);
          const pc = pal[Math.floor(hash(f.id * 2.7) * pal.length)];
          c = mix(c, pc, inside * 0.9);
          h += inside * 0.35;
          r -= inside * 0.08;
        }
        const m = mid(u, v);
        if (hash(m.id * 5.1) < 0.08) {
          const rad = 0.22 + hash(m.id) * 0.1;
          if (m.d1 < rad) {
            const dome = Math.sqrt(1 - (m.d1 / rad) ** 2);
            const pc = pal[Math.floor(hash(m.id * 7.7) * pal.length)];
            c = mix(c, mix([pc[0] * 1.06, pc[1] * 1.06, pc[2] * 1.06], [pc[0] * 0.86, pc[1] * 0.86, pc[2] * 0.86], 1 - dome), smooth(0, 0.25, dome));
            h = 0.22 + dome * 0.22;
            r = 0.82;
          }
        }
        p.c = c;
        p.h = h;
        p.r = r;
      },
      1.25,
    );
  });
}

/** Comb for frames: pale wax walls, capped honey, glossy open honey, a few pollen and empty cells. */
export function combTex(seed = 91) {
  return cached(`cb:${seed}`, () => {
    const nz = makeNoise(seed);
    const wax = hex('#E9C66A');
    const cap = hex('#EBD597');
    const honey = hex('#B5600C');
    const honeyD = hex('#7E3D06');
    const empty = hex('#4A3014');
    const pollen = ['#D99A2B', '#C4632A', '#E2B53C', '#9C8A2A'].map(hex);
    const cols = 16;
    return generate(
      384,
      (u, v, p) => {
        const sx = u * cols;
        const sy = v * cols * 1.1547;
        const q = sx - sy / 1.732;
        const rr = (sy * 2) / 1.732;
        let rx = Math.round(q);
        let ry = Math.round(rr);
        const rz = Math.round(-q - rr);
        const dq = Math.abs(rx - q);
        const dr = Math.abs(ry - rr);
        const dz = Math.abs(rz + q + rr);
        if (dq > dr && dq > dz) rx = -ry - rz;
        else if (dr > dz) ry = -rx - rz;
        const fx = q - rx;
        const fy = rr - ry;
        const dist = Math.max(Math.abs(fx), Math.abs(fy), Math.abs(fx + fy));
        const wall = smooth(0.36, 0.47, dist);
        const cell = hash(rx * 12.9898 + ry * 78.233);
        const region = fbm(nz, u, v, 3, 3) * 0.5 + 0.5;
        const capped = region > 0.45 && cell < 0.9;
        let c: RGB;
        let h: number;
        let r: number;
        if (capped) {
          c = mix(cap, wax, dist * 0.6 + cell * 0.15);
          h = 0.75 - dist * dist * 0.6;
          r = 0.5;
        } else if (cell < 0.08) {
          c = mix(pollen[Math.floor(cell * 50) % pollen.length], wax, dist * 0.4);
          h = 0.25;
          r = 0.75;
        } else if (cell < 0.16) {
          c = mix(empty, wax, dist * 0.9);
          h = -0.2 + dist * 0.5;
          r = 0.7;
        } else {
          c = mix(honeyD, honey, clamp01(1 - dist * 1.2 + cell * 0.3));
          c = mix(c, wax, dist * dist * 0.7);
          h = 0.05 + dist * 0.3;
          r = 0.12;
        }
        c = mix(c, wax, wall);
        const n = fbm(nz, u + 0.3, v, 32, 2) * 0.04;
        p.c = [c[0] + n, c[1] + n, c[2] + n * 0.8];
        p.h = h * (1 - wall) + wall * 0.95;
        p.r = wall > 0.5 ? 0.55 : r;
      },
      2.6,
    );
  });
}

/** Weathered boulder rock: granular brown-grey with fine cracks, varnish and lichen flecks. */
export function rockTex(seed = 71) {
  return cached(`rk:${seed}`, () => {
    const nz = makeNoise(seed);
    const w = makeWorley(seed, 3);
    const a = hex('#9A8670');
    const b = hex('#6F6152');
    const pale = hex('#C2B29A');
    return generate(
      256,
      (u, v, p) => {
        const n = fbm(nz, u, v, 4, 5) * 0.5 + 0.5;
        const grain = fbm(nz, u + 0.3, v + 0.1, 64, 2);
        const cell = w(u, v);
        const crack = 1 - smooth(0.0, 0.025, cell.d2 - cell.d1);
        const fine = Math.abs(fbm(nz, u * 1 + 0.5, v, 24, 3));
        const hair = 1 - smooth(0.0, 0.035, fine);
        let c = mix(a, b, clamp01(n * 0.9 - 0.15 + hash(cell.id) * 0.25));
        c = mix(c, pale, smooth(0.62, 0.85, fbm(nz, u + 0.7, v + 0.4, 8, 3) * 0.5 + 0.5) * 0.45);
        // lichen flecks
        const lic = smooth(0.78, 0.84, fbm(nz, u + 0.13, v + 0.77, 20, 3) * 0.5 + 0.5);
        c = mix(c, hex('#B9A46A'), lic * 0.55);
        c = mix(c, hex('#4A4036'), crack * 0.5 + hair * 0.25);
        p.c = [c[0] + grain * 0.04, c[1] + grain * 0.035, c[2] + grain * 0.03];
        p.h = n * 0.5 + grain * 0.2 - crack * 0.25 - hair * 0.1;
        p.r = 0.86 + grain * 0.06 - lic * 0.1;
      },
      2.8,
    );
  });
}

/** Lime render for the processing room: soft trowel marks, faint stains. */
export function render(seed = 111) {
  return cached(`rd:${seed}`, () => {
    const nz = makeNoise(seed);
    const base = hex('#F1EDE5');
    const dark = hex('#DDD5C7');
    return generate(
      256,
      (u, v, p) => {
        const m = fbm(nz, u, v, 3, 3) * 0.5 + 0.5;
        const trowel = fbmA(nz, u, v, 6, 3, 2);
        const fine = fbm(nz, u + 0.3, v + 0.2, 40, 2);
        p.c = mix(base, dark, clamp01(m * 0.35 + trowel * 0.1 - 0.05));
        p.c = [p.c[0] + fine * 0.02, p.c[1] + fine * 0.02, p.c[2] + fine * 0.018];
        p.h = trowel * 0.35 + fine * 0.25 + m * 0.2;
        p.r = 0.9 + fine * 0.05;
      },
      1.4,
    );
  });
}

/** Small ripple normal map for the bee waterer. */
export function ripples(seed = 101) {
  return cached(`rp:${seed}`, () => {
    const nz = makeNoise(seed);
    return generate(
      128,
      (u, v, p) => {
        p.c = [0.5, 0.5, 0.5];
        p.h = fbm(nz, u, v, 3, 4) * 0.6 + fbm(nz, u + 0.3, v + 0.6, 9, 2) * 0.3;
      },
      5,
    );
  });
}

/** Wadi bed: rounded cobbles and gravel of mixed ophiolite / limestone in a pale sandy matrix. */
export function gravel(seed = 41) {
  return cached(`gr:${seed}`, () => {
    const nz = makeNoise(seed);
    const big = makeWorley(seed, 7);
    const small = makeWorley(seed + 5, 19);
    const pal = ['#BDB5A5', '#CFBE9F', '#8E907D', '#6D6960', '#A47E5E', '#DCD5C6', '#9C8E78'].map(hex);
    const sand = hex('#C2B193');
    return generate(
      256,
      (u, v, p) => {
        const g = fbm(nz, u, v, 64, 2);
        let c = mix(sand, hex('#A8977A'), clamp01(fbm(nz, u, v, 8, 3) * 0.5 + 0.35));
        c = [c[0] + g * 0.05, c[1] + g * 0.045, c[2] + g * 0.04];
        let h = g * 0.1;
        let r = 0.95;
        const s = small(u, v);
        const sr = 0.36 + hash(s.id) * 0.12;
        if (s.d1 < sr) {
          const dome = Math.sqrt(1 - (s.d1 / sr) ** 2);
          const pc = pal[Math.floor(hash(s.id * 1.7) * pal.length)];
          c = mix(c, mix(pc, [pc[0] * 0.8, pc[1] * 0.8, pc[2] * 0.8], 1 - dome), smooth(0, 0.25, dome));
          h = 0.25 + dome * 0.45;
          r = 0.75;
        }
        const b = big(u, v);
        const br = 0.3 + hash(b.id + 9) * 0.16;
        if (b.d1 < br) {
          const dome = Math.sqrt(1 - (b.d1 / br) ** 2);
          const pc = pal[Math.floor(hash(b.id * 3.3 + 1) * pal.length)];
          const speck = fbm(nz, u + 0.3, v, 40, 2) * 0.06;
          c = mix(c, mix([pc[0] + speck, pc[1] + speck, pc[2] + speck], [pc[0] * 0.78, pc[1] * 0.78, pc[2] * 0.78], 1 - dome), smooth(0, 0.18, dome));
          h = 0.4 + dome;
          r = 0.7;
        }
        p.c = c;
        p.h = h;
        p.r = r;
      },
      2.6,
    );
  });
}

/** Areesh — palm-frond rib matting with rope ties. Ribs run along V; small gaps let light through. */
export function areesh(seed = 61) {
  return cached(`ar:${seed}`, () => {
    const nz = makeNoise(seed);
    const pal = ['#C2A46E', '#AF8F5A', '#9C7E52', '#CDB283', '#8C7150', '#B49768', '#A08A62', '#D1B98C'].map(hex);
    const ribs = 30;
    return generate(
      256,
      (u, v, p) => {
        const wob = fbmA(nz, u, v, 2, 1, 2) * 0.35 + fbmA(nz, u, v, 7, 1, 2) * 0.12;
        const x = u * ribs + wob;
        const id = Math.floor(x);
        const f = x - id;
        const hid = ((id % ribs) + ribs) % ribs;
        const width = 0.78 + hash(hid * 7.3) * 0.18;
        const inside = smooth(0, 0.08, f) * smooth(width, width - 0.08, f);
        const round = Math.sin(clamp01(f / width) * Math.PI);
        const fibre = fbmA(nz, u, v, 40, 3, 2);
        const base = pal[Math.floor(hash(hid + 0.5) * pal.length)];
        const tone = hash(hid * 3.3 + 1.7) * 0.3;
        let c = mix(base, [base[0] * 0.72, base[1] * 0.7, base[2] * 0.64], (1 - round) * 0.5 + fibre * 0.12 + tone);
        // twine ties every third of the panel
        const tieV = Math.abs(((v * 3) % 1) - 0.5);
        const tie = 1 - smooth(0.012, 0.03, tieV);
        c = mix(c, hex('#7A6040'), tie * 0.6);
        // occasional broken gaps between ribs
        const gapNoise = fbmA(nz, u + 0.7, v, 6, 4, 2);
        const open = (1 - inside) * smooth(-0.05, 0.25, gapNoise) * (1 - tie);
        p.c = c;
        p.a = 1 - open;
        p.h = round * 0.6 + fibre * 0.15 + tie * 0.5;
        p.r = 0.9;
      },
      2.4,
      true,
    );
  });
}

/* ---------------------------- Canvas textures ---------------------------- */

const canvasCache = new Map<string, THREE.Texture>();
function canvasCached(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) {
  const hit = canvasCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = canvasTex(c, srgb);
  canvasCache.set(key, t);
  return t;
}

/** Fine insect screen: wire grid in the green channel (used as alphaMap). */
export function screenMesh() {
  return canvasCached(
    'mesh',
    64,
    64,
    (g) => {
      g.fillStyle = '#000';
      g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#fff';
      for (let i = 0; i < 64; i += 8) {
        g.fillRect(i, 0, 2, 64);
        g.fillRect(0, i, 64, 2);
      }
    },
    false,
  );
}

/** Striped awning canvas (honey and cream). */
export function awningStripes() {
  return canvasCached('awning', 256, 64, (g) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 === 0 ? '#EFE5CF' : '#C88A2E';
      g.fillRect(i * 32, 0, 32, 64);
    }
    // weave + soft fold shading
    const img = g.getImageData(0, 0, 256, 64);
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 256; x++) {
        const i = (y * 256 + x) * 4;
        const w = ((x + y) % 2) * 6 - 3 + Math.sin(x * 0.7) * 2;
        img.data[i] += w;
        img.data[i + 1] += w;
        img.data[i + 2] += w;
      }
    g.putImageData(img, 0, 0);
  });
}

function hexPath(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

/** Jar label band: wraps once around the jar. */
export function jarLabel() {
  return canvasCached('label', 512, 96, (g) => {
    g.fillStyle = '#F2E8D0';
    g.fillRect(0, 0, 512, 96);
    g.fillStyle = '#2E4A3A';
    g.fillRect(0, 0, 512, 14);
    g.fillRect(0, 82, 512, 14);
    g.fillStyle = '#C9922F';
    g.fillRect(0, 14, 512, 4);
    g.fillRect(0, 78, 512, 4);
    for (const cx of [96, 352]) {
      g.fillStyle = '#C9922F';
      hexPath(g, cx, 48, 22);
      g.fill();
      g.fillStyle = '#F2E8D0';
      hexPath(g, cx, 48, 13);
      g.fill();
      g.fillStyle = '#5A4630';
      g.fillRect(cx + 34, 36, 70, 7);
      g.fillRect(cx + 34, 50, 48, 5);
      g.fillRect(cx - 104, 38, 60, 6);
      g.fillRect(cx - 92, 52, 48, 4);
    }
  });
}

/** Kiosk fascia sign. */
export function shopSign() {
  return canvasCached('sign', 1024, 192, (g) => {
    const grd = g.createLinearGradient(0, 0, 0, 192);
    grd.addColorStop(0, '#3A2A1C');
    grd.addColorStop(1, '#2A1E14');
    g.fillStyle = grd;
    g.fillRect(0, 0, 1024, 192);
    g.strokeStyle = '#C99A45';
    g.lineWidth = 6;
    g.strokeRect(14, 14, 996, 164);
    g.fillStyle = '#E7B65A';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '600 92px Georgia, "Times New Roman", serif';
    g.fillText('HONEY', 330, 100);
    g.font = '600 104px "Segoe UI", Tahoma, Arial, sans-serif';
    g.fillText('عسل', 760, 92);
    g.fillStyle = '#C99A45';
    hexPath(g, 556, 96, 26);
    g.fill();
    g.fillStyle = '#2E2116';
    hexPath(g, 556, 96, 14);
    g.fill();
  });
}

/** Illustrated panel in the observation pavilion: comb, bee anatomy, waggle dance. */
export function infoPanel() {
  return canvasCached('info', 512, 384, (g) => {
    g.fillStyle = '#F1E7D2';
    g.fillRect(0, 0, 512, 384);
    g.fillStyle = '#2E4A3A';
    g.fillRect(0, 0, 512, 54);
    g.fillStyle = '#F1E7D2';
    g.font = '600 30px Georgia, serif';
    g.textBaseline = 'middle';
    g.fillText('THE COLONY', 22, 28);
    g.textAlign = 'right';
    g.font = '600 32px "Segoe UI", Tahoma, Arial, sans-serif';
    g.fillText('الخلية', 490, 26);
    g.textAlign = 'left';
    // comb
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 5; c++) {
        const x = 40 + c * 34 + (r % 2) * 17;
        const y = 90 + r * 29;
        hexPath(g, x, y, 16);
        g.fillStyle = (r * 5 + c) % 4 === 0 ? '#F6DE9A' : (r + c) % 3 === 0 ? '#B86F14' : '#E2A43A';
        g.fill();
        g.strokeStyle = '#8A5A1A';
        g.lineWidth = 2;
        g.stroke();
      }
    // bee
    g.save();
    g.translate(330, 160);
    g.rotate(-0.4);
    g.fillStyle = 'rgba(210,225,235,0.85)';
    g.beginPath();
    g.ellipse(-8, -34, 22, 40, -0.5, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(14, -30, 18, 34, 0.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#E0A23A';
    g.beginPath();
    g.ellipse(0, 30, 30, 46, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2A1E14';
    for (const y of [16, 40, 62]) g.fillRect(-30, y, 60, 9);
    g.beginPath();
    g.ellipse(0, -14, 24, 22, 0, 0, Math.PI * 2);
    g.fillStyle = '#6E4A1E';
    g.fill();
    g.beginPath();
    g.ellipse(0, -46, 16, 15, 0, 0, Math.PI * 2);
    g.fillStyle = '#2A1E14';
    g.fill();
    g.restore();
    // waggle dance figure
    g.strokeStyle = '#2E4A3A';
    g.lineWidth = 4;
    g.beginPath();
    g.ellipse(410, 300, 34, 46, 0, Math.PI * 0.5, Math.PI * 1.5);
    g.stroke();
    g.beginPath();
    g.ellipse(450, 300, 34, 46, 0, -Math.PI * 0.5, Math.PI * 0.5);
    g.stroke();
    g.beginPath();
    for (let i = 0; i <= 12; i++) g.lineTo(430 + Math.sin(i * 1.6) * 7, 256 + i * 7.5);
    g.stroke();
    // text lines (illustrative)
    g.fillStyle = '#7C6A55';
    for (let i = 0; i < 6; i++) g.fillRect(28, 290 + i * 14, 300 - (i % 3) * 46, 6);
  });
}

/** Tiny bee-and-hex badge for the path sign. */
export function beeBadge() {
  return canvasCached('badge', 256, 256, (g) => {
    g.fillStyle = '#2E4A3A';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#E2A43A';
    hexPath(g, 128, 128, 100);
    g.fill();
    g.fillStyle = '#2E4A3A';
    hexPath(g, 128, 128, 84);
    g.fill();
    g.save();
    g.translate(128, 132);
    g.fillStyle = 'rgba(230,240,245,0.9)';
    g.beginPath();
    g.ellipse(-22, -26, 16, 28, -0.6, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(22, -26, 16, 28, 0.6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#E2A43A';
    g.beginPath();
    g.ellipse(0, 14, 24, 36, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1E1610';
    for (const y of [2, 20, 36]) g.fillRect(-24, y, 48, 8);
    g.beginPath();
    g.arc(0, -30, 13, 0, Math.PI * 2);
    g.fill();
    g.restore();
  });
}
