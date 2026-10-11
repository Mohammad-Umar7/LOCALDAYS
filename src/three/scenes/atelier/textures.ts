import * as THREE from 'three';
import { fbm, makeNoise, ridged } from '../../materials/noise';

/* ------------------------------------------------------------------ */
/*  Atelier-only procedural textures: encaustic floor tiles, streaky   */
/*  agarwood, palm-rib ceiling matting, carved relief, gift paper,     */
/*  pierced-lantern glow and drawer labels. Cached, asset-free.        */
/* ------------------------------------------------------------------ */

type RGB = [number, number, number];

export interface AtelierTexSet {
  map: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
}

const hex = (c: string): RGB => {
  const h = c.replace('#', '');
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
};
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

interface Px {
  c: RGB;
  h: number;
  r: number;
}

function canvasTexture(canvas: HTMLCanvasElement, srgb: boolean) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

function toTexture(data: Uint8ClampedArray, w: number, h: number, srgb: boolean) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.putImageData(new ImageData(data, w, h), 0, 0);
  return canvasTexture(c, srgb);
}

/** Per-pixel sampler → colour / normal (from height) / roughness maps. */
function generate(w: number, h: number, sampler: (u: number, v: number, px: Px, x: number, y: number) => void, normalStrength = 2, wantRough = true): AtelierTexSet {
  const n = w * h;
  const color = new Uint8ClampedArray(n * 4);
  const rough = new Uint8ClampedArray(n * 4);
  const height = new Float32Array(n);
  const px: Px = { c: [0, 0, 0], h: 0, r: 0.8 };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      px.h = 0;
      px.r = 0.8;
      sampler(x / w, y / h, px, x, y);
      const i = y * w + x;
      color[i * 4] = px.c[0] * 255;
      color[i * 4 + 1] = px.c[1] * 255;
      color[i * 4 + 2] = px.c[2] * 255;
      color[i * 4 + 3] = 255;
      height[i] = px.h;
      const rv = clamp01(px.r) * 255;
      rough[i * 4] = rough[i * 4 + 1] = rough[i * 4 + 2] = rv;
      rough[i * 4 + 3] = 255;
    }
  }
  const nrm = new Uint8ClampedArray(n * 4);
  const at = (x: number, y: number) => height[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1)) * normalStrength;
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1)) * normalStrength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      nrm[i] = (-dx / l * 0.5 + 0.5) * 255;
      nrm[i + 1] = (dy / l * 0.5 + 0.5) * 255;
      nrm[i + 2] = (1 / l * 0.5 + 0.5) * 255;
      nrm[i + 3] = 255;
    }
  }
  const out: AtelierTexSet = { map: toTexture(color, w, h, true), normalMap: toTexture(nrm, w, h, false) };
  if (wantRough) out.roughnessMap = toTexture(rough, w, h, false);
  return out;
}

/* ---------------------------- Encaustic floor ---------------------------- */

/**
 * 4×4 cement tiles per texture: an eight-point star (khatam) in each tile,
 * quarter rosettes that join across the corners, worn polished surface.
 */
function encaustic(): AtelierTexSet {
  const nz = makeNoise(41);
  const parch = hex('#A8957A');
  const terra = hex('#835A45');
  const char = hex('#4A3C33');
  const sage = hex('#6E7262');
  const grout = hex('#4F4337');
  const N = 4;
  return generate(
    768,
    768,
    (u, v, p) => {
      const tx = u * N;
      const ty = v * N;
      const ix = Math.floor(tx);
      const iy = Math.floor(ty);
      const s = tx - ix - 0.5;
      const t = ty - iy - 0.5;
      const ax = Math.abs(s);
      const ay = Math.abs(t);
      const r = Math.hypot(s, t);
      // eight-point star (khatam) = union of two squares
      const star = Math.min(Math.max(ax, ay) - 0.23, (ax + ay) / Math.SQRT2 - 0.23);
      const inner = Math.min(Math.max(ax, ay) - 0.13, (ax + ay) / Math.SQRT2 - 0.13);
      // quarter discs at the corners join into roundels across four tiles
      const q = Math.hypot(0.5 - ax, 0.5 - ay);
      let c: RGB = parch;
      if (q < 0.19) c = sage;
      if (q < 0.085) c = parch;
      if (q < 0.04) c = terra;
      if (star < 0) c = terra;
      if (Math.abs(star) < 0.008) c = char;
      if (inner < 0) c = char;
      if (r < 0.05) c = parch;
      const edge = Math.min(0.5 - ax, 0.5 - ay);
      const g = smooth(0.003, 0.009, edge);
      const tone = hash(ix + 3, iy + 7);
      const wear = fbm(nz, u, v, 5, 3) * 0.5 + 0.5;
      const fine = fbm(nz, u + 0.37, v + 0.11, 48, 2);
      c = mix(c, mix(c, parch, 0.3), smooth(0.6, 0.95, wear) * 0.5);
      const k = 0.94 + tone * 0.09 + fine * 0.035;
      c = [c[0] * k, c[1] * k, c[2] * k];
      p.c = mix(grout, c, g);
      p.h = g * 0.9 + fine * 0.04;
      p.r = 0.3 + (1 - g) * 0.6 + wear * 0.16 + tone * 0.05;
    },
    2.2,
  );
}

/* ------------------------------- Fine timber ------------------------------ */

/**
 * Oiled hardwood boards: straight, fine grain with gentle cathedral figure,
 * open pores and per-board tone — reads as real walnut/teak up close.
 */
function fineWood({ base, dark, seed, boards }: { base: string; dark: string; seed: number; boards: number }): AtelierTexSet {
  const nz = makeNoise(seed);
  const b = hex(base);
  const d = hex(dark);
  return generate(
    512,
    512,
    (u, v, p) => {
      const row = Math.floor(v * boards);
      const rv = v * boards - row;
      const tone = hash(row, seed);
      const uu = (u + tone * 0.37) % 1;
      const warp = fbm(nz, uu * 0.5, (row + 0.5) / boards, 2, 3) * 0.35;
      // cathedral figure: arcs centred on the board
      const cath = Math.abs(rv - 0.5 + Math.sin(uu * Math.PI * 2 + tone * 6) * 0.18);
      const lines = Math.sin((rv * 26 + warp * 2 + cath * 6) * Math.PI * 2) * 0.5 + 0.5;
      const late = Math.pow(lines, 3);
      const pores = fbm(nz, uu * 1, v * 90, 24, 2) * 0.5 + 0.5;
      const slow = fbm(nz, uu, v, 3, 3) * 0.5 + 0.5;
      let c = mix(b, d, clamp01(late * 0.45 + slow * 0.25 + tone * 0.25));
      c = mix(c, d, smooth(0.62, 0.9, pores) * 0.25);
      const seam = smooth(0.0, 0.012, rv) * smooth(1.0, 0.988, rv);
      p.c = mix(mix(d, [0, 0, 0], 0.35), c, 0.25 + 0.75 * seam);
      p.h = seam * 0.7 + late * 0.06 - smooth(0.7, 0.95, pores) * 0.08;
      p.r = 0.42 + late * 0.08 + smooth(0.62, 0.9, pores) * 0.2 + (1 - seam) * 0.3;
    },
    1.6,
  );
}

/* ------------------------------- Agarwood -------------------------------- */

/** Dark resin streaks running through pale wood fibre (u runs along the grain). */
function agarwood(): AtelierTexSet {
  const nz = makeNoise(53);
  const wood = hex('#8C6A45');
  const woodLight = hex('#A88459');
  const resin = hex('#1C110A');
  const resinMid = hex('#3D2414');
  return generate(
    256,
    128,
    (u, v, p) => {
      const warp = fbm(nz, u, v, 3, 3) * 0.12;
      const streak = ridged(nz, u * 0.5 + 0.2, v + warp, 8, 4);
      const band = fbm(nz, u * 0.5, v * 2 + warp, 4, 4) * 0.5 + 0.5;
      const fibre = fbm(nz, u * 0.25, v * 3, 48, 2) * 0.5 + 0.5;
      const r = smooth(0.32, 0.62, streak * 0.9 + band * 0.5 - 0.15);
      let c = mix(wood, woodLight, fibre * 0.6);
      c = mix(c, resinMid, smooth(0.2, 0.5, r));
      c = mix(c, resin, smooth(0.55, 0.95, r));
      p.c = c;
      p.h = fibre * 0.5 + r * 0.25 - smooth(0.85, 1, fbm(nz, u + 0.5, v, 24, 2) * 0.5 + 0.5) * 0.4;
      p.r = 0.82 - r * 0.5;
    },
    2.4,
  );
}

/* ---------------------------- Ceiling matting --------------------------- */

/** Palm-rib (basjeel) mat laid across the danchal, tied with twine. u runs across the ribs. */
function matting(): AtelierTexSet {
  const nz = makeNoise(67);
  const straw = hex('#A4834F');
  const strawDark = hex('#6E5230');
  const gap = hex('#2A1C10');
  const twine = hex('#5A4128');
  const ribs = 64;
  return generate(
    512,
    512,
    (u, v, p) => {
      const ru = u * ribs;
      const ri = Math.floor(ru);
      const rf = ru - ri;
      const tone = hash(ri, 3);
      const round = Math.sin(rf * Math.PI);
      const body = smooth(0.0, 0.18, rf) * smooth(1.0, 0.82, rf);
      const grain = fbm(nz, u, v * 0.25, 32, 2) * 0.5 + 0.5;
      let c = mix(strawDark, straw, 0.35 + tone * 0.45 + grain * 0.2);
      c = mix(gap, c, body);
      // twine bindings every quarter
      const tv = (v * 4) % 1;
      const tw = smooth(0.0, 0.02, tv) * smooth(0.06, 0.04, tv);
      const twineTex = Math.sin((u * 220 + v * 40) * Math.PI) * 0.5 + 0.5;
      c = mix(c, mix(twine, strawDark, twineTex * 0.4), tw);
      p.c = c;
      p.h = round * body * 0.8 + tw * 0.6 + grain * 0.1;
      p.r = 0.85;
    },
    2.6,
  );
}

/* ------------------------------ Carved relief ---------------------------- */

/**
 * Normal-only relief of an interlaced eight-point star lattice — used on
 * door panels, cabinet friezes and niche surrounds (with the wood colour).
 */
function carving(): THREE.Texture {
  const set = generate(
    512,
    512,
    (u, v, p) => {
      const N = 2;
      const s = (u * N) % 1 - 0.5;
      const t = (v * N) % 1 - 0.5;
      const ax = Math.abs(s);
      const ay = Math.abs(t);
      const d1 = Math.max(ax, ay) - 0.22;
      const d2 = (ax + ay) / Math.SQRT2 - 0.22;
      const star = Math.min(d1, d2);
      const q = Math.hypot(0.5 - ax, 0.5 - ay);
      const band = 1 - smooth(0.012, 0.03, Math.abs(star));
      const ring = 1 - smooth(0.012, 0.03, Math.abs(q - 0.24));
      const inner = 1 - smooth(0.012, 0.028, Math.abs(Math.max(ax, ay) - 0.1));
      const lines = Math.max(band, ring, inner);
      p.c = [0.5, 0.5, 0.5];
      p.h = lines * 0.8 + (star < 0 ? 0.15 : 0) - (q < 0.2 ? 0.25 : 0);
    },
    3.2,
    false,
  );
  set.map.dispose();
  return set.normalMap!;
}

/* ------------------------------- Gift paper ------------------------------ */

function giftPaper(): AtelierTexSet {
  const red = hex('#5E0C12');
  const redLight = hex('#7A1419');
  const gold = hex('#C99A45');
  return generate(
    256,
    256,
    (u, v, p) => {
      const a = (u + v) * 6;
      const b = (u - v) * 6;
      const la = Math.abs(a - Math.round(a));
      const lb = Math.abs(b - Math.round(b));
      const line = 1 - smooth(0.02, 0.045, Math.min(la, lb));
      const cx = (u * 6) % 1 - 0.5;
      const cy = (v * 6) % 1 - 0.5;
      const dot = 1 - smooth(0.06, 0.09, Math.abs(cx) + Math.abs(cy));
      const g = Math.max(line, dot);
      const fibre = Math.sin(u * 900) * 0.01;
      p.c = mix(mix(red, redLight, 0.3 + fibre), gold, g);
      p.h = g * 0.4;
      p.r = 0.62 - g * 0.32;
    },
    1.2,
  );
}

/* ------------------------- Pierced-lantern emissive ---------------------- */

/** Rows of star-shaped piercings (white) on black — an emissive map for brass lanterns. */
function piercedLantern(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 256);
  const star = (x: number, y: number, r: number) => {
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const rr = i % 2 === 0 ? r : r * 0.45;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  };
  g.fillStyle = '#fff';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const x = col * 32 + (row % 2) * 16 + 8;
      const y = row * 32 + 16;
      star(x, y, row % 2 ? 7 : 9);
    }
  }
  g.fillStyle = 'rgba(255,255,255,0.8)';
  for (let row = 0; row < 16; row++)
    for (let col = 0; col < 16; col++) {
      g.beginPath();
      g.arc(col * 16 + 8 + ((row % 2) * 8), row * 16 + 8, 1.6, 0, Math.PI * 2);
      g.fill();
    }
  return canvasTexture(c, true);
}

/* ------------------------------ Drawer label ----------------------------- */

function labelCard(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#E8DCC0';
  g.fillRect(0, 0, 128, 64);
  g.strokeStyle = '#6B4A2A';
  g.lineWidth = 2;
  g.strokeRect(5, 5, 118, 54);
  g.strokeStyle = '#3B2414';
  g.lineWidth = 2.2;
  g.lineCap = 'round';
  // calligraphic scribble standing in for a handwritten Arabic name
  g.beginPath();
  g.moveTo(22, 30);
  g.bezierCurveTo(34, 18, 44, 40, 58, 28);
  g.bezierCurveTo(66, 22, 72, 36, 84, 26);
  g.lineTo(104, 28);
  g.stroke();
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(36, 44);
  g.lineTo(92, 44);
  g.stroke();
  const t = canvasTexture(c, true);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/* ------------------------------- Window sky ------------------------------ */

const skyCache = new Map<string, THREE.Texture>();
/** Soft vertical gradient seen through the lattice. */
export function skyTexture(top: string, bottom: string): THREE.Texture {
  const hit = skyCache.get(top + bottom);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, top);
  grd.addColorStop(1, bottom);
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 128);
  const t = canvasTexture(c, true);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  skyCache.set(top + bottom, t);
  return t;
}

/* --------------------------------- Cache --------------------------------- */

const gens = { encaustic, agarwood, matting, giftPaper };
const setCache = new Map<string, AtelierTexSet>();
const texCache = new Map<string, THREE.Texture>();

const woodCache = new Map<string, AtelierTexSet>();
export function woodTex(base: string, dark: string, seed: number, boards = 4): AtelierTexSet {
  const key = base + ':' + dark + ':' + seed + ':' + boards;
  let t = woodCache.get(key);
  if (!t) {
    t = fineWood({ base, dark, seed, boards });
    woodCache.set(key, t);
  }
  return t;
}

export function atelierTex(name: keyof typeof gens): AtelierTexSet {
  const hit = setCache.get(name);
  if (hit) return hit;
  const s = gens[name]();
  setCache.set(name, s);
  return s;
}

const singles = { carving, piercedLantern, labelCard };
export function atelierMap(name: keyof typeof singles): THREE.Texture {
  const hit = texCache.get(name);
  if (hit) return hit;
  const t = singles[name]();
  texCache.set(name, t);
  return t;
}

/** Clone a set with its own repeat (shares the image on the GPU). */
export function repeatTex<T extends AtelierTexSet>(set: T, rx: number, ry = rx): AtelierTexSet {
  const out: AtelierTexSet = { map: set.map.clone() };
  out.map.repeat.set(rx, ry);
  if (set.normalMap) {
    out.normalMap = set.normalMap.clone();
    out.normalMap.repeat.set(rx, ry);
  }
  if (set.roughnessMap) {
    out.roughnessMap = set.roughnessMap.clone();
    out.roughnessMap.repeat.set(rx, ry);
  }
  for (const t of Object.values(out)) if (t) t.needsUpdate = true;
  return out;
}
