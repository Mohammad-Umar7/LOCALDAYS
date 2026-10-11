import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Vec3 } from '../../core/types';

/* ------------------------------------------------------------------ */
/*  Geometry builders for the atelier (cached by argument key).        */
/* ------------------------------------------------------------------ */

const cache = new Map<string, THREE.BufferGeometry>();
export function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  const hit = cache.get(key);
  if (hit) return hit as T;
  const g = make();
  cache.set(key, g);
  return g;
}

/** Room design space → world: the open side of the room (+Z local) faces world +X. */
export const toWorld = ([x, y, z]: Vec3): Vec3 => [z, y, -x];

/** Rounded-square ring loft: [halfWidth, y] profile → mabkhara bodies, trays, pedestals. */
export function squareLoft(profile: [number, number][], corner = 0.25, cornerSegs = 4, capBottom = true) {
  return cached(`sqloft:${corner}:${cornerSegs}:${capBottom}:${JSON.stringify(profile)}`, () => {
    const ring: [number, number][] = [];
    const corners: [number, number][] = [
      [1, 1],
      [-1, 1],
      [-1, -1],
      [1, -1],
    ];
    corners.forEach(([sx, sz], ci) => {
      for (let i = 0; i <= cornerSegs; i++) {
        const a = (ci * Math.PI) / 2 + (i / cornerSegs) * (Math.PI / 2);
        ring.push([sx * (1 - corner) + Math.cos(a) * corner, sz * (1 - corner) + Math.sin(a) * corner]);
      }
    });
    const rn = ring.length;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    let vAcc = 0;
    profile.forEach(([w, y], pi) => {
      if (pi > 0) vAcc += Math.hypot(w - profile[pi - 1][0], y - profile[pi - 1][1]);
      for (let i = 0; i <= rn; i++) {
        const [x, z] = ring[i % rn];
        pos.push(x * w, y, z * w);
        uv.push(i / rn, vAcc * 4);
      }
    });
    const stride = rn + 1;
    for (let p = 0; p < profile.length - 1; p++)
      for (let i = 0; i < rn; i++) {
        const a = p * stride + i;
        const b = a + stride;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    if (capBottom) {
      const c = pos.length / 3;
      pos.push(0, profile[0][1], 0);
      uv.push(0.5, 0);
      for (let i = 0; i < rn; i++) idx.push(c, i, i + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });
}

/** Flat annular sector (organ tiers, curved shelves) — extruded upward by `height`, bevelled. */
export function annularSector(rIn: number, rOut: number, a0: number, a1: number, height: number, bevel = 0.006, segs = 48) {
  return cached(`annsec:${rIn}:${rOut}:${a0}:${a1}:${height}:${bevel}:${segs}`, () => {
    const s = new THREE.Shape();
    s.moveTo(Math.cos(a0) * rOut, Math.sin(a0) * rOut);
    s.absarc(0, 0, rOut, a0, a1, false);
    s.lineTo(Math.cos(a1) * rIn, Math.sin(a1) * rIn);
    s.absarc(0, 0, rIn, a1, a0, true);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
      depth: Math.max(0.001, height - bevel * 2),
      bevelEnabled: bevel > 0,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 2,
      curveSegments: segs,
    });
    // shape XY → lie flat in XZ, extrude upward (+Y)
    g.rotateX(-Math.PI / 2);
    g.translate(0, bevel, 0);
    return boxUV(g, 2);
  });
}

/** Vertical curved panel (the face of an organ tier) — open cylinder segment. */
export function arcPanel(r: number, a0: number, a1: number, y0: number, y1: number, segs = 48) {
  return cached(`arcpanel:${r}:${a0}:${a1}:${y0}:${y1}:${segs}`, () => {
    // CylinderGeometry measures theta from +Z toward +X; our angles are from +X toward +Z (shape space mapped by rotateX).
    const g = new THREE.CylinderGeometry(r, r, y1 - y0, segs, 1, true, Math.PI / 2 + a0, a1 - a0);
    g.translate(0, (y0 + y1) / 2, 0);
    return g;
  });
}

/** Irregular rock / wood chunk: displaced icosphere (smooth, or faceted like split wood). */
export function chunk(seed: number, detail = 2, stretch: Vec3 = [1, 1, 1], rough = 0.28, faceted = false) {
  return cached(`chunk:${seed}:${detail}:${stretch.join(',')}:${rough}:${faceted}`, () => {
    let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    g = mergeVertices(g);
    const p = g.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    const s = seed * 1.731;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n =
        Math.sin(v.x * 2.3 + s) * 0.5 +
        Math.sin(v.y * 3.1 - s * 1.3) * 0.35 +
        Math.sin(v.z * 4.3 + s * 0.7) * 0.3 +
        Math.sin((v.x + v.z) * 7.7 + s) * 0.15 +
        Math.sin((v.y - v.x) * 11.3 - s) * 0.08;
      // flatten a couple of faces so chunks rest naturally
      v.multiplyScalar(1 + n * rough);
      if (v.y < -0.55) v.y = -0.55 + (v.y + 0.55) * 0.25;
      v.set(v.x * stretch[0], v.y * stretch[1], v.z * stretch[2]);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    if (faceted) g = g.toNonIndexed();
    g.computeVertexNormals();
    return boxUV(g, 1.2);
  });
}

/** Domed upholstered stool seat (base at y = 0). */
export function seatGeo(r: number, h: number) {
  return cached(`seat:${r}:${h}`, () => {
    const pts: [number, number][] = [[0.001, h], [r * 0.55, h * 0.96], [r * 0.86, h * 0.82], [r * 0.99, h * 0.55], [r, h * 0.3], [r * 0.96, 0], [0.001, 0]];
    const curve = new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.LatheGeometry(curve.getPoints(28).map((p) => new THREE.Vector2(Math.max(0.0005, p.x), p.y)), 48);
    g.computeVertexNormals();
    return g;
  });
}

/** Plump floor cushion: rounded box with a puffed top and a tufted centre. */
export function cushionGeo(w: number, h: number, d: number) {
  return cached(`cushion:${w}:${h}:${d}`, () => {
    const g = new RoundedBoxGeometry(w, h, d, 6, Math.min(h * 0.45, 0.05));
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / (w / 2);
      const z = p.getZ(i) / (d / 2);
      let y = p.getY(i);
      const k = Math.max(0, 1 - x * x) * Math.max(0, 1 - z * z);
      const r = Math.hypot(x, z);
      if (y > 0) y += k * h * 0.42 - Math.max(0, 0.16 - r) * h * 1.6;
      else y -= k * h * 0.08;
      p.setY(i, y + h / 2);
      // soften the side walls outward a little
      p.setX(i, p.getX(i) * (1 + k * 0.03));
      p.setZ(i, p.getZ(i) * (1 + k * 0.03));
    }
    g.computeVertexNormals();
    return g;
  });
}

/** World-scale-ish box-projected UVs on any geometry (in place). */
export function boxUV<T extends THREE.BufferGeometry>(g: T, scale = 1): T {
  const pos = g.attributes.position as THREE.BufferAttribute;
  if (!g.attributes.normal) g.computeVertexNormals();
  const nor = g.attributes.normal as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (ny >= nx && ny >= nz) {
      uv[i * 2] = x * scale;
      uv[i * 2 + 1] = z * scale;
    } else if (nx >= nz) {
      uv[i * 2] = z * scale;
      uv[i * 2 + 1] = y * scale;
    } else {
      uv[i * 2] = x * scale;
      uv[i * 2 + 1] = y * scale;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Merge a list of (geometry, matrix) parts into one non-indexed geometry with normal+uv. */
export function mergeParts(parts: { g: THREE.BufferGeometry; m?: THREE.Matrix4 }[]) {
  const geos = parts.map(({ g, m }) => {
    let c = g.index ? g.toNonIndexed() : g.clone();
    for (const name of Object.keys(c.attributes)) if (!['position', 'normal', 'uv'].includes(name)) c.deleteAttribute(name);
    if (!c.attributes.normal) c.computeVertexNormals();
    if (!c.attributes.uv) c.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(c.attributes.position.count * 2), 2));
    if (m) c.applyMatrix4(m);
    c = c.index ? c.toNonIndexed() : c;
    return c;
  });
  const out = mergeGeometries(geos, false)!;
  geos.forEach((g) => g.dispose());
  return out;
}

export const M = {
  t: (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z),
  trs: (p: Vec3, r: Vec3 = [0, 0, 0], s: Vec3 = [1, 1, 1]) =>
    new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s)),
};

export type ArchKind = 'round' | 'pointed' | 'ogee';

/** Arch outline from bottom-left, over the crown, to bottom-right (no closing segment). */
export function archPoints(w: number, h: number, kind: ArchKind, segs = 20, x = 0, y = 0) {
  const r = w / 2;
  const spring = h - (kind === 'pointed' ? r * 1.25 : r);
  const rise = h - spring;
  const pts: THREE.Vector2[] = [new THREE.Vector2(x - r, y), new THREE.Vector2(x - r, y + spring)];
  // Same curves as the shared archPath() so surrounds match the wall openings.
  const half: THREE.Vector2[] = [];
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    if (kind === 'round') {
      const a = Math.PI - t * (Math.PI / 2);
      half.push(new THREE.Vector2(x + Math.cos(a) * r, y + spring + Math.sin(a) * r));
    } else if (kind === 'pointed') {
      const a = (t * Math.PI) / 2;
      half.push(new THREE.Vector2(x - r + (1 - Math.cos(a)) * r, y + spring + Math.sin(a) * rise));
    } else {
      const s = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      half.push(new THREE.Vector2(x - r + t * r, y + spring + s * rise));
    }
  }
  pts.push(...half, new THREE.Vector2(x, y + h));
  for (let i = half.length - 1; i >= 0; i--) pts.push(new THREE.Vector2(2 * x - half[i].x, half[i].y));
  pts.push(new THREE.Vector2(x + r, y + spring), new THREE.Vector2(x + r, y));
  return pts;
}

/** Flat band following an arch (architrave / surround): outer outline minus inner opening. */
export function archBand(w: number, h: number, kind: ArchKind, band: number, depth: number, bevel = 0.008) {
  return cached(`archband:${w}:${h}:${kind}:${band}:${depth}:${bevel}`, () => {
    const outer = archPoints(w + band * 2, h + band * 1.1, kind, 24);
    const inner = archPoints(w, h, kind, 24).reverse();
    const s = new THREE.Shape([...outer, ...inner]);
    const g = new THREE.ExtrudeGeometry(s, { depth: depth - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 4 });
    g.translate(0, 0, bevel);
    return g;
  });
}

/** Filled arch panel (niche backs, transoms). */
export function archPanel(w: number, h: number, kind: ArchKind, depth = 0) {
  return cached(`archpanel:${w}:${h}:${kind}:${depth}`, () => {
    const s = new THREE.Shape(archPoints(w, h, kind, 24));
    return depth > 0 ? new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }) : new THREE.ShapeGeometry(s);
  });
}

/** Deterministic pseudo-random sequence. */
export function rng(seed: number) {
  let a = (seed * 9301 + 49297) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Half-width of an arch opening at height `yRel` above its base (matches archPoints). */
export function archHalfWidth(w: number, h: number, kind: ArchKind, yRel: number) {
  const r = w / 2;
  const spring = h - (kind === 'pointed' ? r * 1.25 : r);
  if (yRel <= spring) return r;
  const rise = h - spring;
  const s = Math.min(1, (yRel - spring) / rise);
  if (kind === 'round') return Math.sqrt(Math.max(0, r * r - (s * r) ** 2));
  if (kind === 'pointed') {
    const a = Math.asin(s);
    return r - (1 - Math.cos(a)) * r;
  }
  const t = s <= 0.5 ? Math.sqrt(s / 2) : 1 - Math.sqrt((1 - s) / 2);
  return r * (1 - t);
}

/**
 * Bakes copies of `geo` at each matrix into one static geometry (optionally
 * with a per-copy vertex colour). Static "instances" then merge with every
 * other mesh of the same material inside StaticBatch — far fewer draw calls
 * than one InstancedMesh per prop type.
 */
export function bakeInstances(geo: THREE.BufferGeometry, mats: THREE.Matrix4[], colors?: THREE.Color[]) {
  const base = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const name of Object.keys(base.attributes)) if (!['position', 'normal', 'uv'].includes(name)) base.deleteAttribute(name);
  if (!base.attributes.normal) base.computeVertexNormals();
  if (!base.attributes.uv) base.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(base.attributes.position.count * 2), 2));
  const n = base.attributes.position.count;
  const parts = mats.map((mt, i) => {
    const g = base.clone();
    g.applyMatrix4(mt);
    if (colors) {
      const c = colors[i % colors.length];
      const arr = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) {
        arr[k * 3] = c.r;
        arr[k * 3 + 1] = c.g;
        arr[k * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    }
    return g;
  });
  const out = parts.length ? mergeGeometries(parts, false)! : base;
  parts.forEach((p) => p !== out && p.dispose());
  base.dispose();
  return out;
}
