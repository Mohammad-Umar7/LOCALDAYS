import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/* Geometry helpers shared by every venue. Results are cached by arguments. */

const cache = new Map<string, THREE.BufferGeometry>();
function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  const hit = cache.get(key);
  if (hit) return hit as T;
  const g = make();
  cache.set(key, g);
  return g;
}

/** Box with softly rounded edges — edges catch light, which reads as "real". */
export function roundedBox(w: number, h: number, d: number, r = 0.04, segments = 3) {
  return cached(`rb:${w}:${h}:${d}:${r}:${segments}`, () => new RoundedBoxGeometry(w, h, d, segments, Math.min(r, w / 2, h / 2, d / 2)));
}

export type ArchKind = 'round' | 'pointed' | 'flat' | 'ogee';

/** Adds an arch-topped opening path to a shape (as a hole or outline). */
export function archPath(
  path: THREE.Path | THREE.Shape,
  x: number,
  y: number,
  w: number,
  h: number,
  kind: ArchKind = 'round',
  clockwise = false,
) {
  const r = w / 2;
  const spring = kind === 'flat' ? h : h - (kind === 'pointed' ? r * 1.25 : r);
  const pts: THREE.Vector2[] = [];
  pts.push(new THREE.Vector2(x - r, y));
  pts.push(new THREE.Vector2(x - r, y + spring));
  if (kind === 'round') {
    for (let i = 1; i < 24; i++) {
      const a = Math.PI - (i / 24) * Math.PI;
      pts.push(new THREE.Vector2(x + Math.cos(a) * r, y + spring + Math.sin(a) * r));
    }
  } else if (kind === 'pointed') {
    const rise = h - spring;
    for (let i = 1; i < 12; i++) {
      const t = i / 12;
      // Two circular arcs meeting at the apex
      const a = (t * Math.PI) / 2;
      pts.push(new THREE.Vector2(x - r + (1 - Math.cos(a)) * r, y + spring + Math.sin(a) * rise));
    }
    pts.push(new THREE.Vector2(x, y + h));
    for (let i = 11; i >= 1; i--) {
      const t = i / 12;
      const a = (t * Math.PI) / 2;
      pts.push(new THREE.Vector2(x + r - (1 - Math.cos(a)) * r, y + spring + Math.sin(a) * rise));
    }
  } else if (kind === 'ogee') {
    const rise = h - spring;
    for (let i = 1; i < 16; i++) {
      const t = i / 16;
      const s = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      pts.push(new THREE.Vector2(x - r + t * r, y + spring + s * rise));
    }
    pts.push(new THREE.Vector2(x, y + h));
    for (let i = 15; i >= 1; i--) {
      const t = i / 16;
      const s = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      pts.push(new THREE.Vector2(x + r - t * r, y + spring + s * rise));
    }
  }
  pts.push(new THREE.Vector2(x + r, y + spring));
  pts.push(new THREE.Vector2(x + r, y));
  const ordered = clockwise ? pts.reverse() : pts;
  path.moveTo(ordered[0].x, ordered[0].y);
  for (let i = 1; i < ordered.length; i++) path.lineTo(ordered[i].x, ordered[i].y);
  path.closePath();
  return path;
}

export interface Opening {
  x: number;
  y: number;
  w: number;
  h: number;
  kind?: ArchKind;
}

/**
 * A wall slab (centred on x, base at y=0) with arched openings cut through,
 * extruded along +Z by `thickness` with a soft bevel.
 */
export function wallGeometry(width: number, height: number, thickness: number, openings: Opening[] = [], bevel = 0.025) {
  const key = `wall:${width}:${height}:${thickness}:${bevel}:${JSON.stringify(openings)}`;
  return cached(key, () => {
    const s = new THREE.Shape();
    s.moveTo(-width / 2, 0);
    s.lineTo(width / 2, 0);
    s.lineTo(width / 2, height);
    s.lineTo(-width / 2, height);
    s.closePath();
    for (const o of openings) {
      const hole = new THREE.Path();
      archPath(hole, o.x, o.y, o.w, o.h, o.kind ?? 'round', true);
      s.holes.push(hole);
    }
    const g = new THREE.ExtrudeGeometry(s, {
      depth: thickness - bevel * 2,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
      curveSegments: 18,
    });
    g.translate(0, 0, -thickness / 2 + bevel);
    // Planar UVs in metres so tiled textures stay consistent
    const pos = g.attributes.position as THREE.BufferAttribute;
    const nor = g.attributes.normal as THREE.BufferAttribute;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const nx = Math.abs(nor.getX(i));
      const ny = Math.abs(nor.getY(i));
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (ny > 0.7) {
        uv[i * 2] = x * 0.5;
        uv[i * 2 + 1] = z * 0.5;
      } else if (nx > 0.7) {
        uv[i * 2] = z * 0.5;
        uv[i * 2 + 1] = y * 0.5;
      } else {
        uv[i * 2] = x * 0.5;
        uv[i * 2 + 1] = y * 0.5;
      }
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  });
}

/** Re-maps a geometry's UVs to world-scale box projection (metres × scale). */
export function boxProjectUVs(g: THREE.BufferGeometry, scale = 0.5) {
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

/** Smooth lathe from a list of [radius, height] pairs. */
export function lathe(profile: [number, number][], segments = 48) {
  return cached(`lathe:${segments}:${JSON.stringify(profile)}`, () => {
    const g = new THREE.LatheGeometry(
      profile.map(([r, y]) => new THREE.Vector2(r, y)),
      segments,
    );
    g.computeVertexNormals();
    return g;
  });
}

/** Catmull-Rom smoothed profile → lathe (for pots, bottles, jars). */
export function smoothLathe(profile: [number, number][], segments = 64, samples = 64) {
  return cached(`slathe:${segments}:${samples}:${JSON.stringify(profile)}`, () => {
    const curve = new THREE.SplineCurve(profile.map(([r, y]) => new THREE.Vector2(r, y)));
    const pts = curve.getPoints(samples).map((p) => new THREE.Vector2(Math.max(0.0005, p.x), p.y));
    const g = new THREE.LatheGeometry(pts, segments);
    g.computeVertexNormals();
    return g;
  });
}

/** Hanging catenary-ish curve between two points (for string lights, ropes, nets). */
export function sagCurve(a: THREE.Vector3, b: THREE.Vector3, sag = 0.4, n = 24) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = a.clone().lerp(b, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    pts.push(p);
  }
  return pts;
}

export function tubeAlong(points: THREE.Vector3[], radius = 0.01, radial = 5) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(8, points.length * 2), radius, radial, false);
}
