import { useMemo } from 'react';
import * as THREE from 'three';
import { makeNoise } from '../../materials/noise';
import type { Quality } from '../../core/types';
import { JETTY, groundHeight, rng } from './layout';
import { PAL, type HarbourMaterials } from './materials';
import { netHeap } from './Boats';
import { box, mergeAll, place, rod, tint } from './util';

/* ------------------------------------------------------------------ */
/*  Net yard: monofilament nets drying over rope lines between rough  */
/*  poles (draped cloth surfaces with folds and ragged hems), float   */
/*  lines of orange and white beads, heaps of net on a tarp, a net    */
/*  being mended beside a low stool — plus a net thrown over the      */
/*  jetty rail.                                                        */
/* ------------------------------------------------------------------ */

const nz = makeNoise(13);
const P = 4096;

/**
 * A net draped over a sagging line from a to b. Each side falls by
 * dropA / dropB (clamped above the ground) with soft folds.
 */
export function drapeGeometry(a: THREE.Vector3, b: THREE.Vector3, sag: number, dropA: number, dropB: number, seed: number, floorAt?: (x: number, z: number) => number, density = 1) {
  const len = a.distanceTo(b);
  const S = Math.max(12, Math.round(len * 7 * density));
  const T = 18;
  const dir = b.clone().sub(a).setY(0).normalize();
  const perp = new THREE.Vector3(-dir.z, 0, dir.x);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= S; i++) {
    const s = i / S;
    const L = a.clone().lerp(b, s);
    L.y -= Math.sin(s * Math.PI) * sag;
    for (let j = 0; j <= T; j++) {
      const t = (j / T) * 2 - 1;
      const at = Math.abs(t);
      const drop = (t < 0 ? dropA : dropB) * (0.85 + 0.15 * nz(s * len * 0.7 + seed, t * 2, P, P) + 0.12 * Math.sin(s * 9 + seed));
      const fold = Math.sin(s * len * 4.2 + seed + t * 1.3) * 0.07 * at + nz(s * len * 1.3, seed + t, P, P) * 0.06 * at;
      const off = Math.sign(t) * (0.03 + 0.2 * Math.pow(at, 0.65)) + fold;
      let y = L.y - drop * Math.pow(at, 1.12);
      const px = L.x + perp.x * off;
      const pz = L.z + perp.z * off;
      if (floorAt) {
        const f = floorAt(px, pz) + 0.04;
        if (y < f) y = f + (f - y) * 0.05;
      }
      pos.push(px, y, pz);
      uv.push((s * len) / 0.55, (t * (t < 0 ? dropA : dropB)) / 0.55);
    }
  }
  const R = T + 1;
  for (let i = 0; i < S; i++)
    for (let j = 0; j < T; j++) {
      const p0 = i * R + j;
      idx.push(p0, p0 + R, p0 + 1, p0 + 1, p0 + R, p0 + R + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Bead floats every `step` along a sagging line. */
function floatLine(a: THREE.Vector3, b: THREE.Vector3, sag: number, step: number, out: { orange: THREE.BufferGeometry[]; white: THREE.BufferGeometry[] }, r = 0.055) {
  const len = a.distanceTo(b);
  const n = Math.floor(len / step);
  const dir = b.clone().sub(a).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  for (let i = 1; i < n; i++) {
    const s = i / n;
    const p = a.clone().lerp(b, s);
    p.y -= Math.sin(s * Math.PI) * sag - 0.02;
    const g = new THREE.CylinderGeometry(r, r, r * 2.2, 12, 1);
    g.applyQuaternion(q);
    g.translate(p.x, p.y, p.z);
    (i % 3 === 0 ? out.white : out.orange).push(g);
  }
}

const LINES: { a: [number, number]; b: [number, number]; h: number; net: 'green' | 'orange' | 'blue'; drop: [number, number] }[] = [
  { a: [-21.6, 8.2], b: [-14.2, 7.7], h: 1.95, net: 'green', drop: [1.55, 1.3] },
  { a: [-20.8, 11.3], b: [-13.0, 11.8], h: 1.95, net: 'green', drop: [1.4, 1.5] },
  { a: [-18.4, 14.5], b: [-12.6, 14.9], h: 1.8, net: 'orange', drop: [1.25, 1.1] },
];

export function Nets({ m, quality }: { m: HarbourMaterials; quality: Quality }) {
  const g = useMemo(() => {
    const r = rng(29);
    const dens = quality === 'low' ? 0.6 : 1;
    const poles: THREE.BufferGeometry[] = [];
    const ropes: THREE.BufferGeometry[] = [];
    const nets: Record<'green' | 'orange' | 'blue', THREE.BufferGeometry[]> = { green: [], orange: [], blue: [] };
    const floats = { orange: [] as THREE.BufferGeometry[], white: [] as THREE.BufferGeometry[] };
    LINES.forEach((l, k) => {
      const ga = groundHeight(l.a[0], l.a[1]);
      const gb = groundHeight(l.b[0], l.b[1]);
      const A = new THREE.Vector3(l.a[0], ga + l.h, l.a[1]);
      const B = new THREE.Vector3(l.b[0], gb + l.h, l.b[1]);
      // rough poles with a crutch at the top
      for (const [p, gg] of [
        [A, ga],
        [B, gb],
      ] as const) {
        poles.push(rod(new THREE.Vector3(p.x, gg - 0.3, p.z), new THREE.Vector3(p.x + (r() - 0.5) * 0.08, p.y + 0.2, p.z + (r() - 0.5) * 0.08), 0.065, 0.05, 9, 3));
        poles.push(rod(new THREE.Vector3(p.x, p.y - 0.15, p.z), new THREE.Vector3(p.x + 0.12, p.y + 0.18, p.z + 0.05), 0.03, 0.025, 6));
      }
      ropes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([A, A.clone().lerp(B, 0.5).add(new THREE.Vector3(0, -0.12, 0)), B]), 24, 0.016, 5, false));
      // guy ropes down to pegs
      for (const [p, s] of [
        [A, -1],
        [B, 1],
      ] as const) {
        const dir = B.clone().sub(A).normalize().multiplyScalar(s * 1.4);
        const peg = new THREE.Vector3(p.x + dir.x, groundHeight(p.x + dir.x, p.z + dir.z) + 0.05, p.z + dir.z);
        ropes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p.clone(), p.clone().lerp(peg, 0.5).add(new THREE.Vector3(0, -0.03, 0)), peg]), 8, 0.012, 4, false));
        poles.push(rod(peg.clone().add(new THREE.Vector3(0, -0.2, 0)), peg.clone().add(new THREE.Vector3(0, 0.08, 0)), 0.025, 0.02, 5));
      }
      // the net itself (two layers for density) hung slightly short of the poles
      const a2 = A.clone().lerp(B, 0.06);
      const b2 = A.clone().lerp(B, 0.94);
      a2.y += 0.02;
      b2.y += 0.02;
      nets[l.net].push(drapeGeometry(a2, b2, 0.12, l.drop[0], l.drop[1], k * 7 + 1, groundHeight, dens));
      const a3 = A.clone().lerp(B, 0.12).add(new THREE.Vector3(0, 0.03, 0));
      const b3 = A.clone().lerp(B, 0.85).add(new THREE.Vector3(0, 0.03, 0));
      nets[l.net].push(drapeGeometry(a3, b3, 0.11, l.drop[0] * 0.8, l.drop[1] * 0.85, k * 7 + 4, groundHeight, dens * 0.8));
      floatLine(a2.clone().add(new THREE.Vector3(0, 0.03, 0)), b2.clone().add(new THREE.Vector3(0, 0.03, 0)), 0.12, 0.42, floats);
    });

    // net heaps on a tarp
    const tarpC = new THREE.Vector3(-16.9, groundHeight(-16.9, 5.6) + 0.02, 5.6);
    const tarp = new THREE.PlaneGeometry(3.4, 2.4, 12, 8);
    tarp.rotateX(-Math.PI / 2);
    {
      const p = tarp.attributes.position as THREE.BufferAttribute;
      const ca = Math.cos(0.18);
      const sa = Math.sin(0.18);
      for (let i = 0; i < p.count; i++) {
        const lx = p.getX(i);
        const lz = p.getZ(i);
        const x = tarpC.x + lx * ca - lz * sa;
        const z = tarpC.z + lx * sa + lz * ca;
        const edge = Math.max(Math.abs(lx) / 1.7, Math.abs(lz) / 1.2);
        p.setXYZ(i, x, groundHeight(x, z) + 0.025 + (edge > 0.92 ? Math.sin(x * 5) * 0.025 + 0.02 : 0), z);
      }
      tarp.computeVertexNormals();
    }
    const heaps: { net: THREE.BufferGeometry[]; core: THREE.BufferGeometry[] } = { net: [], core: [] };
    const heapAt = (x: number, z: number, rr: number, hh: number, seed: number, color: 'green' | 'orange') => {
      const h = netHeap(rr, hh, seed);
      const y = groundHeight(x, z) + 0.03;
      place(h.net, [x, y, z], [0, seed, 0]);
      place(h.core, [x, y, z], [0, seed, 0]);
      nets[color].push(h.net);
      heaps.core.push(tint(h.core, color === 'green' ? '#24463A' : '#8A4A26'));
    };
    heapAt(-17.6, 5.4, 0.85, 0.5, 1, 'green');
    heapAt(-16.1, 6.1, 0.7, 0.42, 3, 'orange');
    heapAt(-11.6, 5.2, 0.6, 0.36, 5, 'green');
    floatLine(new THREE.Vector3(-18.6, groundHeight(-18.6, 4.7) + 0.08, 4.7), new THREE.Vector3(-15.4, groundHeight(-15.4, 4.9) + 0.07, 4.9), -0.02, 0.32, floats, 0.06);

    // a net laid flat on the sand to dry
    const flat = new THREE.PlaneGeometry(4.2, 2.8, 30, 20);
    flat.rotateX(-Math.PI / 2);
    {
      const p = flat.attributes.position as THREE.BufferAttribute;
      const uv = flat.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const lx = p.getX(i);
        const lz = p.getZ(i);
        const x = lx * Math.cos(-0.25) - lz * Math.sin(-0.25) - 22.5;
        const z = lx * Math.sin(-0.25) + lz * Math.cos(-0.25) + 15.5;
        p.setXYZ(i, x, groundHeight(x, z) + 0.035 + Math.max(0, nz(x * 1.3, z * 1.3, P, P)) * 0.06, z);
        uv.setXY(i, uv.getX(i) * 4.2 / 0.55, uv.getY(i) * 2.8 / 0.55);
      }
      flat.computeVertexNormals();
    }
    nets.blue.push(flat);

    // mending corner: stool, a net stretched from a post hook, twine basket
    const mx = -10.3;
    const mz = 9.4;
    const my = groundHeight(mx, mz);
    const stool = mergeAll([
      place(box(0.42, 0.05, 0.36, 0.02, 0.6), [mx, my + 0.36, mz]),
      ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => rod(new THREE.Vector3(mx + sx * 0.16, my, mz + sz * 0.13), new THREE.Vector3(mx + sx * 0.15, my + 0.35, mz + sz * 0.12), 0.022, 0.02, 6))),
    ]);
    const hookPost = rod(new THREE.Vector3(mx - 1.3, my - 0.3, mz + 1.05), new THREE.Vector3(mx - 1.28, my + 1.45, mz + 1.06), 0.06, 0.05, 9);
    const mendNet = new THREE.PlaneGeometry(1.0, 1.5, 10, 14);
    {
      const p = mendNet.attributes.position as THREE.BufferAttribute;
      const uv = mendNet.attributes.uv as THREE.BufferAttribute;
      const top = new THREE.Vector3(mx - 1.22, my + 1.38, mz + 1.0);
      const lap = new THREE.Vector3(mx - 0.15, my + 0.45, mz + 0.05);
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i) + 0.5; // 0..1 across
        const v = 0.5 - p.getY(i) / 1.5; // 0 top → 1 bottom
        const c = top.clone().lerp(lap, Math.min(1, v * 1.15));
        const spread = 0.12 + v * 0.75;
        const across = new THREE.Vector3(0.62, 0, -0.78);
        const q = c.addScaledVector(across, (u - 0.5) * spread);
        q.y -= Math.sin(v * Math.PI) * 0.2 + (v > 0.85 ? (v - 0.85) * 2.5 : 0);
        q.y = Math.max(q.y, groundHeight(q.x, q.z) + 0.03);
        p.setXYZ(i, q.x, q.y, q.z);
        uv.setXY(i, (u * spread) / 0.4, v * 1.5 / 0.4);
      }
      mendNet.computeVertexNormals();
    }
    nets.green.push(mendNet);
    const basket = place(new THREE.CylinderGeometry(0.26, 0.2, 0.3, 20, 1, true), [mx + 0.55, my + 0.15, mz - 0.35]);
    const twine = place(new THREE.SphereGeometry(0.12, 14, 10), [mx + 0.55, my + 0.24, mz - 0.35]);

    // net thrown over the jetty rail
    const railY = JETTY.deck + 1.06;
    const ra = new THREE.Vector3(1.52, railY, 2.6);
    const rb = new THREE.Vector3(1.52, railY, -4.2);
    nets.orange.push(drapeGeometry(ra, rb, 0.0, 0.95, 1.35, 11, (x) => (x < JETTY.halfW ? JETTY.deck : -0.2), dens));
    floatLine(ra.clone().add(new THREE.Vector3(0.02, 0.03, 0)), rb.clone().add(new THREE.Vector3(0.02, 0.03, 0)), 0.0, 0.42, floats);

    const T = tint;
    return {
      timber: mergeAll([T(mergeAll(poles), PAL.pole), T(stool, PAL.timber), T(hookPost, PAL.pole)], true),
      rope: mergeAll([T(mergeAll(ropes), PAL.rope), T(twine, PAL.ropeBlue)], true),
      net: mergeAll([T(mergeAll(nets.green), PAL.netGreen), T(mergeAll(nets.orange), PAL.netOrange), T(mergeAll(nets.blue), PAL.netBlue)], true),
      paint: mergeAll([T(mergeAll(floats.orange), PAL.orange), T(mergeAll(floats.white), PAL.white)], true),
      matte: mergeAll(heaps.core, true),
      cloth: T(tarp, PAL.tarpBlue),
      basket: mergeAll([basket]),
    };
  }, [quality]);

  return (
    <group>
      <mesh geometry={g.timber} material={m.timber} castShadow receiveShadow />
      <mesh geometry={g.rope} material={m.rope} castShadow receiveShadow />
      <mesh geometry={g.net} material={m.net} castShadow receiveShadow />
      <mesh geometry={g.paint} material={m.paint} castShadow receiveShadow />
      <mesh geometry={g.matte} material={m.matte} castShadow receiveShadow />
      <mesh geometry={g.cloth} material={m.cloth} castShadow receiveShadow />
      <mesh geometry={g.basket} material={m.thatch} castShadow receiveShadow />
    </group>
  );
}
