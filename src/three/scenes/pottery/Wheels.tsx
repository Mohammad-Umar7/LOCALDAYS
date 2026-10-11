import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { roundedBox } from '../../props/geo';
import type { Quality } from '../../core/types';
import { latheSimple, rand, vesselGeometry, FORMS } from './geometry';
import { FY, WHEELS } from './layout';
import type { PotteryMaterials } from './materials';
import { LatheBuffer, lerpParams, potProfile, POT_ROW_COUNT, type PotParams } from './potProfile';
import { Slab } from './parts';
import { mixRGB, rgb } from './tex';

/* ------------------------------------------------------------------ */
/*  Electric potter's wheels: enamel body, slip-stained splash pan,    */
/*  spinning aluminium wheel head, foot pedal, stool, water bucket.    */
/*  The main wheel throws a pot that rises and is shaped over time.    */
/* ------------------------------------------------------------------ */

const HEAD_Y = 0.53; // top of the wheel head above the floor

/* Throwing sequence: centred mound → coned → opened → pulled → shaped bottle-vase */
const K: PotParams[] = [
  { h: 0.1, base: 0.122, belly: 0.118, bellyAt: 0.3, neck: 0.085, neckAt: 0.72, lip: 0.03, wall: 0.03, open: 0, rings: 0 },
  { h: 0.135, base: 0.108, belly: 0.098, bellyAt: 0.35, neck: 0.066, neckAt: 0.78, lip: 0.032, wall: 0.03, open: 0, rings: 0 },
  { h: 0.095, base: 0.124, belly: 0.124, bellyAt: 0.4, neck: 0.118, neckAt: 0.8, lip: 0.108, wall: 0.042, open: 1, rings: 0.0004 },
  { h: 0.155, base: 0.11, belly: 0.109, bellyAt: 0.4, neck: 0.101, neckAt: 0.8, lip: 0.096, wall: 0.024, open: 1, rings: 0.0011 },
  { h: 0.215, base: 0.099, belly: 0.099, bellyAt: 0.4, neck: 0.09, neckAt: 0.8, lip: 0.086, wall: 0.014, open: 1, rings: 0.0013 },
  { h: 0.235, base: 0.086, belly: 0.12, bellyAt: 0.38, neck: 0.06, neckAt: 0.8, lip: 0.078, wall: 0.011, open: 1, rings: 0.0011 },
];
/** [from keyframe, to keyframe, seconds] */
const TIMELINE: [number, number, number][] = [
  [0, 0, 1.5],
  [0, 1, 2.6],
  [1, 0, 2.0],
  [0, 2, 3.2],
  [2, 3, 3.4],
  [3, 4, 3.6],
  [4, 5, 4.4],
  [5, 5, 6.0],
  [5, 0, 2.2],
];
const TOTAL = TIMELINE.reduce((a, s) => a + s[2], 0);
const ease = (t: number) => t * t * (3 - 2 * t);

/** The pot being thrown: a lathe whose profile morphs every frame. */
function ThrownPot({ m, segments }: { m: PotteryMaterials; segments: number }) {
  const lathe = useMemo(() => new LatheBuffer(POT_ROW_COUNT, segments, 0.3), [segments]);
  const params = useMemo<PotParams>(() => ({ ...K[0] }), []);
  const profile = useMemo(() => potProfile(K[0]), []);
  const wob = useRef(0.002);
  const phase = useRef(0);
  useFrame(({ clock }) => {
    let t = (clock.elapsedTime + 4.5) % TOTAL;
    let k = 0;
    while (k < TIMELINE.length - 1 && t > TIMELINE[k][2]) {
      t -= TIMELINE[k][2];
      k++;
    }
    const [a, b, d] = TIMELINE[k];
    lerpParams(K[a], K[b], ease(Math.min(1, t / d)), params);
    potProfile(params, profile);
    // more wobble while the clay is still a lump, almost none once trued
    wob.current = THREE.MathUtils.lerp(0.0022, 0.0005, params.open);
    phase.current = clock.elapsedTime * 0.3;
    const w = wob.current;
    const ph = phase.current;
    lathe.update(profile, (j, y) => (Math.sin((j / segments) * Math.PI * 2 + ph) * w + Math.sin((j / segments) * Math.PI * 6 + y * 40) * w * 0.25) * (0.4 + y * 4), 7);
  });
  return <mesh geometry={lathe.geometry} material={m.clayWet} castShadow receiveShadow userData={{ noBatch: true }} />;
}

function useWheelGeometry() {
  return useMemo(() => {
    const head = latheSimple(
      [
        [0.0005, 0],
        [0.138, 0],
        [0.148, 0.003],
        [0.152, 0.012],
        [0.15, 0.022],
        [0.14, 0.026],
        [0.0005, 0.026],
      ],
      { segments: 56 },
    );
    head.translate(0, -0.026, 0);
    const hub = new THREE.CylinderGeometry(0.05, 0.06, 0.06, 24);
    hub.translate(0, -0.056, 0);
    // splash pan with slip stains (vertex colours)
    const panBase = rgb('#DAD4C9');
    const slip = rgb('#6E5F51');
    const panProfile: [number, number][] = [
      [0.166, 0.04],
      [0.171, 0.008],
      [0.182, 0.0],
      [0.288, 0.0],
      [0.298, 0.01],
      [0.304, 0.098],
      [0.309, 0.112],
      [0.318, 0.114],
      [0.322, 0.104],
      [0.316, 0.004],
      [0.3, -0.008],
      [0.18, -0.008],
      [0.164, 0.0],
    ];
    const pan = latheSimple(panProfile, {
      segments: 56,
      color: (i, _j, th) => {
        const n = Math.sin(th * 5 + 1.3) * 0.5 + Math.sin(th * 13 + 0.4) * 0.3 + Math.sin(th * 29) * 0.2;
        let f = 0;
        if (i >= 1 && i <= 4) f = 0.78 + n * 0.15; // muddy floor of the pan
        else if (i >= 5 && i <= 6) f = Math.max(0, 0.35 + n * 0.5) * (i === 5 ? 1 : 0.55); // splashes up the wall
        return mixRGB(panBase, slip, THREE.MathUtils.clamp(f, 0, 0.85));
      },
    });
    const body = roundedBox(0.5, 0.26, 0.46, 0.06, 4);
    const leg = new THREE.CylinderGeometry(0.02, 0.024, 0.2, 12);
    const pedalBase = roundedBox(0.16, 0.05, 0.26, 0.018, 3);
    const pedal = roundedBox(0.12, 0.022, 0.2, 0.01, 2);
    const cable = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([new THREE.Vector3(-0.2, 0.03, -0.38), new THREE.Vector3(-0.22, 0.012, -0.24), new THREE.Vector3(-0.2, 0.012, -0.12), new THREE.Vector3(-0.17, 0.12, -0.18)]),
      24,
      0.006,
      6,
    );
    // potter's stool: dished round seat on three splayed legs
    const seat = latheSimple(
      [
        [0.0005, 0.0],
        [0.15, 0.0],
        [0.168, 0.012],
        [0.17, 0.03],
        [0.16, 0.042],
        [0.09, 0.034],
        [0.0005, 0.032],
      ],
      { segments: 40 },
    );
    const stoolLeg = new THREE.CylinderGeometry(0.018, 0.022, 0.47, 10);
    const ring = new THREE.TorusGeometry(0.15, 0.01, 6, 40);
    ring.rotateX(Math.PI / 2);
    const bucket = latheSimple(
      [
        [0.0005, 0.004],
        [0.12, 0.004],
        [0.125, 0.0],
        [0.15, 0.25],
        [0.158, 0.262],
        [0.153, 0.268],
        [0.144, 0.25],
        [0.118, 0.016],
        [0.0005, 0.016],
      ],
      { segments: 40 },
    );
    const water = new THREE.CircleGeometry(0.138, 40);
    water.rotateX(-Math.PI / 2);
    const handle = new THREE.TorusGeometry(0.152, 0.004, 5, 32, Math.PI);
    const sponge = roundedBox(0.11, 0.035, 0.075, 0.016, 3);
    const rib = new THREE.CylinderGeometry(0.05, 0.05, 0.004, 24, 1);
    rib.scale(1.35, 1, 0.8);
    const needle = new THREE.CylinderGeometry(0.004, 0.004, 0.13, 6);
    needle.rotateZ(Math.PI / 2);
    return { head, hub, pan, body, leg, pedalBase, pedal, cable, seat, stoolLeg, ring, bucket, water, handle, sponge, rib, needle };
  }, []);
}

type WheelGeo = ReturnType<typeof useWheelGeometry>;

function Stool({ m, g, position, rotation = 0 }: { m: PotteryMaterials; g: WheelGeo; position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={g.seat} material={m.woodTurned} position={[0, 0.47, 0]} castShadow receiveShadow />
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 0.4;
        return <mesh key={i} geometry={g.stoolLeg} material={m.woodTurned} position={[Math.cos(a) * 0.115, 0.235, Math.sin(a) * 0.115]} rotation={[Math.sin(a) * 0.14, 0, -Math.cos(a) * 0.14]} castShadow />;
      })}
      <mesh geometry={g.ring} material={m.woodTurned} position={[0, 0.17, 0]} castShadow />
    </group>
  );
}

interface WheelProps {
  m: PotteryMaterials;
  g: WheelGeo;
  position: [number, number, number];
  rotation: number;
  speed: number;
  /** Shared flag: the wheels hotspot is selected (spin up a little) */
  boost: { current: boolean };
  children?: ReactNode;
  seed: number;
}

/** One wheel. Children ride on the wheel head (and spin with it). */
function PotteryWheel({ m, g, position, rotation, speed, children, seed, boost }: WheelProps) {
  const spin = useRef<THREE.Group>(null);
  const rate = useRef(speed);
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    rate.current = THREE.MathUtils.damp(rate.current, speed * (boost.current && speed > 0 ? 1.6 : 1), 2, d);
    if (spin.current) spin.current.rotation.y += d * rate.current;
  });
  const r = rand(seed);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* body + legs */}
      <mesh geometry={g.body} material={m.enamel} position={[0, 0.33, 0]} castShadow receiveShadow />
      {[
        [-0.2, -0.18],
        [0.2, -0.18],
        [-0.2, 0.18],
        [0.2, 0.18],
      ].map(([x, z], i) => (
        <mesh key={i} geometry={g.leg} material={m.enamelDark} position={[x, 0.1, z]} castShadow />
      ))}
      <mesh geometry={g.pan} material={m.pan} position={[0, 0.462, 0]} castShadow receiveShadow />
      {/* control box + switch */}
      <Slab mat={m.enamelDark} position={[0.27, 0.34, 0.05]} size={[0.05, 0.1, 0.14]} r={0.012} />
      {/* pedal + cable */}
      <group position={[-0.24, 0, -0.36]} rotation={[0, 0.25, 0]}>
        <mesh geometry={g.pedalBase} material={m.enamelDark} position={[0, 0.025, 0]} castShadow receiveShadow />
        <mesh geometry={g.pedal} material={m.rubber} position={[0, 0.062, 0.01]} rotation={[0.12, 0, 0]} castShadow />
      </group>
      <mesh geometry={g.cable} material={m.rubber} castShadow />
      {/* spinning head */}
      <group ref={spin} position={[0, HEAD_Y, 0]} userData={{ noBatch: true }}>
        <mesh geometry={g.head} material={m.alu} castShadow receiveShadow />
        <mesh geometry={g.hub} material={m.enamelDark} />
        {children}
      </group>
      {/* tools on the rim */}
      <mesh geometry={g.sponge} material={m.sponge} position={[0.22, 0.585, 0.17]} rotation={[0, 0.7 + r(), 0.08]} castShadow />
      <mesh geometry={g.rib} material={m.woodMid} position={[-0.25, 0.578, 0.15]} rotation={[0.1, r() * 3, 0.05]} castShadow />
      <mesh geometry={g.needle} material={m.woodDark} position={[0.05, 0.578, 0.305]} rotation={[0, 0.3, 0]} castShadow />
      {/* water bucket */}
      <group position={[0.46, 0, 0.18]}>
        <mesh geometry={g.bucket} material={m.plastic} castShadow receiveShadow />
        <mesh geometry={g.water} material={m.water} position={[0, 0.2, 0]} receiveShadow />
        <mesh geometry={g.handle} material={m.steel} position={[0, 0.262, 0]} rotation={[0, 0.4, 0]} castShadow />
        <mesh geometry={g.sponge} material={m.sponge} position={[0.03, 0.21, 0.02]} rotation={[0, 1.1, 0]} />
      </group>
      <Stool m={m} g={g} position={[0.02, 0, -0.56]} rotation={r()} />
    </group>
  );
}

export function Wheels({ m, quality, active }: { m: PotteryMaterials; quality: Quality; active?: string | null }) {
  const boost = useRef(false);
  boost.current = active === 'wheel';
  const g = useWheelGeometry();
  const segs = quality === 'low' ? 36 : quality === 'medium' ? 48 : 64;
  // static pieces on the other two wheels
  const cone = useMemo(() => {
    const geo = latheSimple(
      [
        [0.0005, 0.0],
        [0.11, 0.0],
        [0.112, 0.02],
        [0.095, 0.08],
        [0.07, 0.13],
        [0.045, 0.16],
        [0.02, 0.172],
        [0.0005, 0.175],
      ],
      { segments: 56 },
    );
    return geo;
  }, []);
  const bowl = useMemo(() => vesselGeometry(FORMS.servingBowl, { body: 'green', seed: 4, segments: 56 }).body, []);
  const bat = useMemo(() => new THREE.CylinderGeometry(0.17, 0.17, 0.018, 48), []);
  const slurry = useMemo(() => {
    const g = new THREE.RingGeometry(0.128, 0.149, 48, 1);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  return (
    <group>
      {WHEELS.map((w, i) => (
        <PotteryWheel key={i} m={m} g={g} position={[w.x, FY, w.z]} rotation={w.rot} speed={w.main ? 4.2 : i === 2 ? 2.6 : 0} seed={i + 3} boost={boost}>
          {w.main && (
            <>
              <ThrownPot m={m} segments={segs} />
              <mesh geometry={slurry} material={m.slip} position={[0, 0.0015, 0]} receiveShadow />
            </>
          )}
          {i === 2 && <mesh geometry={cone} material={m.clayWet} castShadow receiveShadow />}
          {i === 1 && (
            <>
              <mesh geometry={bat} material={m.woodMid} position={[0, 0.009, 0]} castShadow receiveShadow />
              <mesh geometry={bowl} material={m.vBody} position={[0, 0.018, 0]} castShadow receiveShadow />
            </>
          )}
        </PotteryWheel>
      ))}
    </group>
  );
}
