import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { makeNoise } from '../../materials/noise';
import { getTexSet } from '../../materials/textures';
import type { Quality, Variant } from '../../core/types';
import { BW_HALF, breakwaterDist, gradedAxis, gridGeometry, groundHeight, shoreDist } from './layout';
import { causticTexture } from './textures';
import { WATER_TIME } from './Water';

/* ------------------------------------------------------------------ */
/*  Ground: pale Gulf beach with a wet swash band and wrack line,      */
/*  packed harbour yard, sandy sea floor with sunlit caustics seen     */
/*  through the clear shallows, dunes inland — and the Hajar           */
/*  mountains rising across the bay, hazed by distance.               */
/* ------------------------------------------------------------------ */

const nz = makeNoise(5);
const P = 4096;

const SAND_TINT: Record<Variant, string> = { morning: '#FFFFFF', golden: '#FFF6EA', dusk: '#F6EEF0' };

function groundMaterial(variant: Variant) {
  const sand = getTexSet('sand', { base: '#CDB389', light: '#E0C9A0', seed: 21 });
  const caustic = causticTexture();
  const mat = new THREE.MeshStandardMaterial({ color: SAND_TINT[variant], roughness: 1, metalness: 0 });
  const uniforms = {
    uHbTime: WATER_TIME,
    uSand: { value: sand.map },
    uSandN: { value: sand.normalMap },
    uCaustic: { value: caustic },
  };
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aMask;\nvarying float vYard;\nvarying float vRock;\nvarying float vDune;\nvarying vec3 vTW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvYard = aMask.x;\nvRock = aMask.y;\nvDune = aMask.z;\nvTW = (modelMatrix * vec4(position, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uHbTime;
         uniform sampler2D uSand;
         uniform sampler2D uSandN;
         uniform sampler2D uCaustic;
         varying float vYard;
         varying float vRock;
         varying float vDune;
         varying vec3 vTW;
         float hbCaust = 0.0;`,
      )
      .replace(
        '#include <map_fragment>',
        `vec2 tw = vTW.xz;
         float th = vTW.y;
         vec3 sA = texture2D(uSand, tw * 0.13).rgb;
         vec3 sB = texture2D(uSand, tw * 0.027 + 0.37).rgb;
         vec3 sC = texture2D(uSand, vec2(tw.y, -tw.x) * 0.061 + 0.53).rgb;
         vec3 sandC = (sA * 0.3 + sB * 0.35 + sC * 0.35);
         vec3 yardC = sandC * mix(vec3(0.88, 0.85, 0.79), vec3(0.95, 0.93, 0.88), texture2D(uSand, tw * 0.011 + 0.71).g);
         vec3 gcol = mix(sandC, yardC, vYard);
         float macro = texture2D(uSand, tw * 0.0061 + 0.11).r;
         gcol *= 0.9 + macro * 0.2;
         // inland dunes: warmer, more ochre sand with wind-darkened crests
         gcol = mix(gcol, gcol * vec3(1.0, 0.9, 0.74), vDune * (0.55 + 0.25 * macro));
         // rubble core of the breakwater between the armour rocks
         vec3 rubble = vec3(0.4, 0.37, 0.32) * (0.75 + 0.5 * sB.r);
         gcol = mix(gcol, rubble, vRock);
         // wet swash band + wrack line of dried weed and shells
         float wet = 1.0 - smoothstep(0.06, 0.42, th);
         float wrackN = texture2D(uSand, tw * 0.5).g;
         float wrack = (1.0 - smoothstep(0.0, 0.07, abs(th - 0.55 - (wrackN - 0.5) * 0.12))) * step(0.45, wrackN);
         gcol = mix(gcol, gcol * vec3(0.62, 0.6, 0.55), wet * 0.85);
         gcol = mix(gcol, vec3(0.42, 0.36, 0.27), wrack * 0.55);
         // under water: blue-green absorption and caustics
         float depth = max(-th, 0.0);
         float uw = smoothstep(0.02, -0.25, th);
         gcol *= mix(vec3(1.0), vec3(0.6, 0.84, 0.82), uw * clamp(0.25 + depth * 0.3, 0.0, 1.0));
         gcol *= mix(1.0, exp(-depth * 0.12), uw);
         float c1 = texture2D(uCaustic, tw * 0.16 + uHbTime * vec2(0.021, 0.013)).r;
         float c2 = texture2D(uCaustic, tw * 0.125 + vec2(0.43, 0.17) - uHbTime * vec2(0.015, -0.019)).r;
         hbCaust = min(c1, c2) * uw * exp(-depth * 0.28);
         diffuseColor.rgb *= gcol;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `float roughnessFactor = mix(0.97, 0.42, wet * (1.0 - uw));`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `vec3 nmS = texture2D(uSandN, tw * 0.13).xyz * 2.0 - 1.0;
         vec3 nmS2 = texture2D(uSandN, tw * 0.047 + 0.31).xyz * 2.0 - 1.0;
         // dry sand: soft wind ripples; damp swash zone: firmer, crisper ripples
         vec2 nmSand = mix(nmS.xy * 0.22 + nmS2.xy * 0.18, nmS.xy * 0.55, wet);
         vec2 nmv = mix(nmSand, nmS2.xy * 0.12, vYard);
         vec3 hbTv = normalize((viewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
         vec3 hbBv = normalize((viewMatrix * vec4(0.0, 0.0, -1.0, 0.0)).xyz);
         normal = normalize(normal + hbTv * nmv.x + hbBv * nmv.y);`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
         reflectedLight.directDiffuse *= 1.0 + hbCaust * 3.2;`,
      );
  };
  mat.customProgramCacheKey = () => 'hb-ground-1';
  return mat;
}

function Ground({ quality, variant }: { quality: Quality; variant: Variant }) {
  const geo = useMemo(() => {
    const step = quality === 'low' ? 1.4 : quality === 'medium' ? 1.1 : 0.9;
    const xs = gradedAxis(-900, 900, -85, 80, step, 1.14);
    const zs = gradedAxis(-500, 900, -70, 45, step, 1.14);
    const g = gridGeometry(xs, zs);
    const p = g.attributes.position as THREE.BufferAttribute;
    const mask = new Float32Array(p.count * 3);
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const d = shoreDist(x, z);
      p.setY(i, groundHeight(x, z));
      const n = nz(x * 0.09, z * 0.09, P, P) * 3;
      mask[i * 3] = THREE.MathUtils.smoothstep(d + n, 9, 17) * 0.7;
      mask[i * 3 + 2] = THREE.MathUtils.smoothstep(d + n * 2, 26, 70);
      if (x > -66 && x < 40 && z > -72 && z < 16) {
        const bw = breakwaterDist(x, z);
        mask[i * 3 + 1] = (1 - THREE.MathUtils.smoothstep(bw.d, BW_HALF + 1.2, BW_HALF + 3.4)) * THREE.MathUtils.smoothstep(bw.t, 0.02, 0.07);
      }
      uv[i * 2] = x * 0.1;
      uv[i * 2 + 1] = z * 0.1;
    }
    g.setAttribute('aMask', new THREE.BufferAttribute(mask, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  }, [quality]);
  const mat = useMemo(() => groundMaterial(variant), [variant]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={mat} receiveShadow userData={{ noBatch: true }} />;
}

/* ------------------------------- Mountains ------------------------------- */

const HAZE: Record<Variant, { haze: string; rock: string; rock2: string; amount: number }> = {
  morning: { haze: '#B2C6D4', rock: '#75695B', rock2: '#958670', amount: 0.34 },
  golden: { haze: '#E6C8A4', rock: '#8A6F58', rock2: '#AE8A66', amount: 0.46 },
  dusk: { haze: '#C4978E', rock: '#5E4A4C', rock2: '#7A5D58', amount: 0.42 },
};

/** Polar heightfield band of ridged peaks with a beach strip where it meets the sea. */
function mountainGeometry(a0: number, a1: number, r0: (a: number) => number, depthBand: number, peak: (a: number) => number, seed: number, segA: number, segR: number) {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const n = makeNoise(seed);
  const sandC = new THREE.Color('#D2BE98');
  const rockA = new THREE.Color('#FFFFFF');
  for (let j = 0; j <= segR; j++) {
    const v = j / segR;
    for (let i = 0; i <= segA; i++) {
      const u = i / segA;
      const a = a0 + (a1 - a0) * u;
      const R = r0(a) + v * depthBand;
      const x = Math.cos(a) * R;
      const z = Math.sin(a) * R;
      const pk = peak(a);
      // ridged fBm: sharp crests, gullies running down-slope
      let ridge = 0;
      let amp = 0.55;
      let f = 1;
      for (let o = 0; o < 4; o++) {
        const rr = 1 - Math.abs(n(a * 7 * f + 3.1 + o * 17, v * 1.6 * f + 1.7, P, P));
        ridge += rr * rr * amp;
        amp *= 0.5;
        f *= 2.1;
      }
      const gully = Math.abs(n(a * 60 + 9, v * 0.8, P, P)) * 0.18;
      const prof = Math.sin(Math.min(1, v * 1.35) * Math.PI) ** 0.7;
      let h = pk * prof * (0.25 + 1.1 * ridge - gully);
      // foothills ramp up from a narrow coastal plain
      const coast = THREE.MathUtils.smoothstep(v, 0.0, 0.1);
      h = h * coast + (1 - coast) * (v * 16 - 1.5);
      pos.push(x, h, z);
      const t = THREE.MathUtils.smoothstep(h, 2, 14);
      const c = sandC.clone().lerp(rockA, t);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let j = 0; j < segR; j++)
    for (let i = 0; i < segA; i++) {
      const a = j * (segA + 1) + i;
      const b = a + 1;
      const c = a + segA + 1;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function mountainMaterial(variant: Variant) {
  const h = HAZE[variant];
  const mat = new THREE.MeshStandardMaterial({ color: h.rock, vertexColors: true, roughness: 1, metalness: 0, fog: false, side: THREE.FrontSide });
  const rock2 = new THREE.Color(h.rock2);
  const haze = new THREE.Color(h.haze);
  mat.onBeforeCompile = (s) => {
    s.uniforms.uHaze = { value: haze };
    s.uniforms.uRock2 = { value: rock2 };
    s.uniforms.uHazeAmt = { value: h.amount };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMW = (modelMatrix * vec4(position, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uHaze;\nuniform vec3 uRock2;\nuniform float uHazeAmt;\nvarying vec3 vMW;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float strata = sin(vMW.y * 0.21 + sin(vMW.x * 0.021 + vMW.z * 0.017) * 2.0) * 0.5 + 0.5;
         diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uRock2 / max(diffuse, vec3(0.01)), strata * 0.18 + 0.2);`,
      )
      .replace(
        '#include <opaque_fragment>',
        `float hz = clamp(uHazeAmt + 0.18 * smoothstep(500.0, 1300.0, length(vMW.xz - cameraPosition.xz)) + (1.0 - smoothstep(0.0, 70.0, vMW.y)) * 0.12, 0.0, 0.9);
         outgoingLight = mix(outgoingLight, uHaze, hz);
         #include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => 'hb-mtn-1';
  return mat;
}

function Mountains({ variant, quality }: { variant: Variant; quality: Quality }) {
  const geos = useMemo(() => {
    const segA = quality === 'low' ? 140 : 260;
    const segR = quality === 'low' ? 16 : 28;
    const d = THREE.MathUtils.degToRad;
    // Across the bay (west / north-west): a long mountainous headland ending before the open sea
    const bay = mountainGeometry(
      d(150),
      d(236),
      (a) => 600 + Math.max(0, Math.cos(a - d(200))) * 110,
      400,
      (a) => 78 * THREE.MathUtils.smoothstep(a, d(150), d(178)) * (1 - THREE.MathUtils.smoothstep(a, d(208), d(236))) + 10,
      9,
      segA,
      segR,
    );
    // Inland range behind the coast
    const inland = mountainGeometry(d(8), d(152), () => 780, 420, (a) => 85 + 60 * Math.sin((a - d(8)) * 1.4) ** 2, 4, segA, segR);
    return [bay, inland];
  }, [quality]);
  const mat = useMemo(() => mountainMaterial(variant), [variant]);
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);
  return (
    <group>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} material={mat} receiveShadow={false} castShadow={false} userData={{ noBatch: true }} />
      ))}
    </group>
  );
}

export function Terrain({ quality, variant }: { quality: Quality; variant: Variant }) {
  return (
    <group>
      <Ground quality={quality} variant={variant} />
      <Mountains quality={quality} variant={variant} />
    </group>
  );
}
