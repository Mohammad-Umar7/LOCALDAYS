import * as THREE from 'three';
import { SUN_PRESETS, sunDirection, type SunPreset } from '../../core/Rigs';
import type { Variant } from '../../core/types';

/** Sun placement per mood: always raking in from the open right side so forms are side-lit. */
export const SUN: Record<Variant, Partial<SunPreset>> = {
  golden: { elevation: 19, azimuth: 70 },
  morning: { elevation: 40, azimuth: 50 },
  dusk: { elevation: 7, azimuth: 80 },
};

/** Unit vector pointing towards the sun for a variant. */
export function sunDir(variant: Variant) {
  const p = { ...SUN_PRESETS[variant], ...SUN[variant] };
  return sunDirection(p);
}

export function sunColor(variant: Variant) {
  return new THREE.Color(SUN_PRESETS[variant].sunColor);
}
