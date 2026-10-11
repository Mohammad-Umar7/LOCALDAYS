import { useMemo } from 'react';
import type { Vec3 } from '../../core/types';
import type { FormName, GlazeName } from './geometry';
import { BEVEL, COURT, FY, NICHES } from './layout';
import type { PotteryMaterials } from './materials';
import { Slab } from './parts';
import { Mabkhara, Stack, Vessel } from './Vessels';

/* ------------------------------------------------------------------ */
/*  Finished ceramics: three arched display niches with timber shelves */
/*  (each niche a colour story), a low gallery platform, plinths with  */
/*  hero pieces and traditional unglazed water jars.                   */
/* ------------------------------------------------------------------ */

const SHELVES = [1.1, 1.52, 1.94];
const ZN = COURT.z0 - 0.15; // centre line of the niche depth

type Item = { f: FormName; g?: GlazeName | null; x: number; r?: number; s?: number; body?: 'buff' | 'red' | 'dark' | 'porcelain' | 'terracotta' };
type Special = { mab: 'terracotta' | 'painted' | 'charcoal'; x: number; r?: number; s?: number };
type Row = (Item | Special)[];

/** [floor, shelf1, shelf2, top] contents for each niche */
const NICHE_ROWS: Row[][] = [
  [
    [{ f: 'moonJar', g: 'gulf', x: -0.2, body: 'porcelain' }, { f: 'bowl', g: 'celadon', x: 0.28 }],
    [{ f: 'mug', g: 'gulf', x: -0.34, r: 0.6 }, { f: 'mug', g: 'celadon', x: -0.08, r: 1.1 }, { f: 'mug', g: 'gulf', x: 0.18, r: 0.9 }, { f: 'cup', g: 'teal', x: 0.38 }],
    [{ f: 'bottle', g: 'celadon', x: -0.28, body: 'porcelain' }, { f: 'jar', g: 'teal', x: 0.04 }, { f: 'smallBowl', g: 'gulf', x: 0.33 }],
    [{ f: 'vase', g: 'gulf', x: 0, s: 1.05, body: 'porcelain' }],
  ],
  [
    [{ f: 'waterJar', g: null, x: -0.1, s: 0.86, body: 'terracotta' }, { f: 'cup', g: 'sand', x: 0.34 }, { f: 'cup', g: 'sand', x: 0.42, r: 1 }],
    [{ f: 'mug', g: 'sand', x: -0.33, r: 0.4 }, { f: 'mug', g: 'sand', x: -0.08, r: 0.9 }, { f: 'mug', g: 'cream', x: 0.16, r: 1.3 }, { f: 'tumbler', g: 'sand', x: 0.38 }],
    [{ f: 'jar', g: 'sand', x: -0.27 }, { f: 'bowl', g: 'cream', x: 0.08 }, { f: 'tumbler', g: 'cream', x: 0.36 }],
    [{ mab: 'painted', x: -0.16, s: 1.05 }, { f: 'bottle', g: 'cream', x: 0.2, s: 0.9 }],
  ],
  [
    [{ f: 'moonJar', g: 'charcoal', x: -0.18, body: 'dark' }, { f: 'bowl', g: 'honey', x: 0.3 }],
    [{ f: 'mug', g: 'charcoal', x: -0.34, r: 0.5, body: 'dark' }, { f: 'mug', g: 'terracotta', x: -0.08, r: 1.2, body: 'red' }, { f: 'mug', g: 'charcoal', x: 0.17, body: 'dark' }, { f: 'cup', g: 'honey', x: 0.38 }],
    [{ f: 'bottle', g: 'honey', x: -0.28, body: 'red' }, { f: 'jar', g: 'terracotta', x: 0.05, body: 'red' }, { f: 'smallBowl', g: 'charcoal', x: 0.34 }],
    [{ mab: 'charcoal', x: -0.18 }, { f: 'vase', g: 'terracotta', x: 0.17, s: 0.85, body: 'red' }],
  ],
];

function NicheContents({ m, x, rows, seed }: { m: PotteryMaterials; x: number; rows: Row[]; seed: number }) {
  const levels = [NICHES.sill + BEVEL, ...SHELVES];
  return (
    <group>
      {SHELVES.map((y) => (
        <Slab key={y} mat={m.woodMid} position={[x, y - 0.016, ZN + 0.01]} size={[NICHES.w - 0.006, 0.032, 0.27]} r={0.008} uv={1.5} />
      ))}
      {rows.map((row, li) =>
        row.map((it, k) => {
          const p: Vec3 = [x + it.x, levels[li], ZN + 0.02];
          if ('mab' in it) return <Mabkhara key={`${li}-${k}`} m={m} position={p} rotation={(it.r ?? 0.3) + 0.4} scale={it.s ?? 1} style={it.mab} />;
          return <Vessel key={`${li}-${k}`} m={m} form={it.f} glaze={it.g} body={it.body ?? 'buff'} position={p} rotation={it.r ?? seed + k} scale={it.s ?? 1} seed={seed * 31 + li * 7 + k} drips={it.g === 'charcoal' ? 0 : 3} />;
        }),
      )}
    </group>
  );
}

export function Display({ m }: { m: PotteryMaterials }) {
  const platformZ = COURT.z0 + 0.62;
  const legs = useMemo(() => [-1.3, 1.3].flatMap((dx) => [-0.19, 0.19].map((dz) => [dx, dz] as [number, number])), []);
  return (
    <group>
      {NICHES.x.map((x, i) => (
        <NicheContents key={x} m={m} x={x} rows={NICHE_ROWS[i]} seed={i + 1} />
      ))}

      {/* low gallery platform in front of the niches */}
      <group position={[NICHES.x[1], FY, platformZ]}>
        <Slab mat={m.woodDark} position={[0, 0.39, 0]} size={[2.9, 0.06, 0.56]} r={0.015} uv={1.2} />
        {legs.map(([dx, dz], i) => (
          <Slab key={i} mat={m.woodDark} position={[dx, 0.18, dz]} size={[0.07, 0.36, 0.07]} r={0.01} />
        ))}
        <Slab mat={m.woodDark} position={[0, 0.08, 0]} size={[2.7, 0.03, 0.44]} r={0.01} uv={1.2} />
        <Vessel m={m} form="servingBowl" glaze="gulf" position={[-1.05, 0.42, 0.02]} seed={81} drips={4} />
        <Stack m={m} form="plate" glaze="cream" count={5} position={[-0.6, 0.42, 0.03]} seed={90} />
        <Vessel m={m} form="pitcher" glaze="celadon" position={[-0.22, 0.42, -0.06]} rotation={2.4} seed={83} />
        <Stack m={m} form="bowl" glaze="sand" count={3} gap={0.03} position={[0.16, 0.42, 0.05]} seed={95} />
        <Vessel m={m} form="jar" glaze="honey" position={[0.55, 0.42, -0.05]} seed={84} body="red" />
        <Vessel m={m} form="mug" glaze="terracotta" position={[0.86, 0.42, 0.1]} rotation={2.2} seed={85} body="red" />
        <Vessel m={m} form="mug" glaze="sand" position={[1.02, 0.42, -0.06]} rotation={2.7} seed={86} />
        <Vessel m={m} form="cup" glaze="gulf" position={[1.2, 0.42, 0.08]} seed={87} />
        {/* lower shelf: stock */}
        <Stack m={m} form="smallBowl" glaze="celadon" count={4} gap={0.024} position={[-0.9, 0.095, 0]} seed={70} />
        <Stack m={m} form="plate" glaze="sand" count={6} position={[-0.2, 0.095, 0]} seed={74} />
        <Stack m={m} form="bowl" glaze="charcoal" count={3} gap={0.03} position={[0.6, 0.095, 0]} seed={77} />
      </group>

      {/* plinths with hero pieces */}
      <Slab mat={m.wallLight} position={[NICHES.x[0] - 0.92, FY + 0.4, COURT.z0 + 0.42]} size={[0.42, 0.8, 0.42]} r={0.025} />
      <Vessel m={m} form="moonJar" glaze="gulf" body="porcelain" position={[NICHES.x[0] - 0.92, FY + 0.8, COURT.z0 + 0.42]} scale={1.25} seed={101} drips={5} />

      {/* traditional storage jar beside the display */}
      <Vessel m={m} form="bigJar" body="terracotta" position={[NICHES.x[2] + 0.92, FY, COURT.z0 + 0.45]} rotation={0.6} seed={103} damp={0.4} segments={56} />
    </group>
  );
}
