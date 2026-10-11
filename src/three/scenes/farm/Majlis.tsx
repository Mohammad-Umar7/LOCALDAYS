import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CoffeeTray, Lantern, MajlisSeating, Rug } from '../../props/Decor';
import { boxProjectUVs, roundedBox } from '../../props/geo';
import { MAJLIS, rng } from './layout';
import { trunkPostGeometry, type FarmMaterials } from './materials';

/* ------------------------------------------------------------------ */
/*  Outdoor majlis beside the farmhouse: a low plastered dakka under   */
/*  an areesh (palm-frond) canopy on palm-trunk posts, a barasti wind  */
/*  screen, Sadu seating on three sides, coffee and a hanging lantern. */
/*  Everything reuses shared materials, so it batches into existing    */
/*  draw calls.                                                        */
/* ------------------------------------------------------------------ */

function merge(list: THREE.BufferGeometry[]) {
  const g = mergeGeometries(
    list.map((x) => (x.index ? x.toNonIndexed() : x)),
    false,
  );
  list.forEach((x) => x.dispose());
  return g!;
}

export function OutdoorMajlis({ m, lit }: { m: FarmMaterials; lit: boolean }) {
  const { x, z, w, d } = MAJLIS;
  const H = 2.55;
  const geos = useMemo(() => {
    const r = rng(5);
    const posts: THREE.BufferGeometry[] = [];
    const beams: THREE.BufferGeometry[] = [];
    const fronds: THREE.BufferGeometry[] = [];
    const plinth: THREE.BufferGeometry[] = [];
    // posts: palm trunks, slightly irregular
    for (const px of [-w / 2 + 0.15, 0, w / 2 - 0.15])
      for (const pz of [-d / 2 + 0.15, d / 2 - 0.15]) {
        const g = trunkPostGeometry(0.15, 0.13, H + 0.12 - (pz < 0 ? 0 : 0.12), 10);
        g.rotateZ((r() - 0.5) * 0.03);
        g.translate(px, 0, pz);
        posts.push(g);
      }
    // beams along x, rafters along z
    for (const pz of [-d / 2 + 0.15, d / 2 - 0.15]) {
      const g = boxProjectUVs(roundedBox(w + 0.5, 0.14, 0.14, 0.03, 1).clone(), 0.6);
      g.translate(0, (pz < 0 ? H + 0.12 : H) + 0.07, pz);
      beams.push(g);
    }
    const slope = Math.atan2(0.12, d - 0.3);
    for (let k = 0; k <= 5; k++) {
      const g = boxProjectUVs(roundedBox(0.09, 0.1, d + 0.5, 0.02, 1).clone(), 0.6);
      g.rotateX(slope);
      g.translate(-w / 2 - 0.1 + (k * (w + 0.2)) / 5, H + 0.2, 0);
      beams.push(g);
    }
    // areesh: tight frond slats across the rafters, plus a ragged frond fringe at the front
    for (let px = -w / 2 - 0.25; px <= w / 2 + 0.25; px += 0.075) {
      const s = new THREE.BoxGeometry(0.06, 0.02, d + 0.65 + (r() - 0.5) * 0.15);
      s.rotateX(slope);
      s.rotateY((r() - 0.5) * 0.03);
      s.translate(px, H + 0.27 + r() * 0.015, (r() - 0.5) * 0.06);
      fronds.push(s);
    }
    for (let px = -w / 2 - 0.2; px <= w / 2 + 0.2; px += 0.05) {
      const len = 0.18 + r() * 0.22;
      const s = new THREE.BoxGeometry(0.018, len, 0.006);
      s.translate(0, -len / 2, 0);
      s.rotateX(0.25 + r() * 0.3);
      s.rotateZ((r() - 0.5) * 0.3);
      s.translate(px, H + 0.25, d / 2 + 0.32);
      fronds.push(s);
    }
    // barasti wind screen on the north side
    const n = Math.floor((w + 0.2) / 0.05);
    for (let i = 0; i < n; i++) {
      const hh = H * (0.94 + r() * 0.08);
      const s = new THREE.BoxGeometry(0.024, hh, 0.018);
      s.translate(-w / 2 - 0.1 + (i + 0.5) * 0.05, hh / 2 + 0.2, -d / 2 + 0.05);
      s.rotateZ((r() - 0.5) * 0.004);
      fronds.push(s);
    }
    for (const y of [0.55, 1.4, 2.25]) {
      const g = boxProjectUVs(roundedBox(w + 0.2, 0.06, 0.05, 0.015, 1).clone(), 0.6);
      g.translate(0, y, -d / 2 + 0.09);
      beams.push(g);
    }
    // dakka: low plastered platform with a step
    const p1 = boxProjectUVs(roundedBox(w + 0.5, 0.2, d + 0.3, 0.05, 2).clone(), 0.5);
    p1.translate(0, 0.1, 0.05);
    plinth.push(p1);
    const p2 = boxProjectUVs(roundedBox(1.6, 0.1, 0.45, 0.03, 1).clone(), 0.5);
    p2.translate(0.4, 0.05, d / 2 + 0.38);
    plinth.push(p2);
    return { posts: merge(posts), beams: merge(beams), fronds: merge(fronds), plinth: merge(plinth) };
  }, [w, d]);

  const pot = useMemo(() => new THREE.CylinderGeometry(0.3, 0.22, 0.55, 20), []);
  const shrub = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(0.42, 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const k = 1 + Math.sin(p.getX(i) * 13) * 0.08 + Math.sin(p.getY(i) * 17 + p.getZ(i) * 9) * 0.08;
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 1.15, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    return g;
  }, []);

  const y0 = 0.2;
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={geos.plinth} material={m.plasterLight} castShadow receiveShadow />
      <mesh geometry={geos.posts} material={m.palmTrunk} castShadow receiveShadow />
      <mesh geometry={geos.beams} material={m.woodDark} castShadow receiveShadow />
      <mesh geometry={geos.fronds} material={m.frond} castShadow receiveShadow />
      <Rug position={[0, y0 + 0.012, 0.15]} size={[3.2, 4.2]} rotation={Math.PI / 2} />
      <MajlisSeating position={[0, y0, -d / 2 + 0.62]} length={4.2} colorIndex={1} />
      <MajlisSeating position={[-w / 2 + 0.55, y0, 0.55]} length={2.8} rotation={Math.PI / 2} colorIndex={3} />
      <MajlisSeating position={[w / 2 - 0.55, y0, 0.55]} length={2.8} rotation={-Math.PI / 2} colorIndex={0} />
      <CoffeeTray position={[0.1, y0 + 0.02, 0.2]} rotation={-0.5} />
      <Lantern position={[0, H - 0.75, 0.2]} hanging lit={lit} light={lit} />
      <Lantern position={[w / 2 - 0.45, y0, d / 2 - 0.35]} scale={0.8} lit={lit} />
      {(
        [
          [-w / 2 - 0.3, d / 2 + 0.35, '#4C6B37'],
          [w / 2 + 0.35, d / 2 + 0.3, '#C2387A'],
        ] as [number, number, string][]
      ).map(([px, pz, c]) => (
        <group key={px} position={[px, 0, pz]}>
          <mesh geometry={pot} material={m.terracotta} position={[0, 0.28, 0]} castShadow receiveShadow />
          <mesh geometry={shrub} position={[0, 0.88, 0]} castShadow>
            <meshStandardMaterial color={c} roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
