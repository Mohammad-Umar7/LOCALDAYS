import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { LatheBuffer, POT_ROW_COUNT, POT_ROWS, potProfile, type PotParams } from './potProfile';

/* ------------------------------------------------------------------ */
/*  "Shape your piece" preview: a single thrown pot turning slowly on  */
/*  a wheel head. The lathe profile is rebuilt every frame from the    */
/*  sliders (damped towards the targets) and finished in the chosen    */
/*  glaze. Self-contained, lightweight canvas — no post-processing.    */
/* ------------------------------------------------------------------ */

export type ClayGlaze = 'sand' | 'gulf' | 'celadon' | 'charcoal' | 'terracotta';

export interface ClayStudioProps {
  /** All 0..1 */
  height: number;
  belly: number;
  neck: number;
  lip: number;
  glaze: ClayGlaze;
  /** Pulled handle (mugs) */
  handle?: boolean;
  className?: string;
}

interface Finish {
  main: string;
  pool: string;
  brk: string;
  rough: number;
  coat: number;
}

const FINISHES: Record<ClayGlaze, Finish> = {
  sand: { main: '#D6BE98', pool: '#A47E55', brk: '#F1E6CF', rough: 0.34, coat: 0.55 },
  gulf: { main: '#1E4F7F', pool: '#0A2340', brk: '#86AFCF', rough: 0.1, coat: 1 },
  celadon: { main: '#9CBFA5', pool: '#55866C', brk: '#D9E8DA', rough: 0.09, coat: 1 },
  charcoal: { main: '#34302D', pool: '#1A1716', brk: '#6E665E', rough: 0.6, coat: 0.15 },
  terracotta: { main: '#A85A39', pool: '#86432A', brk: '#BE7652', rough: 0.88, coat: 0 },
};
const CLAY = new THREE.Color('#CDB79A');
const lerp = THREE.MathUtils.lerp;
const clamp01 = (v: number) => THREE.MathUtils.clamp(Number.isFinite(v) ? v : 0.5, 0, 1);

/** Maps the four 0..1 sliders onto a physical pot profile (metres). */
function toParams(s: Pick<ClayStudioProps, 'height' | 'belly' | 'neck' | 'lip'>, out: PotParams): PotParams {
  const height = clamp01(s.height);
  const belly = clamp01(s.belly);
  const neck = clamp01(s.neck);
  const lip = clamp01(s.lip);
  const rB = lerp(0.05, 0.15, belly);
  const rN = rB * lerp(0.32, 1, neck);
  out.h = lerp(0.07, 0.34, height);
  out.belly = rB;
  out.base = rB * lerp(0.92, 0.45, belly);
  out.bellyAt = lerp(0.55, 0.36, height);
  out.neck = rN;
  out.neckAt = lerp(0.86, 0.78, height);
  out.lip = rN * lerp(0.85, 1.35, lip);
  out.wall = 0.0075;
  out.open = 1;
  out.rings = 0.00025;
  return out;
}

function Pot({ props }: { props: ClayStudioProps }) {
  const lathe = useMemo(() => new LatheBuffer(POT_ROW_COUNT, 72, 0.45, true), []);
  const cur = useMemo(() => toParams(props, {} as PotParams), []); // eslint-disable-line react-hooks/exhaustive-deps
  const goal = useMemo(() => ({} as PotParams), []);
  const profile = useMemo(() => potProfile(cur), [cur]);
  const tint = useMemo(() => {
    const f = FINISHES[props.glaze] ?? FINISHES.sand;
    return { main: new THREE.Color(f.main), pool: new THREE.Color(f.pool), brk: new THREE.Color(f.brk) };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.12, envMapIntensity: 1.2 }), []);
  const live = useRef(props);
  live.current = props;
  const spin = useRef<THREE.Group>(null);
  const tmp = useMemo(() => new THREE.Color(), []);
  const { base, outer, lip } = POT_ROWS;
  // Pulled handle: a tube along a C-curve hugging the current profile
  const handleMesh = useRef<THREE.Mesh>(null);
  const handleMat = useMemo(() => new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.12, envMapIntensity: 1.2 }), []);
  const handleKey = useRef('');
  const handleScale = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const p = live.current;
    const f = FINISHES[p.glaze] ?? FINISHES.sand;
    toParams(p, goal);
    (Object.keys(goal) as (keyof PotParams)[]).forEach((k) => (cur[k] = THREE.MathUtils.damp(cur[k], goal[k], 7, dt)));
    potProfile(cur, profile);
    const k = 1 - Math.exp(-6 * dt);
    tint.main.lerp(tmp.set(f.main), k);
    tint.pool.lerp(tmp.set(f.pool), k);
    tint.brk.lerp(tmp.set(f.brk), k);
    mat.roughness = THREE.MathUtils.damp(mat.roughness, f.rough, 6, dt);
    mat.clearcoat = THREE.MathUtils.damp(mat.clearcoat, f.coat, 6, dt);
    const c = new THREE.Color();
    lathe.update(profile, undefined, 6, (i) => {
      if (i < base) return [CLAY.r, CLAY.g, CLAY.b];
      if (i < base + outer) {
        const v = (i - base) / (outer - 1);
        if (v < 0.07) return [CLAY.r, CLAY.g, CLAY.b]; // unglazed foot
        const t = (v - 0.07) / 0.93;
        c.copy(tint.pool).lerp(tint.main, THREE.MathUtils.smoothstep(t, 0, 0.3)).lerp(tint.brk, THREE.MathUtils.smoothstep(t, 0.86, 1) * 0.6);
      } else if (i < base + outer + lip) c.copy(tint.main).lerp(tint.brk, 0.7);
      else {
        const t = (i - base - outer - lip) / (POT_ROWS.inner - 1);
        c.copy(tint.main).lerp(tint.brk, (1 - THREE.MathUtils.smoothstep(t, 0, 0.15)) * 0.4).lerp(tint.pool, THREE.MathUtils.smoothstep(t, 0.55, 1) * 0.75);
      }
      return [c.r, c.g, c.b];
    });
    if (spin.current) spin.current.rotation.y += dt * 0.55;

    // handle grows in/out smoothly and follows the wall
    handleScale.current = THREE.MathUtils.damp(handleScale.current, p.handle ? 1 : 0, 8, dt);
    const hm = handleMesh.current;
    if (hm) {
      hm.visible = handleScale.current > 0.02;
      hm.scale.setScalar(Math.max(0.001, handleScale.current));
      handleMat.color.copy(tint.main);
      handleMat.roughness = mat.roughness;
      handleMat.clearcoat = mat.clearcoat;
      const key = [cur.h, cur.belly, cur.neck, cur.base].map((v) => v.toFixed(4)).join();
      if (hm.visible && key !== handleKey.current) {
        handleKey.current = key;
        const rAt = (y: number) => {
          const pts: [number, number][] = [[0, cur.base], [cur.bellyAt * cur.h, cur.belly], [cur.neckAt * cur.h, cur.neck], [cur.h, cur.lip]];
          for (let i = 1; i < pts.length; i++) if (y <= pts[i][0]) return lerp(pts[i - 1][1], pts[i][1], (y - pts[i - 1][0]) / Math.max(1e-4, pts[i][0] - pts[i - 1][0]));
          return cur.lip;
        };
        const yTop = cur.h * 0.78;
        const yBot = cur.h * 0.3;
        const reach = Math.max(0.03, cur.h * 0.2);
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(rAt(yTop) - 0.004, yTop, 0),
          new THREE.Vector3(rAt(yTop) + reach * 0.75, yTop + cur.h * 0.02, 0),
          new THREE.Vector3(rAt((yTop + yBot) / 2) + reach, (yTop + yBot) / 2, 0),
          new THREE.Vector3(rAt(yBot) + reach * 0.55, yBot + cur.h * 0.02, 0),
          new THREE.Vector3(rAt(yBot) - 0.004, yBot, 0),
        ]);
        const old = hm.geometry;
        hm.geometry = new THREE.TubeGeometry(curve, 40, Math.max(0.0055, cur.h * 0.032), 12, false);
        old.dispose();
      }
    }
  });

  const head = useMemo(() => {
    const pts: [number, number][] = [
      [0.0005, -0.03],
      [0.15, -0.03],
      [0.168, -0.022],
      [0.172, -0.01],
      [0.166, 0],
      [0.0005, 0],
    ];
    return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 72);
  }, []);
  return (
    <group ref={spin}>
      <mesh geometry={head} castShadow receiveShadow>
        <meshStandardMaterial color="#B9BCBF" metalness={0.55} roughness={0.42} />
      </mesh>
      <mesh geometry={lathe.geometry} material={mat} castShadow receiveShadow />
      <mesh ref={handleMesh} material={handleMat} castShadow visible={false}>
        <bufferGeometry />
      </mesh>
    </group>
  );
}

/** Keeps the pot nicely framed as its size changes. */
function Framing({ props }: { props: ClayStudioProps }) {
  const live = useRef(props);
  live.current = props;
  const p = useMemo(() => ({} as PotParams), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }, delta) => {
    toParams(live.current, p);
    const r = Math.max(p.belly, p.lip, p.neck, 0.08);
    const fov = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov);
    const fitH = (p.h * 1.25 + 0.06) / (2 * Math.tan(fov / 2));
    const fitW = (r * 2.6) / (2 * Math.tan(fov / 2) * (size.width / Math.max(1, size.height)));
    const dist = Math.max(fitH, fitW, 0.6) * 1.28;
    target.set(0, p.h * 0.42, 0);
    const want = new THREE.Vector3(0, target.y + dist * 0.34, dist * 0.94);
    const k = 1 - Math.exp(-4 * Math.min(delta, 0.05));
    camera.position.lerp(want, k);
    camera.lookAt(target);
  });
  return null;
}

export function ClayStudio({ height, belly, neck, lip, glaze, handle, className }: ClayStudioProps) {
  const props: ClayStudioProps = { height, belly, neck, lip, glaze, handle };
  return (
    <div className={className} style={{ background: 'radial-gradient(120% 90% at 50% 38%, #6B4A33 0%, #3A2819 52%, #1E140D 100%)' }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 30, near: 0.02, far: 20, position: [0, 0.4, 1.3] }}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        style={{ width: '100%', height: '100%' }}
      >
        <Environment resolution={128} frames={1}>
          <color attach="background" args={['#24170F']} />
          <Lightformer form="rect" intensity={3.2} color="#FFE6C8" position={[-2.2, 2.4, 2.2]} scale={[3, 2.2, 1]} target={[0, 0.2, 0]} />
          <Lightformer form="rect" intensity={2.2} color="#FFC890" position={[2.6, 1.4, -1.6]} scale={[0.8, 3, 1]} target={[0, 0.2, 0]} />
          <Lightformer form="ring" intensity={0.8} color="#FFF4E6" position={[0, 3, 0]} rotation-x={Math.PI / 2} scale={2.4} />
        </Environment>
        <ambientLight intensity={0.12} color="#FFE2C6" />
        <directionalLight position={[-1.4, 2.6, 1.8]} intensity={2.4} color="#FFE3C4" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-bias={-0.0004} shadow-normalBias={0.01}>
          <orthographicCamera attach="shadow-camera" args={[-0.5, 0.5, 0.5, -0.5, 0.1, 8]} />
        </directionalLight>
        <Pot props={props} />
        <ContactShadows position={[0, -0.032, 0]} scale={1.1} far={0.5} blur={2.6} opacity={0.6} resolution={256} color="#120A05" />
        <Framing props={props} />
      </Canvas>
    </div>
  );
}

export default ClayStudio;
