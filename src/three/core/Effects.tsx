import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import type { Quality } from './types';

export interface EffectsProps {
  quality: Quality;
  aoRadius?: number;
  aoIntensity?: number;
  bloom?: number;
  bloomThreshold?: number;
  vignette?: number;
}

/**
 * Post-processing stack. Ambient occlusion is what makes procedural
 * geometry read as a real place, so it stays on for high/medium tiers.
 */
export function Effects({ quality, aoRadius = 1.4, aoIntensity = 2.4, bloom = 0.35, bloomThreshold = 0.82, vignette = 0.42 }: EffectsProps) {
  const effects = [];
  if (quality !== 'low') {
    effects.push(
      <N8AO
        key="ao"
        aoRadius={aoRadius}
        intensity={aoIntensity}
        distanceFalloff={1}
        halfRes={quality !== 'high'}
        quality={quality === 'high' ? 'medium' : 'performance'}
        color="#1a1008"
      />,
    );
  }
  effects.push(<Bloom key="bloom" mipmapBlur intensity={bloom} luminanceThreshold={bloomThreshold} luminanceSmoothing={0.25} radius={0.7} />);
  effects.push(<ToneMapping key="tm" mode={ToneMappingMode.ACES_FILMIC} />);
  effects.push(<Vignette key="vig" offset={0.28} darkness={vignette} />);
  if (quality !== 'high') effects.push(<SMAA key="smaa" />);

  return (
    <EffectComposer multisampling={quality === 'high' ? 4 : 0} enableNormalPass={false}>
      {effects}
    </EffectComposer>
  );
}
