import { useCallback, useMemo } from 'react';
import { Sparkles } from '@react-three/drei';
import { OutdoorRig } from '../../core/Rigs';
import { StaticBatch } from '../../core/StaticBatch';
import type { SceneConfig, SceneProps, Vec3 } from '../../core/types';
import { Trees, TREE_STYLES } from '../../props/Trees';
import { Birds } from '../../props/Decor';
import { useFarmMaterials } from './materials';
import { Farmhouse } from './Farmhouse';
import { Garden } from './Garden';
import { Water } from './Water';
import { Dining } from './Dining';
import { Terrain, PLOT } from './Terrain';
import { Tents, TENT_SPOTS } from './Tents';
import { FarmPalms, PalmBasins, ShadowLodSwitch, type ShadowLod } from './Palms';
import { Bench, FamilyQuarter, GhafSwing, PenAnimals } from './Family';
import { OutdoorMajlis } from './Majlis';
import { DryingMats, Harvest } from './Harvest';
import { TractorRig } from './Tractor';
import { FreeRange, Saluki } from './Animals';
import { BasinField, GroveChannels } from './Irrigation';
import { EdgingStones, FallenFronds, FlowerBeds, insideShrubs, Orchard, Yard } from './Scatter';
import { ALL_PALMS, CHANNEL_Z, FIELD, FODDER, GROVE_COLS, PADDOCK, GROVE_PALMS, HARVEST, inRect, MAJLIS, ORCHARD, ORCHARD_TREES, PEN_BACK, PEN_FRONT, SPECIMEN_PALMS, SPUR_OFFSET, SWING_GHAF, YARD } from './layout';
import { paintSplat } from './ground';

/* ================================================================== */
/*  Farm venue — Ghaf Grove (and other farm hosts via variants).       */
/* ================================================================== */

export const config: SceneConfig = {
  id: 'farm',
  fov: 36,
  home: { position: [27, 31, 61], target: [3, 0, -2] },
  anchors: {
    farmhouse: { position: [-9, 6.9, -4.2], camera: { position: [8, 8.2, 9.5], target: [-9, 2.4, -3.5] } },
    dining: { position: [-2, 4.1, 13.2], camera: { position: [3.4, 5.4, 24.2], target: [-2.2, 1.0, 12.8] } },
    garden: { position: [12, 2.3, 5.8], camera: { position: [17.5, 7.6, 20.5], target: [12, 0.4, 5.6] } },
    greenhouse: { position: [27, 5.3, 6], camera: { position: [36.5, 7, 17.5], target: [26.6, 1.8, 6] } },
    irrigation: { position: [3.2, 2.6, -6], camera: { position: [11.2, 5.6, 4.6], target: [5.4, 0.7, -6.2] } },
    palms: { position: [18, 10.2, -21], camera: { position: [33, 9.5, -9], target: [16, 4.6, -20] } },
    tents: { position: [-16.6, 4.6, 14.2], camera: { position: [-7.5, 6.2, 27.5], target: [-16.8, 1.4, 14.6] } },
  },
  controls: {
    minDistance: 6,
    maxDistance: 95,
    minPolarAngle: 0.25,
    maxPolarAngle: 1.38,
    boundary: { min: [-40, 0, -45], max: [46, 12, 32] },
  },
  background: '#E7CFAA',
};

/** The farm dog's beat: the open strip between the dining pergola and the date mats. */
const DOG_PATH: [number, number][] = [
  [4.3, 17.1],
  [1.2, 16.6],
  [-2.6, 17.0],
  [-6.4, 17.6],
];

export default function FarmScene({ variant, quality, features }: SceneProps) {
  const m = useFarmMaterials();
  const lit = variant === 'dusk';
  const lod = useMemo<ShadowLod>(() => new Set(), []);
  const showTents = !!features?.includes('tents');
  const pen = showTents ? PEN_BACK : PEN_FRONT;
  const splat = useMemo(() => paintSplat({ pen, tents: showTents }), [pen, showTents]);

  /** Keeps scattered grass out of buildings, beds, paths and set pieces. */
  const avoid = useCallback(
    (x: number, z: number) =>
      (x > -15.8 && x < -2.2 && z > -10.6 && z < 6.9) ||
      (x > 7.2 && x < 16.8 && z > 0.4 && z < 11.2) ||
      (x > 23.2 && x < 30.8 && z > -1.3 && z < 13.3) ||
      (x > -7.3 && x < 3.3 && z > 10.6 && z < 15.8) ||
      (x > -0.5 && x < 10.5 && z > -8 && z < -2.5) ||
      (Math.abs(x - 2.2) < 1 && z < -6) ||
      inRect(pen, x, z, 0.4) ||
      inRect(FIELD, x, z, 0.9) ||
      inRect(PADDOCK.rect, x, z, 0.9) ||
      (Math.abs(x - MAJLIS.x) < MAJLIS.w / 2 + 0.4 && Math.abs(z - MAJLIS.z) < MAJLIS.d / 2 + 0.4) ||
      (showTents && TENT_SPOTS.some((t) => Math.hypot(t.p[0] - x, t.p[2] - z) < 3.5)) ||
      x < PLOT.x0 + 0.5 ||
      z > PLOT.z1 - 0.5,
    [showTents, pen],
  );

  /** Hard props the scatter must not land on (buildings, beds, set pieces, water). */
  const blocked = useCallback(
    (x: number, z: number) =>
      (x > -15.6 && x < -2.6 && z > -10.4 && z < 6.8) ||
      (x > 7.3 && x < 16.7 && z > 0.6 && z < 11.0) ||
      (x > 23.3 && x < 30.7 && z > -1.2 && z < 13.2) ||
      (x > -7.0 && x < 3.0 && z > 10.8 && z < 15.6) ||
      (x > 3.2 && x < 5.0 && z > 11.7 && z < 13.5) ||
      (x > 7.0 && x < 9.4 && z > 14.7 && z < 16.2) ||
      (x > 3.8 && x < 7.4 && z > -6.7 && z < -4.1) ||
      (x > 0.2 && x < 3.8 && z > -7.1 && z < -4.1) ||
      (Math.abs(x - 2.2) < 0.9 && z < -6.8) ||
      (x > HARVEST.x - 3.3 && x < HARVEST.x + 4.6 && z > HARVEST.z - 2.0 && z < HARVEST.z + 2.4) ||
      inRect(YARD, x, z, 0.3) ||
      inRect(pen, x, z, 1.1) ||
      inRect(FIELD, x, z, 1.4) ||
      inRect(PADDOCK.rect, x, z, 1.4) ||
      (Math.abs(x - MAJLIS.x) < MAJLIS.w / 2 + 0.7 && Math.abs(z - MAJLIS.z) < MAJLIS.d / 2 + 0.8) ||
      (showTents && TENT_SPOTS.some((t) => Math.hypot(t.p[0] - x, t.p[2] - z) < 3.8)),
    [showTents, pen],
  );
  /** Grass gathers where water reaches: palm basins, channels, the field margins. */
  const prefer = useCallback((x: number, z: number) => {
    let w = 0;
    for (const p of ALL_PALMS) {
      const d = Math.hypot(p.position[0] - x, p.position[2] - z);
      if (d > 1.45 && d < 3.6) w = Math.max(w, 1 - Math.abs(d - 2.3) / 1.4);
    }
    if (x > 2.5 && x < 34 && Math.abs(z - CHANNEL_Z) < 1.3) w = Math.max(w, 0.8);
    for (const c of GROVE_COLS) if (Math.abs(x - (c + SPUR_OFFSET)) < 1.0 && z < CHANNEL_Z && z > -34) w = Math.max(w, 0.7);
    if (inRect(FIELD, x, z, 2.2) || inRect(PADDOCK.rect, x, z, 2.2)) w = Math.max(w, 0.9);
    if (inRect(ORCHARD, x, z, 0)) w = Math.max(w, 0.6);
    return w;
  }, []);
  const scatterAvoid = useCallback((x: number, z: number) => blocked(x, z) || avoid(x, z), [blocked, avoid]);
  const shrubsInside = useMemo(() => insideShrubs(scatterAvoid), [scatterAvoid]);
  const flowerSpots = useMemo(
    () => [
      { x: -13.2, z: 7.05, r: 0.9, n: 14 },
      { x: -4.9, z: 7.05, r: 0.9, n: 14 },
      { x: MAJLIS.x - 2.9, z: MAJLIS.z + 2.7, r: 0.7, n: 11 },
      { x: MAJLIS.x + 2.9, z: MAJLIS.z + 2.5, r: 0.6, n: 9 },
      { x: -1.1, z: 2.9, r: 1.0, n: 14 },
      { x: -7.4, z: 16.0, r: 0.7, n: 10 },
      { x: 3.5, z: 15.9, r: 0.6, n: 9 },
      { x: 0.0, z: -3.9, r: 0.7, n: 10 },
      { x: 2.2, z: 22.7, r: 0.9, n: 12 },
      { x: 13.2, z: 22.9, r: 0.8, n: 10 },
      { x: SWING_GHAF.x + 1.4, z: SWING_GHAF.z + 3.4, r: 1.0, n: 12 },
      { x: 10.8, z: 15.1, r: 0.6, n: 8 },
      { x: 25.4, z: 13.9, r: 0.5, n: 7 },
      { x: 28.6, z: 13.9, r: 0.5, n: 7 },
      { x: 9.8, z: 12.0, r: 0.6, n: 8 },
      { x: 17.4, z: 13.6, r: 0.6, n: 8 },
    ],
    [],
  );

  const ghaf = useMemo(
    () => [
      { position: [SWING_GHAF.x, 0, SWING_GHAF.z] as Vec3, seed: 11, scale: 1.75, rotation: 0.4 },
      { position: [12.3, 0, 22.4] as Vec3, seed: 5, scale: 1.25 },
    ],
    [],
  );
  const basins = useMemo(() => [...ALL_PALMS, ...ORCHARD_TREES.map(([x, z]) => ({ position: [x, 0, z] as Vec3 }))], []);
  const bougainvillea = useMemo(
    () => [
      { position: [-2.3, 0, 1.4] as Vec3, seed: 3, scale: 1.6 },
      { position: [-2.3, 0, 4.6] as Vec3, seed: 8, scale: 1.4 },
      { position: [-15.7, 0, 5.4] as Vec3, seed: 13, scale: 1.5 },
    ],
    [],
  );

  return (
    <>
      {/* must precede the palms in the scene graph (see Palms.tsx) */}
      <ShadowLodSwitch lod={lod} material={m.soil} />
      <OutdoorRig variant={variant} quality={quality} shadowExtent={46} center={[2, 0, -6]} sunDistance={90} />
      <StaticBatch deps={[quality, variant, showTents]}>
        <group name="Terrain">
          <Terrain m={m} quality={quality} variant={variant} avoid={avoid} splat={splat} extraShrubs={shrubsInside} prefer={prefer} />
        </group>
        <group name="Farmhouse">
          <Farmhouse m={m} lit={lit} />
        </group>
        <group name="Garden">
          <Garden m={m} quality={quality} />
        </group>
        <group name="Water">
          <Water m={m} />
        </group>
        <group name="Dining">
          <Dining m={m} lit={lit} />
        </group>
        {showTents && <Tents m={m} lit={lit} />}
        <group name="Harvest">
          <Harvest m={m} quality={quality} />
          <DryingMats m={m} />
          <TractorRig m={m} position={[-7.6, 0, 21.35]} rotation={Math.PI - 0.08} />
        </group>
        <group name="Irrigation">
          <GroveChannels m={m} />
          <BasinField m={m} quality={quality} field={FODDER} />
          <BasinField m={m} quality={quality} field={PADDOCK} />
        </group>
        <group name="Majlis">
          <OutdoorMajlis m={m} lit={lit} />
        </group>
        <group name="Scatter">
          <FallenFronds quality={quality} avoid={scatterAvoid} />
          <EdgingStones m={m} quality={quality} blocked={blocked} />
          <FlowerBeds quality={quality} spots={flowerSpots} />
          <Orchard quality={quality} />
          <Yard m={m} />
        </group>
        <group name="Family">
          <FamilyQuarter m={m} quality={quality} pen={pen} />
          <GhafSwing m={m} />
          <Bench m={m} position={[SWING_GHAF.x - 1.2, 0, SWING_GHAF.z + 2.6]} rotation={0.5} />
        </group>
        <group name="Palms">
          <FarmPalms palms={SPECIMEN_PALMS} detail={quality === 'high' ? 'high' : quality} lod={lod} />
          <FarmPalms palms={GROVE_PALMS} detail={quality === 'low' ? 'low' : 'medium'} lod={lod} />
        </group>
        <group name="Basins">
          <PalmBasins m={m} palms={basins} />
        </group>
        <group name="Ghaf">
          <Trees trees={ghaf} style={TREE_STYLES.ghaf} quality={quality} />
        </group>
        <group name="Bougain">
          <Trees trees={bougainvillea} style={TREE_STYLES.bougainvillea} quality={quality} />
        </group>
      </StaticBatch>
      <group name="Animals">
        <PenAnimals quality={quality} pen={pen} />
        <FreeRange quality={quality} />
        <Saluki quality={quality} path={DOG_PATH} />
      </group>
      <Birds count={quality === 'low' ? 8 : 14} center={[2, 24, -12]} radius={46} />
      {quality !== 'low' && (
        <Sparkles count={70} scale={[70, 7, 62]} position={[3, 3.5, -6]} size={2.6} speed={0.2} opacity={0.55} color={lit ? '#FFC58A' : '#FFF1C9'} noise={0.6} />
      )}
    </>
  );
}
