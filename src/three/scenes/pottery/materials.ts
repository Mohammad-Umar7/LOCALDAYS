import { useMemo } from 'react';
import * as THREE from 'three';
import { getTexSet, repeatSet } from '../../materials/textures';
import type { Finish } from './geometry';
import { heritagePlasterTex, speckleTex, stainedCanvasTex, tileFaceTex } from './tex';

/**
 * Every material in the studio, created once and shared (so StaticBatch can
 * merge by material). Texture maps are shared and tinted wherever possible
 * to keep procedural generation fast.
 */
export function usePotteryMaterials() {
  return useMemo(() => {
    const ns = (n: number) => new THREE.Vector2(n, n);
    const plaster = heritagePlasterTex('#DCC3A0', '#B9976E', 51);
    const plasterLight = getTexSet('plaster', { base: '#E9D8BB', dark: '#CDB08B', seed: 23, stains: 0.28 });
    const woodDark = getTexSet('wood', { base: '#6A4A31', dark: '#4E3421', planks: 6, seed: 32 });
    const woodWorn = getTexSet('wood', { base: '#B6A184', dark: '#9F896C', planks: 6, seed: 35, roughness: 0.82 });
    const woodTurned = getTexSet('wood', { base: '#8F633F', dark: '#7A5233', planks: 1, seams: false, seed: 34, roughness: 0.6 });
    const brick = repeatSet(getTexSet('brick', { base: '#7F5D4B', dark: '#563A2D', mortar: '#6F6253', rows: 10, seed: 39 }), 0.83, 1.18);
    const metal = getTexSet('metal', { base: '#D9D9D9', roughness: 0.4, seed: 38 });
    const fabric = getTexSet('fabric', { base: '#E4DACA', weave: 180 });
    const terracotta = getTexSet('terracotta', { base: '#B9693F', dark: '#8C4526', seed: 6 });
    const canvas = stainedCanvasTex();
    const speck = speckleTex(1);
    const speckSoft = speckleTex(0.45);
    const tile = tileFaceTex();
    const metalMaps = { map: metal.map, normalMap: metal.normalMap };

    const glaze: Record<Finish, THREE.Material> = {
      gloss: new THREE.MeshPhysicalMaterial({ vertexColors: true, map: speckSoft.map, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.07, envMapIntensity: 0.95 }),
      satin: new THREE.MeshPhysicalMaterial({ vertexColors: true, map: speck.map, roughness: 0.4, clearcoat: 0.35, clearcoatRoughness: 0.35, envMapIntensity: 1.1 }),
      matte: new THREE.MeshStandardMaterial({ vertexColors: true, map: speck.map, normalMap: speck.normalMap, normalScale: ns(0.5), roughness: 0.8 }),
    };

    return {
      /* --- architecture --- */
      wall: new THREE.MeshStandardMaterial({ ...plaster, roughness: 1, normalScale: ns(0.45) }),
      nicheWash: new THREE.MeshStandardMaterial({ ...plasterLight, color: '#E7C39A', roughness: 1, normalScale: ns(0.22) }),
      wallLight: new THREE.MeshStandardMaterial({ ...plasterLight, roughness: 1, normalScale: ns(0.7) }),
      dado: new THREE.MeshStandardMaterial({ ...plasterLight, color: '#C9AE8C', roughness: 1, normalScale: ns(0.8) }),
      grout: new THREE.MeshStandardMaterial({ ...plasterLight, color: '#A99781', roughness: 1, normalScale: ns(0.4) }),
      tile: new THREE.MeshStandardMaterial({ ...tile, color: '#FFFFFF', roughness: 0.8, normalScale: ns(0.8) }),
      ground: new THREE.MeshStandardMaterial({ ...repeatSet(plasterLight, 40, 40), color: '#DCC4A4', roughness: 1, normalScale: ns(1.3) }),
      limestone: new THREE.MeshStandardMaterial({ ...plasterLight, color: '#E6DCCB', roughness: 0.82, normalScale: ns(0.5) }),
      interior: new THREE.MeshStandardMaterial({ ...plasterLight, color: '#8C7458', roughness: 1 }),
      woodDark: new THREE.MeshStandardMaterial({ ...woodDark, roughness: 0.72, normalScale: ns(0.8) }),
      woodMid: new THREE.MeshStandardMaterial({ ...woodWorn, color: '#C9926A', roughness: 0.66, normalScale: ns(0.7) }),
      woodTurned: new THREE.MeshStandardMaterial({ ...woodTurned, roughness: 0.58, normalScale: ns(0.4) }),
      woodWorn: new THREE.MeshStandardMaterial({ ...woodWorn, roughness: 0.85, normalScale: ns(0.8) }),
      danchal: new THREE.MeshStandardMaterial({ ...woodWorn, color: '#9A8572', roughness: 0.9, normalScale: ns(1) }),
      iron: new THREE.MeshStandardMaterial({ ...metalMaps, color: '#3A3632', metalness: 0.75, roughness: 0.55, normalScale: ns(0.4) }),
      steel: new THREE.MeshStandardMaterial({ ...metalMaps, color: '#8E8982', metalness: 0.8, roughness: 0.48, normalScale: ns(0.25) }),
      brass: new THREE.MeshStandardMaterial({ ...metalMaps, color: '#D9AE66', metalness: 1, roughness: 0.28, normalScale: ns(0.3) }),
      brick: new THREE.MeshStandardMaterial({ ...brick, roughness: 0.92, normalScale: ns(1.2) }),
      kilnBrick: new THREE.MeshStandardMaterial({ ...brick, vertexColors: true, roughness: 0.94, normalScale: ns(1.3) }),
      refractory: new THREE.MeshStandardMaterial({ color: '#E3DACB', normalMap: speck.normalMap, roughness: 0.95, normalScale: ns(0.8) }),
      terracotta: new THREE.MeshStandardMaterial({ ...terracotta, roughness: 0.88, normalScale: ns(0.8) }),

      /* --- clay --- */
      clayWet: new THREE.MeshPhysicalMaterial({ map: speck.map, normalMap: speck.normalMap, normalScale: ns(0.35), color: '#8F7C6B', roughness: 0.34, clearcoat: 0.55, clearcoatRoughness: 0.32 }),
      clayBlock: new THREE.MeshStandardMaterial({ map: speck.map, normalMap: speck.normalMap, normalScale: ns(0.6), color: '#8D7B6B', roughness: 0.55 }),
      clayDry: new THREE.MeshStandardMaterial({ map: speck.map, normalMap: speck.normalMap, normalScale: ns(0.6), color: '#B09D88', roughness: 0.92 }),
      slip: new THREE.MeshPhysicalMaterial({ color: '#9B8977', roughness: 0.18, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
      bag: new THREE.MeshPhysicalMaterial({ color: '#6C6660', normalMap: speck.normalMap, normalScale: ns(1.6), roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.35 }),

      /* --- ceramics (vertex coloured, batched) --- */
      vBody: new THREE.MeshStandardMaterial({ vertexColors: true, map: speck.map, normalMap: speck.normalMap, normalScale: ns(0.7), roughness: 0.9 }),
      glaze,

      /* --- equipment --- */
      enamel: new THREE.MeshStandardMaterial({ color: '#C5BDB0', map: speck.map, roughness: 0.48, metalness: 0.1 }),
      enamelDark: new THREE.MeshStandardMaterial({ color: '#3B3F42', roughness: 0.45, metalness: 0.3 }),
      pan: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }),
      alu: new THREE.MeshStandardMaterial({ color: '#C3C6C8', metalness: 1, roughness: 0.3 }),
      rubber: new THREE.MeshStandardMaterial({ color: '#242322', roughness: 0.85 }),
      plastic: new THREE.MeshStandardMaterial({ color: '#E9E3D8', roughness: 0.5 }),
      bin: new THREE.MeshStandardMaterial({ color: '#56606A', roughness: 0.6 }),
      water: new THREE.MeshPhysicalMaterial({ color: '#46504C', roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.4 }),
      liquid: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.34, clearcoat: 0.3, clearcoatRoughness: 0.25, envMapIntensity: 0.55 }),
      canvas: new THREE.MeshStandardMaterial({ ...canvas, roughness: 0.95, normalScale: ns(0.8) }),
      cloth: new THREE.MeshStandardMaterial({ ...fabric, vertexColors: true, roughness: 0.96, side: THREE.DoubleSide }),
      sponge: new THREE.MeshStandardMaterial({ color: '#D7A653', roughness: 1, normalMap: speck.normalMap, normalScale: ns(2) }),
      ceramicWhite: new THREE.MeshPhysicalMaterial({ color: '#EEEAE1', roughness: 0.2, clearcoat: 0.7, clearcoatRoughness: 0.15 }),
      dark: new THREE.MeshStandardMaterial({ color: '#17110D', roughness: 1 }),
    };
  }, []);
}

export type PotteryMaterials = ReturnType<typeof usePotteryMaterials>;
