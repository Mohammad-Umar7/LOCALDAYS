import { createContext, useContext, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Vec3 } from '../../core/types';
import { FORMS, GLAZES, latheSimple, paint, paintBy, vesselGeometry, type BodyName, type FormName, type GlazeName } from './geometry';
import type { PotteryMaterials } from './materials';
import { mixRGB, rgb } from './tex';

/* ------------------------------------------------------------------ */
/*  Ceramic pieces. Every piece shares a handful of vertex-coloured    */
/*  materials, so the whole collection merges into a few draw calls.   */
/* ------------------------------------------------------------------ */

/** Level of detail for the ceramics: lathe segment multiplier + whether pieces cast shadows. */
export const DetailContext = createContext({ seg: 1, cast: true });

export interface VesselProps {
  m: PotteryMaterials;
  form: FormName;
  glaze?: GlazeName | null;
  body?: BodyName;
  position: Vec3;
  rotation?: number;
  scale?: number;
  seed?: number;
  dip?: number;
  drips?: number;
  segments?: number;
  damp?: number;
  /** Tilt (e.g. a bowl leaning in a rack) */
  tilt?: [number, number];
}

export function Vessel({ m, form, glaze = null, body = 'buff', position, rotation = 0, scale = 1, seed = 1, dip, drips, segments = 48, damp, tilt }: VesselProps) {
  const lod = useContext(DetailContext);
  const segs = Math.max(20, Math.round((segments * lod.seg) / 4) * 4);
  const geo = useMemo(
    () => vesselGeometry(FORMS[form], { glaze, body, seed, dip, drips, segments: segs, damp, detail: segs >= 48 ? 1 : segs >= 36 ? 0.8 : 0.65 }),
    [form, glaze, body, seed, dip, drips, segs, damp],
  );
  // each vessel owns its geometry (unique drips), so free it when rebuilt
  useEffect(
    () => () => {
      geo.body.dispose();
      geo.glaze?.dispose();
    },
    [geo],
  );
  return (
    <group position={position} rotation={[tilt?.[0] ?? 0, rotation, tilt?.[1] ?? 0]} scale={scale}>
      <mesh geometry={geo.body} material={m.vBody} castShadow={lod.cast} receiveShadow />
      {geo.glaze && glaze && <mesh geometry={geo.glaze} material={m.glaze[GLAZES[glaze].finish]} receiveShadow />}
    </group>
  );
}

/** A stack of identical plates or bowls. */
export function Stack({ m, form, glaze, count, position, rotation = 0, gap = 0.016, seed = 1 }: { m: PotteryMaterials; form: FormName; glaze: GlazeName; count: number; position: Vec3; rotation?: number; gap?: number; seed?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {Array.from({ length: count }, (_, i) => (
        <Vessel key={i} m={m} form={form} glaze={glaze} position={[Math.sin(i * 2.3) * 0.003, i * gap, Math.cos(i * 1.7) * 0.003]} rotation={i * 1.3} seed={seed + i} drips={0} dip={0.05} segments={40} />
      ))}
    </group>
  );
}

const mabkharaCache = new Map<string, THREE.BufferGeometry[]>();

/**
 * Mabkhara (incense burner): a stepped square base on four feet carrying a
 * flared cup for charcoal and bukhoor. `paint` adds painted bands.
 */
export function Mabkhara({ m, position, rotation = 0, scale = 1, style = 'terracotta' }: { m: PotteryMaterials; position: Vec3; rotation?: number; scale?: number; style?: 'terracotta' | 'painted' | 'charcoal' }) {
  const parts = useMemo(() => {
    const hit = mabkharaCache.get(style);
    if (hit) return hit;
    const clay = rgb(style === 'charcoal' ? '#3A3430' : '#B86E45');
    const red = rgb('#8E2B1E');
    const white = rgb('#EDE3CF');
    const gold = rgb('#C9A24E');
    const flat = (g: THREE.BufferGeometry) => {
      const n = g.toNonIndexed();
      n.computeVertexNormals();
      return n;
    };
    // stepped square base
    const base = flat(new THREE.CylinderGeometry(0.068, 0.088, 0.085, 4, 1));
    base.rotateY(Math.PI / 4);
    base.translate(0, 0.0625, 0);
    paintBy(base, (_x, y) => (style === 'painted' ? (y > 0.085 ? white : y > 0.05 ? red : clay) : clay));
    const plinth = flat(new THREE.CylinderGeometry(0.093, 0.093, 0.02, 4, 1));
    plinth.rotateY(Math.PI / 4);
    plinth.translate(0, 0.01, 0);
    paint(plinth, style === 'painted' ? red : clay);
    const neck = flat(new THREE.CylinderGeometry(0.04, 0.05, 0.035, 4, 1));
    neck.rotateY(Math.PI / 4);
    neck.translate(0, 0.122, 0);
    paint(neck, style === 'painted' ? gold : clay);
    const cup = latheSimple(
      [
        [0.0005, 0],
        [0.035, 0.0],
        [0.06, 0.022],
        [0.085, 0.055],
        [0.093, 0.068],
        [0.09, 0.074],
        [0.082, 0.07],
        [0.06, 0.044],
        [0.03, 0.03],
        [0.0005, 0.028],
      ],
      {
        segments: 32,
        color: (i) => (style === 'painted' ? (i === 4 || i === 5 ? gold : i < 3 ? red : white) : i >= 6 ? mixRGB(clay, rgb('#2A1E18'), 0.55) : clay),
      },
    );
    cup.translate(0, 0.139, 0);
    const out = [base, plinth, neck, cup];
    mabkharaCache.set(style, out);
    return out;
  }, [style]);
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      {parts.map((g, i) => (
        <mesh key={i} geometry={g} material={style === 'painted' ? m.glaze.satin : m.vBody} castShadow receiveShadow />
      ))}
    </group>
  );
}
