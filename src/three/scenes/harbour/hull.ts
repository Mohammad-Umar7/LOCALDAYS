import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/*  Lofted hulls. A hull is swept between two curves:                  */
/*   C(u) — the centreline profile (transom foot → keel → raked stem)  */
/*   S(u) — the sheer line (transom corner → max beam → stem head)    */
/*  and every station u carries a superellipse / hard-chine section    */
/*  from C (v = 0) up to S (v = 1). Boat-local: +z bow, +y up,         */
/*  waterline at y = 0. Planking UVs follow the girth so the seams     */
/*  taper into the stem like real carvel planking.                     */
/* ------------------------------------------------------------------ */

export interface HullSpec {
  zStern: number;
  zBow: number;
  halfBeam: number;
  beamAt: number;
  transomFrac: number;
  sheerStern: number;
  sheerMid: number;
  sheerBow: number;
  sheerMidU: number;
  keelY: number;
  transomFootY: number;
  transomRake: number;
  /** u where the run reaches the keel */
  runU: number;
  /** u where the forefoot starts curving up into the stem */
  forefootU: number;
  /** stem tangent angle from vertical at the head (radians, + = raked forward) */
  stemRake: number;
  /** section fullness exponent along the hull */
  fullness: (u: number) => number;
  /** hard chine along the hull: fraction of half-breadth / height at the chine */
  chine?: (u: number) => { x: number; y: number; round: number };
  /** topside flare (extra half-breadth fraction at the sheer, fading downward) */
  flare?: number;
}

export interface Hull {
  spec: HullSpec;
  centre: (u: number) => THREE.Vector2; // (z, y)
  sheer: (u: number) => THREE.Vector3;
  point: (u: number, v: number, out?: THREE.Vector3) => THREE.Vector3;
  normal: (u: number, v: number) => THREE.Vector3;
  /** v on station u where the hull surface reaches height y (0 if the section starts above it) */
  vAtY: (u: number, y: number) => number;
}

const bez = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const it = 1 - t;
  return it * it * it * p0 + 3 * it * it * t * p1 + 3 * it * t * t * p2 + t * t * t * p3;
};

export function makeHull(spec: HullSpec): Hull {
  const zFoot = spec.zStern + spec.transomRake;
  const zF = THREE.MathUtils.lerp(zFoot, spec.zBow, spec.forefootU) - 0.2;
  const dz = spec.zBow - zF;
  const dy = spec.sheerBow - spec.keelY;
  const stem = {
    p0: [zF, spec.keelY],
    p1: [zF + dz * 0.5, spec.keelY],
    p2: [spec.zBow - Math.sin(spec.stemRake) * dy * 0.45, spec.sheerBow - Math.cos(spec.stemRake) * dy * 0.45],
    p3: [spec.zBow, spec.sheerBow],
  };

  const centre = (u: number) => {
    if (u <= spec.forefootU) {
      const t = u / spec.forefootU;
      const z = THREE.MathUtils.lerp(zFoot, zF, t);
      const r = Math.min(1, u / spec.runU);
      const y = spec.keelY + (spec.transomFootY - spec.keelY) * (1 - r) * (1 - r);
      return new THREE.Vector2(z, y);
    }
    const t = (u - spec.forefootU) / (1 - spec.forefootU);
    return new THREE.Vector2(bez(stem.p0[0], stem.p1[0], stem.p2[0], stem.p3[0], t), bez(stem.p0[1], stem.p1[1], stem.p2[1], stem.p3[1], t));
  };

  const sheer = (u: number) => {
    const z = THREE.MathUtils.lerp(spec.zStern, spec.zBow, u);
    const m = spec.sheerMidU;
    const y =
      u < m
        ? spec.sheerMid + (spec.sheerStern - spec.sheerMid) * ((m - u) / m) ** 2
        : spec.sheerMid + (spec.sheerBow - spec.sheerMid) * ((u - m) / (1 - m)) ** 2;
    let b: number;
    if (u <= spec.beamAt) b = spec.transomFrac + (1 - spec.transomFrac) * Math.sin((Math.PI / 2) * (u / spec.beamAt)) ** 0.75;
    else b = Math.cos((Math.PI / 2) * ((u - spec.beamAt) / (1 - spec.beamAt))) ** 0.8;
    return new THREE.Vector3(spec.halfBeam * b, y, z);
  };

  /** normalised section: returns [fx, fy] for v in [0,1] */
  const section = (u: number, v: number): [number, number] => {
    const m = spec.fullness(u);
    if (spec.chine) {
      const { x: cx, y: cy, round } = spec.chine(u);
      // bottom: slightly convex deadrise to the chine; topsides: straight to the sheer
      const vc = 0.5;
      let fx: number;
      let fy: number;
      if (v < vc) {
        const t = v / vc;
        fx = cx * t;
        fy = cy * t * (0.8 + 0.2 * t);
      } else {
        const t = (v - vc) / (1 - vc);
        fx = cx + (1 - cx) * (t + Math.sin(t * Math.PI) * 0.12 * (m - 1));
        fy = cy + (1 - cy) * t;
      }
      // soften the chine into a small radius
      const k = Math.exp(-((v - vc) ** 2) / (2 * round * round));
      fx -= k * round * 0.25;
      fy += k * round * 0.08;
      return [Math.max(0, fx), fy];
    }
    const th = (v * Math.PI) / 2;
    const fx = Math.sin(th) ** (2 / m);
    const fy = 1 - Math.cos(th) ** (2 / m);
    return [fx, fy];
  };

  const point = (u: number, v: number, out = new THREE.Vector3()) => {
    const c = centre(u);
    const s = sheer(u);
    const [fx, fy] = section(u, v);
    const flare = (spec.flare ?? 0) * fy * fy * fy;
    out.set(s.x * (fx + flare) / (1 + (spec.flare ?? 0)), c.y + (s.y - c.y) * fy, c.x + (s.z - c.x) * fy);
    return out;
  };

  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const tmpC = new THREE.Vector3();
  const tmpD = new THREE.Vector3();
  const normal = (u: number, v: number) => {
    const e = 1e-3;
    point(Math.min(1, u + e), v, tmpA);
    point(Math.max(0, u - e), v, tmpB);
    point(u, Math.min(1, v + e), tmpC);
    point(u, Math.max(0, v - e), tmpD);
    const du = tmpA.sub(tmpB);
    const dv = tmpC.sub(tmpD);
    // outward on the starboard (+x) side
    const n = new THREE.Vector3().crossVectors(dv, du).normalize();
    if (n.x < 0 && Math.abs(n.x) > 0.2) n.negate();
    return n;
  };

  const vAtY = (u: number, y: number) => {
    const c = centre(u);
    const s = sheer(u);
    if (c.y >= y) return 0;
    if (s.y <= y) return 1;
    // bisection (section shape may be piecewise)
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      const py = c.y + (s.y - c.y) * section(u, mid)[1];
      if (py < y) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };

  return { spec, centre, sheer, point, normal, vAtY };
}

/* --------------------------------- Builders -------------------------------- */

interface BandOpts {
  stations: number;
  rows: number;
  /** v range per station */
  v0: (u: number) => number;
  v1: (u: number) => number;
  u0?: number;
  u1?: number;
  /** planks across the full girth and the tile's plank count (for UV v) */
  planks?: number;
  tilePlanks?: number;
  /** metres of hull length per texture tile */
  tileLength?: number;
  /** inward offset (inner bulwark skin) */
  inset?: number;
}

/** Both sides of a band of hull surface between v0(u) and v1(u). */
export function hullBand(h: Hull, o: BandOpts) {
  const u0 = o.u0 ?? 0;
  const u1 = o.u1 ?? 1;
  const planks = o.planks ?? 14;
  const tilePlanks = o.tilePlanks ?? 6;
  const tileL = o.tileLength ?? 3;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const girthCache = new Map<number, number[]>();
  // girth length samples for UVs (arc length fraction along v)
  const girth = (u: number) => {
    let g = girthCache.get(u);
    if (g) return g;
    g = [0];
    const prev = h.point(u, 0, new THREE.Vector3());
    for (let k = 1; k <= 40; k++) {
      const q = h.point(u, k / 40, new THREE.Vector3());
      g.push(g[k - 1] + q.distanceTo(prev));
      prev.copy(q);
    }
    girthCache.set(u, g);
    return g;
  };
  const girthFrac = (u: number, v: number) => {
    const g = girth(u);
    const f = v * 40;
    const i = Math.min(39, Math.floor(f));
    const t = f - i;
    const L = g[40] || 1;
    return (g[i] + (g[i + 1] - g[i]) * t) / L;
  };
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= o.stations; i++) {
      const u = u0 + (u1 - u0) * (i / o.stations);
      const va = o.v0(u);
      const vb = o.v1(u);
      for (let j = 0; j <= o.rows; j++) {
        const v = va + (vb - va) * (j / o.rows);
        h.point(u, v, p);
        const n = h.normal(u, v);
        let x = p.x;
        if (o.inset) x = Math.max(0.01, x - o.inset);
        pos.push(x * side, p.y, p.z);
        const s = o.inset ? -1 : 1;
        nor.push(n.x * side * s, n.y * s, n.z * s);
        uv.push(p.z / tileL, (girthFrac(u, v) * planks) / tilePlanks);
      }
    }
    const R = o.rows + 1;
    for (let i = 0; i < o.stations; i++)
      for (let j = 0; j < o.rows; j++) {
        const a = base + i * R + j;
        const b = a + R;
        const standard = side === 1 ? !o.inset : !!o.inset;
        if (standard) idx.push(a, a + 1, b, b, a + 1, b + 1);
        else idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Transom panel closing the stern at u = 0, with a crowned top. */
export function transomGeometry(h: Hull, rows = 20, crown = 0.15, tileL = 1.6) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const cols = 16;
  const p = new THREE.Vector3();
  const top = h.point(0, 1, new THREE.Vector3());
  for (let j = 0; j <= rows + 3; j++) {
    for (let i = 0; i <= cols; i++) {
      const s = (i / cols) * 2 - 1;
      if (j <= rows) {
        h.point(0, j / rows, p);
        pos.push(p.x * s, p.y, p.z);
      } else {
        const t = (j - rows) / 3;
        const x = top.x * s;
        const y = top.y + crown * t * (1 - s * s);
        pos.push(x, y, top.z - 0.02 * t);
      }
      const q = pos.length - 3;
      uv.push(pos[q] / tileL, pos[q + 1] / 1.2);
    }
  }
  const C = cols + 1;
  for (let j = 0; j < rows + 3; j++)
    for (let i = 0; i < cols; i++) {
      const a = j * C + i;
      idx.push(a, a + C, a + 1, a + 1, a + C, a + C + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Deck surface at height deckY(u) between the inner bulwarks, with camber. */
export function deckGeometry(h: Hull, u0: number, u1: number, deckY: (u: number) => number, inset: number, stations = 60, camber = 0.06, tile = 2.4) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const cols = 10;
  const p = new THREE.Vector3();
  for (let i = 0; i <= stations; i++) {
    const u = u0 + (u1 - u0) * (i / stations);
    const y = deckY(u);
    const v = h.vAtY(u, y);
    h.point(u, v, p);
    const hw = Math.max(0.0, p.x - inset);
    for (let j = 0; j <= cols; j++) {
      const s = (j / cols) * 2 - 1;
      const x = hw * s;
      pos.push(x, y + camber * (1 - s * s) * Math.min(1, hw), p.z);
      uv.push(p.z / tile, x / 1.2);
    }
  }
  const C = cols + 1;
  for (let i = 0; i < stations; i++)
    for (let j = 0; j < cols; j++) {
      const a = i * C + j;
      idx.push(a, a + C, a + 1, a + 1, a + C, a + C + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Sweeps a 2D profile along a path. Frames use `refUp` (profile x = side,
 * profile y = up-ish); UV u = arc length / tile, v = profile fraction.
 */
export function sweep(path: THREE.Vector3[], profile: [number, number][], refUp = new THREE.Vector3(0, 1, 0), tile = 1, closed = true, scale?: (t: number) => number) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const n = path.length;
  const P = profile.length;
  let arc = 0;
  const X = new THREE.Vector3();
  const U = new THREE.Vector3();
  const T = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const a = path[Math.max(0, i - 1)];
    const b = path[Math.min(n - 1, i + 1)];
    T.subVectors(b, a).normalize();
    X.crossVectors(T, refUp);
    if (X.lengthSq() < 1e-8) X.set(1, 0, 0);
    X.normalize();
    U.crossVectors(X, T).normalize();
    if (i > 0) arc += path[i].distanceTo(path[i - 1]);
    const sc = scale ? scale(i / (n - 1)) : 1;
    for (let k = 0; k <= P; k++) {
      const [px, py] = profile[k % P];
      const q = path[i];
      pos.push(q.x + (X.x * px + U.x * py) * sc, q.y + (X.y * px + U.y * py) * sc, q.z + (X.z * px + U.z * py) * sc);
      uv.push(arc / tile, k / P);
    }
  }
  const R = P + 1;
  const segs = closed ? P : P - 1;
  for (let i = 0; i < n - 1; i++)
    for (let k = 0; k < segs; k++) {
      const a = i * R + k;
      const b = a + R;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Rounded-rectangle profile (for rails, wales, keels). */
export function roundRect(w: number, hgt: number, r: number, seg = 3): [number, number][] {
  const pts: [number, number][] = [];
  const corners: [number, number, number][] = [
    [w / 2 - r, hgt / 2 - r, 0],
    [-w / 2 + r, hgt / 2 - r, Math.PI / 2],
    [-w / 2 + r, -hgt / 2 + r, Math.PI],
    [w / 2 - r, -hgt / 2 + r, (Math.PI * 3) / 2],
  ];
  for (const [cx, cy, a0] of corners)
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  return pts;
}

export function circle(r: number, seg = 8): [number, number][] {
  return Array.from({ length: seg }, (_, i) => {
    const a = (i / seg) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r] as [number, number];
  });
}

/** Points along the sheer (optionally dropped/inset) for one side. */
export function sheerPath(h: Hull, side: number, drop = 0, inset = 0, u0 = 0, u1 = 1, n = 80) {
  const out: THREE.Vector3[] = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const u = u0 + (u1 - u0) * (i / n);
    const s = h.sheer(u);
    const v = drop > 0 ? h.vAtY(u, s.y - drop) : 1;
    h.point(u, v, p);
    out.push(new THREE.Vector3((p.x - inset) * side, p.y, p.z));
  }
  return out;
}

/** Centreline profile points (keel → stem). */
export function centrePath(h: Hull, u0: number, u1: number, n = 80) {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const c = h.centre(u0 + (u1 - u0) * (i / n));
    out.push(new THREE.Vector3(0, c.y, c.x));
  }
  return out;
}

/** World-space position of the hull at (u, v) on one side. */
export function hullPoint(h: Hull, u: number, v: number, side: number) {
  const p = h.point(u, v);
  p.x *= side;
  return p;
}
