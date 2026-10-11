import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { makeNoise } from '../../materials/noise';
import type { Quality } from '../../core/types';
import { rng, type Rect } from './layout';

/* ------------------------------------------------------------------ */
/*  Goats and chickens. Each species is a single instanced mesh whose  */
/*  vertex shader poses the neck/head, ears, tail and legs from        */
/*  per-instance attributes; a small behaviour loop (graze, look       */
/*  around, wander, peck) drives those attributes every frame.         */
/* ------------------------------------------------------------------ */

const BODY = 0;
const NECK = 1;
const HEAD = 2;
const EAR_L = 3;
const EAR_R = 4;
const TAIL = 5;
const LEG = 6;

const _p = new THREE.Vector3();
const _n = new THREE.Vector3();

interface PartOpts {
  part: number;
  /** Fixed colour (hooves, horns, comb…). Omit for coat-coloured parts. */
  color?: string;
  pivot?: THREE.Vector3;
  bend?: (p: THREE.Vector3) => number;
  legPhase?: number;
}

/** Accumulates posed parts plus the attributes the animal shader reads. */
class AnimalBuilder {
  pos: number[] = [];
  nrm: number[] = [];
  col: number[] = [];
  coat: number[] = [];
  mask: number[] = [];
  mask2: number[] = [];
  part: number[] = [];
  pivot: number[] = [];
  bend: number[] = [];
  legPh: number[] = [];
  idx: number[] = [];
  constructor(
    private maskFn: (p: THREE.Vector3) => number,
    private mask2Fn: (p: THREE.Vector3) => number,
    private aoFn: (p: THREE.Vector3, n: THREE.Vector3) => number,
  ) {}
  add(g: THREE.BufferGeometry, o: PartOpts) {
    const base = this.pos.length / 3;
    if (!g.attributes.normal) g.computeVertexNormals();
    const P = g.attributes.position as THREE.BufferAttribute;
    const N = g.attributes.normal as THREE.BufferAttribute;
    const fixed = o.color ? new THREE.Color(o.color) : null;
    const pv = o.pivot ?? new THREE.Vector3();
    for (let i = 0; i < P.count; i++) {
      _p.fromBufferAttribute(P, i);
      _n.fromBufferAttribute(N, i);
      this.pos.push(_p.x, _p.y, _p.z);
      this.nrm.push(_n.x, _n.y, _n.z);
      if (fixed) this.col.push(fixed.r, fixed.g, fixed.b);
      else {
        const ao = this.aoFn(_p, _n);
        this.col.push(ao, ao, ao);
      }
      this.coat.push(fixed ? 0 : 1);
      this.mask.push(this.maskFn(_p));
      this.mask2.push(this.mask2Fn(_p));
      this.part.push(o.part);
      this.pivot.push(pv.x, pv.y, pv.z);
      this.bend.push(o.bend ? o.bend(_p) : 0);
      this.legPh.push(o.legPhase ?? 0);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.idx.push(base + g.index.getX(i));
    else for (let i = 0; i < P.count; i++) this.idx.push(base + i);
    g.dispose();
  }
  build() {
    const n = this.pos.length / 3;
    // packed to stay well under the 16 vertex-attribute limit (instancing uses 4 for the matrix)
    const info = new Float32Array(n * 4);
    const rig = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      info.set([this.coat[i], this.mask[i], this.mask2[i], this.bend[i]], i * 4);
      const legShift = this.part[i] === LEG && this.legPh[i] > 1 ? 1 : 0;
      rig.set([this.pivot[i * 3], this.pivot[i * 3 + 1], this.pivot[i * 3 + 2], this.part[i] + legShift], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
    g.setAttribute('aRig', new THREE.BufferAttribute(rig, 4));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

/** Ellipsoid built from a sphere, optionally rotated, at `at`. */
function ellipsoid(r: [number, number, number], at: [number, number, number], ws = 14, hs = 10, rot?: [number, number, number]) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.scale(...r);
  if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)));
  g.translate(...at);
  return g;
}

/** Tube through points with a radius per point (limbs, necks, horns). */
function limb(points: THREE.Vector3[], radii: number[], radial = 8, segs = 8) {
  const curve = new THREE.CatmullRomCurve3(points);
  const pos: number[] = [];
  const idx: number[] = [];
  const up = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPointAt(t);
    const tg = curve.getTangentAt(t);
    const ref = Math.abs(tg.dot(up)) > 0.9 ? new THREE.Vector3(1, 0, 0) : up;
    const nx = new THREE.Vector3().crossVectors(tg, ref).normalize();
    const ny = new THREE.Vector3().crossVectors(tg, nx).normalize();
    const f = t * (radii.length - 1);
    const k = Math.min(radii.length - 2, Math.floor(f));
    const r = THREE.MathUtils.lerp(radii[k], radii[k + 1], f - k);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      pos.push(p.x + (nx.x * Math.cos(a) + ny.x * Math.sin(a)) * r, p.y + (nx.y * Math.cos(a) + ny.y * Math.sin(a)) * r, p.z + (nx.z * Math.cos(a) + ny.z * Math.sin(a)) * r);
    }
  }
  for (let i = 0; i < segs; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/* --------------------------------- Goat --------------------------------- */

const GOAT_PIVOT = V(0, 0.58, 0.25);

function goatGeometry() {
  const nz = makeNoise(5);
  const b = new AnimalBuilder(
    // two-tone: head & neck (Boer-style)
    (p) => THREE.MathUtils.smoothstep(p.z, 0.2, 0.33) * THREE.MathUtils.smoothstep(p.y, 0.58, 0.7),
    // blotches
    (p) => THREE.MathUtils.smoothstep(nz(p.x * 5 + p.z * 3.1 + 7, p.y * 5.5 - p.z * 2.3 + 3, 4096, 4096), 0.05, 0.22),
    // baked occlusion: darker belly, inner legs, under the jaw
    (p, n) => {
      let ao = 1;
      if (n.y < -0.2) ao *= THREE.MathUtils.lerp(1, 0.7, Math.min(1, -n.y));
      ao *= THREE.MathUtils.lerp(0.78, 1, THREE.MathUtils.smoothstep(p.y, 0.05, 0.42));
      return ao;
    },
  );
  // Barrel: chest deeper than rump, softly sagging belly
  const body = new THREE.SphereGeometry(1, 24, 16);
  {
    const P = body.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i);
      const y = P.getY(i);
      const z = P.getZ(i);
      let sx = 0.158;
      let sy = 0.178;
      if (z > 0) {
        sy *= 1 + 0.12 * z;
        sx *= 1 + 0.06 * z;
      } else sx *= 1 - 0.08 * -z;
      let yy = y * sy * (y > 0 ? 0.92 : 1);
      if (y < 0) yy -= 0.03 * (1 - z * z) * -y;
      P.setXYZ(i, x * sx, yy + 0.57, z * 0.38 - 0.02);
    }
    body.computeVertexNormals();
  }
  b.add(body, { part: BODY });
  // Neck: bends progressively toward the head
  const neckA = V(0, 0.6, 0.24);
  const neckB = V(0, 0.84, 0.46);
  const axis = neckB.clone().sub(neckA);
  const axisLen = axis.length();
  axis.normalize();
  b.add(limb([neckA, V(0, 0.72, 0.36), neckB], [0.1, 0.082, 0.066], 12, 6), {
    part: NECK,
    bend: (p) => THREE.MathUtils.clamp(p.clone().sub(neckA).dot(axis) / axisLen, 0, 1),
  });
  // Head: skull + long muzzle, angled down
  const headRot: [number, number, number] = [0.55, 0, 0];
  b.add(ellipsoid([0.08, 0.088, 0.118], [0, 0.905, 0.505], 14, 10, headRot), { part: HEAD });
  b.add(ellipsoid([0.054, 0.058, 0.1], [0, 0.85, 0.6], 12, 8, [0.75, 0, 0]), { part: HEAD });
  b.add(ellipsoid([0.03, 0.024, 0.02], [0, 0.8, 0.665], 8, 6), { part: HEAD, color: '#3A2C27' }); // nose
  for (const s of [-1, 1]) {
    b.add(ellipsoid([0.015, 0.015, 0.015], [s * 0.066, 0.92, 0.545], 8, 6), { part: HEAD, color: '#120C08' }); // eyes
    // long drooping ears, hinged at the skull
    const pivot = V(s * 0.07, 0.945, 0.48);
    const ear = new THREE.SphereGeometry(1, 10, 8);
    ear.scale(0.022, 0.125, 0.058);
    ear.translate(0, -0.115, 0);
    ear.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.35, 0, s * 1.05)));
    ear.translate(pivot.x, pivot.y, pivot.z);
    b.add(ear, { part: s < 0 ? EAR_L : EAR_R, pivot });
    // swept-back horns
    b.add(limb([V(s * 0.035, 0.975, 0.47), V(s * 0.05, 1.05, 0.43), V(s * 0.065, 1.075, 0.36), V(s * 0.075, 1.055, 0.31)], [0.02, 0.014, 0.008, 0.003], 6, 6), {
      part: HEAD,
      color: '#6E6152',
    });
  }
  // beard
  const beard = new THREE.ConeGeometry(0.02, 0.085, 6);
  beard.rotateX(Math.PI);
  beard.translate(0, 0.765, 0.585);
  b.add(beard, { part: HEAD });
  // tail (wags)
  const tailPivot = V(0, 0.67, -0.41);
  const tail = new THREE.ConeGeometry(0.026, 0.13, 7);
  tail.translate(0, 0.065, 0);
  tail.rotateX(-0.5);
  tail.translate(tailPivot.x, tailPivot.y, tailPivot.z);
  b.add(tail, { part: TAIL, pivot: tailPivot });
  // legs: front straight, hind with a hock; diagonal pairs move together
  const legs: [number, number, boolean, number][] = [
    [-0.085, 0.24, true, 0],
    [0.085, 0.24, true, Math.PI],
    [-0.08, -0.27, false, Math.PI],
    [0.08, -0.27, false, 0],
  ];
  for (const [x, z, front, ph] of legs) {
    const hip = V(x, 0.52, z);
    const pts = front
      ? [hip, V(x, 0.26, z + 0.012), V(x, 0.07, z + 0.005), V(x, 0.02, z + 0.012)]
      : [hip, V(x, 0.3, z - 0.08), V(x, 0.2, z - 0.06), V(x, 0.06, z - 0.02), V(x, 0.02, z - 0.01)];
    b.add(limb(pts, front ? [0.06, 0.038, 0.027, 0.025] : [0.07, 0.045, 0.031, 0.027, 0.025], 8, 8), { part: LEG, pivot: hip, legPhase: ph });
    const hoof = new THREE.CylinderGeometry(0.024, 0.03, 0.045, 8);
    hoof.translate(x, 0.02, z + (front ? 0.012 : -0.01));
    b.add(hoof, { part: LEG, pivot: hip, legPhase: ph, color: '#2A2420' });
  }
  return b.build();
}

/* -------------------------------- Chicken -------------------------------- */

const HEN_PIVOT = V(0, 0.235, 0.055);

function chickenGeometry() {
  const nz = makeNoise(9);
  const b = new AnimalBuilder(
    // hackles & tail (rooster/two-tone breeds)
    (p) => Math.max(THREE.MathUtils.smoothstep(p.z, 0.04, 0.09) * THREE.MathUtils.smoothstep(p.y, 0.24, 0.29), THREE.MathUtils.smoothstep(-p.z, 0.08, 0.13)),
    // speckles
    (p) => THREE.MathUtils.smoothstep(nz(p.x * 40 + 3, p.y * 38 + p.z * 31, 4096, 4096), 0.0, 0.18),
    (_p, n) => (n.y < -0.3 ? 0.75 : 1),
  );
  b.add(ellipsoid([0.085, 0.092, 0.13], [0, 0.2, -0.015], 16, 12, [-0.35, 0, 0]), { part: BODY });
  b.add(ellipsoid([0.07, 0.075, 0.065], [0, 0.205, 0.065], 12, 8), { part: BODY });
  for (const s of [-1, 1]) b.add(ellipsoid([0.022, 0.058, 0.1], [s * 0.074, 0.215, -0.02], 10, 8, [-0.5, 0, s * 0.12]), { part: BODY });
  // tail fan
  for (const [a, y] of [
    [-0.5, 0.3],
    [0, 0.31],
    [0.5, 0.3],
  ] as [number, number][])
    b.add(ellipsoid([0.012, 0.075, 0.035], [Math.sin(a) * 0.025, y, -0.13], 8, 6, [-0.55, a * 0.4, a * 0.5]), { part: TAIL, pivot: V(0, 0.24, -0.11) });
  // neck + head
  const nA = V(0, 0.23, 0.05);
  const nB = V(0, 0.315, 0.1);
  const ax = nB.clone().sub(nA);
  const L = ax.length();
  ax.normalize();
  b.add(limb([nA, V(0, 0.28, 0.07), nB], [0.042, 0.034, 0.03], 10, 4), {
    part: NECK,
    bend: (p) => THREE.MathUtils.clamp(p.clone().sub(nA).dot(ax) / L, 0, 1),
  });
  b.add(ellipsoid([0.033, 0.036, 0.04], [0, 0.33, 0.112], 12, 8), { part: HEAD });
  const beak = new THREE.ConeGeometry(0.011, 0.034, 6);
  beak.rotateX(Math.PI / 2 + 0.35);
  beak.translate(0, 0.322, 0.158);
  b.add(beak, { part: HEAD, color: '#D9A33A' });
  for (const [y, z, r] of [
    [0.368, 0.1, 0.014],
    [0.372, 0.117, 0.016],
    [0.366, 0.134, 0.013],
  ] as [number, number, number][])
    b.add(ellipsoid([0.008, r, r], [0, y, z], 8, 6), { part: HEAD, color: '#C42A1E' }); // comb
  b.add(ellipsoid([0.008, 0.016, 0.01], [0, 0.297, 0.137], 6, 6), { part: HEAD, color: '#B8261C' }); // wattle
  for (const s of [-1, 1]) b.add(ellipsoid([0.007, 0.007, 0.007], [s * 0.029, 0.338, 0.128], 6, 4), { part: HEAD, color: '#1A1208' });
  // legs + toes
  for (const s of [-1, 1]) {
    const hip = V(s * 0.03, 0.14, 0);
    b.add(limb([hip, V(s * 0.032, 0.07, 0.01), V(s * 0.032, 0.012, 0.015)], [0.011, 0.008, 0.007], 5, 3), { part: LEG, pivot: hip, legPhase: s > 0 ? 0 : Math.PI, color: '#D9A33A' });
    for (const a of [-0.45, 0, 0.45, Math.PI]) {
      const toe = new THREE.BoxGeometry(0.008, 0.006, 0.045);
      toe.translate(0, 0.004, 0.022);
      toe.rotateY(a);
      toe.translate(s * 0.032, 0, 0.015);
      b.add(toe, { part: LEG, pivot: hip, legPhase: s > 0 ? 0 : Math.PI, color: '#C8952F' });
    }
  }
  return b.build();
}

/* ------------------------------- Material -------------------------------- */

/** Rig declarations + posing shared by the colour and the shadow-depth programs. */
const POSE_GLSL = /* glsl */ `
  uniform vec3 uHeadPivot;
  uniform float uLegSwing;
  attribute vec4 aInfo;  // coat, two-tone mask, blotch mask, neck bend
  attribute vec4 aRig;   // pivot.xyz, part id (legs: 6 = phase 0, 7 = phase pi)
  attribute vec4 iCoatA; // rgb + pattern
  attribute vec3 iCoatB;
  attribute vec4 iPose;  // head yaw, head pitch, ear flick, tail
  attribute vec2 iWalk;  // stride phase, walk amount
  mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
  mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
  mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
  void animalPose(inout vec3 p, inout vec3 n) {
    float part = aRig.w;
    vec3 piv = aRig.xyz;
    if (part > 2.5 && part < 4.5) {
      float sd = part < 3.5 ? -1.0 : 1.0;
      mat3 R = rotZ(sd * iPose.z * 0.6) * rotX(-abs(iPose.z) * 0.25);
      p = R * (p - piv) + piv; n = R * n;
    }
    if (part > 0.5 && part < 4.5) {
      float k = part < 1.5 ? aInfo.w : 1.0;
      mat3 R = rotY(iPose.x * k) * rotX(iPose.y * k);
      p = R * (p - uHeadPivot) + uHeadPivot; n = R * n;
    }
    if (part > 4.5 && part < 5.5) {
      mat3 R = rotZ(iPose.w) * rotX(-abs(iPose.w) * 0.3);
      p = R * (p - piv) + piv; n = R * n;
    }
    if (part > 5.5) {
      float ph = part > 6.5 ? 3.14159 : 0.0;
      mat3 R = rotX(sin(iWalk.x + ph) * uLegSwing * iWalk.y);
      p = R * (p - piv) + piv; n = R * n;
    }
  }
`;

function animalMaterial(pivot: THREE.Vector3, legSwing: number, roughness: number) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness: 0 });
  mat.onBeforeCompile = (s) => {
    s.uniforms.uHeadPivot = { value: pivot };
    s.uniforms.uLegSwing = { value: legSwing };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\n${POSE_GLSL}\nvarying vec3 vCoat;\nvarying float vCoatAmt;`)
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
         vec3 animP = vec3(position);
         animalPose(animP, objectNormal);
         float patt = iCoatA.w < 0.5 ? 0.0 : (iCoatA.w < 1.5 ? aInfo.y : aInfo.z);
         vCoat = mix(iCoatA.rgb, iCoatB, patt);
         vCoatAmt = aInfo.x;`,
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = animP;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCoat;\nvarying float vCoatAmt;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vCoat, vCoatAmt);');
  };
  mat.customProgramCacheKey = () => 'farm-animal';
  return mat;
}

/** Shadow pass with the same pose, so a grazing goat casts a head-down shadow. */
function animalDepthMaterial(pivot: THREE.Vector3, legSwing: number) {
  const mat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  mat.onBeforeCompile = (s) => {
    s.uniforms.uHeadPivot = { value: pivot };
    s.uniforms.uLegSwing = { value: legSwing };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\n${POSE_GLSL}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n{ vec3 nIgnored = vec3(0.0, 1.0, 0.0); animalPose(transformed, nIgnored); }');
  };
  mat.customProgramCacheKey = () => 'farm-animal-depth';
  return mat;
}

/* ------------------------------- Behaviour ------------------------------- */

export interface Obstacle {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

interface Agent {
  x: number;
  z: number;
  y: number;
  heading: number;
  mode: 'graze' | 'look' | 'walk' | 'peck';
  timer: number;
  tx: number;
  tz: number;
  yaw: number;
  pitch: number;
  yawT: number;
  pitchT: number;
  ear: number;
  earT: number;
  tail: number;
  tailT: number;
  walkPh: number;
  walk: number;
  sub: number;
  fixed: boolean;
  area: Rect;
  r: () => number;
}

function blocked(x: number, z: number, area: Rect, obstacles: Obstacle[], margin: number) {
  if (x < area.x0 + margin || x > area.x1 - margin || z < area.z0 + margin || z > area.z1 - margin) return true;
  return obstacles.some((o) => x > o.x0 - margin && x < o.x1 + margin && z > o.z0 - margin && z < o.z1 + margin);
}

function pickTarget(a: Agent, obstacles: Obstacle[], others: Agent[], reach: number, margin: number) {
  for (let k = 0; k < 14; k++) {
    const ang = a.heading + (a.r() - 0.5) * 2.6;
    const d = reach * (0.35 + a.r() * 0.65);
    const tx = a.x + Math.sin(ang) * d;
    const tz = a.z + Math.cos(ang) * d;
    let ok = !blocked(tx, tz, a.area, obstacles, margin);
    for (let s = 1; ok && s < 6; s++) {
      const f = s / 6;
      if (blocked(a.x + (tx - a.x) * f, a.z + (tz - a.z) * f, a.area, obstacles, margin * 0.7)) ok = false;
    }
    if (ok && others.some((o) => o !== a && Math.hypot(o.x - tx, o.z - tz) < margin * 2.4)) ok = false;
    if (ok) {
      a.tx = tx;
      a.tz = tz;
      return true;
    }
  }
  return false;
}

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const approach = (v: number, t: number, rate: number, dt: number) => v + (t - v) * (1 - Math.exp(-rate * dt));

/* ------------------------------- Components ------------------------------ */

export interface AnimalSpawn {
  x: number;
  z: number;
  y?: number;
  heading: number;
  coatA: string;
  coatB: string;
  pattern: 0 | 1 | 2;
  scale?: number;
  /** Stays put (e.g. a goat standing on the climbing platform). */
  fixed?: boolean;
  /** Wander area (defaults to the herd area). */
  area?: Rect;
}

function useAnimalInstances(spawns: AnimalSpawn[], area: Rect, seed: number) {
  return useMemo(
    () =>
      spawns.map<Agent>((s, i) => {
        const r = rng(seed + i * 17);
        return {
          x: s.x,
          z: s.z,
          y: s.y ?? 0,
          heading: s.heading,
          mode: 'look',
          timer: 0.5 + r() * 3,
          tx: s.x,
          tz: s.z,
          yaw: 0,
          pitch: 0,
          yawT: 0,
          pitchT: 0,
          ear: 0,
          earT: 0,
          tail: 0,
          tailT: 0,
          walkPh: r() * 6,
          walk: 0,
          sub: 0,
          fixed: !!s.fixed,
          area: s.area ?? area,
          r,
        };
      }),
    [spawns, area, seed],
  );
}

function setupInstanceAttributes(geo: THREE.BufferGeometry, spawns: AnimalSpawn[]) {
  const n = spawns.length;
  const ca = new Float32Array(n * 4);
  const cb = new Float32Array(n * 3);
  const c = new THREE.Color();
  spawns.forEach((s, i) => {
    c.set(s.coatA);
    ca.set([c.r, c.g, c.b, s.pattern], i * 4);
    c.set(s.coatB);
    cb.set([c.r, c.g, c.b], i * 3);
  });
  const g = geo.clone();
  g.setAttribute('iCoatA', new THREE.InstancedBufferAttribute(ca, 4));
  g.setAttribute('iCoatB', new THREE.InstancedBufferAttribute(cb, 3));
  const pose = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
  pose.setUsage(THREE.DynamicDrawUsage);
  const walk = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2);
  walk.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('iPose', pose);
  g.setAttribute('iWalk', walk);
  return { geo: g, pose, walk };
}

const _o = new THREE.Object3D();

export type Herd = MutableRefObject<{ x: number; z: number }[]>;

export function Goats({ spawns, area, obstacles, quality, herd }: { spawns: AnimalSpawn[]; area: Rect; obstacles: Obstacle[]; quality: Quality; herd?: Herd }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const base = useMemo(() => goatGeometry(), []);
  const mat = useMemo(() => animalMaterial(GOAT_PIVOT, 0.42, 0.92), []);
  const depth = useMemo(() => animalDepthMaterial(GOAT_PIVOT, 0.42), []);
  const inst = useMemo(() => setupInstanceAttributes(base, spawns), [base, spawns]);
  const agents = useAnimalInstances(spawns, area, 101);

  const write = (mesh: THREE.InstancedMesh) => {
    agents.forEach((a, i) => {
      _o.position.set(a.x, a.y, a.z);
      _o.rotation.set(0, a.heading, 0);
      _o.scale.setScalar(spawns[i].scale ?? 1);
      _o.updateMatrix();
      mesh.setMatrixAt(i, _o.matrix);
      inst.pose.setXYZW(i, a.yaw, a.pitch, a.ear, a.tail);
      inst.walk.setXY(i, a.walkPh, a.walk);
    });
    mesh.instanceMatrix.needsUpdate = true;
    inst.pose.needsUpdate = true;
    inst.walk.needsUpdate = true;
  };
  useLayoutEffect(() => {
    if (ref.current) write(ref.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents, inst]);

  useFrame((_, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    const dt = Math.min(delta, 0.05);
    for (const a of agents) {
      a.timer -= dt;
      if (a.timer <= 0) {
        const roll = a.r();
        if (!a.fixed && roll < 0.3 && pickTarget(a, obstacles, agents, 3.2, 0.55)) {
          a.mode = 'walk';
          a.timer = 12;
        } else if (roll < 0.68) {
          a.mode = 'graze';
          a.timer = 3 + a.r() * 6;
          a.yawT = (a.r() - 0.5) * 0.5;
        } else {
          a.mode = 'look';
          a.timer = 2 + a.r() * 4;
          a.sub = 0;
        }
      }
      let speed = 0;
      if (a.mode === 'walk') {
        const dx = a.tx - a.x;
        const dz = a.tz - a.z;
        const d = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz);
        const turn = wrapAngle(want - a.heading);
        a.heading += THREE.MathUtils.clamp(turn, -1.6 * dt, 1.6 * dt);
        const aligned = Math.max(0, Math.cos(turn));
        speed = 0.34 * aligned * Math.min(1, d / 0.4);
        a.x += Math.sin(a.heading) * speed * dt;
        a.z += Math.cos(a.heading) * speed * dt;
        a.pitchT = 0.18;
        a.yawT = THREE.MathUtils.clamp(turn, -0.4, 0.4);
        if (d < 0.08) a.timer = 0;
      } else if (a.mode === 'graze') {
        a.pitchT = 1.45 + Math.sin(a.walkPh * 0.5 + a.timer * 2.1) * 0.06;
        if (a.r() < dt * 0.25) a.yawT = (a.r() - 0.5) * 0.7;
        // occasional step while grazing
        if (!a.fixed && a.r() < dt * 0.15) a.heading += (a.r() - 0.5) * 0.4;
      } else {
        a.sub -= dt;
        if (a.sub <= 0) {
          a.sub = 0.8 + a.r() * 1.8;
          a.yawT = (a.r() - 0.5) * 1.5;
          a.pitchT = -0.25 + a.r() * 0.35;
        }
        // chewing cud: a slow rhythmic nod
        a.pitchT += Math.sin(performance.now() * 0.006 + a.walkPh) * 0.015;
      }
      a.walk = approach(a.walk, speed > 0.02 ? 1 : 0, 6, dt);
      a.walkPh += dt * speed * 22;
      a.yaw = approach(a.yaw, a.yawT, 3, dt);
      a.pitch = approach(a.pitch, a.pitchT, a.mode === 'graze' ? 1.6 : 2.6, dt);
      // ear flicks and tail wags come in short bursts
      if (a.r() < dt * 0.5) a.earT = (a.r() - 0.3) * 1.4;
      a.earT = approach(a.earT, 0, 1.2, dt);
      a.ear = approach(a.ear, a.earT + Math.sin(performance.now() * 0.002 + a.walkPh) * 0.08, 10, dt);
      a.tailT = a.r() < dt * 0.3 ? 1 : approach(a.tailT, 0, 0.8, dt);
      a.tail = Math.sin(performance.now() * 0.03 + a.walkPh) * 0.55 * a.tailT;
    }
    // keep the herd from walking through each other
    for (const a of agents)
      for (const b of agents) {
        if (a === b || a.fixed) continue;
        const dx = a.x - b.x;
        const dz = a.z - b.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.001 && d < 0.75) {
          a.x += (dx / d) * (0.75 - d) * 0.5;
          a.z += (dz / d) * (0.75 - d) * 0.5;
        }
      }
    // never get shoved through the fence
    for (const a of agents) {
      a.x = THREE.MathUtils.clamp(a.x, a.area.x0 + 0.45, a.area.x1 - 0.45);
      a.z = THREE.MathUtils.clamp(a.z, a.area.z0 + 0.45, a.area.z1 - 0.45);
    }
    if (herd) herd.current = agents;
    write(mesh);
  });

  return (
    <instancedMesh
      ref={ref}
      args={[inst.geo, mat, spawns.length]}
      castShadow={quality !== 'low'}
      receiveShadow
      frustumCulled={false}
      customDepthMaterial={depth}
      userData={{ noBatch: true }}
    />
  );
}

export function Chickens({ spawns, area, obstacles, avoid, quality }: { spawns: AnimalSpawn[]; area: Rect; obstacles: Obstacle[]; avoid?: Herd; quality: Quality }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const base = useMemo(() => chickenGeometry(), []);
  const mat = useMemo(() => animalMaterial(HEN_PIVOT, 0.65, 0.8), []);
  const depth = useMemo(() => animalDepthMaterial(HEN_PIVOT, 0.65), []);
  const inst = useMemo(() => setupInstanceAttributes(base, spawns), [base, spawns]);
  const agents = useAnimalInstances(spawns, area, 303);

  const write = (mesh: THREE.InstancedMesh) => {
    agents.forEach((a, i) => {
      _o.position.set(a.x, a.y + Math.abs(Math.sin(a.walkPh)) * 0.012 * a.walk, a.z);
      _o.rotation.set(0, a.heading, 0);
      _o.scale.setScalar(spawns[i].scale ?? 1);
      _o.updateMatrix();
      mesh.setMatrixAt(i, _o.matrix);
      inst.pose.setXYZW(i, a.yaw, a.pitch, 0, a.tail);
      inst.walk.setXY(i, a.walkPh, a.walk);
    });
    mesh.instanceMatrix.needsUpdate = true;
    inst.pose.needsUpdate = true;
    inst.walk.needsUpdate = true;
  };
  useLayoutEffect(() => {
    if (ref.current) write(ref.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents, inst]);

  useFrame((_, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    const dt = Math.min(delta, 0.05);
    for (const a of agents) {
      a.timer -= dt;
      if (a.timer <= 0) {
        const roll = a.r();
        if (roll < 0.4 && pickTarget(a, obstacles, agents, 1.6, 0.22)) {
          a.mode = 'walk';
          a.timer = 8;
        } else if (roll < 0.8) {
          a.mode = 'peck';
          a.timer = 1.2 + a.r() * 2.5;
          a.sub = 0;
        } else {
          a.mode = 'look';
          a.timer = 1 + a.r() * 2;
          a.sub = 0;
        }
      }
      let speed = 0;
      if (a.mode === 'walk') {
        const dx = a.tx - a.x;
        const dz = a.tz - a.z;
        const d = Math.hypot(dx, dz);
        const turn = wrapAngle(Math.atan2(dx, dz) - a.heading);
        a.heading += THREE.MathUtils.clamp(turn, -4 * dt, 4 * dt);
        speed = 0.3 * Math.max(0, Math.cos(turn)) * Math.min(1, d / 0.15);
        a.x += Math.sin(a.heading) * speed * dt;
        a.z += Math.cos(a.heading) * speed * dt;
        // the head bobs forward and back with each stride
        a.pitchT = 0.12 + Math.sin(a.walkPh * 2) * 0.12;
        a.yawT = 0;
        if (d < 0.04) a.timer = 0;
        if (avoid?.current.some((g) => Math.hypot(g.x - a.x, g.z - a.z) < 0.55)) a.timer = 0;
      } else if (a.mode === 'peck') {
        a.sub -= dt;
        if (a.sub <= 0) {
          // quick strike down, slower recovery
          a.sub = 0.28 + a.r() * 0.35;
          a.pitchT = a.pitchT > 0.6 ? 0.05 : 1.05;
          a.yawT = (a.r() - 0.5) * 0.4;
        }
      } else {
        a.sub -= dt;
        if (a.sub <= 0) {
          a.sub = 0.35 + a.r() * 0.6;
          a.yawT = (a.r() - 0.5) * 1.6;
          a.pitchT = -0.2 + a.r() * 0.2;
        }
      }
      a.walk = approach(a.walk, speed > 0.02 ? 1 : 0, 10, dt);
      a.walkPh += dt * speed * 42;
      // chickens snap their heads — fast response
      a.yaw = approach(a.yaw, a.yawT, 14, dt);
      a.pitch = approach(a.pitch, a.pitchT, a.mode === 'peck' ? 18 : 10, dt);
      a.tailT = approach(a.tailT, 0, 2, dt);
      if (a.r() < dt * 0.2) a.tailT = 0.35;
      a.tail = Math.sin(performance.now() * 0.02 + a.walkPh) * a.tailT;
    }
    for (const a of agents)
      for (const b of agents) {
        if (a === b) continue;
        const dx = a.x - b.x;
        const dz = a.z - b.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.001 && d < 0.26) {
          a.x = THREE.MathUtils.clamp(a.x + (dx / d) * (0.26 - d) * 0.5, a.area.x0 + 0.2, a.area.x1 - 0.2);
          a.z = THREE.MathUtils.clamp(a.z + (dz / d) * (0.26 - d) * 0.5, a.area.z0 + 0.2, a.area.z1 - 0.2);
        }
      }
    write(mesh);
  });

  return (
    <instancedMesh
      ref={ref}
      args={[inst.geo, mat, spawns.length]}
      castShadow={quality === 'high'}
      receiveShadow
      frustumCulled={false}
      customDepthMaterial={depth}
      userData={{ noBatch: true }}
    />
  );
}

/** A few hens scratching about freely between the harvest station and the south wall. */
const FREE_AREA: Rect = { x0: 10.6, x1: 20.6, z0: 19.9, z1: 23.3 };
export function FreeRange({ quality }: { quality: Quality }) {
  const spawns = useMemo<AnimalSpawn[]>(() => {
    const all: AnimalSpawn[] = [
      { x: 12.4, z: 21.2, heading: 0.4, coatA: '#9A5A2E', coatB: '#5B321A', pattern: 2 },
      { x: 16.8, z: 22.1, heading: -1.8, coatA: '#EEE8DC', coatB: '#D8D0C0', pattern: 0 },
      { x: 19.2, z: 20.8, heading: 2.6, coatA: '#B9763E', coatB: '#6B3E1E', pattern: 2, scale: 0.95 },
    ];
    return all.slice(0, quality === 'high' ? 3 : quality === 'medium' ? 2 : 0);
  }, [quality]);
  const obstacles = useMemo<Obstacle[]>(
    () => [
      { x0: 15.1, x1: 16.0, z0: 19.0, z1: 20.0 }, // wash tub
      { x0: 11.8, x1: 12.8, z0: 21.9, z1: 22.9 }, // ghaf trunk
    ],
    [],
  );
  if (!spawns.length) return null;
  return <Chickens spawns={spawns} area={FREE_AREA} obstacles={obstacles} quality={quality} />;
}

/* --------------------------------- Saluki --------------------------------- */

const DOG_PIVOT = V(0, 0.62, 0.24);

function salukiGeometry() {
  const b = new AnimalBuilder(
    // feathering on the ears and tail is a shade darker
    (p) => Math.max(THREE.MathUtils.smoothstep(-p.z, 0.3, 0.36), THREE.MathUtils.smoothstep(Math.abs(p.x), 0.038, 0.05) * THREE.MathUtils.smoothstep(p.y, 0.78, 0.84) * (p.z < 0.45 ? 1 : 0)),
    () => 0,
    (p, n) => (n.y < -0.3 ? 0.78 : 1) * THREE.MathUtils.lerp(0.85, 1, THREE.MathUtils.smoothstep(p.y, 0.05, 0.4)),
  );
  // deep chest, tucked-up waist
  const body = new THREE.SphereGeometry(1, 22, 14);
  {
    const P = body.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i);
      const y = P.getY(i);
      const z = P.getZ(i);
      const front = THREE.MathUtils.smoothstep(z, -0.3, 0.55);
      const sx = 0.082 + 0.036 * front;
      const syTop = 0.085 + 0.012 * front;
      const syBot = 0.065 + 0.105 * front;
      P.setXYZ(i, x * sx, (y > 0 ? y * syTop : y * syBot) + 0.585, z * 0.31 - 0.02);
    }
    body.computeVertexNormals();
  }
  b.add(body, { part: BODY });
  const nA = V(0, 0.62, 0.22);
  const nB = V(0, 0.86, 0.37);
  const ax = nB.clone().sub(nA);
  const L = ax.length();
  ax.normalize();
  b.add(limb([nA, V(0, 0.76, 0.31), nB], [0.07, 0.055, 0.046], 10, 5), { part: NECK, bend: (p) => THREE.MathUtils.clamp(p.clone().sub(nA).dot(ax) / L, 0, 1) });
  b.add(ellipsoid([0.05, 0.056, 0.076], [0, 0.89, 0.41], 12, 8, [0.25, 0, 0]), { part: HEAD });
  b.add(ellipsoid([0.029, 0.031, 0.09], [0, 0.86, 0.505], 10, 8, [0.35, 0, 0]), { part: HEAD });
  b.add(ellipsoid([0.016, 0.014, 0.014], [0, 0.83, 0.578], 8, 6), { part: HEAD, color: '#1E1612' });
  for (const s of [-1, 1]) {
    b.add(ellipsoid([0.009, 0.009, 0.009], [s * 0.028, 0.9, 0.455], 6, 4), { part: HEAD, color: '#120C08' });
    const pivot = V(s * 0.04, 0.905, 0.39);
    const ear = new THREE.SphereGeometry(1, 8, 8);
    ear.scale(0.013, 0.092, 0.046);
    ear.translate(0, -0.075, 0);
    ear.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.2, 0, s * 0.45)));
    ear.translate(pivot.x, pivot.y, pivot.z);
    b.add(ear, { part: s < 0 ? EAR_L : EAR_R, pivot });
  }
  const tailPivot = V(0, 0.56, -0.3);
  b.add(limb([tailPivot, V(0, 0.42, -0.37), V(0, 0.29, -0.38), V(0, 0.24, -0.31), V(0, 0.27, -0.26)], [0.02, 0.017, 0.014, 0.011, 0.006], 6, 10), { part: TAIL, pivot: tailPivot });
  const legs: [number, number, boolean, number][] = [
    [-0.045, 0.19, true, 0],
    [0.045, 0.19, true, Math.PI],
    [-0.05, -0.23, false, Math.PI],
    [0.05, -0.23, false, 0],
  ];
  for (const [x, z, front, ph] of legs) {
    const hip = V(x, 0.53, z);
    const pts = front ? [hip, V(x, 0.33, z - 0.01), V(x, 0.07, z + 0.005), V(x, 0.025, z + 0.03)] : [hip, V(x, 0.37, z + 0.05), V(x, 0.18, z - 0.08), V(x, 0.06, z - 0.05), V(x, 0.025, z - 0.03)];
    b.add(limb(pts, front ? [0.048, 0.029, 0.021, 0.02] : [0.068, 0.04, 0.025, 0.021, 0.02], 7, 8), { part: LEG, pivot: hip, legPhase: ph });
    b.add(ellipsoid([0.02, 0.014, 0.03], [x, 0.014, z + (front ? 0.035 : -0.02)], 8, 6), { part: LEG, pivot: hip, legPhase: ph });
  }
  return b.build();
}

/** A Saluki patrolling between waypoints: trots, stops to sniff, looks about. */
export function Saluki({ path, quality }: { path: [number, number][]; quality: Quality }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const base = useMemo(() => salukiGeometry(), []);
  const mat = useMemo(() => animalMaterial(DOG_PIVOT, 0.62, 0.85), []);
  const depth = useMemo(() => animalDepthMaterial(DOG_PIVOT, 0.62), []);
  const spawns = useMemo<AnimalSpawn[]>(() => [{ x: path[0][0], z: path[0][1], heading: 0, coatA: '#C08A58', coatB: '#7E4F2E', pattern: 1 }], [path]);
  const inst = useMemo(() => setupInstanceAttributes(base, spawns), [base, spawns]);
  const st = useRef({ i: 1, dir: 1, x: path[0][0], z: path[0][1], heading: -Math.PI / 2, mode: 'walk' as 'walk' | 'sniff' | 'look', timer: 2, yaw: 0, pitch: 0, yawT: 0, pitchT: 0, ph: 0, walk: 0, ear: 0, tail: 0, sub: 0, r: rng(77) });
  useFrame((_, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    const dt = Math.min(delta, 0.05);
    const a = st.current;
    let speed = 0;
    if (a.mode === 'walk') {
      const [tx, tz] = path[a.i];
      const dx = tx - a.x;
      const dz = tz - a.z;
      const d = Math.hypot(dx, dz);
      const turn = wrapAngle(Math.atan2(dx, dz) - a.heading);
      a.heading += THREE.MathUtils.clamp(turn, -2.2 * dt, 2.2 * dt);
      speed = 0.85 * Math.max(0, Math.cos(turn)) * Math.min(1, d / 0.5);
      a.x += Math.sin(a.heading) * speed * dt;
      a.z += Math.cos(a.heading) * speed * dt;
      a.pitchT = 0.15;
      a.yawT = THREE.MathUtils.clamp(turn * 0.5, -0.4, 0.4);
      if (d < 0.15) {
        const end = a.i === 0 || a.i === path.length - 1;
        if (end) a.dir = -a.dir;
        a.i += a.dir;
        if (end || a.r() < 0.35) {
          a.mode = a.r() < 0.55 ? 'sniff' : 'look';
          a.timer = 2 + a.r() * 3.5;
          a.sub = 0;
        }
      }
    } else {
      a.timer -= dt;
      a.sub -= dt;
      if (a.sub <= 0) {
        a.sub = 0.6 + a.r() * 1.2;
        if (a.mode === 'sniff') {
          a.pitchT = 0.95 + a.r() * 0.25;
          a.yawT = (a.r() - 0.5) * 0.6;
        } else {
          a.pitchT = -0.15 + a.r() * 0.2;
          a.yawT = (a.r() - 0.5) * 1.4;
        }
      }
      if (a.timer <= 0) a.mode = 'walk';
    }
    a.walk = approach(a.walk, speed > 0.05 ? 1 : 0, 6, dt);
    a.ph += dt * speed * 13;
    a.yaw = approach(a.yaw, a.yawT, 4, dt);
    a.pitch = approach(a.pitch, a.pitchT, 3.5, dt);
    a.ear = Math.sin(a.ph * 2) * 0.25 * a.walk + Math.sin(performance.now() * 0.0013) * 0.05;
    a.tail = Math.sin(performance.now() * (a.walk > 0.5 ? 0.012 : 0.006)) * (0.18 + 0.12 * a.walk);
    _o.position.set(a.x, Math.abs(Math.sin(a.ph)) * 0.015 * a.walk, a.z);
    _o.rotation.set(0, a.heading, 0);
    _o.scale.setScalar(1.05);
    _o.updateMatrix();
    mesh.setMatrixAt(0, _o.matrix);
    mesh.instanceMatrix.needsUpdate = true;
    inst.pose.setXYZW(0, a.yaw, a.pitch, a.ear, a.tail);
    inst.walk.setXY(0, a.ph, a.walk);
    inst.pose.needsUpdate = true;
    inst.walk.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={ref}
      args={[inst.geo, mat, 1]}
      castShadow={quality !== 'low'}
      receiveShadow
      frustumCulled={false}
      customDepthMaterial={depth}
      userData={{ noBatch: true }}
    />
  );
}
