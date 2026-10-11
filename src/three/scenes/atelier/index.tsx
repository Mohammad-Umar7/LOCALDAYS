import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { StaticBatch } from '../../core/StaticBatch';
import type { SceneConfig, SceneProps, Vec3 } from '../../core/types';
import { CoffeeTray, MajlisSeating, Rug } from '../../props/Decor';
import { Apothecary } from './Apothecary';
import { ShadowPolicy, TintPolicy } from './Baked';
import { Architecture, useShellLook } from './Architecture';
import { SunShafts } from './Atmosphere';
import { Burners, SmokeClock } from './Burners';
import { toWorld } from './geom';
import { CrystalShelves, DisplayBottle } from './Glassware';
import { Candles, FloorLantern, Lanterns } from './Lanterns';
import { BUKHOOR, MIXING, NICHES, ORGAN, OUD, PACKAGING, ROOM, RUG } from './layout';
import { AtelierLights, PRESETS } from './Lights';
import { useAtelierMaterials, type AtelierMaterials } from './materials';
import { Organ } from './Organ';
import { CentreRug } from './Rugs';
import { WallDecor } from './WallDecor';
import { BukhoorTable, MixingStation, OudDisplay, PackagingBench } from './Stations';

/* ================================================================== */
/*  Oud Lane Atelier — an oud, bukhoor & fragrance house behind a      */
/*  carved door in the Heart of Sharjah, shown as a cut-away room.     */
/*  Built in "design space" (open side +Z) and rotated so the open     */
/*  side faces world +X, keeping camera azimuth limits wrap-free.      */
/* ================================================================== */

const pose = (position: Vec3, target: Vec3) => ({ position: toWorld(position), target: toWorld(target) });
const OPEN = Math.PI / 2; // world azimuth of the room's open side

export const config: SceneConfig = {
  id: 'atelier',
  fov: 40,
  home: pose([2.0, 2.5, 8.3], [0.1, 1.15, -0.7]),
  anchors: {
    bottles: { position: toWorld([0, 1.74, -2.05]), camera: pose([0.9, 1.75, 0.9], [0, 1.05, -1.75]) },
    oud: { position: toWorld([OUD.x + 0.15, 1.8, OUD.z - 0.15]), camera: pose([1.45, 1.62, 1.45], [2.55, 0.94, -0.4]) },
    bukhoor: { position: toWorld([BUKHOOR.x, 0.98, BUKHOOR.z]), camera: pose([-1.15, 1.85, 3.15], [-2.25, 0.42, 1.25]) },
    drawers: { position: toWorld([2.59, 2.98, -2.3]), camera: pose([1.15, 1.75, 0.3], [2.6, 1.55, -2.55]) },
    burners: { position: toWorld([-2.3, 1.28, -0.2]), camera: pose([-0.9, 1.45, 2.0], [-2.3, 0.45, -0.15]) },
    mixing: { position: toWorld([-0.35, 1.36, 0.3]), camera: pose([0.75, 1.55, 1.85], [-0.05, 0.98, 0.2]) },
    packaging: { position: toWorld([PACKAGING.x + 0.1, 1.3, PACKAGING.z]), camera: pose([1.3, 1.7, 3.7], [2.4, 0.95, 1.8]) },
  },
  controls: {
    minDistance: 1.1,
    maxDistance: 10.5,
    minPolarAngle: 0.95,
    maxPolarAngle: 1.62,
    minAzimuthAngle: OPEN - 0.6,
    maxAzimuthAngle: OPEN + 0.6,
    boundary: { min: [-2.6, 0.2, -3.6], max: [2.6, 2.6, 3.6] },
  },
  background: '#120C08',
};

const CANDLES: { p: Vec3; h: number; r?: number }[] = [
  { p: [ROOM.x0 + 0.17, 1.03, -1.08], h: 0.15 },
  { p: [ROOM.x0 + 0.17, 1.03, -0.02], h: 0.1, r: 0.026 },
  { p: [ORGAN.x + Math.cos(0.22) * 0.66, 0.786, ORGAN.z - Math.sin(0.22) * 0.66], h: 0.12, r: 0.026 },
  { p: [ORGAN.x + Math.cos(Math.PI - 0.22) * 0.66, 0.786, ORGAN.z - Math.sin(Math.PI - 0.22) * 0.66], h: 0.09, r: 0.026 },
  { p: [PACKAGING.x - 0.64, 0.88, PACKAGING.z - 0.24], h: 0.13 },
];

/* Glassware the camera may approach (design space). */
const GLASS_SPOTS = (
  [
    [NICHES.grand.c, 1.9, ROOM.z0 - 0.15],
    [NICHES.left.c, 1.9, ROOM.z0 - 0.15],
    [ROOM.x1 + 0.15, 1.8, NICHES.right.c],
    [MIXING.x - 0.05, MIXING.h + 0.1, MIXING.z - 0.05],
    [OUD.x, OUD.h + 0.12, OUD.z - 0.15],
    [PACKAGING.x - 0.35, PACKAGING.h + 0.08, PACKAGING.z + 0.14],
  ] as Vec3[]
).map((p) => new THREE.Vector3(...p));

/**
 * Real transmission only when the camera is close enough to read refraction;
 * from the overview the crystal swaps to a lighter transparent glass, so the
 * renderer skips its transmission pass (which re-draws every opaque object).
 */
function GlassLOD({ m, enabled }: { m: AtelierMaterials; enabled: boolean }) {
  const { scene, camera } = useThree();
  const st = useRef<{ mode: 'hero' | 'lite' | null; frames: number }>({ mode: null, frames: 0 });
  const v = useRef(new THREE.Vector3());
  // materials are rebuilt per quality tier: start over (hero first, so both programs compile early)
  useEffect(() => {
    st.current = { mode: null, frames: 0 };
  }, [m]);
  useFrame(() => {
    if (!enabled) return;
    const s = st.current;
    s.frames++;
    const c = camera.position;
    v.current.set(-c.z, c.y, c.x); // world → design space
    let dist = Infinity;
    for (const g of GLASS_SPOTS) dist = Math.min(dist, v.current.distanceTo(g));
    const want = s.frames < 6 ? 'hero' : dist < 3.4 ? 'hero' : dist > 3.9 ? 'lite' : s.mode ?? 'lite';
    if (want === s.mode) return;
    s.mode = want;
    const from = want === 'hero' ? m.crystalLite : m.crystal;
    const to = want === 'hero' ? m.crystal : m.crystalLite;
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.material === from) mesh.material = to;
    });
  });
  return null;
}

export default function Scene({ variant, quality }: SceneProps) {
  const m = useAtelierMaterials(quality);
  const look = useShellLook(variant);
  return (
    <>
      <color attach="background" args={[PRESETS[variant].background]} />
      <group rotation={[0, Math.PI / 2, 0]}>
        <AtelierLights variant={variant} quality={quality} />
        <StaticBatch deps={[quality, variant]}>
          <ShadowPolicy minRadius={0.2}>
            <TintPolicy targets={{ matte: m.tintMatte, gloss: m.tintGloss, metal: m.tintMetal }}>
              <Architecture m={m} look={look} />
              <Organ m={m} quality={quality} />
              <Apothecary m={m} quality={quality} />
              <MixingStation m={m} quality={quality} />
              <OudDisplay m={m} quality={quality} />
              <BukhoorTable m={m} quality={quality} />
              <PackagingBench m={m} quality={quality} />
              <CrystalShelves m={m} quality={quality} />
              <Burners m={m} variant={variant} quality={quality} />
              <Lanterns m={m} variant={variant} />
              <Candles m={m} items={CANDLES} />
              <FloorLantern m={m} position={[3.45, 0, 2.5]} />
              {/* majlis by the window: seating, Sadu rug and the coffee welcome */}
              <MajlisSeating position={[-3.42, 0, -0.62]} length={3.3} rotation={Math.PI / 2} colorIndex={0} />
              <Rug position={[RUG.x, 0.004, RUG.z]} size={[RUG.w, RUG.d]} />
              <CoffeeTray position={[-2.66, 0.006, -1.42]} rotation={0.35} />
              <CentreRug m={m} />
              <WallDecor m={m} />
            </TintPolicy>
          </ShadowPolicy>
        </StaticBatch>
        <DisplayBottle m={m} quality={quality} position={[NICHES.grand.c, NICHES.grand.shelves[1] + 0.014, ROOM.z0 - 0.155]} />
        <SunShafts variant={variant} quality={quality} />
        <SmokeClock />
        <GlassLOD m={m} enabled={quality !== 'low'} />
      </group>
    </>
  );
}
