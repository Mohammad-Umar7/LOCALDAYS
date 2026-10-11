import { useMemo } from 'react';
import * as THREE from 'three';
import { roundedBox, sagCurve, tubeAlong } from '../../props/geo';
import type { Vec3 } from '../../core/types';
import { latheSimple, rand } from './geometry';
import { COURT, DOOR, FY, PREP } from './layout';
import type { PotteryMaterials } from './materials';
import { Slab } from './parts';
import { Vessel } from './Vessels';

/* ------------------------------------------------------------------ */
/*  Clay preparation: a heavy wedging table (cast-plaster top, half    */
/*  covered in stained canvas), clay blocks and bags, portioned balls  */
/*  for the class, wire cutter, ribs, reclaim tubs and slip bucket.    */
/* ------------------------------------------------------------------ */

const PALLET_Z = COURT.z1 - 0.5;
/** reclaim tub between the doorway and the wedging table */
const TUB_Z = (DOOR.z + DOOR.w / 2 + PREP.z - 1.0) / 2;
const T = { x0: COURT.x0 + 0.06, x1: COURT.x0 + 0.98, z0: PREP.z - 1.0, z1: PREP.z + 1.0, top: FY + 0.82 };

function useClayShapes() {
  return useMemo(() => {
    // wedged "ram's head" lump: squashed sphere with a pinched spiral fold
    const ram = new THREE.SphereGeometry(0.1, 28, 18);
    const p = ram.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const a = Math.atan2(z, x);
      const fold = Math.exp(-((a - 0.4) ** 2) * 6) * 0.018;
      p.setXYZ(i, x * 1.35 * (1 - fold * 4), Math.max(-0.07, y * 0.78) + 0.07, z * 1.0 - fold);
    }
    ram.computeVertexNormals();
    const ball = new THREE.SphereGeometry(0.046, 20, 14);
    ball.scale(1, 0.86, 1);
    ball.translate(0, 0.038, 0);
    const block = roundedBox(0.26, 0.16, 0.18, 0.025, 3);
    const halfBlock = roundedBox(0.12, 0.16, 0.18, 0.012, 3);
    const bag = roundedBox(0.36, 0.2, 0.26, 0.06, 4);
    const knot = new THREE.ConeGeometry(0.035, 0.08, 10);
    const toggle = new THREE.CylinderGeometry(0.014, 0.014, 0.1, 10);
    toggle.rotateZ(Math.PI / 2);
    const wire = tubeAlong(sagCurve(new THREE.Vector3(-0.3, 0.012, 0), new THREE.Vector3(0.3, 0.012, 0), -0.0, 12), 0.0016, 4);
    const rib = new THREE.CylinderGeometry(0.06, 0.06, 0.004, 28);
    rib.scale(1.4, 1, 0.75);
    const tub = latheSimple(
      [
        [0.0005, 0.01],
        [0.24, 0.01],
        [0.25, 0.0],
        [0.29, 0.5],
        [0.3, 0.52],
        [0.29, 0.53],
        [0.276, 0.5],
        [0.236, 0.024],
        [0.0005, 0.024],
      ],
      { segments: 44 },
    );
    const tubLid = latheSimple(
      [
        [0.0005, 0.03],
        [0.27, 0.025],
        [0.305, 0.012],
        [0.31, -0.02],
        [0.295, -0.02],
        [0.29, 0.0],
        [0.0005, 0.012],
      ],
      { segments: 44 },
    );
    const slurry = new THREE.CircleGeometry(0.28, 36);
    slurry.rotateX(-Math.PI / 2);
    // uneven slurry surface
    const sp = slurry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < sp.count; i++) sp.setY(i, Math.sin(sp.getX(i) * 31) * 0.004 + Math.cos(sp.getZ(i) * 23) * 0.004);
    slurry.computeVertexNormals();
    return { ram, ball, block, halfBlock, bag, knot, toggle, wire, rib, tub, tubLid, slurry };
  }, []);
}

export function Prep({ m }: { m: PotteryMaterials }) {
  const g = useClayShapes();
  const cx = (T.x0 + T.x1) / 2;
  const cz = PREP.z;
  const balls = useMemo(() => Array.from({ length: 8 }, (_, i) => [cx + 0.2 + (i % 2) * 0.11, T.top + 0.03, cz - 0.95 + 0.2 + Math.floor(i / 2) * 0.11] as Vec3), [cx, cz]);
  const bagStack = useMemo(() => {
    const r = rand(3);
    const out: { p: Vec3; r: number }[] = [];
    for (let layer = 0; layer < 3; layer++)
      for (let k = 0; k < (layer === 2 ? 2 : 3); k++)
        out.push({ p: [COURT.x0 + 0.42 + (k % 2) * 0.3 + (r() - 0.5) * 0.04, FY + 0.12 + 0.1 + layer * 0.2, PALLET_Z - 0.15 + Math.floor(k / 2) * 0.3 * (layer === 2 ? 0 : 1) + (r() - 0.5) * 0.04], r: (r() - 0.5) * 0.25 + ((layer % 2) * Math.PI) / 2 });
    return out;
  }, []);
  return (
    <group>
      {/* frame */}
      {[T.x0 + 0.06, T.x1 - 0.06].map((x) =>
        [T.z0 + 0.06, T.z1 - 0.06].map((z) => <Slab key={`${x}:${z}`} mat={m.woodTurned} position={[x, FY + (T.top - FY - 0.1) / 2, z]} size={[0.1, T.top - FY - 0.1, 0.1]} r={0.012} />),
      )}
      <Slab mat={m.woodWorn} position={[cx, FY + 0.16, cz]} size={[T.x1 - T.x0 - 0.04, 0.035, T.z1 - T.z0 - 0.04]} r={0.008} uv={1.2} />
      <Slab mat={m.woodWorn} position={[T.x1 - 0.03, T.top - 0.12, cz]} size={[0.05, 0.1, T.z1 - T.z0]} r={0.01} uv={1.2} />
      {/* cast plaster slab in a timber surround, canvas over half */}
      <Slab mat={m.woodWorn} position={[cx, T.top - 0.05, cz]} size={[T.x1 - T.x0, 0.1, T.z1 - T.z0]} r={0.015} uv={1.2} />
      <Slab mat={m.limestone} position={[cx, T.top + 0.004, cz - 0.42]} size={[T.x1 - T.x0 - 0.12, 0.012, 0.98]} r={0.004} cast={false} />
      <Slab mat={m.canvas} position={[cx, T.top + 0.006, cz + 0.5]} size={[T.x1 - T.x0 - 0.06, 0.012, 0.92]} r={0.004} cast={false} uv={2.5} />
      <Slab mat={m.canvas} position={[T.x1 + 0.0, T.top - 0.04, cz + 0.5]} size={[0.012, 0.09, 0.92]} r={0.004} cast={false} uv={2.5} />
      {/* clay on the table */}
      <mesh geometry={g.block} material={m.clayBlock} position={[cx - 0.12, T.top + 0.09, cz + 0.62]} rotation={[0, 0.2, 0]} castShadow receiveShadow />
      <mesh geometry={g.block} material={m.clayBlock} position={[cx - 0.14, T.top + 0.25, cz + 0.6]} rotation={[0, -0.1, 0]} castShadow receiveShadow />
      <mesh geometry={g.halfBlock} material={m.clayBlock} position={[cx + 0.18, T.top + 0.09, cz + 0.72]} rotation={[0, 0.5, 0]} castShadow receiveShadow />
      <mesh geometry={g.ram} material={m.clayBlock} position={[cx + 0.05, T.top + 0.01, cz + 0.2]} rotation={[0, 1.2, 0]} castShadow receiveShadow />
      {balls.map((p, i) => (
        <mesh key={i} geometry={g.ball} material={m.clayBlock} position={p} rotation={[0, i, 0]} castShadow receiveShadow />
      ))}
      {/* wire cutter */}
      <group position={[cx - 0.1, T.top + 0.006, cz - 0.15]} rotation={[0, 0.9, 0]}>
        <mesh geometry={g.wire} material={m.steel} />
        <mesh geometry={g.toggle} material={m.woodMid} position={[-0.34, 0.014, 0]} rotation={[0, Math.PI / 2, 0]} castShadow />
        <mesh geometry={g.toggle} material={m.woodMid} position={[0.34, 0.014, 0]} rotation={[0, Math.PI / 2, 0]} castShadow />
      </group>
      <mesh geometry={g.rib} material={m.woodMid} position={[cx + 0.22, T.top + 0.008, cz - 0.42]} rotation={[0, 0.6, 0]} castShadow />
      <mesh geometry={g.rib} material={m.steel} position={[cx + 0.25, T.top + 0.012, cz - 0.6]} rotation={[0, 2.1, 0]} scale={0.85} castShadow />
      <mesh geometry={useMemo(() => roundedBox(0.12, 0.04, 0.08, 0.018, 3), [])} material={m.sponge} position={[cx - 0.28, T.top + 0.02, cz - 0.6]} rotation={[0, 0.3, 0]} castShadow />
      <Slab mat={m.steel} position={[cx - 0.25, T.top + 0.005, cz + 0.12]} rotation={[0, 0.4, 0]} size={[0.14, 0.003, 0.09]} r={0.001} />
      {/* bagged clay on the shelf below */}
      {[-0.55, -0.15, 0.4].map((dz, i) => (
        <group key={dz} position={[cx - 0.05, FY + 0.28, cz + dz]} rotation={[0, i * 0.2 + Math.PI / 2, 0]}>
          <mesh geometry={g.bag} material={m.bag} castShadow receiveShadow />
        </group>
      ))}
      {/* stacked clay bags on a pallet in the corner */}
      <Slab mat={m.woodWorn} position={[COURT.x0 + 0.57, FY + 0.06, PALLET_Z]} size={[0.8, 0.12, 0.8]} r={0.01} uv={1.2} />
      {bagStack.map((b, i) => (
        <group key={i} position={b.p} rotation={[0, b.r, 0]}>
          <mesh geometry={g.bag} material={m.bag} castShadow receiveShadow />
          {i === bagStack.length - 1 && <mesh geometry={g.knot} material={m.bag} position={[0.16, 0.08, 0]} rotation={[0, 0, -1.2]} castShadow />}
        </group>
      ))}

      {/* reclaim tubs + slip bucket */}
      <group position={[COURT.x0 + 0.4, FY, TUB_Z]}>
        <mesh geometry={g.tub} material={m.bin} castShadow receiveShadow />
        <mesh geometry={g.slurry} material={m.slip} position={[0, 0.38, 0]} receiveShadow />
      </group>
      <Vessel m={m} form="planter" glaze="cream" position={[COURT.x0 + 0.98, FY, TUB_Z + 0.08]} seed={500} scale={1.3} />
      <mesh geometry={useMemo(() => {
        const c = new THREE.CircleGeometry(0.12, 24);
        c.rotateX(-Math.PI / 2);
        return c;
      }, [])} material={m.slip} position={[COURT.x0 + 0.98, FY + 0.17, TUB_Z + 0.08]} />

      {/* wall shelf above the table */}
      <Slab mat={m.woodMid} position={[COURT.x0 + 0.15, FY + 1.72, cz]} size={[0.26, 0.035, 1.9]} r={0.008} uv={1.2} />
      {[cz - 0.75, cz + 0.75].map((z) => (
        <Slab key={z} mat={m.iron} position={[COURT.x0 + 0.1, FY + 1.65, z]} size={[0.18, 0.11, 0.025]} r={0.005} />
      ))}
      <Vessel m={m} form="planter" glaze="sand" position={[COURT.x0 + 0.15, FY + 1.738, cz - 0.6]} seed={510} scale={0.8} />
      <Vessel m={m} form="tumbler" glaze="charcoal" position={[COURT.x0 + 0.15, FY + 1.738, cz - 0.3]} seed={511} />
      <Vessel m={m} form="jar" glaze="terracotta" body="red" position={[COURT.x0 + 0.15, FY + 1.738, cz + 0.05]} seed={512} scale={0.8} />
      <Vessel m={m} form="bowl" glaze="celadon" position={[COURT.x0 + 0.15, FY + 1.738, cz + 0.4]} seed={513} />
      <Vessel m={m} form="tumbler" glaze="sand" position={[COURT.x0 + 0.15, FY + 1.738, cz + 0.7]} seed={514} />
    </group>
  );
}

/** Traditional water-jar stand (jahlah) by the doorway: porous jars keep the water cool. */
export function WaterJars({ m }: { m: PotteryMaterials }) {
  const z = DOOR.z - DOOR.w / 2 - 0.55;
  const x = COURT.x0 + 0.34;
  return (
    <group position={[x, FY, z]}>
      {[-0.32, 0.32].map((dz) =>
        [-0.17, 0.17].map((dx) => <Slab key={`${dz}:${dx}`} mat={m.woodDark} position={[dx, 0.25, dz]} size={[0.06, 0.5, 0.06]} r={0.01} />),
      )}
      <Slab mat={m.woodDark} position={[0, 0.48, 0]} size={[0.44, 0.04, 0.74]} r={0.01} />
      <Slab mat={m.woodDark} position={[0, 0.12, 0]} size={[0.4, 0.03, 0.68]} r={0.008} />
      {[-0.17, 0.17].map((dz, i) => (
        <Vessel key={dz} m={m} form="waterJar" body="terracotta" position={[0, 0.5, dz]} rotation={i * 2.1} seed={520 + i} damp={0.7} scale={0.62} segments={48} />
      ))}
      <mesh position={[0.02, 0.135, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.water}>
        <circleGeometry args={[0.13, 24]} />
      </mesh>
    </group>
  );
}
