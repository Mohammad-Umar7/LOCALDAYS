/* Shared layout of the Fakhar House courtyard studio (metres, +Z towards the camera). */

/** Finished floor level (top of the tiles) */
export const FY = 0.16;

/** Courtyard interior bounds (inner wall faces) */
export const COURT = { x0: -5.4, x1: 5.4, z0: -3.9, z1: 3.9 };

export const BACK = { h: 4.2, front: 0.3, backing: 0.25 };
export const LEFT = { h: 3.8, t: 0.5 };
export const RIGHT = { h: 3.5, t: 0.45 };

/** wallGeometry bevels shrink openings by this much (sills sit higher) */
export const BEVEL = 0.025;

/** Display niches in the back wall */
export const NICHES = { x: [-1.55, -0.25, 1.05], w: 1.1, sill: FY + 0.42, h: 2.35 };

/** Arched openings in the right (arcade) wall: centre Z */
export const ARCHES = { z: [-1.3, 0.6, 2.5], w: 1.4, sill: FY + 0.55, h: 2.25 };

/** Doorway in the left wall */
export const DOOR = { z: -0.95, w: 1.4, h: 2.5 };

/** Feature positions */
export const WHEELS = [
  { x: -1.85, z: 0.72, rot: 0.06, main: true },
  { x: -3.45, z: -0.12, rot: 0.42, main: false },
  { x: -0.3, z: -0.22, rot: -0.38, main: false },
];
export const PREP = { x: COURT.x0 + 0.52, z: 1.62 };
export const KILN = { x: 3.55, z: -3.05 };
export const GLAZE = { x0: COURT.x0 + 0.08, x1: COURT.x0 + 2.48 };
export const TABLE = { x: 0.62, z: 2.36, l: 3.0, w: 0.88 };
export const CART = { x: 2.5, z: -0.85 };
