import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { boxProjectUVs, roundedBox, smoothLathe, tubeAlong } from '../../props/geo';
import type { Quality } from '../../core/types';
import { DRYING, rng } from './layout';
import type { FarmMaterials } from './materials';

/* ------------------------------------------------------------------ */
/*  Harvest station under a shade sail: a work table of crates (dates, */
/*  tomatoes, cucumbers, aubergines, lemons), safeefah baskets, sacks, */
/*  a hanging scale on a pole tripod, wheelbarrow, wash tub, watering  */
/*  cans — plus palm mats of dates drying in the sun.                  */
/*  All fruit & veg share two instanced meshes (round / long).         */
/* ------------------------------------------------------------------ */

function merge(list: THREE.BufferGeometry[]) {
  const g = mergeGeometries(
    list.map((x) => {
      const y = x.index ? x.toNonIndexed() : x;
      if (!y.attributes.uv) y.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(y.attributes.position.count * 2), 2));
      return y;
    }),
    false,
  );
  list.forEach((x) => x.dispose());
  return g!;
}

const place = (g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) => {
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
  return g;
};

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

/** Ribbed, slightly flattened sphere — tomatoes, lemons, onions, melons by scaling. */
function roundProduceGeometry() {
  const g = new THREE.SphereGeometry(1, 10, 7);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 + 0.045 * Math.cos(a * 5) * (1 - Math.abs(y));
    p.setXYZ(i, x * k, y * 0.86 - (y > 0.85 ? 0.08 : 0), z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** Slightly pear-shaped capsule along Y — cucumbers, aubergines, courgettes by scaling. */
function longProduceGeometry() {
  const prof: [number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const y = -1 + t * 2;
    const r = Math.pow(Math.max(0, 1 - y * y), 0.45) * (1 + 0.18 * Math.cos((t - 0.3) * Math.PI));
    prof.push([Math.max(0.001, r * 0.85), y]);
  }
  return smoothLathe(prof, 8, 10).clone();
}

interface Item {
  m: THREE.Matrix4;
  c: THREE.Color;
}

const TONES: Record<string, string[]> = {
  tomato: ['#C8321E', '#B5281A', '#D8452A', '#C23A1C', '#9E2416'],
  lemon: ['#E8C53A', '#F0D04A', '#D9B02E', '#9BB43A'],
  lime: ['#7FA33A', '#6E9530', '#8DB04A'],
  onion: ['#B8792E', '#A86A28', '#C98E44'],
  pomegranate: ['#8E1E22', '#A3282A', '#7A1A1E'],
  melon: ['#3F6A2A', '#4E7A34', '#365E24'],
  cucumber: ['#3E6A2A', '#4A7A30', '#355E24'],
  aubergine: ['#3A1C3E', '#2E1632', '#452248'],
  pepper: ['#3E8A2A', '#C8321E', '#E2A12A'],
};

export function Harvest({ m, quality }: { m: FarmMaterials; quality: Quality }) {
  const roundRef = useRef<THREE.InstancedMesh>(null);
  const longRef = useRef<THREE.InstancedMesh>(null);
  const roundGeo = useMemo(() => roundProduceGeometry(), []);
  const longGeo = useMemo(() => longProduceGeometry(), []);

  const built = useMemo(() => {
    const r = rng(41);
    const round: Item[] = [];
    const long: Item[] = [];
    const crates: THREE.BufferGeometry[] = [];
    const wood: THREE.BufferGeometry[] = [];
    const metal: THREE.BufferGeometry[] = [];
    const weave: THREE.BufferGeometry[] = [];
    const sacking: THREE.BufferGeometry[] = [];
    const herbs: THREE.BufferGeometry[] = [];
    const dates: THREE.BufferGeometry[] = [];
    const ropes: THREE.BufferGeometry[] = [];
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const tone = (kind: string) => new THREE.Color(TONES[kind][Math.floor(r() * TONES[kind].length)]).offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.06);
    const addRound = (kind: string, x: number, y: number, z: number, s: [number, number, number]) => {
      e.set(r() * 0.6, r() * 6.28, r() * 0.6);
      q.setFromEuler(e);
      round.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(...s)), c: tone(kind) });
    };
    const addLong = (kind: string, x: number, y: number, z: number, s: [number, number, number], yaw: number) => {
      e.set(Math.PI / 2 + (r() - 0.5) * 0.3, yaw, (r() - 0.5) * 0.3, 'YXZ');
      q.setFromEuler(e);
      long.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(...s)), c: tone(kind) });
    };

    /** Slatted field crate; `fill` heaps produce in the top layer. */
    const crate = (x: number, y: number, z: number, rot: number, fill?: string) => {
      const W = 0.56;
      const H = 0.3;
      const D = 0.38;
      const parts: THREE.BufferGeometry[] = [];
      for (const k of [0, 1, 2]) {
        const yy = 0.05 + k * 0.1;
        parts.push(place(box(W, 0.065, 0.016), 0, yy, D / 2 - 0.008));
        parts.push(place(box(W, 0.065, 0.016), 0, yy, -D / 2 + 0.008));
        parts.push(place(box(0.016, 0.065, D - 0.03), W / 2 - 0.008, yy, 0));
        parts.push(place(box(0.016, 0.065, D - 0.03), -W / 2 + 0.008, yy, 0));
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(place(box(0.035, H, 0.035), sx * (W / 2 - 0.03), H / 2, sz * (D / 2 - 0.03)));
      for (const k of [-1, 0, 1]) parts.push(place(box(W - 0.02, 0.012, 0.1), 0, 0.008, k * 0.12));
      const g = merge(parts);
      place(g, x, y, z, rot);
      crates.push(g);
      if (!fill) return;
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      const at = (lx: number, lz: number) => [x + lx * c + lz * s, z - lx * s + lz * c] as const;
      if (fill === 'cucumber' || fill === 'aubergine') {
        const n = fill === 'cucumber' ? 11 : 8;
        for (let i = 0; i < n; i++) {
          const [px, pz] = at((r() - 0.5) * 0.36, (r() - 0.5) * 0.22);
          const sc: [number, number, number] = fill === 'cucumber' ? [0.024, 0.1, 0.024] : [0.042, 0.085, 0.042];
          addLong(fill, px, y + 0.24 + r() * 0.05, pz, sc, rot + (r() - 0.5) * 0.5 + (fill === 'aubergine' ? r() * 3 : 0));
        }
      } else {
        const rad = fill === 'lemon' ? 0.033 : fill === 'pomegranate' ? 0.045 : 0.037;
        for (let ix = 0; ix < 7; ix++)
          for (let iz = 0; iz < 5; iz++) {
            const lx = -0.24 + ix * 0.08 + (r() - 0.5) * 0.02;
            const lz = -0.14 + iz * 0.07 + (r() - 0.5) * 0.02;
            if (Math.abs(lx) > 0.25 - rad * 0.6 || Math.abs(lz) > 0.16 - rad * 0.5) continue;
            const [px, pz] = at(lx, lz);
            const sc: [number, number, number] = fill === 'lemon' ? [rad, rad, rad * 1.3] : [rad, rad * 0.9, rad];
            addRound(fill, px, y + 0.25 + r() * 0.03 + (1 - Math.hypot(lx / 0.25, lz / 0.15)) * 0.03, pz, sc);
          }
      }
    };

    // ---------------- shade sail pergola ----------------
    const P = { x0: 11.5, x1: 16.9, z0: 15.7, z1: 19.3 };
    const corners: [number, number, number][] = [
      [P.x0, 2.75, P.z0],
      [P.x1, 2.5, P.z0],
      [P.x0, 2.35, P.z1],
      [P.x1, 2.62, P.z1],
    ];
    for (const [x, h, z] of corners) wood.push(place(boxProjectUVs(roundedBox(0.12, h + 0.15, 0.12, 0.02, 1).clone(), 0.7), x, (h + 0.15) / 2, z));
    const sailGeo = (() => {
      const nu = 18;
      const nv = 12;
      const pos: number[] = [];
      const uv: number[] = [];
      const idx: number[] = [];
      const inset = 0.12;
      const [a, b, c, d] = corners.map((p) => new THREE.Vector3(...p));
      for (let j = 0; j <= nv; j++)
        for (let i = 0; i <= nu; i++) {
          const u = i / nu;
          const v = j / nv;
          const p = a
            .clone()
            .multiplyScalar((1 - u) * (1 - v))
            .addScaledVector(b, u * (1 - v))
            .addScaledVector(c, (1 - u) * v)
            .addScaledVector(d, u * v);
          // concave edges pulled in toward the centre, gentle belly
          const cu = Math.sin(Math.PI * v) * inset * (1 - 2 * u);
          const cv = Math.sin(Math.PI * u) * inset * 0.8 * (1 - 2 * v);
          p.x += cu * 3.2 * (u < 0.5 ? 1 : 1);
          p.z += cv * 3.2;
          p.y -= Math.sin(Math.PI * u) * Math.sin(Math.PI * v) * 0.16 - 0.05;
          pos.push(p.x, p.y, p.z);
          uv.push(u * 3, v * 2);
        }
      for (let j = 0; j < nv; j++)
        for (let i = 0; i < nu; i++) {
          const k = j * (nu + 1) + i;
          idx.push(k, k + nu + 1, k + 1, k + 1, k + nu + 1, k + nu + 2);
        }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      // hemmed edge: a rope running round the perimeter
      const at = (i: number, j: number) => new THREE.Vector3(pos[(j * (nu + 1) + i) * 3], pos[(j * (nu + 1) + i) * 3 + 1], pos[(j * (nu + 1) + i) * 3 + 2]);
      const edge: THREE.Vector3[] = [];
      for (let i = 0; i <= nu; i++) edge.push(at(i, 0));
      for (let j = 1; j <= nv; j++) edge.push(at(nu, j));
      for (let i = nu - 1; i >= 0; i--) edge.push(at(i, nv));
      for (let j = nv - 1; j >= 1; j--) edge.push(at(0, j));
      ropes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge, true), 120, 0.016, 5, true));
      return g;
    })();
    for (const [x, h, z] of corners) {
      const t = new THREE.TorusGeometry(0.06, 0.012, 6, 12);
      ropes.push(place(t, x, h + 0.02, z, 0, Math.PI / 2));
    }

    // ---------------- work table ----------------
    const T = { x: 14.3, z: 17.6, w: 2.9, d: 0.95, h: 0.84 };
    for (let k = 0; k < 5; k++)
      wood.push(place(boxProjectUVs(roundedBox(T.w, 0.045, T.d / 5 - 0.01, 0.01, 1).clone(), 0.8), T.x, T.h, T.z - T.d / 2 + (k + 0.5) * (T.d / 5)));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) wood.push(place(box(0.07, T.h - 0.02, 0.07), T.x + sx * (T.w / 2 - 0.2), (T.h - 0.02) / 2, T.z + sz * (T.d / 2 - 0.1)));
      wood.push(place(box(0.06, 0.06, T.d - 0.2), T.x + sx * (T.w / 2 - 0.2), 0.22, T.z));
    }
    wood.push(place(box(T.w - 0.4, 0.06, 0.06), T.x, 0.22, T.z));
    const top = T.h + 0.025;
    crate(T.x - 1.0, top, T.z - 0.12, 0.04, 'tomato');
    crate(T.x - 0.38, top, T.z + 0.14, -0.06, 'cucumber');
    crate(T.x + 0.26, top, T.z - 0.14, 0.08, 'aubergine');
    crate(T.x + 0.92, top, T.z + 0.1, -0.03, 'lemon');
    // a tray of dates and bunches of mint/parsley along the front edge
    const tray = smoothLathe([[0.001, 0], [0.19, 0], [0.24, 0.035], [0.26, 0.06]], 32, 8).clone();
    weave.push(place(tray, T.x + 1.0, top, T.z - 0.32));
    {
      const dome = new THREE.SphereGeometry(0.2, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      dome.scale(1, 0.32, 1);
      dates.push(place(dome, T.x + 1.0, top + 0.02, T.z - 0.32));
    }
    for (const [hx, hz] of [
      [-0.62, -0.36],
      [-0.2, -0.38],
      [0.55, -0.37],
    ]) {
      const g = new THREE.IcosahedronGeometry(0.075, 1);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const k = 0.75 + Math.abs(Math.sin(p.getX(i) * 61 + p.getZ(i) * 37)) * 0.45;
        p.setXYZ(i, p.getX(i) * k * 1.6, Math.max(-0.02, p.getY(i)) * k * 0.7, p.getZ(i) * k);
      }
      g.computeVertexNormals();
      herbs.push(place(g, T.x + hx, top + 0.035, T.z + hz, r() * 3));
    }

    // ---------------- crates, baskets, sacks on the ground ----------------
    crate(16.45, 0, 18.75, 0.1);
    crate(16.45, 0.305, 18.72, 0.05, 'pomegranate');
    crate(15.85, 0, 18.85, -0.08, 'onion');
    crate(17.05, 0, 18.2, 1.45);
    crate(17.0, 0.305, 18.25, 1.5);
    crate(17.1, 0.61, 18.2, 1.4);
    crate(12.2, 0, 16.0, 0.35, 'tomato');
    const basket = (x: number, z: number, s: number, fill: 'dates' | 'lime' | 'pepper') => {
      const g = smoothLathe([[0.001, 0], [0.15, 0], [0.2, 0.06], [0.23, 0.18], [0.245, 0.26]], 36, 10).clone();
      g.scale(s, s, s);
      weave.push(place(g, x, 0, z));
      const rim = new THREE.TorusGeometry(0.245 * s, 0.015, 6, 28);
      weave.push(place(rim, x, 0.26 * s, z, 0, Math.PI / 2));
      if (fill === 'dates') {
        const dome = new THREE.SphereGeometry(0.235 * s, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        dome.scale(1, 0.45, 1);
        dates.push(place(dome, x, 0.2 * s, z));
      } else
        for (let i = 0; i < 22; i++) {
          const a = r() * Math.PI * 2;
          const d = Math.sqrt(r()) * 0.19 * s;
          const rad = fill === 'lime' ? 0.026 : 0.034;
          addRound(fill, x + Math.cos(a) * d, 0.2 * s + (1 - d / (0.2 * s)) * 0.05, z + Math.sin(a) * d, fill === 'pepper' ? [rad, rad * 1.4, rad] : [rad, rad, rad]);
        }
    };
    basket(12.85, 15.75, 1, 'dates');
    basket(13.5, 15.6, 0.85, 'lime');
    basket(15.2, 15.65, 0.9, 'pepper');
    const sack = (x: number, z: number, rot: number, open: boolean) => {
      const prof: [number, number][] = open
        ? [
            [0.001, 0],
            [0.2, 0],
            [0.25, 0.12],
            [0.245, 0.34],
            [0.23, 0.42],
            [0.25, 0.45],
          ]
        : [
            [0.001, 0],
            [0.21, 0],
            [0.26, 0.14],
            [0.25, 0.38],
            [0.17, 0.52],
            [0.06, 0.58],
            [0.1, 0.66],
            [0.001, 0.64],
          ];
      const g = smoothLathe(prof, 20, 14).clone();
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const k = 1 + Math.sin(p.getY(i) * 23 + Math.atan2(p.getZ(i), p.getX(i)) * 3) * 0.035;
        p.setX(i, p.getX(i) * k);
        p.setZ(i, p.getZ(i) * k * 0.85);
      }
      g.computeVertexNormals();
      sacking.push(place(boxProjectUVs(g, 1.6), x, 0, z, rot));
      if (open)
        for (let i = 0; i < 18; i++) {
          const a = r() * Math.PI * 2;
          const d = Math.sqrt(r()) * 0.2;
          addRound('onion', x + Math.cos(a) * d, 0.42 + (0.2 - d) * 0.25, z + Math.sin(a) * d * 0.85, [0.04, 0.036, 0.04]);
        }
    };
    sack(11.85, 18.75, 0.3, true);
    sack(12.4, 19.05, 1.2, false);
    sack(11.95, 19.35, 2.0, false);
    for (let i = 0; i < 5; i++) addRound('onion', 12.15 + r() * 0.5, 0.035, 18.35 + r() * 0.3, [0.04, 0.036, 0.04]);

    // ---------------- wheelbarrow with melons ----------------
    {
      const wx = 18.2;
      const wz = 16.6;
      const rot = -0.7;
      const parts: THREE.BufferGeometry[] = [];
      const trayG = new THREE.CylinderGeometry(0.44, 0.3, 0.3, 4, 1, true);
      trayG.rotateY(Math.PI / 4);
      trayG.scale(1.25, 1, 0.85);
      parts.push(place(trayG, 0, 0.56, 0));
      const floor = new THREE.CylinderGeometry(0.3, 0.3, 0.01, 4);
      floor.rotateY(Math.PI / 4);
      floor.scale(1.25, 1, 0.85);
      parts.push(place(floor, 0, 0.41, 0));
      const tray = merge(parts);
      place(tray, wx, 0, wz, rot);
      metal.push(tray);
      const frame: THREE.BufferGeometry[] = [];
      for (const s of [-0.2, 0.2]) {
        frame.push(place(new THREE.CylinderGeometry(0.02, 0.02, 1.55, 6), -0.18, 0.5, s, 0, 0, 1.25));
        frame.push(place(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 6), -0.42, 0.2, s));
      }
      frame.push(place(new THREE.TorusGeometry(0.2, 0.055, 8, 20), 0.6, 0.22, 0));
      const f = merge(frame);
      place(f, wx, 0, wz, rot);
      wood.push(f);
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      for (const [lx, lz, sc] of [
        [-0.1, 0.05, 0.15],
        [0.18, -0.08, 0.13],
        [0.02, -0.02, 0.12],
      ])
        addRound('melon', wx + lx * c + lz * s, 0.6 + (lx > 0.1 ? 0.0 : 0.04), wz - lx * s + lz * c, [sc, sc * 0.92, sc * 1.25]);
    }

    // ---------------- wash tub on a stand ----------------
    {
      const tub = smoothLathe([[0.001, 0], [0.24, 0], [0.3, 0.06], [0.33, 0.24], [0.34, 0.26]], 32, 8).clone();
      metal.push(place(tub, 15.55, 0.62, 19.45));
      for (const [dx, dz] of [
        [-0.24, -0.24],
        [0.24, -0.24],
        [-0.24, 0.24],
        [0.24, 0.24],
      ])
        wood.push(place(box(0.05, 0.62, 0.05), 15.55 + dx, 0.31, 19.45 + dz));
      wood.push(place(box(0.56, 0.04, 0.56), 15.55, 0.6, 19.45));
    }

    // ---------------- watering cans by the beds and the tub ----------------
    const can = (x: number, z: number, rot: number) => {
      const parts: THREE.BufferGeometry[] = [];
      parts.push(place(new THREE.CylinderGeometry(0.115, 0.125, 0.27, 20, 1, false), 0, 0.135, 0));
      parts.push(place(new THREE.TorusGeometry(0.1, 0.012, 6, 16, Math.PI), 0, 0.27, 0, Math.PI / 2));
      parts.push(tubeAlong([new THREE.Vector3(0.1, 0.06, 0), new THREE.Vector3(0.22, 0.17, 0), new THREE.Vector3(0.33, 0.31, 0)], 0.016, 6));
      parts.push(place(new THREE.CylinderGeometry(0.045, 0.018, 0.06, 10), 0.35, 0.33, 0, 0, 0, -0.75));
      parts.push(place(new THREE.TorusGeometry(0.07, 0.01, 6, 12, Math.PI), -0.12, 0.17, 0, 0, 0, Math.PI / 2));
      const g = merge(parts);
      metal.push(place(g, x, 0, z, rot));
    };
    can(7.55, 11.7, 0.6);
    can(17.15, 11.35, 2.4);
    can(15.05, 19.6, -0.4);
    can(9.0, 15.9, 1.9);

    // ---------------- hanging-scale tripod ----------------
    const apex = new THREE.Vector3(10.55, 2.05, 16.9);
    for (let k = 0; k < 3; k++) {
      const a = k * 2.094 + 0.3;
      const foot = new THREE.Vector3(apex.x + Math.cos(a) * 0.85, 0, apex.z + Math.sin(a) * 0.85);
      const top = apex.clone().add(new THREE.Vector3(Math.cos(a) * -0.1, 0.18, Math.sin(a) * -0.1));
      const len = foot.distanceTo(top);
      const pole = new THREE.CylinderGeometry(0.032, 0.04, len, 8);
      const qq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(foot).normalize());
      pole.applyQuaternion(qq);
      const mid = foot.clone().lerp(top, 0.5);
      pole.translate(mid.x, mid.y, mid.z);
      wood.push(pole);
    }
    ropes.push(place(new THREE.TorusGeometry(0.07, 0.022, 6, 14), apex.x, apex.y + 0.02, apex.z, 0, Math.PI / 2));

    const geo = (list: THREE.BufferGeometry[]) => (list.length ? merge(list) : null);
    return {
      round,
      long,
      apex,
      sail: sailGeo,
      crates: geo(crates),
      wood: geo(wood),
      metal: geo(metal),
      weave: geo(weave),
      sacking: geo(sacking),
      herbs: geo(herbs),
      dates: geo(dates),
      ropes: geo(ropes),
    };
  }, []);

  useLayoutEffect(() => {
    for (const [ref, items] of [
      [roundRef, built.round],
      [longRef, built.long],
    ] as const) {
      const mesh = ref.current;
      if (!mesh) continue;
      items.forEach((it, i) => {
        mesh.setMatrixAt(i, it.m);
        mesh.setColorAt(i, it.c);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [built]);

  return (
    <group>
      <mesh geometry={built.sail} material={m.sail} castShadow receiveShadow />
      {built.crates && <mesh geometry={built.crates} material={m.woodLight} castShadow receiveShadow />}
      {built.wood && <mesh geometry={built.wood} material={m.woodGrey} castShadow receiveShadow />}
      {built.metal && <mesh geometry={built.metal} material={m.galvanised} castShadow receiveShadow />}
      {built.weave && <mesh geometry={built.weave} material={m.safeefah} castShadow receiveShadow />}
      {built.sacking && <mesh geometry={built.sacking} material={m.burlap} castShadow receiveShadow />}
      {built.dates && <mesh geometry={built.dates} material={m.dates} receiveShadow />}
      {built.ropes && <mesh geometry={built.ropes} material={m.rope} castShadow />}
      {built.herbs && <mesh geometry={built.herbs} material={m.leaf} castShadow receiveShadow />}
      <instancedMesh ref={roundRef} args={[roundGeo, m.produce, built.round.length]} castShadow={quality === 'high'} receiveShadow />
      <instancedMesh ref={longRef} args={[longGeo, m.produce, built.long.length]} castShadow={quality === 'high'} receiveShadow />
      <mesh position={[15.55, 0.86, 19.45]} rotation={[-Math.PI / 2, 0, 0]} material={m.stillWater}>
        <circleGeometry args={[0.31, 28]} />
      </mesh>
      <HangingScale m={m} apex={built.apex} />
    </group>
  );
}

/** Spring scale with a pan of tomatoes, swaying slightly on its chain. */
function HangingScale({ m, apex }: { m: FarmMaterials; apex: THREE.Vector3 }) {
  const ref = useRef<THREE.Group>(null);
  const pan = useMemo(() => smoothLathe([[0.001, 0], [0.12, 0.0], [0.19, 0.035], [0.21, 0.06]], 28, 8), []);
  const chains = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    parts.push(place(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 4), 0, -0.11, 0));
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const from = new THREE.Vector3(0, -0.48, 0);
      const to = new THREE.Vector3(Math.cos(a) * 0.19, -0.92, Math.sin(a) * 0.19);
      const g = new THREE.CylinderGeometry(0.004, 0.004, from.distanceTo(to), 4);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize()));
      const mid = from.clone().lerp(to, 0.5);
      g.translate(mid.x, mid.y, mid.z);
      parts.push(g);
    }
    parts.push(place(new THREE.TorusGeometry(0.025, 0.005, 6, 12), 0, -0.47, 0));
    return merge(parts);
  }, []);
  const metal = useMemo(() => {
    const body = new THREE.CylinderGeometry(0.055, 0.055, 0.17, 20);
    body.translate(0, -0.31, 0);
    const p = pan.clone();
    p.translate(0, -0.93, 0);
    return merge([body, p]);
  }, [pan]);
  const tomatoes = useMemo(() => {
    const r = rng(9);
    return merge(
      Array.from({ length: 6 }, () => {
        const g = new THREE.SphereGeometry(0.04, 10, 7);
        g.translate((r() - 0.5) * 0.18, -0.875 + r() * 0.02, (r() - 0.5) * 0.18);
        return g;
      }),
    );
  }, []);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.rotation.x = Math.sin(t * 1.6) * 0.035 + Math.sin(t * 0.7) * 0.02;
    g.rotation.z = Math.sin(t * 1.3 + 1) * 0.03;
    g.rotation.y = Math.sin(t * 0.4) * 0.2;
  });
  return (
    <group position={[apex.x, apex.y, apex.z]}>
      <group ref={ref} userData={{ noBatch: true }}>
        <mesh geometry={chains} material={m.iron} userData={{ noBatch: true }} />
        <mesh geometry={metal} material={m.galvanised} castShadow userData={{ noBatch: true }} />
        <mesh position={[0, -0.28, 0.056]} userData={{ noBatch: true }}>
          <circleGeometry args={[0.045, 24]} />
          <meshStandardMaterial color="#F2EEE4" roughness={0.4} />
        </mesh>
        <mesh geometry={tomatoes} material={m.tomato} userData={{ noBatch: true }} />
      </group>
    </group>
  );
}

/** Palm-leaf mats with the season's dates drying in the sun. */
export function DryingMats({ m }: { m: FarmMaterials }) {
  const geos = useMemo(() => {
    const mats: THREE.BufferGeometry[] = [];
    const layers: THREE.BufferGeometry[] = [];
    const spots: [number, number, number][] = [
      [DRYING.x - 2.75, DRYING.z - 0.2, 0.05],
      [DRYING.x, DRYING.z + 0.25, -0.04],
      [DRYING.x + 2.75, DRYING.z - 0.1, 0.07],
    ];
    for (const [x, z, rot] of spots) {
      const mat = new THREE.BoxGeometry(2.45, 0.025, 1.55);
      // sample a plain (undyed) band of the plait so the mats read as natural palm leaf
      const uv = mat.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, 0.78 + uv.getY(i) * 0.2);
      mats.push(place(mat, x, 0.0125, z, rot));
      const layer = new THREE.PlaneGeometry(1.85, 1.05, 1, 1);
      layer.rotateX(-Math.PI / 2);
      const luv = layer.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < luv.count; i++) luv.setXY(i, luv.getX(i) * 1.85, luv.getY(i) * 1.05);
      layers.push(place(layer, x, 0.034, z, rot));
    }
    return { mats: merge(mats), layers: merge(layers) };
  }, []);
  return (
    <group>
      <mesh geometry={geos.mats} material={m.safeefah} castShadow receiveShadow />
      <mesh geometry={geos.layers} material={m.dates} receiveShadow />
    </group>
  );
}
