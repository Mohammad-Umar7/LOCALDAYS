import { useMemo } from 'react';
import * as THREE from 'three';
import { boxProjectUVs, roundedBox } from '../../props/geo';
import { Crops, type CropRow } from './Crops';
import { FIELD_CROPS } from './Irrigation';
import type { FarmMaterials } from './materials';
import type { Quality, Vec3 } from '../../core/types';

/* ------------------------------------------------------------------ */
/*  Kitchen garden (raised beds), shade greenhouse, harvest area and   */
/*  the children's planting table.                                     */
/* ------------------------------------------------------------------ */

export const BED_Z = [1.4, 3.6, 5.8, 8.0, 10.2];
const BED_X = 12;
const BED_L = 9;
const BED_W = 1.3;
const BED_H = 0.42;

function Box({ mat, position, size, r = 0.02, rotation }: { mat: THREE.Material; position: Vec3; size: Vec3; r?: number; rotation?: Vec3 }) {
  const geo = useMemo(() => boxProjectUVs(roundedBox(size[0], size[1], size[2], r, 2).clone(), 0.6), [size, r]);
  return <mesh geometry={geo} material={mat} position={position} rotation={rotation} castShadow receiveShadow />;
}

function RaisedBed({ m, z }: { m: FarmMaterials; z: number }) {
  // Mounded soil surface
  const soilGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(BED_L - 0.12, BED_W - 0.12, 48, 8);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const zz = p.getZ(i);
      const mound = Math.cos((zz / (BED_W - 0.12)) * Math.PI) * 0.05;
      const n = Math.sin(x * 7.1 + zz * 13) * 0.008 + Math.sin(x * 19.3) * 0.006;
      p.setY(i, mound + n);
    }
    g.computeVertexNormals();
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 0.6);
    return g;
  }, []);
  return (
    <group>
      <Box mat={m.woodGrey} position={[BED_X, BED_H / 2, z - BED_W / 2]} size={[BED_L, BED_H, 0.07]} />
      <Box mat={m.woodGrey} position={[BED_X, BED_H / 2, z + BED_W / 2]} size={[BED_L, BED_H, 0.07]} />
      <Box mat={m.woodGrey} position={[BED_X - BED_L / 2, BED_H / 2, z]} size={[0.07, BED_H, BED_W + 0.07]} />
      <Box mat={m.woodGrey} position={[BED_X + BED_L / 2, BED_H / 2, z]} size={[0.07, BED_H, BED_W + 0.07]} />
      {[-3, 0, 3].map((dx) => (
        <Box key={dx} mat={m.woodGrey} position={[BED_X + dx, BED_H / 2 + 0.02, z - BED_W / 2 - 0.05]} size={[0.08, BED_H + 0.04, 0.08]} />
      ))}
      <mesh geometry={soilGeo} material={m.soil} position={[BED_X, BED_H - 0.06, z]} receiveShadow />
    </group>
  );
}

/* --------------------------------- Greenhouse --------------------------------- */

const GH = { x: 27, z0: -1, z1: 13, w: 7, h: 3.8 };

function archPoint(t: number) {
  // Half-ellipse cross-section from left (t=0) to right (t=1)
  const a = Math.PI * (1 - t);
  return new THREE.Vector2(Math.cos(a) * (GH.w / 2), Math.sin(a) * GH.h);
}

function Greenhouse({ m, quality }: { m: FarmMaterials; quality: Quality }) {
  const ribGeo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 32; i++) {
      const p = archPoint(i / 32);
      pts.push(new THREE.Vector3(p.x, p.y, 0));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.035, 8, false);
  }, []);
  const ribs = useMemo(() => Array.from({ length: 10 }, (_, i) => GH.z0 + (i * (GH.z1 - GH.z0)) / 9), []);

  const filmGeo = useMemo(() => {
    const segU = 40;
    const segV = 72;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let j = 0; j <= segV; j++) {
      const v = j / segV;
      const z = GH.z0 + v * (GH.z1 - GH.z0);
      const ribPhase = (v * 9) % 1;
      const sag = Math.sin(ribPhase * Math.PI) * 0.06;
      for (let i = 0; i <= segU; i++) {
        const t = i / segU;
        const p = archPoint(t);
        const n = p.clone().normalize();
        const lift = t < 0.08 || t > 0.92 ? 0 : -sag;
        pos.push(p.x + n.x * (0.04 + lift), Math.max(0.35, p.y + n.y * (0.04 + lift)), z);
      }
    }
    for (let j = 0; j < segV; j++)
      for (let i = 0; i < segU; i++) {
        const a = j * (segU + 1) + i;
        const b = a + segU + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);

  const endGeo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-GH.w / 2, 0);
    for (let i = 0; i <= 40; i++) {
      const p = archPoint(i / 40);
      s.lineTo(p.x, p.y);
    }
    s.lineTo(GH.w / 2, 0);
    const door = new THREE.Path();
    door.moveTo(-0.7, 0);
    door.lineTo(0.7, 0);
    door.lineTo(0.7, 2.2);
    door.lineTo(-0.7, 2.2);
    door.closePath();
    s.holes.push(door);
    return new THREE.ShapeGeometry(s, 24);
  }, []);

  const purlins = useMemo(() => [0.12, 0.3, 0.5, 0.7, 0.88].map((t) => archPoint(t)), []);

  const tomatoRows: CropRow[] = useMemo(
    () =>
      [-2.1, -0.7, 0.7, 2.1].map((dx) => ({
        kind: 'tomato' as const,
        from: [GH.x + dx, 0.05, GH.z0 + 1.2] as Vec3,
        to: [GH.x + dx, 0.05, GH.z1 - 2] as Vec3,
        count: quality === 'low' ? 6 : 9,
      })),
    [quality],
  );

  return (
    <group>
      {/* concrete curb */}
      <Box mat={m.stone} position={[GH.x - GH.w / 2, 0.14, (GH.z0 + GH.z1) / 2]} size={[0.25, 0.28, GH.z1 - GH.z0 + 0.3]} />
      <Box mat={m.stone} position={[GH.x + GH.w / 2, 0.14, (GH.z0 + GH.z1) / 2]} size={[0.25, 0.28, GH.z1 - GH.z0 + 0.3]} />
      {/* ribs */}
      {ribs.map((z) => (
        <mesh key={z} geometry={ribGeo} material={m.galvanised} position={[GH.x, 0, z]} castShadow />
      ))}
      {/* purlins */}
      {purlins.map((p, i) => (
        <mesh key={i} position={[GH.x + p.x, p.y, (GH.z0 + GH.z1) / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, GH.z1 - GH.z0, 6]} />
          <primitive object={m.galvanised} attach="material" />
        </mesh>
      ))}
      {/* film */}
      <mesh geometry={filmGeo} material={m.film} position={[GH.x, 0, 0]} renderOrder={2} />
      <mesh geometry={endGeo} material={m.film} position={[GH.x, 0, GH.z0]} renderOrder={2} />
      <mesh geometry={endGeo} material={m.film} position={[GH.x, 0, GH.z1]} renderOrder={2} />
      {/* door frame (south) */}
      {[-0.72, 0.72].map((x) => (
        <mesh key={x} position={[GH.x + x, 1.1, GH.z1]} castShadow>
          <boxGeometry args={[0.06, 2.2, 0.06]} />
          <primitive object={m.galvanised} attach="material" />
        </mesh>
      ))}
      <mesh position={[GH.x, 2.22, GH.z1]} castShadow>
        <boxGeometry args={[1.5, 0.06, 0.06]} />
        <primitive object={m.galvanised} attach="material" />
      </mesh>
      {/* rolled-up side vents */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[GH.x + s * (GH.w / 2 - 0.02), 1.05, (GH.z0 + GH.z1) / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, GH.z1 - GH.z0 - 0.4, 10]} />
          <meshStandardMaterial color="#E8EDE6" roughness={0.5} />
        </mesh>
      ))}
      {/* gravel path + soil rows */}
      <mesh position={[GH.x, 0.02, (GH.z0 + GH.z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[GH.w - 0.4, GH.z1 - GH.z0 - 0.2]} />
        <primitive object={m.soil} attach="material" />
      </mesh>
      {/* drip lines */}
      {[-2.1, -0.7, 0.7, 2.1].map((dx) => (
        <mesh key={dx} position={[GH.x + dx - 0.12, 0.05, (GH.z0 + GH.z1) / 2 - 0.4]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, GH.z1 - GH.z0 - 3, 5]} />
          <primitive object={m.pipe} attach="material" />
        </mesh>
      ))}
      <Crops rows={tomatoRows} quality={quality} seed={9} />
      {/* potting bench with seedling trays */}
      <group position={[GH.x, 0, GH.z1 - 0.9]}>
        <Box mat={m.woodLight} position={[0, 0.85, 0]} size={[2.4, 0.06, 0.7]} />
        {[-1.1, 1.1].map((x) => (
          <Box key={x} mat={m.woodLight} position={[x, 0.42, 0]} size={[0.07, 0.84, 0.6]} />
        ))}
        {[-0.75, 0, 0.75].map((x) => (
          <group key={x} position={[x, 0.9, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.6, 0.06, 0.4]} />
              <meshStandardMaterial color="#232323" roughness={0.7} />
            </mesh>
            {Array.from({ length: 12 }).map((_, i) => (
              <mesh key={i} position={[-0.22 + (i % 4) * 0.145, 0.07, -0.12 + Math.floor(i / 4) * 0.12]} castShadow>
                <sphereGeometry args={[0.04, 8, 6]} />
                <meshStandardMaterial color="#6E9E45" roughness={0.8} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}

export function Garden({ m, quality }: { m: FarmMaterials; quality: Quality }) {
  const rows: CropRow[] = useMemo(() => {
    const x0 = BED_X - BED_L / 2 + 0.45;
    const x1 = BED_X + BED_L / 2 - 0.45;
    return [
      { kind: 'tomato', from: [x0, BED_H - 0.04, BED_Z[0] - 0.3], to: [x1, BED_H - 0.04, BED_Z[0] - 0.3], count: 9 },
      { kind: 'tomato', from: [x0 + 0.4, BED_H - 0.04, BED_Z[0] + 0.3], to: [x1, BED_H - 0.04, BED_Z[0] + 0.3], count: 8 },
      { kind: 'lettuce', from: [x0, BED_H, BED_Z[1] - 0.38], to: [x1, BED_H, BED_Z[1] - 0.38], count: 16 },
      { kind: 'lettuce', from: [x0 + 0.25, BED_H, BED_Z[1]], to: [x1, BED_H, BED_Z[1]], count: 15 },
      { kind: 'lettuce', from: [x0, BED_H, BED_Z[1] + 0.38], to: [x1, BED_H, BED_Z[1] + 0.38], count: 16 },
      { kind: 'bush', from: [x0, BED_H - 0.04, BED_Z[2] - 0.28], to: [x1, BED_H - 0.04, BED_Z[2] - 0.28], count: 8 },
      { kind: 'bush', from: [x0 + 0.5, BED_H - 0.04, BED_Z[2] + 0.28], to: [x1, BED_H - 0.04, BED_Z[2] + 0.28], count: 7 },
      { kind: 'herb', from: [x0, BED_H, BED_Z[3] - 0.36], to: [x1, BED_H, BED_Z[3] - 0.36], count: 22 },
      { kind: 'herb', from: [x0, BED_H, BED_Z[3]], to: [x1, BED_H, BED_Z[3]], count: 22 },
      { kind: 'herb', from: [x0, BED_H, BED_Z[3] + 0.36], to: [x1, BED_H, BED_Z[3] + 0.36], count: 22 },
      { kind: 'tomato', from: [x0, BED_H - 0.04, BED_Z[4] - 0.25], to: [x1 - 2, BED_H - 0.04, BED_Z[4] - 0.25], count: 6 },
      { kind: 'marigold', from: [x0, BED_H, BED_Z[4] + 0.35], to: [x1, BED_H, BED_Z[4] + 0.35], count: 14 },
      // okra basins in the fodder field share these instanced meshes
      ...FIELD_CROPS,
    ];
  }, []);

  return (
    <group>
      {BED_Z.map((z) => (
        <RaisedBed key={z} m={m} z={z} />
      ))}
      <Crops rows={rows} quality={quality} seed={3} />
      <Greenhouse m={m} quality={quality} />

      {/* Children's planting table */}
      <group position={[8.2, 0, 15.4]} rotation={[0, 0.15, 0]}>
        <Box mat={m.woodLight} position={[0, 0.58, 0]} size={[2, 0.06, 0.8]} />
        {[
          [-0.9, -0.32],
          [0.9, -0.32],
          [-0.9, 0.32],
          [0.9, 0.32],
        ].map(([x, z], i) => (
          <Box key={i} mat={m.woodLight} position={[x, 0.29, z]} size={[0.06, 0.58, 0.06]} />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <group key={i} position={[-0.7 + i * 0.28, 0.61, (i % 2) * 0.2 - 0.1]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.06, 0.045, 0.1, 16]} />
              <primitive object={m.terracotta} attach="material" />
            </mesh>
            <mesh position={[0, 0.09, 0]} castShadow>
              <icosahedronGeometry args={[0.05, 1]} />
              <meshStandardMaterial color="#79A84B" roughness={0.8} />
            </mesh>
          </group>
        ))}
        {[-0.6, 0, 0.6].map((x) => (
          <Box key={x} mat={m.woodTeal} position={[x, 0.17, 0.75]} size={[0.32, 0.34, 0.32]} r={0.03} />
        ))}
      </group>
    </group>
  );
}
