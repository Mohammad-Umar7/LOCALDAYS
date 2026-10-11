import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { applyWind } from '../../materials/wind';
import { boxProjectUVs } from '../../props/geo';
import { sunDirection, SUN_PRESETS, type SunPreset } from '../../core/Rigs';
import type { Quality, Variant } from '../../core/types';
import { gravel, rockTex, soil, strata } from './tex';
import { groundY, isBlocked, meadowMask, noise2, PATHS, pathMask, rng, SITE, smoothstep, wadiAt, wadiMask } from './layout';

/* ------------------------------------------------------------------ */
/*  Wadi Al Helo ground: gravelly terrace, a dry wadi bed of pale      */
/*  cobbles, layered ochre foothills with strata ledges, sculpted      */
/*  stacked-slab outcrops, boulders, dry grass and distant ranges.     */
/* ------------------------------------------------------------------ */

/* --------------------------- Shared rock/ground material --------------------------- */

let groundMatCache: THREE.MeshStandardMaterial | null = null;

/** Ground shader: soil + meadow tint + path + wadi gravel, and strata rock on steep faces (world-projected). */
export function useGroundMaterial() {
  return useMemo(() => {
    if (groundMatCache) return groundMatCache;
    const ground = soil();
    const grav = gravel();
    const rock = strata();
    const mat = new THREE.MeshStandardMaterial({
      map: ground.map,
      normalMap: ground.normalMap,
      roughness: 1,
      normalScale: new THREE.Vector2(0.75, 0.75),
    });
    mat.onBeforeCompile = (s) => {
      s.uniforms.gravelMap = { value: grav.map };
      s.uniforms.strataMap = { value: rock.map };
      s.uniforms.strataNormal = { value: rock.normalMap };
      s.vertexShader = s.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           attribute vec3 aMask;
           varying vec3 vMask;
           varying vec3 vWPos;
           varying vec3 vWNorm;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vMask = aMask;
           #ifdef USE_INSTANCING
             vWPos = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;
             vWNorm = normalize( mat3( modelMatrix ) * mat3( instanceMatrix ) * objectNormal );
           #else
             vWPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
             vWNorm = normalize( mat3( modelMatrix ) * objectNormal );
           #endif`,
        );
      s.fragmentShader = s.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform sampler2D gravelMap;
           uniform sampler2D strataMap;
           uniform sampler2D strataNormal;
           varying vec3 vMask;
           varying vec3 vWPos;
           varying vec3 vWNorm;`,
        )
        .replace(
          '#include <map_fragment>',
          `vec3 nW = normalize( vWNorm );
           vec2 xz = vWPos.xz;
           vec3 soilA = texture2D( map, xz * 0.36 ).rgb;
           vec3 soilB = texture2D( map, xz * 0.083 + vec2( 0.37, 0.11 ) ).rgb;
           vec3 soil = mix( soilA, soilB, 0.4 );
           float macro = texture2D( strataMap, xz * 0.0045 ).r;
           float macro2 = texture2D( gravelMap, xz * 0.013 ).g;
           soil *= 0.86 + macro * 0.2 + macro2 * 0.12;
           vec3 grav = mix( texture2D( gravelMap, xz * 0.3 ).rgb, texture2D( gravelMap, xz * 0.077 + 0.5 ).rgb, 0.3 );
           float steep = smoothstep( 0.17, 0.42, 1.0 - nW.y );
           float sideW = smoothstep( 0.3, 0.7, abs( nW.x ) / ( abs( nW.x ) + abs( nW.z ) + 1e-4 ) );
           vec2 uvSA = vec2( vWPos.x * 0.06, vWPos.y * 0.075 );
           vec2 uvSB = vec2( vWPos.z * 0.06, vWPos.y * 0.075 );
           vec3 rockC = mix( texture2D( strataMap, uvSA ).rgb, texture2D( strataMap, uvSB ).rgb, sideW );
           float rv = texture2D( gravelMap, vWPos.xz * 0.009 + vec2( 0.2, 0.7 ) ).r;
           rockC *= mix( vec3( 0.78, 0.7, 0.62 ), vec3( 1.1, 1.02, 0.92 ), smoothstep( 0.35, 0.75, rv ) );
           vec3 c = soil;
           // meadow: mottled greens with a carpet of tiny five-petal ground flowers
           float mz = vMask.z;
           float gN = texture2D( strataMap, xz * 0.21 + 0.13 ).g;
           float gN2 = texture2D( strataMap, xz * 0.057 + 0.6 ).r;
           vec3 grass = mix( vec3( 0.1, 0.15, 0.045 ), vec3( 0.3, 0.33, 0.11 ), clamp( ( gN - 0.35 ) * 2.2 + ( gN2 - 0.45 ) * 1.2, 0.0, 1.0 ) );
           c = mix( c, mix( soil * vec3( 0.66, 0.74, 0.42 ), grass, 0.85 ), smoothstep( 0.0, 0.55, mz ) * 0.92 );
           {
             vec2 cu = xz / 0.085;
             vec2 ci = floor( cu );
             vec2 cf = fract( cu ) - 0.5;
             float h1 = fract( sin( dot( ci, vec2( 127.1, 311.7 ) ) ) * 43758.5453 );
             float h2 = fract( sin( dot( ci, vec2( 269.5, 183.3 ) ) ) * 43758.5453 );
             float h3 = fract( sin( dot( ci, vec2( 419.2, 371.9 ) ) ) * 43758.5453 );
             vec2 dv = cf - ( vec2( h2, h3 ) - 0.5 ) * 0.42;
             float rr = 0.15 + h3 * 0.09;
             float rad = length( dv );
             float ang = atan( dv.y, dv.x ) + h1 * 6.283;
             float aa = max( fwidth( cu.x ), 1e-4 );
             float shape = rr * ( 0.7 + 0.3 * cos( 5.0 * ang ) );
             float petal = 1.0 - smoothstep( shape - aa * 1.5, shape + aa * 1.5, rad );
             petal *= 0.75 + 0.25 * smoothstep( 0.0, shape, rad );
             float present = step( h1, mz * 0.5 );
             float drift = texture2D( strataMap, xz * 0.031 ).g;
             float pick = fract( h2 * 3.1 + drift * 1.9 );
             vec3 fcol = pick < 0.34 ? vec3( 0.86, 0.6, 0.05 ) : pick < 0.62 ? vec3( 0.92, 0.9, 0.82 ) : pick < 0.88 ? vec3( 0.36, 0.22, 0.66 ) : vec3( 0.6, 0.16, 0.38 );
             float centre = 1.0 - smoothstep( rr * 0.3 - aa, rr * 0.3 + aa, rad );
             fcol = mix( fcol, vec3( 0.7, 0.42, 0.03 ), centre * step( 0.34, pick ) );
             float far = smoothstep( 0.22, 0.55, aa );
             vec3 nearC = mix( c, fcol, petal * present );
             vec3 farC = mix( c, vec3( 0.66, 0.5, 0.36 ), mz * 0.62 * 0.16 );
             c = mix( nearC, farC, far );
           }
           vec3 pathCol = mix( soilB * 1.42, grav * 1.1, 0.25 ) * vec3( 1.05, 1.0, 0.92 );
           c = mix( c, pathCol, vMask.y * 0.95 );
           c = mix( c, grav * 1.04, vMask.x );
           float hill = smoothstep( 1.0, 4.0, vWPos.y );
           vec3 scree = mix( grav * vec3( 0.95, 0.88, 0.78 ), soil * vec3( 1.05, 0.95, 0.82 ), texture2D( strataMap, xz * 0.03 ).b );
           c = mix( c, scree, hill * 0.65 );
           c = mix( c, rockC, steep );
           diffuseColor.rgb *= c;`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#ifdef USE_NORMALMAP_TANGENTSPACE
             vec3 mapN = texture2D( normalMap, xz * 0.36 ).xyz * 2.0 - 1.0;
             mapN.xy *= normalScale * clamp( 1.0 - vMask.y * 0.5 - vMask.x * 0.3 - vMask.z * 1.1, 0.0, 1.0 );
             vec3 nSoil = normalize( tbn * mapN );
             // side-projected strata normals in a world-space frame (UV derivatives degenerate on cliffs)
             vec3 rA = texture2D( strataNormal, uvSA ).xyz * 2.0 - 1.0;
             vec3 rB = texture2D( strataNormal, uvSB ).xyz * 2.0 - 1.0;
             vec3 Bup = normalize( vec3( 0.0, 1.0, 0.0 ) - nW * nW.y + vec3( 0.0, 1e-4, 0.0 ) );
             vec3 Ta = normalize( vec3( 1.0, 0.0, 0.0 ) - nW * nW.x + vec3( 1e-4, 0.0, 0.0 ) );
             vec3 Tb = normalize( vec3( 0.0, 0.0, 1.0 ) - nW * nW.z + vec3( 0.0, 0.0, 1e-4 ) );
             vec3 wA = normalize( Ta * rA.x + Bup * rA.y + nW * max( rA.z, 0.25 ) );
             vec3 wBn = normalize( Tb * rB.x + Bup * rB.y + nW * max( rB.z, 0.25 ) );
             vec3 nRock = normalize( ( viewMatrix * vec4( normalize( mix( wA, wBn, sideW ) ), 0.0 ) ).xyz );
             normal = normalize( mix( nSoil, nRock, steep ) );
           #endif`,
        );
    };
    mat.customProgramCacheKey = () => 'apiary-ground';
    groundMatCache = mat;
    return mat;
  }, []);
}

/* --------------------------------- Ground mesh --------------------------------- */

function axis(min: number, max: number, d0: number, d1: number, step: number, growth: number) {
  const c: number[] = [];
  for (let v = d0; v <= d1 + 1e-6; v += step) c.push(v);
  const lower: number[] = [];
  let s = step;
  let v = c[0];
  while (v > min) {
    s *= growth;
    v -= s;
    lower.push(Math.max(v, min));
  }
  s = step;
  v = c[c.length - 1];
  while (v < max) {
    s *= growth;
    v += s;
    c.push(Math.min(v, max));
  }
  return [...lower.reverse(), ...c];
}

function GroundMesh({ quality }: { quality: Quality }) {
  const mat = useGroundMaterial();
  const geo = useMemo(() => {
    const step = quality === 'low' ? 1.0 : quality === 'medium' ? 0.78 : 0.62;
    const growth = quality === 'low' ? 1.11 : 1.09;
    const xs = axis(-460, 460, -58, 58, step, growth);
    const zs = axis(-460, 460, -64, 44, step, growth);
    const nx = xs.length;
    const nzc = zs.length;
    const pos = new Float32Array(nx * nzc * 3);
    const uv = new Float32Array(nx * nzc * 2);
    const mask = new Float32Array(nx * nzc * 3);
    let i = 0;
    for (let j = 0; j < nzc; j++)
      for (let k = 0; k < nx; k++, i++) {
        const x = xs[k];
        const z = zs[j];
        pos[i * 3] = x;
        pos[i * 3 + 1] = groundY(x, z);
        pos[i * 3 + 2] = z;
        uv[i * 2] = x * 0.36;
        uv[i * 2 + 1] = z * 0.36;
        const near = x > SITE.x0 - 30 && x < SITE.x1 + 30 && z > SITE.z0 - 25 && z < SITE.z1 + 40;
        mask[i * 3] = near || Math.abs(x) < 200 ? wadiMask(x, z) : 0;
        mask[i * 3 + 1] = near ? pathMask(x, z) : 0;
        mask[i * 3 + 2] = near ? meadowMask(x, z) * (1 - mask[i * 3] * 0.9) : 0;
      }
    const idx: number[] = [];
    for (let j = 0; j < nzc - 1; j++)
      for (let k = 0; k < nx - 1; k++) {
        const a = j * nx + k;
        const b = a + nx;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('aMask', new THREE.BufferAttribute(mask, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }, [quality]);
  return <mesh geometry={geo} material={mat} receiveShadow userData={{ noBatch: true }} />;
}

/* ------------------------------ Distant ranges ------------------------------ */

const RANGE_TINT: Record<Variant, { lit: string; shade: string; haze: string; sky: string }> = {
  morning: { lit: '#BBA78F', shade: '#7D8796', haze: '#CBD6DC', sky: '#B9CCE0' },
  golden: { lit: '#E2A677', shade: '#8E6D6C', haze: '#E7C49E', sky: '#E9B98A' },
  dusk: { lit: '#C88573', shade: '#5B4864', haze: '#BC8E88', sky: '#9C7F9C' },
};

function ridgeNoise(a: number, f: number, seed: number) {
  return 1 - Math.abs(noise2(a * f + seed, seed * 0.37));
}

/** Two rings of real 3D ridges, shaded on the CPU from the sun direction and blended into the haze. */
function Ranges({ variant, sun }: { variant: Variant; sun: Pick<SunPreset, 'elevation' | 'azimuth'> }) {
  const geo = useMemo(() => {
    const tint = RANGE_TINT[variant];
    const lit = new THREE.Color(tint.lit);
    const shade = new THREE.Color(tint.shade);
    const haze = new THREE.Color(tint.haze);
    const sky = new THREE.Color(tint.sky);
    const L = sunDirection(sun).normalize();
    const parts: THREE.BufferGeometry[] = [];
    const rings = [
      { R: 300, depth: 70, hMin: 18, hMax: 62, seg: 300, rows: 8, hazeBase: 0.55, seed: 3 },
      { R: 600, depth: 140, hMin: 40, hMax: 170, seg: 300, rows: 8, hazeBase: 0.72, seed: 11 },
    ];
    for (const ring of rings) {
      const { R, depth, seg, rows } = ring;
      const pos: number[] = [];
      const idx: number[] = [];
      const heights: number[] = [];
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        // back (−Z) is the high Hajar wall; the camera side is a low, distant line
        const back = Math.max(0, -Math.sin(a));
        const peaks = ridgeNoise(a, 9, ring.seed) * 0.65 + ridgeNoise(a, 23, ring.seed + 5) * 0.25 + Math.abs(noise2(a * 61, ring.seed)) * 0.1;
        const H = ring.hMin + (ring.hMax - ring.hMin) * (0.25 + 0.75 * back) * peaks;
        for (let j = 0; j <= rows; j++) {
          const t = j / rows;
          const r = R + (t - 0.35) * depth;
          const prof = Math.sin(Math.min(1, t / 0.65) * Math.PI * 0.5) * (t > 0.65 ? 1 - (t - 0.65) * 0.9 : 1);
          const gully = 1 - 0.18 * Math.abs(noise2(a * 140 + t * 3, ring.seed + j * 0.3));
          const h = -6 + H * prof * gully;
          pos.push(Math.cos(a) * r, h, Math.sin(a) * r);
          heights.push(h);
        }
      }
      for (let i = 0; i < seg; i++)
        for (let j = 0; j < rows; j++) {
          const a = i * (rows + 1) + j;
          const b = a + rows + 1;
          idx.push(a, a + 1, b, b, a + 1, b + 1);
        }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const nor = g.attributes.normal as THREE.BufferAttribute;
      const col = new Float32Array(pos.length);
      const c = new THREE.Color();
      const n = new THREE.Vector3();
      for (let v = 0; v < nor.count; v++) {
        n.fromBufferAttribute(nor, v);
        const lam = Math.max(0, n.dot(L));
        const h = heights[v];
        c.copy(shade).lerp(lit, Math.min(1, lam * 1.25));
        const up = THREE.MathUtils.clamp((h + 6) / (ring.hMax * 0.9), 0, 1);
        const hz = ring.hazeBase + (1 - ring.hazeBase) * (1 - up) * 0.85;
        c.lerp(haze, Math.min(0.97, hz));
        c.lerp(sky, 0.08);
        col[v * 3] = c.r;
        col[v * 3 + 1] = c.g;
        col[v * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.deleteAttribute('normal');
      parts.push(g);
    }
    return mergeGeometries(parts, false);
  }, [variant, sun.elevation, sun.azimuth]);
  return (
    <mesh geometry={geo} userData={{ noBatch: true }} renderOrder={-1}>
      <meshBasicMaterial vertexColors fog={false} />
    </mesh>
  );
}

/* ----------------------------- Stacked-slab outcrops ----------------------------- */

/** Layered sedimentary outcrop: bevelled slabs stacked and eroded back, smooth-shaded. */
function slabOutcrop(seed: number, radius: number, layers: number, layerH: number) {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  let y = -layerH * 0.55;
  let rad = radius;
  let cx = 0;
  let cz = 0;
  const ph = r() * 10;
  const elong = 1.1 + r() * 0.5;
  for (let L = 0; L < layers; L++) {
    const h = layerH * (0.65 + r() * 0.7);
    const bevel = Math.min(0.09, h * 0.22);
    const shape = new THREE.Shape();
    const N = 44;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const n =
        1 +
        0.16 * Math.sin(3 * a + ph + L * 0.7) +
        0.09 * Math.sin(5 * a + ph * 1.3 + L * 1.9) +
        0.05 * Math.sin(11 * a + L * 2.1 + ph) +
        (r() - 0.5) * 0.035;
      const rr = rad * n;
      const px = cx + Math.cos(a) * rr * elong;
      const pz = cz + Math.sin(a) * rr;
      if (i === 0) shape.moveTo(px, pz);
      else shape.lineTo(px, pz);
    }
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.02, h - bevel * 2),
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
      curveSegments: 1,
    });
    g.rotateX(Math.PI / 2);
    g.translate(0, y + h - bevel, 0);
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    parts.push(g);
    y += h * 0.97;
    rad *= 0.74 + r() * 0.16;
    cx += (r() - 0.5) * rad * 0.45;
    cz += (r() - 0.5) * rad * 0.45;
  }
  let merged = mergeGeometries(parts, false);
  merged = mergeVertices(merged, 1e-3);
  const pos = merged.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const yy = pos.getY(i);
    const z = pos.getZ(i);
    const d = noise2(x * 1.7 + seed, z * 1.7 + yy * 0.9) * 0.06 * radius;
    pos.setXYZ(i, x + d, yy + noise2(x * 2.3, z * 2.3 + seed) * 0.025, z + noise2(z * 1.9 + seed, x * 1.5) * 0.06 * radius);
  }
  merged.computeVertexNormals();
  boxProjectUVs(merged, 0.5);
  return merged;
}

const OUTCROPS: { x: number; z: number; r: number; layers: number; lh: number; rot: number; seed: number }[] = [
  { x: -19.5, z: -21.0, r: 2.6, layers: 4, lh: 0.75, rot: 0.4, seed: 3 },
  { x: -4.5, z: -22.6, r: 2.3, layers: 4, lh: 0.66, rot: 1.9, seed: 7 },
  { x: 6.0, z: -22.8, r: 3.0, layers: 5, lh: 0.8, rot: 2.6, seed: 11 },
  { x: 15.0, z: -20.8, r: 2.2, layers: 4, lh: 0.7, rot: 0.9, seed: 17 },
  { x: -11.5, z: -25.5, r: 3.6, layers: 5, lh: 0.95, rot: 2.2, seed: 23 },
  { x: 28.0, z: -5.0, r: 2.4, layers: 4, lh: 0.7, rot: 1.1, seed: 29 },
  { x: -30.5, z: 4.5, r: 2.6, layers: 4, lh: 0.8, rot: 0.2, seed: 31 },
  { x: 30.5, z: 18.5, r: 2.0, layers: 3, lh: 0.7, rot: 2.9, seed: 37 },
  { x: -27.5, z: 25.0, r: 2.3, layers: 3, lh: 0.7, rot: 1.4, seed: 41 },
  { x: 11.0, z: -30.5, r: 3.8, layers: 6, lh: 1.0, rot: 0.6, seed: 43 },
  { x: -25.0, z: -29.0, r: 3.4, layers: 5, lh: 1.0, rot: 2.8, seed: 47 },
  { x: 0.5, z: -31.0, r: 4.2, layers: 6, lh: 1.1, rot: 1.3, seed: 53 },
  { x: -34.0, z: -14.0, r: 3.2, layers: 5, lh: 0.9, rot: 0.7, seed: 59 },
];

function Outcrops() {
  const mat = useGroundMaterial();
  const items = useMemo(
    () =>
      OUTCROPS.map((o) => {
        // sit on the lowest ground under the footprint so nothing floats
        let minY = Infinity;
        for (let a = 0; a < 8; a++) minY = Math.min(minY, groundY(o.x + Math.cos(a) * o.r, o.z + Math.sin(a) * o.r));
        minY = Math.min(minY, groundY(o.x, o.z));
        return { ...o, y: minY, geo: slabOutcrop(o.seed, o.r, o.layers, o.lh) };
      }),
    [],
  );
  return (
    <group>
      {items.map((o, i) => (
        <mesh key={i} geometry={o.geo} material={mat} position={[o.x, o.y, o.z]} rotation={[0, o.rot, 0]} castShadow receiveShadow />
      ))}
    </group>
  );
}

/* ------------------------------- Boulders & cobbles ------------------------------- */

/** Angular boulder: a rounded blob cut by random fracture planes, then softly eroded. */
function boulderGeometry(seed: number, detail: number, flat = 0.62, cuts = 9) {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const r = rng(seed * 13 + 1);
  const planes: { n: THREE.Vector3; d: number }[] = [];
  for (let i = 0; i < cuts; i++) {
    const n = new THREE.Vector3(r() - 0.5, (r() - 0.5) * 0.9, r() - 0.5).normalize();
    planes.push({ n, d: 0.62 + r() * 0.3 });
  }
  const v = new THREE.Vector3();
  const k = seed * 1.37;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.multiplyScalar(1 + Math.sin(v.x * 2.1 + k) * 0.08 + Math.sin(v.z * 2.7 - k) * 0.07 + Math.sin(v.y * 3.3 + k * 2) * 0.05);
    for (const pl of planes) {
      const dd = v.dot(pl.n) - pl.d;
      if (dd > 0) v.addScaledVector(pl.n, -dd * 0.92);
    }
    v.x += Math.sin((v.y + v.z) * 9.7 + k) * 0.012;
    v.z += Math.sin((v.x - v.y) * 8.3 - k) * 0.012;
    v.y *= flat;
    if (v.y < -0.22) v.y = -0.22 + (v.y + 0.22) * 0.3;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  boxProjectUVs(g, 0.42);
  return g;
}

interface Placed {
  m: THREE.Matrix4;
  c?: THREE.Color;
}

function useInstanced(ref: React.RefObject<THREE.InstancedMesh>, items: Placed[]) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((it, i) => {
      mesh.setMatrixAt(i, it.m);
      if (it.c) mesh.setColorAt(i, it.c);
    });
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [ref, items]);
}

let rockMatCache: THREE.MeshStandardMaterial | null = null;
function useRockMaterial() {
  return useMemo(() => {
    if (rockMatCache) return rockMatCache;
    const st = rockTex();
    rockMatCache = new THREE.MeshStandardMaterial({
      map: st.map,
      normalMap: st.normalMap,
      roughnessMap: st.roughnessMap,
      roughness: 1,
      normalScale: new THREE.Vector2(0.75, 0.75),
    });
    return rockMatCache;
  }, []);
}

function Boulders({ quality }: { quality: Quality }) {
  const mat = useRockMaterial();
  const refA = useRef<THREE.InstancedMesh>(null);
  const refB = useRef<THREE.InstancedMesh>(null);
  const detail = quality === 'low' ? 2 : 3;
  const geoA = useMemo(() => boulderGeometry(5, detail, 0.62), [detail]);
  const geoB = useMemo(() => boulderGeometry(9, detail, 0.8, 11), [detail]);
  const [a, b] = useMemo(() => {
    const r = rng(404);
    const outA: Placed[] = [];
    const outB: Placed[] = [];
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const place = (x: number, z: number, s: number) => {
      const y = groundY(x, z);
      e.set((r() - 0.5) * 0.25, r() * Math.PI * 2, (r() - 0.5) * 0.25);
      q.setFromEuler(e);
      const sc = new THREE.Vector3(s * (0.8 + r() * 0.5), s * (0.75 + r() * 0.5), s * (0.8 + r() * 0.5));
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y - s * 0.12, z), q, sc);
      (r() < 0.5 ? outA : outB).push({ m });
    };
    const target = quality === 'low' ? 70 : quality === 'medium' ? 120 : 170;
    let guard = 0;
    while (outA.length + outB.length < target && guard++ < 6000) {
      const zone = r();
      let x = 0;
      let z = 0;
      let s = 0.4;
      if (zone < 0.32) {
        // hill toe
        x = -40 + r() * 80;
        z = -27 + r() * 9;
        s = 0.35 + Math.pow(r(), 2) * 1.6;
      } else if (zone < 0.62) {
        // wadi banks and bed
        x = -45 + r() * 90;
        z = -30 + r() * 70;
        const w = wadiAt(x, z);
        if (w.d > w.halfW + w.bank * 1.3) continue;
        s = w.d < w.halfW ? 0.18 + Math.pow(r(), 3) * 0.7 : 0.25 + Math.pow(r(), 2) * 0.9;
      } else if (zone < 0.8) {
        // around the site margins
        x = SITE.x0 - 8 + r() * (SITE.x1 - SITE.x0 + 16);
        z = SITE.z0 - 4 + r() * (SITE.z1 - SITE.z0 + 8);
        const inside = x > SITE.x0 + 4 && x < SITE.x1 - 4 && z > SITE.z0 + 3 && z < SITE.z1 - 3;
        if (inside && r() < 0.85) continue;
        s = 0.15 + Math.pow(r(), 2) * 0.55;
      } else {
        // far bank + side slopes
        x = -60 + r() * 120;
        z = 24 + r() * 26;
        s = 0.3 + Math.pow(r(), 2) * 1.2;
      }
      if (isBlocked(x, z, 0.8) || pathMask(x, z) > 0.05 || meadowMask(x, z) > 0.5) continue;
      place(x, z, s);
    }
    return [outA, outB];
  }, [quality]);
  useInstanced(refA, a);
  useInstanced(refB, b);
  return (
    <group>
      <instancedMesh ref={refA} args={[geoA, mat, Math.max(1, a.length)]} castShadow receiveShadow />
      <instancedMesh ref={refB} args={[geoB, mat, Math.max(1, b.length)]} castShadow receiveShadow />
    </group>
  );
}

/** Rounded river cobbles strewn along the wadi bed. */
function Cobbles({ quality }: { quality: Quality }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => boulderGeometry(13, 1, 0.5, 4), []);
  const mat = useMemo(() => {
    const set = gravel();
    return new THREE.MeshStandardMaterial({ normalMap: set.normalMap, roughness: 0.82, normalScale: new THREE.Vector2(0.5, 0.5) });
  }, []);
  const items = useMemo(() => {
    const r = rng(77);
    const pal = ['#C9C1B2', '#B9AE98', '#9A9C8A', '#7C776D', '#B08A6A', '#DCD5C6', '#A49784'].map((c) => new THREE.Color(c));
    const out: Placed[] = [];
    const n = quality === 'low' ? 320 : quality === 'medium' ? 620 : 950;
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    let guard = 0;
    while (out.length < n && guard++ < n * 12) {
      const x = -55 + r() * 110;
      const z = -40 + r() * 76;
      const w = wadiAt(x, z);
      if (w.d > w.halfW + 0.8) continue;
      // clustered in braided bars
      const bar = noise2(x * 0.22, z * 0.22) * 0.5 + 0.5;
      if (r() > bar * 1.3) continue;
      const s = 0.05 + Math.pow(r(), 2.2) * 0.28;
      e.set((r() - 0.5) * 0.4, r() * 6.28, (r() - 0.5) * 0.4);
      q.setFromEuler(e);
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, groundY(x, z) + s * 0.08, z),
        q,
        new THREE.Vector3(s * (1 + r() * 0.5), s, s * (0.8 + r() * 0.4)),
      );
      out.push({ m, c: pal[Math.floor(r() * pal.length)].clone().offsetHSL(0, 0, (r() - 0.5) * 0.08) });
    }
    return out;
  }, [quality]);
  useInstanced(ref, items);
  return <instancedMesh ref={ref} args={[geo, mat, Math.max(1, items.length)]} receiveShadow />;
}

/** Pale stones edging every footpath, and flat stepping stones fording the wadi. */
function PathStones({ quality }: { quality: Quality }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => boulderGeometry(21, 1, 0.42, 5), []);
  const mat = useMemo(() => {
    const set = gravel();
    return new THREE.MeshStandardMaterial({ normalMap: set.normalMap, roughness: 0.88, normalScale: new THREE.Vector2(0.6, 0.6) });
  }, []);
  const items = useMemo(() => {
    const r = rng(303);
    const out: Placed[] = [];
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const pal = ['#CFC3AE', '#BDB09A', '#C9BBA2', '#B3A58E', '#D8CDB8', '#A99A84'].map((c) => new THREE.Color(c));
    const step = quality === 'low' ? 0.55 : 0.34;
    PATHS.forEach((path, pi) => {
      const curve = new THREE.CatmullRomCurve3(path.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
      const len = curve.getLength();
      const n = Math.floor(len / step);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const p = curve.getPointAt(t);
        const tg = curve.getTangentAt(t);
        for (const side of [-1, 1]) {
          if (r() < 0.22) continue;
          const off = 0.9 + (r() - 0.5) * 0.14;
          const x = p.x - tg.z * off * side;
          const z = p.z + tg.x * off * side;
          // skip stones that would sit inside another path (junctions) or under buildings
          if (pathMask(x, z) > 0.55 || isBlocked(x, z, -0.2)) continue;
          if (pi === 0 && z > 11.5) continue;
          const s = 0.06 + r() * 0.07;
          e.set((r() - 0.5) * 0.2, r() * 6.28, (r() - 0.5) * 0.2);
          q.setFromEuler(e);
          out.push({
            m: new THREE.Matrix4().compose(new THREE.Vector3(x, groundY(x, z) + s * 0.05, z), q, new THREE.Vector3(s * 1.5, s, s * 1.15)),
            c: pal[Math.floor(r() * pal.length)].clone(),
          });
        }
      }
    });
    // stepping stones across the wadi, continuing the arrival path
    for (let i = 0; i < 9; i++) {
      const z = 12.2 + i * 0.78;
      const x = 3.7 + Math.sin(i * 1.3) * 0.25 + (r() - 0.5) * 0.15;
      const s = 0.36 + r() * 0.08;
      e.set(0, r() * 6.28, 0);
      q.setFromEuler(e);
      out.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(x, groundY(x, z) + 0.03, z), q, new THREE.Vector3(s * 1.2, 0.32, s)), c: pal[Math.floor(r() * pal.length)].clone() });
    }
    return out;
  }, [quality]);
  useInstanced(ref, items);
  return <instancedMesh ref={ref} args={[geo, mat, Math.max(1, items.length)]} castShadow receiveShadow />;
}

/* ---------------------------------- Dry grass ---------------------------------- */

function tuftGeometry(blades: number, h: number, seed: number) {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < blades; i++) {
    const g = new THREE.PlaneGeometry(0.03, h * (0.6 + r() * 0.5), 1, 3);
    const p = g.attributes.position as THREE.BufferAttribute;
    const hh = h * 0.55;
    for (let k = 0; k < p.count; k++) {
      const y = p.getY(k) + hh;
      const t = y / (h * 1.1);
      p.setY(k, y);
      p.setX(k, p.getX(k) * (1 - t * 0.9));
      p.setZ(k, t * t * h * 0.5);
    }
    g.rotateX(-0.12);
    g.rotateY((i / blades) * Math.PI * 2 + r() * 0.6);
    g.rotateZ((r() - 0.5) * 0.5);
    g.deleteAttribute('uv');
    parts.push(g);
  }
  const m = mergeGeometries(parts, false);
  m.computeVertexNormals();
  return m;
}

function DryGrass({ quality }: { quality: Quality }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => tuftGeometry(quality === 'low' ? 6 : 9, 0.42, 5), [quality]);
  const mat = useMemo(
    () => applyWind(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.92 }), { sway: 0.3, stiffness: 2.2, speed: 1.5 }),
    [],
  );
  const items = useMemo(() => {
    const r = rng(9);
    const out: Placed[] = [];
    const n = quality === 'low' ? 260 : quality === 'medium' ? 520 : 900;
    const cols = ['#A39A62', '#B4A574', '#8F8A55', '#C2B184', '#7F8150'].map((c) => new THREE.Color(c));
    const o = new THREE.Object3D();
    let guard = 0;
    while (out.length < n && guard++ < n * 10) {
      const x = -48 + r() * 96;
      const z = -26 + r() * 62;
      if (isBlocked(x, z, 0.3) || pathMask(x, z) > 0.1) continue;
      const w = wadiAt(x, z);
      if (w.d < w.halfW * 0.7) continue;
      // grass clumps along margins, banks and the hill toe; sparse on the working terrace
      const margin = x < SITE.x0 + 3 || x > SITE.x1 - 3 || z < SITE.z0 + 3 || z > SITE.z1 - 2 || w.d < w.halfW + w.bank + 3;
      if (!margin && r() < 0.75) continue;
      const clump = noise2(x * 0.3 + 4, z * 0.3) * 0.5 + 0.5;
      if (r() > clump * 1.4) continue;
      o.position.set(x, groundY(x, z) - 0.02, z);
      o.rotation.set(0, r() * 6.28, 0);
      o.scale.setScalar(0.7 + r() * 0.9);
      o.updateMatrix();
      out.push({ m: o.matrix.clone(), c: cols[Math.floor(r() * cols.length)].clone().offsetHSL(0, 0, (r() - 0.5) * 0.08) });
    }
    return out;
  }, [quality]);
  useInstanced(ref, items);
  return <instancedMesh ref={ref} args={[geo, mat, Math.max(1, items.length)]} castShadow receiveShadow frustumCulled={false} />;
}

export const Terrain = memo(function Terrain({ quality, variant, sun }: { quality: Quality; variant: Variant; sun: Pick<SunPreset, 'elevation' | 'azimuth'> }) {
  return (
    <group>
      <GroundMesh quality={quality} />
      <Ranges variant={variant} sun={sun} />
      <Outcrops />
      <Boulders quality={quality} />
      <Cobbles quality={quality} />
      <PathStones quality={quality} />
      <DryGrass quality={quality} />
    </group>
  );
});

export { SUN_PRESETS, smoothstep };
