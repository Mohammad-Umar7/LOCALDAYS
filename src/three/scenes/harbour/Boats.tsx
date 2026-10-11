import { useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { StaticBatch } from '../../core/StaticBatch';
import { Lantern } from '../../props/Decor';
import { smoothLathe } from '../../props/geo';
import type { Quality } from '../../core/types';
import { PAL, type HarbourMaterials } from './materials';
import { useFloat, type Pose } from './motion';
import { circle, deckGeometry, hullBand, makeHull, roundRect, sheerPath, sweep, transomGeometry, type Hull } from './hull';
import { trapCluster } from './Traps';
import { box, mergeAll, place, rod, slab, tint } from './util';

/* ------------------------------------------------------------------ */
/*  Fibreglass fishing boats (≈8 m) — hard-chine planing hulls with    */
/*  painted stripes, rubbing strakes, a console, shade canopy, tilted */
/*  outboards and the working gear of a Gulf fisherman: gargoor       */
/*  traps, nets, crates, floats and rope.                              */
/* ------------------------------------------------------------------ */

export const BOAT_HULL: Hull = makeHull({
  zStern: -3.85,
  zBow: 4.05,
  halfBeam: 1.2,
  beamAt: 0.4,
  transomFrac: 0.84,
  sheerStern: 0.92,
  sheerMid: 0.88,
  sheerBow: 1.45,
  sheerMidU: 0.36,
  keelY: -0.4,
  transomFootY: -0.19,
  transomRake: 0.14,
  runU: 0.14,
  forefootU: 0.5,
  stemRake: 0.52,
  fullness: () => 1.6,
  chine: (u) => ({
    x: THREE.MathUtils.lerp(0.95, 0.42, THREE.MathUtils.smoothstep(u, 0.45, 1)),
    y: THREE.MathUtils.lerp(0.26, 0.62, THREE.MathUtils.smoothstep(u, 0.3, 1)),
    round: 0.05,
  }),
  flare: 0.14,
});

const FLOOR_Y = 0.3;
const INSET = 0.055;
const U_FORE = 0.8;
export type BoatLivery = 'teal' | 'red' | 'blue';

function engineGeometry() {
  const cow = mergeAll([
    place(box(0.5, 0.58, 0.7, 0.16, 1.2, 3), [0, 0.58, -0.4]),
    place(box(0.44, 0.06, 0.62, 0.02, 1.2), [0, 0.3, -0.38]),
  ]);
  const lower = mergeAll([
    place(box(0.4, 0.28, 0.56, 0.08, 1.2, 2), [0, 0.14, -0.36]),
    place(box(0.15, 0.78, 0.3, 0.06, 1.2, 2), [0, -0.42, -0.34]),
    place(box(0.34, 0.03, 0.52, 0.012, 1.2), [0, -0.76, -0.36]),
    place(new THREE.CapsuleGeometry(0.075, 0.38, 4, 12), [0, -0.94, -0.36], [Math.PI / 2, 0, 0]),
    place(box(0.03, 0.18, 0.2, 0.01, 1.2), [0, -1.06, -0.3]),
    place(box(0.22, 0.32, 0.16, 0.03, 1.2), [0, 0.02, -0.06]),
  ]);
  const blades: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const b = new THREE.SphereGeometry(1, 10, 6);
    b.scale(0.11, 0.035, 0.012);
    b.translate(0.12, 0, 0);
    b.rotateZ((i / 3) * Math.PI * 2);
    b.rotateY(0.35);
    b.translate(0, -0.94, -0.62);
    blades.push(b);
  }
  return { cow, lower: mergeAll([lower, ...blades]) };
}

function crateGeometry() {
  // ribbed fish crate, open top
  const parts: THREE.BufferGeometry[] = [];
  const w = 0.6;
  const d = 0.4;
  const h = 0.28;
  parts.push(place(slab(w, 0.02, d, 1.5), [0, 0.01, 0]));
  for (const s of [-1, 1]) {
    parts.push(place(slab(w, h, 0.022, 1.5), [0, h / 2, (s * d) / 2]));
    parts.push(place(slab(0.022, h, d, 1.5), [(s * w) / 2, h / 2, 0]));
  }
  for (let i = -2; i <= 2; i++) for (const s of [-1, 1]) parts.push(place(slab(0.03, h * 0.9, 0.012, 1.5), [i * 0.12, h * 0.46, s * (d / 2 + 0.012)]));
  parts.push(place(box(w + 0.04, 0.03, d + 0.04, 0.01, 1.5), [0, h, 0]));
  return mergeAll(parts);
}
export const CRATE = { w: 0.6, d: 0.4, h: 0.28 };
let crateCache: THREE.BufferGeometry | null = null;
export function crate() {
  if (!crateCache) crateCache = crateGeometry();
  return crateCache;
}

/** Lumpy pile of netting (alpha mesh) with a dark core for bulk. */
export function netHeap(r: number, h: number, seed: number) {
  const g = new THREE.SphereGeometry(1, 26, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    const n = 1 + 0.16 * Math.sin(a * 3 + seed) + 0.1 * Math.sin(a * 7 + y * 5 + seed * 2) + 0.08 * Math.sin(y * 9 + a * 2);
    p.setXYZ(i, x * r * n, Math.max(0, y) * h * (0.85 + 0.15 * Math.sin(a * 2 + seed)), z * r * n);
  }
  g.computeVertexNormals();
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r * 6, uv.getY(i) * h * 4);
  const core = g.clone();
  core.scale(0.9, 0.86, 0.9);
  return { net: g, core };
}

function useBoatParts(quality: Quality, livery: BoatLivery, beached: boolean) {
  return useMemo(() => {
    const h = BOAT_HULL;
    const hi = quality !== 'low';
    const st = hi ? 80 : 50;
    const sy = (u: number) => h.sheer(u).y;
    const b0 = (u: number) => h.vAtY(u, -0.02);
    const b1 = (u: number) => h.vAtY(u, 0.09);
    const s0 = (u: number) => h.vAtY(u, sy(u) - 0.25);
    const s1 = (u: number) => h.vAtY(u, sy(u) - 0.12);
    const bottom = hullBand(h, { stations: st, rows: hi ? 10 : 6, v0: () => 0, v1: b0, planks: 2, tileLength: 2.5 });
    const boot = hullBand(h, { stations: st, rows: 2, v0: b0, v1: b1, planks: 2 });
    const sides = mergeAll([
      hullBand(h, { stations: st, rows: hi ? 8 : 5, v0: b1, v1: s0, planks: 2, tileLength: 3 }),
      hullBand(h, { stations: st, rows: 2, v0: s1, v1: () => 1, planks: 2, tileLength: 3 }),
    ]);
    const stripe = hullBand(h, { stations: st, rows: 2, v0: s0, v1: s1, planks: 2 });
    const inner = hullBand(h, { stations: 50, rows: 3, u0: 0.0, u1: U_FORE + 0.01, v0: (u) => h.vAtY(u, FLOOR_Y - 0.02), v1: () => 1, inset: INSET, planks: 2 });
    const floor = deckGeometry(h, 0.012, U_FORE, () => FLOOR_Y, INSET, 30, 0.02, 1.2);
    let uEnd = 0.96;
    for (let u = 0.985; u > 0.8; u -= 0.003) {
      const v = h.vAtY(u, sy(u) - 0.07);
      if (h.point(u, v).x - INSET > 0.06) {
        uEnd = u;
        break;
      }
    }
    const fore = deckGeometry(h, U_FORE - 0.01, uEnd, (u) => sy(u) - 0.07, INSET * 0.6, 20, 0.06, 1.2);
    const zFore = THREE.MathUtils.lerp(h.spec.zStern, h.spec.zBow, U_FORE);
    const foreW = (h.point(U_FORE, h.vAtY(U_FORE, sy(U_FORE) - 0.1)).x - INSET) * 2;
    const bulk = place(box(foreW, sy(U_FORE) - FLOOR_Y - 0.05, 0.05, 0.015, 1), [0, (sy(U_FORE) + FLOOR_Y) / 2 - 0.05, zFore - 0.02]);
    const transom = transomGeometry(h, 10, 0.02, 1.5);
    const transomIn = transom.clone();
    transomIn.translate(0, 0, 0.05);
    transomIn.setIndex(Array.from(transomIn.index!.array).reverse());
    transomIn.computeVertexNormals();

    const caps: THREE.BufferGeometry[] = [];
    const strakes: THREE.BufferGeometry[] = [];
    for (const side of [1, -1]) {
      caps.push(sweep(sheerPath(h, side, 0, INSET / 2, 0, 0.995, 70).map((p) => p.add(new THREE.Vector3(0, 0.02, 0))), roundRect(0.1, 0.05, 0.018, 2), new THREE.Vector3(0, 1, 0), 1));
      strakes.push(sweep(sheerPath(h, side, 0.05, -0.022, 0.0, 0.985, 70), roundRect(0.05, 0.065, 0.02, 2), new THREE.Vector3(0, 1, 0), 1));
    }
    const tTop = h.point(0, 1);
    const tCap: THREE.Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const s = (i / 12) * 2 - 1;
      tCap.push(new THREE.Vector3(tTop.x * s, tTop.y + 0.02 + 0.02 * (1 - s * s), tTop.z + 0.02));
    }
    caps.push(sweep(tCap, roundRect(0.08, 0.05, 0.018, 2), new THREE.Vector3(0, 0, -1), 1));

    // keel strip
    const kp: THREE.Vector3[] = [];
    for (let i = 0; i <= 40; i++) {
      const c = h.centre(0.02 + 0.97 * (i / 40));
      kp.push(new THREE.Vector3(0, c.y - 0.01, c.x));
    }
    strakes.push(sweep(kp, circle(0.04, 6), new THREE.Vector3(1, 0, 0), 1));

    // console, seat, canopy frame + top
    const cz = -0.45;
    const consoleGeo = mergeAll([
      place(box(0.72, 0.95, 0.62, 0.07, 1.2, 3), [0, FLOOR_Y + 0.47, cz]),
      place(box(0.66, 0.06, 0.5, 0.03, 1.2), [0, FLOOR_Y + 0.97, cz + 0.02], [-0.25, 0, 0]),
      place(box(0.5, 0.42, 0.62, 0.06, 1.2, 3), [0, FLOOR_Y + 0.21, cz - 1.1]),
      place(box(0.56, 0.08, 0.66, 0.04, 1.2), [0, FLOOR_Y + 0.46, cz - 1.1]),
    ]);
    const screen = place(box(0.68, 0.36, 0.02, 0.01, 1), [0, FLOOR_Y + 1.12, cz + 0.33], [-0.42, 0, 0]);
    const wheel = mergeAll([
      place(new THREE.TorusGeometry(0.16, 0.017, 6, 24), [0.0, FLOOR_Y + 0.93, cz - 0.27], [-0.5, 0, 0]),
      rod(new THREE.Vector3(0, FLOOR_Y + 0.87, cz - 0.24), new THREE.Vector3(0, FLOOR_Y + 0.93, cz - 0.27), 0.02, 0.02, 6),
    ]);
    const ch = 2.05;
    const frame: THREE.BufferGeometry[] = [];
    const fz0 = cz - 1.55;
    const fz1 = cz + 0.75;
    for (const z of [fz0, fz1])
      for (const s of [1, -1]) {
        const u = (z - h.spec.zStern) / (h.spec.zBow - h.spec.zStern);
        const x = h.sheer(u).x - INSET - 0.04;
        frame.push(rod(new THREE.Vector3(s * x, sy(u) + 0.02, z), new THREE.Vector3(s * 0.78, ch, z), 0.022, 0.022, 8));
      }
    for (const z of [fz0, fz1]) frame.push(rod(new THREE.Vector3(-0.78, ch, z), new THREE.Vector3(0.78, ch, z), 0.02, 0.02, 8));
    for (const s of [1, -1]) frame.push(rod(new THREE.Vector3(s * 0.78, ch, fz0), new THREE.Vector3(s * 0.78, ch, fz1), 0.02, 0.02, 8));
    const top = new THREE.PlaneGeometry(1.72, fz1 - fz0 + 0.2, 10, 10);
    top.rotateX(-Math.PI / 2);
    {
      const p = top.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) / 0.86;
        const z = p.getZ(i) / ((fz1 - fz0) / 2 + 0.1);
        p.setY(i, 0.05 * (1 - x * x) - 0.03 * (1 - z * z) * (1 - x * x) + 0.02);
      }
      top.translate(0, ch, (fz0 + fz1) / 2);
      top.computeVertexNormals();
    }

    // outboard, tilted up out of the water
    const eng = engineGeometry();
    const tilt = 0.92;
    const engY = tTop.y - 0.06;
    const engZ = tTop.z - 0.02;
    const cow = place(eng.cow.clone(), [0, engY, engZ], [tilt, 0, 0]);
    const lowerUnit = place(eng.lower.clone(), [0, engY, engZ], [tilt, 0, 0]);

    // gear aboard
    const traps = trapCluster([{ p: [0.05, FLOOR_Y, -2.75], rot: [0, 0.4, 0], s: 0.66 }], quality);
    const crates = mergeAll([
      place(crate().clone(), [0.62, FLOOR_Y, 0.55], [0, 0.1, 0]),
      place(crate().clone(), [0.62, FLOOR_Y + 0.29, 0.58], [0, 0.04, 0]),
      place(crate().clone(), [-0.6, FLOOR_Y, 0.75], [0, -0.15, 0]),
    ]);
    const heap = netHeap(0.62, 0.32, livery === 'red' ? 2 : 5);
    place(heap.net, [0, sy(0.9) - 0.04, 2.95]);
    place(heap.core, [0, sy(0.9) - 0.04, 2.95]);
    const tank = place(box(0.32, 0.28, 0.5, 0.06, 1, 3), [-0.55, FLOOR_Y + 0.14, -2.95], [0, 0.2, 0]);
    const bow = h.sheer(0.985);
    const cleat = mergeAll([place(box(0.06, 0.12, 0.2, 0.02, 1), [0, bow.y + 0.05, bow.z - 0.25]), place(box(0.24, 0.04, 0.05, 0.01, 1), [0, bow.y + 0.11, bow.z - 0.25])]);
    const coils: THREE.BufferGeometry[] = [];
    {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 96; i++) {
        const a = (i / 24) * Math.PI * 2;
        const rr = 0.22 - (i / 96) * 0.1;
        pts.push(new THREE.Vector3(-0.45 + Math.cos(a) * rr, FLOOR_Y + 0.02 + Math.floor(i / 24) * 0.008, 1.55 + Math.sin(a) * rr));
      }
      coils.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 140, 0.018, 5, false));
    }
    const floats = mergeAll([
      place(new THREE.SphereGeometry(0.17, 16, 10), [0.66, FLOOR_Y + 0.17, -1.75]),
      place(new THREE.SphereGeometry(0.15, 16, 10), [0.72, FLOOR_Y + 0.15, -2.15]),
    ]);
    const L = LIVERY[livery];
    const T = (g: THREE.BufferGeometry, c: string) => tint(g, c);
    const paint = [
      T(bottom, beached ? PAL.grey : PAL.antifoul),
      T(boot, L.stripe),
      T(sides, L.sides),
      T(stripe, L.stripe),
      T(inner, PAL.gelcoat),
      T(floor, PAL.grey),
      T(fore, PAL.gelcoat),
      T(bulk, PAL.gelcoat),
      T(transom, L.sides),
      T(transomIn, PAL.gelcoat),
      T(mergeAll(caps), PAL.grey),
    ];
    const matte = [T(mergeAll(strakes), PAL.rubber)];
    const metal = [T(cleat, PAL.steel)];
    const cloth: THREE.BufferGeometry[] = [];
    const ropeL: THREE.BufferGeometry[] = [];
    const net: THREE.BufferGeometry[] = [];
    let wire: THREE.BufferGeometry | null = null;
    if (!beached) {
      paint.push(T(consoleGeo, PAL.gelcoat), T(cow, livery === 'red' ? '#2B2B2B' : PAL.gelcoat), T(lowerUnit, PAL.grey), T(crates, PAL.crateBlue), T(tank, PAL.red), T(floats, PAL.orange));
      matte.push(T(screen, PAL.dark), T(wheel, PAL.rubber), T(heap.core, livery === 'teal' ? '#8A4A26' : '#24463A'));
      metal.push(T(mergeAll(frame), PAL.steel), T(traps.frame, PAL.galv));
      cloth.push(T(top, L.top));
      ropeL.push(T(mergeAll(coils), PAL.rope));
      net.push(T(heap.net, livery === 'teal' ? PAL.netOrange : PAL.netGreen));
      wire = traps.wire;
    }
    const out = (l: THREE.BufferGeometry[]) => (l.length ? mergeAll(l, true) : null);
    return { paint: out(paint), matte: out(matte), metal: out(metal), cloth: out(cloth), rope: out(ropeL), net: out(net), wire, lampY: ch + 0.12 };
  }, [quality, livery, beached]);
}

const LIVERY: Record<BoatLivery, { sides: string; stripe: string; top: string }> = {
  teal: { sides: PAL.gelcoat, stripe: PAL.teal, top: PAL.awningTeal },
  red: { sides: PAL.gelcoat, stripe: PAL.red, top: PAL.tarpBlue },
  blue: { sides: PAL.blue, stripe: PAL.gelcoat, top: PAL.canvas },
};

function BoatBody({ m, quality, livery, lit, beached }: { m: HarbourMaterials; quality: Quality; livery: BoatLivery; lit: boolean; beached?: boolean }) {
  const d = useBoatParts(quality, livery, !!beached);
  return (
    <>
      {d.paint && <mesh geometry={d.paint} material={m.paint} castShadow receiveShadow />}
      {d.matte && <mesh geometry={d.matte} material={m.matte} castShadow receiveShadow />}
      {d.metal && <mesh geometry={d.metal} material={m.metal} castShadow receiveShadow />}
      {d.cloth && <mesh geometry={d.cloth} material={m.cloth} castShadow receiveShadow />}
      {d.rope && <mesh geometry={d.rope} material={m.rope} castShadow receiveShadow />}
      {d.net && <mesh geometry={d.net} material={m.net} castShadow receiveShadow />}
      {d.wire && <mesh geometry={d.wire} material={m.wire} receiveShadow />}
      {!beached && lit && <Lantern position={[0, d.lampY - 0.75, -0.4]} scale={0.6} lit hanging />}
    </>
  );
}

export function FishingBoat({
  m,
  quality,
  livery,
  pose,
  lit,
  seed = 0,
  boatRef,
}: {
  m: HarbourMaterials;
  quality: Quality;
  livery: BoatLivery;
  pose: Pose;
  lit: boolean;
  seed?: number;
  boatRef?: MutableRefObject<THREE.Group | null>;
}) {
  const own = useRef<THREE.Group>(null);
  const ref = boatRef ?? own;
  useFloat(ref as MutableRefObject<THREE.Object3D | null>, pose, { halfL: 3.6, halfB: 1.05, tau: 0.45, rollGain: 2.4, pitchGain: 1.3, sink: -0.02, seed, drift: 0.02 });
  return (
    <group ref={ref} position={[pose.x, 0, pose.z]} rotation={[0, pose.yaw, 0]} userData={{ noBatch: true }}>
      <StaticBatch deps={[quality, livery, lit]}>
        <BoatBody m={m} quality={quality} livery={livery} lit={lit} />
      </StaticBatch>
    </group>
  );
}

/** A boat hauled up on the beach, resting on its keel and chine. */
export function BeachedBoat({ m, quality, position, yaw, heel }: { m: HarbourMaterials; quality: Quality; position: [number, number, number]; yaw: number; heel: number }) {
  return (
    <group position={position} rotation={[0.03, yaw, heel]}>
      <BoatBody m={m} quality={quality} livery="blue" lit={false} beached />
    </group>
  );
}

/** Simple lathe float used on mooring buoys. */
export function buoyGeometry() {
  const g = smoothLathe(
    [
      [0.001, -0.25],
      [0.2, -0.22],
      [0.3, -0.05],
      [0.3, 0.12],
      [0.22, 0.28],
      [0.06, 0.34],
      [0.04, 0.48],
      [0.001, 0.5],
    ],
    24,
    32,
  );
  return g;
}
