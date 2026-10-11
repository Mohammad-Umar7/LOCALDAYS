import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as THREE from 'three';
import { smoothLathe } from '../../props/geo';
import type { Quality, Variant, Vec3 } from '../../core/types';
import type { AtelierMaterials } from './materials';
import { BURNERS } from './layout';
import { chunk, rng, squareLoft } from './geom';
import { atelierMap } from './textures';
import { Baked } from './Baked';

/* ------------------------------------------------------------------ */
/*  Mabkhara: square-based flared incense burners in carved wood,      */
/*  brass and clay, glowing charcoal and curling smoke ribbons.        */
/* ------------------------------------------------------------------ */

/* --------------------------------- Smoke --------------------------------- */

const smokeVert = /* glsl */ `
uniform float uTime;
attribute vec3 aOrigin;
attribute vec4 aParams; // height, width at base, width at top, seed
varying vec2 vUv;
varying float vH;
varying float vSeed;
void main() {
  vUv = uv;
  float v = uv.y;
  float h = v * aParams.x;
  float t = uTime;
  float s = aParams.w;
  float amp = v * v * 0.7 + v * 0.2;
  vec3 c = aOrigin + vec3(
    sin(h * 7.0 - t * 1.25 + s) * 0.04 * amp + sin(h * 17.0 - t * 2.1 + s * 1.7) * 0.012 * v + sin(t * 0.23 + s) * 0.07 * v * v,
    h,
    cos(h * 6.0 - t * 1.1 + s * 2.3) * 0.04 * amp + cos(h * 13.0 - t * 1.7 + s) * 0.01 * v
  );
  vec4 mv = modelViewMatrix * vec4(c, 1.0);
  float w = mix(aParams.y, aParams.z, pow(v, 0.85)) * (0.7 + 0.3 * sin(h * 9.0 - t * 1.6 + s));
  mv.x += (uv.x - 0.5) * w;
  vH = v;
  vSeed = s;
  gl_Position = projectionMatrix * mv;
}`;

const smokeFrag = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
varying float vH;
varying float vSeed;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { float a = 0.5; float s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
  float x = vUv.x - 0.5;
  float edge = 1.0 - smoothstep(0.08, 0.5, abs(x));
  vec2 q = vec2(vUv.x * 2.2 + vSeed, vH * 4.5 - uTime * 0.5);
  float n = fbm(q + vec2(fbm(q * 1.6 + uTime * 0.08 + vSeed), 0.0) * 1.4);
  float wisps = smoothstep(0.32, 0.78, n);
  float thread = 1.0 - smoothstep(0.0, 0.22, vH);
  float body = mix(wisps, 1.0, thread * 0.6);
  float fade = smoothstep(0.0, 0.05, vH) * (1.0 - smoothstep(0.4, 1.0, vH));
  float a = edge * body * fade * uOpacity;
  gl_FragColor = vec4(uColor * (1.0 + thread * 0.25), a);
}`;

const SMOKE_LOOK: Record<Variant, [string, number]> = {
  morning: ['#C9CACC', 0.42],
  golden: ['#E3C9A6', 0.48],
  dusk: ['#B9A28E', 0.5],
};

const smokeTime = { value: 0 };

export interface SmokeSource {
  p: Vec3;
  seed: number;
  height: number;
  scale?: number;
}

/** Every smoke ribbon in one mesh: camera-facing strips displaced in the vertex shader. */
export function SmokePlumes({ sources, variant }: { sources: SmokeSource[]; variant: Variant }) {
  const geo = useMemo(() => {
    const ribbons: [number, number, number, number][] = [
      [1, 0.012, 0.16, 0.3],
      [0.8, 0.008, 0.11, 2.1],
      [0.6, 0.01, 0.08, 4.7],
    ];
    const base = new THREE.PlaneGeometry(1, 1, 1, 56).toNonIndexed();
    const n = base.attributes.position.count;
    const parts: THREE.BufferGeometry[] = [];
    for (const src of sources)
      for (const [hk, w0, w1, sd] of ribbons) {
        const g = base.clone();
        const k = src.scale ?? 1;
        const o = new Float32Array(n * 3);
        const pr = new Float32Array(n * 4);
        for (let i = 0; i < n; i++) {
          o.set(src.p, i * 3);
          pr.set([src.height * hk * k, w0 * k, w1 * k, src.seed * 3.1 + sd], i * 4);
        }
        g.setAttribute('aOrigin', new THREE.BufferAttribute(o, 3));
        g.setAttribute('aParams', new THREE.BufferAttribute(pr, 4));
        parts.push(g);
      }
    const merged = mergeGeometries(parts, false)!;
    parts.forEach((p) => p.dispose());
    return merged;
  }, [sources]);
  const mat = useMemo(() => {
    const [c, o] = SMOKE_LOOK[variant];
    return new THREE.ShaderMaterial({
      vertexShader: smokeVert,
      fragmentShader: smokeFrag,
      uniforms: { uTime: smokeTime, uColor: { value: new THREE.Color(c) }, uOpacity: { value: o } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, [variant]);
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={5} userData={{ noBatch: true }} />;
}

export function SmokeClock() {
  useFrame((_, dt) => {
    smokeTime.value += Math.min(dt, 0.05);
  });
  return null;
}

/* -------------------------------- Burners -------------------------------- */

const MAB_PROFILE: [number, number][] = [
  [0.072, 0],
  [0.074, 0.008],
  [0.07, 0.016],
  [0.063, 0.022],
  [0.058, 0.031],
  [0.047, 0.06],
  [0.037, 0.093],
  [0.034, 0.11],
  [0.04, 0.12],
  [0.062, 0.15],
  [0.084, 0.184],
  [0.092, 0.2],
  [0.094, 0.207],
  [0.087, 0.208],
  [0.079, 0.194],
  [0.0002, 0.186],
];
export const MAB_TOP = 0.186;

function mabkharaGeos() {
  return {
    body: squareLoft(MAB_PROFILE, 0.18, 4),
    bandLow: squareLoft([[0.0755, 0.004], [0.0755, 0.014]], 0.18, 4, false),
    bandRim: squareLoft([[0.0955, 0.197], [0.0955, 0.209]], 0.18, 4, false),
    bandWaist: squareLoft([[0.0375, 0.1], [0.0375, 0.113]], 0.18, 4, false),
  };
}

type Style = 'wood' | 'brass' | 'clay';

function Mabkhara({ m, style, scale = 1, lit = false, glow }: { m: AtelierMaterials; style: Style; scale?: number; lit?: boolean; glow: THREE.Material }) {
  const g = useMemo(() => mabkharaGeos(), []);
  const studGeo = useMemo(() => new THREE.SphereGeometry(0.0055, 8, 6), []);
  const body = style === 'wood' ? m.ebony : style === 'brass' ? m.brass : m.clay;
  const band = style === 'clay' ? m.giftRed : m.brass;
  const studs = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let f = 0; f < 4; f++) {
      const rot = new THREE.Matrix4().makeRotationY((f * Math.PI) / 2);
      for (let k = -1; k <= 1; k++) {
        out.push(rot.clone().multiply(new THREE.Matrix4().makeTranslation(k * 0.03, 0.04, 0.054)));
        out.push(rot.clone().multiply(new THREE.Matrix4().makeTranslation(k * 0.036, 0.165, 0.075)));
      }
    }
    return out;
  }, []);
  const coals = useMemo(() => {
    const r = rng(scale * 100);
    return Array.from({ length: 5 }, (_, i) =>
      new THREE.Matrix4().compose(
        new THREE.Vector3((r() - 0.5) * 0.07, MAB_TOP + 0.008 + r() * 0.006, (r() - 0.5) * 0.07),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)),
        new THREE.Vector3(0.018 + r() * 0.008, 0.012, 0.016 + (i % 2) * 0.006),
      ),
    );
  }, [scale]);
  return (
    <group scale={scale}>
      <mesh geometry={g.body} material={body} castShadow receiveShadow />
      <mesh geometry={g.bandLow} material={band} />
      <mesh geometry={g.bandRim} material={band} />
      <mesh geometry={g.bandWaist} material={band} />
      {style !== 'clay' && (
        <Baked geo={studGeo} mats={studs} material={style === 'wood' ? m.brass : m.gold} />
      )}
      {/* ash bed, coals, a sliver of bukhoor */}
      <mesh material={m.ash} position={[0, MAB_TOP + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.15, 0.15]} />
      </mesh>
      {lit && (
        <>
          <Baked geo={chunk(61, 1, [1, 1, 1], 0.3)} mats={coals} material={m.charcoal} receive={false} />
          <mesh material={glow} position={[0, MAB_TOP + 0.03, 0]}>
            <sphereGeometry args={[0.032, 16, 8]} />
          </mesh>
          <mesh geometry={chunk(62, 1, [1, 1, 1], 0.3)} material={m.bukhoor} position={[0.01, MAB_TOP + 0.022, -0.005]} scale={[0.02, 0.008, 0.014]} rotation={[0.2, 0.7, 0]} />
        </>
      )}
    </group>
  );
}

/** Round brass burner with a pierced dome lid; the piercings glow. */
function LiddedBurner({ m, lit, scale = 1 }: { m: AtelierMaterials; lit: boolean; scale?: number }) {
  const body = useMemo(() => smoothLathe([[0.001, 0], [0.058, 0], [0.06, 0.008], [0.04, 0.02], [0.026, 0.05], [0.028, 0.07], [0.05, 0.086], [0.07, 0.11], [0.072, 0.12]], 48, 40), []);
  const lid = useMemo(() => {
    const g = smoothLathe([[0.073, 0.118], [0.071, 0.14], [0.056, 0.175], [0.032, 0.2], [0.013, 0.21], [0.014, 0.226], [0.005, 0.24], [0.001, 0.25]], 48, 40).clone();
    // stretch the pierced pattern around the dome
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 2.2);
    return g;
  }, []);
  const lidMat = useMemo(() => {
    const t = atelierMap('piercedLantern').clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: m.brass.map, color: '#E0B870', metalness: 1, roughness: 0.3, emissive: '#FF8A3A', emissiveMap: t, emissiveIntensity: lit ? 2.2 : 0 });
  }, [m, lit]);
  return (
    <group scale={scale}>
      <mesh geometry={body} material={m.brass} castShadow receiveShadow />
      <mesh geometry={lid} material={lidMat} castShadow />
      {[0, 1].map((k) => (
        <mesh key={k} material={m.brass} position={[k ? 0.078 : -0.078, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.014, 0.003, 6, 16]} />
        </mesh>
      ))}
    </group>
  );
}

const TRAY_TOP = 0.24;
const SMOKE_SOURCES: SmokeSource[] = [
  { p: [-0.14, TRAY_TOP + MAB_TOP * 1.1 + 0.01, 0.06], seed: 1, height: 0.9 },
  { p: [0.15, TRAY_TOP + MAB_TOP * 0.8 + 0.01, -0.1], seed: 2, height: 0.75, scale: 0.8 },
  { p: [0.12, TRAY_TOP + 0.25, 0.18], seed: 3, height: 0.8, scale: 0.85 },
  { p: [0.78, 0.004 + MAB_TOP * 1.75 + 0.01, -0.62], seed: 4, height: 1.25, scale: 1.2 },
];

export function Burners({ m, variant, quality }: { m: AtelierMaterials; variant: Variant; quality: Quality }) {
  const glow = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#FF7A2A').multiplyScalar(1.6), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }),
    [],
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const f = 0.85 + Math.sin(t * 3.1) * 0.08 + Math.sin(t * 7.7 + 1.3) * 0.05 + Math.sin(t * 13.3) * 0.03;
    m.charcoal.emissiveIntensity = 1.5 * f;
    glow.opacity = 0.16 * f;
  });
  const tray = useMemo(() => smoothLathe([[0.001, 0], [0.34, 0], [0.36, 0.012], [0.37, 0.03], [0.365, 0.034], [0.33, 0.016], [0.001, 0.014]], 64, 16), []);
  const smoke = quality !== 'low';
  const T = TRAY_TOP;
  const items: { style: Style | 'lid'; p: Vec3; s: number; lit: boolean; r: number }[] = [
    { style: 'brass', p: [-0.14, T, 0.06], s: 1.1, lit: true, r: 0.3 },
    { style: 'clay', p: [0.15, T, -0.1], s: 0.8, lit: true, r: -0.4 },
    { style: 'lid', p: [0.12, T, 0.18], s: 1, lit: true, r: 0 },
  ];
  return (
    <group position={[BURNERS.x, 0, BURNERS.z]}>
      {/* low brass tray-table */}
      <group position={[0, T - 0.03, 0]}>
        <mesh geometry={tray} material={m.brass} castShadow receiveShadow />
      </group>
      {[0, 1, 2, 3].map((k) => {
        const a = (k / 4) * Math.PI * 2 + 0.4;
        return (
          <mesh key={k} material={m.walnut} position={[Math.cos(a) * 0.22, (T - 0.03) / 2, Math.sin(a) * 0.22]} rotation={[Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2]} castShadow>
            <cylinderGeometry args={[0.014, 0.018, T - 0.02, 10]} />
          </mesh>
        );
      })}
      {items.map((it, i) => (
        <group key={i} position={it.p} rotation={[0, it.r, 0]}>
          {it.style === 'lid' ? <LiddedBurner m={m} lit={it.lit} /> : <Mabkhara m={m} style={it.style} scale={it.s} lit={it.lit} glow={glow} />}
        </group>
      ))}
      {/* the grand carved floor mabkhara */}
      <group position={[0.78, 0.004, -0.62]} rotation={[0, 0.5, 0]}>
        <Mabkhara m={m} style="wood" scale={1.75} lit glow={glow} />
      </group>
      {smoke && <SmokePlumes sources={SMOKE_SOURCES} variant={variant} />}
    </group>
  );
}
