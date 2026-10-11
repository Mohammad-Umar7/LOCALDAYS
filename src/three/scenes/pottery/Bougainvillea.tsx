import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { applyWind } from '../../materials/wind';
import { tubeAlong } from '../../props/geo';
import type { Quality } from '../../core/types';
import { rand } from './geometry';

/* ------------------------------------------------------------------ */
/*  Bougainvillea spilling over a parapet: thousands of instanced      */
/*  leaves and papery magenta bracts draped along the wall face with   */
/*  a ragged, longer-in-the-middle hem, a few woody canes, and a       */
/*  gentle breeze.                                                     */
/* ------------------------------------------------------------------ */

export interface CascadeSpec {
  /** Start and end of the drape along the wall (world X or Z) */
  from: number;
  to: number;
  /** Height of the parapet top */
  top: number;
  /** Wall face coordinate and the outward direction (+1/-1) */
  face: number;
  out: 1 | -1;
  /** 'x' = wall runs along X (face is a Z coordinate), 'z' = along Z */
  axis: 'x' | 'z';
  /** Longest hang below the parapet (m) */
  drop: number;
  seed?: number;
}

function leafGeometry() {
  const g = new THREE.BufferGeometry();
  // a slightly cupped leaf, origin at the stem
  const v = new Float32Array([0, 0, 0, -0.32, 0.45, 0.07, 0, 1, 0.02, 0.32, 0.45, 0.07]);
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

export function Bougainvillea({ spec, quality }: { spec: CascadeSpec; quality: Quality }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const density = quality === 'low' ? 0.45 : quality === 'medium' ? 0.7 : 1;
  const geo = useMemo(() => leafGeometry(), []);
  const mat = useMemo(() => applyWind(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.78, envMapIntensity: 0.6 }), { sway: 0.05, stiffness: 1, speed: 1.6 }), []);

  const { items, canes } = useMemo(() => {
    const r = rand(spec.seed ?? 5);
    const len = Math.abs(spec.to - spec.from);
    const n = Math.round(len * 1500 * density);
    const leafA = new THREE.Color('#3B6A2A');
    const leafB = new THREE.Color('#5E8A3C');
    const bractA = new THREE.Color('#C2246E');
    const bractB = new THREE.Color('#E0479A');
    // hem length along the wall: longest in the middle, ragged
    const hem = (u: number) => spec.drop * (0.35 + 0.65 * Math.sin(Math.PI * u)) * (0.75 + 0.25 * Math.sin(u * 23.1 + 1.3) * Math.sin(u * 7.7));
    const place = (u: number, s: number, depth: number) => {
      // s < 0: lying over the coping (behind the face); s >= 0: hanging down the face
      const along = THREE.MathUtils.lerp(spec.from, spec.to, u);
      let y: number;
      let off: number;
      if (s < 0) {
        y = spec.top + 0.12 + depth * 0.6 + Math.sin(u * 40) * 0.03;
        off = s * 1.2;
      } else {
        y = spec.top + 0.05 - s;
        off = 0.06 + depth + Math.sin(s * 3.1) * 0.04 + s * 0.05;
      }
      const w = spec.face + spec.out * off;
      return spec.axis === 'x' ? new THREE.Vector3(along, y, w) : new THREE.Vector3(w, y, along);
    };
    const out: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const normal = spec.axis === 'x' ? new THREE.Vector3(0, 0, spec.out) : new THREE.Vector3(spec.out, 0, 0);
    for (let i = 0; i < n; i++) {
      const u = r();
      const h = hem(u);
      const s = r() < 0.18 ? -r() * 0.35 : Math.pow(r(), 0.8) * h;
      const tip = s > 0 ? s / Math.max(0.01, h) : 0;
      const depth = (r() * 0.22 + 0.02) * (1 - tip * 0.5);
      const p = place(u, s, depth);
      const bract = r() < 0.22 + tip * 0.45 + depth * 0.8;
      // leaves hang down and face outward with random twist
      e.set(Math.PI + (r() - 0.5) * 1.4, (r() - 0.5) * 1.2, (r() - 0.5) * 1.6);
      q.setFromEuler(e);
      const face = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      q.premultiply(face);
      const size = bract ? 0.05 + r() * 0.025 : 0.045 + r() * 0.03;
      const m = new THREE.Matrix4().compose(p, q, new THREE.Vector3(size, size * 1.3, size));
      const c = bract ? bractA.clone().lerp(bractB, r()) : leafA.clone().lerp(leafB, r()).multiplyScalar(0.7 + depth * 1.4);
      out.push({ m, c });
    }
    // a few woody canes arching over the parapet
    const canes: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 6; k++) {
      const u = 0.1 + r() * 0.8;
      const h = hem(u) * (0.6 + r() * 0.3);
      const pts = [-0.4, -0.15, 0.02, h * 0.35, h * 0.7, h].map((s, i) => place(u + (i - 2) * 0.01, s, 0.04 + i * 0.012));
      canes.push(tubeAlong(pts, 0.012, 5));
    }
    return { items: out, canes };
  }, [spec, density]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((it, i) => {
      mesh.setMatrixAt(i, it.m);
      mesh.setColorAt(i, it.c);
    });
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);

  return (
    <group>
      <instancedMesh ref={ref} args={[geo, mat, Math.max(1, items.length)]} castShadow receiveShadow />
      {canes.map((g, i) => (
        <mesh key={i} geometry={g} castShadow>
          <meshStandardMaterial color="#5A4636" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}
