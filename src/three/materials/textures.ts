import * as THREE from 'three';
import { fbm, makeNoise, makeWorley, ridged, type Noise2 } from './noise';

/* ------------------------------------------------------------------ */
/*  Procedural PBR texture sets — colour, normal and roughness maps.  */
/*  All tile seamlessly and are cached, so scenes stay asset-free.    */
/* ------------------------------------------------------------------ */

export interface TexSet {
  map: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
  alphaMap?: THREE.Texture;
}

type RGB = [number, number, number];

export function hex(c: string): RGB {
  const h = c.replace('#', '');
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

interface Pixel {
  c: RGB;
  h: number;
  r: number;
  a: number;
}

interface GenOpts {
  size?: number;
  normalStrength?: number;
  wantNormal?: boolean;
  wantRough?: boolean;
  wantAlpha?: boolean;
}

const isBrowser = typeof document !== 'undefined';

function makeCanvas(size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function finishTexture(canvas: HTMLCanvasElement, srgb: boolean) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

function generate(sampler: (u: number, v: number, px: Pixel) => void, opts: GenOpts = {}): TexSet {
  const size = opts.size ?? 512;
  const n = size * size;
  const color = new Uint8ClampedArray(n * 4);
  const height = new Float32Array(n);
  const rough = new Uint8ClampedArray(n * 4);
  const alpha = new Uint8ClampedArray(n * 4);
  const px: Pixel = { c: [0, 0, 0], h: 0, r: 0.8, a: 1 };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      px.h = 0;
      px.r = 0.8;
      px.a = 1;
      sampler(x / size, y / size, px);
      const i = y * size + x;
      color[i * 4] = px.c[0] * 255;
      color[i * 4 + 1] = px.c[1] * 255;
      color[i * 4 + 2] = px.c[2] * 255;
      color[i * 4 + 3] = 255;
      height[i] = px.h;
      const rv = clamp01(px.r) * 255;
      rough[i * 4] = rough[i * 4 + 1] = rough[i * 4 + 2] = rv;
      rough[i * 4 + 3] = 255;
      const av = clamp01(px.a) * 255;
      alpha[i * 4] = alpha[i * 4 + 1] = alpha[i * 4 + 2] = av;
      alpha[i * 4 + 3] = 255;
    }
  }
  const out: TexSet = { map: toTexture(color, size, true) };
  if (opts.wantNormal !== false) out.normalMap = toTexture(heightToNormal(height, size, opts.normalStrength ?? 2), size, false);
  if (opts.wantRough !== false) out.roughnessMap = toTexture(rough, size, false);
  if (opts.wantAlpha) out.alphaMap = toTexture(alpha, size, false);
  return out;
}

function toTexture(data: Uint8ClampedArray, size: number, srgb: boolean) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d')!;
  ctx.putImageData(new ImageData(data, size, size), 0, 0);
  return finishTexture(c, srgb);
}

function heightToNormal(h: Float32Array, size: number, strength: number) {
  const out = new Uint8ClampedArray(size * size * 4);
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx =
        (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1)) * strength;
      const dy =
        (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1)) * strength;
      let nx = -dx;
      let ny = dy;
      let nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l;
      ny /= l;
      nz /= l;
      const i = (y * size + x) * 4;
      out[i] = (nx * 0.5 + 0.5) * 255;
      out[i + 1] = (ny * 0.5 + 0.5) * 255;
      out[i + 2] = (nz * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  }
  return out;
}

/* ------------------------------ Generators ------------------------------ */

export interface PlasterOpts {
  base?: string;
  dark?: string;
  seed?: number;
  roughness?: number;
  stains?: number;
}

const gens = {
  plaster({ base = '#E6D5B8', dark = '#C9AE86', seed = 1, roughness = 0.9, stains = 0.35 }: PlasterOpts = {}) {
    const nz = makeNoise(seed);
    const b = hex(base);
    const d = hex(dark);
    return generate(
      (u, v, p) => {
        const m = fbm(nz, u, v, 3, 4) * 0.5 + 0.5;
        const fine = fbm(nz, u + 0.31, v + 0.17, 48, 2);
        const streak = fbm(nz, u * 0.5, v, 6, 3) * 0.5 + 0.5;
        const t = clamp01(m * stains + (1 - v) * 0.0 + streak * 0.12);
        p.c = mix(b, d, t);
        p.c = [p.c[0] + fine * 0.025, p.c[1] + fine * 0.025, p.c[2] + fine * 0.02];
        p.h = fbm(nz, u, v, 12, 4) * 0.6 + fbm(nz, u + 0.5, v, 64, 2) * 0.25;
        p.r = roughness + fine * 0.08;
      },
      { normalStrength: 1.6 },
    );
  },

  sand({ base = '#D8B887', light = '#E9D2A6', seed = 2 }: { base?: string; light?: string; seed?: number } = {}) {
    const nz = makeNoise(seed);
    const b = hex(base);
    const l = hex(light);
    return generate(
      (u, v, p) => {
        const warp = fbm(nz, u, v, 2, 3) * 0.9;
        const ripple = Math.sin((v * 22 + warp * 3) * Math.PI * 2) * 0.5 + 0.5;
        const grain = fbm(nz, u + 0.7, v + 0.3, 128, 2);
        const patch = fbm(nz, u + 0.2, v + 0.9, 3, 4) * 0.5 + 0.5;
        p.c = mix(b, l, clamp01(ripple * 0.35 + patch * 0.45));
        p.c = [p.c[0] + grain * 0.05, p.c[1] + grain * 0.045, p.c[2] + grain * 0.04];
        p.h = ripple * 0.35 + grain * 0.35;
        p.r = 0.95;
      },
      { normalStrength: 1.4 },
    );
  },

  soil({ base = '#5A3D28', light = '#7A5638', seed = 3 }: { base?: string; light?: string; seed?: number } = {}) {
    const nz = makeNoise(seed);
    const w = makeWorley(seed, 14);
    const b = hex(base);
    const l = hex(light);
    return generate(
      (u, v, p) => {
        const clod = w(u, v);
        const lump = 1 - smooth(0, 0.9, clod.d1);
        const n = fbm(nz, u, v, 16, 3) * 0.5 + 0.5;
        p.c = mix(b, l, clamp01(lump * 0.5 + n * 0.3));
        const g = fbm(nz, u + 0.4, v, 96, 2);
        p.c = [p.c[0] + g * 0.04, p.c[1] + g * 0.035, p.c[2] + g * 0.03];
        p.h = lump * 0.8 + g * 0.3;
        p.r = 0.97;
      },
      { normalStrength: 2.4 },
    );
  },

  wood({
    base = '#8A5A35',
    dark = '#5A3519',
    planks = 6,
    seed = 4,
    roughness = 0.7,
    seams = true,
  }: { base?: string; dark?: string; planks?: number; seed?: number; roughness?: number; seams?: boolean } = {}) {
    const nz = makeNoise(seed);
    const b = hex(base);
    const d = hex(dark);
    return generate(
      (u, v, p) => {
        const row = Math.floor(v * planks);
        const rv = v * planks - row;
        const offset = ((row * 0.618) % 1) + 0.13 * row;
        const tone = (Math.sin(row * 12.9898 + seed) * 43758.5453) % 1;
        const uu = (u + offset) % 1;
        const grainWarp = fbm(nz, uu, (row + rv) / planks, 3, 3) * 2.2;
        const grain = Math.sin((rv * 9 + grainWarp + uu * 0.6) * Math.PI * 2 * 1.6) * 0.5 + 0.5;
        const fine = fbm(nz, uu * 1, v * 40, 16, 2) * 0.5 + 0.5;
        const knot = Math.max(0, 1 - Math.hypot((uu - 0.37) * 6, (rv - 0.5) * 2.2)) * (Math.abs(tone) > 0.6 ? 1 : 0);
        let c = mix(b, d, clamp01(grain * 0.45 + fine * 0.25 + knot * 0.6));
        c = mix(c, d, Math.abs(tone) * 0.18);
        const seam = seams ? smooth(0.0, 0.035, rv) * smooth(1.0, 0.965, rv) : 1;
        // end joints
        const joint = seams ? smooth(0, 0.004, Math.abs(((uu * 2 + row * 0.37) % 1) - 0.5)) : 1;
        const s = Math.min(seam, joint);
        p.c = mix(d, c, 0.35 + 0.65 * s);
        p.h = s * 0.8 + grain * 0.12 + fine * 0.06;
        p.r = roughness + (1 - s) * 0.2 - grain * 0.06;
      },
      { normalStrength: 2.2 },
    );
  },

  stone({
    base = '#C9B79C',
    dark = '#A28C6E',
    mortar = '#8E7C66',
    cells = 7,
    seed = 5,
  }: { base?: string; dark?: string; mortar?: string; cells?: number; seed?: number } = {}) {
    const nz = makeNoise(seed);
    const w = makeWorley(seed, cells);
    const b = hex(base);
    const d = hex(dark);
    const m = hex(mortar);
    return generate(
      (u, v, p) => {
        const { d1, d2, id } = w(u, v);
        const edge = d2 - d1;
        const gap = smooth(0.04, 0.16, edge);
        const tone = ((id * 0.618) % 1) * 0.6;
        const n = fbm(nz, u, v, 12, 4) * 0.5 + 0.5;
        const c = mix(b, d, clamp01(tone + n * 0.35));
        p.c = mix(m, c, gap);
        p.h = gap * 0.9 + n * 0.2 - d1 * 0.15;
        p.r = 0.88 - gap * 0.06;
      },
      { normalStrength: 2.6 },
    );
  },

  terracotta({ base = '#B8653C', dark = '#8C4526', seed = 6 }: { base?: string; dark?: string; seed?: number } = {}) {
    const nz = makeNoise(seed);
    const b = hex(base);
    const d = hex(dark);
    return generate(
      (u, v, p) => {
        const n = fbm(nz, u, v, 6, 4) * 0.5 + 0.5;
        const speck = fbm(nz, u + 0.1, v + 0.4, 160, 1);
        p.c = mix(b, d, clamp01(n * 0.4 + (speck > 0.55 ? 0.5 : 0)));
        p.h = n * 0.4 + speck * 0.1;
        p.r = 0.86;
      },
      { normalStrength: 1.2 },
    );
  },

  brick({ base = '#A5573A', dark = '#7A3A24', mortar = '#CDBDA4', rows = 10, seed = 7 }: { base?: string; dark?: string; mortar?: string; rows?: number; seed?: number } = {}) {
    const nz = makeNoise(seed);
    const b = hex(base);
    const d = hex(dark);
    const m = hex(mortar);
    return generate(
      (u, v, p) => {
        const row = Math.floor(v * rows);
        const ry = v * rows - row;
        const cols = rows / 2;
        const ux = u * cols + (row % 2) * 0.5;
        const col = Math.floor(ux);
        const rx = ux - col;
        const gap = Math.min(smooth(0, 0.06, ry), smooth(1, 0.94, ry), smooth(0, 0.03, rx), smooth(1, 0.97, rx));
        const tone = Math.abs(Math.sin(row * 91.7 + col * 17.3)) * 0.6;
        const n = fbm(nz, u, v, 24, 3) * 0.5 + 0.5;
        const c = mix(b, d, clamp01(tone + n * 0.3));
        p.c = mix(m, c, gap);
        p.h = gap * 0.8 + n * 0.15;
        p.r = 0.9;
      },
      { normalStrength: 2.2 },
    );
  },

  sadu({ seed = 8 }: { seed?: number } = {}) {
    // Al Sadu inspired weave: bands of red, black, white and ochre with geometric motifs.
    const nz = makeNoise(seed);
    const red = hex('#8E1E1A');
    const black = hex('#1E1512');
    const white = hex('#EDE3D1');
    const ochre = hex('#C98B2E');
    const brown = hex('#6B4A2E');
    return generate(
      (u, v, p) => {
        const band = Math.floor(v * 8);
        const bv = v * 8 - band;
        const x = u * 16;
        let c: RGB;
        if (band % 4 === 0) {
          // triangle row
          const tx = (x % 1) - 0.5;
          c = Math.abs(tx) < bv * 0.5 ? red : black;
          if (bv < 0.08 || bv > 0.92) c = white;
        } else if (band % 4 === 1) {
          const check = (Math.floor(x * 2) + Math.floor(bv * 4)) % 2 === 0;
          c = check ? black : white;
        } else if (band % 4 === 2) {
          // diamond row
          const dx = Math.abs((x % 2) - 1);
          const dy = Math.abs(bv - 0.5) * 2;
          const dd = dx + dy;
          c = dd < 0.55 ? ochre : dd < 0.75 ? white : red;
        } else {
          c = bv < 0.2 || bv > 0.8 ? brown : red;
        }
        const weave = Math.sin(u * 512 * Math.PI) * Math.sin(v * 512 * Math.PI);
        const n = fbm(nz, u, v, 32, 2) * 0.06;
        p.c = [c[0] + n + weave * 0.02, c[1] + n + weave * 0.02, c[2] + n + weave * 0.02];
        p.h = weave * 0.3 + 0.5;
        p.r = 0.95;
      },
      { normalStrength: 1, size: 512 },
    );
  },

  honeycomb({ seed = 9, filled = 0.85 }: { seed?: number; filled?: number } = {}) {
    const nz = makeNoise(seed);
    const wax = hex('#F1C35A');
    const honey = hex('#C97A12');
    const cap = hex('#F6E3A8');
    const cols = 16;
    return generate(
      (u, v, p) => {
        // axial hex grid
        const sx = u * cols;
        const sy = v * cols * 1.1547;
        const q = sx - sy / 1.732;
        const r = (sy * 2) / 1.732;
        let rx = Math.round(q);
        let ry = Math.round(r);
        const rz = Math.round(-q - r);
        const dxq = Math.abs(rx - q);
        const dyr = Math.abs(ry - r);
        const dzs = Math.abs(rz + q + r);
        if (dxq > dyr && dxq > dzs) rx = -ry - rz;
        else if (dyr > dzs) ry = -rx - rz;
        const fx = q - rx;
        const fy = r - ry;
        const dist = Math.max(Math.abs(fx), Math.abs(fy), Math.abs(fx + fy));
        const wall = smooth(0.38, 0.5, dist);
        const cell = Math.abs(Math.sin(rx * 12.9898 + ry * 78.233) * 43758.5453) % 1;
        const isCapped = cell < 0.35;
        const isHoney = cell < filled;
        const n = fbm(nz, u, v, 16, 2) * 0.05;
        let c = isCapped ? cap : isHoney ? mix(honey, wax, dist * 0.8) : mix(hex('#6B4416'), wax, dist);
        c = mix(c, wax, wall);
        p.c = [c[0] + n, c[1] + n, c[2] + n];
        p.h = wall * 0.9 + (isCapped ? 0.6 : 0.1 - dist * 0.2);
        p.r = isHoney && !isCapped ? 0.18 : 0.55;
      },
      { normalStrength: 3, size: 512 },
    );
  },

  metal({ base = '#B8955A', seed = 10, roughness = 0.38 }: { base?: string; seed?: number; roughness?: number } = {}) {
    const nz = makeNoise(seed);
    const b = hex(base);
    return generate(
      (u, v, p) => {
        const brushed = fbm(nz, u * 0.25, v, 96, 2);
        const patina = fbm(nz, u, v, 4, 4) * 0.5 + 0.5;
        p.c = mix(b, mix(b, hex('#5C4A2C'), 0.5), clamp01(patina * 0.25 + brushed * 0.08));
        p.h = brushed * 0.15;
        p.r = roughness + brushed * 0.1 + patina * 0.1;
      },
      { normalStrength: 0.6 },
    );
  },

  fabric({ base = '#E8DDC9', seed = 11, weave = 160 }: { base?: string; seed?: number; weave?: number } = {}) {
    const nz = makeNoise(seed);
    const b = hex(base);
    return generate(
      (u, v, p) => {
        const wx = Math.sin(u * weave * Math.PI * 2);
        const wy = Math.sin(v * weave * Math.PI * 2);
        const slub = fbm(nz, u, v * 0.2, 24, 2) * 0.5 + 0.5;
        const n = fbm(nz, u, v, 8, 3) * 0.04;
        const t = wx * wy * 0.04 + (slub - 0.5) * 0.06 + n;
        p.c = [b[0] + t, b[1] + t, b[2] + t];
        p.h = (wx * 0.5 + 0.5) * (wy * 0.5 + 0.5);
        p.r = 0.92;
      },
      { normalStrength: 0.9 },
    );
  },

  net({ cells = 10 }: { cells?: number } = {}) {
    return generate(
      (u, v, p) => {
        const a = (u + v) * cells;
        const b = (u - v) * cells;
        const da = Math.abs(a - Math.round(a));
        const db = Math.abs(b - Math.round(b));
        const line = Math.min(da, db);
        const strand = 1 - smooth(0.03, 0.07, line);
        const knot = 1 - smooth(0.04, 0.11, Math.hypot(da, db));
        const m = Math.max(strand, knot);
        p.c = mix(hex('#2E5E62'), hex('#4C8A88'), m * 0.4);
        p.a = m;
        p.h = m;
        p.r = 0.9;
      },
      { wantAlpha: true, size: 512, normalStrength: 1.5 },
    );
  },

  bark({ base = '#7D6247', dark = '#4A3828', seed = 12 }: { base?: string; dark?: string; seed?: number } = {}) {
    // Date palm trunk: staggered diamond leaf-base scars
    const nz = makeNoise(seed);
    const b = hex(base);
    const d = hex(dark);
    return generate(
      (u, v, p) => {
        const rows = 16;
        const cols = 8;
        const row = Math.floor(v * rows);
        const ry = v * rows - row;
        const ux = u * cols + (row % 2) * 0.5;
        const rx = ux - Math.floor(ux);
        const dd = Math.abs(rx - 0.5) * 1.4 + Math.abs(ry - 0.55) * 1.1;
        const scale = 1 - smooth(0.45, 0.62, dd);
        const fib = fbm(nz, u * 2, v * 8, 24, 3) * 0.5 + 0.5;
        p.c = mix(d, b, clamp01(scale * 0.75 + fib * 0.35));
        p.h = scale * 0.9 + fib * 0.3 - ry * 0.25 * scale;
        p.r = 0.93;
      },
      { normalStrength: 3, size: 512 },
    );
  },

  furrowBark({ base = '#7A6A58', dark = '#3B3027', seed = 22 }: { base?: string; dark?: string; seed?: number } = {}) {
    // Deeply furrowed broadleaf bark (ghaf, sidr, acacia): vertical ridges with cross-cracks
    const nz = makeNoise(seed);
    const b = hex(base);
    const d = hex(dark);
    return generate(
      (u, v, p) => {
        const warp = fbm(nz, u, v, 3, 3) * 0.12;
        const ridge = ridged(nz, (u + warp) * 1, v * 0.25, 10, 3);
        const cracks = smooth(0.55, 0.85, ridged(nz, u * 0.5 + 0.3, v, 6, 2));
        const n = fbm(nz, u, v, 32, 2) * 0.5 + 0.5;
        const t = clamp01(ridge * 1.25 - cracks * 0.35);
        let c = mix(d, b, t);
        c = mix(c, hex('#9A8E7C'), smooth(0.7, 1, n) * 0.25);
        p.c = c;
        p.h = t * 0.9 + n * 0.1;
        p.r = 0.95;
      },
      { normalStrength: 3.2 },
    );
  },

  marble({ base = '#EFE7DA', vein = '#B9A893', seed = 13 }: { base?: string; vein?: string; seed?: number } = {}) {
    const nz = makeNoise(seed);
    const b = hex(base);
    const vc = hex(vein);
    return generate(
      (u, v, p) => {
        const r = ridged(nz, u, v, 3, 5);
        const t = smooth(0.62, 0.95, r);
        const n = fbm(nz, u + 0.3, v, 8, 3) * 0.03;
        const c = mix(b, vc, t * 0.85);
        p.c = [c[0] + n, c[1] + n, c[2] + n];
        p.h = -t * 0.2;
        p.r = 0.22 + t * 0.15;
      },
      { normalStrength: 0.5 },
    );
  },

  ground({ base = '#B99A6F', dark = '#8E7352', green = '#7D7A45', seed = 14 }: { base?: string; dark?: string; green?: string; seed?: number } = {}) {
    // Packed earth with pebbles and sparse dry vegetation tint
    const nz = makeNoise(seed);
    const w = makeWorley(seed, 24);
    const b = hex(base);
    const d = hex(dark);
    const g = hex(green);
    return generate(
      (u, v, p) => {
        const n = fbm(nz, u, v, 4, 5) * 0.5 + 0.5;
        const pb = w(u, v);
        const pebble = 1 - smooth(0.15, 0.35, pb.d1);
        const veg = smooth(0.62, 0.8, fbm(nz, u + 0.5, v + 0.2, 6, 4) * 0.5 + 0.5);
        let c = mix(b, d, clamp01(n * 0.6));
        c = mix(c, g, veg * 0.45);
        c = mix(c, mix(hex('#D9CBB2'), d, (pb.id % 7) / 9), pebble * 0.7);
        p.c = c;
        p.h = n * 0.3 + pebble * 0.6;
        p.r = 0.95 - pebble * 0.15;
      },
      { normalStrength: 2.2 },
    );
  },

  waterNormal({ seed = 15 }: { seed?: number } = {}) {
    const nz = makeNoise(seed);
    return generate(
      (u, v, p) => {
        p.c = [0, 0, 0];
        p.h = fbm(nz, u, v, 4, 5, 0.55) * 0.7 + fbm(nz, u + 0.3, v + 0.6, 16, 3) * 0.3;
      },
      { normalStrength: 6, wantRough: false, size: 512 },
    );
  },
};

export type TexName = keyof typeof gens;
type GenArgs<K extends TexName> = Parameters<(typeof gens)[K]>[0];

const cache = new Map<string, TexSet>();

/** Cached texture set. Call with a stable options object (or primitives). */
export function getTexSet<K extends TexName>(name: K, opts?: GenArgs<K>): TexSet {
  const key = `${name}:${JSON.stringify(opts ?? {})}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (!isBrowser) throw new Error('Textures need a browser');
  const fn = gens[name] as (o?: GenArgs<K>) => TexSet;
  const set = fn(opts);
  cache.set(key, set);
  return set;
}

/** Clone a cached set with its own repeat (images are shared on the GPU). */
export function repeatSet(set: TexSet, rx: number, ry = rx): TexSet {
  const out: TexSet = { map: set.map.clone() };
  out.map.repeat.set(rx, ry);
  if (set.normalMap) {
    out.normalMap = set.normalMap.clone();
    out.normalMap.repeat.set(rx, ry);
  }
  if (set.roughnessMap) {
    out.roughnessMap = set.roughnessMap.clone();
    out.roughnessMap.repeat.set(rx, ry);
  }
  if (set.alphaMap) {
    out.alphaMap = set.alphaMap.clone();
    out.alphaMap.repeat.set(rx, ry);
  }
  for (const t of Object.values(out)) if (t) t.needsUpdate = true;
  return out;
}

export function useNoise(seed = 1): Noise2 {
  return makeNoise(seed);
}
