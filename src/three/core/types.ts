import type { ComponentType } from 'react';
import type { SceneId } from '@/data/types';

export type Vec3 = [number, number, number];
export type Quality = 'high' | 'medium' | 'low';
export type Variant = 'golden' | 'morning' | 'dusk';

export interface CameraPose {
  position: Vec3;
  target: Vec3;
}

export interface Anchor {
  /** Where the hotspot marker floats in world space */
  position: Vec3;
  /** Where the camera flies when the hotspot is selected */
  camera: CameraPose;
}

export interface SceneConfig {
  id: SceneId;
  /** Camera pose for the overview */
  home: CameraPose;
  /** Camera field of view */
  fov?: number;
  anchors: Record<string, Anchor>;
  controls: {
    minDistance: number;
    maxDistance: number;
    minPolarAngle: number;
    maxPolarAngle: number;
    /** Optional horizontal orbit limits (radians) — use for cutaway interiors */
    minAzimuthAngle?: number;
    maxAzimuthAngle?: number;
    /** Keep the orbit target inside this box */
    boundary?: { min: Vec3; max: Vec3 };
  };
  /** CSS background shown while the scene boots */
  background: string;
  /** Exposure tweak per scene */
  exposure?: number;
}

export interface SceneProps {
  variant: Variant;
  quality: Quality;
  /** Currently selected hotspot id (scenes may animate the selected area) */
  active: string | null;
  /** Optional provider-specific set pieces, e.g. ['tents'] */
  features?: string[];
}

export interface SceneModule {
  default: ComponentType<SceneProps>;
  config: SceneConfig;
}
