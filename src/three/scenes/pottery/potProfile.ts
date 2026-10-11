import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/*  Parametric thrown-pot profile with a FIXED point count, so shapes  */
/*  can be morphed point-for-point (wheel animation, ClayStudio).      */
/* ------------------------------------------------------------------ */

export interface PotParams {
  /** Height (m) */
  h: number;
  /** Radius at the foot */
  base: number;
  /** Belly radius and its height fraction */
  belly: number;
  bellyAt: number;
  /** Neck radius and its height fraction */
  neck: number;
  neckAt: number;
  /** Rim radius */
  lip: number;
  /** Wall thickness */
  wall: number;
  /** 0 = solid mound (not yet opened) … 1 = fully opened vessel */
  open: number;
  /** Throwing-ring amplitude (m) */
  rings: number;
}

export const POT_ROWS = { base: 3, outer: 30, lip: 7, inner: 22 };
export const POT_ROW_COUNT = POT_ROWS.base + POT_ROWS.outer + POT_ROWS.lip + POT_ROWS.inner + 1;

export function lerpParams(a: PotParams, b: PotParams, t: number, out: PotParams): PotParams {
  (Object.keys(a) as (keyof PotParams)[]).forEach((k) => {
    out[k] = a[k] + (b[k] - a[k]) * t;
  });
  return out;
}

/** Catmull-Rom style radius along the height (0..1) through foot, belly, neck and rim. */
function radiusAt(p: PotParams, v: number) {
  const ks = [0, p.bellyAt, p.neckAt, 1];
  const rs = [p.base, p.belly, p.neck, p.lip];
  let k = 0;
  while (k < 2 && v > ks[k + 1]) k++;
  const t = (v - ks[k]) / Math.max(1e-4, ks[k + 1] - ks[k]);
  // tangents (finite differences, clamped at the ends)
  const m = (i: number) => {
    if (i === 0) return (rs[1] - rs[0]) / Math.max(1e-4, ks[1] - ks[0]) * 0.6;
    if (i === 3) return (rs[3] - rs[2]) / Math.max(1e-4, ks[3] - ks[2]) * 0.8;
    return ((rs[i + 1] - rs[i - 1]) / Math.max(1e-4, ks[i + 1] - ks[i - 1])) * 0.5;
  };
  const dk = ks[k + 1] - ks[k];
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return h00 * rs[k] + h10 * dk * m(k) + h01 * rs[k + 1] + h11 * dk * m(k + 1);
}

/** Writes the full closed profile (foot → outside → lip → inside → inner floor) into `out`. */
export function potProfile(p: PotParams, out: THREE.Vector2[] = []): THREE.Vector2[] {
  const { outer: no, lip: nl, inner: ni } = POT_ROWS;
  while (out.length < POT_ROW_COUNT) out.push(new THREE.Vector2());
  let k = 0;
  const set = (r: number, y: number) => out[k++].set(Math.max(0.0004, r), y);
  const H = p.h;
  const open = THREE.MathUtils.clamp(p.open, 0, 1);
  // foot (slightly recessed base)
  set(0.0004, 0.003);
  set(p.base * 0.84, 0.003);
  set(p.base * 0.93, 0);
  // outer wall
  const ring = (y: number, v: number) => p.rings * Math.sin((y / 0.0105) * Math.PI * 2 + 0.6) * THREE.MathUtils.smoothstep(v, 0.06, 0.2) * (1 - THREE.MathUtils.smoothstep(v, 0.9, 1));
  for (let i = 0; i < no; i++) {
    const v = i / (no - 1);
    const y = v * H;
    set(radiusAt(p, v) + ring(y, v), y);
  }
  // lip: semicircle from outer rim to inner rim
  const innerRim = Math.max(0.0004, (p.lip - p.wall) * open);
  const rad = Math.max(0.001, (p.lip - innerRim) / 2);
  const cx = (p.lip + innerRim) / 2;
  for (let i = 1; i <= nl; i++) {
    const a = (i / (nl + 1)) * Math.PI;
    set(cx + Math.cos(a) * rad, H + Math.sin(a) * rad * (0.55 + 0.45 * open));
  }
  // inner wall (collapses onto the top when not yet opened)
  const floorY = THREE.MathUtils.lerp(H, Math.min(H * 0.35, p.wall * 1.6 + 0.004), open);
  for (let i = 0; i < ni; i++) {
    const v = 1 - i / (ni - 1);
    const yWall = THREE.MathUtils.lerp(floorY, H, v);
    const rWall = Math.max(0.0004, radiusAt(p, yWall / Math.max(H, 1e-4)) - p.wall + ring(yWall, v) * 0.6);
    // the bottom of the inside curves into the floor
    const curve = THREE.MathUtils.smoothstep(v, 0, 0.18);
    set(rWall * open * (0.45 + 0.55 * curve), THREE.MathUtils.lerp(H, yWall, open));
  }
  set(0.0004, THREE.MathUtils.lerp(H, floorY, open));
  return out;
}

/* ------------------------------------------------------------------ */
/*  Lathe surface whose profile can be rewritten every frame.          */
/* ------------------------------------------------------------------ */

export class LatheBuffer {
  readonly geometry = new THREE.BufferGeometry();
  private pos: Float32Array;
  private nor: Float32Array;
  private uv: Float32Array;
  private sin: Float32Array;
  private cos: Float32Array;
  private n2: THREE.Vector2[];
  private col: Float32Array | null = null;

  constructor(
    readonly rows: number,
    readonly segments: number,
    radius = 0.4,
    withColor = false,
  ) {
    const cols = segments + 1;
    this.pos = new Float32Array(rows * cols * 3);
    this.nor = new Float32Array(rows * cols * 3);
    this.uv = new Float32Array(rows * cols * 2);
    this.sin = new Float32Array(cols);
    this.cos = new Float32Array(cols);
    this.n2 = Array.from({ length: rows }, () => new THREE.Vector2());
    for (let j = 0; j < cols; j++) {
      const t = (j / segments) * Math.PI * 2;
      this.sin[j] = Math.sin(t);
      this.cos[j] = Math.cos(t);
    }
    const idx: number[] = [];
    for (let j = 0; j < segments; j++)
      for (let i = 0; i < rows - 1; i++) {
        const a = j * rows + i;
        const b = (j + 1) * rows + i;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    this.geometry.setIndex(idx);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    if (withColor) {
      this.col = new Float32Array(rows * cols * 3).fill(1);
      this.geometry.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    }
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, radius * 0.5, 0), radius);
  }

  /** `wobble(theta, y)` adds a small radial offset (off-centre clay, finger marks). */
  update(profile: THREE.Vector2[], wobble?: (j: number, y: number) => number, uvScale = 6, color?: (row: number, y: number) => [number, number, number]) {
    const { rows, segments } = this;
    const cols = segments + 1;
    // 2D normals by central differences: n = (dy, -dr)
    let lx = 0;
    let ly = 1;
    for (let i = 0; i < rows; i++) {
      const a = profile[Math.max(0, i - 1)];
      const b = profile[Math.min(rows - 1, i + 1)];
      const dr = b.x - a.x;
      const dy = b.y - a.y;
      const l = Math.hypot(dr, dy);
      if (l > 1e-7) {
        lx = dy / l;
        ly = -dr / l;
      }
      this.n2[i].set(lx, ly);
    }
    let s = 0;
    for (let i = 0; i < rows; i++) {
      if (i > 0) s += profile[i].distanceTo(profile[i - 1]);
      const r0 = profile[i].x;
      const y = profile[i].y;
      const n = this.n2[i];
      const c = color && this.col ? color(i, y) : null;
      for (let j = 0; j < cols; j++) {
        const r = r0 + (wobble && r0 > 0.002 ? wobble(j % segments, y) : 0);
        const o = (j * rows + i) * 3;
        this.pos[o] = r * this.sin[j];
        this.pos[o + 1] = y;
        this.pos[o + 2] = r * this.cos[j];
        this.nor[o] = n.x * this.sin[j];
        this.nor[o + 1] = n.y;
        this.nor[o + 2] = n.x * this.cos[j];
        const u = (j * rows + i) * 2;
        this.uv[u] = (j / segments) * 3;
        this.uv[u + 1] = s * uvScale;
        if (c && this.col) {
          this.col[o] = c[0];
          this.col[o + 1] = c[1];
          this.col[o + 2] = c[2];
        }
      }
    }
    if (color && this.col) this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
    this.geometry.attributes.uv.needsUpdate = true;
  }
}
