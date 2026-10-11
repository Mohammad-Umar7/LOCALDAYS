import { useFrame } from '@react-three/fiber';
import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { applyWind, windUniforms } from '../../materials/wind';
import { smoothLathe } from '../../props/geo';
import { Trees, TREE_STYLES, type TreeSpec } from '../../props/Trees';
import type { Quality, Vec3 } from '../../core/types';
import type { ApiaryMaterials } from './materials';
import { ripples } from './tex';
import { FLOWER_KINDS, flowerMatrix, getFlowers, type FlowerKind } from './flowers';
import { groundY, isBlocked, pathMask, rng, SITE, wadiAt, WATER_DISH } from './layout';

/* ------------------------------------------------------------------ */
/*  Pollinator planting: drifts of instanced wildflowers (daisies,     */
/*  asters, salvia-like spikes, umbels) with real stems and leaves,    */
/*  Sidr and Samar trees, desert shrubs and a shallow bee waterer.     */
/* ------------------------------------------------------------------ */

const STEM = new THREE.Color('#58763A');
const LEAF = new THREE.Color('#5E7F3C');
const DISC = new THREE.Color('#C98E1C');
const WHITE = new THREE.Color('#ffffff');

interface Part {
  pos: number[];
  col: number[];
  pet: number[];
  idx: number[];
}

function newPart(): Part {
  return { pos: [], col: [], pet: [], idx: [] };
}

function pushVert(p: Part, v: THREE.Vector3, c: THREE.Color, petal: number) {
  p.pos.push(v.x, v.y, v.z);
  p.col.push(c.r, c.g, c.b);
  p.pet.push(petal);
  return p.pos.length / 3 - 1;
}

function toGeometry(p: Part) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p.pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(p.col, 3));
  g.setAttribute('aPetal', new THREE.Float32BufferAttribute(p.pet, 1));
  g.setIndex(p.idx);
  g.computeVertexNormals();
  return g;
}

/** Thin curved stem (4 sides) from the origin to `top`. */
function addStem(p: Part, h: number, bend: number, r0 = 0.0028, r1 = 0.0016, segs = 4) {
  const radial = 4;
  const base = p.pos.length / 3;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const cx = bend * t * t;
    const y = h * t;
    const r = THREE.MathUtils.lerp(r0, r1, t);
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      pushVert(p, new THREE.Vector3(cx + Math.cos(a) * r, y, Math.sin(a) * r), STEM, 0);
    }
  }
  for (let i = 0; i < segs; i++)
    for (let j = 0; j < radial; j++) {
      const a = base + i * radial + j;
      const b = base + i * radial + ((j + 1) % radial);
      const c = a + radial;
      const d = b + radial;
      p.idx.push(a, c, b, b, c, d);
    }
  return new THREE.Vector3(bend, h, 0);
}

/** Lanceolate leaf with a folded midrib, arching outward. */
function addLeaf(p: Part, origin: THREE.Vector3, yaw: number, len: number, wid: number, lift: number, color = LEAF, petal = 0) {
  const rows = 4;
  const base = p.pos.length / 3;
  const dir = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    const w = Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.02)) * wid * (1 - t * 0.25);
    const c = origin.clone().addScaledVector(dir, t * len);
    c.y += Math.sin(t * Math.PI * 0.6) * lift * len - t * t * len * 0.35;
    const L = c.clone().addScaledVector(side, -w);
    const R = c.clone().addScaledVector(side, w);
    const M = c.clone();
    M.y += w * 0.35;
    L.y -= w * 0.1;
    R.y -= w * 0.1;
    pushVert(p, L, color, petal);
    pushVert(p, M, color.clone().multiplyScalar(1.1), petal);
    pushVert(p, R, color, petal);
  }
  for (let i = 0; i < rows; i++) {
    const a = base + i * 3;
    const b = a + 3;
    p.idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
  }
}

/** Ray-petalled composite flower head (daisy / aster), facing +Y. */
function addHead(p: Part, top: THREE.Vector3, petals: number, len: number, wid: number, disc: number, cup: number) {
  // disc: a low dome
  const base = p.pos.length / 3;
  const dSeg = 8;
  pushVert(p, top.clone().add(new THREE.Vector3(0, disc * 0.55, 0)), DISC, 0);
  for (let j = 0; j < dSeg; j++) {
    const a = (j / dSeg) * Math.PI * 2;
    pushVert(p, top.clone().add(new THREE.Vector3(Math.cos(a) * disc, 0, Math.sin(a) * disc)), DISC.clone().multiplyScalar(0.8), 0);
  }
  for (let j = 0; j < dSeg; j++) p.idx.push(base, base + 1 + ((j + 1) % dSeg), base + 1 + j);
  // petals: two-segment strips so they can cup and curl
  for (let k = 0; k < petals; k++) {
    const a = (k / petals) * Math.PI * 2 + (k % 2) * 0.08;
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const b0 = p.pos.length / 3;
    for (let i = 0; i <= 2; i++) {
      const t = i / 2;
      const w = (i === 0 ? 0.45 : i === 1 ? 1 : 0.55) * wid;
      const c = top.clone().addScaledVector(dir, disc * 0.8 + t * len);
      c.y += Math.sin(t * Math.PI * 0.5) * cup * len - t * t * 0.12 * len;
      pushVert(p, c.clone().addScaledVector(side, -w), WHITE, 1);
      pushVert(p, c.clone().addScaledVector(side, w), WHITE, 1);
    }
    for (let i = 0; i < 2; i++) {
      const a0 = b0 + i * 2;
      p.idx.push(a0, a0 + 2, a0 + 1, a0 + 1, a0 + 2, a0 + 3);
    }
  }
}

function addFloret(p: Part, c: THREE.Vector3, s: number, petal = 1) {
  // tiny octahedron
  const base = p.pos.length / 3;
  const pts = [
    [0, s, 0],
    [s, 0, 0],
    [0, 0, s],
    [-s, 0, 0],
    [0, 0, -s],
    [0, -s * 0.7, 0],
  ];
  for (const q of pts) pushVert(p, c.clone().add(new THREE.Vector3(q[0], q[1], q[2])), WHITE, petal);
  p.idx.push(base, base + 2, base + 1, base, base + 3, base + 2, base, base + 4, base + 3, base, base + 1, base + 4);
  p.idx.push(base + 5, base + 1, base + 2, base + 5, base + 2, base + 3, base + 5, base + 3, base + 4, base + 5, base + 4, base + 1);
}

function buildKind(kind: FlowerKind): THREE.BufferGeometry {
  const p = newPart();
  const r = rng(kind.length * 17 + 3);
  if (kind === 'daisy') {
    const top = addStem(p, 0.36, 0.02);
    addLeaf(p, new THREE.Vector3(0.002, 0.05, 0), 0.4, 0.1, 0.012, 0.3);
    addLeaf(p, new THREE.Vector3(0.004, 0.13, 0), 2.6, 0.085, 0.01, 0.35);
    addLeaf(p, new THREE.Vector3(0, 0.01, 0), 4.3, 0.12, 0.014, 0.2);
    addHead(p, top, 13, 0.033, 0.0078, 0.013, 0.25);
  } else if (kind === 'aster') {
    const top = addStem(p, 0.3, -0.018);
    addLeaf(p, new THREE.Vector3(0, 0.06, 0), 1.2, 0.09, 0.013, 0.3);
    addLeaf(p, new THREE.Vector3(0, 0.15, 0), 3.9, 0.07, 0.011, 0.3);
    addHead(p, top, 9, 0.028, 0.012, 0.009, 0.45);
  } else if (kind === 'spike') {
    const top = addStem(p, 0.44, 0.015, 0.003, 0.0018, 5);
    for (let k = 0; k < 4; k++) addLeaf(p, new THREE.Vector3(0, 0.02 + k * 0.05, 0), k * 1.7 + 0.3, 0.11 - k * 0.015, 0.016, 0.35);
    const n = 22;
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      const y = 0.26 + t * 0.19;
      const a = k * 2.4;
      const rad = 0.011 * (1 - t * 0.6);
      const bend = 0.015 * (y / 0.44) ** 2;
      addFloret(p, new THREE.Vector3(bend + Math.cos(a) * rad, y, Math.sin(a) * rad), 0.0095 * (1 - t * 0.45));
    }
    void top;
  } else if (kind === 'umbel') {
    const top = addStem(p, 0.42, 0.01);
    addLeaf(p, new THREE.Vector3(0, 0.04, 0), 0.9, 0.12, 0.018, 0.25);
    addLeaf(p, new THREE.Vector3(0, 0.12, 0), 3.6, 0.1, 0.016, 0.3);
    const n = 16;
    for (let k = 0; k < n; k++) {
      const a = k * 2.399;
      const rr = Math.sqrt(k / n) * 0.045;
      const c = top.clone().add(new THREE.Vector3(Math.cos(a) * rr, 0.004 - rr * rr * 6, Math.sin(a) * rr));
      addFloret(p, c, 0.0072 + r() * 0.0025);
    }
  } else {
    // leafy foliage clump (tinted per instance)
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + r() * 0.4;
      addLeaf(p, new THREE.Vector3(Math.cos(a) * 0.01, 0.005, Math.sin(a) * 0.01), a, 0.12 + r() * 0.07, 0.02 + r() * 0.008, 0.8 + r() * 0.4, WHITE, 1);
    }
  }
  return toGeometry(p);
}

function flowerMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, side: THREE.DoubleSide, envMapIntensity: 0.7 });
  m.onBeforeCompile = (s) => {
    s.uniforms.uTime = windUniforms.uTime;
    s.uniforms.uWind = windUniforms.uWind;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aPetal;\nuniform float uTime;\nuniform float uWind;')
      .replace('#include <color_vertex>', THREE.ShaderChunk.color_vertex.replace('vColor.xyz *= instanceColor.xyz;', 'vColor.xyz *= mix( vec3( 1.0 ), instanceColor.xyz, aPetal );'))
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         {
           #ifdef USE_INSTANCING
             vec3 ip = vec3( instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2] );
           #else
             vec3 ip = vec3( 0.0 );
           #endif
           float ph = dot( ip.xz, vec2( 0.37, 0.61 ) );
           float h = max( transformed.y, 0.0 );
           float k = h * h * 0.24 * uWind;
           float t = uTime;
           float gust = 0.6 + 0.4 * sin( t * 0.5 + ph * 0.15 );
           transformed.x += ( sin( t * 1.9 + ph ) * 0.75 + sin( t * 3.7 + ph * 2.1 ) * 0.25 ) * k * gust;
           transformed.z += cos( t * 1.5 + ph * 1.3 ) * 0.6 * k * gust;
         }`,
      );
  };
  m.customProgramCacheKey = () => 'apiary-flower';
  return m;
}

function FlowerBeds({ quality }: { quality: Quality }) {
  const flowers = getFlowers(quality);
  const geos = useMemo(() => Object.fromEntries(FLOWER_KINDS.map((k) => [k, buildKind(k)])) as Record<FlowerKind, THREE.BufferGeometry>, []);
  const mat = useMemo(() => flowerMaterial(), []);
  const refs = useRef<Record<string, THREE.InstancedMesh | null>>({});
  const byKind = useMemo(() => {
    const out = {} as Record<FlowerKind, typeof flowers>;
    for (const k of FLOWER_KINDS) out[k] = flowers.filter((f) => f.kind === k);
    return out;
  }, [flowers]);
  useLayoutEffect(() => {
    const m4 = new THREE.Matrix4();
    for (const k of FLOWER_KINDS) {
      const mesh = refs.current[k];
      if (!mesh) continue;
      byKind[k].forEach((f, i) => {
        mesh.setMatrixAt(i, flowerMatrix(f, m4));
        mesh.setColorAt(i, f.color);
      });
      mesh.count = byKind[k].length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [byKind]);
  return (
    <group>
      {FLOWER_KINDS.map((k) =>
        byKind[k].length ? (
          <instancedMesh
            key={k}
            ref={(r) => {
              refs.current[k] = r;
            }}
            args={[geos[k], mat, byKind[k].length]}
            receiveShadow
          />
        ) : null,
      )}
    </group>
  );
}

function tuft(blades: number, h: number, seed: number) {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < blades; i++) {
    const g = new THREE.PlaneGeometry(0.022, h * (0.55 + r() * 0.6), 1, 3);
    const p = g.attributes.position as THREE.BufferAttribute;
    const hh = h * 0.5;
    for (let k = 0; k < p.count; k++) {
      const y = p.getY(k) + hh;
      const t = y / (h * 1.1);
      p.setY(k, y);
      p.setX(k, p.getX(k) * (1 - t * 0.85));
      p.setZ(k, t * t * h * 0.6);
    }
    g.rotateY((i / blades) * Math.PI * 2 + r() * 0.7);
    g.rotateZ((r() - 0.5) * 0.35);
    g.deleteAttribute('uv');
    parts.push(g);
  }
  const m = mergeGeometries(parts, false);
  m.computeVertexNormals();
  return m;
}

/** Soft green grass tufts carpeting the wildflower margins. */
function MeadowGrass({ quality }: { quality: Quality }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => tuft(quality === 'low' ? 5 : 8, 0.2, 31), [quality]);
  const mat = useMemo(() => applyWind(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.85 }), { sway: 0.3, stiffness: 2.2, speed: 1.5 }), []);
  const items = useMemo(() => {
    const r = rng(404);
    const flowers = getFlowers(quality);
    const per = quality === 'low' ? 0.12 : quality === 'medium' ? 0.25 : 0.42;
    const cols = ['#5F7A35', '#6E8A3E', '#7C8F45', '#566F31', '#8A9550'].map((c) => new THREE.Color(c));
    const out: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const o = new THREE.Object3D();
    for (const f of flowers) {
      if (r() > per) continue;
      const a = r() * Math.PI * 2;
      const d = 0.08 + r() * 0.25;
      const x = f.x + Math.cos(a) * d;
      const z = f.z + Math.sin(a) * d;
      o.position.set(x, groundY(x, z) - 0.01, z);
      o.rotation.set(0, r() * 6.28, 0);
      o.scale.setScalar(0.7 + r() * 0.8);
      o.updateMatrix();
      out.push({ m: o.matrix.clone(), c: cols[Math.floor(r() * cols.length)].clone().offsetHSL(0, 0, (r() - 0.5) * 0.06) });
    }
    return out;
  }, [quality]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((it, i) => {
      mesh.setMatrixAt(i, it.m);
      mesh.setColorAt(i, it.c);
    });
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[geo, mat, Math.max(1, items.length)]} receiveShadow />;
}

/** Shallow terracotta waterer on a stone pedestal, with pebbles and corks for bees to land on. */
function WaterDish({ m }: { m: ApiaryMaterials }) {
  const gy = groundY(WATER_DISH.x, WATER_DISH.z);
  const pedestal = useMemo(() => smoothLathe([[0.001, 0], [0.26, 0], [0.24, 0.05], [0.16, 0.12], [0.13, 0.22], [0.15, 0.3], [0.2, 0.33], [0.001, 0.33]], 40, 32), []);
  const basin = useMemo(() => smoothLathe([[0.001, 0.0], [0.3, 0.0], [0.42, 0.04], [0.47, 0.1], [0.45, 0.11], [0.4, 0.06], [0.28, 0.025], [0.001, 0.025]], 56, 32), []);
  const water = useMemo(() => {
    const set = ripples();
    const n = set.normalMap!.clone();
    n.repeat.set(2, 2);
    n.needsUpdate = true;
    return {
      tex: n,
      mat: new THREE.MeshPhysicalMaterial({
        color: '#6E8077',
        roughness: 0.05,
        normalMap: n,
        normalScale: new THREE.Vector2(0.18, 0.18),
        transparent: true,
        opacity: 0.86,
        clearcoat: 1,
        envMapIntensity: 1.5,
      }),
    };
  }, []);
  useFrame((_, dt) => {
    water.tex.offset.x += dt * 0.012;
    water.tex.offset.y += dt * 0.008;
  });
  const pebbles = useMemo(() => {
    const r = rng(17);
    return Array.from({ length: 11 }, () => {
      const a = r() * Math.PI * 2;
      const d = 0.08 + r() * 0.26;
      return { p: [Math.cos(a) * d, 0.405, Math.sin(a) * d] as Vec3, s: [0.035 + r() * 0.03, 0.025 + r() * 0.02, 0.03 + r() * 0.03] as Vec3, c: ['#C9C1B2', '#9A9C8A', '#B08A6A', '#DCD5C6'][Math.floor(r() * 4)] };
    });
  }, []);
  const pebbleGeo = useMemo(() => {
    const parts = pebbles.map((pb, i) => {
      const g = new THREE.SphereGeometry(1, 12, 8);
      g.scale(pb.s[0], pb.s[1], pb.s[2]);
      g.rotateY(i);
      g.translate(pb.p[0], pb.p[1], pb.p[2]);
      g.deleteAttribute('uv');
      return g;
    });
    return mergeGeometries(parts, false);
  }, [pebbles]);
  return (
    <group position={[WATER_DISH.x, gy - 0.02, WATER_DISH.z]}>
      <mesh geometry={pedestal} material={m.stone} castShadow receiveShadow />
      <mesh geometry={basin} material={m.terracotta} position={[0, 0.32, 0]} castShadow receiveShadow />
      <mesh position={[0, 0.425, 0]} rotation={[-Math.PI / 2, 0, 0]} material={water.mat} receiveShadow>
        <circleGeometry args={[0.43, 48]} />
      </mesh>
      <mesh geometry={pebbleGeo} material={m.pebble} receiveShadow />
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[Math.cos(i * 2.2 + 0.5) * 0.2, 0.43, Math.sin(i * 2.2 + 0.5) * 0.2]} rotation={[Math.PI / 2, 0, i]}>
          <cylinderGeometry args={[0.022, 0.022, 0.045, 14]} />
          <meshStandardMaterial color="#C49A68" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** Shared styles tuned for this venue: finer, denser foliage reads better at close range. */
const BARK = TREE_STYLES.sidr.barkColor;
const SIDR_STYLE = { ...TREE_STYLES.sidr, leafSize: 0.078, leavesPerTip: 400 };
const SAMAR_STYLE = { ...TREE_STYLES.samar, barkColor: BARK, leafSize: 0.064, leavesPerTip: 270 };
const SHRUB_STYLE = { ...TREE_STYLES.shrub, barkColor: BARK, leafSize: 0.058, leavesPerTip: 80 };

const SIDR: TreeSpec[] = [
  { position: [-13.6, 0, -13.2], seed: 7, scale: 1.9, rotation: 0.4 },
  { position: [-22.8, 0, -5.2], seed: 13, scale: 1.65, rotation: 2.1 },
  { position: [15.8, 0, -4.2], seed: 21, scale: 1.45, rotation: 1.2 },
  { position: [1.6, 0, -13.8], seed: 5, scale: 1.4, rotation: 3.0 },
];

const SAMAR: TreeSpec[] = [
  { position: [15.5, 0, -17.0], seed: 4, scale: 1.5, rotation: 0.8 },
  { position: [-27.0, 0, 11.0], seed: 9, scale: 1.6, rotation: 2.4 },
  { position: [26.5, 0, 13.5], seed: 15, scale: 1.4, rotation: 1.0 },
  { position: [-32.0, 0, -11.0], seed: 19, scale: 1.5, rotation: 0.2 },
  { position: [-6.0, 0, -19.6], seed: 23, scale: 1.3, rotation: 1.6 },
  { position: [-23.5, 0, 9.4], seed: 27, scale: 1.45, rotation: 2.2 },
];

function grounded(list: TreeSpec[]): TreeSpec[] {
  return list.map((t) => ({ ...t, position: [t.position[0], groundY(t.position[0], t.position[2]) - 0.05, t.position[2]] as Vec3 }));
}

export const Flora = memo(function Flora({ m, quality }: { m: ApiaryMaterials; quality: Quality }) {
  const sidr = useMemo(() => grounded(SIDR), []);
  const samar = useMemo(() => grounded(quality === 'low' ? SAMAR.slice(0, 3) : SAMAR), [quality]);
  const shrubs = useMemo(() => {
    const r = rng(55);
    const n = quality === 'low' ? 14 : quality === 'medium' ? 22 : 30;
    const out: TreeSpec[] = [];
    let guard = 0;
    while (out.length < n && guard++ < 2000) {
      const x = -45 + r() * 90;
      const z = -26 + r() * 60;
      const inside = x > SITE.x0 + 2 && x < SITE.x1 - 2 && z > SITE.z0 + 2 && z < SITE.z1 - 1;
      if (inside) continue;
      if (isBlocked(x, z, 1.2) || pathMask(x, z) > 0.05) continue;
      const w = wadiAt(x, z);
      if (w.d < w.halfW + 0.5) continue;
      out.push({ position: [x, groundY(x, z) - 0.04, z], seed: 60 + out.length, scale: 1.1 + r() * 1.4, rotation: r() * 6 });
    }
    // scrub clinging to the gentler ledges of the foothills
    const extra = quality === 'low' ? 8 : quality === 'medium' ? 14 : 22;
    let added = 0;
    guard = 0;
    while (added < extra && guard++ < 3000) {
      const x = -42 + r() * 74;
      const z = -48 + r() * 24;
      const w = wadiAt(x, z);
      if (w.d < w.halfW + 5) continue;
      const y = groundY(x, z);
      const slope = Math.hypot(groundY(x + 0.6, z) - y, groundY(x, z + 0.6) - y) / 0.6;
      if (slope > 0.35 || y < 1.2) continue;
      out.push({ position: [x, y - 0.05, z], seed: 200 + added, scale: 1.4 + r() * 1.6, rotation: r() * 6 });
      added++;
    }
    return out;
  }, [quality]);
  const hillSamar = useMemo(() => {
    const r = rng(77);
    const out: TreeSpec[] = [];
    let guard = 0;
    const n = quality === 'low' ? 1 : 3;
    while (out.length < n && guard++ < 3000) {
      const x = -36 + r() * 60;
      const z = -44 + r() * 16;
      const w = wadiAt(x, z);
      if (w.d < w.halfW + 6) continue;
      const y = groundY(x, z);
      const slope = Math.hypot(groundY(x + 0.8, z) - y, groundY(x, z + 0.8) - y) / 0.8;
      if (slope > 0.25 || y < 2) continue;
      out.push({ position: [x, y - 0.06, z], seed: 300 + out.length, scale: 1.2 + r() * 0.5, rotation: r() * 6 });
    }
    return out;
  }, [quality]);
  const allSamar = useMemo(() => [...samar, ...hillSamar], [samar, hillSamar]);
  return (
    <group>
      <FlowerBeds quality={quality} />
      <MeadowGrass quality={quality} />
      <WaterDish m={m} />
      <Trees trees={sidr} style={SIDR_STYLE} quality={quality} />
      <Trees trees={allSamar} style={SAMAR_STYLE} quality={quality} />
      <Trees trees={shrubs} style={SHRUB_STYLE} quality={quality} />
    </group>
  );
});
