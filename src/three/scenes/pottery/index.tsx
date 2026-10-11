import { useMemo } from 'react';
import { OutdoorRig } from '../../core/Rigs';
import { StaticBatch } from '../../core/StaticBatch';
import type { SceneConfig, SceneProps } from '../../core/types';
import { Lantern, StringLights } from '../../props/Decor';
import { Architecture } from './Architecture';
import { Atmosphere } from './Atmosphere';
import { Details } from './Details';
import { Display } from './Display';
import { GlazeStation } from './Glaze';
import { Kiln } from './Kiln';
import { COURT, FY, NICHES, PREP, TABLE } from './layout';
import { usePotteryMaterials } from './materials';
import { Plants } from './Plants';
import { Prep, WaterJars } from './Prep';
import { SUN } from './sun';
import { Wheels } from './Wheels';
import { DetailContext } from './Vessels';
import { Workshop } from './Workshop';

/* ================================================================== */
/*  Pottery venue — Fakhar House Studio, a courtyard studio in the     */
/*  Heart of Sharjah (and the other pottery hosts via variants).       */
/* ================================================================== */

export const config: SceneConfig = {
  id: 'pottery',
  fov: 34,
  home: { position: [-1.64, 6.64, 13.43], target: [-0.15, 1.5, -0.9] },
  anchors: {
    wheel: { position: [-1.85, 1.45, 0.72], camera: { position: [-0.55, 1.95, 3.5], target: [-1.95, 0.72, 0.55] } },
    prep: { position: [-4.88, 1.75, 1.62], camera: { position: [-2.0, 2.6, 4.9], target: [-4.85, 0.85, 1.6] } },
    display: { position: [-0.25, 3.25, -3.6], camera: { position: [1.5, 2.2, 1.9], target: [-0.35, 1.5, -3.7] } },
    kiln: { position: [3.55, 2.55, -3.05], camera: { position: [4.95, 2.15, 0.35], target: [3.45, 1.05, -3.0] } },
    glaze: { position: [-4.12, 2.75, -3.6], camera: { position: [-1.6, 2.4, 0.9], target: [-4.1, 1.15, -3.5] } },
    seating: { position: [0.62, 1.45, 2.36], camera: { position: [3.5, 3.1, 6.5], target: [0.45, 0.82, 2.1] } },
  },
  controls: {
    minDistance: 2.5,
    maxDistance: 26,
    minPolarAngle: 0.3,
    maxPolarAngle: 1.36,
    minAzimuthAngle: -0.55,
    maxAzimuthAngle: 1.15,
    boundary: { min: [COURT.x0, 0, COURT.z0], max: [COURT.x1, 3, 5] },
  },
  background: '#E2C9A6',
};

/** Evening practicals: lanterns everywhere, festoon lights over the class table. */
function Practicals({ lit }: { lit: boolean }) {
  return (
    <group>
      {lit && (
        <StringLights
          lit
          sag={0.45}
          bulbs={14}
          points={[
            [COURT.x0 + 0.05, 3.45, 3.55],
            [COURT.x1 - 0.05, 3.25, 2.95],
          ]}
        />
      )}
      <Lantern position={[NICHES.x[1] - 0.07, 2.9, COURT.z0 + 0.38]} hanging lit={lit} light={lit} scale={0.95} />
      <Lantern position={[NICHES.x[1] + 1.22, FY + 0.42, COURT.z0 + 0.66]} lit={lit} scale={0.75} />
      <Lantern position={[TABLE.x - 0.42, FY + 0.78, TABLE.z + 0.1]} lit={lit} light={lit} scale={0.8} />
      <Lantern position={[PREP.x + 0.28, FY + 0.83, PREP.z - 0.72]} lit={lit} scale={0.7} />
    </group>
  );
}

export default function PotteryScene({ variant, quality, active }: SceneProps) {
  const m = usePotteryMaterials();
  const lit = variant === 'dusk';
  const lod = useMemo(() => (quality === 'high' ? { seg: 1, cast: true } : quality === 'medium' ? { seg: 0.72, cast: false } : { seg: 0.55, cast: false }), [quality]);
  return (
    <>
      <OutdoorRig variant={variant} quality={quality} shadowExtent={11} center={[0, 0, -0.5]} sunDistance={60} overrides={SUN[variant]} />
      <DetailContext.Provider value={lod}>
        <StaticBatch deps={[quality, variant]}>
          <Architecture m={m} quality={quality} />
          <Display m={m} />
          <GlazeStation m={m} />
          <Prep m={m} />
          <WaterJars m={m} />
          <Workshop m={m} />
          <Kiln m={m} variant={variant} active={active} />
          <Wheels m={m} quality={quality} active={active} />
          <Plants m={m} quality={quality} />
          <Details m={m} />
          <Practicals lit={lit} />
        </StaticBatch>
      </DetailContext.Provider>
      <Atmosphere variant={variant} quality={quality} />
    </>
  );
}
