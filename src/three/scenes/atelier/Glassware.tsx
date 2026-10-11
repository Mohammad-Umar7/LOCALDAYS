import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { roundedBox, smoothLathe } from '../../props/geo';
import type { Quality, Vec3 } from '../../core/types';
import type { AtelierMaterials } from './materials';
import { NICHES, NICHE_DEPTH, ROOM } from './layout';
import { bakeInstances, mergeParts, M, rng } from './geom';
import { Baked } from './Baked';
import { ESSENCE_COLORS } from './Organ';

/* ------------------------------------------------------------------ */
/*  Crystal perfume bottles: five designs (onion attar, octagonal      */
/*  facet, round flask, thick block, slender column) in transmissive   */
/*  glass with gold caps. Liquids are opaque so they read through the  */
/*  refraction. Instanced per design for the niche displays.           */
/* ------------------------------------------------------------------ */

export type BottleDesign = 'attar' | 'facet' | 'flask' | 'block' | 'slender';
export const DESIGNS: BottleDesign[] = ['attar', 'facet', 'flask', 'block', 'slender'];

const V = (pts: [number, number][]) => pts.map(([r, y]) => new THREE.Vector2(r, y));

/** Faceted lathe with crisp flat normals. */
function facetLathe(pts: [number, number][], sides: number) {
  const g = new THREE.LatheGeometry(V(pts), sides).toNonIndexed();
  g.computeVertexNormals();
  return g;
}

export interface BottleGeos {
  body: THREE.BufferGeometry;
  liquid: THREE.BufferGeometry;
  cap: THREE.BufferGeometry;
  /** Liquid body height (for fill animation the liquid is scaled in y from its base) */
  liquidTop: number;
  height: number;
}

const designCache = new Map<string, BottleGeos>();

export function bottleGeos(design: BottleDesign, quality: Quality): BottleGeos {
  const seg = quality === 'high' ? 48 : quality === 'medium' ? 32 : 20;
  const key = `${design}:${seg}`;
  const hit = designCache.get(key);
  if (hit) return hit;
  {
    let out: BottleGeos;
    if (design === 'attar') {
      out = {
        body: smoothLathe([[0.001, 0], [0.03, 0], [0.042, 0.012], [0.048, 0.035], [0.045, 0.06], [0.032, 0.08], [0.014, 0.095], [0.009, 0.105], [0.009, 0.125]], seg, 22),
        liquid: smoothLathe([[0.001, 0.004], [0.027, 0.004], [0.037, 0.014], [0.0425, 0.035], [0.0415, 0.055], [0.001, 0.0551]], Math.max(16, seg / 2), 10),
        cap: smoothLathe([[0.001, 0.12], [0.013, 0.12], [0.016, 0.128], [0.015, 0.14], [0.01, 0.152], [0.004, 0.165], [0.005, 0.176], [0.001, 0.182]], Math.max(16, seg / 2), 14),
        liquidTop: 0.055,
        height: 0.18,
      } as BottleGeos;
    } else if (design === 'facet') {
      out = {
        body: facetLathe([[0.001, 0], [0.036, 0], [0.041, 0.006], [0.041, 0.085], [0.033, 0.097], [0.012, 0.104], [0.012, 0.113]], 8),
        liquid: facetLathe([[0.001, 0.006], [0.0345, 0.006], [0.0345, 0.07], [0.001, 0.0701]], 8),
        cap: facetLathe([[0.001, 0.11], [0.02, 0.11], [0.025, 0.118], [0.025, 0.152], [0.019, 0.16], [0.001, 0.162]], 8),
        liquidTop: 0.07,
        height: 0.162,
      };
    } else if (design === 'flask') {
      out = {
        body: smoothLathe([[0.001, 0], [0.026, 0], [0.045, 0.02], [0.052, 0.05], [0.045, 0.08], [0.022, 0.098], [0.011, 0.106], [0.011, 0.122]], seg, 22),
        liquid: smoothLathe([[0.001, 0.005], [0.024, 0.005], [0.04, 0.022], [0.046, 0.05], [0.001, 0.0501]], Math.max(16, seg / 2), 10),
        cap: smoothLathe([[0.001, 0.118], [0.016, 0.118], [0.017, 0.13], [0.012, 0.134], [0.007, 0.136], [0.013, 0.143], [0.014, 0.153], [0.007, 0.161], [0.001, 0.163]], Math.max(16, seg / 2), 16),
        liquidTop: 0.05,
        height: 0.163,
      };
    } else if (design === 'block') {
      const body = roundedBox(0.078, 0.1, 0.042, 0.009, 3).clone().translate(0, 0.05, 0);
      const neck = new THREE.CylinderGeometry(0.011, 0.011, 0.016, 16).translate(0, 0.106, 0);
      const liquid = roundedBox(0.062, 0.072, 0.028, 0.006, 2).clone().translate(0, 0.008 + 0.036, 0);
      const cap = mergeParts([
        { g: roundedBox(0.034, 0.038, 0.034, 0.006, 2), m: M.t(0, 0.131, 0) },
        { g: new THREE.CylinderGeometry(0.019, 0.019, 0.006, 24), m: M.t(0, 0.111, 0) },
      ]);
      out = { body: mergeParts([{ g: body }, { g: neck }]), liquid, cap, liquidTop: 0.08, height: 0.15 };
    } else {
      out = {
        body: smoothLathe([[0.001, 0], [0.024, 0], [0.0275, 0.006], [0.0275, 0.13], [0.02, 0.14], [0.0085, 0.146], [0.0085, 0.156]], seg, 16),
        liquid: smoothLathe([[0.001, 0.006], [0.0225, 0.006], [0.0225, 0.1], [0.001, 0.1001]], Math.max(16, seg / 2), 8),
        cap: smoothLathe([[0.001, 0.151], [0.0125, 0.151], [0.0135, 0.2], [0.009, 0.206], [0.001, 0.207]], Math.max(16, seg / 2), 8),
        liquidTop: 0.1,
        height: 0.207,
      };
    }
    designCache.set(key, out);
    return out;
  }
}

const tintCache = new Map<string, THREE.BufferGeometry>();
/** A copy of `geo` carrying a flat vertex colour (merges into the shared liquid bucket). */
export function tintedGeometry(geo: THREE.BufferGeometry, color: string) {
  const key = `${geo.uuid}:${color}`;
  let g = tintCache.get(key);
  if (!g) {
    g = bakeInstances(geo, [new THREE.Matrix4()], [new THREE.Color(color)]);
    tintCache.set(key, g);
  }
  return g;
}

/* ------------------------------- Placement ------------------------------- */

interface Placed {
  design: BottleDesign;
  p: Vec3;
  rot: number;
  s: number;
  color: string;
}

/** Bottles for the arched niches, in design space. */
function nicheBottles(quality: Quality): Placed[] {
  const r = rng(29);
  const out: Placed[] = [];
  const place = (wall: 'back' | 'right', u: number, y: number, design: BottleDesign, s: number) => {
    const z = -NICHE_DEPTH / 2 + (r() - 0.5) * 0.06;
    const p: Vec3 = wall === 'back' ? [u, y, ROOM.z0 + z] : [ROOM.x1 - z, y, u];
    out.push({ design, p, rot: r() * Math.PI, s, color: ESSENCE_COLORS[Math.floor(r() * ESSENCE_COLORS.length)] });
  };
  const fill = (wall: 'back' | 'right', c: number, width: number, y: number, n: number, offset: number) => {
    for (let i = 0; i < n; i++) {
      const u = c - width / 2 + (width * (i + 0.5)) / n + (r() - 0.5) * 0.03;
      place(wall, u, y + 0.014, DESIGNS[(i + offset) % DESIGNS.length], 0.95 + r() * 0.25);
    }
  };
  const g = NICHES.grand;
  fill('back', g.c, 1.5, g.shelves[0], 7, 0);
  fill('back', g.c - 0.42, 0.55, g.shelves[1], 3, 2);
  fill('back', g.c + 0.42, 0.55, g.shelves[1], 3, 4);
  fill('back', g.c, 0.8, g.shelves[2], 3, 1);
  const l = NICHES.left;
  fill('back', l.c, 0.9, l.shelves[0], 5, 3);
  fill('back', l.c, 0.85, l.shelves[1], 4, 1);
  if (quality !== 'low') {
    const rr = NICHES.right;
    fill('right', rr.c, 1.0, rr.shelves[0], 5, 2);
    fill('right', rr.c, 0.95, rr.shelves[1], 4, 0);
  }
  return out;
}

function DesignGroup({ m, design, items, quality }: { m: AtelierMaterials; design: BottleDesign; items: Placed[]; quality: Quality }) {
  const geos = bottleGeos(design, quality);
  const { mats, colors } = useMemo(() => {
    const o = new THREE.Object3D();
    const mats = items.map((it) => {
      o.position.set(...it.p);
      o.rotation.set(0, it.rot, 0);
      o.scale.setScalar(it.s);
      o.updateMatrix();
      return o.matrix.clone();
    });
    return { mats, colors: items.map((it) => new THREE.Color(it.color)) };
  }, [items]);
  if (!items.length) return null;
  return (
    <group>
      <Baked geo={geos.liquid} mats={mats} colors={colors} material={m.liquidVC} receive={false} />
      <Baked geo={geos.cap} mats={mats} material={m.gold} receive={false} />
      <Baked geo={geos.body} mats={mats} material={m.crystal} receive={false} renderOrder={2} />
    </group>
  );
}

export function CrystalShelves({ m, quality }: { m: AtelierMaterials; quality: Quality }) {
  const items = useMemo(() => nicheBottles(quality), [quality]);
  const byDesign = useMemo(() => DESIGNS.map((d) => items.filter((it) => it.design === d)), [items]);
  return (
    <group>
      {DESIGNS.map((d, i) => (
        <DesignGroup key={d} m={m} design={d} quality={quality} items={byDesign[i]} />
      ))}
    </group>
  );
}

/* ---------------------------- Single bottles ---------------------------- */

export function CrystalBottle({
  m,
  design,
  quality,
  color,
  fill = 1,
  position,
  rotation = 0,
  scale = 1,
}: {
  m: AtelierMaterials;
  design: BottleDesign;
  quality: Quality;
  color: string;
  fill?: number;
  position?: Vec3;
  rotation?: number;
  scale?: number;
}) {
  const g = bottleGeos(design, quality);
  const liquid = useMemo(() => tintedGeometry(g.liquid, color), [g, color]);
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <mesh geometry={liquid} material={m.liquidVC} scale={[1, fill, 1]} />
      <mesh geometry={g.cap} material={m.gold} castShadow />
      <mesh geometry={g.body} material={m.crystal} castShadow renderOrder={2} />
    </group>
  );
}

/** Slowly turning display bottle on a velvet & brass turntable. */
export function DisplayBottle({ m, quality, position }: { m: AtelierMaterials; quality: Quality; position: Vec3 }) {
  const spin = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += Math.min(dt, 0.05) * 0.35;
  });
  const g = bottleGeos('facet', quality);
  const liquidMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#B8641E', roughness: 0.1, envMapIntensity: 1.4, emissive: '#3A1404', emissiveIntensity: 0.6 }), []);
  return (
    <group position={position}>
      <mesh material={m.velvetRed} position={[0, 0.012, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.095, 0.1, 0.024, 48]} />
      </mesh>
      <mesh material={m.brass} position={[0, 0.026, 0]}>
        <torusGeometry args={[0.094, 0.004, 8, 48]} />
      </mesh>
      <group ref={spin} position={[0, 0.026, 0]} scale={1.45} userData={{ noBatch: true }}>
        <mesh geometry={g.liquid} material={liquidMat} userData={{ noBatch: true }} />
        <mesh geometry={g.cap} material={m.gold} castShadow userData={{ noBatch: true }} />
        <mesh geometry={g.body} material={m.crystal} castShadow renderOrder={2} userData={{ noBatch: true }} />
      </group>
    </group>
  );
}
