import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getTexSet, repeatSet } from '../../materials/textures';
import type { Vec3 } from '../../core/types';
import { latheSimple, rand } from './geometry';
import { COURT, FY, TABLE } from './layout';
import type { PotteryMaterials } from './materials';
import { Instances, Slab, type InstanceSpec } from './parts';

/* ------------------------------------------------------------------ */
/*  Lived-in details: a sun-faded Al Sadu rug under the class table    */
/*  and planted pots (aloe rosettes) framing the open front.           */
/* ------------------------------------------------------------------ */

/** A rosette of stiff, upturned leaves (aloe / agave) as one merged geometry. */
function rosetteGeometry(seed: number) {
  const r = rand(seed);
  const parts: THREE.BufferGeometry[] = [];
  const n = 18;
  for (let i = 0; i < n; i++) {
    const len = 0.42 + r() * 0.3;
    const blade = new THREE.ConeGeometry(0.045, len, 4, 3);
    blade.scale(1, 1, 0.35);
    // bend the blade outwards along its length
    const p = blade.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) {
      const y = p.getY(k) + len / 2;
      p.setZ(k, p.getZ(k) + (y / len) * (y / len) * 0.18);
    }
    blade.translate(0, len / 2, 0);
    const tilt = 0.25 + (i / n) * 0.75 + r() * 0.15;
    blade.rotateX(tilt);
    blade.rotateY((i / n) * Math.PI * 2 * 2.618);
    parts.push(blade.toNonIndexed());
  }
  const g = mergeGeometries(parts, false);
  g.computeVertexNormals();
  return g;
}

export function Details({ m }: { m: PotteryMaterials }) {
  const rug = useMemo(() => {
    const sadu = repeatSet(getTexSet('sadu'), 2.6, 1.3);
    // sun-faded, dusty with clay: muted rather than showroom-bright
    return new THREE.MeshStandardMaterial({ ...sadu, color: '#B9A896', roughness: 1, normalScale: new THREE.Vector2(0.6, 0.6) });
  }, []);
  const RW = TABLE.l + 0.9;
  const RD = TABLE.w + 1.5;
  const fringe = useMemo(() => {
    const out: InstanceSpec[] = [];
    for (const side of [-1, 1])
      for (let i = 0; i < Math.round(RD / 0.035); i++) {
        const z = TABLE.z - RD / 2 + 0.02 + i * 0.035;
        out.push({ p: [TABLE.x + side * (RW / 2 + 0.035), FY + 0.004, z + Math.sin(i * 7.1) * 0.004], r: [0, Math.sin(i * 3.3) * 0.25, Math.PI / 2], s: [1, 1 + Math.sin(i * 5.7) * 0.25, 1] });
      }
    return out;
  }, [RW, RD]);
  const fringeGeo = useMemo(() => new THREE.CylinderGeometry(0.004, 0.003, 0.07, 4), []);
  const binding = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4A1814', roughness: 1 }), []);
  const wool = useMemo(() => new THREE.MeshStandardMaterial({ color: '#D6C8AE', roughness: 1 }), []);
  const plant = useMemo(() => rosetteGeometry(4), []);
  const plantMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5F7A4E', roughness: 0.62, flatShading: false }), []);
  const pot = useMemo(
    () =>
      latheSimple(
        [
          [0.0005, 0.02],
          [0.15, 0.02],
          [0.17, 0.0],
          [0.25, 0.1],
          [0.28, 0.34],
          [0.27, 0.42],
          [0.29, 0.45],
          [0.28, 0.48],
          [0.25, 0.46],
          [0.0005, 0.4],
        ],
        { segments: 48, uvDensity: 4 },
      ),
    [],
  );
  // on the lane, flanking the open front (clear of the steps)
  const pots: Vec3[] = [
    [COURT.x0 - 0.25, 0.08, COURT.z1 + 0.56],
    [COURT.x1 + 0.22, 0.08, COURT.z1 + 0.56],
  ];
  return (
    <group>
      {/* Al Sadu rug under the class table */}
      <mesh position={[TABLE.x, FY + 0.006, TABLE.z]} rotation={[-Math.PI / 2, 0, 0]} material={rug} receiveShadow>
        <planeGeometry args={[RW, RD]} />
      </mesh>
      {/* bound edges and knotted fringes */}
      {[-1, 1].map((s) => (
        <Slab key={`l${s}`} mat={binding} position={[TABLE.x, FY + 0.004, TABLE.z + s * (RD / 2 - 0.012)]} size={[RW, 0.008, 0.028]} r={0.003} cast={false} />
      ))}
      {[-1, 1].map((s) => (
        <Slab key={`w${s}`} mat={binding} position={[TABLE.x + s * (RW / 2 - 0.006), FY + 0.004, TABLE.z]} size={[0.016, 0.008, RD]} r={0.003} cast={false} />
      ))}
      <Instances geometry={fringeGeo} material={wool} items={fringe} cast={false} />
      {/* planted pots framing the open front */}
      {pots.map((p, i) => (
        <group key={i} position={p} rotation={[0, i * 1.3, 0]} scale={0.8}>
          <mesh geometry={pot} material={m.terracotta} castShadow receiveShadow />
          <mesh position={[0, 0.41, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.clayDry} receiveShadow>
            <circleGeometry args={[0.25, 28]} />
          </mesh>
          <mesh geometry={plant} material={plantMat} position={[0, 0.4, 0]} castShadow receiveShadow />
        </group>
      ))}
    </group>
  );
}
