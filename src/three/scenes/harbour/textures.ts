import * as THREE from 'three';
import { fbm, makeNoise, makeWorley } from '../../materials/noise';

/* ------------------------------------------------------------------ */
/*  Harbour-specific procedural textures (all tileable, cached):       */
/*  water foam, floor caustics, gargoor hex wire, areesh thatch,       */
/*  twisted rope, painted gelcoat grime and hamour skin.               */
/* ------------------------------------------------------------------ */

type RGB = [number, number, number];
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function hex(c: string): RGB {
  const h = c.replace('#', '');
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

export interface LocalSet {
  map: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
  alphaMap?: THREE.Texture;
}

interface Px {
  c: RGB;
  h: number;
  r: number;
  a: number;
}

function canvasTex(data: Uint8ClampedArray, w: number, h: number, srgb: boolean) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.putImageData(new ImageData(data, w, h), 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

function gen(
  w: number,
  h: number,
  sampler: (u: number, v: number, p: Px) => void,
  opts: { normal?: number; rough?: boolean; alpha?: boolean } = {},
): LocalSet {
  const n = w * h;
  const col = new Uint8ClampedArray(n * 4);
  const hgt = new Float32Array(n);
  const rough = opts.rough ? new Uint8ClampedArray(n * 4) : null;
  const alpha = opts.alpha ? new Uint8ClampedArray(n * 4) : null;
  const p: Px = { c: [0, 0, 0], h: 0, r: 0.8, a: 1 };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      p.h = 0;
      p.r = 0.8;
      p.a = 1;
      sampler(x / w, y / h, p);
      const i = y * w + x;
      col[i * 4] = p.c[0] * 255;
      col[i * 4 + 1] = p.c[1] * 255;
      col[i * 4 + 2] = p.c[2] * 255;
      col[i * 4 + 3] = 255;
      hgt[i] = p.h;
      if (rough) {
        const r = clamp01(p.r) * 255;
        rough[i * 4] = rough[i * 4 + 1] = rough[i * 4 + 2] = r;
        rough[i * 4 + 3] = 255;
      }
      if (alpha) {
        const a = clamp01(p.a) * 255;
        alpha[i * 4] = alpha[i * 4 + 1] = alpha[i * 4 + 2] = a;
        alpha[i * 4 + 3] = 255;
      }
    }
  const out: LocalSet = { map: canvasTex(col, w, h, true) };
  if (opts.normal) {
    const s = opts.normal;
    const nrm = new Uint8ClampedArray(n * 4);
    const at = (x: number, y: number) => hgt[((y + h) % h) * w + ((x + w) % w)];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1)) * s;
        const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1)) * s;
        const l = Math.hypot(dx, dy, 1);
        const i = (y * w + x) * 4;
        nrm[i] = (-dx / l * 0.5 + 0.5) * 255;
        nrm[i + 1] = (dy / l * 0.5 + 0.5) * 255;
        nrm[i + 2] = (1 / l * 0.5 + 0.5) * 255;
        nrm[i + 3] = 255;
      }
    out.normalMap = canvasTex(nrm, w, h, false);
  }
  if (rough) out.roughnessMap = canvasTex(rough, w, h, false);
  if (alpha) out.alphaMap = canvasTex(alpha, w, h, false);
  return out;
}

const cache = new Map<string, LocalSet>();
function cached(key: string, make: () => LocalSet) {
  let hit = cache.get(key);
  if (!hit) {
    hit = make();
    cache.set(key, hit);
  }
  return hit;
}

/** Lacy sea foam: bright bubble walls with patchy coverage (single channel). */
export function foamTexture() {
  return cached('foam', () => {
    const nz = makeNoise(31);
    const w1 = makeWorley(5, 10);
    const w2 = makeWorley(9, 22);
    const s = gen(256, 256, (u, v, p) => {
      const a = w1(u, v);
      const b = w2(u, v);
      const lace = Math.max(1 - smooth(0.0, 0.22, a.d2 - a.d1), (1 - smooth(0.0, 0.16, b.d2 - b.d1)) * 0.8);
      const patch = fbm(nz, u, v, 4, 3) * 0.5 + 0.5;
      const val = clamp01(lace * (0.35 + patch * 0.9) + smooth(0.55, 0.9, patch) * 0.35);
      p.c = [val, val, val];
    });
    s.map.colorSpace = THREE.NoColorSpace;
    return s;
  }).map;
}

/** Sunlight caustic web for the sandy sea floor. */
export function causticTexture() {
  return cached('caustic', () => {
    const nz = makeNoise(12);
    const w = makeWorley(21, 7);
    const s = gen(256, 256, (u, v, p) => {
      const wu = u + fbm(nz, u, v, 3, 2) * 0.035;
      const wv = v + fbm(nz, u + 0.4, v + 0.2, 3, 2) * 0.035;
      const c = w(((wu % 1) + 1) % 1, ((wv % 1) + 1) % 1);
      const edge = 1 - smooth(0.0, 0.3, c.d2 - c.d1);
      const val = Math.pow(edge, 2.2);
      p.c = [val, val, val];
    });
    s.map.colorSpace = THREE.NoColorSpace;
    return s;
  }).map;
}

/**
 * Galvanised hexagonal wire weave for gargoor traps (map + alpha + normal).
 * `cols` hexagons across one tile and 2×cols rows down it, so a tile is
 * √3 times taller than wide — map it with repeatV = repeatU / 1.732.
 */
export const HEX_ASPECT = 1.732;
export function hexWireSet(cols = 6) {
  return cached(`hexwire:${cols}`, () => {
    const nz = makeNoise(44);
    const silver = hex('#C9CDCB');
    const dark = hex('#848A88');
    const rust = hex('#8A5A32');
    const rows = cols * 2;
    return gen(
      256,
      256,
      (u, v, p) => {
        const px = u * cols;
        const py = v * rows;
        const i0 = Math.floor(px);
        const j0 = Math.floor(py);
        let d1 = 9;
        let d2 = 9;
        let ex = 0;
        let ey = 0;
        for (let dj = -1; dj <= 1; dj++) {
          const j = j0 + dj;
          const off = (((j % 2) + 2) % 2) * 0.5;
          for (let di = -1; di <= 1; di++) {
            const cx = i0 + di + off + 0.25;
            const cy = j + 0.5;
            const dx = px - cx;
            const dy = (py - cy) * 0.866;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < d1) {
              d2 = d1;
              d1 = d;
              ex = dx;
              ey = dy;
            } else if (d < d2) d2 = d;
          }
        }
        const edge = d2 - d1;
        const wire = 1 - smooth(0.035, 0.085, edge);
        // twisted pairs on the near-vertical sides read as chicken-wire knots
        const vertical = smooth(0.35, 0.5, Math.abs(ex) / (Math.abs(ey) + Math.abs(ex) + 1e-4));
        const twist = 0.5 + 0.5 * Math.sin(py * Math.PI * 12);
        const n = fbm(nz, u, v, 6, 3) * 0.5 + 0.5;
        const rustAmt = smooth(0.6, 0.85, n);
        let c = mix(silver, dark, 0.25 + 0.35 * twist * vertical);
        c = mix(c, rust, rustAmt * 0.6);
        p.c = c;
        p.a = clamp01(wire * (1 + 0.4 * vertical));
        p.h = wire * (0.7 + 0.3 * twist * vertical);
        p.r = 0.4 + rustAmt * 0.4;
      },
      { normal: 2, alpha: true, rough: true },
    );
  });
}

/** Dried palm-frond thatch (areesh) — fibres run along v. */
export function thatchSet() {
  return cached('thatch', () => {
    const nz = makeNoise(57);
    const light = hex('#CDB081');
    const mid = hex('#A8875A');
    const dark = hex('#6E5434');
    return gen(
      256,
      256,
      (u, v, p) => {
        const warp = fbm(nz, u, v, 3, 2) * 0.03;
        const strands = Math.sin((u + warp) * 160 * Math.PI) * 0.5 + 0.5;
        const ribs = Math.pow(Math.abs(Math.sin((u + warp * 2) * 22 * Math.PI)), 6);
        const bundles = fbm(nz, u * 4, v * 0.5, 6, 3) * 0.5 + 0.5;
        const tie = smooth(0.94, 0.985, Math.abs(Math.sin(v * 3 * Math.PI)));
        let c = mix(mid, light, clamp01(strands * 0.45 + ribs * 0.5 + bundles * 0.3));
        c = mix(c, dark, clamp01(tie * 0.38 + (1 - bundles) * 0.25 + (1 - strands) * 0.12));
        p.c = c;
        p.h = strands * 0.4 + ribs * 0.6 - tie * 0.8;
        p.r = 0.92;
      },
      { normal: 3 },
    );
  });
}

/** Three-strand laid rope; u runs around, v along the rope. */
export function ropeSet() {
  return cached('rope', () => {
    const nz = makeNoise(63);
    return gen(
      128,
      128,
      (u, v, p) => {
        const strand = (u * 3 + v * 3) % 1;
        const prof = Math.sin(strand * Math.PI);
        const fib = fbm(nz, u, v, 32, 2) * 0.5 + 0.5;
        const t = clamp01(prof * 0.8 + fib * 0.25);
        p.c = [0.55 + t * 0.4, 0.5 + t * 0.38, 0.4 + t * 0.32];
        p.h = prof + fib * 0.2;
        p.r = 0.9;
      },
      { normal: 2.5 },
    );
  });
}

/** Weathered gelcoat: subtle chalking, scuffs and waterline grime (v=0 bottom). */
export function gelcoatSet() {
  return cached('gelcoat', () => {
    const nz = makeNoise(71);
    return gen(
      256,
      256,
      (u, v, p) => {
        const n = fbm(nz, u, v, 5, 4) * 0.5 + 0.5;
        const streak = fbm(nz, u * 6, v * 0.6, 4, 3) * 0.5 + 0.5;
        const scuff = smooth(0.72, 0.9, fbm(nz, u + 0.3, v + 0.7, 12, 3) * 0.5 + 0.5);
        const g = 0.94 - n * 0.06 - streak * 0.05 - scuff * 0.1;
        p.c = [g, g * 0.995, g * 0.975];
        p.h = n * 0.15 - scuff * 0.2;
        p.r = 0.28 + n * 0.2 + scuff * 0.3;
      },
      { normal: 0.8, rough: true },
    );
  });
}

/** Spotted hamour (grouper) skin for the fish on the sorting tables. */
export function hamourTexture() {
  return cached('hamour', () => {
    const w = makeWorley(17, 9);
    const nz = makeNoise(88);
    const base = hex('#9C7A5A');
    const spot = hex('#B4552B');
    const belly = hex('#D9C7AE');
    return gen(128, 128, (u, v, p) => {
      const c = w(u, v);
      const s = 1 - smooth(0.18, 0.32, c.d1);
      const n = fbm(nz, u, v, 4, 2) * 0.5 + 0.5;
      let col = mix(base, belly, smooth(0.55, 0.9, v) * 0.6);
      col = mix(col, spot, s * 0.75);
      col = mix(col, hex('#5A4636'), n * 0.25);
      p.c = col;
    });
  }).map;
}

/** Weathered quarry rock: mottled limestone/gabbro, pits, lichen speckle and fine cracks (no mortar cells). */
export function rockSet() {
  return cached('rock', () => {
    const nz = makeNoise(73);
    const w = makeWorley(29, 5);
    const base = hex('#A69B88');
    const dark = hex('#6F665A');
    const warm = hex('#B49A7A');
    const lichen = hex('#C9C2A6');
    return gen(
      256,
      256,
      (u, v, p) => {
        const n = fbm(nz, u, v, 4, 5) * 0.5 + 0.5;
        const n2 = fbm(nz, u + 0.37, v + 0.11, 12, 3) * 0.5 + 0.5;
        const c = w(u, v);
        const crack = 1 - smooth(0.0, 0.05, c.d2 - c.d1) * 1;
        const fineCrack = smooth(0.82, 0.95, Math.abs(fbm(nz, u * 0.7 + 0.2, v * 1.3, 9, 3)) * 2.2);
        const pits = smooth(0.72, 0.85, fbm(nz, u + 0.6, v + 0.3, 40, 2) * 0.5 + 0.5);
        let col = mix(dark, base, smooth(0.25, 0.75, n));
        col = mix(col, warm, smooth(0.55, 0.85, n2) * 0.45);
        col = mix(col, lichen, smooth(0.78, 0.92, fbm(nz, u + 0.9, v + 0.5, 20, 2) * 0.5 + 0.5) * 0.5);
        col = mix(col, dark, Math.max(crack * 0.55, fineCrack * 0.45, pits * 0.35));
        p.c = col;
        p.h = n * 0.6 + n2 * 0.35 - crack * 0.5 - pits * 0.25 - fineCrack * 0.3;
        p.r = 0.9 - n2 * 0.1;
      },
      { normal: 2.6 },
    );
  });
}

/** Knotted monofilament netting in white (tinted by vertex colour), with alpha. */
export function netSet(cells = 8) {
  return cached(`net:${cells}`, () =>
    gen(
      256,
      256,
      (u, v, p) => {
        const a = (u + v) * cells;
        const b = (u - v) * cells;
        const da = Math.abs(a - Math.round(a));
        const db = Math.abs(b - Math.round(b));
        const strand = 1 - smooth(0.035, 0.075, Math.min(da, db));
        const knot = 1 - smooth(0.05, 0.12, Math.hypot(da, db));
        const m = Math.max(strand, knot);
        const g = 0.82 + knot * 0.18;
        p.c = [g, g, g];
        p.a = m;
        p.h = m;
        p.r = 0.7;
      },
      { alpha: true, normal: 1.2 },
    ),
  );
}

/** Trowelled harbour concrete: soft mottling, damp stains and fine aggregate. */
export function concreteSet() {
  return cached('concrete', () => {
    const nz = makeNoise(83);
    return gen(
      256,
      256,
      (u, v, p) => {
        const n = fbm(nz, u, v, 3, 4) * 0.5 + 0.5;
        const stain = smooth(0.6, 0.85, fbm(nz, u + 0.4, v + 0.7, 2, 3) * 0.5 + 0.5);
        const grit = fbm(nz, u + 0.13, v + 0.29, 64, 2);
        const g = 0.76 + n * 0.1 - stain * 0.1 + grit * 0.018;
        p.c = [g, g * 0.985, g * 0.95];
        p.h = grit * 0.15 + n * 0.1;
        p.r = 0.85 - stain * 0.2;
      },
      { normal: 0.4, rough: true },
    );
  });
}
