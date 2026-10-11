import { useMemo } from 'react';
import * as THREE from 'three';
import { archPath, type Opening } from '../../props/geo';
import type { Vec3 } from '../../core/types';
import { DatePalms, type PalmSpec } from '../../props/DatePalms';
import type { Quality } from '../../core/types';
import { chamferTile, latheSimple, rand } from './geometry';
import { ARCHES, BACK, BEVEL, COURT, DOOR, FY, LEFT, NICHES, RIGHT } from './layout';
import type { PotteryMaterials } from './materials';
import { Danchal, danchalRun, Instances, Merlons, merlonRun, Slab, Wall, type InstanceSpec } from './parts';

/* ------------------------------------------------------------------ */
/*  The courtyard: hand-made terracotta floor with a limestone border, */
/*  lime-plastered coral-stone walls (display niches, an arched        */
/*  arcade, a carved doorway), danchal beams, merlons and the old-town */
/*  rooftops of the Heart of Sharjah around it.                         */
/* ------------------------------------------------------------------ */

/** Outer extent of the back wall (it runs across the side walls' thickness) */
const WX0 = COURT.x0 - LEFT.t;
const WX1 = COURT.x1 + RIGHT.t;
const WXC = (WX0 + WX1) / 2;

const TILE = 0.296;
const PITCH = 0.31;
const BORDER = 0.36;

function Floor({ m }: { m: PotteryMaterials }) {
  const tileGeo = useMemo(() => chamferTile(TILE, TILE, 0.016, 0.006), []);
  const tiles = useMemo(() => {
    const x0 = COURT.x0 + BORDER;
    const x1 = COURT.x1 - BORDER;
    const z0 = COURT.z0 + BORDER;
    const z1 = COURT.z1 - 0.3;
    const nx = Math.floor((x1 - x0) / PITCH);
    const nz = Math.floor((z1 - z0) / PITCH);
    const ox = (x0 + x1) / 2 - ((nx - 1) * PITCH) / 2;
    const oz = (z0 + z1) / 2 - ((nz - 1) * PITCH) / 2;
    const r = rand(7);
    const palette = ['#B88A69', '#AA7C5D', '#C29A79', '#A07357', '#B5896B', '#C4A386'].map((c) => new THREE.Color(c));
    const out: InstanceSpec[] = [];
    for (let i = 0; i < nx; i++)
      for (let k = 0; k < nz; k++) {
        const c = palette[Math.floor(r() * palette.length)].clone().lerp(palette[Math.floor(r() * palette.length)], r());
        if (r() < 0.06) c.multiplyScalar(0.86); // kiln-flashed tile
        c.offsetHSL((r() - 0.5) * 0.01, (r() - 0.5) * 0.04, (r() - 0.5) * 0.035);
        out.push({
          p: [ox + i * PITCH + (r() - 0.5) * 0.004, FY - 0.016 + (r() - 0.5) * 0.0016, oz + k * PITCH + (r() - 0.5) * 0.004],
          r: [(r() - 0.5) * 0.006, Math.floor(r() * 4) * (Math.PI / 2) + (r() - 0.5) * 0.012, (r() - 0.5) * 0.006],
          c,
        });
      }
    return out;
  }, []);
  // limestone border: individual slabs along the three walls
  const border = useMemo(() => {
    const out: { p: Vec3; s: Vec3 }[] = [];
    const len = 0.62;
    const nb = Math.round((COURT.x1 - COURT.x0) / len);
    for (let i = 0; i < nb; i++) {
      const w = (COURT.x1 - COURT.x0) / nb;
      out.push({ p: [COURT.x0 + (i + 0.5) * w, FY - 0.03, COURT.z0 + BORDER / 2], s: [w - 0.012, 0.06, BORDER - 0.012] });
    }
    const zz0 = COURT.z0 + BORDER;
    const zz1 = COURT.z1 - 0.3;
    const ns = Math.round((zz1 - zz0) / len);
    for (const x of [COURT.x0 + BORDER / 2, COURT.x1 - BORDER / 2])
      for (let i = 0; i < ns; i++) {
        const w = (zz1 - zz0) / ns;
        out.push({ p: [x, FY - 0.03, zz0 + (i + 0.5) * w], s: [BORDER - 0.012, 0.06, w - 0.012] });
      }
    return out;
  }, []);
  return (
    <group>
      {/* base slab whose top is the lime grout seen in the joints */}
      <Slab mat={m.grout} position={[0, (FY - 0.006) / 2, (COURT.z0 + COURT.z1 - 0.3) / 2]} size={[COURT.x1 - COURT.x0, FY - 0.006, COURT.z1 - 0.3 - COURT.z0]} r={0.005} cast={false} />
      <Instances geometry={tileGeo} material={m.tile} items={tiles} cast={false} />
      {border.map((b, i) => (
        <Slab key={i} mat={m.limestone} position={b.p} size={b.s} r={0.012} cast={false} />
      ))}
      {/* threshold step down to the alley */}
      <Slab mat={m.limestone} position={[WXC, FY / 2, COURT.z1 + 0.06]} size={[WX1 - WX0 + 0.06, FY, 0.72]} r={0.03} cast={false} />
      <Slab mat={m.limestone} position={[WXC, 0.04, COURT.z1 + 0.62]} size={[WX1 - WX0 + 0.4, 0.08, 0.5]} r={0.025} cast={false} />
    </group>
  );
}

function Ground({ m }: { m: PotteryMaterials }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} material={m.ground} receiveShadow>
      <planeGeometry args={[140, 140]} />
    </mesh>
  );
}

function BackWall({ m }: { m: PotteryMaterials }) {
  const niches: Opening[] = useMemo(() => NICHES.x.map((x) => ({ x, y: NICHES.sill, w: NICHES.w, h: NICHES.h, kind: 'pointed' as const })), []);
  const zf = COURT.z0 - BACK.front / 2;
  const zb = COURT.z0 - BACK.front - BACK.backing / 2;
  const merlons = useMemo(() => merlonRun([WX0, COURT.z0 - 0.2], [WX1, COURT.z0 - 0.2], BACK.h + 0.08, 0.6), []);
  const danchal = useMemo(() => danchalRun([COURT.x0 + 0.3, COURT.z0], [COURT.x1 - 0.3, COURT.z0], BACK.h - 0.42, [0, 1], 0.62), []);
  // niche openings are given relative to the wall centre
  const local: Opening[] = useMemo(() => niches.map((o) => ({ ...o, x: o.x - WXC })), [niches]);
  return (
    <group>
      <Wall mat={m.wall} position={[WXC, 0, zf]} width={WX1 - WX0} height={BACK.h} thickness={BACK.front} openings={local} />
      <Wall mat={m.wall} position={[WXC, 0, zb]} width={WX1 - WX0} height={BACK.h} thickness={BACK.backing} />
      {/* niche backs: warm ochre lime-wash */}
      {NICHES.x.map((x) => (
        <Slab key={x} mat={m.nicheWash} position={[x, NICHES.sill + NICHES.h / 2, COURT.z0 - BACK.front + 0.006]} size={[NICHES.w - 0.02, NICHES.h - 0.02, 0.01]} r={0.004} cast={false} />
      ))}
      {/* coping, cornice and dado */}
      <Slab mat={m.wallLight} position={[WXC, BACK.h + 0.04, COURT.z0 - 0.27]} size={[WX1 - WX0 + 0.1, 0.08, 0.66]} r={0.03} />
      <Slab mat={m.wallLight} position={[0, BACK.h - 0.86, COURT.z0 + 0.03]} size={[COURT.x1 - COURT.x0, 0.11, 0.08]} r={0.02} />
      <Slab mat={m.dado} position={[0, FY + 0.18, COURT.z0 + 0.012]} size={[COURT.x1 - COURT.x0, 0.36, 0.03]} r={0.01} cast={false} />
      <Merlons mat={m.wallLight} items={merlons} />
      <Danchal mat={m.danchal} items={danchal} />
    </group>
  );
}

function LeftWall({ m }: { m: PotteryMaterials }) {
  const zc = (COURT.z0 - 0.55 + COURT.z1) / 2;
  const door: Opening[] = useMemo(() => [{ x: zc - DOOR.z, y: FY, w: DOOR.w, h: DOOR.h, kind: 'round' as const }], [zc]);
  const x = COURT.x0 - LEFT.t / 2;
  const merlons = useMemo(() => merlonRun([x, COURT.z0 - 0.5], [x, COURT.z1], LEFT.h + 0.08, 0.6), [x]);
  const d0 = DOOR.z - DOOR.w / 2 - 0.05;
  const d1 = DOOR.z + DOOR.w / 2 + 0.05;
  return (
    <group>
      <Wall mat={m.wall} position={[x, 0, zc]} rotation={Math.PI / 2} width={COURT.z1 - COURT.z0 + 0.55} height={LEFT.h} thickness={LEFT.t} openings={door} />
      <Slab mat={m.wallLight} position={[x + 0.02, LEFT.h + 0.04, zc]} size={[0.62, 0.08, COURT.z1 - COURT.z0 + 0.6]} r={0.03} />
      <Slab mat={m.wallLight} position={[COURT.x0 + 0.03, LEFT.h - 0.86, (COURT.z0 + COURT.z1) / 2]} size={[0.08, 0.11, COURT.z1 - COURT.z0]} r={0.02} />
      <Slab mat={m.dado} position={[COURT.x0 + 0.012, FY + 0.18, (COURT.z0 + d0) / 2]} size={[0.03, 0.36, d0 - COURT.z0]} r={0.01} cast={false} />
      <Slab mat={m.dado} position={[COURT.x0 + 0.012, FY + 0.18, (d1 + COURT.z1) / 2]} size={[0.03, 0.36, COURT.z1 - d1]} r={0.01} cast={false} />
      <Merlons mat={m.wallLight} items={merlons} />
      <DoorRoom m={m} />
    </group>
  );
}

/** Carved double door, one leaf open onto a dim store room. */
function DoorRoom({ m }: { m: PotteryMaterials }) {
  const X = COURT.x0 - LEFT.t;
  const z0 = DOOR.z - 2.0;
  const z1 = DOOR.z + 2.0;
  const depth = 3.4;
  const H = 3.3;
  const leafW = DOOR.w / 2 - 0.02;
  const leafH = DOOR.h - DOOR.w / 2 + 0.15;
  return (
    <group>
      {/* room shell (casts shadow so only the door lets light in) */}
      <Slab mat={m.interior} position={[X - depth / 2, FY / 2, DOOR.z]} size={[depth, FY, z1 - z0]} cast={false} />
      <Slab mat={m.interior} position={[X - depth - 0.1, H / 2, DOOR.z]} size={[0.2, H, z1 - z0]} />
      <Slab mat={m.interior} position={[X - depth / 2, H / 2, z0 - 0.1]} size={[depth + 0.2, H, 0.2]} />
      <Slab mat={m.interior} position={[X - depth / 2, H / 2, z1 + 0.1]} size={[depth + 0.2, H, 0.2]} />
      <Slab mat={m.wallLight} position={[X - depth / 2, H + 0.1, DOOR.z]} size={[depth + 0.4, 0.2, z1 - z0 + 0.4]} />
      {/* shelves of stored ware glimpsed inside */}
      <Slab mat={m.woodDark} position={[X - depth + 0.25, 1.1, DOOR.z]} size={[0.4, 0.04, 2.6]} />
      <Slab mat={m.woodDark} position={[X - depth + 0.25, 1.7, DOOR.z]} size={[0.4, 0.04, 2.6]} />
      {/* door frame + leaves */}
      <Slab mat={m.woodDark} position={[COURT.x0 - 0.06, FY + DOOR.h - DOOR.w / 2 + 0.05, DOOR.z]} size={[0.14, 0.12, DOOR.w + 0.1]} r={0.015} />
      {[
        { hinge: DOOR.z - DOOR.w / 2 + 0.06, dir: 1, open: -1.5 },
        { hinge: DOOR.z + DOOR.w / 2 - 0.06, dir: -1, open: 1.05 },
      ].map((l, i) => (
        <group key={i} position={[COURT.x0 - 0.12, FY + 0.01, l.hinge]} rotation={[0, l.open, 0]}>
          <Slab mat={m.woodDark} position={[0, leafH / 2, (l.dir * leafW) / 2]} size={[0.07, leafH, leafW]} r={0.012} uv={0.8} />
          {[0.28, 0.62].map((f) => (
            <Slab key={f} mat={m.woodMid} position={[0.04, leafH * f, (l.dir * leafW) / 2]} size={[0.025, leafH * 0.26, leafW - 0.18]} r={0.008} uv={0.8} />
          ))}
          <Slab mat={m.woodMid} position={[0.04, leafH * 0.9, (l.dir * leafW) / 2]} size={[0.025, leafH * 0.08, leafW - 0.18]} r={0.008} uv={0.8} />
        </group>
      ))}
    </group>
  );
}

function RightWall({ m }: { m: PotteryMaterials }) {
  const zc = (COURT.z0 - 0.55 + COURT.z1) / 2;
  const arches: Opening[] = useMemo(() => ARCHES.z.map((z) => ({ x: zc - z, y: ARCHES.sill, w: ARCHES.w, h: ARCHES.h, kind: 'pointed' as const })), [zc]);
  const x = COURT.x1 + RIGHT.t / 2;
  const merlons = useMemo(() => merlonRun([x, COURT.z0 - 0.5], [x, COURT.z1], RIGHT.h + 0.08, 0.6), [x]);
  return (
    <group>
      <Wall mat={m.wall} position={[x, 0, zc]} rotation={Math.PI / 2} width={COURT.z1 - COURT.z0 + 0.55} height={RIGHT.h} thickness={RIGHT.t} openings={arches} />
      <Slab mat={m.wallLight} position={[x - 0.02, RIGHT.h + 0.04, zc]} size={[0.57, 0.08, COURT.z1 - COURT.z0 + 0.6]} r={0.03} />
      <Slab mat={m.dado} position={[COURT.x1 - 0.012, FY + 0.18, (COURT.z0 + COURT.z1) / 2]} size={[0.03, 0.36, COURT.z1 - COURT.z0]} r={0.01} cast={false} />
      {/* stone sills */}
      {ARCHES.z.map((z) => (
        <Slab key={z} mat={m.limestone} position={[x, ARCHES.sill + 0.012, z]} size={[RIGHT.t + 0.12, 0.06, ARCHES.w + 0.02]} r={0.015} />
      ))}
      <Merlons mat={m.wallLight} items={merlons} />
      <ArchLattice m={m} x={x} />
    </group>
  );
}

/**
 * Timber lattice (shubbak) filling the pointed head of each arcade arch:
 * the low sun throws its diamond pattern across the courtyard floor.
 */
function ArchLattice({ m, x }: { m: PotteryMaterials; x: number }) {
  const w = ARCHES.w - BEVEL * 2;
  const r = w / 2;
  const h = ARCHES.h - BEVEL * 2;
  const y0 = ARCHES.sill + BEVEL;
  const spring = y0 + h - r * 1.25;
  const bars = useMemo(() => {
    const out: InstanceSpec[] = [];
    const path = new THREE.Path();
    archPath(path, 0, y0, w, h, 'pointed');
    const head = path.getPoints(4).filter((p) => p.y >= spring - 1e-4);
    const s2 = Math.SQRT1_2;
    for (const zc of ARCHES.z) {
      const poly = head.map((p) => new THREE.Vector2(zc + p.x, p.y));
      for (const dir of [1, -1]) {
        const d = new THREE.Vector2(s2, dir * s2);
        for (let c = -1.6; c <= 1.6; c += 0.075) {
          const o = new THREE.Vector2(zc, spring + c);
          const ts: number[] = [];
          for (let i = 0; i < poly.length; i++) {
            const a = poly[i];
            const b = poly[(i + 1) % poly.length];
            const e = b.clone().sub(a);
            const den = d.x * e.y - d.y * e.x;
            if (Math.abs(den) < 1e-9) continue;
            const ao = a.clone().sub(o);
            const t = (ao.x * e.y - ao.y * e.x) / den;
            const u = (ao.x * d.y - ao.y * d.x) / den;
            if (u >= 0 && u <= 1) ts.push(t);
          }
          if (ts.length < 2) continue;
          const t0 = Math.min(...ts) - 0.012;
          const t1 = Math.max(...ts) + 0.012;
          if (t1 - t0 < 0.06) continue;
          const mid = o.clone().addScaledVector(d, (t0 + t1) / 2);
          out.push({ p: [x, mid.y, mid.x], r: [Math.atan2(1, dir), 0, 0], s: [1, t1 - t0, 1] });
        }
      }
    }
    return out;
  }, [x, w, h, y0, spring]);
  const bar = useMemo(() => new THREE.BoxGeometry(0.03, 1, 0.018), []);
  return (
    <group>
      <Instances geometry={bar} material={m.woodDark} items={bars} />
      {ARCHES.z.map((zc) => (
        <Slab key={zc} mat={m.woodDark} position={[x, spring - 0.02, zc]} size={[0.07, 0.05, w + 0.04]} r={0.008} />
      ))}
    </group>
  );
}

/** Date palms in the lane beside the arcade and behind the back-left corner. */
const PALMS: PalmSpec[] = [
  { position: [8.2, 0, -1.6], height: 5.6, lean: 0.12, leanDir: 3.4, seed: 7, fruit: true },
  { position: [-7.8, 0, -5.4], height: 6.4, lean: 0.08, leanDir: 0.7, seed: 3 },
];

/** A slender old-town minaret: square base, round shaft, carved balcony, pointed cap. */
function Minaret({ m, position }: { m: PotteryMaterials; position: Vec3 }) {
  const shaft = useMemo(
    () =>
      latheSimple(
        [
          [0.0005, 0],
          [1.05, 0],
          [1.05, 0.3],
          [0.92, 0.45],
          [0.86, 7.5],
          [1.18, 7.75],
          [1.24, 8.1],
          [1.16, 8.25],
          [0.66, 8.3],
          [0.64, 10.6],
          [0.78, 10.75],
          [0.8, 10.95],
          [0.62, 11.05],
          [0.55, 11.6],
          [0.4, 12.05],
          [0.18, 12.45],
          [0.05, 12.75],
          [0.0005, 12.8],
        ],
        { segments: 32, uvDensity: 0.6 },
      ),
    [],
  );
  return (
    <group position={position}>
      <Slab mat={m.wallLight} position={[0, 2.6, 0]} size={[2.6, 5.2, 2.6]} r={0.05} />
      <mesh geometry={shaft} material={m.wallLight} position={[0, 5.2, 0]} castShadow receiveShadow />
      <mesh position={[0, 18.25, 0]} material={m.brass}>
        <cylinderGeometry args={[0.02, 0.02, 0.6, 6]} />
      </mesh>
      <mesh position={[0, 18.6, 0]} material={m.brass}>
        <sphereGeometry args={[0.07, 10, 8]} />
      </mesh>
    </group>
  );
}

/** Massing of the surrounding old town: courtyard houses, wind towers, a minaret, palms. */
function Neighbours({ m, quality }: { m: PotteryMaterials; quality: Quality }) {
  const zb = COURT.z0 - BACK.front - BACK.backing;
  const box = (x0: number, x1: number, z0: number, z1: number, h: number, crown = true) => ({ c: [(x0 + x1) / 2, h / 2, (z0 + z1) / 2] as Vec3, s: [x1 - x0, h, z1 - z0] as Vec3, crown });
  const blocks = [
    box(-7.3, 2.0, zb - 6.2, zb - 1.1, 6.2),
    box(2.4, 10.5, zb - 7.0, zb - 0.45, 4.8),
    box(-14.0, -9.4, -9.0, 5.0, 5.0),
    box(10.1, 10.55, -8, 9, 1.8, false),
    box(-9.4, -7.0, zb - 6.2, zb - 0.6, 4.0),
    // second ring of old-town houses so the roofscape continues to the horizon
    box(-7.3, 4.2, zb - 13.0, zb - 6.6, 4.6),
    box(4.4, 10.0, zb - 12.0, zb - 7.4, 6.4),
    box(-13.0, -7.6, zb - 12.5, zb - 6.6, 5.6),
    // single-storey roofs on the sun side so the arcade keeps its light
    box(13.5, 20.0, zb - 10.0, 2.0, 2.6),
    box(13.5, 19.0, 2.4, 13.0, 2.4),
    box(-20.0, -14.4, -12.0, 6.0, 4.8),
    box(-5.0, 9.0, zb - 22.0, zb - 13.6, 5.0),
    box(-18.0, -5.4, zb - 22.0, zb - 13.2, 4.4),
    box(10.4, 22.0, zb - 22.0, zb - 10.6, 4.6),
  ];
  const merlons = useMemo(() => {
    const out: InstanceSpec[] = [];
    for (const b of blocks) {
      if (b.crown === false) continue;
      const [cx, , cz] = b.c;
      const [sx, sy, sz] = b.s;
      const y = sy + 0.12;
      out.push(...merlonRun([cx - sx / 2, cz + sz / 2 - 0.15], [cx + sx / 2, cz + sz / 2 - 0.15], y, 0.62));
      out.push(...merlonRun([cx - sx / 2 + 0.15, cz - sz / 2], [cx - sx / 2 + 0.15, cz + sz / 2], y, 0.62));
      out.push(...merlonRun([cx + sx / 2 - 0.15, cz - sz / 2], [cx + sx / 2 - 0.15, cz + sz / 2], y, 0.62));
    }
    return out;
  }, []);
  const danchal = useMemo(
    () => [
      ...danchalRun([-7.0, zb - 1.1], [1.8, zb - 1.1], 5.6, [0, 1], 0.62),
    ],
    [],
  );
  return (
    <group>
      {blocks.map((b, i) => (
        <group key={i}>
          <Slab mat={m.wall} position={b.c} size={b.s} r={0.05} />
          <Slab mat={m.wallLight} position={[b.c[0], b.s[1] + 0.05, b.c[2]]} size={[b.s[0] + 0.12, 0.1, b.s[2] + 0.12]} r={0.03} />
        </group>
      ))}
      <Merlons mat={m.wallLight} items={merlons} />
      <Danchal mat={m.danchal} items={danchal} />
      <Barjeel m={m} position={[-4.4, 6.2, zb - 3.6]} />
      <Barjeel m={m} position={[7.6, 6.4, zb - 9.6]} />
      <Minaret m={m} position={[2.5, 0, zb - 17.5]} />
      <DatePalms palms={PALMS} quality={quality} />
    </group>
  );
}

/** Barjeel: the wind tower that funnels breeze into the house below. */
function Barjeel({ m, position }: { m: PotteryMaterials; position: Vec3 }) {
  const S = 2.3;
  const lower = 1.4;
  const open = 1.8;
  const slats = useMemo(() => {
    const out: InstanceSpec[] = [];
    for (let f = 0; f < 4; f++) {
      const a = (f * Math.PI) / 2;
      for (let i = 0; i < 5; i++) {
        const v = new THREE.Vector3(-S / 2 + 0.45 + (i * (S - 0.9)) / 4, 0, S / 2 - 0.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
        out.push({ p: [v.x, lower + open / 2, v.z], r: [0, a, 0] });
      }
    }
    return out;
  }, []);
  const slatGeo = useMemo(() => new THREE.BoxGeometry(0.06, open, 0.07), []);
  const merlons = useMemo(() => {
    const y = lower + open + 0.36;
    const h = S / 2;
    return [...merlonRun([-h, -h], [h, -h], y, 0.48), ...merlonRun([-h, h], [h, h], y, 0.48), ...merlonRun([-h, -h], [-h, h], y, 0.48), ...merlonRun([h, -h], [h, h], y, 0.48)];
  }, []);
  return (
    <group position={position}>
      <Slab mat={m.wallLight} position={[0, lower / 2, 0]} size={[S, lower, S]} r={0.05} />
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <Slab key={i} mat={m.wallLight} position={[(sx * (S - 0.38)) / 2, lower + open / 2, (sz * (S - 0.38)) / 2]} size={[0.38, open, 0.38]} r={0.04} />
      ))}
      {[Math.PI / 4, -Math.PI / 4].map((r) => (
        <Slab key={r} mat={m.wall} position={[0, lower + open / 2, 0]} rotation={[0, r, 0]} size={[S * 1.2, open, 0.1]} r={0.02} />
      ))}
      <Instances geometry={slatGeo} material={m.woodDark} items={slats} />
      <Slab mat={m.wallLight} position={[0, lower + open + 0.12, 0]} size={[S + 0.26, 0.24, S + 0.26]} r={0.05} />
      <Slab mat={m.wallLight} position={[0, lower + open + 0.29, 0]} size={[S + 0.08, 0.12, S + 0.08]} r={0.03} />
      <Merlons mat={m.wallLight} items={merlons} size={0.34} depth={0.18} />
    </group>
  );
}

export function Architecture({ m, quality }: { m: PotteryMaterials; quality: Quality }) {
  return (
    <group>
      <Ground m={m} />
      <Floor m={m} />
      <BackWall m={m} />
      <LeftWall m={m} />
      <RightWall m={m} />
      <Neighbours m={m} quality={quality} />
    </group>
  );
}
