import { useMemo } from 'react';
import * as THREE from 'three';
import { Environment, Lightformer, Sky } from '@react-three/drei';
import type { Quality, Variant, Vec3 } from './types';

/* ------------------------------------------------------------------ */
/*  Lighting rigs. Outdoor venues use a physically-based sky that also */
/*  feeds the environment map, so reflections always match the sky.    */
/* ------------------------------------------------------------------ */

export interface SunPreset {
  elevation: number;
  azimuth: number;
  sunColor: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  fog: string;
  fogNear: number;
  fogFar: number;
  turbidity: number;
  rayleigh: number;
  mie: number;
  mieG: number;
  envIntensity: number;
  /** Lanterns and practical lights on? */
  practicals: boolean;
}

export const SUN_PRESETS: Record<Variant, SunPreset> = {
  golden: {
    elevation: 16,
    azimuth: 72,
    sunColor: '#FFB46E',
    sunIntensity: 4.6,
    hemiSky: '#FFD9AE',
    hemiGround: '#6B4A2E',
    hemiIntensity: 0.38,
    fog: '#E8BF8C',
    fogNear: 70,
    fogFar: 260,
    turbidity: 6.5,
    rayleigh: 2.4,
    mie: 0.007,
    mieG: 0.88,
    envIntensity: 0.42,
    practicals: false,
  },
  morning: {
    elevation: 38,
    azimuth: 28,
    sunColor: '#FFF0D8',
    sunIntensity: 4.4,
    hemiSky: '#CFE2F2',
    hemiGround: '#7E6748',
    hemiIntensity: 0.45,
    fog: '#D8E0E0',
    fogNear: 80,
    fogFar: 300,
    turbidity: 3.2,
    rayleigh: 1.0,
    mie: 0.004,
    mieG: 0.82,
    envIntensity: 0.5,
    practicals: false,
  },
  dusk: {
    elevation: 4.5,
    azimuth: 96,
    sunColor: '#FF8A50',
    sunIntensity: 3.2,
    hemiSky: '#8F84BC',
    hemiGround: '#3A2826',
    hemiIntensity: 0.42,
    fog: '#C58F7A',
    fogNear: 50,
    fogFar: 230,
    turbidity: 9,
    rayleigh: 3.2,
    mie: 0.012,
    mieG: 0.9,
    envIntensity: 0.35,
    practicals: true,
  },
};

export function sunDirection(p: Pick<SunPreset, 'elevation' | 'azimuth'>) {
  const phi = THREE.MathUtils.degToRad(90 - p.elevation);
  const theta = THREE.MathUtils.degToRad(p.azimuth);
  return new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
}

export interface OutdoorRigProps {
  variant: Variant;
  quality: Quality;
  /** Half-size of the shadow camera frustum (world units) */
  shadowExtent?: number;
  /** Centre of the shadowed area */
  center?: Vec3;
  /** Distance of the shadow-casting light from the centre */
  sunDistance?: number;
  /** Override any preset value */
  overrides?: Partial<SunPreset>;
  fog?: boolean;
}

export function OutdoorRig({
  variant,
  quality,
  shadowExtent = 40,
  center = [0, 0, 0],
  sunDistance = 80,
  overrides,
  fog = true,
}: OutdoorRigProps) {
  const p = { ...SUN_PRESETS[variant], ...overrides };
  const dir = useMemo(() => sunDirection(p), [p.elevation, p.azimuth]);
  const skyPos = useMemo(() => dir.clone().multiplyScalar(100), [dir]);
  const lightPos: Vec3 = [center[0] + dir.x * sunDistance, center[1] + Math.max(dir.y, 0.12) * sunDistance, center[2] + dir.z * sunDistance];
  const mapSize = quality === 'high' ? 4096 : quality === 'medium' ? 2048 : 1024;
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(...center);
    return o;
  }, [center[0], center[1], center[2]]);

  return (
    <>
      <Sky
        distance={900}
        sunPosition={skyPos}
        turbidity={p.turbidity}
        rayleigh={p.rayleigh}
        mieCoefficient={p.mie}
        mieDirectionalG={p.mieG}
      />
      <Environment resolution={quality === 'low' ? 64 : 256} frames={1} environmentIntensity={p.envIntensity}>
        <Sky
          distance={900}
          sunPosition={skyPos}
          turbidity={p.turbidity}
          rayleigh={p.rayleigh}
          mieCoefficient={p.mie}
          mieDirectionalG={p.mieG}
        />
        <Lightformer form="circle" intensity={2.5} color={p.sunColor} position={skyPos.clone().normalize().multiplyScalar(40)} scale={8} />
      </Environment>
      <hemisphereLight args={[p.hemiSky, p.hemiGround, p.hemiIntensity]} />
      <primitive object={target} />
      <directionalLight
        castShadow
        position={lightPos}
        target={target}
        color={p.sunColor}
        intensity={p.sunIntensity}
        shadow-mapSize-width={mapSize}
        shadow-mapSize-height={mapSize}
        shadow-bias={-0.00015}
        shadow-normalBias={0.035}
        shadow-radius={quality === 'high' ? 5 : 3}
      >
        <orthographicCamera key={shadowExtent + ':' + sunDistance} attach="shadow-camera" args={[-shadowExtent, shadowExtent, shadowExtent, -shadowExtent, 1, sunDistance * 2.5]} />
      </directionalLight>
      {fog && <fog attach="fog" args={[p.fog, p.fogNear, p.fogFar]} />}
    </>
  );
}

export interface IndoorRigProps {
  quality: Quality;
  /** Warm key light position (casts shadows) */
  keyLight?: { position: Vec3; target?: Vec3; color?: string; intensity?: number; angle?: number };
  ambient?: number;
  envIntensity?: number;
  /** Window light panels feeding reflections */
  windows?: { position: Vec3; rotation?: Vec3; scale?: [number, number]; color?: string; intensity?: number }[];
  background?: string;
}

/** Interior rig: area-light style environment + one shadowed key light. */
export function IndoorRig({ quality, keyLight, ambient = 0.25, envIntensity = 0.8, windows = [], background }: IndoorRigProps) {
  const mapSize = quality === 'high' ? 2048 : 1024;
  const k = keyLight ?? { position: [6, 9, 4] as Vec3 };
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(...(k.target ?? [0, 0, 0]));
    return o;
  }, [k.target?.[0], k.target?.[1], k.target?.[2]]);
  return (
    <>
      {background && <color attach="background" args={[background]} />}
      <Environment resolution={quality === 'low' ? 64 : 256} frames={1} environmentIntensity={envIntensity}>
        <color attach="background" args={['#2a1e16']} />
        {windows.map((w, i) => (
          <Lightformer
            key={i}
            form="rect"
            intensity={w.intensity ?? 3}
            color={w.color ?? '#FFE2B8'}
            position={w.position}
            rotation={w.rotation ?? [0, 0, 0]}
            scale={[...(w.scale ?? [4, 3]), 1] as [number, number, number]}
          />
        ))}
        <Lightformer form="rect" intensity={0.6} color="#FFD7A8" position={[0, 10, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[20, 20, 1]} />
      </Environment>
      <ambientLight intensity={ambient} color="#FFE6CC" />
      <primitive object={target} />
      <spotLight
        castShadow
        position={k.position}
        target={target}
        color={k.color ?? '#FFDDB0'}
        intensity={k.intensity ?? 120}
        angle={k.angle ?? 0.75}
        penumbra={0.8}
        decay={2}
        distance={60}
        shadow-mapSize-width={mapSize}
        shadow-mapSize-height={mapSize}
        shadow-bias={-0.0002}
        shadow-normalBias={0.03}
      />
    </>
  );
}
