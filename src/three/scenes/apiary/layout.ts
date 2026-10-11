import * as THREE from 'three';
import { makeNoise } from '../../materials/noise';

/* ------------------------------------------------------------------ */
/*  Site plan for the Wadi Hives apiary (metres, +Z faces the visitor) */
/*  and the analytic terrain every prop is planted on.                 */
/*                                                                    */
/*            hills / layered outcrops  (−Z)                           */
/*     hive row ─────────────         extraction shed     ║ gorge     */
/*   pavilion     flora + water dish        tasting kiosk ║ wadi      */
/*  ═══════════════ dry wadi bed (front) ═══════════════╝            */
/* ------------------------------------------------------------------ */

export function rng(seed: number) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const nz = makeNoise(31);
const nzB = makeNoise(57);
const P = 4096;
export const noise2 = (x: number, z: number) => nz(x, z, P, P);
const noiseB = (x: number, z: number) => nzB(x, z, P, P);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ------------------------------- Site layout ------------------------------- */

/** Flat working terrace that holds every facility. */
export const SITE = { x0: -22, x1: 15, z0: -14, z1: 9 };

export const PAVILION = { x: -14.8, z: 3.0, r: 2.75 };
export const SHED = { x: 7.4, z: -8.8, w: 6.6, d: 4.4 };
export const KIOSK = { x: 8.5, z: 3.0, w: 3.6, d: 2.3, rot: -0.3 };
export const WATER_DISH = { x: -3.8, z: 4.0 };

/** Observation pavilion: hexagon with a side facing +X (door). The glass hive's tube exits the back-left side. */
export const PAV_DECK = 0.24;
const apothem = PAVILION.r * Math.cos(Math.PI / 6);
/** Tube exit of the glass observation hive (y is height above the pavilion's ground datum). */
export const OBS_EXIT = {
  x: PAVILION.x + Math.cos((300 * Math.PI) / 180) * (apothem + 0.14),
  y: PAV_DECK + 0.62,
  z: PAVILION.z + Math.sin((300 * Math.PI) / 180) * (apothem + 0.14),
};

let pavGround: number | null = null;
/** Ground datum of the pavilion: lowest terrain under its plinth so nothing floats. */
export function pavilionGround() {
  if (pavGround !== null) return pavGround;
  let lo = Infinity;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    lo = Math.min(lo, groundY(PAVILION.x + Math.cos(a) * 3, PAVILION.z + Math.sin(a) * 3));
  }
  pavGround = lo;
  return lo;
}

/** Langstroth 10-frame dimensions (outer, metres). */
export const HIVE = { W: 0.413, L: 0.508, deep: 0.244, medium: 0.168, standH: 0.42 };

export interface HiveSpec {
  x: number;
  z: number;
  rot: number;
  boxes: ('deep' | 'medium')[];
  paint: number[];
  rock: boolean;
  demo: boolean;
}

export const DEMO_INDEX = 6;

/** Gently curved row of ten hives, entrances turned toward the morning sun / visitors. */
export const HIVES: HiveSpec[] = (() => {
  const out: HiveSpec[] = [];
  const cx = -6.2;
  const cz = 9.5;
  const R = 16.5;
  const n = 10;
  const r = rng(12);
  const stacks: ('deep' | 'medium')[][] = [
    ['deep', 'medium', 'medium'],
    ['deep', 'medium'],
    ['deep', 'deep', 'medium'],
    ['deep', 'medium'],
    ['deep', 'medium', 'medium'],
    ['deep', 'deep'],
    ['deep', 'medium'],
    ['deep', 'medium', 'medium'],
    ['deep', 'deep', 'medium'],
    ['deep', 'medium'],
  ];
  for (let i = 0; i < n; i++) {
    const a = -0.38 + (i / (n - 1)) * 0.76 + (r() - 0.5) * 0.012;
    const x = cx + Math.sin(a) * R;
    const z = cz - Math.cos(a) * R;
    const rot = Math.atan2(cx - x, cz - z) + (r() - 0.5) * 0.06;
    const boxes = stacks[i];
    const paint = boxes.map((_, k) => Math.floor(r() * 6 + k * 2 + i) % 6);
    out.push({ x, z, rot, boxes, paint, rock: i % 3 === 1, demo: i === DEMO_INDEX });
  }
  return out;
})();

/* --------------------------------- Paths --------------------------------- */

export const PATHS: [number, number][][] = [
  // arrival from the wadi crossing up to the hive viewing area
  [
    [3.6, 17.5],
    [3.3, 12.6],
    [2.6, 8.4],
    [1.6, 5.0],
    [0.4, 1.8],
    [-1.6, -1.0],
    [-3.6, -2.4],
  ],
  // to the tasting kiosk
  [
    [1.6, 5.0],
    [4.0, 5.2],
    [6.4, 5.3],
  ],
  // to the extraction shed
  [
    [0.4, 1.8],
    [2.6, -1.6],
    [4.8, -4.6],
    [6.2, -6.2],
  ],
  // to the observation pavilion
  [
    [0.4, 1.8],
    [-2.4, 1.1],
    [-6.8, 1.2],
    [-9.8, 2.3],
    [-11.7, 3.0],
  ],
];

interface Polyline {
  x: Float32Array;
  z: Float32Array;
  s: Float32Array;
  minX: Float32Array;
  maxX: Float32Array;
  minZ: Float32Array;
  maxZ: Float32Array;
  length: number;
}

function samplePolyline(pts: [number, number][], samples: number, pad: number): Polyline {
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    'centripetal',
  );
  const n = samples;
  const x = new Float32Array(n + 1);
  const z = new Float32Array(n + 1);
  const s = new Float32Array(n + 1);
  const p = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    curve.getPointAt(i / n, p);
    x[i] = p.x;
    z[i] = p.z;
    s[i] = i === 0 ? 0 : s[i - 1] + Math.hypot(x[i] - x[i - 1], z[i] - z[i - 1]);
  }
  const minX = new Float32Array(n);
  const maxX = new Float32Array(n);
  const minZ = new Float32Array(n);
  const maxZ = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    minX[i] = Math.min(x[i], x[i + 1]) - pad;
    maxX[i] = Math.max(x[i], x[i + 1]) + pad;
    minZ[i] = Math.min(z[i], z[i + 1]) - pad;
    maxZ[i] = Math.max(z[i], z[i + 1]) + pad;
  }
  return { x, z, s, minX, maxX, minZ, maxZ, length: s[n] };
}

const hit = { d: 0, s: 0, cx: 0, cz: 0 };
/** Distance from (px, pz) to a sampled polyline; `cutoff` skips far segments. */
function queryPolyline(pl: Polyline, px: number, pz: number, cutoff = Infinity) {
  let best = cutoff * cutoff;
  let bs = -1;
  let bx = 0;
  let bz = 0;
  const n = pl.x.length - 1;
  for (let i = 0; i < n; i++) {
    if (px < pl.minX[i] - cutoff || px > pl.maxX[i] + cutoff || pz < pl.minZ[i] - cutoff || pz > pl.maxZ[i] + cutoff) continue;
    const ax = pl.x[i];
    const az = pl.z[i];
    const dx = pl.x[i + 1] - ax;
    const dz = pl.z[i + 1] - az;
    const l2 = dx * dx + dz * dz || 1e-6;
    let t = ((px - ax) * dx + (pz - az) * dz) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + dx * t;
    const qz = az + dz * t;
    const d2 = (px - qx) * (px - qx) + (pz - qz) * (pz - qz);
    if (d2 < best) {
      best = d2;
      bs = pl.s[i] + Math.sqrt(l2) * t;
      bx = qx;
      bz = qz;
    }
  }
  hit.d = bs < 0 ? cutoff : Math.sqrt(best);
  hit.s = bs;
  hit.cx = bx;
  hit.cz = bz;
  return hit;
}

const PATH_LINES = PATHS.map((p) => samplePolyline(p, 48, 0));

/** 0..1 — compacted gravel footpath coverage. */
export function pathMask(x: number, z: number) {
  let m = 0;
  for (const pl of PATH_LINES) {
    const q = queryPolyline(pl, x, z, 2.5);
    const w = 0.78 + noise2(x * 0.7, z * 0.7) * 0.12;
    m = Math.max(m, 1 - smoothstep(w - 0.28, w + 0.18, q.d));
  }
  return m;
}

export function distanceToPaths(x: number, z: number) {
  let d = Infinity;
  for (const pl of PATH_LINES) d = Math.min(d, queryPolyline(pl, x, z, 6).d);
  return d;
}

/* ---------------------------------- Wadi ---------------------------------- */

/** Dry wadi: emerges from a gorge in the hills (back right) and sweeps across the front. */
export const WADI_CTRL: [number, number][] = [
  [37, -150],
  [31, -100],
  [27.5, -66],
  [23.5, -44],
  [21.5, -28],
  [22.0, -14],
  [22.5, -2],
  [19.0, 8.0],
  [10.0, 13.8],
  [-2.0, 15.8],
  [-15.0, 15.3],
  [-28.0, 16.8],
  [-43.0, 20.5],
  [-68.0, 26.0],
  [-120.0, 35.0],
];
const WADI = samplePolyline(WADI_CTRL, 220, 0);

export interface WadiHit {
  d: number;
  s: number;
  cx: number;
  cz: number;
  halfW: number;
  bank: number;
  bed: number;
}

const wadiOut: WadiHit = { d: 0, s: 0, cx: 0, cz: 0, halfW: 0, bank: 0, bed: 0 };
export function wadiAt(x: number, z: number): WadiHit {
  const q = queryPolyline(WADI, x, z, 40);
  wadiOut.d = q.d;
  wadiOut.s = q.s;
  wadiOut.cx = q.cx;
  wadiOut.cz = q.cz;
  const gorge = smoothstep(-6, -24, q.cz);
  const vary = noiseB(q.s * 0.045, 1.7) * 1.1;
  wadiOut.halfW = lerp(4.9, 3.3, gorge) + vary;
  wadiOut.bank = lerp(2.4, 6.5, gorge);
  wadiOut.bed = -0.92 + Math.max(0, -q.cz - 8) * 0.07 + noiseB(x * 0.16, z * 0.16) * 0.09;
  return wadiOut;
}

/* --------------------------------- Terrain --------------------------------- */

function terrace(h: number, step: number) {
  const k = h / step;
  const f = Math.floor(k);
  const r = k - f;
  return (f + smoothstep(0.52, 0.94, r)) * step;
}

function siteDistance(x: number, z: number) {
  const dx = Math.max(SITE.x0 - x, 0, x - SITE.x1);
  const dz = Math.max(SITE.z0 - z, 0, z - SITE.z1);
  return Math.hypot(dx, dz);
}

/** Layered foothills behind the site and low ranges to either side. */
function hills(x: number, z: number, wadiD: number) {
  // Back range: toe line wanders, strata dip gently to the west
  const toe = -21.5 + noise2(x * 0.045, 3.1) * 3.0 + noise2(x * 0.14, 9.3) * 0.9;
  const d = toe - z;
  let h = 0;
  if (d > -4) {
    const dd = Math.max(0, d + noise2(x * 0.08, z * 0.08) * 1.5);
    const ridge = 0.7 + 0.55 * (1 - Math.abs(noise2(x * 0.016 + 50, z * 0.02 + 20)));
    const raw = (12 * (1 - Math.exp(-dd / 15)) + dd * 0.26) * ridge + noise2(x * 0.11, z * 0.11) * 0.5;
    const dip = x * 0.022 + z * 0.01 + noise2(x * 0.05 + 3, z * 0.05) * 0.9;
    const stepH = 2.1 + noise2(x * 0.02, 7.7) * 0.5;
    const t = terrace(raw + dip, stepH) - dip;
    const crisp = 0.72 + 0.2 * (noise2(x * 0.035, z * 0.035 + 9) * 0.5 + 0.5);
    h = Math.max(0, lerp(raw, t, crisp)) * smoothstep(-4, 1.5, d);
  }
  // Left range
  const dl = -31 - x + noise2(z * 0.05, 1.3) * 4;
  if (dl > -4) {
    const dd = Math.max(0, dl);
    const raw = 9.5 * (1 - Math.exp(-dd / 13)) + dd * 0.08 + noise2(x * 0.09, z * 0.09) * 0.6;
    const t = terrace(raw + z * 0.015, 1.6) - z * 0.015;
    h = Math.max(h, lerp(raw, t, 0.7) * smoothstep(-4, 2, dl));
  }
  // Right range beyond the gorge
  const dr = x - 39 + noise2(z * 0.05, 5.1) * 4;
  if (dr > -4) {
    const dd = Math.max(0, dr);
    const raw = 12 * (1 - Math.exp(-dd / 12)) + dd * 0.12 + noise2(x * 0.09, z * 0.09) * 0.6;
    const t = terrace(raw - z * 0.012, 1.8) + z * 0.012;
    h = Math.max(h, lerp(raw, t, 0.72) * smoothstep(-4, 2, dr));
  }
  // The wadi cuts a gorge through every range
  return h * smoothstep(3.5, 15, wadiD);
}

/** Terrain height (metres) anywhere in the venue. */
export function groundY(x: number, z: number) {
  const w = wadiAt(x, z);
  const und = noise2(x * 0.03 + 11, z * 0.03 + 7) * 0.55 + noise2(x * 0.1, z * 0.1) * 0.16 + 0.15;
  const site = 1 - smoothstep(0, 9, siteDistance(x, z));
  const terraceBase = -z * 0.01 + noise2(x * 0.13 + 3, z * 0.13) * 0.035 + noise2(x * 0.5, z * 0.5) * 0.008;
  let h = lerp(und, terraceBase, site);
  h += hills(x, z, w.d);
  // far rolling plain rises into distant ridges
  const far = Math.hypot(x - 0, z + 10);
  h += smoothstep(110, 260, far) * (8 + noise2(x * 0.012, z * 0.012) * 6);
  const carve = 1 - smoothstep(w.halfW, w.halfW + w.bank, w.d);
  if (carve > 0) {
    const bed = w.bed + (1 - smoothstep(0, w.halfW, w.d)) * -0.05;
    h = lerp(h, Math.min(h, bed), carve);
  }
  return h;
}

/** 0..1 — how much of the wadi bed (gravel + cobbles) covers this point. */
export function wadiMask(x: number, z: number) {
  const w = wadiAt(x, z);
  return 1 - smoothstep(w.halfW + 0.2, w.halfW + w.bank * 0.75, w.d + noise2(x * 0.35, z * 0.35) * 0.7);
}

/* -------------------------------- Meadows -------------------------------- */

export interface Meadow {
  x: number;
  z: number;
  rx: number;
  rz: number;
  rot: number;
  density: number;
}

/** Wildflower margins: dense around the hives, the water dish and along the wadi bank. */
export const MEADOWS: Meadow[] = [
  { x: -6.2, z: -8.7, rx: 7.6, rz: 1.8, rot: 0, density: 1 },
  { x: -6.0, z: -5.3, rx: 6.6, rz: 1.0, rot: 0, density: 0.9 },
  { x: -3.8, z: 4.1, rx: 4.4, rz: 3.0, rot: 0.12, density: 1 },
  { x: -6.5, z: 10.4, rx: 12.5, rz: 1.6, rot: 0.03, density: 0.9 },
  { x: 7.0, z: 9.6, rx: 5.2, rz: 1.3, rot: -0.15, density: 0.8 },
  { x: -14.8, z: 3.0, rx: 5.0, rz: 4.6, rot: 0, density: 0.6 },
  { x: 12.6, z: 6.4, rx: 2.6, rz: 2.0, rot: -0.4, density: 0.75 },
  { x: 1.4, z: -10.0, rx: 2.0, rz: 2.4, rot: 0, density: 0.65 },
  { x: -14.2, z: -5.6, rx: 2.4, rz: 2.8, rot: 0.3, density: 0.85 },
  { x: 1.6, z: -5.6, rx: 1.6, rz: 2.2, rot: 0.4, density: 0.8 },
  { x: -11.2, z: -1.4, rx: 2.6, rz: 1.7, rot: -0.3, density: 0.8 },
  { x: -7.6, z: 5.6, rx: 2.4, rz: 1.8, rot: 0.5, density: 0.85 },
  { x: 5.2, z: -1.0, rx: 1.5, rz: 1.3, rot: 0.6, density: 0.75 },
  { x: -1.0, z: 7.6, rx: 1.8, rz: 1.2, rot: -0.2, density: 0.8 },
];

export function meadowMask(x: number, z: number) {
  let m = 0;
  for (const md of MEADOWS) {
    const c = Math.cos(md.rot);
    const s = Math.sin(md.rot);
    const lx = (x - md.x) * c + (z - md.z) * s;
    const lz = -(x - md.x) * s + (z - md.z) * c;
    const e = Math.hypot(lx / md.rx, lz / md.rz) + noise2(x * 0.45, z * 0.45) * 0.24 + noise2(x * 0.16 + 7, z * 0.16) * 0.22;
    m = Math.max(m, (1 - smoothstep(0.7, 1.12, e)) * md.density);
  }
  return m;
}

/* ------------------------------ Footprints ------------------------------ */

/** True where nothing should grow (buildings, paths, hive stands). */
export function isBlocked(x: number, z: number, margin = 0) {
  if (Math.hypot(x - PAVILION.x, z - PAVILION.z) < PAVILION.r + 0.7 + margin) return true;
  if (Math.abs(x - SHED.x) < SHED.w / 2 + 0.7 + margin && Math.abs(z - SHED.z) < SHED.d / 2 + 0.9 + margin) return true;
  {
    const c = Math.cos(-KIOSK.rot);
    const s = Math.sin(-KIOSK.rot);
    const lx = (x - KIOSK.x) * c - (z - KIOSK.z) * s;
    const lz = (x - KIOSK.x) * s + (z - KIOSK.z) * c;
    if (Math.abs(lx) < KIOSK.w / 2 + 1.0 + margin && lz > -KIOSK.d / 2 - 0.6 - margin && lz < KIOSK.d / 2 + 2.6 + margin) return true;
  }
  if (Math.hypot(x - WATER_DISH.x, z - WATER_DISH.z) < 0.85 + margin) return true;
  for (const h of HIVES) {
    if (Math.hypot(x - h.x, z - h.z) < 0.62 + margin) return true;
  }
  return false;
}

/** World position of a hive entrance (centre of the reducer gap). */
export function hiveEntrance(h: HiveSpec, out = new THREE.Vector3()) {
  const fx = Math.sin(h.rot);
  const fz = Math.cos(h.rot);
  const y = groundY(h.x, h.z) + HIVE.standH + 0.05;
  return out.set(h.x + fx * (HIVE.L / 2 + 0.02), y, h.z + fz * (HIVE.L / 2 + 0.02));
}

export function hiveTop(h: HiveSpec) {
  let y = groundY(h.x, h.z) + HIVE.standH + 0.03;
  for (const b of h.boxes) y += b === 'deep' ? HIVE.deep : HIVE.medium;
  return y + 0.085;
}
