import { useMemo } from 'react';
import * as THREE from 'three';
import { getTexSet, repeatSet } from '../../materials/textures';
import { windUniforms } from '../../materials/wind';
import { burlapTex, datesTex, safeefahTex, strawTex } from './farmTex';

/**
 * Water with a visible current: the normal map scrolls downstream and soft
 * glinting streaks drift along the channel. Geometry UVs: u across, v = metres
 * along the flow. `speed` 0 gives still, gently rippling water (pools, basins).
 */
function waterMaterial(normal: THREE.Texture, speed: number, color: string) {
  const n = normal.clone();
  n.repeat.set(1, 1.6);
  n.needsUpdate = true;
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.07,
    metalness: 0,
    normalMap: n,
    normalScale: new THREE.Vector2(0.35, 0.35),
    transparent: true,
    opacity: 0.9,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 0.85,
  });
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTime = windUniforms.uTime;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec2 vFlow;')
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
         vFlow = uv;
         #ifdef USE_NORMALMAP
           vNormalMapUv.y -= uTime * ${(speed * 0.9 + 0.02).toFixed(3)};
           vNormalMapUv.x += uTime * 0.013;
         #endif`,
      );
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec2 vFlow;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float streak = 0.0;
         ${
           speed > 0
             ? `float fl = vFlow.y * 0.85 - uTime * ${speed.toFixed(3)};
                float wob = sin(vFlow.y * 1.7 - uTime * 0.9) * 0.22 + (vFlow.x - 0.5) * 0.5;
                streak = smoothstep(0.55, 1.0, sin((fl + wob) * 6.2831)) * smoothstep(0.0, 0.25, vFlow.x) * smoothstep(1.0, 0.75, vFlow.x);
                diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.45 + vec3(0.05, 0.06, 0.05), streak * 0.5);`
             : ''
         }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         roughnessFactor = mix(roughnessFactor, 0.015, streak);`,
      );
  };
  mat.customProgramCacheKey = () => `farm-water-${speed}`;
  return mat;
}

/** Trunk-post UVs that match DatePalms' trunks so the bark scales identically. */
export function trunkPostGeometry(r0: number, r1: number, h: number, radial = 10) {
  const g = new THREE.CylinderGeometry(r1, r0, h, radial, 4, false);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * h * 0.6);
  g.translate(0, h / 2, 0);
  return g;
}

/** All farm materials, created once and shared between components. */
export function useFarmMaterials() {
  return useMemo(() => {
    const plaster = getTexSet('plaster', { base: '#D9BD93', dark: '#B48F63', seed: 3, stains: 0.5 });
    const plasterLight = getTexSet('plaster', { base: '#E4CDA7', dark: '#C7A87E', seed: 9, stains: 0.35 });
    const woodDark = getTexSet('wood', { base: '#6E4A2C', dark: '#3A2414', planks: 5, seed: 2 });
    const woodLight = getTexSet('wood', { base: '#B08155', dark: '#76512F', planks: 6, seed: 5 });
    const woodGrey = getTexSet('wood', { base: '#A39279', dark: '#665643', planks: 6, seed: 8, roughness: 0.85 });
    const stone = getTexSet('stone', { base: '#D6C3A2', dark: '#B09A78', mortar: '#8F7C64', cells: 6, seed: 4 });
    const soil = getTexSet('soil');
    const iron = getTexSet('metal', { base: '#2F2B28', roughness: 0.6, seed: 3 });
    const fabric = getTexSet('fabric', { base: '#ECE3D1' });
    const waterN = getTexSet('waterNormal');
    const ground = getTexSet('ground', { base: '#A3865D', dark: '#765D41', green: '#626634', seed: 14 });
    // Same texture source/repeat/colour as DatePalms' trunks → batched into one draw with them
    const bark = repeatSet(getTexSet('bark'), 1, 1);

    const ns = (n: number) => new THREE.Vector2(n, n);
    const mats = {
      plaster: new THREE.MeshStandardMaterial({ ...plaster, roughness: 1, normalScale: ns(0.9) }),
      plasterLight: new THREE.MeshStandardMaterial({ ...plasterLight, roughness: 1, normalScale: ns(0.7) }),
      woodDark: new THREE.MeshStandardMaterial({ ...woodDark, roughness: 0.75, normalScale: ns(0.8) }),
      woodLight: new THREE.MeshStandardMaterial({ ...woodLight, roughness: 0.7, normalScale: ns(0.8) }),
      woodGrey: new THREE.MeshStandardMaterial({ ...woodGrey, roughness: 0.9, normalScale: ns(1) }),
      woodTeal: new THREE.MeshStandardMaterial({ ...woodDark, color: '#6FA3A0', roughness: 0.6, normalScale: ns(0.6) }),
      stone: new THREE.MeshStandardMaterial({ ...stone, roughness: 0.92, normalScale: ns(1.2) }),
      soil: new THREE.MeshStandardMaterial({ ...repeatSet(soil, 2, 2), roughness: 1, normalScale: ns(1.4) }),
      /** Freshly watered earth: darker, a touch glossier. */
      wetSoil: new THREE.MeshStandardMaterial({ ...repeatSet(soil, 2, 2), color: '#8E7A68', roughness: 0.82, normalScale: ns(1.2) }),
      iron: new THREE.MeshStandardMaterial({ ...iron, metalness: 0.8, roughness: 0.55 }),
      canvas: new THREE.MeshStandardMaterial({ ...fabric, roughness: 0.95, side: THREE.DoubleSide }),
      /** Sand-coloured shade cloth. */
      sail: new THREE.MeshStandardMaterial({ ...fabric, color: '#D2B993', roughness: 0.95, side: THREE.DoubleSide }),
      danchal: new THREE.MeshStandardMaterial({ color: '#5B4532', roughness: 0.95 }),
      frond: new THREE.MeshStandardMaterial({ color: '#B59A66', roughness: 1 }),
      film: new THREE.MeshPhysicalMaterial({
        color: '#F4F7F2',
        roughness: 0.18,
        metalness: 0,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
        depthWrite: false,
        clearcoat: 1,
        clearcoatRoughness: 0.2,
        envMapIntensity: 1.4,
      }),
      galvanised: new THREE.MeshStandardMaterial({ color: '#C9CDCF', metalness: 0.9, roughness: 0.35 }),
      blueTank: new THREE.MeshStandardMaterial({ color: '#2F6E9A', roughness: 0.45 }),
      pipe: new THREE.MeshStandardMaterial({ color: '#1E1E1E', roughness: 0.6 }),
      solar: new THREE.MeshPhysicalMaterial({ color: '#16233A', metalness: 0.4, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }),
      linen: new THREE.MeshStandardMaterial({ ...fabric, color: '#F3EEE4', roughness: 0.92 }),
      ceramic: new THREE.MeshStandardMaterial({ color: '#E9E1D2', roughness: 0.28 }),
      terracotta: new THREE.MeshStandardMaterial({ ...getTexSet('terracotta'), roughness: 0.85 }),
      /** Clear glass without `transmission` (which would re-render the whole scene every frame). */
      glass: new THREE.MeshPhysicalMaterial({
        color: '#E4EFEC',
        roughness: 0.04,
        metalness: 0,
        transparent: true,
        opacity: 0.38,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        envMapIntensity: 1.6,
        depthWrite: false,
      }),
      palmTrunk: new THREE.MeshStandardMaterial({ ...bark, color: '#D8C7AE', roughness: 1, normalScale: ns(1.4) }),
      straw: new THREE.MeshStandardMaterial({ ...repeatSet(strawTex(), 1, 1), roughness: 0.95, normalScale: ns(1.1) }),
      safeefah: new THREE.MeshStandardMaterial({ ...safeefahTex(), roughness: 0.85, normalScale: ns(0.9), side: THREE.DoubleSide }),
      burlap: new THREE.MeshStandardMaterial({ ...burlapTex(), roughness: 1, normalScale: ns(1) }),
      rope: new THREE.MeshStandardMaterial({ color: '#BFA478', roughness: 0.95 }),
      dates: new THREE.MeshStandardMaterial({ ...datesTex(), roughness: 1, normalScale: ns(1.2) }),
      /** Fruit & veg: white base tinted per instance; glossy skins. */
      produce: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.38, clearcoat: 0.55, clearcoatRoughness: 0.3 }),
      tomato: new THREE.MeshPhysicalMaterial({ color: '#C8321E', roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
      water: waterMaterial(waterN.normalMap!, 0.55, '#3C5446'),
      stillWater: waterMaterial(waterN.normalMap!, 0, '#3E5A4E'),
      /** Earth banks of the channels and basins: the plot's own ground, a shade darker. */
      berm: new THREE.MeshStandardMaterial({ ...repeatSet(ground, 4, 4), color: '#B4A48E', roughness: 1, normalScale: ns(0.6) }),
      /** Plain leaf green shared by small static plants (herbs, seedlings, offshoots). */
      leaf: new THREE.MeshStandardMaterial({ color: '#4E7A34', roughness: 0.85, side: THREE.DoubleSide }),
    };
    // names make batched draws traceable in the renderer inspector
    for (const [k, v] of Object.entries(mats)) v.name = `farm:${k}`;
    return mats;
  }, []);
}

export type FarmMaterials = ReturnType<typeof useFarmMaterials>;
