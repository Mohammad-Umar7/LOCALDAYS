import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { applyWind } from '../../materials/wind';
import { boxProjectUVs, roundedBox, smoothLathe } from '../../props/geo';
import { Trees, type TreeSpec, type TreeStyle } from '../../props/Trees';
import type { Quality, Vec3 } from '../../core/types';
import { ALL_PALMS, MAJLIS, OFFSHOOTS, ORCHARD_TREES, rng, STONE_PATHS, YARD } from './layout';
import type { FarmMaterials } from './materials';

/* ------------------------------------------------------------------ */
/*  Ground life: fallen fronds under the palms, edging stones along    */
/*  the paths, flowering ground cover, a citrus row on the east wall   */
/*  and the working yard (compost bays, nursery bench, offshoots).     */
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

function useInstanced(ref: React.RefObject<THREE.InstancedMesh>, mats: THREE.Matrix4[], cols?: THREE.Color[]) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    mats.forEach((mt, i) => mesh.setMatrixAt(i, mt));
    cols?.forEach((c, i) => mesh.setColorAt(i, c));
    mesh.count = mats.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [ref, mats, cols]);
}

/* ------------------------------ Fallen fronds ------------------------------ */

/** A dead frond lying on the ground along +X: rachis + flattened leaflets, slight curl. */
function fallenFrondGeometry() {
  const r = rng(3);
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const L = 2.7;
  const y = (s: number) => 0.035 + Math.sin(s * Math.PI) * 0.08;
  const push = (x: number, yy: number, z: number, c: number) => {
    pos.push(x, yy, z);
    col.push(c, c * 0.96, c * 0.9);
    return pos.length / 3 - 1;
  };
  // rachis ribbon
  for (let i = 0; i <= 8; i++) {
    const s = i / 8;
    const w = THREE.MathUtils.lerp(0.05, 0.01, s);
    push(s * L, y(s) + 0.01, -w, 1.1);
    push(s * L, y(s) + 0.01, w, 1.1);
  }
  for (let i = 0; i < 8; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  for (const side of [-1, 1])
    for (let k = 0; k < 34; k++) {
      const s = 0.1 + (k / 34) * 0.88;
      const env = Math.sin(Math.PI * Math.min(1, (s - 0.05) / 0.95));
      const len = (0.2 + 0.55 * env) * (0.85 + r() * 0.3);
      const ang = (0.55 + r() * 0.25) * side;
      const bx = s * L;
      const dir = new THREE.Vector2(Math.cos(ang) * 0.7, Math.sin(ang));
      dir.normalize();
      const tipx = bx + dir.x * len;
      const tipz = dir.y * len;
      const w = 0.03 + 0.012 * env;
      const lift = side > 0 ? 0.05 : 0.015; // one side props slightly on the rachis
      const midx = bx + dir.x * len * 0.45;
      const midz = dir.y * len * 0.45;
      const c = 0.8 + r() * 0.25;
      const a = push(bx, y(s), 0, c);
      const b = push(midx - dir.y * w, y(s) * 0.6 + lift, midz + dir.x * w, c * 0.95);
      const d = push(midx + dir.y * w, y(s) * 0.6 + lift, midz - dir.x * w, c * 0.95);
      const t = push(tipx, 0.02 + lift * 0.5, tipz, c * 0.85);
      idx.push(a, b, d, b, t, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function FallenFronds({ quality, avoid }: { quality: Quality; avoid: (x: number, z: number) => boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => fallenFrondGeometry(), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.95 }), []);
  const { mats, cols } = useMemo(() => {
    const r = rng(71);
    const limit = quality === 'high' ? 1 : quality === 'medium' ? 0.65 : 0.35;
    const out: THREE.Matrix4[] = [];
    const c: THREE.Color[] = [];
    const tones = ['#B89A6A', '#A88A5E', '#9C8460', '#C2A878', '#8E7656'];
    for (const p of ALL_PALMS) {
      const n = r() < 0.55 ? 1 : r() < 0.5 ? 2 : 0;
      for (let k = 0; k < n; k++) {
        if (r() > limit) continue;
        const a = r() * Math.PI * 2;
        const d = 1.25 + r() * 1.6;
        const x = p.position[0] + Math.cos(a) * d;
        const z = p.position[2] + Math.sin(a) * d;
        if (avoid(x + Math.cos(a) * 1.3, z + Math.sin(a) * 1.3)) continue;
        // lie roughly radially, butt end toward the trunk
        const yaw = -a + (r() - 0.5) * 0.9;
        out.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(0.8 + r() * 0.35, 1, 0.85 + r() * 0.3)));
        c.push(new THREE.Color(tones[Math.floor(r() * tones.length)]).offsetHSL(0, -0.03, (r() - 0.5) * 0.08));
      }
    }
    return { mats: out, cols: c };
  }, [quality, avoid]);
  useInstanced(ref, mats, cols);
  return <instancedMesh ref={ref} args={[geo, mat, Math.max(1, mats.length)]} receiveShadow />;
}

/* ------------------------------ Edging stones ------------------------------ */

function pebbleGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + Math.sin(v.x * 4.1 + 1) * 0.12 + Math.sin(v.z * 5.3 + v.y * 2) * 0.1;
    v.multiplyScalar(k);
    v.y = v.y > 0 ? v.y * 0.62 : v.y * 0.35;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return boxProjectUVs(g, 1.4);
}

export function EdgingStones({ m, quality, blocked }: { m: FarmMaterials; quality: Quality; blocked: (x: number, z: number) => boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => pebbleGeometry(), []);
  const { mats, cols } = useMemo(() => {
    const r = rng(19);
    const out: THREE.Matrix4[] = [];
    const c: THREE.Color[] = [];
    const step = quality === 'low' ? 0.62 : 0.44;
    const junctions = STONE_PATHS.slice(1).map((p) => new THREE.Vector2(p[0][0], p[0][1]));
    for (const path of STONE_PATHS) {
      const curve = new THREE.CatmullRomCurve3(path.map(([x, z]) => new THREE.Vector3(x, 0, z)));
      const len = curve.getLength();
      const n = Math.floor(len / step);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const pt = curve.getPointAt(t);
        const tg = curve.getTangentAt(t);
        for (const side of [-1, 1]) {
          const off = 0.84 + (r() - 0.5) * 0.08;
          const x = pt.x - tg.z * off * side;
          const z = pt.z + tg.x * off * side;
          if (z > 23.4 || blocked(x, z)) continue;
          if (junctions.some((j) => j.distanceTo(new THREE.Vector2(x, z)) < 1.25)) continue;
          if (STONE_PATHS.some((other) => other !== path && other.some(([ox, oz]) => Math.hypot(ox - x, oz - z) < 0.75))) continue;
          const s = 0.085 + r() * 0.06;
          out.push(
            new THREE.Matrix4().compose(
              new THREE.Vector3(x, 0.01, z),
              new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.3, r() * 6.28, (r() - 0.5) * 0.3)),
              new THREE.Vector3(s * (1 + r() * 0.5), s * (0.8 + r() * 0.4), s * (1 + r() * 0.3)),
            ),
          );
          c.push(new THREE.Color().setHSL(0.09 + r() * 0.03, 0.18 + r() * 0.1, 0.72 + r() * 0.16));
        }
      }
    }
    return { mats: out, cols: c };
  }, [quality, blocked]);
  useInstanced(ref, mats, cols);
  return (
    <instancedMesh ref={ref} args={[geo, undefined, Math.max(1, mats.length)]} receiveShadow castShadow={quality === 'high'}>
      <meshStandardMaterial map={m.stone.map} normalMap={m.stone.normalMap} roughness={0.92} />
    </instancedMesh>
  );
}

/* ---------------------------- Flowering ground cover ---------------------------- */

/** Low leafy clump with a few flower heads; only the petals take the instance colour. */
function flowerClumpGeometry() {
  const r = rng(29);
  const pos: number[] = [];
  const col: number[] = [];
  const pet: number[] = [];
  const idx: number[] = [];
  const leaf = new THREE.Color('#4C7034');
  const leaf2 = new THREE.Color('#6E9446');
  const add = (v: THREE.Vector3, c: THREE.Color, p: number) => {
    pos.push(v.x, v.y, v.z);
    col.push(c.r, c.g, c.b);
    pet.push(p);
    return pos.length / 3 - 1;
  };
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + r() * 0.4;
    const len = 0.13 + r() * 0.08;
    const dir = new THREE.Vector3(Math.cos(a), 0.55 + r() * 0.4, Math.sin(a)).normalize();
    const side = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(0.035);
    const base = new THREE.Vector3(0, 0.01, 0);
    const mid = base.clone().addScaledVector(dir, len * 0.5);
    const tip = base.clone().addScaledVector(dir, len);
    tip.y -= 0.03;
    const c = leaf.clone().lerp(leaf2, r());
    const i0 = add(base, c.clone().multiplyScalar(0.7), 0);
    const i1 = add(mid.clone().add(side), c, 0);
    const i2 = add(tip, c, 0);
    const i3 = add(mid.clone().sub(side), c, 0);
    idx.push(i0, i1, i2, i0, i2, i3);
  }
  const white = new THREE.Color('#ffffff');
  for (let f = 0; f < 5; f++) {
    const a = r() * Math.PI * 2;
    const d = r() * 0.07;
    const cx = Math.cos(a) * d;
    const cz = Math.sin(a) * d;
    const cy = 0.11 + r() * 0.06;
    const centre = add(new THREE.Vector3(cx, cy + 0.005, cz), new THREE.Color('#E8C440'), 0);
    const ring: number[] = [];
    for (let p = 0; p < 6; p++) {
      const pa = (p / 6) * Math.PI * 2;
      ring.push(add(new THREE.Vector3(cx + Math.cos(pa) * 0.03, cy, cz + Math.sin(pa) * 0.03), white, 1));
    }
    for (let p = 0; p < 6; p++) idx.push(centre, ring[p], ring[(p + 1) % 6]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aPetal', new THREE.Float32BufferAttribute(pet, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const FLOWER_TONES = ['#E0457A', '#C2387A', '#F2C230', '#E8892A', '#F4EFE4', '#8A5BB8', '#E8607A'];

export function FlowerBeds({ quality, spots }: { quality: Quality; spots: { x: number; z: number; r: number; n: number; tones?: string[] }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => flowerClumpGeometry(), []);
  const mat = useMemo(() => {
    const mm = applyWind(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 }), { sway: 0.5, stiffness: 3, speed: 1.6 });
    const windCompile = mm.onBeforeCompile;
    mm.onBeforeCompile = (s, renderer) => {
      windCompile.call(mm, s, renderer);
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aPetal;')
        .replace(
          '#include <color_vertex>',
          `vColor = vec3(1.0);
           #ifdef USE_COLOR
             vColor *= color;
           #endif
           #ifdef USE_INSTANCING_COLOR
             vColor *= mix(vec3(1.0), instanceColor.rgb, aPetal);
           #endif`,
        );
    };
    mm.customProgramCacheKey = () => 'farm-flowers';
    return mm;
  }, []);
  const { mats, cols } = useMemo(() => {
    const r = rng(53);
    const keep = quality === 'high' ? 1 : quality === 'medium' ? 0.7 : 0.4;
    const out: THREE.Matrix4[] = [];
    const c: THREE.Color[] = [];
    for (const s of spots) {
      const tones = s.tones ?? FLOWER_TONES;
      const base = tones[Math.floor(r() * tones.length)];
      for (let i = 0; i < s.n; i++) {
        if (r() > keep) continue;
        const a = r() * Math.PI * 2;
        const d = Math.sqrt(r()) * s.r;
        const sc = 0.8 + r() * 0.7;
        out.push(new THREE.Matrix4().compose(new THREE.Vector3(s.x + Math.cos(a) * d, 0, s.z + Math.sin(a) * d * 0.8), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6.28, 0)), new THREE.Vector3(sc, sc, sc)));
        c.push(new THREE.Color(r() < 0.8 ? base : tones[Math.floor(r() * tones.length)]).offsetHSL(0, 0, (r() - 0.5) * 0.08));
      }
    }
    return { mats: out, cols: c };
  }, [quality, spots]);
  useInstanced(ref, mats, cols);
  return <instancedMesh ref={ref} args={[geo, mat, Math.max(1, mats.length)]} receiveShadow />;
}

/* --------------------------------- Orchard --------------------------------- */

/** Lime/orange trees: compact rounded crowns; "flowers" are the ripening fruit. */
const CITRUS: TreeStyle = {
  trunkHeight: 0.7,
  trunkRadius: 0.08,
  levels: 3,
  branchCount: [3, 4],
  spread: 1.05,
  lengthDecay: 0.72,
  radiusDecay: 0.6,
  gnarl: 0.32,
  droop: 0.1,
  leafColor: '#365E24',
  leafColor2: '#557F33',
  leafSize: 0.09,
  leavesPerTip: 150,
  clusterRadius: 0.5,
  // same bark as the desert shrubs → shares their cached texture and draw call
  barkColor: '#6A5A46',
  flowers: { color: '#F0A21C', share: 0.08 },
};

export function Orchard({ quality }: { quality: Quality }) {
  const trees: TreeSpec[] = useMemo(() => ORCHARD_TREES.map(([x, z], i) => ({ position: [x, 0, z] as Vec3, seed: 61 + i * 7, scale: 1.55 + (i % 2) * 0.2, rotation: i * 1.3 })), []);
  return <Trees trees={trees} style={CITRUS} quality={quality} />;
}

/* ----------------------------------- Yard ----------------------------------- */

export function Yard({ m }: { m: FarmMaterials }) {
  const geos = useMemo(() => {
    const r = rng(91);
    const boards: THREE.BufferGeometry[] = [];
    const compost: THREE.BufferGeometry[] = [];
    const trays: THREE.BufferGeometry[] = [];
    const seedlings: THREE.BufferGeometry[] = [];
    const bench: THREE.BufferGeometry[] = [];
    const pots: THREE.BufferGeometry[] = [];
    const tools: THREE.BufferGeometry[] = [];
    const bx = (w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) =>
      boxProjectUVs(roundedBox(w, h, d, 0.01, 1).clone(), 0.8)
        .rotateY(ry)
        .translate(x, y, z);
    // three compost bays (pallet-board walls, open to the south)
    const z0 = YARD.z0 + 0.4;
    const bayW = 1.45;
    for (let b = 0; b <= 3; b++) {
      const x = YARD.x0 + 0.35 + b * bayW;
      for (let k = 0; k < 5; k++) boards.push(bx(0.04, 0.13, 1.4, x, 0.1 + k * 0.17, z0 + 0.7));
      boards.push(bx(0.08, 0.95, 0.08, x, 0.47, z0 + 0.05));
      boards.push(bx(0.08, 0.95, 0.08, x, 0.47, z0 + 1.35));
    }
    for (let k = 0; k < 5; k++) boards.push(bx(bayW * 3 + 0.04, 0.13, 0.04, YARD.x0 + 0.35 + bayW * 1.5, 0.1 + k * 0.17, z0));
    [0.62, 0.42, 0.22].forEach((h, b) => {
      const heap = new THREE.SphereGeometry(0.62, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const p = heap.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * (h / 0.62) * (1 + Math.sin(p.getX(i) * 9 + p.getZ(i) * 7) * 0.08));
      heap.computeVertexNormals();
      compost.push(boxProjectUVs(heap, 1.2).translate(YARD.x0 + 0.35 + (b + 0.5) * bayW, 0, z0 + 0.72));
    });
    // fork leaning on the first bay
    tools.push(new THREE.CylinderGeometry(0.016, 0.016, 1.3, 6).rotateZ(0.35).translate(YARD.x0 + 0.1, 0.62, z0 + 1.55));
    // nursery bench with seedling trays
    const nb = { x: (YARD.x0 + YARD.x1) / 2 + 0.1, z: YARD.z0 + 4.6 };
    for (const dz of [-0.3, 0, 0.3]) bench.push(bx(2.6, 0.04, 0.27, nb.x, 0.78, nb.z + dz));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bench.push(bx(0.06, 0.78, 0.06, nb.x + sx * 1.18, 0.39, nb.z + sz * 0.3));
    bench.push(bx(2.4, 0.04, 0.6, nb.x, 0.25, nb.z));
    for (let t = 0; t < 4; t++) {
      const tx = nb.x - 0.95 + t * 0.63;
      trays.push(new THREE.BoxGeometry(0.55, 0.06, 0.38).translate(tx, 0.83, nb.z + (t % 2 ? 0.08 : -0.08)));
      for (let i = 0; i < 24; i++) {
        const g = new THREE.IcosahedronGeometry(0.03 + r() * 0.012, 0);
        g.scale(1, 0.8, 1);
        g.translate(tx - 0.23 + (i % 6) * 0.092, 0.885, nb.z + (t % 2 ? 0.08 : -0.08) - 0.14 + Math.floor(i / 6) * 0.093);
        seedlings.push(g);
      }
    }
    // terracotta pots for the palm offshoots + a stack of spare pots
    const pot = smoothLathe([[0.001, 0], [0.15, 0], [0.2, 0.3], [0.23, 0.42], [0.25, 0.44]], 18, 6);
    for (const o of OFFSHOOTS) pots.push(pot.clone().translate(o.position[0], 0, o.position[2]));
    // young palm offshoots: a fan of arching fronds with flat leaflets
    const offshoots: THREE.BufferGeometry[] = [];
    for (const [oi, o] of OFFSHOOTS.entries()) {
      const fr = rng(400 + oi);
      const n = 7 + (oi % 3);
      for (let f = 0; f < n; f++) {
        const yaw = f * 2.4 + fr();
        const pitch = 0.35 + (f / n) * 0.9 + fr() * 0.15;
        const len = 0.55 + fr() * 0.35;
        const pos: number[] = [];
        const idx: number[] = [];
        const curve = (t: number) => new THREE.Vector3(Math.sin(pitch) * t * len, Math.cos(pitch) * t * len - t * t * len * 0.35, 0);
        for (let k = 0; k < 14; k++) {
          const t = 0.15 + (k / 14) * 0.85;
          const p0 = curve(t);
          for (const side of [-1, 1]) {
            const l = 0.16 * Math.sin(Math.PI * Math.min(1, t * 1.05)) + 0.04;
            const tip = p0.clone().add(new THREE.Vector3(0.05 * l, -0.04, side * l));
            const a = p0.clone().add(new THREE.Vector3(-0.012, 0.004, 0));
            const b = p0.clone().add(new THREE.Vector3(0.012, -0.004, 0));
            const base = pos.length / 3;
            pos.push(a.x, a.y, a.z, b.x, b.y, b.z, tip.x, tip.y, tip.z);
            idx.push(base, base + 1, base + 2);
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        g.rotateY(yaw);
        g.translate(o.position[0], 0.4, o.position[2]);
        offshoots.push(g);
      }
    }
    for (let k = 0; k < 4; k++) pots.push(pot.clone().scale(0.6, 0.6, 0.6).translate(nb.x + 1.6, k * 0.09, nb.z + 1.1));
    return {
      boards: merge(boards),
      compost: merge(compost),
      trays: merge(trays),
      seedlings: merge(seedlings),
      bench: merge(bench),
      pots: merge(pots),
      tools: merge(tools),
      offshoots: merge(offshoots),
    };
  }, []);
  return (
    <group>
      <mesh geometry={geos.boards} material={m.woodGrey} castShadow receiveShadow />
      <mesh geometry={geos.bench} material={m.woodLight} castShadow receiveShadow />
      <mesh geometry={geos.compost} material={m.soil} castShadow receiveShadow />
      <mesh geometry={geos.trays} material={m.pipe} castShadow receiveShadow />
      <mesh geometry={geos.pots} material={m.terracotta} castShadow receiveShadow />
      <mesh geometry={geos.tools} material={m.woodGrey} castShadow receiveShadow />
      <mesh geometry={geos.seedlings} material={m.leaf} castShadow receiveShadow />
      <mesh geometry={geos.offshoots} material={m.leaf} castShadow receiveShadow />
    </group>
  );
}

/** Desert shrubs planted inside the walls (added to the terrain's shrub instances). */
export function insideShrubs(blocked: (x: number, z: number) => boolean): TreeSpec[] {
  const r = rng(37);
  const out: TreeSpec[] = [];
  const along = (ax: number, az: number, bx: number, bz: number, every: number) => {
    const len = Math.hypot(bx - ax, bz - az);
    for (let d = every * 0.5; d < len; d += every * (0.7 + r() * 0.6)) {
      const t = d / len;
      const x = ax + (bx - ax) * t + (r() - 0.5) * 0.8;
      const z = az + (bz - az) * t + (r() - 0.5) * 0.8;
      if (blocked(x, z)) continue;
      out.push({ position: [x, 0, z], seed: 500 + out.length, scale: 0.9 + r() * 0.9, rotation: r() * 6 });
    }
  };
  // inner foot of the perimeter wall
  along(-30.8, -36.8, -30.8, 22.6, 5.5);
  along(-30.5, 22.8, 2.6, 22.8, 4.5);
  along(9.5, 22.9, 20.5, 22.9, 3.6);
  along(36.8, -36.5, 36.8, -12, 5);
  along(-30.5, -36.8, 0.6, -36.8, 5);
  along(5.5, -36.8, 36.5, -36.8, 6);
  // a few around the majlis and the falaj head
  out.push({ position: [MAJLIS.x - MAJLIS.w / 2 - 0.9, 0, MAJLIS.z - 1.2], seed: 590, scale: 1.3, rotation: 1 });
  out.push({ position: [4.2, 0, -16], seed: 591, scale: 1.4, rotation: 2 });
  out.push({ position: [0.2, 0, -19.5], seed: 592, scale: 1.1, rotation: 3 });
  return out;
}
