import { useMemo } from 'react';
import * as THREE from 'three';
import type { Vec3 } from '../../core/types';
import type { HarbourMaterials } from './materials';
import { mergeAll, place, rod, tint } from './util';

/* ------------------------------------------------------------------ */
/*  Perched sooty/white gulls on the pile tops and a western reef      */
/*  heron wading in the shallows (vertex-coloured, one draw call).    */
/* ------------------------------------------------------------------ */

function ellipsoid(sx: number, sy: number, sz: number, color: string, seg = 14) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7));
  g.scale(sx, sy, sz);
  return tint(g, color);
}

/** Gull facing +z, feet at the origin. */
function gullGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(place(ellipsoid(0.1, 0.095, 0.2, '#F3F3EF'), [0, 0.17, 0], [-0.12, 0, 0]));
  parts.push(place(ellipsoid(0.062, 0.06, 0.07, '#F7F7F4'), [0, 0.28, 0.16]));
  const beak = new THREE.ConeGeometry(0.016, 0.075, 8);
  beak.rotateX(Math.PI / 2);
  parts.push(place(tint(beak, '#E8B83A'), [0, 0.275, 0.25]));
  for (const s of [-1, 1]) {
    parts.push(place(ellipsoid(0.055, 0.05, 0.2, '#8F979C'), [s * 0.07, 0.2, -0.04], [-0.15, s * 0.08, 0]));
    parts.push(place(ellipsoid(0.03, 0.025, 0.09, '#1E1E1E'), [s * 0.045, 0.19, -0.23], [-0.2, 0, 0]));
    parts.push(tint(rod(new THREE.Vector3(s * 0.035, 0, 0.0), new THREE.Vector3(s * 0.035, 0.1, 0.01), 0.008, 0.008, 4), '#D9A06A'));
  }
  return mergeAll(parts, true);
}

/** Western reef heron (dark morph) facing +z, feet at the origin. */
function heronGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(place(ellipsoid(0.13, 0.15, 0.3, '#4A5058'), [0, 0.62, -0.02], [-0.45, 0, 0]));
  const neck = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.72, 0.18), new THREE.Vector3(0, 0.86, 0.2), new THREE.Vector3(0, 0.95, 0.12), new THREE.Vector3(0, 1.05, 0.16), new THREE.Vector3(0, 1.1, 0.24)]);
  parts.push(tint(new THREE.TubeGeometry(neck, 16, 0.032, 8, false), '#50565E'));
  parts.push(place(ellipsoid(0.045, 0.045, 0.07, '#4C5259'), [0, 1.11, 0.27]));
  parts.push(place(ellipsoid(0.022, 0.03, 0.05, '#F2F2EE'), [0, 1.08, 0.3]));
  const beak = new THREE.ConeGeometry(0.018, 0.16, 8);
  beak.rotateX(Math.PI / 2 + 0.1);
  parts.push(place(tint(beak, '#C9A24A'), [0, 1.1, 0.4]));
  parts.push(place(ellipsoid(0.06, 0.04, 0.16, '#3E434A'), [0, 0.52, -0.3], [-0.6, 0, 0]));
  for (const s of [-1, 1]) {
    parts.push(tint(rod(new THREE.Vector3(s * 0.05, 0, 0.0), new THREE.Vector3(s * 0.045, 0.5, -0.02), 0.012, 0.012, 5), '#3A3A30'));
    for (const a of [-0.5, 0, 0.5]) parts.push(tint(rod(new THREE.Vector3(s * 0.05, 0.005, 0), new THREE.Vector3(s * 0.05 + Math.sin(a) * 0.09, 0.005, Math.cos(a) * 0.09), 0.006, 0.006, 3), '#3A3A30'));
  }
  return mergeAll(parts, true);
}

export function Wildlife({ m, gulls, heron }: { m: HarbourMaterials; gulls: { p: Vec3; yaw: number }[]; heron?: { p: Vec3; yaw: number } }) {
  const geo = useMemo(() => {
    const g = gullGeometry();
    const list = gulls.map((it) => place(g.clone(), it.p, [0, it.yaw, 0]));
    if (heron) list.push(place(heronGeometry(), heron.p, [0, heron.yaw, 0]));
    return mergeAll(list, true);
  }, [gulls, heron]);
  return (
    <mesh geometry={geo} material={m.matte} castShadow receiveShadow />
  );
}
