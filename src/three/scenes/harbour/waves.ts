import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/*  Gerstner wave spectrum shared by the water shader and the CPU, so  */
/*  boats and floats heave, pitch and roll exactly with the surface.   */
/*  Each wave is damped inside the breakwater (`sheltered` = the       */
/*  fraction that survives in the basin) and faded where the water    */
/*  grid gets too coarse to carry it (`coreDist` metres outside the   */
/*  fine core).                                                        */
/* ------------------------------------------------------------------ */

interface WaveSpec {
  /** propagation heading in degrees (0 = +x, 90 = +z / shoreward) */
  dir: number;
  L: number;
  A: number;
  Q: number;
  phase: number;
  sheltered: number;
}

const SPECS: WaveSpec[] = [
  { dir: 98, L: 36, A: 0.2, Q: 0.35, phase: 0.0, sheltered: 0.14 },
  { dir: 74, L: 22, A: 0.1, Q: 0.45, phase: 1.3, sheltered: 0.18 },
  { dir: 121, L: 12.5, A: 0.05, Q: 0.6, phase: 2.1, sheltered: 0.42 },
  { dir: 38, L: 7.6, A: 0.032, Q: 0.6, phase: 4.2, sheltered: 0.55 },
  { dir: 153, L: 4.7, A: 0.02, Q: 0.5, phase: 0.7, sheltered: 0.65 },
  { dir: -24, L: 3.1, A: 0.011, Q: 0.45, phase: 3.3, sheltered: 0.75 },
];

export const WAVE_COUNT = SPECS.length;
const G = 9.81;
const SPEED = 0.92;

export const WAVES = SPECS.map((s) => {
  const a = THREE.MathUtils.degToRad(s.dir);
  const k = (Math.PI * 2) / s.L;
  return {
    dx: Math.cos(a),
    dz: Math.sin(a),
    k,
    w: Math.sqrt(G * k) * SPEED,
    A: s.A,
    Q: s.Q,
    phase: s.phase,
    sheltered: s.sheltered,
    /** grid-resolution fade: full until f0, gone by f1 (metres outside the core) */
    f0: Math.max(0, (s.L / 5 - 0.75) / 0.13) * 0.5,
    f1: Math.max(4, (s.L / 5 - 0.75) / 0.13 + 4),
  };
});

/** Uniform payload: A = (dx, dz, k, w), B = (A, Q, phase, sheltered), C = (f0, f1, 0, 0). */
export function waveUniforms() {
  return {
    uWaveA: { value: WAVES.map((w) => new THREE.Vector4(w.dx, w.dz, w.k, w.w)) },
    uWaveB: { value: WAVES.map((w) => new THREE.Vector4(w.A, w.Q, w.phase, w.sheltered)) },
    uWaveC: { value: WAVES.map((w) => new THREE.Vector4(w.f0, w.f1, 0, 0)) },
  };
}

/** GLSL: declares the uniforms + `void hbWaves(vec2 p, float shelter, float core, out vec3 disp, out vec3 nrm)`. */
export const WAVE_GLSL = /* glsl */ `
uniform vec4 uWaveA[${WAVE_COUNT}];
uniform vec4 uWaveB[${WAVE_COUNT}];
uniform vec4 uWaveC[${WAVE_COUNT}];
uniform float uHbTime;
void hbWaves(vec2 p, float shelter, float core, out vec3 disp, out vec3 nrm) {
  disp = vec3(0.0);
  vec3 n = vec3(0.0, 1.0, 0.0);
  for (int i = 0; i < ${WAVE_COUNT}; i++) {
    vec4 a = uWaveA[i];
    vec4 b = uWaveB[i];
    vec4 c = uWaveC[i];
    float amp = b.x * mix(b.w, 1.0, shelter) * (1.0 - smoothstep(c.x, c.y, core));
    float th = a.z * dot(a.xy, p) - a.w * uHbTime + b.z;
    float cs = cos(th);
    float sn = sin(th);
    disp.x += b.y * amp * a.x * cs;
    disp.z += b.y * amp * a.y * cs;
    disp.y += amp * sn;
    n.x -= a.x * a.z * amp * cs;
    n.z -= a.y * a.z * amp * cs;
    n.y -= b.y * a.z * amp * sn;
  }
  nrm = normalize(n);
}
`;

export interface WaterSample {
  y: number;
  nx: number;
  ny: number;
  nz: number;
}

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** CPU twin of `hbWaves` (height + normal at a horizontal position). */
export function sampleWaves(x: number, z: number, t: number, shelter: number, core = 0, out: WaterSample = { y: 0, nx: 0, ny: 1, nz: 0 }) {
  let y = 0;
  let nx = 0;
  let ny = 1;
  let nzv = 0;
  for (let i = 0; i < WAVES.length; i++) {
    const w = WAVES[i];
    const amp = w.A * (w.sheltered + (1 - w.sheltered) * shelter) * (1 - smoothstep(w.f0, w.f1, core));
    const th = w.k * (w.dx * x + w.dz * z) - w.w * t + w.phase;
    const cs = Math.cos(th);
    const sn = Math.sin(th);
    y += amp * sn;
    nx -= w.dx * w.k * amp * cs;
    nzv -= w.dz * w.k * amp * cs;
    ny -= w.Q * w.k * amp * sn;
  }
  const l = Math.hypot(nx, ny, nzv);
  out.y = y;
  out.nx = nx / l;
  out.ny = ny / l;
  out.nz = nzv / l;
  return out;
}
