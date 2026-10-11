import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getTexSet, repeatSet } from '../../materials/textures';
import { boxProjectUVs, roundedBox, smoothLathe } from '../../props/geo';
import { Lantern, StringLights } from '../../props/Decor';
import type { FarmMaterials } from './materials';
import type { Vec3 } from '../../core/types';

/* ------------------------------------------------------------------ */
/*  Farm-to-table dining pergola: palm-frond (areesh) roof that casts  */
/*  dappled light, a long table set for twelve, string lights,         */
/*  lanterns and a clay bread oven.                                     */
/* ------------------------------------------------------------------ */

export const DINING = { x: -2, z: 13.2, l: 9.4, w: 4.4, h: 2.95 };

function chairGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0) => {
    const c = g.clone();
    if (rx) c.rotateX(rx);
    c.translate(x, y, z);
    parts.push(c);
  };
  add(roundedBox(0.46, 0.05, 0.44, 0.015, 2), 0, 0.46, 0);
  for (const [x, z] of [
    [-0.2, -0.19],
    [0.2, -0.19],
    [-0.2, 0.19],
    [0.2, 0.19],
  ])
    add(new THREE.CylinderGeometry(0.02, 0.018, 0.46, 8), x, 0.23, z);
  add(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), -0.2, 0.72, -0.2, -0.08);
  add(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), 0.2, 0.72, -0.2, -0.08);
  for (const y of [0.66, 0.8, 0.93]) add(roundedBox(0.42, 0.05, 0.025, 0.01, 2), 0, y, -0.215);
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()), false);
  boxProjectUVs(g, 1.5);
  return g;
}

export function Dining({ m, lit }: { m: FarmMaterials; lit: boolean }) {
  const { x, z, l, w, h } = DINING;
  const slatRef = useRef<THREE.InstancedMesh>(null);
  const chairRef = useRef<THREE.InstancedMesh>(null);
  const plateRef = useRef<THREE.InstancedMesh>(null);
  const cupRef = useRef<THREE.InstancedMesh>(null);

  const postGeo = useMemo(() => boxProjectUVs(roundedBox(0.2, h, 0.2, 0.03, 2).clone(), 0.6), [h]);
  const beamGeo = useMemo(() => boxProjectUVs(roundedBox(l + 0.6, 0.2, 0.16, 0.03, 2).clone(), 0.6), [l]);
  const rafterGeo = useMemo(() => boxProjectUVs(roundedBox(0.12, 0.14, w + 0.6, 0.02, 2).clone(), 0.6), [w]);
  const slatGeo = useMemo(() => new THREE.BoxGeometry(0.055, 0.03, w + 0.5), [w]);
  const chairGeo = useMemo(() => chairGeometry(), []);
  const plateGeo = useMemo(() => smoothLathe([[0.001, 0], [0.09, 0.0], [0.11, 0.008], [0.13, 0.022], [0.128, 0.026], [0.1, 0.014], [0.001, 0.01]], 32, 12), []);
  const cupGeo = useMemo(() => smoothLathe([[0.001, 0], [0.025, 0], [0.033, 0.05], [0.036, 0.095], [0.033, 0.096], [0.03, 0.05], [0.001, 0.008]], 16, 12), []);
  const platterGeo = useMemo(() => smoothLathe([[0.001, 0], [0.22, 0.0], [0.28, 0.03], [0.32, 0.05], [0.31, 0.055], [0.26, 0.035], [0.001, 0.03]], 40, 16), []);
  const runner = useMemo(() => repeatSet(getTexSet('sadu'), 4, 0.5), []);

  const slats = useMemo(() => {
    const n = Math.round((l + 0.4) / 0.13);
    return Array.from({ length: n }, (_, i) => x - l / 2 - 0.2 + i * 0.13);
  }, [x, l]);

  const seats = useMemo(() => {
    const out: { p: Vec3; r: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const cx = x - 3 + i * 1.2;
      out.push({ p: [cx, 0, z - 0.85], r: 0 });
      out.push({ p: [cx, 0, z + 0.85], r: Math.PI });
    }
    out.push({ p: [x - 4.1, 0, z], r: Math.PI / 2 });
    out.push({ p: [x + 4.1, 0, z], r: -Math.PI / 2 });
    return out;
  }, [x, z]);

  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const s = slatRef.current;
    if (s) {
      slats.forEach((sx, i) => {
        o.position.set(sx, h + 0.24, z);
        o.rotation.set(0, (Math.sin(i * 7.3) * 0.04), 0);
        o.updateMatrix();
        s.setMatrixAt(i, o.matrix);
      });
      s.instanceMatrix.needsUpdate = true;
      s.computeBoundingSphere();
    }
    const c = chairRef.current;
    if (c) {
      seats.forEach((st, i) => {
        o.position.set(...st.p);
        o.rotation.set(0, st.r + Math.sin(i * 3.1) * 0.06, 0);
        o.updateMatrix();
        c.setMatrixAt(i, o.matrix);
      });
      c.instanceMatrix.needsUpdate = true;
      c.computeBoundingSphere();
    }
    const p = plateRef.current;
    const cu = cupRef.current;
    if (p && cu) {
      seats.slice(0, 12).forEach((st, i) => {
        const dz = st.p[2] < z ? 0.3 : -0.3;
        o.position.set(st.p[0], 0.79, z + dz * 0 + (st.p[2] < z ? -0.3 : 0.3));
        o.rotation.set(0, 0, 0);
        o.updateMatrix();
        p.setMatrixAt(i, o.matrix);
        o.position.set(st.p[0] + 0.22, 0.79, z + (st.p[2] < z ? -0.18 : 0.18));
        o.updateMatrix();
        cu.setMatrixAt(i, o.matrix);
      });
      p.instanceMatrix.needsUpdate = true;
      cu.instanceMatrix.needsUpdate = true;
      p.computeBoundingSphere();
      cu.computeBoundingSphere();
    }
  }, [slats, seats, h, z]);

  const posts: Vec3[] = [
    [x - l / 2, h / 2, z - w / 2],
    [x, h / 2, z - w / 2],
    [x + l / 2, h / 2, z - w / 2],
    [x - l / 2, h / 2, z + w / 2],
    [x, h / 2, z + w / 2],
    [x + l / 2, h / 2, z + w / 2],
  ];

  return (
    <group>
      {/* Pergola structure */}
      {posts.map((p, i) => (
        <mesh key={i} geometry={postGeo} material={m.woodGrey} position={p} castShadow receiveShadow />
      ))}
      <mesh geometry={beamGeo} material={m.woodGrey} position={[x, h + 0.02, z - w / 2]} castShadow />
      <mesh geometry={beamGeo} material={m.woodGrey} position={[x, h + 0.02, z + w / 2]} castShadow />
      {[-l / 2, -l / 4, 0, l / 4, l / 2].map((dx) => (
        <mesh key={dx} geometry={rafterGeo} material={m.woodGrey} position={[x + dx, h + 0.15, z]} castShadow />
      ))}
      {/* areesh slats — cast dappled shade */}
      <instancedMesh ref={slatRef} args={[slatGeo, m.frond, slats.length]} castShadow receiveShadow />

      {/* Floor: compacted earth + rug runner */}
      <mesh position={[x, 0.015, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[l + 0.6, w + 0.6]} />
        <primitive object={m.stone} attach="material" />
      </mesh>

      {/* Long table */}
      <mesh geometry={useMemo(() => boxProjectUVs(roundedBox(7.6, 0.07, 1.05, 0.025, 2).clone(), 0.6), [])} material={m.woodLight} position={[x, 0.76, z]} castShadow receiveShadow />
      {[-3.5, -1.2, 1.2, 3.5].map((dx) => (
        <group key={dx}>
          <mesh position={[x + dx, 0.37, z - 0.4]} castShadow material={m.woodLight}>
            <boxGeometry args={[0.08, 0.74, 0.08]} />
          </mesh>
          <mesh position={[x + dx, 0.37, z + 0.4]} castShadow material={m.woodLight}>
            <boxGeometry args={[0.08, 0.74, 0.08]} />
          </mesh>
        </group>
      ))}
      <mesh position={[x, 0.797, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[7.2, 0.38]} />
        <meshStandardMaterial {...runner} roughness={1} />
      </mesh>

      {/* Chairs */}
      <instancedMesh ref={chairRef} args={[chairGeo, m.woodLight, seats.length]} castShadow receiveShadow />

      {/* Place settings */}
      <instancedMesh ref={plateRef} args={[plateGeo, m.ceramic, 12]} castShadow receiveShadow />
      <instancedMesh ref={cupRef} args={[cupGeo, m.glass, 12]} />

      {/* Sharing platters down the centre */}
      {[-2.4, 0, 2.4].map((dx, i) => (
        <group key={dx} position={[x + dx, 0.8, z]}>
          <mesh geometry={platterGeo} material={m.ceramic} castShadow />
          <mesh position={[0, 0.045, 0]} scale={[1, 0.38, 1]} castShadow>
            <sphereGeometry args={[0.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={i === 1 ? '#D9A43C' : '#E2BD62'} roughness={0.85} />
          </mesh>
          {i !== 1 &&
            Array.from({ length: 7 }).map((_, k) => (
              <mesh key={k} position={[Math.cos(k * 0.9) * 0.12, 0.1, Math.sin(k * 0.9) * 0.12]} scale={[0.05, 0.035, 0.04]} castShadow>
                <sphereGeometry args={[1, 10, 8]} />
                <meshStandardMaterial color="#7A3A1E" roughness={0.6} />
              </mesh>
            ))}
        </group>
      ))}
      {[-1.2, 1.2].map((dx) => (
        <group key={dx} position={[x + dx, 0.8, z]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.13, 0.09, 0.07, 32]} />
            <primitive object={m.ceramic} attach="material" />
          </mesh>
          {Array.from({ length: 6 }).map((_, k) => (
            <mesh key={k} position={[Math.cos(k) * 0.06, 0.07, Math.sin(k) * 0.06]} scale={0.04} castShadow>
              <sphereGeometry args={[1, 10, 8]} />
              <meshPhysicalMaterial color={k % 2 ? '#C8321E' : '#E2A12A'} roughness={0.3} clearcoat={0.5} />
            </mesh>
          ))}
        </group>
      ))}
      {[-3.3, -0.6, 0.6, 3.3].map((dx) => (
        <Lantern key={dx} position={[x + dx, 0.8, z]} scale={0.7} lit={lit} light={lit && Math.abs(dx) < 1} />
      ))}

      {/* String lights zig-zag under the roof */}
      <StringLights
        lit={lit}
        sag={0.28}
        bulbs={9}
        points={[
          [x - l / 2, h - 0.1, z - w / 2],
          [x - l / 4, h - 0.1, z + w / 2],
          [x, h - 0.1, z - w / 2],
          [x + l / 4, h - 0.1, z + w / 2],
          [x + l / 2, h - 0.1, z - w / 2],
        ]}
      />

      {/* Clay bread oven (taboon) */}
      <group position={[x + 6.1, 0, z - 0.6]}>
        <mesh position={[0, 0.35, 0]} castShadow receiveShadow geometry={useMemo(() => boxProjectUVs(roundedBox(1.5, 0.7, 1.5, 0.08, 3).clone(), 0.6), [])}>
          <primitive object={m.plaster} attach="material" />
        </mesh>
        <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
          <sphereGeometry args={[0.62, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <primitive object={m.terracotta} attach="material" />
        </mesh>
        <mesh position={[0, 0.88, 0.5]} rotation={[0.1, 0, 0]}>
          <circleGeometry args={[0.2, 24, 0, Math.PI]} />
          <meshStandardMaterial color="#1a0e08" emissive="#ff5a14" emissiveIntensity={lit ? 2.2 : 0.4} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 1.38, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.1, 0.24, 16]} />
          <primitive object={m.terracotta} attach="material" />
        </mesh>
      </group>
    </group>
  );
}
