import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { smoothLathe } from '../../props/geo';
import type { Variant, Vec3 } from '../../core/types';
import type { AtelierMaterials } from './materials';
import { POLE_R, ROOM } from './layout';
import { LAMPS, PRESETS } from './Lights';
import { atelierMap } from './textures';
import { Baked } from './Baked';

/* ------------------------------------------------------------------ */
/*  Pierced brass pendant lanterns on chains, candles and a floor      */
/*  lantern. Emissive piercings + coloured glass flicker in sync with  */
/*  the practical lights.                                              */
/* ------------------------------------------------------------------ */

function lanternGeos() {
  const body = smoothLathe(
    [
      [0.06, -0.17],
      [0.085, -0.14],
      [0.115, -0.07],
      [0.122, 0.0],
      [0.112, 0.07],
      [0.08, 0.12],
      [0.05, 0.15],
    ],
    48,
    48,
  ).clone();
  const uv = body.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i) * 3);
  return {
    body,
    cap: smoothLathe([[0.001, 0.25], [0.012, 0.25], [0.018, 0.23], [0.03, 0.2], [0.058, 0.165], [0.07, 0.15], [0.056, 0.14], [0.001, 0.14]], 40, 24),
    foot: smoothLathe([[0.001, -0.25], [0.008, -0.25], [0.012, -0.23], [0.03, -0.2], [0.064, -0.172], [0.07, -0.16], [0.001, -0.16]], 40, 24),
    ring: new THREE.TorusGeometry(0.018, 0.004, 8, 20),
  };
}

function Chain({ m, top, bottom }: { m: AtelierMaterials; top: number; bottom: number }) {
  const n = Math.max(2, Math.floor((top - bottom) / 0.045));
  const geo = useMemo(() => new THREE.TorusGeometry(0.011, 0.0028, 6, 12), []);
  const mats = useMemo(() => {
    const o = new THREE.Object3D();
    return Array.from({ length: n }, (_, i) => {
      o.position.set(0, bottom + (i + 0.5) * ((top - bottom) / n), 0);
      o.rotation.set(0, (i % 2) * (Math.PI / 2), 0);
      o.scale.set(1, 1.6, 1);
      o.updateMatrix();
      return o.matrix.clone();
    });
  }, [n, top, bottom]);
  return <Baked geo={geo} mats={mats} material={m.iron} receive={false} />;
}

export function Lanterns({ m, variant }: { m: AtelierMaterials; variant: Variant }) {
  const g = useMemo(() => lanternGeos(), []);
  const P = PRESETS[variant];
  const shellMat = useMemo(() => {
    const t = atelierMap('piercedLantern');
    return new THREE.MeshStandardMaterial({ map: m.brass.map, color: '#D8B068', metalness: 1, roughness: 0.32, emissive: '#FFB061', emissiveMap: t, emissiveIntensity: 3, side: THREE.FrontSide });
  }, [m]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const f = 0.9 + Math.sin(t * 7.3) * 0.035 + Math.sin(t * 13.1 + 1.3) * 0.025 + Math.sin(t * 23.7) * 0.02 + Math.sin(t * 1.7) * 0.02;
    shellMat.emissiveIntensity = 3.4 * P.lamps * f;
    m.lanternGlow.emissiveIntensity = 0.7 * P.lamps * f;
  });
  return (
    <group>
      {LAMPS.map((l) => {
        const ceiling = l.id === 'mixing' ? ROOM.h - POLE_R * 2 - 0.3 : ROOM.h - POLE_R * 2;
        return (
          <group key={l.id} position={l.p}>
            <mesh geometry={g.body} material={shellMat} castShadow />
            <mesh geometry={g.cap} material={m.brass} castShadow />
            <mesh geometry={g.foot} material={m.brass} castShadow />
            <mesh geometry={g.ring} material={m.brass} position={[0, 0.262, 0]} />
            <Chain m={m} top={ceiling - l.p[1]} bottom={0.275} />
            <mesh material={m.brass} position={[0, ceiling - l.p[1] - 0.01, 0]}>
              <cylinderGeometry args={[0.03, 0.04, 0.025, 20]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* --------------------------------- Candles -------------------------------- */

export function Candles({ m, items }: { m: AtelierMaterials; items: { p: Vec3; h: number; r?: number }[] }) {
  const flameGeo = useMemo(() => smoothLathe([[0.001, 0], [0.006, 0.006], [0.0075, 0.014], [0.005, 0.024], [0.001, 0.036]], 12, 10), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    m.flame.opacity = 0.82 + Math.sin(t * 11) * 0.08 + Math.sin(t * 23.3) * 0.06;
  });
  return (
    <group>
      {items.map((c, i) => (
        <group key={i} position={c.p}>
          <mesh material={m.brass} position={[0, 0.008, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[(c.r ?? 0.03) + 0.018, (c.r ?? 0.03) + 0.024, 0.016, 32]} />
          </mesh>
          <mesh material={m.candle} position={[0, 0.016 + c.h / 2, 0]} castShadow>
            <cylinderGeometry args={[c.r ?? 0.03, c.r ?? 0.03, c.h, 28]} />
          </mesh>
          <mesh material={m.iron} position={[0, 0.016 + c.h + 0.006, 0]}>
            <cylinderGeometry args={[0.0012, 0.0012, 0.012, 4]} />
          </mesh>
          <mesh geometry={flameGeo} material={m.flame} position={[0, 0.016 + c.h + 0.008, 0]} rotation={[0, 0, (i % 3) * 0.04 - 0.04]} />
        </group>
      ))}
    </group>
  );
}

/** Tall brass floor lantern with coloured glass panes. */
export function FloorLantern({ m, position }: { m: AtelierMaterials; position: Vec3 }) {
  const geo = useMemo(
    () => ({
      stem: smoothLathe([[0.001, 0], [0.13, 0], [0.14, 0.02], [0.09, 0.06], [0.04, 0.1], [0.025, 0.2], [0.03, 0.5], [0.022, 0.62], [0.05, 0.66], [0.001, 0.66]], 40, 40),
      cage: smoothLathe([[0.09, 0.66], [0.13, 0.72], [0.14, 0.82], [0.12, 0.9], [0.07, 0.95]], 6, 16),
      roof: smoothLathe([[0.001, 1.12], [0.01, 1.12], [0.02, 1.06], [0.06, 1.0], [0.11, 0.955], [0.12, 0.94], [0.06, 0.935], [0.001, 0.935]], 6, 16),
    }),
    [],
  );
  return (
    <group position={position}>
      <mesh geometry={geo.stem} material={m.brass} castShadow receiveShadow />
      <mesh geometry={geo.cage} material={m.lanternGlow} />
      <mesh geometry={geo.roof} material={m.brass} castShadow />
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} material={m.brass} position={[Math.cos(a) * 0.132, 0.8, Math.sin(a) * 0.132]} castShadow>
            <cylinderGeometry args={[0.006, 0.006, 0.3, 6]} />
          </mesh>
        );
      })}
    </group>
  );
}

