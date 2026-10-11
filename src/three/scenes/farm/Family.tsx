import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getTexSet, repeatSet } from '../../materials/textures';
import { boxProjectUVs, roundedBox } from '../../props/geo';
import type { Quality, Vec3 } from '../../core/types';
import { Chickens, Goats, type AnimalSpawn, type Herd, type Obstacle } from './Animals';
import { rng, SWING_GHAF, type Rect } from './layout';
import { trunkPostGeometry, type FarmMaterials } from './materials';

/* ------------------------------------------------------------------ */
/*  Family quarter: goat & chicken pen with a palm-rib (jareed) fence,  */
/*  areesh shade, coop, climbing platform, hay rack and water trough,  */
/*  a hay store, and a plank swing hung from the old ghaf.             */
/* ------------------------------------------------------------------ */

/** Box geometry with world-scale UVs, baked into place (for merging). */
function plank(w: number, h: number, d: number, x: number, y: number, z: number, rot: [number, number, number] = [0, 0, 0], r = 0.012) {
  const g = boxProjectUVs(roundedBox(w, h, d, r, 1).clone(), 0.8);
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(1, 1, 1)));
  return g;
}

function merge(list: THREE.BufferGeometry[]) {
  const g = mergeGeometries(
    list.map((x) => (x.index ? x.toNonIndexed() : x)),
    false,
  );
  list.forEach((x) => x.dispose());
  return g!;
}

/** Dense palm-rib panel between two ground points (fence infill, shade walls). */
function ribPanel(ax: number, az: number, bx: number, bz: number, h: number, seed: number, spacing = 0.075) {
  const r = rng(seed);
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.max(2, Math.floor(len / spacing));
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const hh = h * (0.93 + r() * 0.12);
    const g = new THREE.BoxGeometry(0.022, hh, 0.016);
    g.translate(0, hh / 2, 0);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler((r() - 0.5) * 0.05, -Math.atan2(bz - az, bx - ax), (r() - 0.5) * 0.06)));
    g.translate(ax + (bx - ax) * t, 0, az + (bz - az) * t);
    parts.push(g);
  }
  return merge(parts);
}

/** Small square bale with two twine bands. */
function bale(x: number, y: number, z: number, rotY: number, straw: THREE.BufferGeometry[], twine: THREE.BufferGeometry[]) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y + 0.2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)), new THREE.Vector3(1, 1, 1));
  const g = boxProjectUVs(roundedBox(0.92, 0.4, 0.46, 0.06, 2).clone(), 1.1);
  g.applyMatrix4(m);
  straw.push(g);
  for (const dx of [-0.22, 0.22]) {
    const t = new THREE.BoxGeometry(0.018, 0.408, 0.468);
    t.translate(dx, 0, 0);
    t.applyMatrix4(m);
    twine.push(t);
  }
}

export interface PenLayout {
  rect: Rect;
  obstacles: Obstacle[];
  platform: { x: number; z: number; top: number };
  goats: AnimalSpawn[];
  chickens: AnimalSpawn[];
}

/** Everything inside the pen is laid out relative to its north-west corner. */
export function penLayout(rect: Rect, quality: Quality): PenLayout {
  const L = (x: number, z: number) => [rect.x0 + x, rect.z0 + z] as const;
  const box = (x0: number, z0: number, x1: number, z1: number): Obstacle => ({ x0: rect.x0 + x0, x1: rect.x0 + x1, z0: rect.z0 + z0, z1: rect.z0 + z1 });
  const obstacles: Obstacle[] = [
    box(6.9, 0.2, 9.8, 2.95), // coop + ramp
    box(4.45, 2.05, 5.95, 3.15), // climbing platform
    box(1.15, 7.1, 4.25, 8.2), // hay rack
    box(4.85, 7.05, 6.35, 8.2), // water trough
    box(1.45, 5.0, 4.0, 5.85), // palm log
    box(0, 0, 4.1, 0.55), // shade back wall
  ];
  const [px, pz] = L(5.2, 2.6);
  const g = (x: number, z: number, heading: number, coatA: string, coatB: string, pattern: 0 | 1 | 2, scale = 1, fixed = false, y = 0): AnimalSpawn => {
    const [wx, wz] = L(x, z);
    return { x: wx, z: wz, y, heading, coatA, coatB, pattern, scale, fixed };
  };
  const goats: AnimalSpawn[] = [
    g(5.2, 2.6, 2.4, '#F1ECE2', '#7A4A2A', 1, 1.02, true, 0.44), // Boer-type on the platform
    g(2.2, 3.9, 0.9, '#3A2E26', '#E9E2D6', 2, 0.98),
    g(7.4, 5.6, -2.2, '#B88A5A', '#F2ECE0', 2, 0.94),
    g(3.4, 6.5, 2.9, '#ECE6DA', '#ECE6DA', 0, 0.78), // kid
    g(8.6, 4.1, -0.6, '#5A3A26', '#D9C9AE', 1, 1.0),
  ];
  const c = (x: number, z: number, heading: number, coatA: string, coatB: string, pattern: 0 | 1 | 2, scale = 1): AnimalSpawn => {
    const [wx, wz] = L(x, z);
    return { x: wx, z: wz, heading, coatA, coatB, pattern, scale };
  };
  const chickens: AnimalSpawn[] = [
    c(6.2, 4.1, 0.3, '#8E4A22', '#3B2418', 1, 1.08), // rooster: rust hackles, dark tail
    c(1.4, 2.2, 1.9, '#9A5A2E', '#5B321A', 2),
    c(2.6, 1.6, -1.2, '#EEE8DC', '#D8D0C0', 0),
    c(7.1, 6.4, 2.7, '#2A2622', '#3A3430', 0),
    c(8.9, 6.9, -2.0, '#B9763E', '#6B3E1E', 2, 0.95),
    c(4.4, 4.4, 0.8, '#EEE8DC', '#2A2622', 2),
    c(0.9, 6.3, 2.2, '#9A5A2E', '#5B321A', 2, 0.92),
    c(5.6, 6.0, -0.4, '#D9C49A', '#8A6A3E', 2),
  ];
  const nG = quality === 'high' ? 5 : quality === 'medium' ? 3 : 2;
  const nC = quality === 'high' ? 8 : quality === 'medium' ? 5 : 3;
  return { rect, obstacles, platform: { x: px, z: pz, top: 0.44 }, goats: goats.slice(0, nG), chickens: chickens.slice(0, nC) };
}

export function Pen({ m, layout }: { m: FarmMaterials; layout: PenLayout }) {
  const { rect } = layout;
  const W = rect.x1 - rect.x0;
  const D = rect.z1 - rect.z0;
  const geos = useMemo(() => {
    const wood: THREE.BufferGeometry[] = [];
    const light: THREE.BufferGeometry[] = [];
    const dark: THREE.BufferGeometry[] = [];
    const ribs: THREE.BufferGeometry[] = [];
    const straw: THREE.BufferGeometry[] = [];
    const twine: THREE.BufferGeometry[] = [];
    const metal: THREE.BufferGeometry[] = [];
    const stone: THREE.BufferGeometry[] = [];
    const r = rng(12);

    // ---- fence: posts, two rails, rib infill; gate gap on the south side
    const gate0 = 7.3;
    const gate1 = 8.75;
    const runs: [number, number, number, number][] = [
      [0, 0, W, 0],
      [W, 0, W, D],
      [0, 0, 0, D],
      [0, D, gate0, D],
      [gate1, D, W, D],
    ];
    for (const [ax, az, bx, bz] of runs) {
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(len / 1.65));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const post = new THREE.CylinderGeometry(0.055, 0.065, 1.22, 8);
        post.translate(ax + (bx - ax) * t, 0.61, az + (bz - az) * t);
        wood.push(post);
      }
      const ang = -Math.atan2(bz - az, bx - ax);
      for (const y of [0.32, 0.98])
        wood.push(plank(len, 0.055, 0.045, (ax + bx) / 2, y, (az + bz) / 2, [0, ang, 0]));
      ribs.push(ribPanel(ax, az, bx, bz, 1.08, 31 + ribs.length));
    }
    // open gate leaf, hinged at gate1
    {
      const leaf: THREE.BufferGeometry[] = [];
      leaf.push(plank(1.4, 0.05, 0.04, -0.7, 0.3, 0));
      leaf.push(plank(1.4, 0.05, 0.04, -0.7, 0.95, 0));
      leaf.push(plank(0.05, 1.05, 0.04, -0.03, 0.6, 0));
      leaf.push(plank(0.05, 1.05, 0.04, -1.37, 0.6, 0));
      leaf.push(plank(1.6, 0.04, 0.035, -0.7, 0.62, 0, [0, 0, 0.62]));
      const g = merge(leaf);
      g.rotateY(1.25);
      g.translate(gate1, 0, D);
      wood.push(g);
    }

    // ---- areesh shade (north-west corner) with a barasti back wall
    const sh = { x0: 0.3, x1: 3.9, z0: 0.3, z1: 3.3, hb: 1.78, hf: 1.98 };
    for (const [x, z, h] of [
      [sh.x0, sh.z0, sh.hb],
      [sh.x1, sh.z0, sh.hb],
      [sh.x0, sh.z1, sh.hf],
      [sh.x1, sh.z1, sh.hf],
    ] as [number, number, number][]) {
      const p = new THREE.CylinderGeometry(0.06, 0.075, h, 8);
      p.translate(x, h / 2, z);
      wood.push(p);
    }
    const pitch = Math.atan2(sh.hf - sh.hb, sh.z1 - sh.z0);
    for (const [z, h] of [
      [sh.z0, sh.hb],
      [sh.z1, sh.hf],
    ] as [number, number][])
      wood.push(plank(sh.x1 - sh.x0 + 0.4, 0.09, 0.09, (sh.x0 + sh.x1) / 2, h + 0.04, z));
    for (let x = sh.x0 - 0.15; x <= sh.x1 + 0.15; x += 0.085) {
      const len = Math.hypot(sh.z1 - sh.z0, sh.hf - sh.hb) + 0.5;
      const slat = new THREE.BoxGeometry(0.055, 0.022, len);
      slat.rotateX(-pitch);
      slat.rotateY((r() - 0.5) * 0.04);
      slat.translate(x, (sh.hb + sh.hf) / 2 + 0.1 + r() * 0.015, (sh.z0 + sh.z1) / 2);
      ribs.push(slat);
    }
    ribs.push(ribPanel(sh.x0, 0.14, sh.x1, 0.14, 1.62, 77, 0.05));

    // ---- coop on legs, pitched roof, ramp
    {
      const cx = 8.3;
      const cz = 1.2;
      for (const [dx, dz] of [
        [-0.8, -0.38],
        [0.8, -0.38],
        [-0.8, 0.38],
        [0.8, 0.38],
      ])
        wood.push(plank(0.07, 0.5, 0.07, cx + dx, 0.25, cz + dz));
      light.push(plank(1.75, 0.82, 0.86, cx, 0.9, cz, [0, 0, 0], 0.02));
      for (const s of [-1, 1]) dark.push(plank(1.95, 0.035, 0.62, cx, 1.47, cz + s * 0.25, [s * 0.55, 0, 0], 0.01));
      dark.push(plank(1.95, 0.05, 0.06, cx, 1.62, cz));
      // ramp with cleats
      const rampLen = 1.25;
      const ang = Math.atan2(0.5, 1.1);
      light.push(plank(0.32, 0.03, rampLen, cx - 0.35, 0.27, cz + 0.43 + 0.53, [ang, 0, 0]));
      for (let k = 0; k < 5; k++) dark.push(plank(0.32, 0.02, 0.025, cx - 0.35, 0.47 - k * 0.1 + 0.025, cz + 0.55 + k * 0.215, [ang, 0, 0]));
      // nest box on the east side
      light.push(plank(0.35, 0.42, 0.7, cx + 1.02, 0.86, cz, [0, 0, 0], 0.015));
      dark.push(plank(0.42, 0.03, 0.78, cx + 1.05, 1.1, cz, [0, 0, -0.35], 0.01));
    }

    // ---- climbing platform: pallet on stone blocks + a palm log
    {
      const { x, z } = { x: 5.2, z: 2.6 };
      for (const [dx, dz] of [
        [-0.5, -0.38],
        [0.5, -0.38],
        [-0.5, 0.38],
        [0.5, 0.38],
      ])
        stone.push(plank(0.3, 0.3, 0.3, x + dx, 0.15, z + dz, [0, r() * 0.3, 0], 0.05));
      for (let k = 0; k < 7; k++) wood.push(plank(0.15, 0.04, 1.0, x - 0.54 + k * 0.18, 0.4, z, [0, 0, 0], 0.008));
      for (const dz of [-0.4, 0, 0.4]) wood.push(plank(1.24, 0.08, 0.1, x, 0.34, z + dz));
    }

    // ---- hay rack (manger) along the south fence
    {
      const x0 = 1.4;
      const x1 = 4.0;
      const z = D - 0.62;
      const cx = (x0 + x1) / 2;
      for (const s of [-1, 1]) wood.push(plank(x1 - x0, 0.42, 0.04, cx, 0.62, z + s * 0.2, [s * -0.38, 0, 0]));
      wood.push(plank(x1 - x0, 0.04, 0.22, cx, 0.42, z));
      for (const x of [x0, x1]) wood.push(plank(0.05, 0.85, 0.5, x, 0.42, z));
      const hay = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      hay.scale((x1 - x0) / 2 - 0.05, 0.28, 0.24);
      hay.translate(cx, 0.62, z);
      boxProjectUVs(hay, 1.1);
      straw.push(hay);
    }

    // ---- water trough (galvanised) — water surface added separately
    {
      const x = 5.6;
      const z = D - 0.6;
      metal.push(plank(1.3, 0.05, 0.55, x, 0.05, z));
      for (const s of [-1, 1]) {
        metal.push(plank(1.3, 0.36, 0.03, x, 0.2, z + s * 0.26, [0, 0, 0], 0.01));
        metal.push(plank(0.03, 0.36, 0.55, x + s * 0.635, 0.2, z, [0, 0, 0], 0.01));
      }
    }

    // ---- loose bale inside, a scatter of pulled straw, hay store outside
    bale(0.95, 0, 4.9, 0.3, straw, twine);
    {
      const pile = new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      pile.scale(0.75, 0.12, 0.5);
      pile.translate(3.0, 0, 6.5);
      boxProjectUVs(pile, 1.1);
      straw.push(pile);
    }
    const hx = W + 0.95;
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 2; col++) bale(hx + col * 0.48, 0, 2.2 + row * 0.94, Math.PI / 2 + (r() - 0.5) * 0.08, straw, twine);
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 2; col++) bale(hx + 0.02 + col * 0.48, 0.4, 2.65 + row * 0.94, Math.PI / 2 + (r() - 0.5) * 0.1, straw, twine);
    bale(hx + 0.24, 0.8, 3.1, Math.PI / 2 + 0.05, straw, twine);
    bale(hx + 1.25, 0, 3.7, 0.4, straw, twine);

    const offset = (list: THREE.BufferGeometry[]) => {
      if (!list.length) return null;
      const g = merge(list);
      g.translate(rect.x0, 0, rect.z0);
      return g;
    };
    return {
      wood: offset(wood),
      light: offset(light),
      dark: offset(dark),
      ribs: offset(ribs),
      straw: offset(straw),
      twine: offset(twine),
      metal: offset(metal),
      stone: offset(stone),
    };
  }, [rect, W, D]);

  const log = useMemo(() => {
    const g = trunkPostGeometry(0.2, 0.17, 2.5, 12);
    g.rotateZ(Math.PI / 2);
    g.rotateY(0.25);
    g.translate(rect.x0 + 2.7 + 1.2, 0.17, rect.z0 + 5.4);
    return g;
  }, [rect]);

  return (
    <group>
      {geos.wood && <mesh geometry={geos.wood} material={m.woodGrey} castShadow receiveShadow />}
      {geos.light && <mesh geometry={geos.light} material={m.woodLight} castShadow receiveShadow />}
      {geos.dark && <mesh geometry={geos.dark} material={m.woodDark} castShadow receiveShadow />}
      {geos.ribs && <mesh geometry={geos.ribs} material={m.frond} castShadow receiveShadow />}
      {geos.straw && <mesh geometry={geos.straw} material={m.straw} castShadow receiveShadow />}
      {geos.twine && <mesh geometry={geos.twine} material={m.rope} castShadow receiveShadow />}
      {geos.metal && <mesh geometry={geos.metal} material={m.galvanised} castShadow receiveShadow />}
      {geos.stone && <mesh geometry={geos.stone} material={m.stone} castShadow receiveShadow />}
      <mesh geometry={log} material={m.palmTrunk} castShadow receiveShadow />
      {/* trough water + coop doorway */}
      <mesh position={[rect.x0 + 5.6, 0.3, rect.z1 - 0.6]} rotation={[-Math.PI / 2, 0, 0]} material={m.stillWater}>
        <planeGeometry args={[1.22, 0.48]} />
      </mesh>
      <mesh position={[rect.x0 + 7.95, 0.82, rect.z0 + 1.64]}>
        <planeGeometry args={[0.32, 0.36]} />
        <meshStandardMaterial color="#1a120c" roughness={1} />
      </mesh>
    </group>
  );
}

/* ------------------------------------ Swing ------------------------------------ */

/**
 * A thick limb grown out of the ghaf trunk, with a plank swing on two ropes
 * that sways gently — the limb is static and batched, the swing animates.
 */
export function GhafSwing({ m }: { m: FarmMaterials }) {
  const barkSet = useMemo(() => repeatSet(getTexSet('furrowBark', { base: '#8A7864', dark: '#3A2F26', seed: 21 }), 1, 1), []);
  const barkMat = useMemo(() => new THREE.MeshStandardMaterial({ ...barkSet, roughness: 1 }), [barkSet]);
  const { x, z } = SWING_GHAF;
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(x + 0.05, 2.05, z + 0.02),
        new THREE.Vector3(x + 0.9, 2.55, z + 0.25),
        new THREE.Vector3(x + 1.9, 2.84, z + 0.52),
        new THREE.Vector3(x + 2.9, 2.9, z + 0.78),
        new THREE.Vector3(x + 3.8, 3.12, z + 0.98),
        new THREE.Vector3(x + 4.4, 3.5, z + 1.1),
      ]),
    [x, z],
  );
  const limb = useMemo(() => {
    const segs = 40;
    const radial = 10;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const frames = curve.computeFrenetFrames(segs, false);
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const p = curve.getPointAt(t);
      const rad = THREE.MathUtils.lerp(0.2, 0.055, Math.pow(t, 0.8)) * (1 + 0.06 * Math.sin(t * 31));
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * Math.PI * 2;
        const N = frames.normals[i];
        const B = frames.binormals[i];
        pos.push(p.x + rad * (Math.cos(a) * N.x + Math.sin(a) * B.x), p.y + rad * (Math.cos(a) * N.y + Math.sin(a) * B.y), p.z + rad * (Math.cos(a) * N.z + Math.sin(a) * B.z));
        uv.push(j / radial, t * curve.getLength() * 1.2);
      }
    }
    for (let i = 0; i < segs; i++)
      for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j;
        const b = a + radial + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [curve]);

  // Swing hangs at ~55 % along the limb, swinging about the limb's direction
  const hang = useMemo(() => {
    const t = 0.55;
    const p = curve.getPointAt(t);
    const tg = curve.getTangentAt(t);
    tg.y = 0;
    tg.normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), tg);
    return { p: p.clone().add(new THREE.Vector3(0, -0.1, 0)), q, len: p.y - 0.1 - 0.55 };
  }, [curve]);

  const wraps = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    for (const s of [-0.26, 0.26]) {
      for (let k = 0; k < 3; k++) {
        const g = new THREE.TorusGeometry(0.13, 0.016, 6, 16);
        g.rotateY(Math.PI / 2);
        g.translate(s + (k - 1) * 0.035, 0.1, 0);
        parts.push(g);
      }
    }
    const g = merge(parts);
    g.applyQuaternion(hang.q);
    g.translate(hang.p.x, hang.p.y, hang.p.z);
    return g;
  }, [hang]);

  const swing = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = swing.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.rotation.x = Math.sin((t * Math.PI * 2) / 3.1) * (0.11 + 0.05 * Math.sin(t * 0.13));
    g.rotation.y = Math.sin(t * 0.7) * 0.025;
  });

  return (
    <group>
      <mesh geometry={limb} material={barkMat} castShadow receiveShadow />
      <mesh geometry={wraps} material={m.rope} castShadow />
      <group position={hang.p} quaternion={hang.q}>
        <group ref={swing} userData={{ noBatch: true }}>
          {[-0.26, 0.26].map((s) => (
            <mesh key={s} position={[s, -hang.len / 2, 0]} material={m.rope} castShadow userData={{ noBatch: true }}>
              <cylinderGeometry args={[0.013, 0.013, hang.len, 6]} />
            </mesh>
          ))}
          <mesh position={[0, -hang.len - 0.02, 0]} material={m.woodLight} castShadow receiveShadow userData={{ noBatch: true }}>
            <boxGeometry args={[0.66, 0.045, 0.24]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** Weathered bench (slatted seat, splayed legs). */
export function Bench({ m, position, rotation = 0, length = 1.6 }: { m: FarmMaterials; position: Vec3; rotation?: number; length?: number }) {
  const geo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    for (const dz of [-0.11, 0, 0.11]) parts.push(plank(length, 0.035, 0.1, 0, 0.44, dz, [0, 0, 0], 0.008));
    for (const s of [-1, 1]) {
      parts.push(plank(0.06, 0.44, 0.06, s * (length / 2 - 0.15), 0.21, -0.12, [0.1, 0, 0]));
      parts.push(plank(0.06, 0.44, 0.06, s * (length / 2 - 0.15), 0.21, 0.12, [-0.1, 0, 0]));
      parts.push(plank(0.05, 0.05, 0.3, s * (length / 2 - 0.15), 0.25, 0));
    }
    parts.push(plank(length - 0.3, 0.05, 0.05, 0, 0.25, 0));
    return merge(parts);
  }, [length]);
  return <mesh geometry={geo} material={m.woodLight} position={position} rotation={[0, rotation, 0]} castShadow receiveShadow />;
}

/** Pen structures + animals for one placement. */
export function FamilyQuarter({ m, quality, pen }: { m: FarmMaterials; quality: Quality; pen: Rect }) {
  const layout = useMemo(() => penLayout(pen, quality), [pen, quality]);
  return (
    <group>
      <Pen m={m} layout={layout} />
    </group>
  );
}

export function PenAnimals({ quality, pen }: { quality: Quality; pen: Rect }) {
  const layout = useMemo(() => penLayout(pen, quality), [pen, quality]);
  const herd: Herd = useRef([]);
  return (
    <group>
      <Goats spawns={layout.goats} area={layout.rect} obstacles={layout.obstacles} quality={quality} herd={herd} />
      <Chickens spawns={layout.chickens} area={layout.rect} obstacles={layout.obstacles} avoid={herd} quality={quality} />
    </group>
  );
}
