/* ------------------------------------------------------------------ */
/*  Room layout in design space (metres). The room is built with its   */
/*  open (cut-away) side facing +Z; the whole venue is then rotated so */
/*  that side faces world +X (keeps camera azimuth limits wrap-free).  */
/* ------------------------------------------------------------------ */

export const ROOM = {
  x0: -3.9,
  x1: 3.9,
  z0: -2.9,
  z1: 2.9,
  /** Underside of the ceiling matting */
  h: 3.5,
  /** Wall top (cut section) */
  top: 3.8,
  t: 0.35,
  wainscot: 1.0,
};

/** Mashrabiya window in the left wall (world z range, sill, top). */
export const WINDOW = { z: -0.55, w: 1.4, y: 1.02, h: 1.86 };
/** Carved door in the right wall. */
export const DOOR = { z: 1.25, w: 1.5, h: 2.55 };
/** Arched display niches. `wall`: which wall; `c`: centre along the wall. */
export const NICHES = {
  grand: { c: 0, w: 1.8, y: 1.22, h: 1.78, shelves: [1.52, 1.92, 2.34] },
  left: { c: -2.5, w: 1.1, y: 1.3, h: 1.56, shelves: [1.62, 2.06] },
  right: { c: -1.5, w: 1.25, y: 1.22, h: 1.62, shelves: [1.55, 2.0] },
};
export const NICHE_DEPTH = 0.31;

/** Ceiling structure */
export const GIRDER_Z = 0.25;
export const POLE_R = 0.065;
export const POLE_XS = Array.from({ length: 19 }, (_, i) => -3.6 + i * 0.4);

/* Stations (design space) */
export const ORGAN = { x: 0, z: -1.38, a0: -0.32, a1: Math.PI + 0.32 };
export const MIXING = { x: 0, z: 0.32, w: 1.9, d: 0.72, h: 0.9 };
export const DRAWERS = { x0: 1.32, x1: 3.86, depth: 0.44, h: 2.78 };
export const OUD = { x: 2.55, z: -0.35, w: 1.35, d: 0.72, h: 0.84 };
export const PACKAGING = { x: 2.35, z: 1.85, w: 1.5, d: 0.75, h: 0.88 };
export const BUKHOOR = { x: -2.2, z: 1.42, w: 1.35, d: 0.66, h: 0.42 };
export const MAJLIS = { z0: -2.35, z1: 1.05, depth: 0.78 };
export const RUG = { x: -2.42, z: -0.42, w: 1.9, d: 3.36 };
export const CENTRE_RUG = { x: 0, z: 0.42, w: 2.7, d: 2.0 };
export const BURNERS = { x: -2.55, z: 0.02 };
