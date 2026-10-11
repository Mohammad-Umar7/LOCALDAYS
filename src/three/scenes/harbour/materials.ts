import { useMemo } from 'react';
import * as THREE from 'three';
import { getTexSet, repeatSet } from '../../materials/textures';
import type { Quality } from '../../core/types';
import { HEX_ASPECT, concreteSet, gelcoatSet, hexWireSet, netSet, rockSet, ropeSet, thatchSet } from './textures';

/* ------------------------------------------------------------------ */
/*  Harbour materials. Most surfaces share a handful of vertex-colour  */
/*  "palette" materials (paint, matte, metal, cloth, wood, timber,     */
/*  rope, net…) so StaticBatch folds the whole venue — and each boat — */
/*  into a few draw calls. Geometry is tinted with PAL colours.        */
/* ------------------------------------------------------------------ */

export const PAL = {
  // paints & plastics (paint)
  gelcoat: '#F3F2EC',
  teal: '#14837F',
  red: '#B32B22',
  blue: '#1E5FA6',
  grey: '#C6C9C5',
  dhowTeal: '#1E7873',
  trim: '#EFE9DC',
  crateBlue: '#2459A8',
  orange: '#E8691E',
  white: '#F1F0EA',
  lifejacket: '#F2661A',
  hose: '#2E8A3A',
  beaconGreen: '#2E8E5A',
  // matte
  chunam: '#E4DDCB',
  antifoul: '#7A2E24',
  bootTop: '#2A2420',
  dark: '#17130F',
  rubber: '#1E1D1C',
  frond: '#B89A6A',
  frondDark: '#9C7F55',
  terracotta: '#A9603B',
  growth: '#3C4631',
  dates: '#4E2410',
  // metal
  steel: '#CDD1D2',
  galv: '#A6ABAA',
  iron: '#34312E',
  brass: '#C09552',
  // cloth
  canvas: '#EDE5D3',
  sail: '#E2D5B8',
  awningTeal: '#2E7F86',
  tarpBlue: '#2F64A8',
  // wood (teak texture)
  teak: '#FFFFFF',
  teakDark: '#8C7B69',
  deck: '#E9D9C0',
  spar: '#D2B796',
  // timber (dark wood texture)
  timber: '#CDB89E',
  pole: '#B7A48A',
  pile: '#A3947F',
  // rope
  rope: '#D8C4A0',
  ropeBlue: '#6F9FC4',
  ropeGreen: '#5E8B57',
  // nets
  netGreen: '#62A891',
  netOrange: '#F2A05C',
  netBlue: '#86B6DA',
  // stone
  stone: '#FFFFFF',
  marker: '#E9DDC5',
} as const;

const ns = (n: number) => new THREE.Vector2(n, n);

function netMaterial(map: THREE.Texture, alpha: THREE.Texture) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map, alphaMap: alpha, roughness: 0.7, side: THREE.DoubleSide, transparent: true, depthWrite: false, alphaTest: 0.04 });
  mat.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace(
      '#include <alphamap_fragment>',
      `#ifdef USE_ALPHAMAP
         vec2 hbDx = dFdx(vAlphaMapUv * 256.0);
         vec2 hbDy = dFdy(vAlphaMapUv * 256.0);
         float hbMip = max(0.0, 0.5 * log2(max(dot(hbDx, hbDx), dot(hbDy, hbDy))));
         float hbA = texture2D(alphaMap, vAlphaMapUv).g;
         diffuseColor.a *= mix(hbA, 0.5, smoothstep(0.6, 2.6, hbMip));
       #endif`,
    );
  };
  mat.customProgramCacheKey = () => 'hb-net-veil';
  return mat;
}

/** Galvanised hex wire: crisp weave up close, soft silver veil (no sparkle/aliasing) further out. */
function wireMaterial(set: { map: THREE.Texture; alphaMap?: THREE.Texture; normalMap?: THREE.Texture; roughnessMap?: THREE.Texture }) {
  const mat = new THREE.MeshStandardMaterial({
    map: set.map,
    alphaMap: set.alphaMap,
    normalMap: set.normalMap,
    roughnessMap: set.roughnessMap,
    color: '#C9CDCC',
    metalness: 0.55,
    roughness: 0.5,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    alphaTest: 0.05,
  });
  mat.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace(
      '#include <alphamap_fragment>',
      `#ifdef USE_ALPHAMAP
         vec2 hbDx = dFdx(vAlphaMapUv * 256.0);
         vec2 hbDy = dFdy(vAlphaMapUv * 256.0);
         float hbMip = max(0.0, 0.5 * log2(max(dot(hbDx, hbDx), dot(hbDy, hbDy))));
         float hbA = texture2D(alphaMap, vAlphaMapUv).g;
         diffuseColor.a *= mix(hbA, 0.2 + hbA * 0.45, smoothstep(0.4, 1.8, hbMip));
       #endif`,
    );
  };
  mat.customProgramCacheKey = () => 'hb-wire-veil';
  return mat;
}

export function useHarbourMaterials(quality: Quality) {
  return useMemo(() => {
    const hi = quality === 'high';
    const woodDock = getTexSet('wood', { base: '#9C8F7C', dark: '#5E5446', planks: 4, seed: 41, roughness: 0.86 });
    const woodTeak = getTexSet('wood', { base: '#A0703F', dark: '#5C3A1E', planks: 6, seed: 12, roughness: 0.55 });
    const woodDark = getTexSet('wood', { base: '#5E4630', dark: '#2E2116', planks: 5, seed: 7, roughness: 0.8 });
    const rock = rockSet();
    const canvas = getTexSet('fabric', { base: '#F4F0E8', seed: 23, weave: 140 });
    const net = netSet(8);
    const wire = hexWireSet(6);
    const thatch = thatchSet();
    const rope = ropeSet();
    const gel = gelcoatSet();
    const netRep = repeatSet(net, 1, 1);
    const wireRep = repeatSet(wire, 1, 1 / HEX_ASPECT);
    const vc = { vertexColors: true, color: '#FFFFFF' } as const;

    return {
      paint: new THREE.MeshStandardMaterial({ ...vc, ...gel, roughness: 0.4, normalScale: ns(0.4) }),
      matte: new THREE.MeshStandardMaterial({ ...vc, roughness: 0.88 }),
      metal: new THREE.MeshStandardMaterial({ ...vc, metalness: 0.82, roughness: 0.38 }),
      cloth: new THREE.MeshStandardMaterial({ ...vc, ...canvas, roughness: 0.93, side: THREE.DoubleSide }),
      wood: new THREE.MeshStandardMaterial({ ...vc, ...woodTeak, roughness: 0.58, normalScale: ns(0.7) }),
      timber: new THREE.MeshStandardMaterial({ ...vc, ...woodDark, roughness: 0.9, normalScale: ns(1.0) }),
      dockWood: new THREE.MeshStandardMaterial({ ...vc, ...repeatSet(woodDock, 1, 1), roughness: 0.9, normalScale: ns(1.1) }),
      rope: new THREE.MeshStandardMaterial({ ...vc, ...rope, roughness: 0.95 }),
      thatch: new THREE.MeshStandardMaterial({ ...thatch, roughness: 1, side: THREE.DoubleSide }),
      sadu: new THREE.MeshStandardMaterial({ ...getTexSet('sadu'), roughness: 1 }),
      stone: new THREE.MeshStandardMaterial({ ...vc, ...rock, roughness: 0.93, normalScale: ns(1.1) }),
      rock: new THREE.MeshStandardMaterial({ ...rock, roughness: 0.92, normalScale: ns(1.4) }),
      concrete: new THREE.MeshStandardMaterial({ ...concreteSet(), color: '#D9D6CF', roughness: 0.9, normalScale: ns(0.25) }),
      ice: new THREE.MeshPhysicalMaterial({ color: '#E6F2F5', roughness: 0.16, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
      // nets: crisp knotted mesh up close, a soft translucent veil at distance
      net: netMaterial(netRep.map, netRep.alphaMap!),
      wire: wireMaterial(wireRep),
    };
  }, [quality]);
}

export type HarbourMaterials = ReturnType<typeof useHarbourMaterials>;
