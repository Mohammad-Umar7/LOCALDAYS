import { useMemo } from 'react';
import * as THREE from 'three';
import { smoothLathe, tubeAlong } from '../../props/geo';
import type { Vec3 } from '../../core/types';
import { PAL, type HarbourMaterials } from './materials';
import { box, mergeAll, place, tint } from './util';

/* ------------------------------------------------------------------ */
/*  Majlis set built on the shared palette materials (so it folds into */
/*  existing draw calls): Al Sadu floor seating with cushions and arm  */
/*  bolsters, a Sadu rug, and a gahwa tray with dallah, cups & dates.  */
/* ------------------------------------------------------------------ */

const CUSHIONS = ['#8E1E1A', '#5B1715', '#B8862E', '#2C201A', '#7A2420'];

export interface MajlisSpec {
  position: Vec3;
  length: number;
  rotation?: number;
  colorIndex?: number;
}

export interface RugSpec {
  position: Vec3;
  size: [number, number];
  rotation?: number;
}

/** Builds seating, rugs and an optional gahwa tray into per-material geometries. */
export function majlisGeometry(seats: MajlisSpec[], rugs: RugSpec[], trays: { position: Vec3; rotation?: number; scale?: number }[] = []) {
  const sadu: THREE.BufferGeometry[] = [];
  const cloth: THREE.BufferGeometry[] = [];
  const metal: THREE.BufferGeometry[] = [];
  const paint: THREE.BufferGeometry[] = [];
  const matte: THREE.BufferGeometry[] = [];
  const g = new THREE.Group();
  for (const s of seats) {
    const parts: { geo: THREE.BufferGeometry; list: THREE.BufferGeometry[] }[] = [];
    const seat = box(s.length, 0.16, 0.75, 0.06, 0.55, 3);
    seat.translate(0, 0.08, 0);
    parts.push({ geo: seat, list: sadu });
    const n = Math.max(2, Math.round(s.length / 0.75));
    for (let i = 0; i < n; i++) {
      const c = box(0.62, 0.5, 0.2, 0.08, 1.2, 3);
      place(c, [-s.length / 2 + 0.38 + i * ((s.length - 0.76) / Math.max(1, n - 1)), 0.42, -0.3], [-0.18, 0, 0]);
      parts.push({ geo: tint(c, CUSHIONS[(i + (s.colorIndex ?? 0)) % CUSHIONS.length]), list: cloth });
    }
    for (const side of [-1, 1]) {
      const a = new THREE.CylinderGeometry(0.13, 0.13, 0.6, 18);
      place(a, [side * (s.length / 2 - 0.1), 0.28, 0.05], [Math.PI / 2, 0, 0]);
      parts.push({ geo: tint(a, CUSHIONS[0]), list: cloth });
    }
    g.position.set(...s.position);
    g.rotation.set(0, s.rotation ?? 0, 0);
    g.updateMatrix();
    for (const p of parts) p.list.push(p.geo.applyMatrix4(g.matrix));
  }
  for (const r of rugs) {
    const p = new THREE.PlaneGeometry(r.size[0], r.size[1], 1, 1);
    p.rotateX(-Math.PI / 2);
    const uv = p.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * r.size[0]) / 1.6, (uv.getY(i) * r.size[1]) / 1.6);
    p.rotateY(r.rotation ?? 0);
    p.translate(...r.position);
    sadu.push(p);
  }
  for (const t of trays) {
    const parts: { geo: THREE.BufferGeometry; list: THREE.BufferGeometry[] }[] = [];
    parts.push({ geo: tint(place(new THREE.CylinderGeometry(0.3, 0.28, 0.02, 40), [0, 0.01, 0]), PAL.brass), list: metal });
    const body = smoothLathe(
      [
        [0.001, 0],
        [0.09, 0.005],
        [0.105, 0.04],
        [0.085, 0.12],
        [0.05, 0.17],
        [0.042, 0.2],
        [0.06, 0.235],
        [0.075, 0.25],
        [0.05, 0.3],
        [0.035, 0.32],
        [0.012, 0.36],
        [0.001, 0.37],
      ],
      32,
      48,
    ).clone();
    parts.push({ geo: tint(place(body, [-0.08, 0.02, 0]), PAL.brass), list: metal });
    const spout = tubeAlong([new THREE.Vector3(0.07, 0.07, 0), new THREE.Vector3(0.14, 0.16, 0), new THREE.Vector3(0.17, 0.27, 0), new THREE.Vector3(0.22, 0.31, 0)], 0.012, 8);
    parts.push({ geo: tint(place(spout, [-0.08, 0.02, 0]), PAL.brass), list: metal });
    const handle = tubeAlong([new THREE.Vector3(-0.06, 0.24, 0), new THREE.Vector3(-0.14, 0.22, 0), new THREE.Vector3(-0.15, 0.12, 0), new THREE.Vector3(-0.09, 0.07, 0)], 0.01, 6);
    parts.push({ geo: tint(place(handle, [-0.08, 0.02, 0]), PAL.brass), list: metal });
    const cup = smoothLathe(
      [
        [0.001, 0],
        [0.018, 0.0],
        [0.024, 0.02],
        [0.03, 0.045],
        [0.028, 0.046],
        [0.02, 0.022],
        [0.001, 0.008],
      ],
      20,
      16,
    );
    for (let i = 0; i < 4; i++) parts.push({ geo: tint(place(cup.clone(), [0.12 + (i % 2) * 0.07, 0.02, -0.07 + Math.floor(i / 2) * 0.12]), PAL.white), list: paint });
    parts.push({ geo: tint(place(new THREE.SphereGeometry(0.08, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), [0.05, 0.1, 0.16]), '#D9C9AA'), list: paint });
    for (let i = 0; i < 9; i++) {
      const d = new THREE.SphereGeometry(1, 8, 6);
      d.scale(0.016, 0.012, 0.024);
      parts.push({ geo: tint(place(d, [0.05 + Math.cos(i * 2.1) * 0.035, 0.065, 0.16 + Math.sin(i * 2.1) * 0.035], [0, i, 0]), PAL.dates), list: matte });
    }
    g.position.set(...t.position);
    g.rotation.set(0, t.rotation ?? 0, 0);
    g.scale.setScalar(t.scale ?? 1);
    g.updateMatrix();
    for (const p of parts) p.list.push(p.geo.applyMatrix4(g.matrix));
  }
  const out = (l: THREE.BufferGeometry[], c: boolean) => (l.length ? mergeAll(l, c) : null);
  return { sadu: out(sadu, false), cloth: out(cloth, true), metal: out(metal, true), paint: out(paint, true), matte: out(matte, true) };
}

export function MajlisSet({ m, seats, rugs, trays }: { m: HarbourMaterials & { sadu: THREE.Material }; seats: MajlisSpec[]; rugs: RugSpec[]; trays?: { position: Vec3; rotation?: number; scale?: number }[] }) {
  const g = useMemo(() => majlisGeometry(seats, rugs, trays), [seats, rugs, trays]);
  return (
    <group>
      {g.sadu && <mesh geometry={g.sadu} material={m.sadu} castShadow receiveShadow />}
      {g.cloth && <mesh geometry={g.cloth} material={m.cloth} castShadow receiveShadow />}
      {g.metal && <mesh geometry={g.metal} material={m.metal} castShadow receiveShadow />}
      {g.paint && <mesh geometry={g.paint} material={m.paint} castShadow receiveShadow />}
      {g.matte && <mesh geometry={g.matte} material={m.matte} castShadow receiveShadow />}
    </group>
  );
}
