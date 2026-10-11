import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Quality, Variant } from '../../core/types';
import { ROOM, WINDOW } from './layout';
import { PRESETS } from './Lights';
import { rng } from './geom';

/* ------------------------------------------------------------------ */
/*  Volumetric sun shafts through the mashrabiya + dust motes.         */
/*  The shaft is a prism (window aperture swept along the sun ray);    */
/*  rays are marched in its skewed local frame so the lattice mask is  */
/*  evaluated directly in window coordinates.                          */
/* ------------------------------------------------------------------ */

const A = WINDOW.w / 2;
const H = WINDOW.h;

/** GLSL: is window point (s, t) open? s ∈ [-A, A] across, t ∈ [0, H] up from the sill. */
const maskGLSL = /* glsl */ `
uniform float uA;
uniform float uH;
float archHalf(float t) {
  float r = uA;
  float spring = uH - r;
  if (t <= spring) return r;
  float s = clamp((t - spring) / r, 0.0, 1.0);
  float tt = s <= 0.5 ? sqrt(s / 2.0) : 1.0 - sqrt((1.0 - s) / 2.0);
  return r * (1.0 - tt);
}
float windowMask(float s, float t, float blur) {
  float inside = smoothstep(-blur, blur, archHalf(t) - abs(s)) * smoothstep(-blur, blur, t) * smoothstep(-blur, blur, uH - t);
  // diagonal lattice: bars along s+t=c and s-t=c, pitch 0.118 in c
  float yc = t - uH * 0.5;
  float p = 0.118;
  float c1 = (s + yc + uA + uH * 0.5 + 0.03 * 2.0) / p;
  float c2 = (s - yc + uA + uH * 0.5 + 0.03 * 2.0) / p;
  float d1 = abs(fract(c1) - 0.5) * p * 0.7071;
  float d2 = abs(fract(c2) - 0.5) * p * 0.7071;
  float bw = 0.0125;
  float open1 = smoothstep(bw - blur, bw + blur, 0.5 * p * 0.7071 - d1);
  float open2 = smoothstep(bw * 0.7 - blur, bw * 0.7 + blur, 0.5 * p * 0.7071 - d2);
  return inside * open1 * open2;
}`;

const shaftVert = /* glsl */ `
varying vec3 vLocal;
void main() {
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const shaftFrag = /* glsl */ `
uniform vec3 uCam;
uniform vec3 uColor;
uniform float uDensity;
uniform float uTime;
uniform mat3 uBasis;
uniform float uSlope;
uniform float uY0;
varying vec3 vLocal;
${maskGLSL}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  bool inside = all(greaterThan(uCam, vec3(0.0))) && all(lessThan(uCam, vec3(1.0)));
  // outside: shade the entry (front) faces; inside: shade the exit (back) faces
  if (inside == gl_FrontFacing) discard;
  vec3 ro = uCam;
  vec3 rd = vLocal - uCam;
  vec3 inv = 1.0 / rd;
  vec3 t0 = -ro * inv;
  vec3 t1 = (vec3(1.0) - ro) * inv;
  vec3 tmin = min(t0, t1);
  vec3 tmax = max(t0, t1);
  float tn = max(max(max(tmin.x, tmin.y), tmin.z), 0.0);
  float tf = min(min(tmax.x, tmax.y), tmax.z);
  if (tf <= tn) discard;
  const int N = 30;
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float acc = 0.0;
  for (int i = 0; i < N; i++) {
    float k = (float(i) + jitter) / float(N);
    vec3 p = ro + rd * mix(tn, tf, k);
    float c = p.z;
    float y = uY0 + p.y * uH + c * uSlope;
    float blur = 0.008 + c * 0.04;
    float m = windowMask((p.x - 0.5) * 2.0 * uA, p.y * uH, blur);
    float fall = pow(max(1.0 - c, 0.0), 1.2) * smoothstep(0.0, 0.04, c) * smoothstep(0.02, 0.5, y);
    acc += m * fall;
  }
  float seg = length(uBasis * (rd * (tf - tn)));
  float d = acc / float(N) * seg * uDensity;
  gl_FragColor = vec4(uColor * d, 1.0);
}`;

const moteVert = /* glsl */ `
uniform float uTime;
uniform float uSize;
uniform float uSlope;
uniform float uY0;
attribute vec4 aSeed;
varying float vLight;
${maskGLSL}
void main() {
  vec3 p = position;
  float t = uTime * 0.04;
  p.x = fract(p.x + sin(t * 1.3 + aSeed.x * 6.28) * 0.02 + t * 0.05 * (aSeed.y - 0.5));
  p.y = fract(p.y + sin(t * 1.7 + aSeed.y * 6.28) * 0.015 + t * 0.03);
  p.z = fract(p.z + t * 0.08 * aSeed.z);
  float m = windowMask((p.x - 0.5) * 2.0 * uA, p.y * uH, 0.006);
  float y = uY0 + p.y * uH + p.z * uSlope;
  float edge = smoothstep(0.0, 0.08, p.z) * (1.0 - smoothstep(0.65, 0.95, p.z)) * smoothstep(0.05, 0.4, y);
  vLight = m * edge * (0.5 + 0.5 * sin(uTime * (0.6 + aSeed.w) + aSeed.x * 20.0));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (0.6 + aSeed.w) / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const moteFrag = /* glsl */ `
uniform vec3 uColor;
varying float vLight;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.0, length(d));
  if (vLight * a < 0.01) discard;
  gl_FragColor = vec4(uColor * vLight * a, 1.0);
}`;

/** Affine frame of the sun prism: unit cube (a, b, c) → design space. */
function prismMatrix(variant: Variant) {
  const d = new THREE.Vector3(...PRESETS[variant].sunDir).normalize().negate(); // travel direction
  const xw = ROOM.x0 - ROOM.t / 2;
  // window origin: bottom of aperture, at s = -A (design z = WINDOW.z + A since s = -(z - zc))
  const origin = new THREE.Vector3(xw, WINDOW.y, WINDOW.z + A);
  const eS = new THREE.Vector3(0, 0, -2 * A); // s from -A → +A runs toward -z
  const eT = new THREE.Vector3(0, H, 0);
  // run until the beam's lowest corner reaches the floor
  const len = (WINDOW.y + H) / -d.y;
  const eC = d.clone().multiplyScalar(len);
  const m = new THREE.Matrix4().makeBasis(eS, eT, eC).setPosition(origin);
  // fraction of the length at which the sill-height ray hits the floor
  const basis = new THREE.Matrix3().setFromMatrix4(m);
  return { m, slope: eC.y, basis };
}

export function SunShafts({ variant, quality }: { variant: Variant; quality: Quality }) {
  const P = PRESETS[variant];
  const mesh = useRef<THREE.Mesh>(null);
  const points = useRef<THREE.Points>(null);
  const { m, slope, basis } = useMemo(() => prismMatrix(variant), [variant]);
  const shaftMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: shaftVert,
        fragmentShader: shaftFrag,
        uniforms: {
          uCam: { value: new THREE.Vector3() },
          uColor: { value: new THREE.Color(P.sun[0]) },
          uDensity: { value: variant === 'golden' ? 0.7 : variant === 'morning' ? 0.38 : 0.3 },
          uTime: { value: 0 },
          uBasis: { value: basis },
          uSlope: { value: slope },
          uY0: { value: WINDOW.y },
          uA: { value: A },
          uH: { value: H },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [P, variant, basis, slope],
  );
  const motes = useMemo(() => {
    const n = quality === 'high' ? 420 : 220;
    const r = rng(77);
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = r();
      pos[i * 3 + 1] = r();
      pos[i * 3 + 2] = r();
      for (let k = 0; k < 4; k++) seed[i * 4 + k] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const mat = new THREE.ShaderMaterial({
      vertexShader: moteVert,
      fragmentShader: moteFrag,
      uniforms: { uTime: { value: 0 }, uSize: { value: 14 }, uSlope: { value: slope }, uY0: { value: WINDOW.y }, uColor: { value: new THREE.Color(P.sun[0]).multiplyScalar(0.9) }, uA: { value: A }, uH: { value: H } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { g, mat };
  }, [quality, P, slope]);
  const box = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0.5, 0.5, 0.5);
    return g;
  }, []);
  const camLocal = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, clock }) => {
    const me = mesh.current;
    if (!me) return;
    camLocal.copy(camera.position);
    me.worldToLocal(camLocal);
    shaftMat.uniforms.uCam.value.copy(camLocal);
    shaftMat.uniforms.uTime.value = clock.elapsedTime;
    motes.mat.uniforms.uTime.value = clock.elapsedTime;
  });
  if (P.sun[1] <= 0) return null;
  return (
    <group matrixAutoUpdate={false} matrix={m} userData={{ noBatch: true }}>
      <mesh ref={mesh} geometry={box} material={shaftMat} frustumCulled={false} renderOrder={6} userData={{ noBatch: true }} />
      {quality !== 'low' && <points ref={points} geometry={motes.g} material={motes.mat} frustumCulled={false} renderOrder={7} />}
    </group>
  );
}
