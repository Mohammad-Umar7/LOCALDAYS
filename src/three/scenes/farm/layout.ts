import type { PalmSpec } from '../../props/DatePalms';

/* ------------------------------------------------------------------ */
/*  Site plan shared by every farm component (world metres, y up).    */
/*  Plot inside the mud wall: x −32…38, z −38…24 (south wall = z 24).  */
/* ------------------------------------------------------------------ */

export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export const inRect = (r: Rect, x: number, z: number, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;

/** Seeded PRNG (mulberry32) — every scatter is deterministic. */
export function rng(seed: number) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Grove: 4 rows × 5 columns of mature palms, plus specimen palms around the buildings. */
export const GROVE_COLS = [8, 14, 20, 26, 32];
export const GROVE_ROWS = [-33, -26.5, -20, -13.5];

export const GROVE_PALMS: PalmSpec[] = (() => {
  const out: PalmSpec[] = [];
  let i = 0;
  for (const z of GROVE_ROWS)
    for (const x of GROVE_COLS) {
      out.push({
        position: [x + Math.sin(i * 2.1) * 0.8, 0, z + Math.cos(i * 1.7) * 0.8],
        height: 6 + ((i * 37) % 10) / 4,
        lean: 0.04 + ((i * 13) % 5) / 60,
        leanDir: i * 1.9,
        seed: i + 1,
        fruit: i % 3 === 0,
      });
      i++;
    }
  return out;
})();

export const SPECIMEN_PALMS: PalmSpec[] = (
  [
    [-17.5, -13, 7.6, true],
    [-1.5, -13.2, 8.2, false],
    [-20.5, -4.5, 6.8, true],
    [-1.4, -3.6, 6.2, false],
    [-8.8, 17.4, 7.4, true],
    [5.6, 18.6, 6.6, false],
    [-27, -22, 8.4, false],
    [-17.6, -31.8, 7.2, true],
    [-1.2, -25, 7.8, false],
    [5.0, -35.6, 6.9, false],
    [35, 4, 7, true],
    [33.6, 21.2, 6.4, false],
  ] as [number, number, number, boolean][]
).map(([x, z, h, f], k) => ({ position: [x, 0, z], height: h, lean: 0.07, leanDir: k * 2.3, seed: 100 + k, fruit: f }));

export const ALL_PALMS: PalmSpec[] = [...GROVE_PALMS, ...SPECIMEN_PALMS];

/* ------------------------------- Zones ------------------------------- */

/** Family quarter, west of the farmhouse: shaded majlis, swing ghaf, animal pen. */
export const MAJLIS = { x: -18.7, z: 1.25, w: 5.0, d: 4.2, rot: 0 };
export const SWING_GHAF = { x: -25.0, z: 3.6 };
/** Goat & chicken pen. With the glamping tents shown it moves behind the house. */
export const PEN_FRONT: Rect = { x0: -23.4, x1: -13.4, z0: 10.6, z1: 18.8 };
export const PEN_BACK: Rect = { x0: -31, x1: -21, z0: -20.3, z1: -12.1 };

/** Harvest station between the kitchen beds and the south wall. */
export const HARVEST = { x: 14.2, z: 17.4 };
/** Flood-irrigated fodder basins (alfalfa) in front of the greenhouse. */
export const FIELD: Rect = { x0: 21.0, x1: 32.4, z0: 16.5, z1: 22.7 };
/** Citrus trees along the east wall. */
export const ORCHARD: Rect = { x0: 32.2, x1: 37.2, z0: -11, z1: 13 };
/** Compost bays + seedling nursery between the beds and the greenhouse. */
export const YARD: Rect = { x0: 17.8, x1: 22.6, z0: 0, z1: 10.6 };
/** Date-drying mats in front of the dining pergola. */
export const DRYING = { x: -1.2, z: 19.6 };

/** Grove irrigation: a channel branching off the falaj, with spurs between the palm columns. */
export const CHANNEL_Z = -10.6;
/** Spurs run 2.6 m west of each column so they clear every basin; short feeders reach the palms. */
export const SPUR_OFFSET = -2.6;

/** Flagstone paths (centrelines). */
export const STONE_PATHS: [number, number][][] = [
  [
    [-9, 7.2],
    [-7.4, 9.6],
    [-4.5, 10.4],
    [2.8, 10.6],
    [5.9, 12.4],
    [9.5, 13.6],
    [14, 12.6],
    [20.5, 14.6],
    [27, 14.4],
  ],
  [
    [5.9, 12.4],
    [6.2, 18.5],
    [6, 25],
  ],
  [
    [2.8, 10.6],
    [3.6, 4],
    [4.6, -2.2],
  ],
];

/** Flood-irrigated basin fields. Row 0 is the row next to the supply channel. */
export type BasinKind = 'alfalfa' | 'young' | 'cut' | 'okra' | 'rhodes' | 'baled';
export interface FieldSpec {
  rect: Rect;
  cols: number;
  rows: number;
  plan: { kind: BasinKind; flooded: boolean }[][];
  /** Which edge the supply channel runs along. */
  supply: 'north' | 'south';
  /** Channel flow direction along x (the standpipe sits upstream). */
  flow: 1 | -1;
  seed: number;
}

export const FODDER: FieldSpec = {
  rect: FIELD,
  cols: 4,
  rows: 2,
  supply: 'north',
  flow: 1,
  seed: 23,
  plan: [
    [
      { kind: 'alfalfa', flooded: false },
      { kind: 'young', flooded: true },
      { kind: 'okra', flooded: false },
      { kind: 'alfalfa', flooded: false },
    ],
    [
      { kind: 'alfalfa', flooded: false },
      { kind: 'cut', flooded: false },
      { kind: 'alfalfa', flooded: true },
      { kind: 'okra', flooded: false },
    ],
  ],
};

/** Rhodes-grass paddock in the back-left corner; one basin cut and baled. */
export const PADDOCK: FieldSpec = {
  rect: { x0: -30.6, x1: -19.6, z0: -37.0, z1: -25.0 },
  cols: 3,
  rows: 3,
  supply: 'south',
  flow: -1,
  seed: 57,
  plan: [
    [
      { kind: 'rhodes', flooded: false },
      { kind: 'young', flooded: true },
      { kind: 'rhodes', flooded: false },
    ],
    [
      { kind: 'baled', flooded: false },
      { kind: 'rhodes', flooded: false },
      { kind: 'rhodes', flooded: false },
    ],
    [
      { kind: 'rhodes', flooded: false },
      { kind: 'rhodes', flooded: false },
      { kind: 'young', flooded: false },
    ],
  ],
};

export function basinRect(f: FieldSpec, col: number, row: number): Rect {
  const w = (f.rect.x1 - f.rect.x0) / f.cols;
  const d = (f.rect.z1 - f.rect.z0) / f.rows;
  const x0 = f.rect.x0 + col * w;
  return f.supply === 'north'
    ? { x0, x1: x0 + w, z0: f.rect.z0 + row * d, z1: f.rect.z0 + (row + 1) * d }
    : { x0, x1: x0 + w, z0: f.rect.z1 - (row + 1) * d, z1: f.rect.z1 - row * d };
}

export const ORCHARD_TREES: [number, number][] = [
  [34.6, -8.6],
  [34.9, -2.4],
  [34.4, 9.6],
];

/** Potted date-palm offshoots on the nursery bench area. */
export const OFFSHOOTS: PalmSpec[] = (
  [
    [18.5, 7.6],
    [19.3, 8.3],
    [18.6, 9.2],
    [19.6, 9.5],
  ] as [number, number][]
).map(([x, z], i) => ({ position: [x, 0.42, z], height: 0.55 + (i % 2) * 0.15, lean: 0.12, leanDir: i * 1.7, seed: 300 + i, fruit: false, scale: 0.24 }));
