import { useMemo } from 'react';
import * as THREE from 'three';
import { getTexSet } from '../../materials/textures';
import type { Quality } from '../../core/types';
import { atelierMap, atelierTex, repeatTex, woodTex } from './textures';

/* ------------------------------------------------------------------ */
/*  Shared atelier materials, created once per quality tier.           */
/*  Static props reuse these instances so StaticBatch can merge them.  */
/* ------------------------------------------------------------------ */

const ns = (n: number) => new THREE.Vector2(n, n);

/** Fresnel rim: glass edges catch the room's light the way real glass does. */
function withRim<T extends THREE.MeshPhysicalMaterial>(mat: T, color: string, strength: number, power = 2.2): T {
  const rim = new THREE.Color(color).multiplyScalar(strength);
  const inject = 'outgoingLight += uRim * pow(1.0 - saturate(abs(dot(normal, normalize(vViewPosition)))), ' + power.toFixed(2) + ');';
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: rim };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRim;')
      .replace('#include <opaque_fragment>', inject + '\n#include <opaque_fragment>');
  };
  mat.customProgramCacheKey = () => 'rim:' + color + ':' + strength + ':' + power;
  return mat;
}

export function makeAtelierMaterials(quality: Quality) {
  // One neutral hardwood map, tinted per species (keeps texture generation fast)
  const wood = woodTex('#B48A66', '#4E3220', 31, 4);
  const brassTex = getTexSet('metal', { base: '#C9A35B', seed: 41, roughness: 0.22 });
  const plasterTex = getTexSet('plaster', { base: '#B39A7E', dark: '#957A5E', seed: 21, roughness: 0.95, stains: 0.35 });
  const marbleTex = getTexSet('marble', { base: '#C9BBA4', vein: '#8E7C66', seed: 47 });
  const fabricTex = getTexSet('fabric', { base: '#FFFFFF', seed: 51, weave: 260 });
  const carving = atelierMap('carving');
  const hero = quality !== 'low';

  const velvet = (color: string, sheen: string) =>
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.92,
      sheen: 1,
      sheenColor: new THREE.Color(sheen),
      sheenRoughness: 0.42,
      normalMap: fabricTex.normalMap,
      normalScale: ns(0.25),
    });

  const carved = (color: string, rx: number, ry: number) => {
    const n = carving.clone();
    n.repeat.set(rx, ry);
    n.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: wood.map, roughnessMap: wood.roughnessMap, color, normalMap: n, normalScale: ns(1.1), roughness: 1 });
  };

  return {
    /* --- timber --- */
    walnut: new THREE.MeshStandardMaterial({ ...wood, color: '#887364', roughness: 1, normalScale: ns(0.45) }),
    ebony: new THREE.MeshStandardMaterial({ ...wood, color: '#574D4D', roughness: 1, normalScale: ns(0.4) }),
    teak: new THREE.MeshStandardMaterial({ ...wood, color: '#BFA17F', roughness: 1.05, normalScale: ns(0.45) }),
    pole: new THREE.MeshStandardMaterial({ ...repeatTex(wood, 1, 2), color: '#6E5A4C', roughness: 1.6, normalScale: ns(0.8) }),
    carvedPanel: carved('#887364', 3, 3),
    carvedFrieze: carved('#574D4D', 10, 1),
    /* --- metals --- */
    brass: new THREE.MeshStandardMaterial({ ...brassTex, metalness: 1, roughness: 1, envMapIntensity: 1.25 }),
    brassOld: new THREE.MeshStandardMaterial({ ...brassTex, color: '#A4865A', metalness: 1, roughness: 1.4 }),
    gold: new THREE.MeshStandardMaterial({ color: '#D8B26A', metalness: 1, roughness: 0.18, envMapIntensity: 1.4 }),
    iron: new THREE.MeshStandardMaterial({ color: '#221C18', metalness: 0.75, roughness: 0.45 }),
    steel: new THREE.MeshStandardMaterial({ color: '#B8B6B0', metalness: 1, roughness: 0.3 }),
    /* --- surfaces --- */
    plaster: new THREE.MeshStandardMaterial({ ...plasterTex, roughness: 1, normalScale: ns(0.28) }),
    plasterCut: new THREE.MeshStandardMaterial({ color: '#1C130D', roughness: 0.95 }),
    floor: new THREE.MeshStandardMaterial({ ...repeatTex(atelierTex('encaustic'), 7.44 / 1.0, 5.62 / 1.0), roughness: 1, normalScale: ns(0.5), envMapIntensity: 1 }),
    marble: new THREE.MeshStandardMaterial({ ...marbleTex, roughness: 1, envMapIntensity: 1.1 }),
    marbleDark: new THREE.MeshStandardMaterial({ ...marbleTex, color: '#3E3630', roughness: 1, envMapIntensity: 1.1 }),
    matting: new THREE.MeshStandardMaterial({ ...repeatTex(atelierTex('matting'), 3, 3), roughness: 1, normalScale: ns(0.9), side: THREE.FrontSide }),
    /* --- textiles --- */
    velvetRed: velvet('#4C0D14', '#C8646A'),
    velvetGreen: velvet('#15352C', '#5FA08A'),
    linen: new THREE.MeshStandardMaterial({ ...fabricTex, color: '#E9DFCB', roughness: 1 }),
    paper: new THREE.MeshStandardMaterial({ color: '#EAE1CF', roughness: 0.95 }),
    tissue: new THREE.MeshStandardMaterial({ color: '#F1E7D6', roughness: 1, side: THREE.DoubleSide }),
    card: new THREE.MeshStandardMaterial({ map: atelierMap('labelCard'), roughness: 0.9 }),
    /* --- ceramics & natural --- */
    clay: new THREE.MeshStandardMaterial({ color: '#9C5434', roughness: 0.9, normalMap: fabricTex.normalMap, normalScale: ns(0.3) }),
    ceramic: new THREE.MeshStandardMaterial({ color: '#EFE6D6', roughness: 0.28 }),
    agarwood: new THREE.MeshStandardMaterial({ ...atelierTex('agarwood'), roughness: 1, normalScale: ns(0.9) }),
    bukhoor: new THREE.MeshStandardMaterial({ color: '#2B170D', roughness: 0.42 }),
    resin: new THREE.MeshStandardMaterial({ color: '#B8701C', roughness: 0.25, emissive: '#3A1A04', emissiveIntensity: 0.4 }),
    sugar: new THREE.MeshStandardMaterial({ color: '#EDE6DA', roughness: 0.85 }),
    powder: new THREE.MeshStandardMaterial({ color: '#B88E62', roughness: 1 }),
    petals: new THREE.MeshStandardMaterial({ color: '#8E2433', roughness: 0.8 }),
    cork: new THREE.MeshStandardMaterial({ color: '#9A7550', roughness: 0.95 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#2A1714', roughness: 0.55 }),
    charcoal: new THREE.MeshStandardMaterial({ color: '#1A0E0A', emissive: '#FF5A1C', emissiveIntensity: 2.2, roughness: 1 }),
    ash: new THREE.MeshStandardMaterial({ color: '#8C8580', roughness: 1 }),
    /* --- gifts --- */
    giftRed: new THREE.MeshPhysicalMaterial({ color: '#5A0B12', roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.35 }),
    giftGold: new THREE.MeshStandardMaterial({ color: '#B98B3C', metalness: 0.85, roughness: 0.35 }),
    giftCream: new THREE.MeshStandardMaterial({ color: '#E7DAC0', roughness: 0.7 }),
    giftPaper: new THREE.MeshStandardMaterial({ ...repeatTex(atelierTex('giftPaper'), 2, 2), roughness: 1, side: THREE.DoubleSide }),
    ribbon: new THREE.MeshStandardMaterial({ color: '#C9A04A', metalness: 0.6, roughness: 0.32, side: THREE.DoubleSide }),
    /* --- glass --- */
    crystalLite: withRim(new THREE.MeshPhysicalMaterial({ color: '#0C0D0D', roughness: 0.03, transparent: true, blending: THREE.AdditiveBlending, envMapIntensity: 2.6, depthWrite: false, specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.05 }), '#FFE2C2', 0.34),
    crystal: hero
      ? withRim(
          new THREE.MeshPhysicalMaterial({
            color: '#FFFFFF',
            metalness: 0,
            roughness: 0.03,
            transmission: 1,
            thickness: 0.03,
            ior: 1.52,
            specularIntensity: 1,
            envMapIntensity: 1.6,
          }),
          '#FFE2C2',
          0.14,
        )
      : withRim(new THREE.MeshPhysicalMaterial({ color: '#0C0D0D', roughness: 0.03, transparent: true, blending: THREE.AdditiveBlending, envMapIntensity: 2.6, depthWrite: false, clearcoat: 1 }), '#FFE2C2', 0.34),
    glass: withRim(
      new THREE.MeshPhysicalMaterial({
        color: '#101212',
        roughness: 0.04,
        metalness: 0,
        transparent: true,
        blending: THREE.AdditiveBlending,
        envMapIntensity: 2.6,
        depthWrite: false,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
      }),
      '#FFE6CC',
      0.3,
    ),
    amberGlass: new THREE.MeshStandardMaterial({ color: '#4E2408', roughness: 0.07, metalness: 0.1, emissive: '#2A1003', emissiveIntensity: 0.6, envMapIntensity: 2 }),
    /** Baked liquids carry their colour per vertex */
    liquidVC: new THREE.MeshStandardMaterial({ color: '#FFFFFF', vertexColors: true, roughness: 0.12, envMapIntensity: 1.3 }),
    /** Dry ingredients (resins, petals, powders) coloured per vertex */
    fillVC: new THREE.MeshStandardMaterial({ color: '#FFFFFF', vertexColors: true, roughness: 0.75 }),
    /** Tint targets for TintPolicy */
    tintMatte: new THREE.MeshStandardMaterial({ color: '#FFFFFF', vertexColors: true, roughness: 0.88 }),
    tintGloss: new THREE.MeshStandardMaterial({ color: '#FFFFFF', vertexColors: true, roughness: 0.3 }),
    tintMetal: new THREE.MeshStandardMaterial({ color: '#FFFFFF', vertexColors: true, roughness: 0.28, metalness: 1, envMapIntensity: 1.3 }),
    /* --- light emitters (animated, never batched) --- */
    lanternGlow: new THREE.MeshStandardMaterial({ color: '#3A1A08', emissive: '#E8641E', emissiveIntensity: 0.8, roughness: 0.35, side: THREE.DoubleSide }),
    candle: new THREE.MeshStandardMaterial({ color: '#EADFC8', roughness: 0.6, emissive: '#FFB070', emissiveIntensity: 0.25 }),
    flame: new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFC27A').multiplyScalar(5), transparent: true, opacity: 0.95, depthWrite: false }),
  };
}

export type AtelierMaterials = ReturnType<typeof makeAtelierMaterials>;

export function useAtelierMaterials(quality: Quality) {
  return useMemo(() => makeAtelierMaterials(quality), [quality]);
}
