/**
 * Fast, seedable, *periodic* gradient noise so every procedural texture
 * tiles seamlessly. No external assets are needed for any 3D venue.
 */

export type Noise2 = (x: number, y: number, px: number, py: number) => number;

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeNoise(seed = 1): Noise2 {
  const r = mulberry(seed * 9973 + 17);
  const perm = new Uint16Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const gx = new Float32Array(256);
  const gy = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const a = r() * Math.PI * 2;
    gx[i] = Math.cos(a);
    gy[i] = Math.sin(a);
  }
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y, px, py) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const x0 = ((xi % px) + px) % px;
    const y0 = ((yi % py) + py) % py;
    const x1 = (x0 + 1) % px;
    const y1 = (y0 + 1) % py;
    const h00 = perm[perm[x0 & 255] + (y0 & 255)];
    const h10 = perm[perm[x1 & 255] + (y0 & 255)];
    const h01 = perm[perm[x0 & 255] + (y1 & 255)];
    const h11 = perm[perm[x1 & 255] + (y1 & 255)];
    const n00 = gx[h00] * xf + gy[h00] * yf;
    const n10 = gx[h10] * (xf - 1) + gy[h10] * yf;
    const n01 = gx[h01] * xf + gy[h01] * (yf - 1);
    const n11 = gx[h11] * (xf - 1) + gy[h11] * (yf - 1);
    const u = fade(xf);
    const v = fade(yf);
    const nx0 = n00 + u * (n10 - n00);
    const nx1 = n01 + u * (n11 - n01);
    return (nx0 + v * (nx1 - nx0)) * 1.41;
  };
}

/** Fractal noise on the unit square, periodic in both axes. Returns ≈[-1, 1]. */
export function fbm(noise: Noise2, u: number, v: number, freq = 4, octaves = 4, gain = 0.5) {
  let amp = 1;
  let f = Math.max(1, Math.round(freq));
  let s = 0;
  let n = 0;
  for (let o = 0; o < octaves; o++) {
    s += amp * noise(u * f, v * f, f, f);
    n += amp;
    amp *= gain;
    f *= 2;
  }
  return s / n;
}

/** Ridged variant — good for cracks, veins and grain. */
export function ridged(noise: Noise2, u: number, v: number, freq = 4, octaves = 4) {
  let amp = 0.5;
  let f = Math.max(1, Math.round(freq));
  let s = 0;
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(noise(u * f, v * f, f, f));
    s += amp * n * n;
    amp *= 0.5;
    f *= 2;
  }
  return s;
}

/** Periodic Worley (cellular) distance for stones and cells. */
export function makeWorley(seed: number, cells: number) {
  const r = mulberry(seed * 31 + 7);
  const pts: [number, number][] = [];
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) pts.push([(i + r()) / cells, (j + r()) / cells]);
  return (u: number, v: number) => {
    const ci = Math.floor(u * cells);
    const cj = Math.floor(v * cells);
    let d1 = 9;
    let d2 = 9;
    let id = 0;
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        const ii = (ci + di + cells) % cells;
        const jj = (cj + dj + cells) % cells;
        const [px, py] = pts[jj * cells + ii];
        const ox = px + (ci + di - ii) / cells;
        const oy = py + (cj + dj - jj) / cells;
        const dx = u - ox;
        const dy = v - oy;
        const d = Math.sqrt(dx * dx + dy * dy) * cells;
        if (d < d1) {
          d2 = d1;
          d1 = d;
          id = jj * cells + ii;
        } else if (d < d2) d2 = d;
      }
    return { d1, d2, id };
  };
}
