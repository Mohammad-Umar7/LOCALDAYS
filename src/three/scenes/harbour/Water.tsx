import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { getTexSet } from '../../materials/textures';
import type { Quality, Variant } from '../../core/types';
import { BOAT_POSES, DHOW_POSE, gradedAxis, gridGeometry, groundHeight, jettyPiles, shelterAt } from './layout';
import { foamTexture } from './textures';
import { WAVE_GLSL, waveUniforms } from './waves';
import { REFLECTION } from './Reflections';

/* ------------------------------------------------------------------ */
/*  Harbour water. A graded grid (fine in the basin, coarse to the     */
/*  horizon) displaced by the Gerstner spectrum, shaded by a patched   */
/*  MeshPhysicalMaterial: sky/env fresnel reflection, sun glints that  */
/*  bloom, depth-based teal→turquoise tint, clear shallows over the    */
/*  sand (premultiplied "over" blend keeps reflections at full         */
/*  strength), shoreline + piling + hull foam and back-lit crest glow. */
/* ------------------------------------------------------------------ */

const CORE = { x0: -80, x1: 75, z0: -110, z1: 14 };

export const WATER_TIME = { value: 0 };

const PALETTE: Record<Variant, { deep: string; shallow: string; scatter: string; env: number; detail: number; sparkle: number }> = {
  morning: { deep: '#052F3B', shallow: '#1A8E88', scatter: '#2FC4B0', env: 1.0, detail: 0.55, sparkle: 7 },
  golden: { deep: '#062C36', shallow: '#22887A', scatter: '#58D2A8', env: 1.0, detail: 0.6, sparkle: 12 },
  dusk: { deep: '#071E2C', shallow: '#1A6466', scatter: '#E08A50', env: 1.05, detail: 0.5, sparkle: 3 },
};

function buildGeometry(quality: Quality) {
  const step = quality === 'low' ? 1.3 : quality === 'medium' ? 1.0 : 0.8;
  const xs = gradedAxis(-1700, 1700, CORE.x0, CORE.x1, step, 1.14);
  const zs = gradedAxis(-1700, 40, CORE.z0, CORE.z1, step, 1.14);
  const g = gridGeometry(xs, zs);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const n = pos.count;
  const depth = new Float32Array(n);
  const shelter = new Float32Array(n);
  const core = new Float32Array(n);
  const normal = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    depth[i] = THREE.MathUtils.clamp(-groundHeight(x, z), -3, 60);
    shelter[i] = shelterAt(x, z);
    const dx = Math.max(CORE.x0 - x, 0, x - CORE.x1);
    const dz = Math.max(CORE.z0 - z, 0, z - CORE.z1);
    core[i] = Math.hypot(dx, dz);
    normal[i * 3 + 1] = 1;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  g.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));
  g.setAttribute('aShelter', new THREE.BufferAttribute(shelter, 1));
  g.setAttribute('aCore', new THREE.BufferAttribute(core, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -400), 2600);
  return g;
}

function createWaterMaterial(variant: Variant, sunDir: THREE.Vector3, sunColor: string, lamps: [number, number, number][]) {
  const pal = PALETTE[variant];
  const nrm = getTexSet('waterNormal').normalMap!;
  const foam = foamTexture();
  const piles = jettyPiles();
  const pileBox = new THREE.Vector4(Infinity, Infinity, -Infinity, -Infinity);
  piles.forEach((p) => {
    pileBox.x = Math.min(pileBox.x, p[0] - 1.5);
    pileBox.y = Math.min(pileBox.y, p[1] - 1.5);
    pileBox.z = Math.max(pileBox.z, p[0] + 1.5);
    pileBox.w = Math.max(pileBox.w, p[1] + 1.5);
  });
  const hulls = [
    { x: DHOW_POSE.x, z: DHOW_POSE.z, yaw: DHOW_POSE.yaw, a: 2.05, b: 7.1 },
    ...BOAT_POSES.map((b) => ({ x: b.x, z: b.z, yaw: b.yaw, a: 1.1, b: 3.55 })),
  ];

  const uniforms = {
    ...waveUniforms(),
    uHbTime: WATER_TIME,
    uNormalTex: { value: nrm },
    uFoamTex: { value: foam },
    uDeep: { value: new THREE.Color(pal.deep) },
    uShallow: { value: new THREE.Color(pal.shallow) },
    uScatter: { value: new THREE.Color(pal.scatter) },
    uSunDir: { value: sunDir.clone().normalize() },
    uSunColor: { value: new THREE.Color(sunColor) },
    uDetail: { value: pal.detail },
    uSparkle: { value: pal.sparkle },
    uPiles: { value: piles.map((p) => new THREE.Vector3(p[0], p[1], p[2])) },
    uPileBox: { value: pileBox },
    uHulls: { value: hulls.map((h) => new THREE.Vector4(h.x, h.z, Math.cos(h.yaw), Math.sin(h.yaw))) },
    uHullSize: { value: hulls.map((h) => new THREE.Vector2(h.a, h.b)) },
    uLamps: { value: Array.from({ length: 8 }, (_, i) => (lamps[i] ? new THREE.Vector4(lamps[i][0], lamps[i][1], lamps[i][2], 1) : new THREE.Vector4(0, -100, 0, 0))) },
    uLampColor: { value: new THREE.Color('#FFB066').multiplyScalar(lamps.length ? 1 : 0) },
    ...REFLECTION,
  };

  const mat = new THREE.MeshPhysicalMaterial({
    color: pal.deep,
    roughness: 0.05,
    metalness: 0,
    ior: 1.333,
    specularIntensity: 1,
    envMapIntensity: pal.env,
    transparent: true,
    depthWrite: true,
  });
  // Premultiplied "over": body colour is blended by depth, reflections stay additive.
  mat.blending = THREE.CustomBlending;
  mat.blendSrc = THREE.OneFactor;
  mat.blendDst = THREE.OneMinusSrcAlphaFactor;
  mat.blendSrcAlpha = THREE.OneFactor;
  mat.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  mat.defines = { PILE_COUNT: piles.length, HULL_COUNT: hulls.length };

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute float aDepth;
         attribute float aShelter;
         attribute float aCore;
         varying vec3 vHbW;
         varying vec3 vHbN;
         varying float vHbDepth;
         varying float vHbShelter;
         ${WAVE_GLSL}`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `vec3 hbDisp;
         vec3 hbNrm;
         vec3 hbW0 = (modelMatrix * vec4(position, 1.0)).xyz;
         hbWaves(hbW0.xz, aShelter, aCore, hbDisp, hbNrm);
         vec3 objectNormal = hbNrm;
         #ifdef USE_TANGENT
           vec3 objectTangent = vec3( tangent.xyz );
         #endif`,
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position) + hbDisp;
         vHbW = hbW0 + hbDisp;
         vHbN = hbNrm;
         vHbDepth = aDepth;
         vHbShelter = aShelter;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uHbTime;
         uniform sampler2D uNormalTex;
         uniform sampler2D uFoamTex;
         uniform vec3 uDeep;
         uniform vec3 uShallow;
         uniform vec3 uScatter;
         uniform vec3 uSunDir;
         uniform vec3 uSunColor;
         uniform float uDetail;
         uniform float uSparkle;
         uniform vec3 uPiles[PILE_COUNT];
         uniform vec4 uPileBox;
         uniform vec4 uHulls[HULL_COUNT];
         uniform vec2 uHullSize[HULL_COUNT];
         uniform vec4 uLamps[8];
         uniform vec3 uLampColor;
         uniform sampler2D uReflTex;
         uniform mat4 uReflMatrix;
         uniform float uReflOn;
         uniform float uReflGain;
         varying vec3 vHbW;
         varying vec3 vHbN;
         varying float vHbDepth;
         varying float vHbShelter;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `vec3 hbV = normalize(cameraPosition - vHbW);
         float hbDist = length(cameraPosition - vHbW);
         float hbNear = 1.0 - smoothstep(25.0, 300.0, hbDist);
         vec2 hbP = vHbW.xz;

         // --- detail normals: three scrolling octaves of the tileable water normal map
         vec3 hbT1 = texture2D(uNormalTex, hbP * 0.045 + uHbTime * vec2(0.012, 0.019)).xyz * 2.0 - 1.0;
         vec3 hbT2 = texture2D(uNormalTex, hbP * 0.11 + uHbTime * vec2(-0.021, 0.008)).xyz * 2.0 - 1.0;
         vec3 hbT3 = texture2D(uNormalTex, hbP * 0.31 + uHbTime * vec2(0.027, -0.031)).xyz * 2.0 - 1.0;
         vec2 hbSl = hbT1.xy * 0.5 + hbT2.xy * 0.42 + hbT3.xy * 0.32 * hbNear;
         hbSl *= uDetail * mix(0.4, 1.0, hbNear) * mix(0.6, 1.0, vHbShelter) * mix(0.7, 1.0, smoothstep(6.0, 30.0, hbDist));
         vec3 hbNW = normalize(vec3(vHbN.x + hbSl.x, vHbN.y, vHbN.z + hbSl.y));
         normal = normalize((viewMatrix * vec4(hbNW, 0.0)).xyz);

         // --- water column, colour and clarity
         float hbDepth = max(vHbDepth + vHbW.y, 0.0);
         float hbAbs = 1.0 - exp(-hbDepth * 0.42);
         vec3 hbBody = mix(uShallow, uDeep, hbAbs);
         float hbAlpha = 1.0 - exp(-hbDepth * 0.95);
         hbAlpha = mix(hbAlpha, 1.0, smoothstep(70.0, 380.0, hbDist));

         // --- foam: shoreline swash, pilings, hulls
         float hbF1 = texture2D(uFoamTex, hbP * 0.16 + vec2(uHbTime * 0.012, -uHbTime * 0.008)).r;
         float hbF2 = texture2D(uFoamTex, hbP * 0.41 - vec2(uHbTime * 0.017, uHbTime * 0.011)).r;
         float hbFN = hbF1 * 0.6 + hbF2 * 0.4;
         float hbShore = 1.0 - smoothstep(0.03, 0.55, hbDepth);
         float hbSurge = sin(hbDepth * 12.0 - uHbTime * 1.6 + hbFN * 2.5) * 0.5 + 0.5;
         float hbFoam = hbShore * smoothstep(0.3, 0.8, hbFN * (0.5 + hbSurge * 0.75));
         hbFoam += (1.0 - smoothstep(0.0, 0.08, hbDepth)) * 0.6 * hbFN;
         if (hbP.x > uPileBox.x && hbP.y > uPileBox.y && hbP.x < uPileBox.z && hbP.y < uPileBox.w) {
           float hbPd = 9.0;
           for (int i = 0; i < PILE_COUNT; i++) {
             vec3 pl = uPiles[i];
             hbPd = min(hbPd, length(hbP - pl.xy) - pl.z);
           }
           hbFoam += (1.0 - smoothstep(0.0, 0.5, hbPd)) * smoothstep(0.25, 0.7, hbFN + 0.2) * 0.85;
         }
         for (int i = 0; i < HULL_COUNT; i++) {
           vec4 hh = uHulls[i];
           vec2 hs = uHullSize[i];
           vec2 hd = hbP - hh.xy;
           vec2 hl = vec2(hd.x * hh.z - hd.y * hh.w, hd.x * hh.w + hd.y * hh.z);
           float he = (length(hl / hs) - 1.0) * min(hs.x, hs.y);
           hbFoam += (1.0 - smoothstep(0.0, 0.6, he)) * smoothstep(-0.25, 0.0, he) * smoothstep(0.3, 0.8, hbFN + 0.1) * 0.7;
         }
         hbFoam = clamp(hbFoam, 0.0, 1.0);

         diffuseColor.rgb = mix(hbBody, vec3(0.9, 0.94, 0.94), hbFoam);
         hbAlpha = max(hbAlpha, hbFoam * 0.92);
         roughnessFactor = mix(mix(0.03, 0.14, smoothstep(40.0, 700.0, hbDist)), 0.7, hbFoam);

         // --- back-lit crest glow (light scattering through thin wave tops)
         float hbSss = pow(max(dot(hbV, -normalize(uSunDir)), 0.0), 4.0) * smoothstep(-0.04, 0.14, vHbW.y);
         totalEmissiveRadiance += uScatter * uSunColor * hbSss * (1.0 - hbFoam) * 0.35;

         // --- sun sparkle: twinkling facets in the broad lobe around the sun's mirror direction
         vec3 hbGlint = vec3(0.0);
         {
           vec3 hbRs = reflect(-hbV, hbNW);
           float hbLobe = pow(max(dot(hbRs, normalize(uSunDir)), 0.0), 4.0);
           float hbTw = texture2D(uFoamTex, hbP * 0.93 + vec2(uHbTime * 0.031, -uHbTime * 0.023)).r * texture2D(uFoamTex, hbP * 1.37 - vec2(uHbTime * 0.021, uHbTime * 0.037)).r;
           float hbSpk = smoothstep(0.5, 0.72, hbTw) * hbLobe * smoothstep(14.0, 40.0, hbDist) * (1.0 - smoothstep(60.0, 190.0, hbDist)) * (1.0 - hbFoam) * step(0.0, uSunDir.y);
           hbGlint += uSunColor * hbSpk * uSparkle;
         }

         // --- lantern reflections: wave facets stretch each lamp into a shimmering streak
         if (uLampColor.r > 0.0) {
           vec3 hbR = reflect(-hbV, hbNW);
           float hbF = 0.02 + 0.98 * pow(1.0 - max(dot(hbNW, hbV), 0.0), 5.0);
           for (int i = 0; i < 8; i++) {
             vec4 lp = uLamps[i];
             if (lp.w <= 0.0) continue;
             vec3 toL = lp.xyz - vHbW;
             float dL = length(toL);
             float g = pow(max(dot(hbR, toL / dL), 0.0), 700.0);
             hbGlint += uLampColor * g * hbF * 260.0 / (1.0 + dL * dL * 0.004);
           }
         }`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
         // planar reflection of hulls, masts and the jetty (replaces the sky where present)
         if (uReflOn > 0.5) {
           vec2 hbOff = hbNW.xz * 1.7;
           vec4 hbRc = uReflMatrix * vec4(vHbW.x + hbOff.x, 0.0, vHbW.z + hbOff.y, 1.0);
           if (hbRc.w > 0.0) {
             vec2 hbRu = hbRc.xy / hbRc.w;
             vec2 hbBl = vec2(0.0035, 0.0025);
             vec4 hbRef = 0.25 * (texture2D(uReflTex, hbRu + vec2(hbBl.x, 0.0)) + texture2D(uReflTex, hbRu - vec2(hbBl.x, 0.0)) + texture2D(uReflTex, hbRu + vec2(0.0, hbBl.y)) + texture2D(uReflTex, hbRu - vec2(0.0, hbBl.y)));
             float hbFr = 0.02 + 0.98 * pow(1.0 - clamp(dot(hbNW, hbV), 0.0, 1.0), 5.0);
             // water mirrors are darker and less saturated than the objects themselves (keeps lamp-lit
             // undersides of the jetty from reading as a red slick at dusk)
             vec3 hbRefC = hbRef.rgb;
             hbRefC = mix(vec3(dot(hbRefC, vec3(0.2126, 0.7152, 0.0722))), hbRefC, 0.55) * 0.78;
             reflectedLight.indirectSpecular = mix(reflectedLight.indirectSpecular, hbRefC * hbFr, clamp(hbRef.a, 0.0, 1.0) * (1.0 - hbFoam) * uReflGain);
           }
         }`,
      )
      .replace(
        '#include <opaque_fragment>',
        `gl_FragColor = vec4((totalDiffuse + totalEmissiveRadiance) * hbAlpha + totalSpecular + hbGlint, hbAlpha);`,
      )
      .replace(
        '#include <fog_fragment>',
        `#ifdef USE_FOG
           #ifdef FOG_EXP2
             float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
           #else
             float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
           #endif
           gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor * gl_FragColor.a, fogFactor );
         #endif`,
      );
  };
  mat.customProgramCacheKey = () => 'hb-water-3';
  return mat;
}

export function Water({
  variant,
  quality,
  sunDir,
  sunColor,
  lamps = [],
}: {
  variant: Variant;
  quality: Quality;
  sunDir: THREE.Vector3;
  sunColor: string;
  lamps?: [number, number, number][];
}) {
  const geo = useMemo(() => buildGeometry(quality), [quality]);
  const mat = useMemo(() => createWaterMaterial(variant, sunDir, sunColor, lamps), [variant, sunDir, sunColor, lamps]);
  useEffect(() => {
    REFLECTION.uReflGain.value = variant === 'dusk' ? 0.4 : 1;
  }, [variant]);
  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(() => () => mat.dispose(), [mat]);

  useFrame(({ clock, scene }) => {
    WATER_TIME.value = clock.elapsedTime;
    if (scene.environment && mat.envMap !== scene.environment) {
      mat.envMap = scene.environment;
      mat.needsUpdate = true;
    }
  });

  return <mesh geometry={geo} material={mat} receiveShadow frustumCulled={false} userData={{ noBatch: true }} renderOrder={1} />;
}
