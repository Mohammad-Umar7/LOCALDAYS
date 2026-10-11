import * as THREE from 'three';
import { makeNoise } from '../../materials/noise';

/* ------------------------------------------------------------------ */
/*  Hamriyah harbour — world layout (metres, y up, sea level y = 0).   */
/*  Land lies to +z, the harbour basin and the open Gulf to -z.       */
/*  Every placement and the terrain/water fields derive from here so  */
/*  the GPU water shading and the CPU boat motion always agree.       */
/* ------------------------------------------------------------------ */

const nz = makeNoise(77);
const P = 4096;

/** Jetty: a timber walkway with a T-head briefing platform. */
export const JETTY = {
  x: 0,
  /** landward end of the walkway */
  z0: 5.2,
  /** seaward end of the walkway (start of the T-head) */
  z1: -30,
  halfW: 1.6,
  deck: 1.3,
  head: { x0: -6.2, x1: 6.2, z0: -36.2, z1: -30 },
  pileStep: 3.5,
};

export const PILE_R = 0.17;

/** Jetty piles as [x, z, radius] — shared by the dock geometry and the water foam. */
export function jettyPiles(): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let k = 0; k < 9; k++) {
    const z = 1.5 - k * JETTY.pileStep;
    out.push([JETTY.x - JETTY.halfW + 0.15, z, PILE_R], [JETTY.x + JETTY.halfW - 0.15, z, PILE_R]);
  }
  for (const z of [-30.2, -33.1, -36.0]) for (const x of [-6.0, -3.0, 0, 3.0, 6.0]) out.push([JETTY.x + x, z, PILE_R]);
  return out;
}

/** Moorings (boat-local +z is the bow). */
export const DHOW_POSE = { x: -4.2, z: -18.6, yaw: Math.PI };
export const BOAT_POSES = [
  { x: 3.05, z: -12.2, yaw: Math.PI + 0.012, hull: 'teal' as const },
  { x: 5.75, z: -14.6, yaw: Math.PI - 0.03, hull: 'red' as const },
  { x: 13.5, z: -25.5, yaw: Math.PI - 0.55, hull: 'blue' as const },
];

/** Breakwater centreline: rooted on land to the west, curving east around the basin. */
export const BREAKWATER_PTS: [number, number][] = [
  [-50, 9],
  [-50.5, -6],
  [-46.5, -24],
  [-37, -40],
  [-22, -51.5],
  [-3, -57.5],
  [16, -58.5],
  [27, -56],
];

/* ------------------------------- Shoreline ------------------------------- */

/** z of the waterline at x (water where z < shoreZ). */
export function shoreZ(x: number) {
  const headland = Math.max(0, -x - 46);
  const east = Math.max(0, x - 60);
  return 1.4 + 1.7 * Math.sin(x * 0.047 + 0.35) - headland * headland * 0.0017 + east * east * 0.0009 + nz(x * 0.06, 3.7, P, P) * 0.5;
}

function shoreSlope(x: number) {
  return (shoreZ(x + 0.5) - shoreZ(x - 0.5)) / 1;
}

/** Approximate signed distance to the shoreline: + inland, − seaward. */
export function shoreDist(x: number, z: number) {
  const s = shoreSlope(x);
  return (z - shoreZ(x)) / Math.sqrt(1 + s * s);
}

/* ------------------------------- Breakwater ------------------------------ */

const bwCurve = new THREE.CatmullRomCurve3(
  BREAKWATER_PTS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  false,
  'centripetal',
);
export const BW_SAMPLES = bwCurve.getSpacedPoints(160).map((p) => [p.x, p.z] as [number, number]);
export const BW_LENGTH = bwCurve.getLength();
export function breakwaterCurve() {
  return bwCurve;
}

/** Distance to the breakwater centreline and the curve parameter of the closest point. */
export function breakwaterDist(x: number, z: number) {
  let best = 1e9;
  let bt = 0;
  for (let i = 0; i < BW_SAMPLES.length - 1; i++) {
    const [ax, az] = BW_SAMPLES[i];
    const [bx, bz] = BW_SAMPLES[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const l2 = dx * dx + dz * dz;
    let t = ((x - ax) * dx + (z - az) * dz) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = ax + dx * t - x;
    const pz = az + dz * t - z;
    const d = px * px + pz * pz;
    if (d < best) {
      best = d;
      bt = (i + t) / (BW_SAMPLES.length - 1);
    }
  }
  return { d: Math.sqrt(best), t: bt };
}

/** Rock mound crest height along the breakwater (rocks are piled on top of it). */
export const BW_CREST = 0.32;
export const BW_HALF = 1.7;
export const BW_SLOPE = 1.5;

/** Mound surface height at lateral offset `off` from the centreline. */
export function moundAt(off: number) {
  return BW_CREST - Math.max(0, Math.abs(off) - BW_HALF) / BW_SLOPE;
}

function breakwaterMound(x: number, z: number) {
  if (x < -66 || x > 40 || z < -72 || z > 16) return -99;
  const { d, t } = breakwaterDist(x, z);
  // fade the mound into the land at the root
  const crest = BW_CREST + (t < 0.08 ? (0.08 - t) * 6 : 0);
  return crest - Math.max(0, d - BW_HALF) / BW_SLOPE;
}

/* -------------------------------- Ground --------------------------------- */

const DEPTH = 4.8;
const DEPTH_L = 18;
const LAND_TOP = 1.15;

/** Sea floor / beach / yard height. */
export function groundHeight(x: number, z: number) {
  const d = shoreDist(x, z);
  let h: number;
  if (d < 0) {
    const s = -d;
    h = -DEPTH * (1 - Math.exp(-s / DEPTH_L)) - Math.max(0, s - 70) * 0.03;
    // sandy ripples & seagrass hummocks on the floor
    h += nz(x * 0.08, z * 0.08, P, P) * 0.35 * THREE.MathUtils.smoothstep(s, 3, 18);
  } else {
    h = LAND_TOP * (1 - Math.exp(-(d * DEPTH) / DEPTH_L / LAND_TOP));
    // gentle undulation inland, dunes farther back
    h += nz(x * 0.045 + 9, z * 0.045 + 3, P, P) * 0.18 * THREE.MathUtils.smoothstep(d, 6, 20);
    const dune = 1 - Math.abs(nz(x * 0.012 + 40, z * 0.016 + 20, P, P));
    h += THREE.MathUtils.smoothstep(d, 38, 110) * (dune * dune * 7 + 1.5);
  }
  return Math.max(h, breakwaterMound(x, z));
}

/* ------------------------------ Wave shelter ----------------------------- */

const MOUTH_A: [number, number] = [27, -56];
const MOUTH_B: [number, number] = [40, shoreZ(40)];

function segDist(px: number, pz: number, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  let t = ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(a[0] + dx * t - px, a[1] + dz * t - pz);
}

const BASIN: [number, number][] = (() => {
  const pts: [number, number][] = [];
  for (let x = 40; x >= -50; x -= 2) pts.push([x, shoreZ(x) + 2]);
  for (let i = 0; i < BW_SAMPLES.length; i++) pts.push(BW_SAMPLES[i]);
  return pts;
})();

function inPoly(x: number, z: number, poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** 1 = open sea, ~0.2 deep inside the basin (swell blocked by the breakwater). */
export function shelterAt(x: number, z: number) {
  if (x < -70 || x > 45 || z < -70 || z > 20) return 1;
  if (!inPoly(x, z, BASIN)) {
    // lee side right behind the rocks still gets some shelter
    const { d } = breakwaterDist(x, z);
    return 1 - 0.25 * Math.exp(-d / 6);
  }
  const m = segDist(x, z, MOUTH_A, MOUTH_B);
  return 0.2 + 0.8 * Math.exp(-m / 16);
}

/* ------------------------------ Utilities -------------------------------- */

export function rng(seed: number) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Coordinates along one axis: fine spacing in the core, then geometric growth
 * out to `extent` — gives dense near-field detail with very few far vertices.
 */
export function gradedAxis(min: number, max: number, coreMin: number, coreMax: number, step: number, growth: number) {
  const out: number[] = [];
  for (let v = coreMin; v <= coreMax + 1e-6; v += step) out.push(v);
  let s = step;
  let v = coreMax;
  while (v < max) {
    s *= growth;
    v = Math.min(max, v + s);
    out.push(v);
  }
  s = step;
  v = coreMin;
  const lo: number[] = [];
  while (v > min) {
    s *= growth;
    v = Math.max(min, v - s);
    lo.push(v);
  }
  return [...lo.reverse(), ...out];
}

/** Indexed grid on the XZ plane from two coordinate axes (y = 0). */
export function gridGeometry(xs: number[], zs: number[]) {
  const nx = xs.length;
  const nzs = zs.length;
  const pos = new Float32Array(nx * nzs * 3);
  let k = 0;
  for (let j = 0; j < nzs; j++)
    for (let i = 0; i < nx; i++) {
      pos[k++] = xs[i];
      pos[k++] = 0;
      pos[k++] = zs[j];
    }
  const idx: number[] = [];
  for (let j = 0; j < nzs - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      // alternate the diagonal for a more isotropic mesh
      if ((i + j) % 2 === 0) idx.push(a, c, b, b, c, d);
      else idx.push(a, c, d, a, d, b);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
