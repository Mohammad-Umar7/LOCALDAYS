import * as THREE from 'three';
import type { Quality } from '../../core/types';
import { groundY, isBlocked, MEADOWS, noise2, pathMask, rng, wadiAt } from './layout';

/* ------------------------------------------------------------------ */
/*  Wildflower placement shared by the flora meshes and the bees that  */
/*  visit them. Species grow in natural drifts, densest by the hives.  */
/* ------------------------------------------------------------------ */

export type FlowerKind = 'daisy' | 'aster' | 'spike' | 'umbel' | 'leafy';
export const FLOWER_KINDS: FlowerKind[] = ['daisy', 'aster', 'spike', 'umbel', 'leafy'];

/** Height of the bloom above the stem base (before instance scale). */
export const HEAD_HEIGHT: Record<FlowerKind, number> = { daisy: 0.36, aster: 0.3, spike: 0.44, umbel: 0.42, leafy: 0.08 };

export interface FlowerSpec {
  kind: FlowerKind;
  x: number;
  y: number;
  z: number;
  yaw: number;
  tiltX: number;
  tiltZ: number;
  scale: number;
  color: THREE.Color;
}

const PALETTE: Record<FlowerKind, string[]> = {
  daisy: ['#F2C531', '#EDB722', '#F5D04A', '#F6F2E4', '#F3EEDD', '#F0E7C8'],
  aster: ['#8C68C6', '#A688D9', '#7A55B0', '#B6509A', '#C27CC0', '#9A7FD4'],
  spike: ['#7E5DB8', '#6C4EA6', '#9273C9', '#5D4A9E', '#A07BD0'],
  umbel: ['#F4F0E2', '#EFE8D0', '#F7F3EA', '#E8DEC0'],
  leafy: ['#66784A', '#58703F', '#788A55', '#6E7A52', '#8A9068', '#7C8A5E'],
};

const cache = new Map<Quality, FlowerSpec[]>();

export function getFlowers(quality: Quality): FlowerSpec[] {
  const hit = cache.get(quality);
  if (hit) return hit;
  const r = rng(2024);
  const perM2 = quality === 'low' ? 3 : quality === 'medium' ? 5.2 : 8.4;
  const out: FlowerSpec[] = [];
  for (const md of MEADOWS) {
    const area = Math.PI * md.rx * md.rz;
    const n = Math.round(area * perM2 * md.density);
    const c = Math.cos(md.rot);
    const s = Math.sin(md.rot);
    let placed = 0;
    let guard = 0;
    while (placed < n && guard++ < n * 6) {
      // sample the ellipse, biased toward its middle
      const a = r() * Math.PI * 2;
      const rr = Math.sqrt(r()) * 1.08;
      const lx = Math.cos(a) * rr * md.rx;
      const lz = Math.sin(a) * rr * md.rz;
      const x = md.x + lx * c - lz * s;
      const z = md.z + lx * s + lz * c;
      const e = Math.hypot(lx / md.rx, lz / md.rz) + noise2(x * 0.45, z * 0.45) * 0.24 + noise2(x * 0.16 + 7, z * 0.16) * 0.22;
      if (e > 1.05 || r() > 1.15 - e * 0.5) continue;
      if (isBlocked(x, z, 0.12) || pathMask(x, z) > 0.12) continue;
      const w = wadiAt(x, z);
      if (w.d < w.halfW + 0.8) continue;
      // drifts: species follow low-frequency noise bands
      const dn = noise2(x * 0.32 + 7.1, z * 0.32 - 3.3) * 0.5 + 0.5;
      const dn2 = noise2(x * 0.7 - 1.1, z * 0.7 + 5.5) * 0.5 + 0.5;
      let kind: FlowerKind;
      const pick = dn * 0.75 + r() * 0.25;
      if (r() < 0.07) kind = 'leafy';
      else if (pick < 0.3) kind = 'daisy';
      else if (pick < 0.48) kind = 'umbel';
      else if (pick < 0.68) kind = 'aster';
      else kind = 'spike';
      const pal = PALETTE[kind];
      // white vs yellow daisies drift separately
      let ci = Math.floor(r() * pal.length);
      if (kind === 'daisy') ci = dn2 > 0.5 ? Math.floor(r() * 3) : 3 + Math.floor(r() * 3);
      const color = new THREE.Color(pal[ci]).offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.06);
      out.push({
        kind,
        x,
        y: groundY(x, z) - 0.01,
        z,
        yaw: r() * Math.PI * 2,
        tiltX: (r() - 0.5) * 0.3,
        tiltZ: (r() - 0.5) * 0.3,
        scale: (0.95 + r() * 0.6) * (kind === 'leafy' ? 0.85 : 1),
        color,
      });
      placed++;
    }
  }
  cache.set(quality, out);
  return out;
}

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Instance transform for a flower (stem base at the ground). */
export function flowerMatrix(f: FlowerSpec, out = new THREE.Matrix4()) {
  _e.set(f.tiltX, f.yaw, f.tiltZ, 'YXZ');
  _q.setFromEuler(_e);
  return out.compose(_p.set(f.x, f.y, f.z), _q, _s.setScalar(f.scale));
}

const _m = new THREE.Matrix4();
/** World position of a flower's bloom (where bees land). */
export function flowerHead(f: FlowerSpec, out = new THREE.Vector3()) {
  flowerMatrix(f, _m);
  return out.set(0.012, HEAD_HEIGHT[f.kind] + 0.012, 0).applyMatrix4(_m);
}
