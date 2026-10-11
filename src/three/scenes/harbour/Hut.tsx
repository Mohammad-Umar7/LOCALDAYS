import { useMemo } from 'react';
import * as THREE from 'three';
import { Lantern } from '../../props/Decor';
import { smoothLathe } from '../../props/geo';
import type { Quality, Vec3 } from '../../core/types';
import { groundHeight, rng } from './layout';
import { PAL, type HarbourMaterials } from './materials';
import { MajlisSet, type MajlisSpec, type RugSpec } from './Majlis';
import { box, mergeAll, place, rod, tint } from './util';

/* ------------------------------------------------------------------ */
/*  Barasti (areesh) fisherman's hut: walls of palm-frond mats behind  */
/*  tied palm ribs on mangrove-pole frames, a gabled frond thatch      */
/*  with ridge roll, and in front a shaded majlis where the family     */
/*  serves gahwa — rug, cushions, dallah and a clay water jar.         */
/* ------------------------------------------------------------------ */

export const HUT = { x: -31.5, z: 16.8, w: 4.6, d: 3.4, wall: 2.3, ridge: 3.7, yaw: 0.22 };

function useHutParts(quality: Quality) {
  return useMemo(() => {
    const r = rng(31);
    const { w, d, wall, ridge } = HUT;
    const ribs: THREE.BufferGeometry[] = [];
    const mats: THREE.BufferGeometry[] = [];
    const poles: THREE.BufferGeometry[] = [];
    const ribStep = quality === 'high' ? 0.045 : 0.07;
    const door = { x0: -0.45, x1: 0.45, h: 1.85 };

    // a wall in local space along x at z = zw (outward normal = sign)
    const wallRun = (len: number, place2: (x: number) => [number, number], height: (x: number) => number, outward: [number, number], hasDoor: boolean) => {
      for (let x = -len / 2 + 0.06; x <= len / 2 - 0.06; x += ribStep) {
        if (hasDoor && x > door.x0 && x < door.x1) continue;
        const [px, pz] = place2(x);
        const hgt = height(x);
        ribs.push(rod(new THREE.Vector3(px + outward[0] * 0.035, -0.05, pz + outward[1] * 0.035), new THREE.Vector3(px + outward[0] * 0.035 + (r() - 0.5) * 0.02, hgt + (r() - 0.5) * 0.06, pz + outward[1] * 0.035), 0.016, 0.012, 5));
      }
      // frond mat behind the ribs
      const segs = hasDoor ? [[-len / 2, door.x0], [door.x1, len / 2]] : [[-len / 2, len / 2]];
      for (const [a, b] of segs) {
        const g = new THREE.PlaneGeometry(b - a, 1, 6, 4);
        const p = g.attributes.position as THREE.BufferAttribute;
        const uv = g.attributes.uv as THREE.BufferAttribute;
        for (let i = 0; i < p.count; i++) {
          const lx = p.getX(i) + (a + b) / 2;
          const ly = (p.getY(i) + 0.5) * height(lx);
          const [px, pz] = place2(lx);
          p.setXYZ(i, px, ly, pz);
          uv.setXY(i, lx * 0.9, ly * 0.55);
        }
        g.computeVertexNormals();
        if (outward[0] * (g.attributes.normal as THREE.BufferAttribute).getX(0) + outward[1] * (g.attributes.normal as THREE.BufferAttribute).getZ(0) < 0) {
          g.setIndex(Array.from(g.index!.array).reverse());
          g.computeVertexNormals();
        }
        mats.push(g);
      }
      // tie battens
      for (const y of [0.35, 1.25, height(0) - 0.15]) {
        const [ax, az] = place2(-len / 2);
        const [bx, bz] = place2(len / 2);
        ribs.push(rod(new THREE.Vector3(ax + outward[0] * 0.07, y, az + outward[1] * 0.07), new THREE.Vector3(bx + outward[0] * 0.07, y, bz + outward[1] * 0.07), 0.03, 0.03, 6));
      }
    };
    const gableH = (x: number, half: number) => wall + (ridge - wall) * (1 - Math.abs(x) / half);
    wallRun(w, (x) => [x, d / 2], () => wall, [0, 1], true);
    wallRun(w, (x) => [-x, -d / 2], () => wall, [0, -1], false);
    wallRun(d, (x) => [w / 2, -x], (x) => gableH(x, d / 2), [1, 0], false);
    wallRun(d, (x) => [-w / 2, x], (x) => gableH(x, d / 2), [-1, 0], false);

    // corner and ridge poles
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) poles.push(rod(new THREE.Vector3(sx * (w / 2 + 0.05), -0.3, sz * (d / 2 + 0.05)), new THREE.Vector3(sx * (w / 2 + 0.05), wall + 0.1, sz * (d / 2 + 0.05)), 0.07, 0.06, 8));
    for (const sx of [-1, 1]) poles.push(rod(new THREE.Vector3(sx * (w / 2 + 0.05), -0.3, 0), new THREE.Vector3(sx * (w / 2 + 0.05), ridge + 0.05, 0), 0.07, 0.06, 8));
    poles.push(rod(new THREE.Vector3(-w / 2 - 0.5, ridge + 0.02, 0), new THREE.Vector3(w / 2 + 0.5, ridge + 0.02, 0), 0.07, 0.07, 8));
    // door frame
    for (const x of [door.x0 - 0.04, door.x1 + 0.04]) poles.push(rod(new THREE.Vector3(x, 0, d / 2 + 0.06), new THREE.Vector3(x, door.h, d / 2 + 0.06), 0.045, 0.045, 6));
    poles.push(rod(new THREE.Vector3(door.x0 - 0.1, door.h, d / 2 + 0.06), new THREE.Vector3(door.x1 + 0.1, door.h, d / 2 + 0.06), 0.045, 0.045, 6));

    // thatched roof: two sagging planes with thickness at the eaves
    const roof: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      const g = new THREE.PlaneGeometry(w + 1.0, 1, 16, 8);
      const p = g.attributes.position as THREE.BufferAttribute;
      const uv = g.attributes.uv as THREE.BufferAttribute;
      const run = d / 2 + 0.55;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const t = p.getY(i) + 0.5; // 0 eave → 1 ridge
        const zz = s * run * (1 - t);
        const y = ridge + 0.08 - (ridge - wall + 0.35) * (1 - t) - Math.sin(t * Math.PI) * 0.06 + Math.sin(x * 3.1 + s) * 0.015;
        p.setXYZ(i, x, y, zz);
        uv.setXY(i, x * 0.8, t * 1.3);
      }
      if (s < 0) g.setIndex(Array.from(g.index!.array).reverse());
      g.computeVertexNormals();
      roof.push(g);
      // eave thickness (fringe)
      const f = new THREE.PlaneGeometry(w + 1.0, 0.22, 24, 1);
      const fp = f.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < fp.count; i++) {
        const x = fp.getX(i);
        const y = fp.getY(i);
        fp.setXYZ(i, x, wall - 0.27 + y + (y < 0 ? Math.abs(Math.sin(x * 11)) * 0.06 : 0), s * (run + 0.01));
      }
      if (s < 0) f.setIndex(Array.from(f.index!.array).reverse());
      f.computeVertexNormals();
      roof.push(f);
    }
    // gable mats above the side walls are part of the wallRun; ridge roll
    const ridgeRoll = place(new THREE.CylinderGeometry(0.16, 0.16, w + 1.1, 14, 1), [0, ridge + 0.1, 0], [0, 0, Math.PI / 2]);
    roof.push(ridgeRoll);
    // dark interior seen through the door
    const interior = place(new THREE.PlaneGeometry(door.x1 - door.x0, door.h), [0, door.h / 2, d / 2 - 0.25]);

    // shaded majlis in front: posts + areesh slat roof
    const mz = d / 2 + 2.3;
    const sw = 4.2;
    const sd = 2.9;
    const sh = 2.35;
    const shade: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) shade.push(rod(new THREE.Vector3(sx * sw * 0.5, -0.3, mz + sz * sd * 0.5), new THREE.Vector3(sx * sw * 0.5, sh, mz + sz * sd * 0.5), 0.065, 0.055, 8));
    for (const sz of [-1, 1]) shade.push(rod(new THREE.Vector3(-sw / 2 - 0.2, sh, mz + sz * sd * 0.5), new THREE.Vector3(sw / 2 + 0.2, sh, mz + sz * sd * 0.5), 0.06, 0.06, 7));
    const slats: THREE.BufferGeometry[] = [];
    for (let x = -sw / 2 - 0.15; x <= sw / 2 + 0.15; x += 0.07) slats.push(rod(new THREE.Vector3(x, sh + 0.08, mz - sd / 2 - 0.3), new THREE.Vector3(x + (r() - 0.5) * 0.05, sh + 0.08, mz + sd / 2 + 0.3), 0.02, 0.016, 5));

    // clay water jar (jahla) on a three-legged stand
    const jar = place(
      smoothLathe(
        [
          [0.001, 0],
          [0.12, 0.02],
          [0.24, 0.16],
          [0.27, 0.32],
          [0.22, 0.48],
          [0.11, 0.58],
          [0.09, 0.64],
          [0.11, 0.68],
          [0.001, 0.66],
        ],
        32,
        40,
      ).clone(),
      [w / 2 + 0.55, 0.55, d / 2 + 0.5],
    );
    const stand: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      stand.push(rod(new THREE.Vector3(w / 2 + 0.55 + Math.cos(a) * 0.32, 0, d / 2 + 0.5 + Math.sin(a) * 0.32), new THREE.Vector3(w / 2 + 0.55 + Math.cos(a) * 0.2, 0.62, d / 2 + 0.5 + Math.sin(a) * 0.2), 0.025, 0.022, 5));
    }
    stand.push(place(new THREE.TorusGeometry(0.21, 0.02, 5, 20), [w / 2 + 0.55, 0.6, d / 2 + 0.5], [Math.PI / 2, 0, 0]));
    const bench = mergeAll([place(box(1.6, 0.06, 0.4, 0.02, 0.6), [-w / 2 - 0.2, 0.42, d / 2 + 0.6]), place(box(0.07, 0.42, 0.36, 0.02, 0.6), [-w / 2 - 0.9, 0.21, d / 2 + 0.6]), place(box(0.07, 0.42, 0.36, 0.02, 0.6), [-w / 2 + 0.5, 0.21, d / 2 + 0.6])]);

    const T = tint;
    return {
      thatch: mergeAll([...mats, ...roof]),
      matte: mergeAll([T(mergeAll(ribs), PAL.frond), T(interior, PAL.dark), T(mergeAll(slats), PAL.frondDark), T(jar, PAL.terracotta)], true),
      timber: mergeAll([T(mergeAll([...poles, ...shade]), PAL.pole), T(mergeAll(stand), PAL.timber), T(bench, PAL.timber)], true),
      mz,
      sh,
    };
  }, [quality]);
}

export function Hut({ m, quality, lit }: { m: HarbourMaterials; quality: Quality; lit: boolean }) {
  const p = useHutParts(quality);
  const y = groundHeight(HUT.x, HUT.z) - 0.03;
  const seats = useMemo<MajlisSpec[]>(
    () => [
      { position: [0, 0.02, p.mz - 0.75], length: 3.2, colorIndex: 1 },
      { position: [-1.55, 0.02, p.mz + 0.25], length: 1.6, rotation: Math.PI / 2, colorIndex: 3 },
    ],
    [p.mz],
  );
  const rugs = useMemo<RugSpec[]>(() => [{ position: [0, 0.03, p.mz], size: [3.4, 2.2] }], [p.mz]);
  const trays = useMemo(() => [{ position: [0.3, 0.04, p.mz + 0.15] as Vec3 }], [p.mz]);
  return (
    <group position={[HUT.x, y, HUT.z]} rotation={[0, HUT.yaw, 0]}>
      <mesh geometry={p.thatch} material={m.thatch} castShadow receiveShadow />
      <mesh geometry={p.matte} material={m.matte} castShadow receiveShadow />
      <mesh geometry={p.timber} material={m.timber} castShadow receiveShadow />
      <MajlisSet m={m} seats={seats} rugs={rugs} trays={trays} />
      <Lantern position={[1.6, p.sh - 0.55, p.mz + 1.2]} scale={1.1} lit={lit} light={lit} hanging />
    </group>
  );
}
