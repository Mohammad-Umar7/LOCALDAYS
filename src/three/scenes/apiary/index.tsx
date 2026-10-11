import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OutdoorRig, SUN_PRESETS, type SunPreset } from '../../core/Rigs';
import { StaticBatch } from '../../core/StaticBatch';
import type { SceneConfig, SceneProps, Variant } from '../../core/types';
import { Lantern } from '../../props/Decor';
import { BeeSwarm, Butterflies } from './Bees';
import { Extraction } from './Extraction';
import { Flora } from './Flora';
import { Hives } from './Hives';
import { groundY, PATHS } from './layout';
import { honeyUniforms, useApiaryMaterials } from './materials';
import { Pavilion } from './Pavilion';
import { Shop } from './Shop';
import { Terrain } from './Terrain';
import { VertexTint } from './VertexTint';

/* ================================================================== */
/*  Apiary venue — Wadi Hives (Wadi Al Helo), also Golden Samar and    */
/*  Dhaid Bee Garden. A hive row on a terrace above a dry wadi, with   */
/*  layered Hajar foothills behind.                                    */
/* ================================================================== */

export const config: SceneConfig = {
  id: 'apiary',
  fov: 36,
  home: { position: [-11.0, 10.6, 27.5], target: [-3.0, 0.6, -2.8] },
  anchors: {
    hives: { position: [-5.4, 2.05, -7.4], camera: { position: [-2.3, 2.15, -2.9], target: [-5.0, 0.95, -6.9] } },
    observation: { position: [-14.8, 5.05, 3.0], camera: { position: [-10.65, 1.72, 3.6], target: [-14.8, 1.3, 3.0] } },
    extraction: { position: [5.0, 3.65, -8.1], camera: { position: [9.2, 3.45, -1.7], target: [6.85, 1.05, -8.8] } },
    shop: { position: [8.4, 3.5, 3.0], camera: { position: [7.1, 2.2, 8.9], target: [8.25, 1.72, 2.6] } },
    flora: { position: [-3.8, 1.75, 4.0], camera: { position: [0.6, 2.5, 10.2], target: [-4.2, 0.45, 3.2] } },
  },
  controls: {
    minDistance: 3.5,
    maxDistance: 60,
    minPolarAngle: 0.3,
    maxPolarAngle: 1.36,
    minAzimuthAngle: -1.25,
    maxAzimuthAngle: 1.15,
    boundary: { min: [-24, -1, -18], max: [18, 8, 14] },
  },
  background: '#D9CDB8',
};

/** Sun placed to side-light the faces the home camera sees (camera sits south-west of the site). */
const SUN: Record<Variant, Partial<SunPreset>> = {
  morning: { azimuth: 42, elevation: 33, hemiIntensity: 0.28, envIntensity: 0.4 },
  golden: { azimuth: 58, elevation: 15, hemiIntensity: 0.34 },
  dusk: { azimuth: 70, elevation: 5, hemiIntensity: 0.4 },
};

const GLOW: Record<Variant, [number, number]> = {
  morning: [0.12, 0.45],
  golden: [0.16, 0.6],
  dusk: [0.45, 0.55],
};

/** Low solar bollards along the paths; they glow at dusk. */
function PathLights({ lit }: { lit: boolean }) {
  const posts = useRef<THREE.InstancedMesh>(null);
  const caps = useRef<THREE.InstancedMesh>(null);
  const pts = useMemo(() => {
    const out: THREE.Vector3[] = [];
    PATHS.forEach((path, pi) => {
      const curve = new THREE.CatmullRomCurve3(path.map(([x, z]) => new THREE.Vector3(x, 0, z)));
      const len = curve.getLength();
      const n = Math.max(1, Math.floor(len / 6.5));
      for (let i = pi === 0 ? 1 : 1; i < n; i++) {
        const t = i / n;
        const p = curve.getPointAt(t);
        const tg = curve.getTangentAt(t);
        const side = (i + pi) % 2 === 0 ? 1 : -1;
        p.x += -tg.z * 1.05 * side;
        p.z += tg.x * 1.05 * side;
        p.y = groundY(p.x, p.z);
        out.push(p);
      }
    });
    return out;
  }, []);
  useLayoutEffect(() => {
    const m4 = new THREE.Matrix4();
    pts.forEach((p, i) => {
      posts.current?.setMatrixAt(i, m4.makeTranslation(p.x, p.y + 0.17, p.z));
      caps.current?.setMatrixAt(i, m4.makeTranslation(p.x, p.y + 0.36, p.z));
    });
    for (const r of [posts.current, caps.current]) {
      if (!r) continue;
      r.instanceMatrix.needsUpdate = true;
      r.computeBoundingSphere();
    }
  }, [pts]);
  return (
    <group>
      <instancedMesh ref={posts} args={[undefined, undefined, pts.length]} receiveShadow>
        <cylinderGeometry args={[0.04, 0.05, 0.34, 14]} />
        <meshStandardMaterial color="#5B4A36" roughness={0.55} metalness={0.5} />
      </instancedMesh>
      <instancedMesh ref={caps} args={[undefined, undefined, pts.length]}>
        <cylinderGeometry args={[0.055, 0.045, 0.045, 14]} />
        <meshStandardMaterial color="#EFE6D4" emissive="#FFC27A" emissiveIntensity={lit ? 3 : 0} roughness={0.35} />
      </instancedMesh>
    </group>
  );
}

/** Shepherd's-hook lantern posts at the hive viewing area, the main junction and the wadi crossing. */
function LanternPosts({ lit }: { lit: boolean }) {
  const posts = useMemo(
    () =>
      (
        [
          [-4.6, -1.5, 0.3],
          [1.9, 2.6, -0.8],
          [4.6, 11.4, 0.4],
        ] as [number, number, number][]
      ).map(([x, z, r]) => ({ x, z, r, y: groundY(x, z) })),
    [],
  );
  return (
    <group>
      {posts.map((p, i) => (
        <group key={i} position={[p.x, p.y, p.z]} rotation={[0, p.r, 0]}>
          <mesh position={[0, 0.95, 0]} castShadow>
            <cylinderGeometry args={[0.022, 0.03, 1.9, 10]} />
            <meshStandardMaterial color="#2E2925" metalness={0.6} roughness={0.5} />
          </mesh>
          <mesh position={[0.17, 1.86, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <torusGeometry args={[0.17, 0.016, 8, 20, Math.PI]} />
            <meshStandardMaterial color="#2E2925" metalness={0.6} roughness={0.5} />
          </mesh>
          <Lantern position={[0.34, 1.32, 0]} hanging lit={lit} light={lit && i === 0} scale={0.85} />
        </group>
      ))}
    </group>
  );
}

export default function Scene({ variant, quality, active }: SceneProps) {
  const m = useApiaryMaterials();
  const lit = variant === 'dusk';
  const sun = useMemo(() => ({ ...SUN_PRESETS[variant], ...SUN[variant] }), [variant]);

  useEffect(() => {
    honeyUniforms.uGlow.value = GLOW[variant][0];
    honeyUniforms.uBack.value = GLOW[variant][1];
    m.sign.emissiveIntensity = lit ? 0.55 : 0;
  }, [variant, lit, m]);

  return (
    <>
      <OutdoorRig variant={variant} quality={quality} shadowExtent={32} center={[-3, 0, -3]} sunDistance={90} overrides={SUN[variant]} />
      <StaticBatch deps={[quality, variant]}>
        <Terrain quality={quality} variant={variant} sun={sun} />
        <VertexTint m={m} quality={quality} deps={[quality, variant]}>
          <Hives m={m} active={active} quality={quality} />
          <Pavilion m={m} quality={quality} lit={lit} />
          <Extraction m={m} quality={quality} lit={lit} active={active === 'extraction'} />
          <Shop m={m} quality={quality} lit={lit} />
        </VertexTint>
        <Flora m={m} quality={quality} />
        <PathLights lit={lit} />
        <LanternPosts lit={lit} />
      </StaticBatch>
      <BeeSwarm quality={quality} />
      <Butterflies quality={quality} />
    </>
  );
}
