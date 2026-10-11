import * as THREE from 'three';
import { getTexSet, repeatSet } from '../../materials/textures';
import { roundedBox } from '../../props/geo';
import { awningStripes, beeBadge, combTex, infoPanel, jarLabel, paintedWood, render, rockTex, screenMesh, shopSign } from './tex';

/* ------------------------------------------------------------------ */
/*  Every material in the apiary, created once and shared, so the      */
/*  static batcher can merge whole buildings into a handful of draws.  */
/* ------------------------------------------------------------------ */

/** Pastel hive paints (multiplied over the weathered painted-wood texture). */
export const PAINTS = ['#F3F0E8', '#EDDDB9', '#E8CD7E', '#BCD4BF', '#B6CCD8', '#E3C4B8'];

/** Shared uniforms for the glowing honey jars (driven per variant). */
export const honeyUniforms = {
  uGlow: { value: 0.22 },
  uBack: { value: 0.9 },
};

function honeyMaterial() {
  const m = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.14,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.15,
    emissive: '#ffffff',
  });
  m.onBeforeCompile = (s) => {
    s.uniforms.uGlow = honeyUniforms.uGlow;
    s.uniforms.uBack = honeyUniforms.uBack;
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uGlow;\nuniform float uBack;').replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       {
         float tr = 0.0;
         vec3 Vv = normalize( vViewPosition );
         #if NUM_DIR_LIGHTS > 0
           vec3 Ls = directionalLights[ 0 ].direction;
           float back = pow( clamp( dot( Vv, -Ls ), 0.0, 1.0 ), 2.0 );
           float thick = clamp( dot( -normal, Ls ) * 0.5 + 0.5, 0.0, 1.0 );
           tr = back * ( 0.55 + 0.45 * thick );
         #endif
         float rim = pow( 1.0 - clamp( dot( normal, Vv ), 0.0, 1.0 ), 2.5 );
         #if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
           vec3 hc = vColor.rgb;
         #else
           vec3 hc = diffuse;
         #endif
         totalEmissiveRadiance = hc * ( uGlow + uBack * tr + rim * 0.3 );
       }`,
    );
  };
  m.customProgramCacheKey = () => 'apiary-honey';
  return m;
}

const grainCache = new Map<string, THREE.BufferGeometry>();
/** Rounded box whose UVs make wood grain follow its longest axis (cached). */
export function grainBox(w: number, h: number, d: number, r = 0.01, scale = 1.2, seg = 2) {
  const key = `${w}:${h}:${d}:${r}:${scale}:${seg}`;
  const hit = grainCache.get(key);
  if (hit) return hit;
  const g = buildGrainBox(w, h, d, r, scale, seg);
  grainCache.set(key, g);
  return g;
}

function buildGrainBox(w: number, h: number, d: number, r: number, scale: number, seg: number) {
  const dims = [w, h, d];
  const long = dims.indexOf(Math.max(...dims));
  const g = roundedBox(w, h, d, r, seg).clone();
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nor = g.attributes.normal as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  const axes = [0, 1, 2];
  for (let i = 0; i < pos.count; i++) {
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const n = [Math.abs(nor.getX(i)), Math.abs(nor.getY(i)), Math.abs(nor.getZ(i))];
    const face = n.indexOf(Math.max(...n));
    // U runs along the long axis unless the face is the end grain
    const other = axes.filter((a) => a !== face);
    let ua = long;
    if (face === long) ua = other[0];
    const va = other.find((a) => a !== ua) ?? other[1];
    uv[i * 2] = p[ua] * scale + (face === long ? 0.37 : 0);
    uv[i * 2 + 1] = p[va] * scale + face * 0.29;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

let cachedMats: ReturnType<typeof build> | null = null;

function build() {
  const ns = (n: number) => new THREE.Vector2(n, n);
  const pw = repeatSet(paintedWood(), 1, 1);
  const wood = getTexSet('wood', { base: '#BDAE97', dark: '#7F705C', planks: 6, seed: 4, roughness: 0.72 });
  const metal = getTexSet('metal', { base: '#C8CBCD', seed: 10, roughness: 0.3 });
  const plaster = render();
  const stone = rockTex();
  const comb = combTex();

  const paints = PAINTS.map((c) => new THREE.MeshStandardMaterial({ ...pw, color: c, roughness: 1, normalScale: ns(0.55) }));
  // Vertex-coloured masters: every paint / timber tint shares one draw call after batching
  const paintVC = new THREE.MeshStandardMaterial({ ...pw, vertexColors: true, roughness: 1, normalScale: ns(0.55) });
  const woodVC = new THREE.MeshStandardMaterial({ ...wood, vertexColors: true, roughness: 1, normalScale: ns(0.85) });

  const meshTex = screenMesh().clone();
  meshTex.needsUpdate = true;

  const labelTex = jarLabel();
  const stripes = awningStripes();

  const timber = new THREE.MeshStandardMaterial({ ...wood, color: '#C99561', roughness: 1, normalScale: ns(0.8) });
  const timberGrey = new THREE.MeshStandardMaterial({ ...wood, color: '#D8D0C2', roughness: 1, normalScale: ns(0.9) });
  const timberDark = new THREE.MeshStandardMaterial({ ...wood, color: '#8E6A49', roughness: 1, normalScale: ns(0.8) });
  const deck = new THREE.MeshStandardMaterial({ ...repeatSet(wood, 1, 1), color: '#C08F62', roughness: 1, normalScale: ns(1) });
  const tints = new Map<THREE.Material, { master: THREE.Material; color: THREE.Color }>();
  paints.forEach((p, i) => tints.set(p, { master: paintVC, color: new THREE.Color(PAINTS[i]) }));
  tints.set(timber, { master: woodVC, color: new THREE.Color('#C99561') });
  tints.set(timberGrey, { master: woodVC, color: new THREE.Color('#D8D0C2') });
  tints.set(timberDark, { master: woodVC, color: new THREE.Color('#8E6A49') });
  tints.set(deck, { master: woodVC, color: new THREE.Color('#C08F62') });

  return {
    paints,
    tints,
    hiveTop: new THREE.MeshStandardMaterial({ ...metal, color: '#C3C8CA', metalness: 0.85, roughness: 1.25 }),
    handhold: new THREE.MeshStandardMaterial({ color: '#4E453B', roughness: 0.95 }),
    timber,
    timberGrey,
    timberDark,
    deck,
    stainless: new THREE.MeshStandardMaterial({ ...metal, color: '#E4E7E9', metalness: 0.82, roughness: 0.9, envMapIntensity: 1.4 }),
    galvanised: new THREE.MeshStandardMaterial({ ...metal, color: '#B9BEC0', metalness: 0.9, roughness: 1.35, envMapIntensity: 1 }),
    brass: new THREE.MeshStandardMaterial({ ...metal, color: '#D2A75C', metalness: 1, roughness: 0.8 }),
    whiteWall: new THREE.MeshStandardMaterial({ ...plaster, color: '#F3EADB', roughness: 1, normalScale: ns(0.18) }),
    steel: new THREE.MeshStandardMaterial({ ...metal, color: '#4A4743', metalness: 0.7, roughness: 1.4 }),
    concrete: new THREE.MeshStandardMaterial({ ...plaster, color: '#BDB6AA', roughness: 0.55, normalScale: ns(0.2) }),
    stone: new THREE.MeshStandardMaterial({ ...stone, color: '#E2D6C4', roughness: 1, normalScale: ns(0.8) }),
    terracotta: new THREE.MeshStandardMaterial({ color: '#A8704F', roughness: 0.86 }),
    pebble: new THREE.MeshStandardMaterial({ color: '#B9AF9E', roughness: 0.6 }),
    comb: new THREE.MeshStandardMaterial({ ...repeatSet(comb, 1.7, 0.55), roughness: 1, normalScale: ns(1.1), envMapIntensity: 1.3 }),
    honey: honeyMaterial(),
    honeyStream: new THREE.MeshStandardMaterial({ color: '#C77812', emissive: '#7A3C06', emissiveIntensity: 0.6, roughness: 0.1 }),
    wax: new THREE.MeshStandardMaterial({ color: '#EED489', roughness: 0.55 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: '#F2F7F5',
      roughness: 0.04,
      metalness: 0,
      transparent: true,
      opacity: 0.14,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.8,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    tube: new THREE.MeshPhysicalMaterial({
      color: '#E8F0EC',
      roughness: 0.08,
      transparent: true,
      opacity: 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      envMapIntensity: 0.5,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    jarGlass: new THREE.MeshPhysicalMaterial({
      color: '#F6F8F2',
      roughness: 0.05,
      transparent: true,
      opacity: 0.28,
      clearcoat: 1,
      envMapIntensity: 1.6,
      depthWrite: false,
    }),
    screen: new THREE.MeshStandardMaterial({
      color: '#4A4946',
      alphaMap: meshTex,
      transparent: true,
      opacity: 0.85,
      roughness: 0.6,
      metalness: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    rope: new THREE.MeshStandardMaterial({ color: '#C9B48C', roughness: 1 }),
    blackPlastic: new THREE.MeshStandardMaterial({ color: '#242322', roughness: 0.55 }),
    whitePlastic: new THREE.MeshStandardMaterial({ color: '#F2F0EA', roughness: 0.42 }),
    leather: new THREE.MeshStandardMaterial({ color: '#6E4429', roughness: 0.72 }),
    ceramic: new THREE.MeshStandardMaterial({ color: '#F3EEE3', roughness: 0.22 }),
    lidGold: new THREE.MeshStandardMaterial({ ...metal, color: '#D9AE55', metalness: 1, roughness: 0.75 }),
    lidCream: new THREE.MeshStandardMaterial({ color: '#EFE6D2', roughness: 0.45 }),
    label: new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.8 }),
    awning: new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.92, side: THREE.DoubleSide }),
    sign: new THREE.MeshStandardMaterial({ map: shopSign(), roughness: 0.6, emissive: '#ffffff', emissiveMap: shopSign(), emissiveIntensity: 0 }),
    info: new THREE.MeshStandardMaterial({ map: infoPanel(), normalMap: plaster.normalMap, roughnessMap: plaster.roughnessMap, normalScale: ns(0.08), roughness: 0.8 }),
    badge: new THREE.MeshStandardMaterial({ map: beeBadge(), normalMap: plaster.normalMap, roughnessMap: plaster.roughnessMap, normalScale: ns(0.08), roughness: 0.65 }),
    trayPaint: new THREE.MeshStandardMaterial({ ...metal, color: '#3E6656', metalness: 0.45, roughness: 1.3, side: THREE.DoubleSide }),
    darkInterior: new THREE.MeshStandardMaterial({ color: '#2A2016', roughness: 1 }),
    lamp: new THREE.MeshStandardMaterial({ color: '#FFF4DE', emissive: '#FFC27A', emissiveIntensity: 0.0, roughness: 0.4 }),
    soilDark: new THREE.MeshStandardMaterial({ color: '#5C4A38', roughness: 1 }),
    green: new THREE.MeshStandardMaterial({ color: '#5E7A3A', roughness: 0.85 }),
    barrel: new THREE.MeshStandardMaterial({ color: '#2F5F86', roughness: 0.45 }),
    cork: new THREE.MeshStandardMaterial({ color: '#B98B5C', roughness: 0.95 }),
  };
}

export function useApiaryMaterials() {
  if (!cachedMats) cachedMats = build();
  return cachedMats;
}

export type ApiaryMaterials = ReturnType<typeof build>;

const tintCache = new Map<string, THREE.BufferGeometry>();
/** Clone of `geo` with a constant vertex colour (cached per geometry + colour). */
export function tintGeometry(geo: THREE.BufferGeometry, color: THREE.Color) {
  const key = `${geo.uuid}:${color.getHexString()}`;
  const hit = tintCache.get(key);
  if (hit) return hit;
  const g = geo.clone();
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = color.r;
    col[i * 3 + 1] = color.g;
    col[i * 3 + 2] = color.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  tintCache.set(key, g);
  return g;
}
