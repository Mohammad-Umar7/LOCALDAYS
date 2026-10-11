import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { archPath } from '../../props/geo';
import type { Quality, Variant } from '../../core/types';
import { rand } from './geometry';
import { ARCHES, BEVEL, COURT, FY } from './layout';
import { sunColor, sunDir } from './sun';

/* ------------------------------------------------------------------ */
/*  Light you can almost touch: soft volumetric shafts of sun pouring  */
/*  through the arcade's arches (built along the real sun direction    */
/*  for each mood) with dust motes drifting inside them.               */
/* ------------------------------------------------------------------ */

/** Outline of one arched opening in the arcade wall, as (z, y) points. */
function archOutline(zc: number) {
  const path = new THREE.Path();
  const w = ARCHES.w - BEVEL * 2;
  archPath(path, 0, ARCHES.sill + BEVEL, w, ARCHES.h - BEVEL * 2, 'pointed');
  const pts = path.getPoints(4).map((p) => new THREE.Vector2(zc + p.x, p.y));
  // drop the closing duplicate and any zero-length edges
  return pts.filter((p, i) => p.distanceTo(pts[(i + 1) % pts.length]) > 1e-4);
}

const shaftVert = /* glsl */ `
  attribute float aT;
  varying float vT;
  varying vec3 vWorld;
  varying vec3 vN;
  void main() {
    vT = aT;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const shaftFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;
  uniform float uFloor;
  varying float vT;
  varying vec3 vWorld;
  varying vec3 vN;
  void main() {
    vec3 V = normalize(cameraPosition - vWorld);
    float facing = abs(dot(vN, V));
    float soft = pow(facing, 1.3);
    float along = smoothstep(0.0, 0.06, vT) * (1.0 - smoothstep(0.35, 1.0, vT));
    float floorFade = smoothstep(uFloor, uFloor + 0.7, vWorld.y);
    float motes = 0.78 + 0.22 * sin(vWorld.x * 2.7 + vWorld.y * 4.1 + uTime * 0.35) * sin(vWorld.z * 3.3 - vWorld.y * 1.7 - uTime * 0.27);
    float a = uIntensity * soft * along * floorFade * motes;
    gl_FragColor = vec4(uColor, a);
  }
`;

const dustVert = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uScale;
  attribute vec4 aSeed;
  varying float vA;
  void main() {
    vec3 p = position;
    float t = uTime * (0.35 + aSeed.w * 0.4);
    p += vec3(sin(t * 0.7 + aSeed.x * 6.28), sin(t * 0.43 + aSeed.y * 6.28) * 0.6, cos(t * 0.53 + aSeed.z * 6.28)) * 0.09;
    p.y += sin(t * 0.21 + aSeed.x * 12.0) * 0.12;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uScale * (0.5 + aSeed.y) / -mv.z;
    vA = 0.45 + 0.55 * sin(uTime * (0.8 + aSeed.z * 1.6) + aSeed.w * 30.0);
  }
`;
const dustFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColor, a * a * vA * uOpacity);
  }
`;

export function Atmosphere({ variant, quality }: { variant: Variant; quality: Quality }) {
  const dir = useMemo(() => sunDir(variant), [variant]);
  const color = useMemo(() => sunColor(variant).lerp(new THREE.Color('#FFF4E0'), 0.25), [variant]);

  const shafts = useMemo(() => {
    const L = dir.clone().multiplyScalar(-1);
    const pos: number[] = [];
    const nor: number[] = [];
    const tt: number[] = [];
    const idx: number[] = [];
    const xFace = COURT.x1;
    for (const zc of ARCHES.z) {
      const pts = archOutline(zc);
      const top = ARCHES.sill + ARCHES.h;
      const len = Math.min(16, (top - FY + 0.6) / Math.max(0.05, -L.y));
      const base = pos.length / 3;
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const a = new THREE.Vector3(xFace, pts[i].y, pts[i].x);
        const b = a.clone().addScaledVector(L, len);
        // outward normal of this side face (perpendicular to the edge and the sweep)
        const nxt = pts[(i + 1) % n];
        const edge = new THREE.Vector3(0, nxt.y - pts[i].y, nxt.x - pts[i].x);
        const nn = new THREE.Vector3().crossVectors(edge, L).normalize();
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
        nor.push(nn.x, nn.y, nn.z, nn.x, nn.y, nn.z);
        tt.push(0, 1);
      }
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const a0 = base + i * 2;
        const a1 = base + j * 2;
        idx.push(a0, a0 + 1, a1, a1, a0 + 1, a1 + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }, [dir]);

  const intensity = (variant === 'dusk' ? 0.15 : variant === 'golden' ? 0.11 : 0.07) * (quality === 'low' ? 0.6 : 1);
  const shaftMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: shaftVert,
        fragmentShader: shaftFrag,
        uniforms: { uColor: { value: color }, uIntensity: { value: intensity }, uTime: { value: 0 }, uFloor: { value: FY } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [color, intensity],
  );

  const count = quality === 'high' ? 650 : quality === 'medium' ? 320 : 0;
  const dust = useMemo(() => {
    const r = rand(77);
    const L = dir.clone().multiplyScalar(-1);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    const outlines = ARCHES.z.map((z) => archOutline(z));
    for (let i = 0; i < count; i++) {
      const k = i % ARCHES.z.length;
      const o = outlines[k];
      // random point inside the opening (rejection-free: lerp between sides at a height)
      const y = ARCHES.sill + 0.1 + r() * (ARCHES.h - 0.4);
      const half = (ARCHES.w / 2 - 0.08) * (y > ARCHES.sill + ARCHES.h * 0.72 ? 1 - (y - ARCHES.sill - ARCHES.h * 0.72) / (ARCHES.h * 0.3) : 1);
      const z = ARCHES.z[k] + (r() * 2 - 1) * Math.max(0.05, half);
      void o;
      const t = Math.pow(r(), 1.4) * Math.min(7, (y - FY) / Math.max(0.05, -L.y)) * 0.95;
      const p = new THREE.Vector3(COURT.x1, y, z).addScaledVector(L, t);
      pos.set([p.x, p.y, p.z], i * 3);
      seed.set([r(), r(), r(), r()], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    g.computeBoundingSphere();
    return g;
  }, [dir, count]);
  const dustMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: dustVert,
        fragmentShader: dustFrag,
        uniforms: { uTime: { value: 0 }, uSize: { value: 0.009 }, uScale: { value: 1400 }, uColor: { value: color.clone().lerp(new THREE.Color('#ffffff'), 0.3) }, uOpacity: { value: variant === 'morning' ? 0.35 : 0.55 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [color, variant],
  );

  useFrame(({ clock, gl, camera }) => {
    shaftMat.uniforms.uTime.value = clock.elapsedTime;
    dustMat.uniforms.uTime.value = clock.elapsedTime;
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 35;
    dustMat.uniforms.uScale.value = gl.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
  });

  return (
    <group userData={{ noBatch: true }}>
      <mesh geometry={shafts} material={shaftMat} renderOrder={5} frustumCulled={false} />
      {count > 0 && <points geometry={dust} material={dustMat} renderOrder={6} frustumCulled={false} />}
    </group>
  );
}
