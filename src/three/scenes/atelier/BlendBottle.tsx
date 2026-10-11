import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/*  Signature Blend bottle: a faceted crystal flacon on a velvet &     */
/*  brass plinth. The liquid is a spiral gradient of the chosen note   */
/*  colours, refracting the scene; its level eases to `fill`.          */
/* ------------------------------------------------------------------ */

const SIDES = 12;
const V = (pts: [number, number][]) => pts.map(([r, y]) => new THREE.Vector2(r, y));
const BODY: [number, number][] = [[0.001, 0], [0.036, 0], [0.043, 0.008], [0.049, 0.045], [0.052, 0.085], [0.047, 0.108], [0.031, 0.122], [0.014, 0.128], [0.012, 0.142]];
const LIQ_TOP = 0.1;

function faceted(pts: [number, number][], sides = SIDES) {
  const g = new THREE.LatheGeometry(V(pts), sides).toNonIndexed();
  g.computeVertexNormals();
  return g;
}

/** Inner liquid volume (facetted like the shell) with a spiral colour gradient baked per vertex. */
function liquidGeometry(colors: THREE.Color[]) {
  const g = new THREE.LatheGeometry(V([[0.001, 0.007], [0.033, 0.007], [0.0395, 0.013], [0.045, 0.045], [0.0475, LIQ_TOP], [0.001, LIQ_TOP + 0.0005]]), SIDES * 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  const n = colors.length;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const h = (p.getY(i) - 0.007) / (LIQ_TOP - 0.007);
    const swirl = Math.sin(Math.atan2(z, x) * 2 + h * 9) * 0.07;
    // index 0 at the top (top notes) … last at the bottom (base notes)
    const t = THREE.MathUtils.clamp(1 - h + swirl, 0, 1) * (n - 1);
    const k = Math.min(n - 2, Math.floor(t));
    if (n === 1) c.copy(colors[0]);
    else c.copy(colors[k]).lerp(colors[k + 1], t - k);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function rimGlass() {
  const m = new THREE.MeshPhysicalMaterial({ color: '#080808', roughness: 0.03, clearcoat: 0.5, clearcoatRoughness: 0.05, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, envMapIntensity: 1.15 });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      'outgoingLight += vec3(1.0, 0.9, 0.78) * 0.26 * pow(1.0 - saturate(abs(dot(normal, normalize(vViewPosition)))), 2.4);\n#include <opaque_fragment>',
    );
  };
  m.customProgramCacheKey = () => 'blend-rim';
  return m;
}

function backdropTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 132, 6, 128, 128, 150);
  grd.addColorStop(0, '#E2B27A');
  grd.addColorStop(0.18, '#A86C36');
  grd.addColorStop(0.42, '#3E2514');
  grd.addColorStop(1, '#120B07');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Bottle({ colors, fill }: { colors: string[]; fill: number }) {
  const spin = useRef<THREE.Group>(null);
  const liquid = useRef<THREE.Mesh>(null);
  const level = useRef(0);
  const palette = useMemo(() => (colors.length ? colors : ['#C2722A']).map((c) => new THREE.Color(c)), [colors]);
  const liquidGeo = useMemo(() => liquidGeometry(palette), [palette]);
  const mean = useMemo(() => palette.reduce((a, c) => a.add(c), new THREE.Color(0, 0, 0)).multiplyScalar(1 / palette.length), [palette]);
  const liquidMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.04,
        transmission: 1,
        thickness: 0.07,
        ior: 1.36,
        attenuationColor: mean.clone().lerp(new THREE.Color(1, 1, 1), 0.45),
        attenuationDistance: 0.22,
        specularIntensity: 0.6,
        envMapIntensity: 1.2,
      }),
    [mean],
  );
  const shell = useMemo(() => faceted(BODY), []);
  const glass = useMemo(() => rimGlass(), []);
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: '#D9B36C', metalness: 1, roughness: 0.3, envMapIntensity: 1.8 }), []);
  const cap = useMemo(() => faceted([[0.001, 0.138], [0.018, 0.138], [0.022, 0.146], [0.026, 0.168], [0.022, 0.19], [0.012, 0.2], [0.001, 0.202]], 8), []);
  const collar = useMemo(() => new THREE.CylinderGeometry(0.0145, 0.0145, 0.008, 32).translate(0, 0.137, 0), []);
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    if (spin.current) spin.current.rotation.y += d * 0.35;
    level.current = THREE.MathUtils.damp(level.current, THREE.MathUtils.clamp(fill, 0, 1), 2.4, d);
    const l = liquid.current;
    if (l) {
      l.scale.y = Math.max(0.001, level.current);
      l.visible = level.current > 0.01;
      l.rotation.y -= d * 0.22; // the blend swirls gently inside the turning flacon
    }
  });
  return (
    <group ref={spin} position={[0, 0.034, 0]}>
      <mesh ref={liquid} geometry={liquidGeo} material={liquidMat} />
      <mesh geometry={shell} material={glass} renderOrder={2} />
      <mesh geometry={cap} material={gold} castShadow />
      <mesh geometry={collar} material={gold} />
    </group>
  );
}

function Plinth() {
  const brass = useMemo(() => new THREE.MeshStandardMaterial({ color: '#B88C4A', metalness: 1, roughness: 0.28 }), []);
  const velvet = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#2A070C', roughness: 0.95, sheen: 0.8, sheenColor: new THREE.Color('#7A2E36'), sheenRoughness: 0.5 }), []);
  return (
    <group>
      <mesh material={brass} position={[0, 0.008, 0]} receiveShadow>
        <cylinderGeometry args={[0.105, 0.112, 0.016, 64]} />
      </mesh>
      <mesh material={velvet} position={[0, 0.025, 0]} receiveShadow>
        <cylinderGeometry args={[0.094, 0.098, 0.018, 64]} />
      </mesh>
      <mesh material={brass} position={[0, 0.0305, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.095, 0.003, 10, 64]} />
      </mesh>
    </group>
  );
}

/** Keeps the plinth in frame for any container aspect (pulls back when narrow). */
function FitCamera() {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const d = 0.7 * Math.max(1, 0.8 / aspect);
    camera.position.set(0, 0.115 + 0.055 * (d / 0.7), d);
    camera.lookAt(0, 0.115, 0);
  }, [camera, size.width, size.height]);
  return null;
}

export function BlendBottle({ colors, fill, className }: { colors: string[]; fill: number; className?: string }) {
  const backdrop = useMemo(() => backdropTexture(), []);
  return (
    <div className={className} style={{ position: 'relative', background: '#140D09' }}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0.17, 0.7], fov: 28, near: 0.01, far: 10 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <color attach="background" args={['#140D09']} />
        <FitCamera />
        <Environment resolution={128} frames={1}>
          <color attach="background" args={['#1A110B']} />
          <Lightformer form="rect" intensity={1.4} color="#FFE7CC" position={[0, 3, 1]} scale={[3, 1.5, 1]} />
          <Lightformer form="ring" intensity={1.2} color="#FFD9A8" position={[0, 2.2, 0]} rotation={[Math.PI / 2, 0, 0]} scale={4} />
          <Lightformer form="rect" intensity={2.2} color="#FFF4E6" position={[-2, 0.6, 1.2]} scale={[0.3, 3, 1]} />
          <Lightformer form="rect" intensity={1.6} color="#FFD3A0" position={[2, 0.6, 0.8]} scale={[0.3, 3, 1]} />
          <Lightformer form="circle" intensity={1.6} color="#FFB36A" position={[0, 0.4, -2.5]} scale={1.2} />
          <Lightformer form="rect" intensity={0.55} color="#FFE9D0" position={[0.6, 0.9, 3]} scale={[1.6, 1, 1]} />
          <Lightformer form="rect" intensity={0.9} color="#C88A4E" position={[0, -1.6, 0.6]} scale={[3, 3, 1]} />
        </Environment>
        <mesh position={[0, 0.11, -0.42]}>
          <planeGeometry args={[1.5, 1.0]} />
          <meshBasicMaterial map={backdrop} toneMapped={false} />
        </mesh>
        <ambientLight intensity={0.08} color="#FFE6CC" />
        <directionalLight position={[-0.4, 0.7, 0.5]} intensity={2.2} color="#FFE2BE" />
        <Plinth />
        <Bottle colors={colors} fill={fill} />
        <ContactShadows position={[0, 0.0352, 0]} scale={0.2} blur={2.6} opacity={0.7} far={0.08} resolution={256} color="#000000" />
      </Canvas>
    </div>
  );
}

export default BlendBottle;
