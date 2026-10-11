import * as THREE from 'three';
import { ALL_PALMS, CHANNEL_Z, DRYING, FIELD, GROVE_COLS, GROVE_ROWS, HARVEST, MAJLIS, ORCHARD, PADDOCK, SPUR_OFFSET, SWING_GHAF, YARD, rng, type Rect } from './layout';

/* ------------------------------------------------------------------ */
/*  Ground splat map painted in world space and sampled by the terrain */
/*  shader:  R = dark irrigated soil, G = green ground cover,           */
/*           B = compacted sandy track.                                */
/* ------------------------------------------------------------------ */

export const SPLAT = { x0: -34, z0: -40, w: 74, d: 66, size: 1024 };

export interface SplatOpts {
  pen: Rect;
  tents: boolean;
}

/** Track centrelines (also used for the scatter so props avoid them). */
export function farmTracks(tents: boolean): [number, number][][] {
  return [
    // service track from the gate to the hay store and pen
    tents
      ? [
          [6.2, 26],
          [5.4, 22.4],
          [1, 21.9],
          [-6, 22.2],
          [-11.2, 22.3],
        ]
      : [
          [6.2, 26],
          [5.4, 22.4],
          [1, 21.9],
          [-6, 22.2],
          [-11.5, 21.6],
          [-15.2, 20.4],
        ],
  ];
}

export function paintSplat({ pen, tents }: SplatOpts) {
  const { x0, z0, w, d, size } = SPLAT;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  g.globalCompositeOperation = 'lighter';
  const sx = size / w;
  const sz = size / d;
  const X = (x: number) => (x - x0) * sx;
  const Z = (z: number) => (z - z0) * sz;
  const col = (r: number, gg: number, b: number) => `rgb(${Math.round(r * 255)},${Math.round(gg * 255)},${Math.round(b * 255)})`;
  const r = rng(77);

  const blob = (x: number, z: number, rad: number, rgb: [number, number, number], soft = 0.5) => {
    const grd = g.createRadialGradient(X(x), Z(z), rad * sx * (1 - soft), X(x), Z(z), rad * sx);
    grd.addColorStop(0, col(...rgb));
    grd.addColorStop(1, 'rgb(0,0,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.ellipse(X(x), Z(z), rad * sx, rad * sz, 0, 0, Math.PI * 2);
    g.fill();
  };
  const rect = (rc: Rect, rgb: [number, number, number], blur: number) => {
    g.filter = `blur(${blur * sx}px)`;
    g.fillStyle = col(...rgb);
    g.fillRect(X(rc.x0), Z(rc.z0), (rc.x1 - rc.x0) * sx, (rc.z1 - rc.z0) * sz);
    g.filter = 'none';
  };
  const line = (pts: [number, number][], width: number, rgb: [number, number, number], blur: number) => {
    g.filter = `blur(${blur * sx}px)`;
    g.strokeStyle = col(...rgb);
    g.lineWidth = width * sx;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const sp = curve.getSpacedPoints(Math.max(8, Math.round(curve.getLength() * 2)));
    g.beginPath();
    sp.forEach((p, i) => (i ? g.lineTo(X(p.x), Z(p.z)) : g.moveTo(X(p.x), Z(p.z))));
    g.stroke();
    g.filter = 'none';
  };

  // ---- sparse natural variation over the whole plot (green tint + damp hollows)
  for (let i = 0; i < 90; i++) {
    const x = -31 + r() * 68;
    const z = -37 + r() * 60;
    blob(x, z, 1.5 + r() * 4, [0.08 + r() * 0.22, 0.1 + r() * 0.22, 0], 0.9);
  }

  // ---- palm basins: soaked dark ring that fades out, a green fringe beyond it
  for (const p of ALL_PALMS) {
    const [x, , z] = p.position;
    blob(x, z, 3.3, [1.0, 0, 0], 0.6);
    blob(x + 0.3, z + 0.2, 4.2, [0, 0.45, 0], 0.55);
  }

  // ---- grove irrigation: main channel + spurs keep a damp, greener strip
  line(
    [
      [2.2, CHANNEL_Z],
      [34, CHANNEL_Z],
    ],
    1.5,
    [0.5, 0.3, 0],
    0.5,
  );
  for (const cx of GROVE_COLS)
    line(
      [
        [cx + SPUR_OFFSET, CHANNEL_Z],
        [cx + SPUR_OFFSET, GROVE_ROWS[0] - 0.6],
      ],
      1.2,
      [0.42, 0.26, 0],
      0.45,
    );
  // falaj banks
  line(
    [
      [2.4, -40],
      [2.6, -30],
      [1.8, -21],
      [2.2, -13],
      [2.0, -7.4],
    ],
    2.2,
    [0.35, 0.42, 0],
    0.7,
  );

  // ---- kitchen garden & greenhouse surrounds
  rect({ x0: 7.1, x1: 16.9, z0: 0.3, z1: 11.3 }, [0.32, 0.12, 0], 0.6);
  rect({ x0: 23.2, x1: 30.8, z0: -1.4, z1: 13.4 }, [0.25, 0.05, 0], 0.4);
  rect(YARD, [0.2, 0.06, 0.15], 0.5);
  // drip station & pool
  blob(4.4, -5.8, 4.2, [0.32, 0.18, 0.12], 0.7);

  // ---- fodder field: flooded basins + lush fringe
  for (const f of [FIELD, PADDOCK.rect]) {
    rect(f, [0.62, 0.55, 0], 0.35);
    rect({ x0: f.x0 - 0.9, x1: f.x1 + 0.9, z0: f.z0 - 1.1, z1: f.z1 + 1.1 }, [0.1, 0.3, 0], 0.9);
  }
  // orchard basins
  for (const [x, z] of [
    [34.6, -8.6],
    [34.9, -2.4],
    [34.5, 9.4],
  ] as [number, number][])
    blob(x, z, 2.4, [0.6, 0.25, 0], 0.6);
  rect(ORCHARD, [0.05, 0.16, 0], 1.2);

  // ---- family quarter
  rect({ x0: MAJLIS.x - MAJLIS.w / 2 - 0.6, x1: MAJLIS.x + MAJLIS.w / 2 + 0.6, z0: MAJLIS.z - MAJLIS.d / 2 - 0.6, z1: MAJLIS.z + MAJLIS.d / 2 + 0.8 }, [0, 0, 0.45], 0.6);
  blob(SWING_GHAF.x + 2.6, SWING_GHAF.z + 1, 1.6, [0, 0, 0.55], 0.6); // worn patch under the swing
  blob(SWING_GHAF.x, SWING_GHAF.z, 4.5, [0.1, 0.22, 0], 0.7); // ghaf shade
  rect(pen, [0.3, 0, 0.45], 0.45); // trampled pen floor
  blob((pen.x0 + pen.x1) / 2, pen.z1 - 1, 2.2, [0.28, 0, 0.1], 0.6); // around the troughs

  // ---- harvest station, drying mats
  blob(HARVEST.x, HARVEST.z, 4.6, [0.08, 0, 0.42], 0.55);
  rect({ x0: DRYING.x - 4.4, x1: DRYING.x + 4.4, z0: DRYING.z - 1.9, z1: DRYING.z + 1.9 }, [0, 0, 0.35], 0.6);

  // ---- tracks: light compacted sand with two darker wheel ruts
  for (const t of farmTracks(tents)) {
    line(t, 2.6, [0, 0, 0.62], 0.35);
    const curve = new THREE.CatmullRomCurve3(t.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    for (const off of [-0.62, 0.62]) {
      const pts = curve.getSpacedPoints(40).map((p, i, a) => {
        const nx = a[Math.min(i + 1, a.length - 1)].clone().sub(a[Math.max(i - 1, 0)]).normalize();
        return [p.x - nx.z * off, p.z + nx.x * off] as [number, number];
      });
      line(pts, 0.32, [0.2, 0, 0], 0.12);
    }
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.flipY = false; // canvas row 0 = z0
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}
