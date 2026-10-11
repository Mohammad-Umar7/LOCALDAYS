import { useMemo } from 'react';
import * as THREE from 'three';
import type { Quality, Vec3 } from '../../core/types';
import { Trees, type TreeStyle } from '../../props/Trees';
import { Bougainvillea, type CascadeSpec } from './Bougainvillea';
import { latheSimple } from './geometry';
import { BACK, COURT, FY, LEFT } from './layout';
import type { PotteryMaterials } from './materials';

/* ------------------------------------------------------------------ */
/*  Planting: bougainvillea spilling over the parapets from the        */
/*  neighbouring roofs, and an old olive in a big terracotta pot.      */
/* ------------------------------------------------------------------ */

const OLIVE: TreeStyle = {
  trunkHeight: 0.85,
  trunkRadius: 0.075,
  levels: 3,
  branchCount: [2, 3],
  spread: 0.95,
  lengthDecay: 0.74,
  radiusDecay: 0.62,
  gnarl: 0.6,
  droop: 0.12,
  leafColor: '#6A7A55',
  leafColor2: '#A3AE8C',
  leafSize: 0.052,
  leavesPerTip: 420,
  clusterRadius: 0.36,
  barkColor: '#7A6C5C',
};

const CASCADES: CascadeSpec[] = [
  { from: COURT.x0 + 0.15, to: COURT.x0 + 2.55, top: BACK.h + 0.08, face: COURT.z0, out: 1, axis: 'x', drop: 1.45, seed: 5 },
  { from: COURT.z1 - 1.9, to: COURT.z1 - 0.05, top: LEFT.h + 0.08, face: COURT.x0, out: 1, axis: 'z', drop: 1.1, seed: 11 },
];

export function Plants({ m, quality }: { m: PotteryMaterials; quality: Quality }) {
  const pot = useMemo(
    () =>
      latheSimple(
        [
          [0.0005, 0.02],
          [0.2, 0.02],
          [0.22, 0.0],
          [0.3, 0.12],
          [0.36, 0.4],
          [0.39, 0.5],
          [0.41, 0.52],
          [0.395, 0.55],
          [0.37, 0.53],
          [0.35, 0.46],
          [0.0005, 0.46],
        ],
        { segments: 56, uvDensity: 4 },
      ),
    [],
  );
  const soil = useMemo(() => {
    const g = new THREE.CircleGeometry(0.35, 32);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const potPos: Vec3 = [COURT.x1 - 0.72, FY, COURT.z1 - 0.75];
  const olive = useMemo(() => [{ position: [potPos[0], FY + 0.45, potPos[2]] as Vec3, seed: 31, scale: 1.25, rotation: 0.5 }], []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group>
      <mesh geometry={pot} material={m.terracotta} position={potPos} castShadow receiveShadow />
      <mesh geometry={soil} material={m.clayDry} position={[potPos[0], FY + 0.46, potPos[2]]} receiveShadow />
      <Trees trees={olive} style={OLIVE} quality={quality} />
      {CASCADES.map((c, i) => (
        <Bougainvillea key={i} spec={c} quality={quality} />
      ))}
    </group>
  );
}
