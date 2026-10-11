import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { applyWind } from '../../materials/wind';
import type { Quality, Vec3 } from '../../core/types';

/* ------------------------------------------------------------------ */
/*  Instanced crops: staked tomatoes, lettuce rosettes, aubergine /    */
/*  okra bushes, herb clumps and marigolds — all wind-animated.        */
/* ------------------------------------------------------------------ */

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A serrated compound leaf, origin at the stalk, pointing +Y-ish. */
function leafGeo(length = 1, width = 0.45, segments = 6) {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const w = Math.sin(Math.PI * Math.min(1, t * 1.1)) * width * (1 - t * 0.3) * (1 + 0.12 * Math.sin(t * 22));
    const y = t * length;
    const curl = t * t * 0.35 * length;
    pos.push(-w / 2, y, curl * 0.4, 0, y, curl * 0.4 - 0.04 * length, w / 2, y, curl * 0.4);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 3;
    const b = a + 3;
    idx.push(a, b, a + 1, b, b + 1, a + 1, a + 1, b + 1, a + 2, b + 1, b + 2, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Lettuce rosette made of ruffled, cupped leaves. */
function rosetteGeo(leaves = 14) {
  const parts: THREE.BufferGeometry[] = [];
  const r = rng(5);
  for (let i = 0; i < leaves; i++) {
    const ring = i < 5 ? 0 : i < 10 ? 1 : 2;
    const yaw = i * 2.39996;
    const tilt = 0.25 + ring * 0.38 + r() * 0.1;
    const len = 0.13 + ring * 0.05;
    const g = new THREE.BufferGeometry();
    const pos: number[] = [];
    const idx: number[] = [];
    const segs = 6;
    const across = 5;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const w = Math.sin(Math.PI * (0.15 + t * 0.85)) * len * 0.75;
      for (let a = 0; a <= across; a++) {
        const u = a / across - 0.5;
        const ruffle = Math.sin(u * 14 + t * 9 + i) * 0.012 * t;
        const cup = u * u * 0.09;
        pos.push(u * w, t * len, cup + ruffle);
      }
    }
    for (let s = 0; s < segs; s++)
      for (let a = 0; a < across; a++) {
        const p = s * (across + 1) + a;
        const q = p + across + 1;
        idx.push(p, q, p + 1, q, q + 1, p + 1);
      }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.rotateX(-tilt);
    g.rotateY(yaw);
    parts.push(g);
  }
  const merged = mergeGeometries(parts, false);
  merged.computeVertexNormals();
  return merged;
}

function useInstances(ref: React.RefObject<THREE.InstancedMesh>, mats: THREE.Matrix4[], colors?: THREE.Color[]) {
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    mats.forEach((mt, i) => m.setMatrixAt(i, mt));
    if (colors) colors.forEach((c, i) => m.setColorAt(i, c));
    m.count = mats.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [ref, mats, colors]);
}

const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
function compose(p: THREE.Vector3, rx: number, ry: number, rz: number, s: number | THREE.Vector3) {
  tmpE.set(rx, ry, rz);
  tmpQ.setFromEuler(tmpE);
  return new THREE.Matrix4().compose(p, tmpQ, typeof s === 'number' ? new THREE.Vector3(s, s, s) : s);
}

export type CropKind = 'tomato' | 'lettuce' | 'bush' | 'herb' | 'marigold';

export interface CropRow {
  kind: CropKind;
  from: Vec3;
  to: Vec3;
  count: number;
}

export function Crops({ rows, quality, seed = 1 }: { rows: CropRow[]; quality: Quality; seed?: number }) {
  const density = quality === 'low' ? 0.55 : quality === 'medium' ? 0.8 : 1;

  const leafG = useMemo(() => leafGeo(1, 0.5, 6), []);
  const rosG = useMemo(() => rosetteGeo(quality === 'low' ? 9 : 14), [quality]);
  const fruitG = useMemo(() => new THREE.SphereGeometry(1, 7, 5), []);
  const stakeG = useMemo(() => new THREE.CylinderGeometry(0.012, 0.015, 1, 6), []);

  const leafMat = useMemo(
    () => applyWind(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.75 }), { sway: 0.06, stiffness: 1.4, speed: 1.5 }),
    [],
  );
  const rosMat = useMemo(
    () => applyWind(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6 }), { sway: 0.2, stiffness: 3, speed: 1.8 }),
    [],
  );

  const data = useMemo(() => {
    const r = rng(seed * 101);
    const leaves: THREE.Matrix4[] = [];
    const leafCols: THREE.Color[] = [];
    const fruits: THREE.Matrix4[] = [];
    const fruitCols: THREE.Color[] = [];
    const stakes: THREE.Matrix4[] = [];
    const ros: THREE.Matrix4[] = [];
    const rosCols: THREE.Color[] = [];
    const green = new THREE.Color('#3E6A2B');
    const green2 = new THREE.Color('#5E8A3C');

    for (const row of rows) {
      const a = new THREE.Vector3(...row.from);
      const b = new THREE.Vector3(...row.to);
      const n = Math.max(1, Math.round(row.count * (row.kind === 'herb' || row.kind === 'lettuce' ? density : 1)));
      for (let i = 0; i < n; i++) {
        const p = a.clone().lerp(b, n === 1 ? 0.5 : i / (n - 1));
        p.x += (r() - 0.5) * 0.08;
        p.z += (r() - 0.5) * 0.08;
        if (row.kind === 'tomato') {
          const h = 1.15 + r() * 0.3;
          stakes.push(compose(p.clone().add(new THREE.Vector3(0.06, h / 2, 0)), 0, 0, (r() - 0.5) * 0.06, new THREE.Vector3(1, h + 0.15, 1)));
          const nLeaves = Math.round(26 * density);
          for (let k = 0; k < nLeaves; k++) {
            const y = 0.12 + (k / nLeaves) * h;
            const yaw = k * 2.4 + r();
            const lp = p.clone().add(new THREE.Vector3(Math.cos(yaw) * 0.05, y, Math.sin(yaw) * 0.05));
            leaves.push(compose(lp, -0.9 - r() * 0.5, yaw, 0, 0.2 + r() * 0.1));
            leafCols.push(green.clone().lerp(green2, r()));
          }
          const clusters = 4 + Math.floor(r() * 3);
          for (let c = 0; c < clusters; c++) {
            const y = 0.35 + r() * (h - 0.45);
            const yaw = r() * Math.PI * 2;
            const base = p.clone().add(new THREE.Vector3(Math.cos(yaw) * 0.14, y, Math.sin(yaw) * 0.14));
            const k = 2 + Math.floor(r() * 4);
            for (let f = 0; f < k; f++) {
              const fp = base.clone().add(new THREE.Vector3((r() - 0.5) * 0.08, -f * 0.045, (r() - 0.5) * 0.08));
              fruits.push(compose(fp, 0, r() * 6, 0, new THREE.Vector3(0.04, 0.036, 0.04).multiplyScalar(0.85 + r() * 0.35)));
              const ripe = r();
              fruitCols.push(new THREE.Color().setHSL(ripe > 0.3 ? 0.005 + r() * 0.025 : 0.2, ripe > 0.3 ? 0.78 : 0.5, ripe > 0.3 ? 0.42 : 0.38));
            }
          }
        } else if (row.kind === 'lettuce') {
          const red = r() < 0.25;
          ros.push(compose(p.clone().add(new THREE.Vector3(0, 0.0, 0)), 0, r() * 6, 0, 1.6 + r() * 0.5));
          rosCols.push(red ? new THREE.Color('#7A3B42').lerp(new THREE.Color('#6E8B3D'), r() * 0.4) : new THREE.Color('#7FA846').lerp(new THREE.Color('#B4CC63'), r() * 0.5));
        } else if (row.kind === 'bush') {
          const nLeaves = Math.round(22 * density);
          for (let k = 0; k < nLeaves; k++) {
            const yaw = r() * Math.PI * 2;
            const y = 0.08 + r() * 0.55;
            leaves.push(compose(p.clone().add(new THREE.Vector3(Math.cos(yaw) * 0.06, y, Math.sin(yaw) * 0.06)), -0.5 - r() * 0.8, yaw, 0, 0.32 + r() * 0.14));
            leafCols.push(new THREE.Color('#47702F').lerp(new THREE.Color('#6F9446'), r()));
          }
          const nf = 2 + Math.floor(r() * 3);
          for (let f = 0; f < nf; f++) {
            const yaw = r() * Math.PI * 2;
            const fp = p.clone().add(new THREE.Vector3(Math.cos(yaw) * 0.2, 0.2 + r() * 0.25, Math.sin(yaw) * 0.2));
            fruits.push(compose(fp, (r() - 0.5) * 0.5, yaw, Math.PI / 2 + (r() - 0.5) * 0.4, new THREE.Vector3(0.045, 0.11, 0.045)));
            fruitCols.push(new THREE.Color('#3A1C3E').offsetHSL(0, 0, r() * 0.06));
          }
        } else if (row.kind === 'herb') {
          const nLeaves = Math.round(16 * density);
          for (let k = 0; k < nLeaves; k++) {
            const yaw = r() * Math.PI * 2;
            leaves.push(compose(p.clone().add(new THREE.Vector3(Math.cos(yaw) * 0.04, 0.02 + r() * 0.12, Math.sin(yaw) * 0.04)), -0.4 - r() * 0.9, yaw, 0, 0.09 + r() * 0.05));
            leafCols.push(new THREE.Color('#3F7A3A').lerp(new THREE.Color('#77A852'), r()));
          }
        } else if (row.kind === 'marigold') {
          for (let k = 0; k < 8; k++) {
            const yaw = r() * Math.PI * 2;
            leaves.push(compose(p.clone().add(new THREE.Vector3(0, 0.03 + r() * 0.1, 0)), -0.7 - r() * 0.5, yaw, 0, 0.12));
            leafCols.push(new THREE.Color('#3B6327'));
          }
          for (let f = 0; f < 3; f++) {
            const fp = p.clone().add(new THREE.Vector3((r() - 0.5) * 0.12, 0.22 + r() * 0.08, (r() - 0.5) * 0.12));
            fruits.push(compose(fp, 0, 0, 0, new THREE.Vector3(0.05, 0.03, 0.05)));
            fruitCols.push(new THREE.Color(r() < 0.5 ? '#F29A1E' : '#F5C226'));
          }
        }
      }
    }
    return { leaves, leafCols, fruits, fruitCols, stakes, ros, rosCols };
  }, [rows, seed, density]);

  const leafRef = useRef<THREE.InstancedMesh>(null);
  const fruitRef = useRef<THREE.InstancedMesh>(null);
  const stakeRef = useRef<THREE.InstancedMesh>(null);
  const rosRef = useRef<THREE.InstancedMesh>(null);
  useInstances(leafRef, data.leaves, data.leafCols);
  useInstances(fruitRef, data.fruits, data.fruitCols);
  useInstances(stakeRef, data.stakes);
  useInstances(rosRef, data.ros, data.rosCols);

  return (
    <group>
      {data.leaves.length > 0 && <instancedMesh ref={leafRef} args={[leafG, leafMat, data.leaves.length]} castShadow receiveShadow frustumCulled={false} />}
      {data.fruits.length > 0 && (
        <instancedMesh ref={fruitRef} args={[fruitG, undefined, data.fruits.length]} castShadow frustumCulled={false}>
          <meshPhysicalMaterial roughness={0.28} clearcoat={0.6} clearcoatRoughness={0.25} />
        </instancedMesh>
      )}
      {data.stakes.length > 0 && (
        <instancedMesh ref={stakeRef} args={[stakeG, undefined, data.stakes.length]} castShadow frustumCulled={false}>
          <meshStandardMaterial color="#C9AE7C" roughness={0.8} />
        </instancedMesh>
      )}
      {data.ros.length > 0 && <instancedMesh ref={rosRef} args={[rosG, rosMat, data.ros.length]} castShadow receiveShadow frustumCulled={false} />}
    </group>
  );
}
