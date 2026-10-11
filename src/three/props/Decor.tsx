import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getTexSet, repeatSet } from '../materials/textures';
import { roundedBox, sagCurve, smoothLathe, tubeAlong, boxProjectUVs } from './geo';
import type { Vec3 } from '../core/types';

/* ------------------------------------------------------------------ */
/*  Reusable decor: lanterns, majlis set (rug, cushions, dallah),      */
/*  string lights, rocks and birds. Used across several venues.        */
/* ------------------------------------------------------------------ */

/* ---------------------------------- Lantern --------------------------------- */

export function Lantern({
  position,
  scale = 1,
  lit = false,
  light = false,
  hanging = false,
  color = '#FFB765',
}: {
  position: Vec3;
  scale?: number;
  lit?: boolean;
  light?: boolean;
  hanging?: boolean;
  color?: string;
}) {
  const brass = useMemo(() => getTexSet('metal', { base: '#A9844A', roughness: 0.32 }), []);
  const flame = useRef<THREE.PointLight>(null);
  const glassMat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const f = 0.85 + Math.sin(clock.elapsedTime * 11 + position[0]) * 0.06 + Math.sin(clock.elapsedTime * 23.7) * 0.04;
    if (flame.current) flame.current.intensity = (lit ? 2.6 : 0) * f;
    if (glassMat.current) glassMat.current.emissiveIntensity = (lit ? 2.4 : 0.05) * f;
  });
  const capGeo = useMemo(() => smoothLathe([[0.001, 0.36], [0.05, 0.34], [0.13, 0.27], [0.16, 0.24], [0.15, 0.22]], 24, 24), []);
  const baseGeo = useMemo(() => smoothLathe([[0.001, 0], [0.14, 0], [0.16, 0.02], [0.13, 0.05], [0.12, 0.06]], 24, 16), []);
  const glassGeo = useMemo(() => new THREE.CylinderGeometry(0.115, 0.12, 0.17, 6, 1, true), []);
  return (
    <group position={position} scale={scale}>
      {hanging && (
        <mesh position={[0, 0.62, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.5, 4]} />
          <meshStandardMaterial color="#2a2522" metalness={0.6} roughness={0.5} />
        </mesh>
      )}
      <mesh geometry={baseGeo} castShadow>
        <meshStandardMaterial {...brass} metalness={0.95} />
      </mesh>
      {/* frame bars */}
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.12, 0.145, Math.sin(a) * 0.12]} castShadow>
            <boxGeometry args={[0.012, 0.18, 0.012]} />
            <meshStandardMaterial {...brass} metalness={0.95} />
          </mesh>
        );
      })}
      <mesh geometry={glassGeo} position={[0, 0.145, 0]}>
        <meshStandardMaterial
          ref={glassMat}
          color="#F6D7A6"
          emissive={color}
          emissiveIntensity={lit ? 2.4 : 0.05}
          transparent
          opacity={0.72}
          roughness={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={capGeo} castShadow>
        <meshStandardMaterial {...brass} metalness={0.95} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <torusGeometry args={[0.035, 0.008, 6, 16]} />
        <meshStandardMaterial {...brass} metalness={0.95} />
      </mesh>
      {light && <pointLight ref={flame} position={[0, 0.16, 0]} color={color} distance={7} decay={2} intensity={lit ? 2.6 : 0} />}
    </group>
  );
}

/* ---------------------------------- Majlis ---------------------------------- */

export function Rug({ position, size = [3, 2], rotation = 0 }: { position: Vec3; size?: [number, number]; rotation?: number }) {
  const sadu = useMemo(() => repeatSet(getTexSet('sadu'), 1, size[1] / size[0]), [size]);
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, rotation]} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial {...sadu} roughness={1} />
    </mesh>
  );
}

const CUSHION_COLORS = ['#8E1E1A', '#5B1715', '#B8862E', '#2C201A', '#7A2420'];

export function MajlisSeating({
  position,
  length = 4,
  rotation = 0,
  colorIndex = 0,
}: {
  position: Vec3;
  length?: number;
  rotation?: number;
  colorIndex?: number;
}) {
  const sadu = useMemo(() => repeatSet(getTexSet('sadu'), length / 2, 0.5), [length]);
  const fabric = useMemo(() => getTexSet('fabric', { base: '#E7DCC6', weave: 220 }), []);
  const seatGeo = useMemo(() => roundedBox(length, 0.16, 0.75, 0.06, 4), [length]);
  const backCount = Math.max(2, Math.round(length / 0.75));
  const backGeo = useMemo(() => roundedBox(0.62, 0.5, 0.2, 0.08, 4), []);
  const armGeo = useMemo(() => new THREE.CylinderGeometry(0.13, 0.13, 0.6, 20), []);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={seatGeo} position={[0, 0.08, 0]} castShadow receiveShadow>
        <meshStandardMaterial {...sadu} roughness={1} />
      </mesh>
      {Array.from({ length: backCount }).map((_, i) => (
        <mesh
          key={i}
          geometry={backGeo}
          position={[-length / 2 + 0.38 + i * ((length - 0.76) / Math.max(1, backCount - 1)), 0.42, -0.3]}
          rotation={[-0.18, 0, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial {...fabric} color={CUSHION_COLORS[(i + colorIndex) % CUSHION_COLORS.length]} roughness={0.95} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={armGeo} position={[s * (length / 2 - 0.1), 0.28, 0.05]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <meshStandardMaterial {...fabric} color="#8E1E1A" roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

/** Arabic coffee pot (dallah) with cups on a brass tray. */
export function CoffeeTray({ position, rotation = 0, scale = 1 }: { position: Vec3; rotation?: number; scale?: number }) {
  const brass = useMemo(() => getTexSet('metal', { base: '#C29A55', roughness: 0.22, seed: 5 }), []);
  const body = useMemo(
    () =>
      smoothLathe(
        [
          [0.001, 0],
          [0.09, 0.005],
          [0.105, 0.04],
          [0.085, 0.12],
          [0.05, 0.17],
          [0.042, 0.2],
          [0.06, 0.235],
          [0.075, 0.25],
          [0.05, 0.3],
          [0.035, 0.32],
          [0.012, 0.36],
          [0.001, 0.37],
        ],
        48,
        64,
      ),
    [],
  );
  const spout = useMemo(() => {
    const pts = [new THREE.Vector3(0.07, 0.07, 0), new THREE.Vector3(0.14, 0.16, 0), new THREE.Vector3(0.17, 0.27, 0), new THREE.Vector3(0.22, 0.31, 0)];
    return tubeAlong(pts, 0.012, 8);
  }, []);
  const handle = useMemo(() => {
    const pts = [new THREE.Vector3(-0.06, 0.24, 0), new THREE.Vector3(-0.14, 0.22, 0), new THREE.Vector3(-0.15, 0.12, 0), new THREE.Vector3(-0.09, 0.07, 0)];
    return tubeAlong(pts, 0.01, 6);
  }, []);
  const cup = useMemo(() => smoothLathe([[0.001, 0], [0.018, 0.0], [0.024, 0.02], [0.03, 0.045], [0.028, 0.046], [0.02, 0.022], [0.001, 0.008]], 24, 24), []);
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <mesh position={[0, 0.01, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.3, 0.28, 0.02, 48]} />
        <meshStandardMaterial {...brass} metalness={1} />
      </mesh>
      <group position={[-0.08, 0.02, 0]}>
        <mesh geometry={body} castShadow>
          <meshStandardMaterial {...brass} metalness={1} />
        </mesh>
        <mesh geometry={spout} castShadow>
          <meshStandardMaterial {...brass} metalness={1} />
        </mesh>
        <mesh geometry={handle} castShadow>
          <meshStandardMaterial {...brass} metalness={1} />
        </mesh>
      </group>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={cup} position={[0.12 + (i % 2) * 0.07, 0.02, -0.07 + Math.floor(i / 2) * 0.12]} castShadow>
          <meshStandardMaterial color="#F4EEE2" roughness={0.25} />
        </mesh>
      ))}
      {/* dates bowl */}
      <mesh position={[0.05, 0.05, 0.16]} castShadow>
        <sphereGeometry args={[0.08, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color="#D9C9AA" roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      {Array.from({ length: 9 }).map((_, i) => (
        <mesh key={i} position={[0.05 + Math.cos(i * 2.1) * 0.035, 0.04, 0.16 + Math.sin(i * 2.1) * 0.035]} scale={[0.016, 0.012, 0.024]} rotation={[0, i, 0]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#5A2A12" roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------- String lights ------------------------------- */

export function StringLights({ points, sag = 0.35, bulbs = 10, lit = false }: { points: Vec3[]; sag?: number; bulbs?: number; lit?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const segments = useMemo(() => {
    const segs: THREE.Vector3[][] = [];
    for (let i = 0; i < points.length - 1; i++) segs.push(sagCurve(new THREE.Vector3(...points[i]), new THREE.Vector3(...points[i + 1]), sag, 24));
    return segs;
  }, [points, sag]);
  const wire = useMemo(() => segments.map((s) => tubeAlong(s, 0.006, 4)), [segments]);
  const bulbPos = useMemo(() => {
    const out: THREE.Vector3[] = [];
    segments.forEach((s) => {
      const curve = new THREE.CatmullRomCurve3(s);
      for (let i = 1; i < bulbs; i++) out.push(curve.getPointAt(i / bulbs).add(new THREE.Vector3(0, -0.05, 0)));
    });
    return out;
  }, [segments, bulbs]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const mat = new THREE.Matrix4();
    bulbPos.forEach((p, i) => m.setMatrixAt(i, mat.makeTranslation(p.x, p.y, p.z)));
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [bulbPos]);
  return (
    <group>
      {wire.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color="#1d1a17" roughness={0.6} />
        </mesh>
      ))}
      <instancedMesh ref={ref} args={[undefined, undefined, bulbPos.length]}>
        <sphereGeometry args={[0.045, 12, 8]} />
        <meshStandardMaterial color="#FFF2D6" emissive="#FFB45E" emissiveIntensity={lit ? 4 : 0.35} roughness={0.3} toneMapped />
      </instancedMesh>
    </group>
  );
}

/* ----------------------------------- Rocks ----------------------------------- */

export function Rocks({
  items,
  color = '#9C8467',
  seed = 3,
}: {
  items: { position: Vec3; scale: number | Vec3; rotation?: number }[];
  color?: string;
  seed?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1, 4);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n =
        Math.sin(v.x * 3.1 + seed) * 0.12 +
        Math.sin(v.y * 4.7 + seed * 2) * 0.1 +
        Math.sin(v.z * 5.3 - seed) * 0.08 +
        Math.sin((v.x + v.z) * 9.1) * 0.035;
      v.multiplyScalar(1 + n);
      v.y *= 0.62;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    boxProjectUVs(g, 0.8);
    return g;
  }, [seed]);
  const tex = useMemo(() => repeatSet(getTexSet('stone', { base: '#B49C7E', dark: '#7E6A54', mortar: '#7E6A54', cells: 3, seed: 11 }), 1, 1), []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const mat = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    items.forEach((it, i) => {
      const s = typeof it.scale === 'number' ? new THREE.Vector3(it.scale, it.scale, it.scale) : new THREE.Vector3(...it.scale);
      q.setFromEuler(new THREE.Euler(0, it.rotation ?? i * 1.7, 0));
      mat.compose(new THREE.Vector3(...it.position), q, s);
      m.setMatrixAt(i, mat);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[geo, undefined, items.length]} castShadow receiveShadow>
      <meshStandardMaterial map={tex.map} normalMap={tex.normalMap} color={color} roughness={0.95} />
    </instancedMesh>
  );
}

/* ----------------------------------- Birds ----------------------------------- */

/** A loose flock gliding and flapping across the sky. */
export function Birds({
  count = 14,
  center = [0, 18, 0],
  radius = 30,
  color = '#2B2622',
  size = 0.45,
  speed = 0.12,
}: {
  count?: number;
  center?: Vec3;
  radius?: number;
  color?: string;
  size?: number;
  speed?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    // Body + two wings; wing tips flap in the vertex shader
    const g = new THREE.BufferGeometry();
    const v = new Float32Array([
      0, 0, 0.35, -1, 0.05, -0.05, 0, 0, -0.25, 0, 0, 0.35, 0, 0, -0.25, 1, 0.05, -0.05, 0, 0, -0.25, -0.12, 0, -0.55, 0.12, 0, -0.55,
    ]);
    g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  const flap = useMemo(() => ({ value: 0 }), []);
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.9 });
    m.onBeforeCompile = (s) => {
      s.uniforms.uT = flap;
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uT;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           #ifdef USE_INSTANCING
           float ph = instanceMatrix[3][0] * 1.7 + instanceMatrix[3][2];
           #else
           float ph = 0.0;
           #endif
           transformed.y += sin(uT * 9.0 + ph) * abs(transformed.x) * 0.55;`,
        );
    };
    return m;
  }, [color, flap]);
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({ a: (i / count) * Math.PI * 2, r: radius * (0.6 + ((i * 37) % 10) / 25), h: (i % 5) * 1.3, s: 0.8 + ((i * 13) % 7) / 20 })), [count, radius]);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime * speed;
    flap.value = clock.elapsedTime;
    seeds.forEach((b, i) => {
      const a = b.a + t * b.s;
      const x = center[0] + Math.cos(a) * b.r + Math.sin(t * 2 + i) * 2;
      const z = center[2] + Math.sin(a) * b.r * 0.7;
      const y = center[1] + b.h + Math.sin(t * 3 + i) * 0.8;
      tmp.position.set(x, y, z);
      const dx = -Math.sin(a) * b.r;
      const dz = Math.cos(a) * b.r * 0.7;
      tmp.rotation.set(0, Math.atan2(dx, dz), Math.sin(t * 4 + i) * 0.25);
      tmp.scale.setScalar(size);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mat, count]} frustumCulled={false} />;
}
