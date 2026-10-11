import * as THREE from 'three';
import { mixRGB, rgb, type RGB } from './tex';

/* ------------------------------------------------------------------ */
/*  Geometry for the pottery studio: a lathe builder with analytic     */
/*  normals + vertex colours, and thrown vessels made of a clay body   */
/*  plus a separate glaze shell (drips, pooling, breaking at the rim). */
/* ------------------------------------------------------------------ */

export function rand(seed: number) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normals2D(pr: THREE.Vector2[]) {
  const out: THREE.Vector2[] = [];
  let last = new THREE.Vector2(1, 0);
  for (let i = 0; i < pr.length; i++) {
    const a = pr[Math.max(0, i - 1)];
    const b = pr[Math.min(pr.length - 1, i + 1)];
    const dr = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dr, dy);
    if (l > 1e-7) last = new THREE.Vector2(dy / l, -dr / l);
    out.push(last.clone());
  }
  return out;
}

export interface LatheOpts {
  segments?: number;
  /** Vertex colour for row i of column j */
  color?: (i: number, j: number, theta: number) => RGB;
  /** Texture repeats per metre along the profile and around the circumference */
  uvDensity?: number;
  /** Offset every point along its normal (glaze thickness) */
  offset?: number;
}

/** Lathe surface from one profile per column (all profiles must have the same length). */
export function latheColumns(columns: (j: number) => THREE.Vector2[], opts: LatheOpts = {}) {
  const segments = opts.segments ?? 48;
  const cols = segments + 1;
  const first = columns(0);
  const rows = first.length;
  const pos = new Float32Array(rows * cols * 3);
  const nor = new Float32Array(rows * cols * 3);
  const uv = new Float32Array(rows * cols * 2);
  const col = opts.color ? new Float32Array(rows * cols * 3) : null;
  const dens = opts.uvDensity ?? 8;
  let rMax = 0;
  for (const p of first) rMax = Math.max(rMax, p.x);
  const around = Math.max(1, Math.round(Math.PI * 2 * rMax * dens));
  for (let j = 0; j < cols; j++) {
    const theta = (j / segments) * Math.PI * 2;
    const sn = Math.sin(theta);
    const cs = Math.cos(theta);
    const pr = j === 0 ? first : columns(j % segments === 0 ? 0 : j);
    const n2 = normals2D(pr);
    let s = 0;
    for (let i = 0; i < rows; i++) {
      if (i > 0) s += pr[i].distanceTo(pr[i - 1]);
      const off = opts.offset ?? 0;
      const r = Math.max(0.0003, pr[i].x + n2[i].x * off);
      const y = pr[i].y + n2[i].y * off;
      const o = (j * rows + i) * 3;
      pos[o] = r * sn;
      pos[o + 1] = y;
      pos[o + 2] = r * cs;
      nor[o] = n2[i].x * sn;
      nor[o + 1] = n2[i].y;
      nor[o + 2] = n2[i].x * cs;
      const u = (j * rows + i) * 2;
      uv[u] = (j / segments) * around;
      uv[u + 1] = s * dens;
      if (col && opts.color) {
        const c = opts.color(i, j % segments, theta);
        col[o] = c[0];
        col[o + 1] = c[1];
        col[o + 2] = c[2];
      }
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < segments; j++)
    for (let i = 0; i < rows - 1; i++) {
      const a = j * rows + i;
      const b = (j + 1) * rows + i;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export function latheSimple(profile: [number, number][], opts: LatheOpts = {}) {
  const pr = profile.map(([r, y]) => new THREE.Vector2(r, y));
  return latheColumns(() => pr, opts);
}

/** Uniform vertex colour (needed when a geometry shares a vertex-coloured material). */
export function paint<T extends THREE.BufferGeometry>(g: T, c: RGB | string): T {
  const cc = typeof c === 'string' ? rgb(c) : c;
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    a[i * 3] = cc[0];
    a[i * 3 + 1] = cc[1];
    a[i * 3 + 2] = cc[2];
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

/* ================================ Vessels ================================ */

export interface Form {
  /** Outer control points [r, y] from the foot up to the rim (metres) */
  pts: [number, number][];
  wall?: number;
  /** Mug handle */
  handle?: boolean;
}

export type GlazeName = 'sand' | 'gulf' | 'celadon' | 'charcoal' | 'terracotta' | 'cream' | 'honey' | 'teal';
export type Finish = 'gloss' | 'satin' | 'matte';
export interface GlazeDef {
  main: string;
  pool: string;
  brk: string;
  finish: Finish;
}

export const GLAZES: Record<GlazeName, GlazeDef> = {
  sand: { main: '#D6BF98', pool: '#A98257', brk: '#EEE2C8', finish: 'satin' },
  gulf: { main: '#163F6C', pool: '#0A2140', brk: '#5F8EB6', finish: 'gloss' },
  celadon: { main: '#9CC0A8', pool: '#5C8C73', brk: '#D3E4D5', finish: 'gloss' },
  charcoal: { main: '#34302D', pool: '#1D1A18', brk: '#6B635B', finish: 'matte' },
  terracotta: { main: '#B4603A', pool: '#7E3A1F', brk: '#D9946A', finish: 'satin' },
  cream: { main: '#ECE4D3', pool: '#C9B795', brk: '#FBF8F0', finish: 'gloss' },
  honey: { main: '#B87A2E', pool: '#6E3F12', brk: '#E2B675', finish: 'gloss' },
  teal: { main: '#2F7F82', pool: '#174A4E', brk: '#86BDB9', finish: 'gloss' },
};

export const BODIES = {
  buff: '#CDB79A',
  red: '#A9673F',
  dark: '#5E5047',
  porcelain: '#EDE7DC',
  bisque: '#D6B798',
  terracotta: '#B0633D',
  green: '#9E8E7E',
};
export type BodyName = keyof typeof BODIES;

interface Built {
  profile: THREE.Vector2[];
  outer: THREE.CatmullRomCurve3;
  outerLen: number;
  /** Row ranges inside `profile` */
  lip: THREE.Vector2[];
  inner: THREE.Vector2[];
  rMax: number;
  height: number;
}

const builtCache = new Map<string, Built>();

/** Builds the full closed vessel profile: foot → outside → rounded lip → inside → inner floor. */
function buildProfile(form: Form, detail: number): Built {
  const key = JSON.stringify(form) + detail;
  const hit = builtCache.get(key);
  if (hit) return hit;
  const wall = form.wall ?? 0.0065;
  const ctrl = form.pts.map(([r, y]) => new THREE.Vector3(r, y, 0));
  const outer = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
  const nOut = Math.round(12 * detail);
  const outerPts = outer.getSpacedPoints(nOut).map((p) => new THREE.Vector2(p.x, p.y));
  const on = normals2D(outerPts);
  const r0 = form.pts[0][0];
  const foot = [new THREE.Vector2(0.0004, 0.004), new THREE.Vector2(r0 * 0.82, 0.004), new THREE.Vector2(r0 * 0.9, 0)];
  // rounded lip
  const rim = outerPts[outerPts.length - 1];
  const nR = on[on.length - 1];
  const tR = new THREE.Vector2(-nR.y, nR.x); // tangent (pointing "up" the wall)
  const c = rim.clone().addScaledVector(nR, -wall / 2);
  const lip: THREE.Vector2[] = [];
  const nLip = 5;
  for (let i = 1; i <= nLip; i++) {
    const a = (i / (nLip + 1)) * Math.PI;
    lip.push(c.clone().addScaledVector(nR, Math.cos(a) * (wall / 2)).addScaledVector(tR, Math.sin(a) * (wall / 2) * 0.9));
  }
  // inside: offset the outside inwards, downwards from the rim
  const floorY = Math.max(0.008, wall * 1.4);
  const innerAll: THREE.Vector2[] = [];
  for (let i = outerPts.length - 1; i >= 0; i--) {
    const p = outerPts[i].clone().addScaledVector(on[i], -wall);
    if (p.y <= floorY) break;
    p.x = Math.max(0.0004, p.x);
    innerAll.push(p);
  }
  // thin the inside a little (it is mostly unseen) but keep the rim region dense
  const inner: THREE.Vector2[] = innerAll.filter((_, i) => i < 3 || i % 2 === 0 || i === innerAll.length - 1);
  const last = inner[inner.length - 1] ?? new THREE.Vector2(r0 - wall, floorY + 0.01);
  inner.push(new THREE.Vector2(Math.max(0.0005, last.x * 0.75), floorY + (last.y - floorY) * 0.2));
  inner.push(new THREE.Vector2(Math.max(0.0005, last.x * 0.35), floorY));
  inner.push(new THREE.Vector2(0.0004, floorY));
  const profile = [...foot, ...outerPts, ...lip, ...inner];
  let rMax = 0;
  for (const p of profile) rMax = Math.max(rMax, p.x);
  const built: Built = { profile, outer, outerLen: outer.getLength(), lip, inner, rMax, height: rim.y };
  builtCache.set(key, built);
  return built;
}

export interface VesselGeo {
  body: THREE.BufferGeometry;
  glaze: THREE.BufferGeometry | null;
  height: number;
  rMax: number;
}

export interface VesselOpts {
  glaze?: GlazeName | null;
  body?: BodyName;
  seed?: number;
  /** Where the glaze stops on the outside (0 = foot, 1 = rim) */
  dip?: number;
  /** Number of glaze drips */
  drips?: number;
  segments?: number;
  detail?: number;
  /** Darken the lower body (water jars sweating, dirt) */
  damp?: number;
}

/** Clay body + glaze shell for one vessel. Unique drips per seed. */
export function vesselGeometry(form: Form, o: VesselOpts = {}): VesselGeo {
  const seed = o.seed ?? 1;
  const r = rand(seed);
  const segs = o.segments ?? 48;
  const b = buildProfile(form, o.detail ?? 1);
  const bodyCol = rgb(BODIES[o.body ?? 'buff']);
  const tone = 0.94 + r() * 0.1;
  const damp = o.damp ?? 0;
  const footRows = 3;
  const nOuter = b.profile.length - b.lip.length - b.inner.length - footRows;
  const body = latheColumns(() => b.profile, {
    segments: segs,
    uvDensity: 7,
    color: (i, _j, th) => {
      const y = b.profile[i].y / Math.max(0.01, b.height);
      const outerRow = i >= footRows && i < footRows + nOuter;
      const dirt = outerRow ? (1 - THREE.MathUtils.smoothstep(y, 0, 0.12)) * 0.12 : 0;
      const wet = damp * (1 - THREE.MathUtils.smoothstep(y, 0.05, 0.6)) * (0.8 + 0.2 * Math.sin(th * 3 + seed));
      const k = tone * (1 - dirt) * (1 - wet * 0.35);
      return [bodyCol[0] * k, bodyCol[1] * k, bodyCol[2] * k * (1 - wet * 0.05)];
    },
  });
  if (!o.glaze) return { body, glaze: null, height: b.height, rMax: b.rMax };

  const g = GLAZES[o.glaze];
  const main = rgb(g.main);
  const pool = rgb(g.pool);
  const brk = rgb(g.brk);
  const dip = o.dip ?? 0.22;
  const drips = Array.from({ length: o.drips ?? 3 }, () => ({ a: r() * Math.PI * 2, w: 0.08 + r() * 0.12, d: 0.06 + r() * 0.12 }));
  const wave = [r() * 6, r() * 6];
  const startAt = (theta: number) => {
    let s = dip + Math.sin(theta * 3 + wave[0]) * 0.015 + Math.sin(theta * 7 + wave[1]) * 0.008;
    for (const d of drips) {
      let da = Math.abs(theta - d.a);
      da = Math.min(da, Math.PI * 2 - da);
      s -= d.d * Math.exp(-(da / d.w) * (da / d.w));
    }
    return Math.max(0.03, s);
  };
  const nG = Math.max(6, Math.round(nOuter * 0.85));
  const common = [...b.lip, ...b.inner];
  const cache = new Map<number, THREE.Vector2[]>();
  const column = (j: number) => {
    const hit = cache.get(j);
    if (hit) return hit;
    const theta = (j / segs) * Math.PI * 2;
    const s0 = startAt(theta);
    const pts: THREE.Vector2[] = [];
    for (let k = 0; k < nG; k++) {
      const s = s0 + (1 - s0) * (k / (nG - 1));
      const p = b.outer.getPointAt(Math.min(1, s));
      pts.push(new THREE.Vector2(p.x, p.y));
    }
    const out = [...pts, ...common];
    cache.set(j, out);
    return out;
  };
  const tint = 0.96 + r() * 0.08;
  const glaze = latheColumns(column, {
    segments: segs,
    uvDensity: 7,
    offset: 0.0011,
    color: (i, j, th) => {
      const s0 = startAt(th);
      const run = (dip - s0) / 0.18; // >0 inside a drip tongue
      let c: RGB;
      if (i < nG) {
        const t = i / (nG - 1);
        const bead = Math.exp(-t * 9) * 0.85 + Math.max(0, run) * Math.exp(-t * 4) * 0.5;
        c = mixRGB(main, pool, Math.min(1, bead));
        c = mixRGB(c, brk, THREE.MathUtils.smoothstep(t, 0.86, 1) * 0.55);
      } else if (i < nG + b.lip.length) {
        c = mixRGB(main, brk, 0.75);
      } else {
        const k = (i - nG - b.lip.length) / Math.max(1, b.inner.length - 1);
        c = mixRGB(mixRGB(main, brk, (1 - THREE.MathUtils.smoothstep(k, 0, 0.12)) * 0.45), pool, THREE.MathUtils.smoothstep(k, 0.55, 1) * 0.75);
      }
      const v = tint * (1 + Math.sin(th * 3 + wave[0] + j * 0.0) * 0.025 + Math.sin(th * 11 + wave[1]) * 0.015);
      return [c[0] * v, c[1] * v, c[2] * v];
    },
  });
  if (form.handle) {
    const hr = b.rMax;
    const h = b.height;
    const pts = [
      new THREE.Vector3(0, h * 0.8, hr - 0.004),
      new THREE.Vector3(0, h * 0.82, hr + 0.026),
      new THREE.Vector3(0, h * 0.6, hr + 0.036),
      new THREE.Vector3(0, h * 0.34, hr + 0.028),
      new THREE.Vector3(0, h * 0.26, hr - 0.004),
    ];
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 18, 0.0068, 8, false);
    tube.scale(1.35, 1, 1); // strap handles are wider than deep
    paint(tube, mixRGB(main, brk, 0.2));
    const merged = mergeIndexed([glaze, tube]);
    return { body, glaze: merged, height: b.height, rMax: b.rMax };
  }
  return { body, glaze, height: b.height, rMax: b.rMax };
}

/** Minimal indexed merge (position, normal, uv, color). */
export function mergeIndexed(gs: THREE.BufferGeometry[]) {
  const names = ['position', 'normal', 'uv', 'color'] as const;
  let vCount = 0;
  let iCount = 0;
  for (const g of gs) {
    vCount += g.attributes.position.count;
    iCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  const idx = new Uint32Array(iCount);
  const arrays: Record<string, Float32Array> = {};
  for (const n of names) {
    const size = n === 'uv' ? 2 : 3;
    if (gs.every((g) => g.attributes[n])) arrays[n] = new Float32Array(vCount * size);
  }
  let vo = 0;
  let io = 0;
  for (const g of gs) {
    const count = g.attributes.position.count;
    for (const n of Object.keys(arrays)) {
      const src = g.attributes[n] as THREE.BufferAttribute;
      const size = src.itemSize;
      for (let i = 0; i < count; i++) for (let k = 0; k < size; k++) arrays[n][(vo + i) * size + k] = src.array[i * size + k] as number;
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.getX(i) + vo;
    else for (let i = 0; i < count; i++) idx[io++] = vo + i;
    vo += count;
  }
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  for (const n of Object.keys(arrays)) out.setAttribute(n, new THREE.BufferAttribute(arrays[n], n === 'uv' ? 2 : 3));
  return out;
}

/* ================================ Forms ================================ */

export const FORMS = {
  servingBowl: { pts: [[0.055, 0], [0.1, 0.03], [0.14, 0.07], [0.152, 0.092]], wall: 0.007 },
  bowl: { pts: [[0.036, 0], [0.062, 0.026], [0.082, 0.056], [0.088, 0.074]], wall: 0.006 },
  smallBowl: { pts: [[0.026, 0], [0.045, 0.02], [0.058, 0.042], [0.062, 0.052]], wall: 0.005 },
  mug: { pts: [[0.038, 0], [0.043, 0.02], [0.044, 0.06], [0.042, 0.092], [0.044, 0.104]], wall: 0.006, handle: true },
  cup: { pts: [[0.02, 0], [0.027, 0.014], [0.034, 0.038], [0.037, 0.05]], wall: 0.004 },
  tumbler: { pts: [[0.03, 0], [0.033, 0.03], [0.036, 0.07], [0.038, 0.1]], wall: 0.005 },
  jar: { pts: [[0.05, 0], [0.074, 0.04], [0.086, 0.1], [0.072, 0.165], [0.05, 0.195], [0.052, 0.212], [0.059, 0.222]], wall: 0.007 },
  vase: { pts: [[0.045, 0], [0.07, 0.06], [0.086, 0.13], [0.062, 0.235], [0.036, 0.305], [0.038, 0.345], [0.05, 0.365]], wall: 0.007 },
  bottle: { pts: [[0.05, 0], [0.078, 0.05], [0.085, 0.12], [0.045, 0.2], [0.022, 0.255], [0.023, 0.295], [0.03, 0.305]], wall: 0.006 },
  moonJar: { pts: [[0.06, 0], [0.11, 0.06], [0.132, 0.15], [0.112, 0.24], [0.072, 0.285], [0.07, 0.3], [0.074, 0.31]], wall: 0.008 },
  plate: { pts: [[0.08, 0], [0.118, 0.008], [0.138, 0.02], [0.146, 0.026]], wall: 0.006 },
  planter: { pts: [[0.075, 0], [0.085, 0.05], [0.096, 0.12], [0.104, 0.142]], wall: 0.008 },
  cylinder: { pts: [[0.05, 0], [0.054, 0.05], [0.055, 0.12], [0.056, 0.16]], wall: 0.007 },
  pitcher: { pts: [[0.05, 0], [0.068, 0.05], [0.07, 0.11], [0.055, 0.17], [0.05, 0.2], [0.058, 0.225]], wall: 0.006, handle: true },
  /** Traditional porous water jar (jahlah / khrous) */
  waterJar: { pts: [[0.09, 0], [0.165, 0.08], [0.205, 0.2], [0.185, 0.33], [0.11, 0.42], [0.066, 0.455], [0.068, 0.49], [0.086, 0.515]], wall: 0.012 },
  bigJar: { pts: [[0.12, 0], [0.24, 0.14], [0.29, 0.34], [0.25, 0.54], [0.15, 0.66], [0.11, 0.7], [0.115, 0.74], [0.135, 0.76]], wall: 0.015 },
} satisfies Record<string, Form>;
export type FormName = keyof typeof FORMS;

/* ================================ Misc ================================ */

/** Stepped triangular merlon (shurfa) profile, extruded. */
export function merlonGeometry(size: number, depth: number) {
  const s = new THREE.Shape();
  const w = size;
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, w * 0.35);
  s.lineTo(w * 0.28, w * 0.35);
  s.lineTo(w * 0.28, w * 0.65);
  s.lineTo(w * 0.08, w * 0.65);
  s.lineTo(0, w * 0.95);
  s.lineTo(-w * 0.08, w * 0.65);
  s.lineTo(-w * 0.28, w * 0.65);
  s.lineTo(-w * 0.28, w * 0.35);
  s.lineTo(-w / 2, w * 0.35);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Square floor tile with chamfered top edges (18 triangles). Origin at the base centre. */
export function chamferTile(w: number, d: number, h: number, c: number) {
  const x = w / 2;
  const z = d / 2;
  const v: number[] = [];
  const uv: number[] = [];
  const quad = (a: number[], b: number[], cc: number[], dd: number[]) => {
    v.push(...a, ...b, ...cc, ...a, ...cc, ...dd);
    const map = (p: number[]) => [(p[0] + x) / w, (p[2] + z) / d];
    uv.push(...map(a), ...map(b), ...map(cc), ...map(a), ...map(cc), ...map(dd));
  };
  const t = h;
  const s = h - c * 0.6;
  // top
  quad([-x + c, t, z - c], [x - c, t, z - c], [x - c, t, -z + c], [-x + c, t, -z + c]);
  // chamfers
  quad([-x, s, z], [x, s, z], [x - c, t, z - c], [-x + c, t, z - c]);
  quad([x, s, -z], [-x, s, -z], [-x + c, t, -z + c], [x - c, t, -z + c]);
  quad([x, s, z], [x, s, -z], [x - c, t, -z + c], [x - c, t, z - c]);
  quad([-x, s, -z], [-x, s, z], [-x + c, t, z - c], [-x + c, t, -z + c]);
  // sides
  quad([-x, 0, z], [x, 0, z], [x, s, z], [-x, s, z]);
  quad([x, 0, -z], [-x, 0, -z], [-x, s, -z], [x, s, -z]);
  quad([x, 0, z], [x, 0, -z], [x, s, -z], [x, s, z]);
  quad([-x, 0, -z], [-x, 0, z], [-x, s, z], [-x, s, -z]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** Apply a per-vertex colour by callback (for non-lathe geometry sharing vertex-coloured materials). */
export function paintBy<T extends THREE.BufferGeometry>(g: T, fn: (x: number, y: number, z: number) => RGB): T {
  const p = g.attributes.position as THREE.BufferAttribute;
  const a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const c = fn(p.getX(i), p.getY(i), p.getZ(i));
    a[i * 3] = c[0];
    a[i * 3 + 1] = c[1];
    a[i * 3 + 2] = c[2];
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
