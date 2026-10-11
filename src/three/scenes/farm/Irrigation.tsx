import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { applyWind } from '../../materials/wind';
import { boxProjectUVs, roundedBox } from '../../props/geo';
import type { Quality } from '../../core/types';
import type { CropRow } from './Crops';
import { basinRect, CHANNEL_Z, FODDER, GROVE_COLS, GROVE_PALMS, rng, SPUR_OFFSET, type BasinKind, type FieldSpec } from './layout';
import type { FarmMaterials } from './materials';

/* ------------------------------------------------------------------ */
/*  Irrigation, the traditional way: earthen saqiya channels branch    */
/*  off the falaj, run between the palm columns and feed every basin;  */
/*  in front of the greenhouse a standpipe pours into a channel that   */
/*  floods the fodder basins in turn. All water uses the shared        */
/*  flowing-water material, so the current is visible everywhere.      */
/* ------------------------------------------------------------------ */

function merge(list: THREE.BufferGeometry[]) {
  const g = mergeGeometries(
    list.map((x) => (x.index ? x.toNonIndexed() : x)),
    false,
  );
  list.forEach((x) => x.dispose());
  return g!;
}

/** Low earth ridge (berm) along a polyline; tapers into the ground at both ends. */
function ridge(pts: [number, number][], w: number, h: number) {
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    'catmullrom',
    0.01,
  );
  const len = curve.getLength();
  const n = Math.max(2, Math.ceil(len / 0.35));
  const prof: [number, number][] = [
    [-1, 0],
    [-0.6, 0.65],
    [0, 1],
    [0.6, 0.65],
    [1, 0],
  ];
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t);
    const tg = curve.getTangentAt(t);
    const side = new THREE.Vector3(-tg.z, 0, tg.x);
    const endFade = Math.min(1, (t * len) / 0.18, ((1 - t) * len) / 0.18);
    for (const [o, y] of prof) {
      pos.push(p.x + side.x * o * (w / 2), y * h * (0.35 + 0.65 * endFade) - 0.01, p.z + side.z * o * (w / 2));
      uv.push((o * w * 0.5) / 4.57 / 4, (t * len) / 4.57 / 4);
    }
  }
  const k = prof.length;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < k - 1; j++) {
      const a = i * k + j;
      idx.push(a, a + 1, a + k, a + 1, a + k + 1, a + k);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Water ribbon along a polyline: u across, v = metres downstream. */
function waterStrip(pts: [number, number][], w: number, y: number) {
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    'catmullrom',
    0.01,
  );
  const len = curve.getLength();
  const n = Math.max(2, Math.ceil(len / 0.5));
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t);
    const tg = curve.getTangentAt(t);
    const sx = -tg.z;
    const sz = tg.x;
    pos.push(p.x - sx * (w / 2), y, p.z - sz * (w / 2), p.x + sx * (w / 2), y, p.z + sz * (w / 2));
    uv.push(0, t * len, 1, t * len);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array((n + 1) * 2).fill([0, 1, 0]).flat(), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** An earthen channel: water ribbon between two berms (berm gaps where branches leave). */
function channel(pts: [number, number][], width: number, berms: THREE.BufferGeometry[], water: THREE.BufferGeometry[], gapsLeft: number[] = [], gapsRight: number[] = []) {
  water.push(waterStrip(pts, width, 0.035));
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    'catmullrom',
    0.01,
  );
  const len = curve.getLength();
  const off = width / 2 + 0.11;
  for (const [side, gaps] of [
    [-1, gapsLeft],
    [1, gapsRight],
  ] as [number, number[]][]) {
    // split the berm at gap distances (metres from the start)
    const cuts = [0, ...gaps.flatMap((d) => [d - 0.32, d + 0.32]), len].sort((a, b) => a - b);
    for (let c = 0; c < cuts.length - 1; c += 2) {
      const a = Math.max(0, cuts[c]);
      const b = Math.min(len, cuts[c + 1]);
      if (b - a < 0.3) continue;
      const seg: [number, number][] = [];
      const steps = Math.max(2, Math.ceil((b - a) / 1.5));
      for (let i = 0; i <= steps; i++) {
        const t = (a + ((b - a) * i) / steps) / len;
        const p = curve.getPointAt(t);
        const tg = curve.getTangentAt(t);
        seg.push([p.x - tg.z * off * side, p.z + tg.x * off * side]);
      }
      berms.push(ridge(seg, 0.3, 0.065));
    }
  }
}

/** Small wooden sluice board standing across a channel. */
function sluice(x: number, z: number, rotY: number, open: boolean, wood: THREE.BufferGeometry[]) {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(boxProjectUVs(roundedBox(0.46, 0.24, 0.035, 0.01, 1).clone(), 1).translate(0, open ? 0.24 : 0.1, 0));
  for (const s of [-1, 1]) parts.push(boxProjectUVs(roundedBox(0.05, 0.42, 0.05, 0.01, 1).clone(), 1).translate(s * 0.26, 0.19, 0));
  const g = merge(parts);
  g.rotateY(rotY);
  g.translate(x, 0, z);
  wood.push(g);
}

/* ------------------------------- Grove channels ------------------------------- */

export function GroveChannels({ m }: { m: FarmMaterials }) {
  const geos = useMemo(() => {
    const berms: THREE.BufferGeometry[] = [];
    const water: THREE.BufferGeometry[] = [];
    const wood: THREE.BufferGeometry[] = [];
    const stone: THREE.BufferGeometry[] = [];
    const x0 = 2.75;
    const spurs = GROVE_COLS.map((c) => c + SPUR_OFFSET);
    const end = GROVE_COLS[GROVE_COLS.length - 1] + 1.6;
    // main channel: falaj outlet → east, with berm gaps where the spurs leave (north = left of +x flow)
    channel(
      [
        [x0, CHANNEL_Z],
        [end, CHANNEL_Z],
      ],
      0.32,
      berms,
      water,
      spurs.map((sx) => sx - x0),
    );
    // stone outlet block & sluice at the falaj
    stone.push(boxProjectUVs(roundedBox(0.34, 0.3, 0.9, 0.04, 1).clone(), 0.6).translate(x0 - 0.05, 0.15, CHANNEL_Z));
    sluice(x0 + 0.35, CHANNEL_Z, Math.PI / 2, true, wood);
    // spurs north between the columns, feeders east to each palm basin
    GROVE_COLS.forEach((col, ci) => {
      const sx = spurs[ci];
      const palms = GROVE_PALMS.filter((p) => Math.abs(p.position[0] - col) < 2);
      const zEnd = Math.min(...palms.map((p) => p.position[2])) - 0.3;
      const feeders = palms.map((p) => p.position[2]);
      const z0 = CHANNEL_Z - 0.3;
      // flow runs toward −z; the east side is the channel's left
      channel(
        [
          [sx, z0],
          [sx, zEnd],
        ],
        0.26,
        berms,
        water,
        [],
        feeders.map((fz) => z0 - fz),
      );
      sluice(sx, z0 - 0.35, 0, ci % 2 === 0, wood);
      for (const p of palms) {
        const [px, , pz] = p.position;
        const fx0 = sx + 0.22;
        const fx1 = px - 1.3;
        if (fx1 - fx0 < 0.3) continue;
        channel(
          [
            [fx0, pz],
            [fx1, pz],
          ],
          0.18,
          berms,
          water,
        );
      }
    });
    return { berms: merge(berms), water: merge(water), wood: merge(wood), stone: merge(stone) };
  }, []);
  return (
    <group>
      <mesh geometry={geos.berms} material={m.berm} receiveShadow />
      <mesh geometry={geos.water} material={m.water} receiveShadow />
      <mesh geometry={geos.wood} material={m.woodDark} castShadow receiveShadow />
      <mesh geometry={geos.stone} material={m.stone} castShadow receiveShadow />
    </group>
  );
}

/* -------------------------------- Basin fields -------------------------------- */

/** Okra rows in the fodder field's crop basins (rendered by the kitchen garden's Crops). */
export const FIELD_CROPS: CropRow[] = (() => {
  const rows: CropRow[] = [];
  FODDER.plan.forEach((r, ri) =>
    r.forEach((b, ci) => {
      if (b.kind !== 'okra') return;
      const rc = basinRect(FODDER, ci, ri);
      for (let k = 0; k < 3; k++) {
        const x = rc.x0 + 0.65 + k * ((rc.x1 - rc.x0 - 1.3) / 2);
        rows.push({ kind: 'bush', from: [x, 0, rc.z0 + 0.5], to: [x, 0, rc.z1 - 0.5], count: 5 });
      }
    }),
  );
  return rows;
})();

/** One alfalfa clump: a few stems topped with diamond leaflets, darker at the base. */
function alfalfaGeometry() {
  const r = rng(13);
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const dark = new THREE.Color('#3D5A22');
  const light = new THREE.Color('#7FA348');
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, ca: THREE.Color, cb: THREE.Color) => {
    const base = pos.length / 3;
    for (const [v, cc] of [
      [a, ca],
      [b, cb],
      [c, cb],
      [d, ca],
    ] as [THREE.Vector3, THREE.Color][]) {
      pos.push(v.x, v.y, v.z);
      col.push(cc.r, cc.g, cc.b);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  for (let s = 0; s < 6; s++) {
    const a = (s / 6) * Math.PI * 2 + r() * 0.5;
    const lean = 0.25 + r() * 0.35;
    const h = 0.75 + r() * 0.25;
    const top = new THREE.Vector3(Math.cos(a) * lean * h * 0.45, h, Math.sin(a) * lean * h * 0.45);
    const w = 0.012;
    quad(new THREE.Vector3(-w, 0, 0), top.clone().add(new THREE.Vector3(-w * 0.5, 0, 0)), top.clone().add(new THREE.Vector3(w * 0.5, 0, 0)), new THREE.Vector3(w, 0, 0), dark, light);
    for (let l = 0; l < 3; l++) {
      const t = 0.45 + l * 0.27;
      const at = top.clone().multiplyScalar(t);
      const la = a + (l - 1) * 1.9 + r();
      const dir = new THREE.Vector3(Math.cos(la), 0.35, Math.sin(la)).normalize();
      const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(0.07);
      const len = 0.2 + r() * 0.06;
      const tip = at.clone().addScaledVector(dir, len);
      const mid = at.clone().addScaledVector(dir, len * 0.5);
      const c0 = dark.clone().lerp(light, 0.4 + t * 0.5);
      quad(at, mid.clone().add(side), tip, mid.clone().sub(side), c0, c0.clone().lerp(light, 0.4));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Rhodes grass: a tussock of long arching blades, green going gold at the tips. */
function grassClumpGeometry() {
  const r = rng(17);
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const base = new THREE.Color('#4A6A2A');
  const tip = new THREE.Color('#B8B060');
  for (let b = 0; b < 7; b++) {
    const a = (b / 7) * Math.PI * 2 + r() * 0.6;
    const lean = 0.25 + r() * 0.45;
    const h = 0.8 + r() * 0.3;
    const start = pos.length / 3;
    for (let k = 0; k <= 3; k++) {
      const t = k / 3;
      const w = 0.02 * (1 - t * 0.85);
      const out = Math.sin(t * 1.3) * lean * h * 0.6;
      const y = h * t - t * t * lean * 0.35;
      const cx = Math.cos(a) * out;
      const cz = Math.sin(a) * out;
      const sx = -Math.sin(a) * w;
      const sz = Math.cos(a) * w;
      const c = base.clone().lerp(tip, t * t);
      pos.push(cx - sx, y, cz - sz, cx + sx, y, cz + sz);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    for (let k = 0; k < 3; k++) {
      const q = start + k * 2;
      idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const HEIGHT: Record<BasinKind, [number, number]> = {
  alfalfa: [0.32, 0.46],
  young: [0.13, 0.2],
  cut: [0.06, 0.1],
  okra: [0, 0],
  rhodes: [0.62, 0.9],
  baled: [0.08, 0.13],
};

/**
 * A flood-irrigated field of basins: earth berms with sluiced inlets, a supply
 * channel fed by a standpipe that pours visibly into its head, standing water
 * in the basins being flooded, and the crop as instanced, wind-swayed clumps.
 */
export function BasinField({ m, quality, field }: { m: FarmMaterials; quality: Quality; field: FieldSpec }) {
  const legRef = useRef<THREE.InstancedMesh>(null);
  const grassRef = useRef<THREE.InstancedMesh>(null);
  const clump = useMemo(() => alfalfaGeometry(), []);
  const tussock = useMemo(() => grassClumpGeometry(), []);
  const mat = useMemo(
    () => applyWind(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.82 }), { sway: 0.32, stiffness: 2.4, speed: 1.9 }),
    [],
  );
  const spacing = quality === 'high' ? 0.2 : quality === 'medium' ? 0.26 : 0.34;
  const built = useMemo(() => {
    const { rect, cols, rows, plan, supply, flow } = field;
    const r = rng(field.seed);
    const berms: THREE.BufferGeometry[] = [];
    const water: THREE.BufferGeometry[] = [];
    const still: THREE.BufferGeometry[] = [];
    const wood: THREE.BufferGeometry[] = [];
    const metal: THREE.BufferGeometry[] = [];
    const stone: THREE.BufferGeometry[] = [];
    const iron: THREE.BufferGeometry[] = [];
    const straw: THREE.BufferGeometry[] = [];
    const twine: THREE.BufferGeometry[] = [];
    const legume: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const grass: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const bw = (rect.x1 - rect.x0) / cols;
    const bd = (rect.z1 - rect.z0) / rows;
    const fieldSide = supply === 'north' ? 1 : -1;
    const chZ = supply === 'north' ? rect.z0 - 0.65 : rect.z1 + 0.65;
    const inletZ = supply === 'north' ? rect.z0 : rect.z1;
    const xs = flow > 0 ? rect.x0 - 0.6 : rect.x1 + 0.6;
    const xe = flow > 0 ? rect.x1 + 0.3 : rect.x0 - 0.3;
    const inlets = Array.from({ length: cols }, (_, c) => rect.x0 + (c + 0.5) * bw);
    const gaps = inlets.map((x) => Math.abs(x - xs));
    // berm gaps go on the side of the channel that faces the field
    const right = flow === fieldSide;
    channel(
      [
        [xs, chZ],
        [xe, chZ],
      ],
      0.34,
      berms,
      water,
      right ? [] : gaps,
      right ? gaps : [],
    );
    // berms: column dividers full depth; row edges with an inlet / cascade gap per basin
    for (let c = 0; c <= cols; c++) {
      const x = rect.x0 + c * bw;
      berms.push(
        ridge(
          [
            [x, rect.z0],
            [x, rect.z1],
          ],
          0.3,
          0.13,
        ),
      );
    }
    for (let ri = 0; ri <= rows; ri++) {
      const z = supply === 'north' ? rect.z0 + ri * bd : rect.z1 - ri * bd;
      for (let c = 0; c < cols; c++) {
        const xa = rect.x0 + c * bw;
        const xb = xa + bw;
        const mid = (xa + xb) / 2;
        const gap = ri < rows;
        const segs: [number, number][] = gap
          ? [
              [xa + 0.15, mid - 0.3],
              [mid + 0.3, xb - 0.15],
            ]
          : [[xa + 0.15, xb - 0.15]];
        for (const [a, b] of segs)
          berms.push(
            ridge(
              [
                [a, z],
                [b, z],
              ],
              0.3,
              0.13,
            ),
          );
        if (gap) sluice(mid, z, 0, plan[ri][c].flooded || (ri + 1 < rows && plan[ri + 1][c].flooded), wood);
        if (ri === 0)
          water.push(
            waterStrip(
              fieldSide > 0
                ? [
                    [mid, chZ + 0.2],
                    [mid, inletZ - 0.05],
                  ]
                : [
                    [mid, chZ - 0.2],
                    [mid, inletZ + 0.05],
                  ],
              0.22,
              0.03,
            ),
          );
      }
    }
    // basin contents
    plan.forEach((row, ri) =>
      row.forEach((b, ci) => {
        const rc = basinRect(field, ci, ri);
        if (b.flooded) {
          const p = new THREE.PlaneGeometry(rc.x1 - rc.x0 - 0.36, rc.z1 - rc.z0 - 0.36);
          p.rotateX(-Math.PI / 2);
          const uv = p.attributes.uv as THREE.BufferAttribute;
          for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.4, uv.getY(i) * 2.6);
          p.translate((rc.x0 + rc.x1) / 2, 0.05, (rc.z0 + rc.z1) / 2);
          still.push(p);
        }
        if (b.kind === 'okra') return;
        const isGrass = b.kind === 'rhodes' || b.kind === 'baled';
        const sp = spacing * (isGrass ? 1.6 : 1);
        const [h0, h1] = HEIGHT[b.kind];
        for (let x = rc.x0 + 0.28; x < rc.x1 - 0.22; x += sp)
          for (let z = rc.z0 + 0.28; z < rc.z1 - 0.22; z += sp) {
            if ((b.kind === 'cut' || b.kind === 'baled') && r() < 0.35) continue;
            const px = x + (r() - 0.5) * sp * 0.7;
            const pz = z + (r() - 0.5) * sp * 0.7;
            const s = h0 + r() * (h1 - h0);
            const mt = new THREE.Matrix4().compose(
              new THREE.Vector3(px, b.flooded ? 0.0 : -0.02, pz),
              new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6.28, 0)),
              new THREE.Vector3(s * (1.1 + r() * 0.3), s, s * (1.1 + r() * 0.3)),
            );
            if (isGrass) grass.push({ m: mt, c: new THREE.Color().setHSL(0.17 + r() * 0.05, 0.4 + r() * 0.15, 0.4 + r() * 0.12 + (b.kind === 'baled' ? 0.08 : 0)) });
            else legume.push({ m: mt, c: new THREE.Color().setHSL(0.24 + r() * 0.04, 0.45 + r() * 0.15, 0.36 + r() * 0.12 + (b.kind === 'cut' ? 0.05 : 0)) });
          }
        if (b.kind === 'baled') {
          // a row of fresh bales waiting to be carted
          const n = 4;
          for (let k = 0; k < n; k++) {
            const bx = rc.x0 + 0.7 + (k * (rc.x1 - rc.x0 - 1.4)) / (n - 1) + (r() - 0.5) * 0.3;
            const bz = (rc.z0 + rc.z1) / 2 + (r() - 0.5) * 1.6;
            const mm = new THREE.Matrix4().compose(new THREE.Vector3(bx, 0.2, bz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 3, 0)), new THREE.Vector3(1, 1, 1));
            straw.push(boxProjectUVs(roundedBox(0.92, 0.4, 0.46, 0.06, 2).clone(), 1.1).applyMatrix4(mm));
            for (const dx of [-0.22, 0.22]) twine.push(new THREE.BoxGeometry(0.018, 0.408, 0.468).translate(dx, 0, 0).applyMatrix4(mm));
          }
        }
      }),
    );
    // standpipe with a gate valve, pouring into the head of the channel
    const px = xs - 0.25 * flow;
    const face = fieldSide * 0.12; // the valve wheel faces the field side
    stone.push(boxProjectUVs(roundedBox(0.62, 0.42, 0.62, 0.05, 1).clone(), 0.6).translate(px, 0.21, chZ));
    metal.push(new THREE.CylinderGeometry(0.065, 0.065, 0.62, 16).translate(px, 0.72, chZ));
    metal.push(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(px, 1.0, chZ),
          new THREE.Vector3(px + 0.05 * flow, 1.08, chZ),
          new THREE.Vector3(px + 0.22 * flow, 1.05, chZ),
          new THREE.Vector3(px + 0.4 * flow, 0.95, chZ),
        ]),
        12,
        0.06,
        12,
        false,
      ),
    );
    metal.push(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 16).rotateZ(Math.PI / 2).translate(px, 0.72, chZ));
    iron.push(new THREE.TorusGeometry(0.11, 0.013, 6, 24).translate(px, 0.72, chZ + face));
    for (let k = 0; k < 3; k++) iron.push(new THREE.BoxGeometry(0.21, 0.012, 0.012).rotateZ((k * Math.PI) / 3).translate(px, 0.72, chZ + face));
    iron.push(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 6).rotateX(Math.PI / 2).translate(px, 0.72, chZ + face / 2));
    {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        pts.push(new THREE.Vector3(px + (0.42 + t * 0.38) * flow, 0.94 - t * t * 0.92, chZ));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const len = curve.getLength();
      const tube = new THREE.TubeGeometry(curve, 16, 0.045, 10, false);
      const uv = tube.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i) * len * 1.6);
      water.push(tube);
      const splash = new THREE.CircleGeometry(0.26, 20);
      splash.rotateX(-Math.PI / 2);
      splash.translate(px + 0.82 * flow, 0.045, chZ);
      water.push(splash);
    }
    const g = (list: THREE.BufferGeometry[]) => (list.length ? merge(list) : null);
    return {
      legume,
      grass,
      berms: merge(berms),
      water: merge(water.map((w) => (w.attributes.normal ? w : (w.computeVertexNormals(), w)))),
      still: g(still),
      wood: merge(wood),
      metal: merge(metal),
      stone: merge(stone),
      iron: merge(iron),
      straw: g(straw),
      twine: g(twine),
    };
  }, [spacing, field]);

  useLayoutEffect(() => {
    for (const [ref, items] of [
      [legRef, built.legume],
      [grassRef, built.grass],
    ] as const) {
      const mesh = ref.current;
      if (!mesh) continue;
      items.forEach((it, i) => {
        mesh.setMatrixAt(i, it.m);
        mesh.setColorAt(i, it.c);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [built]);

  return (
    <group>
      <mesh geometry={built.berms} material={m.berm} receiveShadow />
      <mesh geometry={built.water} material={m.water} receiveShadow />
      {built.still && <mesh geometry={built.still} material={m.stillWater} receiveShadow />}
      <mesh geometry={built.wood} material={m.woodDark} castShadow receiveShadow />
      <mesh geometry={built.metal} material={m.galvanised} castShadow receiveShadow />
      <mesh geometry={built.stone} material={m.stone} castShadow receiveShadow />
      <mesh geometry={built.iron} material={m.iron} castShadow />
      {built.straw && <mesh geometry={built.straw} material={m.straw} castShadow receiveShadow />}
      {built.twine && <mesh geometry={built.twine} material={m.rope} castShadow receiveShadow />}
      {built.legume.length > 0 && <instancedMesh ref={legRef} args={[clump, mat, built.legume.length]} receiveShadow />}
      {built.grass.length > 0 && <instancedMesh ref={grassRef} args={[tussock, mat, built.grass.length]} receiveShadow />}
    </group>
  );
}
