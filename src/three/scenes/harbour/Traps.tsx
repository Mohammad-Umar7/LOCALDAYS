import { useMemo } from 'react';
import * as THREE from 'three';
import type { Quality } from '../../core/types';
import { groundHeight } from './layout';
import { PAL, type HarbourMaterials } from './materials';
import { box, mergeAll, place, tint } from './util';

/* ------------------------------------------------------------------ */
/*  Gargoor — the Gulf's dome-shaped woven-wire fish trap (≈1.7 m),    */
/*  with its inward funnel entrance, rebar base ring, meridian ribs   */
/*  and top hatch. The hex weave is an alpha-cut texture, so the dome */
/*  reads as see-through wire and casts dappled hexagonal shadows.    */
/* ------------------------------------------------------------------ */

const W = 0.3; // metres per wire-texture tile (6 hexagons ≈ 5 cm each)
export const TRAP_R = 0.86;
export const TRAP_H = 0.78;

const PROFILE: [number, number][] = [
  [0.86, 0.0],
  [0.87, 0.1],
  [0.84, 0.26],
  [0.76, 0.42],
  [0.62, 0.56],
  [0.44, 0.67],
  [0.24, 0.74],
  [0.14, 0.765],
];

const MOUTH = { y: 0.3, r: 0.25, depth: 0.55, inner: 0.085 };

function profileAt(n: number) {
  const curve = new THREE.SplineCurve(PROFILE.map(([r, y]) => new THREE.Vector2(r, y)));
  return curve.getSpacedPoints(n);
}

/** One trap in local space: base centred on the origin, funnel facing +z. */
export function gargoorGeometry(quality: Quality, partial = false) {
  const seg = quality === 'high' ? 44 : 30;
  const rows = quality === 'high' ? 18 : 12;
  const prof = profileAt(rows);
  const arc: number[] = [0];
  for (let i = 1; i < prof.length; i++) arc.push(arc[i - 1] + prof[i].distanceTo(prof[i - 1]));

  // mouth position on the dome surface (+z side)
  const mouthR = (() => {
    for (let i = 1; i < prof.length; i++) if (prof[i].y >= MOUTH.y) return THREE.MathUtils.lerp(prof[i - 1].x, prof[i].x, (MOUTH.y - prof[i - 1].y) / (prof[i].y - prof[i - 1].y));
    return PROFILE[0][0];
  })();
  const mouthC = new THREE.Vector3(0, MOUTH.y, mouthR);

  const pos: number[] = [];
  const uv: number[] = [];
  const P = (i: number, j: number) => {
    const a = (j / seg) * Math.PI * 2;
    const p = prof[i];
    return { v: new THREE.Vector3(Math.sin(a) * p.x, p.y, Math.cos(a) * p.x), u: (a * TRAP_R) / W, w: arc[i] / W };
  };
  const maxJ = partial ? Math.round(seg * 0.55) : seg;
  for (let i = 0; i < prof.length - 1; i++)
    for (let j = 0; j < maxJ; j++) {
      const a = P(i, j);
      const b = P(i + 1, j);
      const c = P(i + 1, j + 1);
      const d = P(i, j + 1);
      const centre = a.v.clone().add(c.v).multiplyScalar(0.5);
      if (!partial && centre.distanceTo(mouthC) < MOUTH.r * 0.92) continue;
      for (const q of [a, b, c, a, c, d]) {
        pos.push(q.v.x, q.v.y, q.v.z);
        uv.push(q.u, q.w);
      }
    }
  const dome = new THREE.BufferGeometry();
  dome.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  dome.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  dome.computeVertexNormals();

  const parts: THREE.BufferGeometry[] = [dome];
  const frame: THREE.BufferGeometry[] = [];
  if (!partial) {
    // funnel: a wire cone leading inward and slightly down
    const fpos: number[] = [];
    const fuv: number[] = [];
    const fs = 18;
    const fr = 5;
    for (let i = 0; i < fr; i++)
      for (let j = 0; j < fs; j++) {
        const q = (ii: number, jj: number) => {
          const t = ii / fr;
          const a = (jj / fs) * Math.PI * 2;
          const r = THREE.MathUtils.lerp(MOUTH.r, MOUTH.inner, t);
          return {
            v: new THREE.Vector3(Math.cos(a) * r, MOUTH.y + Math.sin(a) * r * 0.9 - t * 0.08, mouthC.z - t * MOUTH.depth),
            u: (a * MOUTH.r) / W,
            w: (t * MOUTH.depth) / W,
          };
        };
        const a = q(i, j);
        const b = q(i + 1, j);
        const c = q(i + 1, j + 1);
        const d = q(i, j + 1);
        for (const k of [a, b, c, a, c, d]) {
          fpos.push(k.v.x, k.v.y, k.v.z);
          fuv.push(k.u, k.w);
        }
      }
    const funnel = new THREE.BufferGeometry();
    funnel.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3));
    funnel.setAttribute('uv', new THREE.Float32BufferAttribute(fuv, 2));
    funnel.computeVertexNormals();
    parts.push(funnel);
    const mouthRing = new THREE.TorusGeometry(MOUTH.r, 0.014, 5, 24);
    mouthRing.scale(1, 0.9, 1);
    frame.push(place(mouthRing, [0, MOUTH.y, mouthC.z - 0.01]));
    const innerRing = new THREE.TorusGeometry(MOUTH.inner, 0.01, 4, 12);
    frame.push(place(innerRing, [0, MOUTH.y - 0.08, mouthC.z - MOUTH.depth]));
  }

  // frame: base ring, mid ring, top ring, meridian ribs, hatch
  const ring = (r: number, y: number, tube: number) => {
    const t = new THREE.TorusGeometry(r, tube, 5, seg);
    t.rotateX(Math.PI / 2);
    t.translate(0, y, 0);
    return t;
  };
  frame.push(ring(PROFILE[0][0] + 0.005, 0.012, 0.018));
  frame.push(ring(0.835, 0.3, 0.011));
  frame.push(ring(0.14, 0.765, 0.012));
  const ribs = partial ? 10 : 8;
  for (let k = 0; k < ribs; k++) {
    const a = (k / ribs) * Math.PI * 2 + 0.2;
    const pts = prof.map((p) => new THREE.Vector3(Math.sin(a) * (p.x + 0.006), p.y + 0.004, Math.cos(a) * (p.x + 0.006)));
    frame.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), rows * 2, 0.009, 4, false));
  }
  frame.push(place(box(0.24, 0.025, 0.24, 0.008, 1), [0, 0.775, 0]));
  return { wire: mergeAll(parts), frame: mergeAll(frame) };
}

export interface TrapPlacement {
  p: [number, number, number];
  rot: [number, number, number];
  s?: number;
  partial?: boolean;
}

/** Merges copies of the trap into wire + frame geometries for a set of placements. */
export function trapCluster(list: TrapPlacement[], quality: Quality) {
  const full = gargoorGeometry(quality);
  const part = gargoorGeometry(quality, true);
  const wire: THREE.BufferGeometry[] = [];
  const frame: THREE.BufferGeometry[] = [];
  list.forEach((t) => {
    const src = t.partial ? part : full;
    wire.push(place(src.wire.clone(), t.p, t.rot, t.s ?? 1));
    frame.push(place(src.frame.clone(), t.p, t.rot, t.s ?? 1));
  });
  return { wire: mergeAll(wire), frame: mergeAll(frame) };
}

const SHORE_TRAPS: { x: number; z: number; stack?: number; rot: [number, number, number]; s?: number; partial?: boolean }[] = [
  { x: -5.7, z: 6.9, rot: [0, 0.3, 0] },
  { x: -5.62, z: 6.98, stack: 1, rot: [0.04, 1.6, -0.03], s: 0.94 },
  { x: -3.7, z: 8.3, rot: [0, -0.7, 0], s: 1.04 },
  { x: -7.9, z: 8.9, rot: [0, 2.3, 0] },
  { x: -7.84, z: 8.95, stack: 1, rot: [-0.05, 0.5, 0.04], s: 0.95 },
  { x: -7.8, z: 9.0, stack: 2, rot: [0.03, 1.2, 0.0], s: 0.9 },
  { x: -9.9, z: 6.9, rot: [0, 1.0, 0], s: 1.08 },
  { x: -5.2, z: 10.6, rot: [1.18, 0.4, 0], s: 0.98 },
  { x: -2.6, z: 10.9, rot: [0, -0.3, 0], partial: true },
];

export function Traps({ m, quality }: { m: HarbourMaterials; quality: Quality }) {
  const geo = useMemo(() => {
    const list: TrapPlacement[] = SHORE_TRAPS.map((t) => {
      const g = groundHeight(t.x, t.z);
      let y = g + (t.stack ?? 0) * 0.58;
      if (t.rot[0] > 1) y = g + TRAP_R * 0.82;
      return { p: [t.x, y, t.z], rot: t.rot, s: t.s, partial: t.partial };
    });
    const c = trapCluster(list, quality);
    // a weaving bench and coil of wire next to the half-made trap
    const bench = mergeAll([
      place(box(1.3, 0.06, 0.4, 0.015, 0.5), [-1.6, groundHeight(-1.6, 12.1) + 0.42, 12.1], [0, -0.3, 0]),
      place(box(0.07, 0.4, 0.34, 0.015, 0.5), [-2.15, groundHeight(-2.15, 11.9) + 0.2, 11.95], [0, -0.3, 0]),
      place(box(0.07, 0.4, 0.34, 0.015, 0.5), [-1.05, groundHeight(-1.05, 12.3) + 0.2, 12.27], [0, -0.3, 0]),
    ]);
    const rollAt: [number, number, number] = [-1.5, groundHeight(-1.5, 12.1) + 0.68, 12.1];
    const layers: THREE.BufferGeometry[] = [];
    for (const rr of [0.22, 0.17, 0.12]) {
      const cyl = new THREE.CylinderGeometry(rr, rr, 0.9, 28, 1, true);
      const uv = cyl.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * Math.PI * 2 * rr) / 0.3, (uv.getY(i) * 0.9) / 0.3);
      layers.push(place(cyl, rollAt, [0, -0.3, Math.PI / 2]));
    }
    const ends = [-0.45, 0.45].map((o) => place(new THREE.TorusGeometry(0.22, 0.012, 4, 24), [rollAt[0] + Math.cos(-0.3) * o, rollAt[1], rollAt[2] - Math.sin(-0.3) * o], [0, Math.PI / 2 - 0.3, 0]));
    return { wire: mergeAll([c.wire, ...layers]), metal: mergeAll([tint(c.frame, PAL.galv), ...ends.map((e) => tint(e, PAL.galv))], true), bench: tint(bench, '#E8DCCB') };
  }, [quality]);
  return (
    <group>
      <mesh geometry={geo.wire} material={m.wire} receiveShadow />
      <mesh geometry={geo.metal} material={m.metal} castShadow receiveShadow />
      <mesh geometry={geo.bench} material={m.timber} castShadow receiveShadow />
    </group>
  );
}
