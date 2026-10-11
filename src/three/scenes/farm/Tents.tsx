import { useMemo } from 'react';
import * as THREE from 'three';
import { Lantern } from '../../props/Decor';
import { boxProjectUVs, roundedBox } from '../../props/geo';
import type { Vec3 } from '../../core/types';
import type { FarmMaterials } from './materials';

/** Glamping tents among the palms (provider feature `tents`). */
export const TENT_SPOTS: { p: Vec3; r: number }[] = [
  { p: [-20.2, 0, 11.6], r: 0.5 },
  { p: [-13.2, 0, 13.2], r: -0.4 },
  { p: [-17.6, 0, 18.4], r: 0.9 },
];

export function Tents({ m, lit }: { m: FarmMaterials; lit: boolean }) {
  const deck = useMemo(() => boxProjectUVs(roundedBox(4.6, 0.18, 4.6, 0.04, 2).clone(), 0.6), []);
  const spots = TENT_SPOTS;
  return (
    <group>
      {spots.map((s, i) => (
        <group key={i} position={s.p} rotation={[0, s.r, 0]}>
          <mesh geometry={deck} material={m.woodLight} position={[0, 0.09, 0]} castShadow receiveShadow />
          <mesh position={[0, 0.95, 0]} castShadow receiveShadow material={m.canvas}>
            <cylinderGeometry args={[2.1, 2.1, 1.5, 48, 1, true]} />
          </mesh>
          <mesh position={[0, 2.55, 0]} castShadow receiveShadow material={m.canvas}>
            <coneGeometry args={[2.25, 1.75, 48, 4, true]} />
          </mesh>
          <mesh position={[0, 3.55, 0]} castShadow material={m.woodDark}>
            <cylinderGeometry args={[0.04, 0.04, 0.5, 8]} />
          </mesh>
          {/* door flap */}
          <mesh position={[0, 0.95, 2.11]}>
            <planeGeometry args={[1, 1.5]} />
            <meshStandardMaterial color="#2b2119" emissive="#ffae5c" emissiveIntensity={lit ? 1.6 : 0} roughness={1} />
          </mesh>
          {/* guy ropes */}
          {Array.from({ length: 8 }).map((_, k) => {
            const a = (k / 8) * Math.PI * 2;
            const from = new THREE.Vector3(Math.cos(a) * 2.15, 1.7, Math.sin(a) * 2.15);
            const to = new THREE.Vector3(Math.cos(a) * 3.3, 0.02, Math.sin(a) * 3.3);
            const mid = from.clone().lerp(to, 0.5);
            const len = from.distanceTo(to);
            const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
            return (
              <mesh key={k} position={mid} quaternion={q}>
                <cylinderGeometry args={[0.008, 0.008, len, 4]} />
                <meshStandardMaterial color="#d8cbb0" />
              </mesh>
            );
          })}
          <Lantern position={[1.1, 0.18, 2.4]} lit={lit} light={lit && i === 0} />
        </group>
      ))}
    </group>
  );
}
