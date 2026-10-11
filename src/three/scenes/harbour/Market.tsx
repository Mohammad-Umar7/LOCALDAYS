import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { smoothLathe } from '../../props/geo';
import type { Quality } from '../../core/types';
import { groundHeight, rng } from './layout';
import { PAL, type HarbourMaterials } from './materials';
import { crate, CRATE } from './Boats';
import { hamourTexture } from './textures';
import { box, mergeAll, place, rod, tint } from './util';

/* ------------------------------------------------------------------ */
/*  Fish auction & sorting shed: raised concrete platform, timber     */
/*  frame under an areesh (palm-rib + frond) roof that throws dappled */
/*  shade, stainless sorting tables on beds of ice, blue fish crates, */
/*  a hanging spring scale, a hose on its standpipe — and the morning */
/*  catch: kingfish (kanaad), hamour and sheri, instanced.            */
/* ------------------------------------------------------------------ */

export const SHED = { x: 13, z: 9.0, w: 11.4, d: 7.6, floor: 1.08, h: 3.3 };

type Species = 'kanaad' | 'hamour' | 'sheri';

/** Lofted fish body + fins, lying along +z (head at +z), countershaded via vertex colour. */
function fishGeometry(kind: Species) {
  const L = 1;
  const spec = {
    kanaad: { h: 0.17, w: 0.1, back: '#3E5A6E', belly: '#E8ECEC', fork: true, dorsal: 0.05 },
    hamour: { h: 0.3, w: 0.17, back: '#FFFFFF', belly: '#FFFFFF', fork: false, dorsal: 0.08 },
    sheri: { h: 0.32, w: 0.12, back: '#C0564A', belly: '#F2D2C2', fork: true, dorsal: 0.07 },
  }[kind];
  const along = 16;
  const around = 10;
  const pos: number[] = [];
  const col: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const back = new THREE.Color(spec.back);
  const belly = new THREE.Color(spec.belly);
  const c = new THREE.Color();
  for (let i = 0; i <= along; i++) {
    const s = i / along; // 0 tail → 1 snout
    const prof = Math.sin(Math.PI * Math.min(1, s * 0.92 + 0.08)) ** 0.75 * (s < 0.12 ? 0.35 + s * 5 : 1);
    const hh = (spec.h / 2) * prof * (s > 0.85 ? 1 - (s - 0.85) * 2.2 : 1);
    const ww = (spec.w / 2) * prof;
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI * 2;
      const y = Math.sin(a) * hh;
      const x = Math.cos(a) * ww;
      pos.push(x, y, (s - 0.5) * L);
      const t = THREE.MathUtils.smoothstep(Math.sin(a), -0.4, 0.5);
      c.copy(belly).lerp(back, t);
      col.push(c.r, c.g, c.b);
      uv.push(s, j / around);
    }
  }
  const R = around + 1;
  for (let i = 0; i < along; i++)
    for (let j = 0; j < around; j++) {
      const a = i * R + j;
      idx.push(a, a + R, a + 1, a + 1, a + R, a + R + 1);
    }
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  body.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  body.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  body.setIndex(idx);
  body.computeVertexNormals();

  // tail fin (flat, double-sided via two faces)
  const tail = new THREE.Shape();
  tail.moveTo(0, 0);
  if (spec.fork) {
    tail.lineTo(-spec.h * 0.75, -0.17);
    tail.lineTo(-spec.h * 0.25, -0.07);
    tail.lineTo(0, -0.1);
    tail.lineTo(spec.h * 0.25, -0.07);
    tail.lineTo(spec.h * 0.75, -0.17);
  } else {
    tail.quadraticCurveTo(-spec.h * 0.55, -0.1, -spec.h * 0.35, -0.16);
    tail.quadraticCurveTo(0, -0.19, spec.h * 0.35, -0.16);
    tail.quadraticCurveTo(spec.h * 0.55, -0.1, 0, 0);
  }
  tail.closePath();
  const tg = new THREE.ExtrudeGeometry(tail, { depth: 0.006, bevelEnabled: false });
  tg.rotateY(Math.PI / 2);
  tg.rotateZ(Math.PI / 2);
  tg.translate(0, 0, -0.44 * L);
  // dorsal fin
  const dor = new THREE.Shape();
  dor.moveTo(-0.22, 0);
  dor.lineTo(0.12, 0);
  dor.quadraticCurveTo(-0.02, spec.dorsal * 1.4, -0.22, spec.dorsal);
  dor.closePath();
  const dg = new THREE.ExtrudeGeometry(dor, { depth: 0.005, bevelEnabled: false });
  dg.rotateY(-Math.PI / 2);
  dg.translate(0.0025, spec.h * 0.42, 0.02);
  const fc = back.clone().lerp(belly, 0.25);
  const fins = [tg, dg].map((g) => {
    const cc = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < cc.length; i += 3) {
      cc[i] = fc.r;
      cc[i + 1] = fc.g;
      cc[i + 2] = fc.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    return g;
  });
  return mergeAll([body, ...fins], true);
}

interface FishItem {
  p: [number, number, number];
  yaw: number;
  len: number;
  tint: number;
}

function FishSet({ kind, items, material }: { kind: Species; items: FishItem[]; material: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => fishGeometry(kind), [kind]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    items.forEach((f, i) => {
      o.position.set(...f.p);
      // lying on its side on the ice
      o.rotation.set(0, f.yaw, Math.PI / 2 + (f.tint - 0.5) * 0.15, 'YXZ');
      o.scale.set(f.len, f.len, f.len);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.setScalar(0.88 + f.tint * 0.2));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[geo, material, items.length]} castShadow receiveShadow />;
}

/** Bumpy bed of crushed ice. */
function iceBed(w: number, d: number, seed: number) {
  const g = new THREE.PlaneGeometry(w, d, Math.round(w * 14), Math.round(d * 14));
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  const r = rng(seed);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const edge = Math.min(1, (w / 2 - Math.abs(x)) * 8, (d / 2 - Math.abs(z)) * 8);
    p.setY(i, Math.max(0, edge) * (0.035 + r() * 0.025 + Math.sin(x * 23 + z * 17) * 0.008));
  }
  g.computeVertexNormals();
  return g;
}

function useShedParts(quality: Quality) {
  return useMemo(() => {
    const { x, z, w, d, floor, h } = SHED;
    const r = rng(23);
    const gMin = Math.min(groundHeight(x - w / 2, z - d / 2), groundHeight(x + w / 2, z - d / 2), groundHeight(x, z - d / 2));
    const slab = place(box(w + 0.6, floor - gMin + 0.35, d + 0.6, 0.05, 0.4), [x, (floor + gMin - 0.35) / 2, z]);
    const steps: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) {
      const sh = (floor - gMin) * (1 - (i + 1) / 4);
      steps.push(place(box(3.2, sh + 0.3, 0.42, 0.04, 0.4), [x - 1.5, gMin + sh / 2 - 0.15, z - d / 2 - 0.5 - i * 0.42]));
    }
    const drain = place(box(w - 0.8, 0.012, 0.18, 0.005, 1), [x, floor + 0.004, z + 0.9]);

    // timber frame
    const frame: THREE.BufferGeometry[] = [];
    const xs = [x - w / 2 + 0.3, x - w / 6, x + w / 6, x + w / 2 - 0.3];
    const zs = [z - d / 2 + 0.3, z, z + d / 2 - 0.3];
    for (const px of xs)
      for (const pz of zs) {
        const g = rod(new THREE.Vector3(px, floor - 0.02, pz), new THREE.Vector3(px + (r() - 0.5) * 0.04, floor + h, pz + (r() - 0.5) * 0.04), 0.11, 0.095, 12, 3);
        frame.push(g);
        frame.push(place(box(0.34, 0.12, 0.34, 0.03, 0.5), [px, floor + 0.06, pz]));
      }
    for (const pz of zs) frame.push(place(box(w + 0.5, 0.24, 0.17, 0.03, 0.5), [x, floor + h - 0.05, pz]));
    for (let px = x - w / 2; px <= x + w / 2 + 0.01; px += 1.27) frame.push(rod(new THREE.Vector3(px, floor + h + 0.13, z - d / 2 - 0.35), new THREE.Vector3(px, floor + h + 0.13, z + d / 2 + 0.35), 0.06, 0.055, 7));
    // areesh: palm-rib slats + frond mats (gaps let dappled light through)
    const slats: THREE.BufferGeometry[] = [];
    for (let pz = z - d / 2 - 0.3; pz <= z + d / 2 + 0.3; pz += 0.075) {
      slats.push(rod(new THREE.Vector3(x - w / 2 - 0.4 + (r() - 0.5) * 0.2, floor + h + 0.21, pz), new THREE.Vector3(x + w / 2 + 0.4 + (r() - 0.5) * 0.2, floor + h + 0.21 + (r() - 0.5) * 0.02, pz + (r() - 0.5) * 0.04), 0.022, 0.018, 5));
    }
    const mats: THREE.BufferGeometry[] = [];
    // frond mats laid across the slats in irregular strips — gaps let dappled light through
    for (let px = x - w / 2 - 0.45; px < x + w / 2 + 0.45; ) {
      const sw = 0.32 + r() * 0.3;
      const g = new THREE.PlaneGeometry(sw, d + 0.8 + (r() - 0.5) * 0.3, 2, 18);
      g.rotateX(-Math.PI / 2);
      const p = g.attributes.position as THREE.BufferAttribute;
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const lz = p.getZ(i);
        p.setY(i, Math.sin(lz * 2.3 + px * 3.1) * 0.025 + Math.abs(p.getX(i)) * -0.06 + (r() - 0.5) * 0.01);
        uv.setXY(i, uv.getX(i) * sw * 1.4 + px * 0.73, (lz + d) * 0.32);
      }
      g.computeVertexNormals();
      g.rotateY((r() - 0.5) * 0.04);
      g.translate(px + sw / 2, floor + h + 0.27 + r() * 0.02, z + (r() - 0.5) * 0.2);
      mats.push(g);
      px += sw + 0.03 + r() * 0.09;
    }
    // ragged frond fringe hanging at the eaves
    for (const s of [-1, 1])
      for (let px = x - w / 2 - 0.4; px < x + w / 2 + 0.4; px += 0.32) {
        const g = new THREE.PlaneGeometry(0.34, 0.3 + r() * 0.2, 1, 2);
        g.translate(0, -0.15, 0);
        g.rotateX(s * 0.35);
        g.translate(px, floor + h + 0.26, z + s * (d / 2 + 0.38));
        mats.push(g);
      }

    // sorting tables
    const tables: THREE.BufferGeometry[] = [];
    const legs: THREE.BufferGeometry[] = [];
    const ice: THREE.BufferGeometry[] = [];
    const tableSpots = [
      { x: x - 2.3, z: z - 1.4 },
      { x: x + 2.3, z: z - 1.4 },
      { x: x + 0.2, z: z + 1.9 },
    ];
    for (const t of tableSpots) {
      tables.push(place(box(3.3, 0.05, 1.0, 0.012, 0.6), [t.x, floor + 0.86, t.z]));
      for (const s of [-1, 1]) {
        tables.push(place(box(3.3, 0.07, 0.03, 0.01, 0.6), [t.x, floor + 0.9, t.z + s * 0.5]));
        tables.push(place(box(0.03, 0.07, 1.0, 0.01, 0.6), [t.x + s * 1.65, floor + 0.9, t.z]));
      }
      for (const lx of [-1.5, 0, 1.5]) for (const lz of [-0.42, 0.42]) legs.push(rod(new THREE.Vector3(t.x + lx, floor, t.z + lz), new THREE.Vector3(t.x + lx, floor + 0.84, t.z + lz), 0.025, 0.025, 8));
      ice.push(place(iceBed(3.15, 0.86, Math.round(t.x * 10)), [t.x, floor + 0.885, t.z]));
    }

    // crates: stacks and iced crates with fish
    const crates: THREE.BufferGeometry[] = [];
    const crateIce: THREE.BufferGeometry[] = [];
    const stack = (cx: number, cz: number, n: number, yaw: number) => {
      for (let i = 0; i < n; i++) crates.push(place(crate().clone(), [cx + (r() - 0.5) * 0.03, floor + i * (CRATE.h + 0.005), cz + (r() - 0.5) * 0.03], [0, yaw + (r() - 0.5) * 0.06, 0]));
    };
    stack(x - w / 2 + 0.75, z + d / 2 - 0.65, 5, 0.1);
    stack(x - w / 2 + 1.45, z + d / 2 - 0.6, 4, -0.05);
    stack(x - w / 2 + 0.8, z + d / 2 - 1.15, 3, 0.2);
    stack(x + w / 2 - 0.8, z - d / 2 + 0.7, 3, 0.4);
    const iced: [number, number, number][] = [
      [x - 3.0, z + 0.2, 0.1],
      [x - 2.3, z + 0.25, -0.1],
      [x + 3.4, z + 0.1, 0.25],
      [x + 2.65, z + 2.9, -0.2],
    ];
    iced.forEach(([cx, cz, yaw]) => {
      crates.push(place(crate().clone(), [cx, floor, cz], [0, yaw, 0]));
      crateIce.push(place(iceBed(CRATE.w - 0.06, CRATE.d - 0.06, Math.round(cx * 7)), [cx, floor + CRATE.h - 0.08, cz], [0, yaw, 0]));
    });

    // white polystyrene boxes
    const poly: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) poly.push(place(box(0.7, 0.3, 0.45, 0.03, 0.8), [x - w / 2 + 2.25, floor + 0.15 + i * 0.305, z + d / 2 - 0.55], [0, (r() - 0.5) * 0.08, 0]));
    poly.push(place(box(0.7, 0.3, 0.45, 0.03, 0.8), [x - w / 2 + 3.05, floor + 0.15, z + d / 2 - 0.5], [0, 0.12, 0]));

    // hanging spring scale
    const sx = x - 0.4;
    const sz = z;
    const scale: THREE.BufferGeometry[] = [];
    scale.push(rod(new THREE.Vector3(sx, floor + h - 0.17, sz), new THREE.Vector3(sx, floor + 2.35, sz), 0.008, 0.008, 5));
    scale.push(place(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 28), [sx, floor + 2.18, sz], [Math.PI / 2, 0, 0]));
    scale.push(place(new THREE.TorusGeometry(0.035, 0.008, 5, 12), [sx, floor + 1.95, sz]));
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      scale.push(rod(new THREE.Vector3(sx, floor + 1.93, sz), new THREE.Vector3(sx + Math.cos(a) * 0.24, floor + 1.45, sz + Math.sin(a) * 0.24), 0.005, 0.005, 4));
    }
    const pan = place(new THREE.CylinderGeometry(0.28, 0.24, 0.06, 28, 1, true), [sx, floor + 1.45, sz]);
    const panBase = place(new THREE.CircleGeometry(0.24, 28), [sx, floor + 1.42, sz], [-Math.PI / 2, 0, 0]);
    const dial = place(new THREE.CircleGeometry(0.135, 28), [sx, floor + 2.18, sz + 0.042]);

    // hose: standpipe + coil + run to the tables
    const pipe = mergeAll([
      rod(new THREE.Vector3(x + w / 2 - 0.4, floor, z + 2.6), new THREE.Vector3(x + w / 2 - 0.4, floor + 0.9, z + 2.6), 0.035, 0.035, 10),
      place(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 8), [x + w / 2 - 0.47, floor + 0.86, z + 2.6], [0, 0, Math.PI / 2]),
      place(box(0.06, 0.08, 0.04, 0.01, 1), [x + w / 2 - 0.4, floor + 0.96, z + 2.6]),
    ]);
    const hosePts: THREE.Vector3[] = [new THREE.Vector3(x + w / 2 - 0.55, floor + 0.85, z + 2.6), new THREE.Vector3(x + w / 2 - 0.75, floor + 0.3, z + 2.55), new THREE.Vector3(x + w / 2 - 0.9, floor + 0.04, z + 2.3)];
    const hc = new THREE.Vector3(x + w / 2 - 1.5, floor + 0.04, z + 1.9);
    for (let i = 0; i <= 60; i++) {
      const a = (i / 20) * Math.PI * 2 + 0.6;
      const rr = 0.42 - (i / 60) * 0.12;
      hosePts.push(new THREE.Vector3(hc.x + Math.cos(a) * rr, floor + 0.03 + Math.floor(i / 20) * 0.03, hc.z + Math.sin(a) * rr));
    }
    hosePts.push(new THREE.Vector3(x + 2.0, floor + 0.03, z + 0.35), new THREE.Vector3(x + 0.9, floor + 0.03, z - 0.5), new THREE.Vector3(x + 0.6, floor + 0.03, z - 0.75));
    const hose = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hosePts), 220, 0.022, 6, false);

    // fish on the tables and in the crates
    const fish: Record<Species, FishItem[]> = { kanaad: [], hamour: [], sheri: [] };
    const row = (kind: Species, cx: number, cz: number, n: number, span: number, len: number, yawBase: number) => {
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1);
        fish[kind].push({ p: [cx - span / 2 + span * t + (r() - 0.5) * 0.05, floor + 0.94 + r() * 0.012, cz + (r() - 0.5) * 0.08], yaw: yawBase + (r() - 0.5) * 0.25, len: len * (0.88 + r() * 0.24), tint: r() });
      }
    };
    const t0 = tableSpots[0];
    const t1 = tableSpots[1];
    const t2 = tableSpots[2];
    row('kanaad', t0.x, t0.z - 0.2, 7, 2.6, 0.82, 0.1);
    row('hamour', t0.x - 0.4, t0.z + 0.25, 4, 1.8, 0.52, Math.PI / 2 + 0.2);
    row('sheri', t1.x, t1.z - 0.22, 9, 2.8, 0.34, Math.PI / 2);
    row('hamour', t1.x + 0.2, t1.z + 0.24, 5, 2.4, 0.5, Math.PI / 2 - 0.1);
    row('kanaad', t2.x - 0.5, t2.z, 3, 1.6, 0.78, 0.05);
    row('sheri', t2.x + 0.9, t2.z + 0.15, 4, 1.0, 0.33, Math.PI / 2);
    iced.forEach(([cx, cz], k) => {
      const kind: Species = k % 2 ? 'sheri' : 'hamour';
      for (let i = 0; i < 4; i++) fish[kind].push({ p: [cx + (i - 1.5) * 0.12, floor + CRATE.h - 0.02, cz + (r() - 0.5) * 0.08], yaw: Math.PI / 2 + (r() - 0.5) * 0.4, len: kind === 'sheri' ? 0.3 : 0.38, tint: r() });
    });

    // buyers' plastic chairs, palm-leaf baskets, buckets and a two-wheeled fish cart
    const extras: THREE.BufferGeometry[] = [];
    const chair = (cx: number, cz: number, yaw: number, c: string) => {
      const parts = [
        place(box(0.46, 0.04, 0.44, 0.02, 1), [0, 0.45, 0]),
        place(box(0.44, 0.42, 0.04, 0.02, 1), [0, 0.7, -0.22], [-0.12, 0, 0]),
        ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => rod(new THREE.Vector3(sx * 0.2, 0, sz * 0.19), new THREE.Vector3(sx * 0.19, 0.45, sz * 0.18), 0.018, 0.018, 6))),
      ];
      extras.push(tint(place(mergeAll(parts), [cx, floor, cz], [0, yaw, 0]), c));
    };
    chair(x - 4.6, z + 2.6, 2.4, '#F1F0EA');
    chair(x - 3.8, z + 3.0, 3.0, '#F1F0EA');
    chair(x + 4.7, z - 2.2, -1.2, '#2459A8');
    const bucket = (bx: number, bz: number, c: string) => extras.push(tint(place(new THREE.CylinderGeometry(0.17, 0.13, 0.32, 18, 1, true), [bx, floor + 0.16, bz]), c), tint(place(new THREE.CircleGeometry(0.13, 18), [bx, floor + 0.01, bz], [-Math.PI / 2, 0, 0]), c));
    bucket(x - 1.0, z - 2.6, '#E8691E');
    bucket(x + 1.2, z + 0.6, '#F1F0EA');
    const baskets: THREE.BufferGeometry[] = [];
    for (const [bx, bz] of [
      [x - 0.9, z + 1.1],
      [x - 0.45, z + 1.35],
      [x + 3.9, z + 2.9],
    ] as const) {
      const bk = smoothLathe(
        [
          [0.001, 0],
          [0.2, 0],
          [0.27, 0.12],
          [0.3, 0.26],
          [0.28, 0.3],
        ],
        20,
        12,
      ).clone();
      baskets.push(place(bk, [bx, floor, bz]));
    }
    // hand cart with crates by the steps
    const cx0 = x - 1.5;
    const cz0 = z - d / 2 - 2.3;
    const cy0 = groundHeight(cx0, cz0);
    const cart = mergeAll([
      place(box(1.3, 0.05, 0.8, 0.015, 0.6), [cx0, cy0 + 0.5, cz0], [0, 0.3, 0]),
      rod(new THREE.Vector3(cx0 - 0.6, cy0 + 0.52, cz0 - 0.2), new THREE.Vector3(cx0 - 1.45, cy0 + 0.9, cz0 - 0.45), 0.025, 0.025, 6),
      rod(new THREE.Vector3(cx0 - 0.4, cy0 + 0.52, cz0 + 0.45), new THREE.Vector3(cx0 - 1.25, cy0 + 0.9, cz0 + 0.2), 0.025, 0.025, 6),
    ]);
    const wheels = mergeAll([-0.45, 0.45].map((o) => place(new THREE.TorusGeometry(0.26, 0.05, 8, 20), [cx0 + 0.25 + Math.sin(0.3) * o, cy0 + 0.27, cz0 + Math.cos(0.3) * o], [0, 0.3, 0])));
    const cartCrates = mergeAll([place(crate().clone(), [cx0 + 0.15, cy0 + 0.53, cz0], [0, 0.3, 0]), place(crate().clone(), [cx0 - 0.15, cy0 + 0.53 + CRATE.h, cz0 - 0.05], [0, 0.25, 0])]);

    const T = tint;
    return {
      slab: mergeAll([slab, ...steps]),
      matte: mergeAll([T(drain, PAL.dark), T(mergeAll(slats), PAL.frond)], true),
      timber: T(mergeAll(frame), PAL.timber),
      mats: mergeAll(mats),
      metal: mergeAll([T(mergeAll(tables), PAL.steel), T(mergeAll(legs), PAL.galv), T(mergeAll(scale), PAL.steel), T(mergeAll([pan, panBase]), PAL.steel), T(pipe, PAL.galv)], true),
      ice: mergeAll([...ice, ...crateIce]),
      paint: mergeAll([T(mergeAll(crates), PAL.crateBlue), T(mergeAll(poly), PAL.white), T(dial, PAL.white), T(hose, PAL.hose), ...extras, T(cartCrates, PAL.crateBlue)], true),
      cart: mergeAll([T(cart, PAL.timber)], true),
      wheels: T(wheels, PAL.rubber),
      baskets: mergeAll(baskets),
      fish,
    };
  }, [quality]);
}

export function Market({ m, quality }: { m: HarbourMaterials; quality: Quality }) {
  const s = useShedParts(quality);
  const fishMats = useMemo(
    () => ({
      kanaad: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.3 }),
      hamour: new THREE.MeshStandardMaterial({ map: hamourTexture(), vertexColors: true, roughness: 0.45 }),
      sheri: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.15 }),
    }),
    [],
  );
  return (
    <group>
      <mesh geometry={s.slab} material={m.concrete} castShadow receiveShadow />
      <mesh geometry={s.matte} material={m.matte} castShadow receiveShadow />
      <mesh geometry={s.timber} material={m.timber} castShadow receiveShadow />
      <mesh geometry={s.mats} material={m.thatch} castShadow receiveShadow />
      <mesh geometry={s.metal} material={m.metal} castShadow receiveShadow />
      <mesh geometry={s.ice} material={m.ice} castShadow receiveShadow />
      <mesh geometry={s.paint} material={m.paint} castShadow receiveShadow />
      <mesh geometry={s.cart} material={m.timber} castShadow receiveShadow />
      <mesh geometry={s.wheels} material={m.matte} castShadow receiveShadow />
      <mesh geometry={s.baskets} material={m.thatch} castShadow receiveShadow />
      {(['kanaad', 'hamour', 'sheri'] as Species[]).map((k) => (
        <FishSet key={k} kind={k} items={s.fish[k]} material={fishMats[k]} />
      ))}
    </group>
  );
}
