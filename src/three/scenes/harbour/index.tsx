import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OutdoorRig, SUN_PRESETS, sunDirection, type SunPreset } from '../../core/Rigs';
import { StaticBatch } from '../../core/StaticBatch';
import type { SceneConfig, SceneProps, Variant, Vec3 } from '../../core/types';
import { Birds } from '../../props/Decor';
import { DatePalms, type PalmSpec } from '../../props/DatePalms';
import { BeachedBoat, FishingBoat, buoyGeometry } from './Boats';
import { Breakwater } from './Breakwater';
import { Dhow } from './Dhow';
import { BOLLARDS, Dock, LAMP_GLASS } from './Dock';
import { Hut } from './Hut';
import { BOAT_POSES, DHOW_POSE, JETTY, groundHeight } from './layout';
import { Market } from './Market';
import { useHarbourMaterials } from './materials';
import { Buoys, MooringLines, type BuoySpec, type LineSpec } from './motion';
import { Nets } from './Nets';
import { Terrain } from './Terrain';
import { Traps } from './Traps';
import { Water } from './Water';
import { Wildlife } from './Wildlife';
import { PlanarReflection, useReflective } from './Reflections';
import { Village } from './Village';

/* ================================================================== */
/*  Harbour venue — Hamriyah Harbour Heritage (+ Kalba, Dibba hosts).  */
/*  A traditional Gulf fishing harbour: timber jetty with a moored     */
/*  sambuk dhow and fibreglass fishing boats riding Gerstner swell,    */
/*  gargoor traps, net yard, auction shed, barasti hut and a rubble    */
/*  breakwater, with the Hajar mountains across the bay.               */
/* ================================================================== */

export const config: SceneConfig = {
  id: 'harbour',
  fov: 40,
  home: { position: [42, 15.5, 22], target: [-5, 0.8, -17] },
  anchors: {
    dhow: { position: [-4.4, 7.6, -18.6], camera: { position: [8.2, 9.6, -3.2], target: [-4.6, 3.0, -19.5] } },
    boats: { position: [5.0, 3.8, -14], camera: { position: [13.5, 4.8, -4.6], target: [4.4, 0.7, -14.2] } },
    nets: { position: [-14.6, 4.0, 9.6], camera: { position: [-9.2, 4.3, 17.5], target: [-16.8, 1.3, 9.0] } },
    traps: { position: [-5.6, 3.4, 8], camera: { position: [2.0, 3.6, 15.2], target: [-5.4, 1.0, 7.8] } },
    sorting: { position: [13, 6.2, 9], camera: { position: [18.4, 3.2, 14.8], target: [12.2, 1.5, 8.2] } },
    dock: { position: [0.5, 4.6, -33.5], camera: { position: [11, 5.5, -22.5], target: [0.5, 1.8, -33.5] } },
  },
  controls: {
    minDistance: 5,
    maxDistance: 115,
    minPolarAngle: 0.22,
    maxPolarAngle: 1.36,
    boundary: { min: [-55, 0.4, -60], max: [45, 10, 35] },
  },
  background: '#CFDCDD',
};

/** Sun placement per variant: side-light the home view; golden/dusk sit low ahead-right for glitter on the water. */
const SUN: Record<Variant, Partial<SunPreset>> = {
  morning: { elevation: 30, azimuth: 136, turbidity: 1.8, rayleigh: 2.4, mie: 0.003, sunIntensity: 4.2, hemiIntensity: 0.36, hemiGround: '#6E5A40', fog: '#C2D5E0', fogNear: 260, fogFar: 2300, envIntensity: 0.5 },
  golden: { elevation: 10, azimuth: 160, sunIntensity: 5.0, hemiIntensity: 0.32, fog: '#E9C9A0', fogNear: 140, fogFar: 1200, envIntensity: 0.42 },
  dusk: {
    elevation: 2.6,
    azimuth: 207,
    sunIntensity: 2.1,
    sunColor: '#FF8A4C',
    hemiSky: '#7C74A8',
    hemiGround: '#2E2226',
    hemiIntensity: 0.2,
    fog: '#B98A7E',
    fogNear: 110,
    fogFar: 1000,
    envIntensity: 0.26,
  },
};

/** Framing palms close to the home camera get the denser crowns. */
const PALMS_NEAR: PalmSpec[] = [
  { position: [36.2, 0, 6.6], height: 8.6, lean: 0.14, leanDir: Math.PI + 0.5, seed: 3 },
  { position: [-24.6, 0, 7.4], height: 7.4, lean: 0.12, leanDir: -1.9, seed: 5 },
];
const PALMS_FAR: PalmSpec[] = [
  { position: [14.8, 0, 17.6], height: 8.2, lean: 0.06, leanDir: 0.4, seed: 11, fruit: true },
  { position: [-36.5, 0, 13.4], height: 7.8, lean: 0.08, leanDir: 2.4, seed: 8, fruit: true },
  { position: [-27.0, 0, 21.8], height: 8.6, lean: 0.06, leanDir: 0.4, seed: 13 },
  { position: [7.6, 0, 16.6], height: 6.6, lean: 0.07, leanDir: 1.2, seed: 17 },
  { position: [24.5, 0, 18.8], height: 7.6, lean: 0.06, leanDir: 2.8, seed: 19 },
  { position: [-11.5, 0, 19.2], height: 8.4, lean: 0.05, leanDir: 0.8, seed: 23 },
  { position: [-35.5, 0, 23.0], height: 6.8, lean: 0.05, leanDir: 2.0, seed: 29 },
];

function grounded(list: PalmSpec[]) {
  return list.map((p) => ({ ...p, position: [p.position[0], groundHeight(p.position[0], p.position[2]) - 0.05, p.position[2]] as Vec3 }));
}

export default function Scene({ variant, quality }: SceneProps) {
  const m = useHarbourMaterials(quality);
  const lit = variant === 'dusk';
  const sun = SUN[variant];
  const preset = useMemo(() => ({ ...SUN_PRESETS[variant], ...sun }), [variant, sun]);
  const sunDir = useMemo(() => sunDirection(preset), [preset]);

  const lamps = useMemo<[number, number, number][]>(
    () => (lit ? [...LAMP_GLASS, [DHOW_POSE.x, 10.2, DHOW_POSE.z - 2.6], ...BOAT_POSES.map((b) => [b.x + Math.sin(b.yaw) * -0.4, 1.95, b.z + Math.cos(b.yaw) * -0.4] as [number, number, number])] : []),
    [lit],
  );
  const dhowRef = useRef<THREE.Group>(null);
  const boatRefs = [useRef<THREE.Group>(null), useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const dockRef = useRef<THREE.Group>(null);
  const hullMats = useMemo(() => [m.wood, m.paint, m.matte, m.metal, m.dockWood], [m]);
  const dockMats = useMemo(() => [m.timber, m.dockWood, m.matte, m.metal], [m]);
  useReflective([dhowRef, ...boatRefs], quality === 'high', hullMats);
  useReflective([dockRef], quality === 'high', dockMats);

  const palmsNear = useMemo(() => grounded(PALMS_NEAR), []);
  const palmsFar = useMemo(() => grounded(PALMS_FAR), []);

  const lines = useMemo<LineSpec[]>(() => {
    const top = (i: number): Vec3 => [BOLLARDS[i][0], BOLLARDS[i][1] + 0.4, BOLLARDS[i][2]];
    return [
      { from: top(1), boat: dhowRef, local: [-0.32, 1.32, 7.0], pose: DHOW_POSE, sag: 0.45, radius: 0.028 },
      { from: top(0), boat: dhowRef, local: [-1.05, 2.25, -7.1], pose: DHOW_POSE, sag: 0.35, radius: 0.028 },
      { from: top(0), boat: dhowRef, local: [-2.0, 1.32, 1.2], pose: DHOW_POSE, sag: 0.5, radius: 0.024 },
      { from: top(3), boat: boatRefs[0], local: [0, 1.52, 3.78], pose: BOAT_POSES[0], sag: 0.22, radius: 0.02 },
      { from: top(2), boat: boatRefs[0], local: [0.85, 0.98, -3.55], pose: BOAT_POSES[0], sag: 0.22, radius: 0.02 },
      { from: [5.9, -0.25, -20.2], boat: boatRefs[1], local: [0, 1.52, 3.78], pose: BOAT_POSES[1], sag: 0.6, radius: 0.018 },
      { from: [16.7, 0.05, -30.4], boat: boatRefs[2], local: [0, 1.52, 3.78], pose: BOAT_POSES[2], sag: 0.5, radius: 0.018 },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buoyGeo = useMemo(() => buoyGeometry(), []);
  const buoyMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.45 }), []);
  const buoys = useMemo<BuoySpec[]>(
    () => [
      { position: [16.7, -30.6], color: '#F0F0EA', scale: 1.1 },
      { position: [9.4, -40.5], color: '#E8691E' },
      { position: [-13.5, -33.5], color: '#E8691E', scale: 0.9 },
      { position: [-21.5, -21.5], color: '#F0F0EA' },
      { position: [21.5, -14.5], color: '#E8691E', scale: 0.85 },
      { position: [24.5, -38.5], color: '#C8302A', scale: 1.2 },
    ],
    [],
  );

  const gulls = useMemo(
    () => [
      { p: [-6, JETTY.deck + 0.85 + 0.16, -30.2] as Vec3, yaw: 2.4 },
      { p: [6, JETTY.deck + 0.85 + 0.16, -36] as Vec3, yaw: -0.8 },
      { p: [6, JETTY.deck + 0.85 + 0.16, -30.2] as Vec3, yaw: 0.9 },
      { p: [-14.2, groundHeight(-14.2, 1.2) - 0.02, 1.2] as Vec3, yaw: -2.2 },
      { p: [-13.5, groundHeight(-13.5, 2.0) - 0.02, 2.0] as Vec3, yaw: 2.9 },
    ],
    [],
  );
  const heron = useMemo(() => ({ p: [-31.5, groundHeight(-31.5, -2.4), -2.4] as Vec3, yaw: -0.9 }), []);

  return (
    <>
      <OutdoorRig variant={variant} quality={quality} shadowExtent={52} center={[-6, 0, -10]} sunDistance={150} overrides={sun} />
      <Water variant={variant} quality={quality} sunDir={sunDir} sunColor={preset.sunColor} lamps={lamps} />
      <Terrain quality={quality} variant={variant} />
      <group ref={dockRef}>
        <StaticBatch deps={[quality, variant]}>
          <Dock m={m} quality={quality} lit={lit} />
        </StaticBatch>
      </group>
      <StaticBatch deps={[quality, variant]}>
        <Traps m={m} quality={quality} />
        <Nets m={m} quality={quality} />
        <Market m={m} quality={quality} />
        <Hut m={m} quality={quality} lit={lit} />
        <Breakwater m={m} quality={quality} lit={lit} />
        <BeachedBoat m={m} quality={quality} position={[-13.2, groundHeight(-13.2, 3.4) + 0.3, 3.4]} yaw={0.42} heel={-0.15} />
        <DatePalms palms={palmsNear} quality={quality === 'high' ? 'medium' : 'low'} />
        <DatePalms palms={palmsFar} quality="low" />
        <Wildlife m={m} gulls={gulls} heron={heron} />
        <Village m={m} quality={quality} />
      </StaticBatch>
      <Dhow m={m} quality={quality} lit={lit} boatRef={dhowRef} />
      {BOAT_POSES.map((p, i) => (
        <FishingBoat key={i} m={m} quality={quality} livery={p.hull} pose={p} lit={lit} seed={i * 2.3 + 0.7} boatRef={boatRefs[i]} />
      ))}
      <MooringLines lines={lines} material={m.rope} />
      <Buoys items={buoys} geometry={buoyGeo} material={buoyMat} sink={0.05} />
      <PlanarReflection enabled={quality === 'high'} />
      <Birds count={quality === 'low' ? 6 : 10} center={[-8, 22, -24]} radius={40} color="#E4E6E6" size={0.8} speed={0.08} />
    </>
  );
}
