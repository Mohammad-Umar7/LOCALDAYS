import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { boxProjectUVs, roundedBox, wallGeometry, type Opening } from '../../props/geo';
import type { Vec3 } from '../../core/types';
import { merlonGeometry } from './geometry';

/* Small reusable building blocks for the studio. */

export function Wall({
  mat,
  position,
  rotation = 0,
  width,
  height,
  thickness,
  openings,
}: {
  mat: THREE.Material;
  position: Vec3;
  rotation?: number;
  width: number;
  height: number;
  thickness: number;
  openings?: Opening[];
}) {
  const geo = useMemo(() => wallGeometry(width, height, thickness, openings ?? [], 0.025), [width, height, thickness, openings]);
  return <mesh geometry={geo} material={mat} position={position} rotation={[0, rotation, 0]} castShadow receiveShadow />;
}

const slabCache = new Map<string, THREE.BufferGeometry>();
export function slabGeometry(size: Vec3, r = 0.02, uv = 0.5) {
  const key = `${size.join(',')}:${r}:${uv}`;
  let g = slabCache.get(key);
  if (!g) {
    g = boxProjectUVs(roundedBox(size[0], size[1], size[2], r, 2).clone(), uv);
    slabCache.set(key, g);
  }
  return g;
}

/** Rounded box with world-scale UVs. */
export function Slab({
  mat,
  position,
  size,
  r = 0.02,
  rotation,
  uv = 0.5,
  cast = true,
}: {
  mat: THREE.Material;
  position: Vec3;
  size: Vec3;
  r?: number;
  rotation?: Vec3;
  uv?: number;
  cast?: boolean;
}) {
  const geo = useMemo(() => slabGeometry(size, r, uv), [size[0], size[1], size[2], r, uv]);
  return <mesh geometry={geo} material={mat} position={position} rotation={rotation} castShadow={cast} receiveShadow />;
}

export interface InstanceSpec {
  p: Vec3;
  r?: Vec3;
  s?: Vec3 | number;
  c?: string | THREE.Color;
}

/** Generic instanced mesh from a list of transforms (+ optional colours). */
export function Instances({
  geometry,
  material,
  items,
  cast = true,
  receive = true,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  items: InstanceSpec[];
  cast?: boolean;
  receive?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    items.forEach((it, i) => {
      o.position.set(...it.p);
      o.rotation.set(...(it.r ?? [0, 0, 0]));
      if (typeof it.s === 'number') o.scale.setScalar(it.s);
      else if (it.s) o.scale.set(...it.s);
      else o.scale.setScalar(1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      if (it.c !== undefined) m.setColorAt(i, col.set(it.c));
    });
    m.count = items.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    m.computeBoundingBox();
  }, [items]);
  return <instancedMesh ref={ref} args={[geometry, material, Math.max(1, items.length)]} castShadow={cast} receiveShadow={receive} />;
}

/** Merlons (stepped crenellations) along straight runs. */
export function merlonRun(from: [number, number], to: [number, number], y: number, spacing = 0.62): InstanceSpec[] {
  const a = new THREE.Vector2(...from);
  const b = new THREE.Vector2(...to);
  const n = Math.max(1, Math.floor(a.distanceTo(b) / spacing));
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    return { p: [a.x + (b.x - a.x) * t, y, a.y + (b.y - a.y) * t] as Vec3, r: [0, -ang, 0] as Vec3 };
  });
}

export function Merlons({ mat, items, size = 0.4, depth = 0.22 }: { mat: THREE.Material; items: InstanceSpec[]; size?: number; depth?: number }) {
  const geo = useMemo(() => boxProjectUVs(merlonGeometry(size, depth), 0.5), [size, depth]);
  return <Instances geometry={geo} material={mat} items={items} />;
}

/** Protruding mangrove-pole roof beams (danchal) along a wall face. */
export function danchalRun(from: [number, number], to: [number, number], y: number, out: [number, number], spacing = 0.58, len = 0.75): InstanceSpec[] {
  const a = new THREE.Vector2(...from);
  const b = new THREE.Vector2(...to);
  const n = Math.max(1, Math.floor(a.distanceTo(b) / spacing));
  const ang = Math.atan2(out[0], out[1]);
  // poles stick out ~58% of their length; the rest is buried in the wall
  const off = len * 0.58 - len / 2;
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    const j = Math.sin(i * 12.3 + from[0]) * 0.035;
    return {
      p: [a.x + (b.x - a.x) * t + out[0] * off, y + j, a.y + (b.y - a.y) * t + out[1] * off] as Vec3,
      r: [Math.sin(i * 3.7) * 0.03, ang, Math.sin(i * 5.1) * 0.03] as Vec3,
      s: [1 + Math.sin(i * 7.7) * 0.12, 1 + Math.sin(i * 7.7) * 0.12, len / 0.75] as Vec3,
    };
  });
}

export function Danchal({ mat, items }: { mat: THREE.Material; items: InstanceSpec[] }) {
  const geo = useMemo(() => {
    // slightly irregular pole with a rounded, weathered end
    const g = new THREE.CylinderGeometry(0.046, 0.054, 0.75, 12, 3);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const y = p.getY(i);
      const k = 1 + Math.sin(y * 9 + Math.atan2(z, x) * 2) * 0.05;
      p.setXYZ(i, x * k, y, z * k);
    }
    g.computeVertexNormals();
    g.rotateX(Math.PI / 2);
    return g;
  }, []);
  return <Instances geometry={geo} material={mat} items={items} />;
}
