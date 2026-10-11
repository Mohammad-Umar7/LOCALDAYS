import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { windUniforms } from '../../materials/wind';
import type { Quality, Vec3 } from '../../core/types';
import { flowerHead, getFlowers } from './flowers';
import { DEMO_INDEX, groundY, HIVE, hiveEntrance, HIVES, MEADOWS, OBS_EXIT, pavilionGround, rng, WATER_DISH } from './layout';

/* ------------------------------------------------------------------ */
/*  Honey bees: striped bodies with translucent wings that flutter in  */
/*  the vertex shader. Foragers commute between hive entrances and    */
/*  the wildflowers, young bees do orientation loops at the entrance, */
/*  others hop flower to flower or fetch water. ~2.7 cm for legibility.*/
/* ------------------------------------------------------------------ */

export const BEE_SCALE = 0.03;

function paint(g: THREE.BufferGeometry, fn: (x: number, y: number, z: number) => THREE.Color) {
  const p = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const c = fn(p.getX(i), p.getY(i), p.getZ(i));
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function bodyGeometry(withWings = false) {
  const dark = new THREE.Color('#1E160F');
  const amber = new THREE.Color('#D9962A');
  const fuzz = new THREE.Color('#8A5E2A');
  const fuzzTop = new THREE.Color('#B07C3A');
  const head = new THREE.SphereGeometry(0.13, 6, 4);
  head.scale(1, 0.92, 0.88);
  head.translate(0, 0.02, 0.37);
  paint(head, () => dark);
  const thorax = new THREE.SphereGeometry(0.17, 7, 5);
  thorax.translate(0, 0.035, 0.15);
  paint(thorax, (_x, y) => fuzz.clone().lerp(fuzzTop, THREE.MathUtils.clamp((y - 0.03) / 0.17, 0, 1)));
  const abd = new THREE.SphereGeometry(1, 7, 9);
  abd.rotateX(Math.PI / 2);
  abd.scale(0.175, 0.16, 0.32);
  abd.translate(0, 0, -0.2);
  paint(abd, (_x, _y, z) => {
    const t = (z + 0.52) / 0.64; // 0 tail → 1 waist
    if (t < 0.1) return dark;
    if (t > 0.86) return amber.clone().multiplyScalar(0.85);
    return Math.floor(t * 7.5) % 2 === 0 ? dark : amber;
  });
  const parts: THREE.BufferGeometry[] = [head, thorax, abd];
  if (withWings) {
    // folded wings lying over the abdomen (resting bees)
    const wing = new THREE.Color('#7E7A70');
    for (const sd of [-1, 1]) {
      const w = new THREE.CircleGeometry(1, 8);
      w.rotateX(-Math.PI / 2);
      w.scale(0.085, 1, 0.33);
      w.translate(0, 0, -0.33);
      w.rotateY(sd * 0.18);
      w.translate(sd * 0.05, 0.2, 0.17);
      paint(w, () => wing);
      parts.push(w);
    }
  }
  const merged = mergeGeometries(
    parts.map((g) => {
      g.deleteAttribute('uv');
      return g.index ? g.toNonIndexed() : g;
    }),
    false,
  );
  merged.computeVertexNormals();
  return merged;
}

function wingGeometry(spread: number) {
  const parts: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    for (const [len, wid, ang, off] of [
      [0.44, 0.15, 0.42, 0],
      [0.3, 0.1, 0.62, -0.06],
    ] as [number, number, number, number][]) {
      const g = new THREE.CircleGeometry(1, 10);
      g.rotateX(-Math.PI / 2);
      g.scale(wid, 1, len);
      g.translate(0, 0, -len * 0.92);
      g.rotateY(s * (ang + spread));
      g.translate(s * 0.05, 0.19, 0.2 + off);
      const p = g.attributes.position as THREE.BufferAttribute;
      g.setAttribute('aWing', new THREE.BufferAttribute(new Float32Array(p.count).fill(s), 1));
      g.deleteAttribute('uv');
      parts.push(g.toNonIndexed());
    }
  }
  const merged = mergeGeometries(parts, false);
  merged.computeVertexNormals();
  return merged;
}

function wingMaterial(flap: number) {
  const m = new THREE.MeshStandardMaterial({
    color: '#E6EEF2',
    transparent: true,
    opacity: flap > 0 ? 0.34 : 0.5,
    roughness: 0.15,
    metalness: 0.05,
    envMapIntensity: 1.6,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  m.onBeforeCompile = (s) => {
    s.uniforms.uTime = windUniforms.uTime;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aWing;\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         {
           #ifdef USE_INSTANCING
             float ph = instanceMatrix[3][0] * 57.0 + instanceMatrix[3][2] * 31.0;
           #else
             float ph = 0.0;
           #endif
           float ang = ${flap > 0 ? `(0.35 + sin( uTime * 157.0 + ph ) * 0.85) * aWing` : '0.0'};
           vec3 hinge = vec3( aWing * 0.05, 0.19, 0.0 );
           vec3 q = transformed - hinge;
           float c = cos( ang );
           float sn = sin( ang );
           q.xy = vec2( c * q.x - sn * q.y, sn * q.x + c * q.y );
           transformed = q + hinge;
         }`,
      );
  };
  m.customProgramCacheKey = () => `bee-wing-${flap}`;
  return m;
}

let assets: ReturnType<typeof buildAssets> | null = null;
function buildAssets() {
  return {
    body: bodyGeometry(),
    restBody: bodyGeometry(true),
    wingsFly: wingGeometry(0.15),
    bodyMat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 }),
    flyMat: wingMaterial(1),
  };
}
export function useBeeAssets() {
  if (!assets) assets = buildAssets();
  return assets;
}

/** Flying bees: a body mesh plus a flapping-wing mesh sharing one instance-matrix buffer. Resting bees are one mesh. */
function useLinked(count: number, flying: boolean) {
  const a = useBeeAssets();
  const body = useRef<THREE.InstancedMesh>(null);
  const wings = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (body.current && wings.current) wings.current.instanceMatrix = body.current.instanceMatrix;
  }, [count]);
  const el = flying ? (
    <>
      <instancedMesh ref={body} args={[a.body, a.bodyMat, Math.max(1, count)]} frustumCulled={false} />
      <instancedMesh ref={wings} args={[a.wingsFly, a.flyMat, Math.max(1, count)]} frustumCulled={false} />
    </>
  ) : (
    <instancedMesh ref={body} args={[a.restBody, a.bodyMat, Math.max(1, count)]} frustumCulled={false} />
  );
  return { body, wings, el };
}

/* ------------------------------ Bees on comb ------------------------------ */

/** Worker bees crawling over both faces of a comb (local XY plane, faces ±Z). */
export function CombBees({ width, height, depth, count, seed = 1, sides = 2 }: { width: number; height: number; depth: number; count: number; seed?: number; sides?: number }) {
  const { body, el } = useLinked(count, false);
  const data = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, (_, i) => ({
      x: (r() - 0.5) * width * 0.9,
      y: (r() - 0.5) * height * 0.86,
      side: sides === 1 ? 1 : i % 2 === 0 ? 1 : -1,
      heading: r() * Math.PI * 2,
      speed: 0.004 + r() * 0.01,
      ph: r() * 100,
    }));
  }, [count, width, height, seed, sides]);
  const qx = useMemo(() => [new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)], []);
  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), m: new THREE.Matrix4(), z: new THREE.Vector3(0, 0, 1) }), []);
  useFrame(({ clock }) => {
    const b = body.current;
    if (!b) return;
    const t = clock.elapsedTime;
    data.forEach((d, i) => {
      const wob = Math.sin(t * 0.7 + d.ph) * 0.6;
      tmp.p.set(d.x + Math.sin(t * d.speed * 6 + d.ph) * 0.012, d.y + Math.cos(t * d.speed * 5 + d.ph * 1.3) * 0.01, d.side * (depth / 2 + 0.004));
      // lie flat on the comb (back facing out), heading wandering in the comb plane
      tmp.q.setFromAxisAngle(tmp.z, d.heading + wob).multiply(qx[d.side > 0 ? 0 : 1]);
      tmp.s.setScalar(BEE_SCALE * 0.95);
      tmp.m.compose(tmp.p, tmp.q, tmp.s);
      b.setMatrixAt(i, tmp.m);
    });
    b.instanceMatrix.needsUpdate = true;
  });
  return el;
}

/* ------------------------------- Flying bees ------------------------------- */

interface Bee {
  type: number;
  e: THREE.Vector3;
  out: THREE.Vector3;
  f: THREE.Vector3;
  f2: THREE.Vector3;
  c1: THREE.Vector3;
  c2: THREE.Vector3;
  period: number;
  phase: number;
  seed: number;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
function bez(p0: THREE.Vector3, c: THREE.Vector3, p1: THREE.Vector3, s: number, out: THREE.Vector3) {
  const k = 1 - s;
  return out.set(
    k * k * p0.x + 2 * k * s * c.x + s * s * p1.x,
    k * k * p0.y + 2 * k * s * c.y + s * s * p1.y,
    k * k * p0.z + 2 * k * s * c.z + s * s * p1.z,
  );
}
const ease = (x: number) => x * x * (3 - 2 * x);

/** Position of a bee at time t; returns visibility (0 = inside the hive). */
function beeAt(b: Bee, t: number, out: THREE.Vector3, look: THREE.Vector3): number {
  const u = (((t + b.phase) / b.period) % 1 + 1) % 1;
  const j = b.seed;
  if (b.type === 1) {
    // orientation loops in front of the entrance, facing the hive
    const w = t * (1.1 + (j % 1) * 0.6) + j * 10;
    out.copy(b.out);
    out.x += Math.sin(w) * b.c1.x + Math.sin(w * 2) * b.c1.z * 0.3;
    out.z += Math.sin(w) * b.c1.z + Math.sin(w * 2) * b.c1.x * 0.3;
    out.y += Math.sin(w * 0.5) * 0.12 + Math.sin(t * 9 + j * 7) * 0.008;
    look.copy(b.e);
    return 1;
  }
  if (b.type === 2) {
    // hop flower → flower with a hover at each
    const leg = u < 0.5 ? 0 : 1;
    const v = (u % 0.5) * 2;
    const from = leg === 0 ? b.f : b.f2;
    const to = leg === 0 ? b.f2 : b.f;
    const ctrl = leg === 0 ? b.c1 : b.c2;
    if (v < 0.55) {
      out.copy(from);
      out.x += Math.sin(t * 6.1 + j * 3) * 0.025;
      out.z += Math.cos(t * 5.3 + j * 5) * 0.025;
      out.y += 0.02 + Math.abs(Math.sin(t * 3.7 + j)) * 0.03;
      look.copy(from).add(_a.set(Math.sin(t * 0.8 + j) * 0.2, -0.05, Math.cos(t * 0.8 + j) * 0.2));
      return 1;
    }
    const s = ease((v - 0.55) / 0.45);
    bez(from, ctrl, to, s, out);
    bez(from, ctrl, to, Math.min(1, s + 0.03), look);
    return 1;
  }
  // foragers (0), water carriers (3)
  if (u < 0.1) {
    out.copy(b.e);
    look.copy(b.out);
    return 0;
  }
  if (u < 0.4) {
    const s = ease((u - 0.1) / 0.3);
    const wob = Math.sin(s * Math.PI);
    bez(b.out, b.c1, b.f, s, out);
    bez(b.out, b.c1, b.f, Math.min(1, s + 0.025), look);
    out.x += Math.sin(t * 2.3 + j * 4) * 0.12 * wob;
    out.y += Math.sin(t * 3.1 + j * 2) * 0.06 * wob;
    if (u < 0.13) out.lerp(b.e, 1 - (u - 0.1) / 0.03);
    return 1;
  }
  if (u < 0.62) {
    const k = b.type === 3 ? 0.012 : 0.03;
    out.copy(b.f);
    out.x += Math.sin(t * 6.7 + j * 3) * k;
    out.z += Math.cos(t * 5.9 + j * 5) * k;
    out.y += 0.015 + Math.abs(Math.sin(t * 2.9 + j)) * (b.type === 3 ? 0.005 : 0.035);
    look.copy(b.f).add(_a.set(Math.sin(t * 0.6 + j) * 0.3, -0.05, Math.cos(t * 0.6 + j) * 0.3));
    return 1;
  }
  if (u < 0.93) {
    const s = ease((u - 0.62) / 0.31);
    const wob = Math.sin(s * Math.PI);
    bez(b.f, b.c2, b.out, s, out);
    bez(b.f, b.c2, b.out, Math.min(1, s + 0.025), look);
    out.x += Math.sin(t * 2.1 + j * 3) * 0.1 * wob;
    out.y += Math.sin(t * 2.7 + j * 2) * 0.05 * wob;
    return 1;
  }
  // final approach: slow hover then crawl in
  const s = (u - 0.93) / 0.07;
  out.copy(b.out).lerp(b.e, ease(s));
  out.y += Math.sin(t * 8 + j) * 0.01 * (1 - s);
  look.copy(b.e);
  return s > 0.96 ? 0 : 1;
}

export function BeeSwarm({ quality }: { quality: Quality }) {
  const count = quality === 'low' ? 60 : quality === 'medium' ? 150 : 300;
  const fly = useLinked(count, true);
  const restPer = quality === 'low' ? 2 : quality === 'medium' ? 3 : 5;
  const restCount = HIVES.length * restPer;
  const rest = useLinked(restCount, false);

  const bees = useMemo(() => {
    const r = rng(99);
    const flowers = getFlowers(quality);
    const heads = flowers.filter((f) => f.kind !== 'leafy').map((f) => flowerHead(f));
    const entrances = HIVES.map((h) => {
      const e = hiveEntrance(h);
      const fwd = new THREE.Vector3(Math.sin(h.rot), 0, Math.cos(h.rot));
      return { e, fwd };
    });
    const water = new THREE.Vector3(WATER_DISH.x, groundY(WATER_DISH.x, WATER_DISH.z) + 0.43, WATER_DISH.z);
    const obs = new THREE.Vector3(OBS_EXIT.x, pavilionGround() + OBS_EXIT.y, OBS_EXIT.z);
    const nearHeads = (p: THREE.Vector3, maxD: number) => heads.filter((h) => h.distanceToSquared(p) < maxD * maxD);
    const list: Bee[] = [];
    for (let i = 0; i < count; i++) {
      const roll = r();
      const type = roll < 0.4 ? 0 : roll < 0.68 ? 1 : roll < 0.86 ? 2 : roll < 0.96 ? 3 : 4;
      const hive = entrances[r() < 0.18 ? DEMO_INDEX : Math.floor(r() * entrances.length)];
      const e = hive.e.clone();
      const out = e.clone().addScaledVector(hive.fwd, 0.08);
      const b: Bee = {
        type: type === 4 ? 1 : type,
        e,
        out,
        f: new THREE.Vector3(),
        f2: new THREE.Vector3(),
        c1: new THREE.Vector3(),
        c2: new THREE.Vector3(),
        period: 9 + r() * 9,
        phase: r() * 40,
        seed: i * 0.618 + r(),
      };
      if (type === 1 || type === 4) {
        const centre = type === 4 ? obs.clone() : e.clone();
        const fwd = type === 4 ? new THREE.Vector3(0.5, 0, -0.866) : hive.fwd;
        b.e.copy(centre);
        b.out.copy(centre).addScaledVector(fwd, 0.35 + r() * 0.4);
        b.out.y += 0.1 + r() * 0.3;
        const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
        b.c1.set(side.x * (0.2 + r() * 0.25) + fwd.x * 0.15, 0, side.z * (0.2 + r() * 0.25) + fwd.z * 0.15);
      } else if (type === 2) {
        const dishMeadow = nearHeads(water, 4.5);
        const pool = r() < 0.5 && dishMeadow.length ? dishMeadow : heads.length ? heads : [e];
        const f = pool[Math.floor(r() * pool.length)];
        const near = nearHeads(f, 1.6);
        const f2 = near.length > 1 ? near[Math.floor(r() * near.length)] : f.clone().add(new THREE.Vector3(0.6, 0, 0.3));
        b.f.copy(f);
        b.f2.copy(f2);
        const mid = f.clone().lerp(f2, 0.5);
        b.c1.copy(mid).add(new THREE.Vector3((r() - 0.5) * 0.6, 0.35 + r() * 0.3, (r() - 0.5) * 0.6));
        b.c2.copy(mid).add(new THREE.Vector3((r() - 0.5) * 0.6, 0.25 + r() * 0.3, (r() - 0.5) * 0.6));
        b.period = 7 + r() * 6;
      } else {
        let target: THREE.Vector3;
        if (type === 3) target = water.clone().add(new THREE.Vector3((r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5));
        else {
          const near = nearHeads(e, 13);
          const pool = near.length ? near : heads;
          target = pool.length ? pool[Math.floor(r() * pool.length)].clone() : e.clone().add(new THREE.Vector3(2, 0, 2));
        }
        b.f.copy(target);
        const dist = e.distanceTo(target);
        const side = new THREE.Vector3(-(target.z - e.z), 0, target.x - e.x).normalize();
        const mid = out.clone().lerp(target, 0.5);
        b.c1.copy(mid).addScaledVector(side, (0.3 + r() * 0.6) * Math.min(1, dist / 4)).add(new THREE.Vector3(0, 0.5 + dist * 0.1 + r() * 0.5, 0));
        b.c2.copy(mid).addScaledVector(side, -(0.3 + r() * 0.6) * Math.min(1, dist / 4)).add(new THREE.Vector3(0, 0.35 + dist * 0.08 + r() * 0.4, 0));
        b.period = 10 + dist * 0.9 + r() * 6;
      }
      list.push(b);
    }
    return list;
  }, [count, quality]);

  const resting = useMemo(() => {
    const r = rng(5);
    const out: { m: THREE.Matrix4; base: THREE.Vector3; rot: number; ph: number; fwd: THREE.Vector3; side: THREE.Vector3 }[] = [];
    HIVES.forEach((h) => {
      const gy = groundY(h.x, h.z);
      const fwd = new THREE.Vector3(Math.sin(h.rot), 0, Math.cos(h.rot));
      const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
      for (let k = 0; k < restPer; k++) {
        const along = (r() - 0.5) * (HIVE.W - 0.08);
        const fwdOff = HIVE.L / 2 + 0.03 + r() * 0.07;
        const base = new THREE.Vector3(h.x, gy + HIVE.standH + 0.024, h.z).addScaledVector(side, along).addScaledVector(fwd, fwdOff);
        out.push({ m: new THREE.Matrix4(), base, rot: h.rot + Math.PI + (r() - 0.5) * 2, ph: r() * 50, fwd, side });
      }
    });
    return out;
  }, [restPer]);

  const o = useMemo(() => new THREE.Object3D(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const sc = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const fb = fly.body.current;
    if (fb) {
      for (let i = 0; i < bees.length; i++) {
        const b = bees[i];
        const vis = beeAt(b, t, p, look);
        _b.subVectors(look, p);
        if (_b.lengthSq() < 1e-8) look.copy(p).add(_a.set(0, 0, 0.01));
        m4.lookAt(look, p, up);
        q.setFromRotationMatrix(m4);
        sc.setScalar(vis ? BEE_SCALE : 0);
        m4.compose(p, q, sc);
        fb.setMatrixAt(i, m4);
      }
      fb.instanceMatrix.needsUpdate = true;
    }
    const rb = rest.body.current;
    if (rb) {
      resting.forEach((rr, i) => {
        const wander = Math.sin(t * 0.35 + rr.ph) * 0.05;
        o.position.copy(rr.base).addScaledVector(rr.side, wander).addScaledVector(rr.fwd, Math.sin(t * 0.27 + rr.ph * 2) * 0.02);
        o.rotation.set(0, rr.rot + Math.sin(t * 0.5 + rr.ph) * 0.6, 0);
        o.scale.setScalar(BEE_SCALE * 0.95);
        o.updateMatrix();
        rb.setMatrixAt(i, o.matrix);
      });
      rb.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {fly.el}
      {rest.el}
    </group>
  );
}

export type { Vec3 };

/* -------------------------------- Butterflies -------------------------------- */

let wingTex: THREE.CanvasTexture | null = null;
/** One right wing (fore + hind) drawn white with dark markings; tinted per instance. */
function butterflyWingTexture() {
  if (wingTex) return wingTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 128, 128);
  // forewing
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(4, 64);
  g.bezierCurveTo(30, 6, 96, 2, 122, 18);
  g.bezierCurveTo(116, 44, 92, 62, 60, 70);
  g.closePath();
  g.fill();
  // hindwing
  g.beginPath();
  g.moveTo(4, 66);
  g.bezierCurveTo(46, 66, 90, 86, 84, 112);
  g.bezierCurveTo(60, 124, 26, 106, 4, 72);
  g.closePath();
  g.fill();
  g.globalCompositeOperation = 'source-atop';
  // dark apex with pale spots, veins and margin spots
  g.fillStyle = '#1d1712';
  g.beginPath();
  g.ellipse(112, 22, 30, 20, -0.35, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#f4f1ea';
  for (const [x, y, r] of [
    [108, 18, 4],
    [118, 28, 3],
    [98, 26, 3.5],
  ]) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = 'rgba(40,28,20,0.55)';
  g.lineWidth = 1.4;
  for (const [x, y] of [
    [118, 14],
    [110, 46],
    [86, 64],
    [80, 104],
    [50, 108],
  ]) {
    g.beginPath();
    g.moveTo(6, 66);
    g.quadraticCurveTo((x + 6) / 2, (y + 66) / 2 - 6, x, y);
    g.stroke();
  }
  g.fillStyle = '#2a2018';
  for (const [x, y] of [
    [70, 98],
    [56, 104],
    [80, 86],
  ]) {
    g.beginPath();
    g.arc(x, y, 3.2, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = 'rgba(30,22,16,0.5)';
  g.beginPath();
  g.ellipse(10, 66, 16, 8, 0, 0, Math.PI * 2);
  g.fill();
  wingTex = new THREE.CanvasTexture(c);
  wingTex.colorSpace = THREE.SRGBColorSpace;
  wingTex.anisotropy = 4;
  return wingTex;
}

/** Two hinged wing quads (+X right, mirrored left) and a slim body; aWing marks the side. */
function butterflyGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(0.5, 0, 0);
    if (s < 0) {
      g.scale(-1, 1, 1);
      const idx = g.index!;
      for (let i = 0; i < idx.count; i += 3) {
        const a = idx.getX(i + 1);
        idx.setX(i + 1, idx.getX(i + 2));
        idx.setX(i + 2, a);
      }
    }
    const n = g.attributes.position.count;
    g.setAttribute('aWing', new THREE.BufferAttribute(new Float32Array(n).fill(s), 1));
    parts.push(g.toNonIndexed());
  }
  const body = new THREE.CylinderGeometry(0.035, 0.025, 0.7, 6).toNonIndexed();
  body.rotateX(Math.PI / 2);
  body.translate(0, 0.01, 0);
  const bc = body.attributes.position.count;
  body.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(bc * 2).fill(0.02), 2));
  body.setAttribute('aWing', new THREE.BufferAttribute(new Float32Array(bc), 1));
  parts.push(body);
  const m = mergeGeometries(parts, false);
  m.computeVertexNormals();
  return m;
}

const BUTTERFLY_VERTEX = `#include <begin_vertex>
{
  #ifdef USE_INSTANCING
    float ph = instanceMatrix[3][0] * 13.0 + instanceMatrix[3][2] * 7.0;
  #else
    float ph = 0.0;
  #endif
  float flap = 0.25 + 0.95 * ( 0.5 + 0.5 * sin( uTime * 17.0 + ph ) );
  float ang = flap * aWing;
  float c = cos( ang );
  float sn = sin( ang );
  transformed.xy = vec2( c * transformed.x - sn * transformed.y, sn * transformed.x + c * transformed.y );
}`;

/** A handful of painted ladies, cabbage whites and sulphurs drifting over the wildflowers. */
export function Butterflies({ quality }: { quality: Quality }) {
  const count = quality === 'low' ? 3 : quality === 'medium' ? 6 : 10;
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => butterflyGeometry(), []);
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: butterflyWingTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.75 });
    m.onBeforeCompile = (s) => {
      s.uniforms.uTime = windUniforms.uTime;
      s.vertexShader = s.vertexShader
        .replace('#include <common>', ['#include <common>', 'attribute float aWing;', 'uniform float uTime;'].join('\n'))
        .replace('#include <begin_vertex>', BUTTERFLY_VERTEX);
    };
    m.customProgramCacheKey = () => 'apiary-butterfly';
    return m;
  }, []);
  const data = useMemo(() => {
    const r = rng(808);
    const tints = ['#E58A2E', '#F3EFE4', '#E9C840', '#E07F2A', '#F1ECDD'].map((c) => new THREE.Color(c));
    const centres = [2, 0, 3, 4, 8].map((i) => MEADOWS[i]);
    return Array.from({ length: count }, (_, i) => {
      const md = centres[i % centres.length];
      return {
        cx: md.x,
        cz: md.z,
        gy: groundY(md.x, md.z),
        rx: md.rx * 0.7,
        rz: md.rz * 0.7,
        a: [0.11 + r() * 0.08, 0.17 + r() * 0.1, 0.5 + r() * 0.4],
        p: [r() * 10, r() * 10, r() * 10],
        size: 0.055 + r() * 0.02,
        tint: tints[i % tints.length],
      };
    });
  }, [count]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    data.forEach((d, i) => m.setColorAt(i, d.tint));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [data]);
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), n: new THREE.Vector3(), m: new THREE.Matrix4(), up: new THREE.Vector3(0, 1, 0), q: new THREE.Quaternion(), s: new THREE.Vector3() }), []);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime;
    const at = (d: (typeof data)[number], time: number, out: THREE.Vector3) =>
      out.set(
        d.cx + Math.sin(time * d.a[0] + d.p[0]) * d.rx + Math.sin(time * d.a[1] * 1.7 + d.p[1]) * 0.6,
        d.gy + 0.55 + Math.sin(time * d.a[2] + d.p[2]) * 0.22 + Math.abs(Math.sin(time * 2.6 + d.p[0])) * 0.08,
        d.cz + Math.cos(time * d.a[1] + d.p[1]) * d.rz + Math.sin(time * d.a[0] * 2.3 + d.p[2]) * 0.5,
      );
    data.forEach((d, i) => {
      at(d, t, tmp.p);
      at(d, t + 0.05, tmp.n);
      tmp.m.lookAt(tmp.n, tmp.p, tmp.up);
      tmp.q.setFromRotationMatrix(tmp.m);
      tmp.s.setScalar(d.size);
      tmp.m.compose(tmp.p, tmp.q, tmp.s);
      m.setMatrixAt(i, tmp.m);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mat, count]} frustumCulled={false} />;
}
