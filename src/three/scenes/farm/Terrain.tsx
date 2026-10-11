import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeNoise } from '../../materials/noise';
import { getTexSet } from '../../materials/textures';
import { applyWind } from '../../materials/wind';
import { boxProjectUVs, roundedBox, wallGeometry } from '../../props/geo';
import { Trees, TREE_STYLES, type TreeSpec } from '../../props/Trees';
import type { Quality, Variant, Vec3 } from '../../core/types';
import type { FarmMaterials } from './materials';
import { SPLAT } from './ground';
import { STONE_PATHS } from './layout';

/* ------------------------------------------------------------------ */
/*  Ground: irrigated farm plot blending into wind-shaped dunes, with  */
/*  the Hajar mountains on the horizon, a mud perimeter wall, stone    */
/*  paths, grass tufts and desert shrubs.                              */
/* ------------------------------------------------------------------ */

export const PLOT = { x0: -32, x1: 38, z0: -38, z1: 24 };
const nz = makeNoise(42);

function plotDistance(x: number, z: number) {
  const dx = Math.max(PLOT.x0 - x, 0, x - PLOT.x1);
  const dz = Math.max(PLOT.z0 - z, 0, z - PLOT.z1);
  return Math.hypot(dx, dz);
}

export function terrainHeight(x: number, z: number) {
  const d = plotDistance(x, z);
  if (d <= 0) return 0;
  const P = 4096;
  const ridge = 1 - Math.abs(nz(x * 0.018 + 100, z * 0.012 + 100, P, P));
  const swell = nz(x * 0.006 + 40, z * 0.006 + 40, P, P) * 0.5 + 0.5;
  const dunes = ridge * ridge * 9 * (0.5 + swell) + nz(x * 0.05, z * 0.05, P, P) * 0.6;
  return THREE.MathUtils.smoothstep(d, 2, 34) * Math.max(0, dunes) + THREE.MathUtils.smoothstep(d, 0, 6) * 0.15;
}

function terrainMaterial(splat: THREE.Texture) {
  const ground = getTexSet('ground', { base: '#A3865D', dark: '#765D41', green: '#626634', seed: 14 });
  const sand = getTexSet('sand', { base: '#D3A56C', light: '#E4C28A', seed: 2 });
  const map = ground.map.clone();
  map.repeat.set(70, 70);
  map.needsUpdate = true;
  const nmap = ground.normalMap!.clone();
  nmap.repeat.set(70, 70);
  nmap.needsUpdate = true;
  const sandMap = sand.map.clone();
  sandMap.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({ map, normalMap: nmap, roughness: 1, normalScale: new THREE.Vector2(0.7, 0.7) });
  mat.onBeforeCompile = (s) => {
    s.uniforms.sandMap = { value: sandMap };
    s.uniforms.splatMap = { value: splat };
    s.uniforms.uSplat = { value: new THREE.Vector4(SPLAT.x0, SPLAT.z0, 1 / SPLAT.w, 1 / SPLAT.d) };
    s.vertexShader = s.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute float aMix;
         varying float vMix;
         varying vec2 vWorldXZ;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vMix = aMix;
         vWorldXZ = (modelMatrix * vec4(position, 1.0)).xz;`,
      );
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform sampler2D sandMap;
         uniform sampler2D splatMap;
         uniform vec4 uSplat;
         varying float vMix;
         varying vec2 vWorldXZ;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         // de-tile & soften the pebbles: blend in a larger, blurrier sample of the same ground
         float nearF = 1.0 - smoothstep(10.0, 60.0, length(vViewPosition));
         vec3 gWide = texture2D(map, vMapUv * 0.29 + vec2(0.37, 0.71), 1.5).rgb;
         vec3 gFine = texture2D(map, vMapUv * 2.7 + vec2(0.13, 0.41)).rgb;
         diffuseColor.rgb = mix(diffuseColor.rgb, gWide, 0.5);
         diffuseColor.rgb = mix(diffuseColor.rgb, gFine, nearF * 0.45);
         vec3 sandCol = texture2D(sandMap, vWorldXZ * 0.11).rgb;
         vec3 sandCol2 = texture2D(sandMap, vWorldXZ * 0.023 + 0.37).rgb;
         diffuseColor.rgb = mix(diffuseColor.rgb, mix(sandCol, sandCol2, 0.45) * 1.02, vMix);
         // ---- painted farm ground: irrigated soil, ground cover, tracks
         vec4 sp = texture2D(splatMap, (vWorldXZ - uSplat.xy) * uSplat.zw);
         float inPlot = 1.0 - vMix;
         float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
         float n1 = texture2D(sandMap, vWorldXZ * 0.061 + 0.21).r;
         float n2 = texture2D(sandMap, vWorldXZ * 0.19 + 0.63).g;
         float wet = smoothstep(0.06, 0.85, sp.r + (n1 - 0.5) * 0.45 + (n2 - 0.5) * 0.25) * inPlot;
         diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.5, 0.43, 0.36), wet);
         float grn = smoothstep(0.08, 0.8, sp.g + (n1 - 0.5) * 0.7 + (n2 - 0.5) * 0.5) * inPlot;
         vec3 grnCol = mix(vec3(0.27, 0.30, 0.12), vec3(0.45, 0.46, 0.21), clamp(lum * 1.8 + (n2 - 0.5), 0.0, 1.0));
         diffuseColor.rgb = mix(diffuseColor.rgb, grnCol, grn * 0.72);
         float trk = smoothstep(0.1, 0.8, sp.b + (n2 - 0.5) * 0.2) * inPlot;
         diffuseColor.rgb = mix(diffuseColor.rgb, mix(sandCol, sandCol2, 0.5) * vec3(0.98, 0.93, 0.86), trk * 0.78);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         roughnessFactor *= 1.0 - wet * 0.16;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        THREE.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * (1.0 - vMix * 0.75) * (1.0 - trk * 0.55) * (1.0 - nearF * 0.75);'),
      );
  };
  mat.customProgramCacheKey = () => 'farm-terrain-splat';
  return mat;
}

function GroundMesh({ quality, splat }: { quality: Quality; splat: THREE.Texture }) {
  const geo = useMemo(() => {
    const seg = quality === 'low' ? 120 : 180;
    const g = new THREE.PlaneGeometry(320, 320, seg, seg);
    g.rotateX(-Math.PI / 2);
    g.translate(3, 0, -7);
    const p = g.attributes.position as THREE.BufferAttribute;
    const mix = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const d = plotDistance(x, z);
      const edgeNoise = nz(x * 0.15, z * 0.15, 4096, 4096) * 2.5;
      mix[i] = THREE.MathUtils.smoothstep(d + edgeNoise, -1, 7);
      p.setY(i, terrainHeight(x, z));
    }
    g.setAttribute('aMix', new THREE.BufferAttribute(mix, 1));
    g.computeVertexNormals();
    return g;
  }, [quality]);
  const mat = useMemo(() => terrainMaterial(splat), [splat]);
  return <mesh geometry={geo} material={mat} receiveShadow />;
}

const MOUNTAIN_TINT: Record<Variant, [string, string]> = {
  golden: ['#D9B48E', '#A9876C'],
  morning: ['#C3CDD2', '#93A1AA'],
  dusk: ['#B8857C', '#6E4F5C'],
};

function Mountains({ variant }: { variant: Variant }) {
  const geo = useMemo(() => {
    const seg = 360;
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const R = 520;
    const [baseHex, topHex] = MOUNTAIN_TINT[variant];
    const base = new THREE.Color(baseHex);
    const top = new THREE.Color(topHex);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      // Taller range to the east (Hajar), low hills elsewhere
      const east = Math.max(0, Math.cos(a - 0.2));
      const ridge = 1 - Math.abs(nz(i * 0.09, 3.3, 4096, 4096));
      const h = 6 + east * 55 * (0.45 + ridge * 0.8) + Math.abs(nz(i * 0.33, 9.1, 4096, 4096)) * 10 * (0.3 + east);
      const x = Math.cos(a) * R;
      const z = Math.sin(a) * R;
      pos.push(x, -4, z, x, h, z);
      col.push(base.r, base.g, base.b, top.r, top.g, top.b);
    }
    for (let i = 0; i < seg; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    return g;
  }, [variant]);
  return (
    <mesh geometry={geo}>
      <meshBasicMaterial vertexColors fog={false} side={THREE.DoubleSide} transparent opacity={0.92} />
    </mesh>
  );
}

function PerimeterWall({ m }: { m: FarmMaterials }) {
  const segs = useMemo(() => {
    const H = 1.35;
    const T = 0.55;
    const list: { pos: Vec3; rot: number; len: number }[] = [];
    const run = (ax: number, az: number, bx: number, bz: number) => {
      const len = Math.hypot(bx - ax, bz - az);
      list.push({ pos: [(ax + bx) / 2, 0, (az + bz) / 2], rot: -Math.atan2(bz - az, bx - ax), len });
    };
    run(PLOT.x0, PLOT.z0, -0.2, PLOT.z0); // north, west of falaj inlet
    run(4.8, PLOT.z0, PLOT.x1, PLOT.z0);
    run(PLOT.x1, PLOT.z0, PLOT.x1, PLOT.z1);
    run(PLOT.x0, PLOT.z0, PLOT.x0, PLOT.z1);
    run(PLOT.x0, PLOT.z1, 3.2, PLOT.z1); // south with gate gap
    run(8.8, PLOT.z1, PLOT.x1, PLOT.z1);
    return list.map((s) => ({ ...s, g: wallGeometry(s.len, H, T, [], 0.08) }));
  }, []);
  const capGeo = useMemo(() => new THREE.CylinderGeometry(0.3, 0.3, 1, 12, 1, false, 0, Math.PI), []);
  const pillar = useMemo(() => boxProjectUVs(roundedBox(0.9, 2.6, 0.9, 0.06, 2).clone(), 0.5), []);
  return (
    <group>
      {segs.map((s, i) => (
        <group key={i} position={s.pos} rotation={[0, s.rot, 0]}>
          <mesh geometry={s.g} material={m.plaster} castShadow receiveShadow />
          <mesh geometry={capGeo} material={m.plaster} position={[0, 1.35, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, s.len, 1]} castShadow />
        </group>
      ))}
      {[3.2, 8.8].map((x) => (
        <group key={x} position={[x, 0, PLOT.z1]}>
          <mesh geometry={pillar} material={m.plasterLight} position={[0, 1.3, 0]} castShadow receiveShadow />
          <mesh position={[0, 2.72, 0]} castShadow material={m.plasterLight}>
            <coneGeometry args={[0.5, 0.45, 4]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Flagstone path following a spline. */
function StonePath({ m, points, seed = 1 }: { m: FarmMaterials; points: [number, number][]; seed?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => boxProjectUVs(roundedBox(1, 0.08, 1, 0.03, 1).clone(), 0.6), []);
  const mats = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const len = curve.getLength();
    const n = Math.floor(len / 0.62);
    let s = seed * 999;
    const r = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const p = curve.getPointAt(t);
      const tg = curve.getTangentAt(t);
      const side = new THREE.Vector3(-tg.z, 0, tg.x);
      const per = 2;
      for (let k = 0; k < per; k++) {
        const off = (k - 0.5) * 0.62 + (r() - 0.5) * 0.12;
        const pp = p.clone().addScaledVector(side, off);
        pp.y = 0.02 + r() * 0.015;
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(tg.x, tg.z) + (r() - 0.5) * 0.35, 0));
        out.push(new THREE.Matrix4().compose(pp, q, new THREE.Vector3(0.48 + r() * 0.12, 1, 0.48 + r() * 0.14)));
      }
    }
    return out;
  }, [points, seed]);
  useLayoutEffect(() => {
    const mm = ref.current;
    if (!mm) return;
    mats.forEach((mt, i) => mm.setMatrixAt(i, mt));
    mm.instanceMatrix.needsUpdate = true;
    mm.computeBoundingSphere();
  }, [mats]);
  return <instancedMesh ref={ref} args={[geo, m.stone, mats.length]} receiveShadow castShadow />;
}

function tuftGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.PlaneGeometry(0.045, 0.62, 1, 3);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) {
      const y = p.getY(k) + 0.31;
      p.setY(k, y);
      p.setX(k, p.getX(k) * (1 - y / 0.66));
      p.setZ(k, y * y * 0.6);
    }
    g.rotateY((i / 7) * Math.PI * 2);
    g.rotateZ((Math.random() - 0.5) * 0.4);
    parts.push(g);
  }
  const merged = mergeGeometries(parts, false);
  merged.computeVertexNormals();
  return merged;
}

function GrassTufts({
  count,
  area,
  color = '#9C9A4E',
  prefer,
}: {
  count: number;
  area: { x0: number; x1: number; z0: number; z1: number; avoid?: (x: number, z: number) => boolean };
  color?: string;
  /** 0…1 — tufts cluster where the ground is irrigated */
  prefer?: (x: number, z: number) => number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => tuftGeometry(), []);
  const mat = useMemo(
    () => applyWind(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9 }), { sway: 0.35, stiffness: 2.2, speed: 1.6 }),
    [],
  );
  useLayoutEffect(() => {
    const mm = ref.current;
    if (!mm) return;
    let s = 77;
    const r = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    let i = 0;
    let guard = 0;
    while (i < count && guard < count * 6) {
      guard++;
      const x = area.x0 + r() * (area.x1 - area.x0);
      const z = area.z0 + r() * (area.z1 - area.z0);
      if (area.avoid?.(x, z)) continue;
      const w = prefer ? prefer(x, z) : 1;
      if (prefer && r() > 0.22 + 0.78 * w) continue;
      o.position.set(x, terrainHeight(x, z), z);
      o.rotation.set(0, r() * 6.28, 0);
      o.scale.setScalar(0.8 + r() * 0.9);
      o.updateMatrix();
      mm.setMatrixAt(i, o.matrix);
      // greener and lusher where watered
      c.set(color).lerp(new THREE.Color('#6E8A3A'), w * 0.6).offsetHSL((r() - 0.5) * 0.04, (r() - 0.5) * 0.1, (r() - 0.5) * 0.12);
      if (w > 0.5) o.scale.multiplyScalar(1.15);
      mm.setColorAt(i, c);
      i++;
    }
    mm.count = i;
    mm.instanceMatrix.needsUpdate = true;
    if (mm.instanceColor) mm.instanceColor.needsUpdate = true;
    mm.computeBoundingSphere();
  }, [count, area, color, prefer]);
  return <instancedMesh ref={ref} args={[geo, mat, count]} receiveShadow castShadow frustumCulled={false} />;
}

function DesertShrubs({ count = 70 }: { count?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1, 3);
    const p = g.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = 1 + Math.sin(v.x * 7) * 0.12 + Math.sin(v.y * 9 + v.z * 5) * 0.1;
      v.multiplyScalar(n);
      v.y = Math.max(v.y * 0.7, -0.1);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  useLayoutEffect(() => {
    const mm = ref.current;
    if (!mm) return;
    let s = 5;
    const r = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2;
      const d = 52 + r() * 70;
      const x = 3 + Math.cos(a) * d;
      const z = -7 + Math.sin(a) * d;
      o.position.set(x, terrainHeight(x, z) - 0.05, z);
      o.rotation.set(0, r() * 6, 0);
      const sc = 0.35 + r() * 0.7;
      o.scale.set(sc * 1.3, sc, sc * 1.3);
      o.updateMatrix();
      mm.setMatrixAt(i, o.matrix);
      c.set(r() < 0.5 ? '#8E8A55' : '#9C8455').offsetHSL(0, 0, (r() - 0.5) * 0.08);
      mm.setColorAt(i, c);
    }
    mm.instanceMatrix.needsUpdate = true;
    if (mm.instanceColor) mm.instanceColor.needsUpdate = true;
    mm.computeBoundingSphere();
  }, [count]);
  return (
    <instancedMesh ref={ref} args={[geo, undefined, count]} castShadow receiveShadow>
      <meshStandardMaterial roughness={1} />
    </instancedMesh>
  );
}

export function Terrain({
  m,
  quality,
  variant,
  avoid,
  splat,
  extraShrubs,
  prefer,
}: {
  m: FarmMaterials;
  quality: Quality;
  variant: Variant;
  avoid: (x: number, z: number) => boolean;
  splat: THREE.Texture;
  /** Shrubs planted inside the walls (share the desert-shrub instances) */
  extraShrubs?: TreeSpec[];
  /** Where grass prefers to grow (irrigated ground) */
  prefer?: (x: number, z: number) => number;
}) {
  const paths = STONE_PATHS;
  const tuftArea = useMemo(() => ({ x0: PLOT.x0 + 1, x1: PLOT.x1 - 1, z0: PLOT.z0 + 1, z1: PLOT.z1 - 1, avoid }), [avoid]);
  const shrubs: TreeSpec[] = useMemo(() => {
    let s = 9;
    const r = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    const n = quality === 'low' ? 24 : 46;
    const outside = Array.from({ length: n }, (_, i) => {
      const a = r() * Math.PI * 2;
      const d = 50 + r() * 60;
      const x = 3 + Math.cos(a) * d;
      const z = -7 + Math.sin(a) * d * 0.9;
      return { position: [x, terrainHeight(x, z) - 0.05, z] as Vec3, seed: i + 40, scale: 1.2 + r() * 1.6, rotation: r() * 6 };
    });
    const inside = extraShrubs ?? [];
    return [...outside, ...(quality === 'low' ? inside.filter((_, i) => i % 2 === 0) : inside)];
  }, [quality, extraShrubs]);
  return (
    <group>
      <GroundMesh quality={quality} splat={splat} />
      <Mountains variant={variant} />
      <PerimeterWall m={m} />
      {paths.map((p, i) => (
        <StonePath key={i} m={m} points={p} seed={i + 1} />
      ))}
      <GrassTufts count={quality === 'low' ? 250 : quality === 'medium' ? 500 : 900} area={tuftArea} prefer={prefer} />
      <Trees trees={shrubs} style={TREE_STYLES.shrub} quality={quality} />
    </group>
  );
}
