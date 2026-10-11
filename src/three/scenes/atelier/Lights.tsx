import { useFrame } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Quality, Variant, Vec3 } from '../../core/types';
import { BURNERS, DRAWERS, GIRDER_Z, NICHES, OUD, ORGAN, ROOM, WINDOW } from './layout';
import { toWorld } from './geom';

/* ------------------------------------------------------------------ */
/*  Lighting: a shadowed warm key from the front-left (models the      */
/*  forms the camera sees), sunlight through the mashrabiya (the       */
/*  lattice casts the real pattern), and flickering practicals.        */
/*  Positions are in room design space (the rig lives inside the       */
/*  rotated venue group).                                              */
/* ------------------------------------------------------------------ */

export interface AtelierPreset {
  background: string;
  ambient: number;
  hemi: [string, string, number];
  env: number;
  envWindow: [string, number];
  key: [string, number];
  /** Direction toward the sun (design space) */
  sunDir: Vec3;
  sun: [string, number];
  /** Lanterns & candles multiplier */
  lamps: number;
  niches: number;
  accents: number;
}

export const PRESETS: Record<Variant, AtelierPreset> = {
  morning: {
    background: '#1C1A18',
    ambient: 0.1,
    hemi: ['#D2E2F2', '#4A3B2C', 0.46],
    env: 0.75,
    envWindow: ['#DDEBF7', 4],
    key: ['#F8F3EC', 300],
    sunDir: [-1, 0.75, -0.55],
    sun: ['#FFF6EA', 22],
    lamps: 0.28,
    niches: 0.55,
    accents: 0.55,
  },
  golden: {
    background: '#1A100A',
    ambient: 0.05,
    hemi: ['#FFD7A8', '#3E2616', 0.16],
    env: 0.42,
    envWindow: ['#FFC27A', 3.6],
    key: ['#FFD2A0', 250],
    sunDir: [-1, 0.44, -0.38],
    sun: ['#FFB25E', 30],
    lamps: 0.75,
    niches: 0.9,
    accents: 0.8,
  },
  dusk: {
    background: '#0B0807',
    ambient: 0.02,
    hemi: ['#3E4270', '#1E120B', 0.07],
    env: 0.24,
    envWindow: ['#4A5294', 0.7],
    key: ['#FFAA66', 85],
    sunDir: [-1, 0.36, -0.22],
    sun: ['#6F86D6', 3.2],
    lamps: 1.42,
    niches: 1.5,
    accents: 1.3,
  },
};

const WIN_CENTRE: Vec3 = [ROOM.x0 - ROOM.t / 2, WINDOW.y + WINDOW.h / 2, WINDOW.z];

export function sunGeometry(variant: Variant) {
  const d = new THREE.Vector3(...PRESETS[variant].sunDir).normalize();
  const pos = new THREE.Vector3(...WIN_CENTRE).addScaledVector(d, 9);
  return { dir: d, pos };
}

/** Pendant / lantern light anchors (design space). */
export const LAMPS: { id: string; p: Vec3; color: string; power: number; dist: number }[] = [
  { id: 'mixing', p: [0.0, 2.2, GIRDER_Z], color: '#FFB062', power: 7, dist: 7 },
  { id: 'majlis', p: [-2.4, 2.25, -0.95], color: '#FFA75A', power: 6, dist: 6.5 },
  { id: 'gift', p: [2.4, 2.25, 1.75], color: '#FFB062', power: 5.5, dist: 6.5 },
];

function Flicker({ base, color, position, distance, seed, decay = 2 }: { base: number; color: string; position: Vec3; distance: number; seed: number; decay?: number }) {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 13.7;
    const f = 0.9 + Math.sin(t * 7.3) * 0.035 + Math.sin(t * 13.1 + 1.3) * 0.025 + Math.sin(t * 23.7) * 0.02 + Math.sin(t * 1.7) * 0.02;
    if (ref.current) ref.current.intensity = base * f;
  });
  return <pointLight ref={ref} position={position} color={color} intensity={base} distance={distance} decay={decay} />;
}

function useTarget(p: Vec3) {
  return useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(...p);
    return o;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p[0], p[1], p[2]]);
}

export function AtelierLights({ variant, quality }: { variant: Variant; quality: Quality }) {
  const P = PRESETS[variant];
  const keyT = useTarget([0.4, 0.5, -1.0]);
  const sunT = useTarget(WIN_CENTRE);
  const oudT = useTarget([OUD.x, OUD.h, OUD.z]);
  const organT = useTarget([ORGAN.x, 1.0, ORGAN.z - 0.4]);
  const drawersT = useTarget([(DRAWERS.x0 + DRAWERS.x1) / 2, 1.5, ROOM.z0]);
  const { pos: sunPos } = useMemo(() => sunGeometry(variant), [variant]);
  const sunOn = P.sun[1] > 0;
  const map = quality === 'high' ? 2048 : 1024;
  const winW = useMemo(() => toWorld([-7, 2.2, WINDOW.z]), []);

  return (
    <>
      <Environment resolution={quality === 'low' ? 64 : 256} frames={1} environmentIntensity={P.env}>
        <color attach="background" args={['#1C130D']} />
        {/* daylight through the window (left of the room) */}
        <Lightformer form="rect" intensity={P.envWindow[1]} color={P.envWindow[0]} position={winW} scale={[2.2, 2.6, 1]} />
        {/* warm overhead lanterns */}
        {LAMPS.map((l) => (
          <Lightformer key={l.id} form="circle" intensity={2.4 * P.lamps} color="#FFB36A" position={toWorld([l.p[0], l.p[1] + 1.2, l.p[2]])} scale={0.9} />
        ))}
        {/* soft key-side panel (front-left, high) */}
        <Lightformer form="rect" intensity={1.1} color={P.key[0]} position={toWorld([-3.5, 5, 6])} scale={[6, 3, 1]} target={[0, 1, 0]} />
        {/* warm floor bounce and dim back wall */}
        <Lightformer form="rect" intensity={0.35} color="#8A5A34" position={[0, -3, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[14, 14, 1]} />
        <Lightformer form="rect" intensity={0.5} color="#C88A52" position={toWorld([0, 2, -6])} scale={[8, 3, 1]} target={[0, 1, 0]} />
      </Environment>
      <ambientLight intensity={P.ambient} color="#FFE2C4" />
      <hemisphereLight args={[P.hemi[0], P.hemi[1], P.hemi[2]]} />

      {/* Key: warm, high front-left, models everything the camera sees */}
      <primitive object={keyT} />
      <spotLight
        target={keyT}
        castShadow
        position={[-3.9, 5.8, 3.4]}
        color={P.key[0]}
        intensity={P.key[1]}
        angle={0.6}
        penumbra={1}
        decay={2}
        distance={22}
        shadow-mapSize-width={map}
        shadow-mapSize-height={map}
        shadow-bias={-0.00025}
        shadow-normalBias={0.025}
        shadow-camera-near={2}
      />

      {/* Sun through the mashrabiya */}
      <primitive object={sunT} />
      <spotLight
        target={sunT}
        castShadow={sunOn}
        visible={sunOn}
        position={sunPos.toArray() as Vec3}
        color={P.sun[0]}
        intensity={P.sun[1]}
        angle={0.16}
        penumbra={0.2}
        decay={0}
        distance={30}
        shadow-mapSize-width={map}
        shadow-mapSize-height={map}
        shadow-bias={-0.0002}
        shadow-normalBias={0.012}
        shadow-camera-near={5}
      />

      {/* Practicals */}
      {LAMPS.map((l, i) =>
        quality === 'low' && i === 2 ? null : (
          <Flicker key={l.id} base={l.power * P.lamps} color={l.color} position={l.p} distance={l.dist} seed={i} />
        ),
      )}
      <pointLight position={[NICHES.grand.c, 2.75, ROOM.z0 - 0.1]} color="#FFB872" intensity={2.6 * P.niches} distance={3.2} decay={2} />
      {quality !== 'low' && (
        <>
          <pointLight position={[NICHES.left.c, 2.5, ROOM.z0 - 0.1]} color="#FFB872" intensity={1.5 * P.niches} distance={2.4} decay={2} />
          <pointLight position={[ROOM.x1 - 0.1, 2.45, NICHES.right.c]} color="#FFB872" intensity={1.5 * P.niches} distance={2.4} decay={2} />
          <Flicker base={1.6 * P.lamps} color="#FF7A2E" position={[BURNERS.x, 0.55, BURNERS.z]} distance={3} seed={7} />
        </>
      )}
      {quality === 'high' && (
        <>
          <primitive object={oudT} />
          <spotLight target={oudT} position={[OUD.x - 0.2, ROOM.h - 0.05, OUD.z + 0.5]} color="#FFD6A6" intensity={14 * P.accents} angle={0.42} penumbra={0.6} decay={2} distance={6} />
          <primitive object={drawersT} />
          <spotLight target={drawersT} position={[(DRAWERS.x0 + DRAWERS.x1) / 2 - 0.2, ROOM.h - 0.05, -0.5]} color="#FFD6A6" intensity={13 * P.accents} angle={0.62} penumbra={0.8} decay={2} distance={7} />
          <primitive object={organT} />
          <spotLight target={organT} position={[ORGAN.x + 0.6, ROOM.h - 0.05, ORGAN.z + 1.2]} color="#FFD6A6" intensity={16 * P.accents} angle={0.55} penumbra={0.7} decay={2} distance={7} />
        </>
      )}
    </>
  );
}
