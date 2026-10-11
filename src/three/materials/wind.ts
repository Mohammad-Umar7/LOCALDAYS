import * as THREE from 'three';

/** Shared time uniform for every wind-animated material. */
export const windUniforms = {
  uTime: { value: 0 },
  uWind: { value: 1 },
};

export interface WindOpts {
  /** Amplitude */
  sway?: number;
  /** How quickly motion grows with distance from the origin */
  stiffness?: number;
  speed?: number;
  /** 'height' — sway grows with local y (plants, trees); 'radial' — grows with distance from origin (palm fronds, leaves) */
  mode?: 'height' | 'radial';
}

/**
 * Patches a standard/physical material so vertices sway in the wind
 * (works with InstancedMesh). Geometry origin should be the attachment point.
 */
export function applyWind<T extends THREE.MeshStandardMaterial>(mat: T, opts: WindOpts = {}): T {
  const { sway = 0.08, stiffness = 1, speed = 1, mode = 'height' } = opts;
  const amount = mode === 'radial' ? 'length(transformed)' : 'max(transformed.y, 0.0)';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWind = windUniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         uniform float uWind;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         {
           #ifdef USE_INSTANCING
             vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
           #else
             vec3 ip = vec3(modelMatrix[3][0], modelMatrix[3][1], modelMatrix[3][2]);
           #endif
           float ph = dot(ip.xz, vec2(0.37, 0.61)) + ip.y * 0.3;
           float h = ${amount} * ${stiffness.toFixed(3)};
           float k = h * h * ${sway.toFixed(4)} * uWind;
           float t = uTime * ${speed.toFixed(3)};
           float gust = 0.65 + 0.35 * sin(t * 0.45 + ph * 0.2);
           transformed.x += (sin(t * 1.7 + ph) * 0.8 + sin(t * 3.1 + ph * 2.3) * 0.2) * k * gust;
           transformed.y += sin(t * 2.1 + ph * 1.7) * k * 0.35 * gust;
           transformed.z += (cos(t * 1.3 + ph * 1.3) * 0.6) * k * gust;
         }`,
      );
  };
  mat.customProgramCacheKey = () => `wind-${mode}-${sway}-${stiffness}-${speed}`;
  return mat;
}
