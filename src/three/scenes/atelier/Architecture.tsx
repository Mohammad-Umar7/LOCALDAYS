import { useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { roundedBox, wallGeometry, type Opening } from '../../props/geo';
import type { Variant, Vec3 } from '../../core/types';
import type { AtelierMaterials } from './materials';
import { DOOR, GIRDER_Z, NICHES, NICHE_DEPTH, POLE_R, POLE_XS, ROOM, WINDOW, DRAWERS } from './layout';
import { archBand, archHalfWidth, archPanel, archPoints, boxUV, cached, type ArchKind } from './geom';
import { skyTexture } from './textures';
import { Baked } from './Baked';

/* ------------------------------------------------------------------ */
/*  The atelier shell: encaustic floor, plaster walls with carved      */
/*  timber wainscot and frieze, danchal ceiling, backlit arched        */
/*  niches, a mashrabiya window and a studded carved door.             */
/* ------------------------------------------------------------------ */

const { x0, x1, z0, z1, h: CEIL, top: TOP, t: T, wainscot: WH } = ROOM;
const CUT_Y = CEIL - POLE_R * 2 - 0.03;

/** Rounded box with world-scale UVs (cached). */
export function rbox(w: number, h: number, d: number, r = 0.008) {
  return cached(`rbox:${w}:${h}:${d}:${r}`, () => boxUV(roundedBox(w, h, d, r, 2).clone(), 1));
}

export function Box({ m, p, s, r = 0.008, rot, cast = true, receive = true }: { m: THREE.Material; p: Vec3; s: Vec3; r?: number; rot?: Vec3; cast?: boolean; receive?: boolean }) {
  return <mesh geometry={rbox(s[0], s[1], s[2], r)} material={m} position={p} rotation={rot} castShadow={cast} receiveShadow={receive} />;
}

type WallId = 'back' | 'left' | 'right';
/** Local wall frame: u along the wall, +z into the room, inner face at z = 0. */
export function WallFrame({ wall, children }: { wall: WallId; children: ReactNode }) {
  if (wall === 'back') return <group position={[0, 0, z0]}>{children}</group>;
  if (wall === 'left')
    return (
      <group position={[x0, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        {children}
      </group>
    );
  return (
    <group position={[x1, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
      {children}
    </group>
  );
}

/* --------------------------------- Floor --------------------------------- */

function Floor({ m }: { m: AtelierMaterials }) {
  const b = 0.18; // dark marble border
  const fw = x1 - x0 - b * 2;
  const fd = z1 - z0 - b;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, z0 + b + fd / 2]} material={m.floor} receiveShadow>
        <planeGeometry args={[fw, fd]} />
      </mesh>
      {/* border strips */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, z0 + b / 2]} material={m.marbleDark} receiveShadow>
        <planeGeometry args={[x1 - x0, b]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} rotation={[-Math.PI / 2, 0, 0]} position={[s * (x1 - b / 2), 0, z0 + b + fd / 2]} material={m.marbleDark} receiveShadow>
          <planeGeometry args={[b, fd]} />
        </mesh>
      ))}
      {/* brass inlay between border and tiles */}
      <Box m={m.brass} p={[0, 0.001, z0 + b]} s={[fw, 0.003, 0.012]} r={0.001} cast={false} />
      {[-1, 1].map((s) => (
        <Box key={s} m={m.brass} p={[s * (x1 - b), 0.001, z0 + b + fd / 2]} s={[0.012, 0.003, fd]} r={0.001} cast={false} />
      ))}
      {/* diorama plinth with a brass edge */}
      <Box m={m.ebony} p={[0, -0.16, (z0 - T + z1) / 2]} s={[x1 - x0 + T * 2 + 0.04, 0.31, z1 - z0 + T + 0.02]} r={0.01} cast={false} />
      <Box m={m.brass} p={[0, -0.025, z1 + 0.012]} s={[x1 - x0 + T * 2 + 0.05, 0.022, 0.012]} r={0.004} cast={false} />
      <Box m={m.brass} p={[0, -0.29, z1 + 0.012]} s={[x1 - x0 + T * 2 + 0.05, 0.012, 0.012]} r={0.004} cast={false} />
    </group>
  );
}

/* --------------------------------- Walls --------------------------------- */

function Walls({ m }: { m: AtelierMaterials }) {
  const back: Opening[] = useMemo(
    () => [
      { x: NICHES.grand.c, y: NICHES.grand.y, w: NICHES.grand.w, h: NICHES.grand.h, kind: 'ogee' },
      { x: NICHES.left.c, y: NICHES.left.y, w: NICHES.left.w, h: NICHES.left.h, kind: 'pointed' },
    ],
    [],
  );
  const left: Opening[] = useMemo(() => [{ x: -WINDOW.z, y: WINDOW.y, w: WINDOW.w, h: WINDOW.h, kind: 'ogee' }], []);
  const right: Opening[] = useMemo(
    () => [
      { x: DOOR.z, y: 0, w: DOOR.w, h: DOOR.h, kind: 'pointed' },
      { x: NICHES.right.c, y: NICHES.right.y, w: NICHES.right.w, h: NICHES.right.h, kind: 'pointed' },
    ],
    [],
  );
  const backGeo = useMemo(() => wallGeometry(x1 - x0 + T * 2, TOP, T, back, 0.01), [back]);
  const sideL = useMemo(() => wallGeometry(z1 - z0, TOP, T, left, 0.01), [left]);
  const sideR = useMemo(() => wallGeometry(z1 - z0, TOP, T, right, 0.01), [right]);
  const D = z1 - z0;
  return (
    <group>
      <mesh geometry={backGeo} material={m.plaster} position={[0, 0, z0 - T / 2]} castShadow receiveShadow />
      <mesh geometry={sideL} material={m.plaster} position={[x0 - T / 2, 0, (z0 + z1) / 2]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow />
      <mesh geometry={sideR} material={m.plaster} position={[x1 + T / 2, 0, (z0 + z1) / 2]} rotation={[0, -Math.PI / 2, 0]} castShadow receiveShadow />
      {/* cut section: dark caps on the wall tops and the open front edges, edged in brass */}
      <Box m={m.plasterCut} p={[0, TOP + 0.01, z0 - T / 2]} s={[x1 - x0 + T * 2 + 0.02, 0.02, T + 0.02]} r={0.004} cast={false} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box m={m.plasterCut} p={[s * (x1 + T / 2), TOP + 0.01, (z0 + z1) / 2]} s={[T + 0.02, 0.02, D]} r={0.004} cast={false} />
          <Box m={m.ebony} p={[s * (x1 + T / 2), TOP / 2, z1 + 0.012]} s={[T + 0.03, TOP + 0.02, 0.024]} r={0.004} cast={false} />
          <Box m={m.brass} p={[s * (x1 + T / 2), TOP / 2, z1 + 0.026]} s={[0.014, TOP - 0.1, 0.006]} r={0.002} cast={false} />
        </group>
      ))}
    </group>
  );
}

/* ----------------------------- Wainscot & frieze ----------------------------- */

const WALL_RUNS: Record<WallId, [number, number][]> = {
  back: [[x0, DRAWERS.x0 - 0.02]],
  left: [[-z1, -z0]],
  right: [
    [z0, DOOR.z - DOOR.w / 2 - 0.16],
    [DOOR.z + DOOR.w / 2 + 0.16, z1],
  ],
};

function Wainscot({ m, wall }: { m: AtelierMaterials; wall: WallId }) {
  const items = useMemo(() => {
    const out: { p: Vec3; s: Vec3; mat: 'walnut' | 'carvedPanel' | 'brass' | 'ebony'; r?: number }[] = [];
    for (const [a, b] of WALL_RUNS[wall]) {
      const L = b - a;
      const n = Math.max(1, Math.round(L / 0.62));
      const pw = L / n;
      const c = (a + b) / 2;
      out.push({ p: [c, WH / 2, 0.012], s: [L, WH, 0.024], mat: 'walnut', r: 0.004 });
      out.push({ p: [c, 0.07, 0.03], s: [L, 0.14, 0.03], mat: 'ebony', r: 0.006 });
      out.push({ p: [c, WH - 0.01, 0.045], s: [L + 0.02, 0.05, 0.075], mat: 'ebony', r: 0.012 });
      out.push({ p: [c, WH - 0.04, 0.083], s: [L + 0.02, 0.012, 0.004], mat: 'brass', r: 0.001 });
      for (let i = 0; i < n; i++) {
        const u = a + pw * (i + 0.5);
        out.push({ p: [u, 0.56, 0.032], s: [pw - 0.13, 0.62, 0.022], mat: 'carvedPanel', r: 0.008 });
        out.push({ p: [a + pw * i, 0.56, 0.03], s: [0.06, 0.78, 0.02], mat: 'walnut', r: 0.004 });
      }
    }
    return out;
  }, [wall]);
  return (
    <WallFrame wall={wall}>
      {items.map((it, i) => (
        <Box key={i} m={m[it.mat]} p={it.p} s={it.s} r={it.r} cast={false} />
      ))}
    </WallFrame>
  );
}

function Frieze({ m, wall }: { m: AtelierMaterials; wall: WallId }) {
  const L = wall === 'back' ? x1 - x0 : z1 - z0;
  const c = 0;
  return (
    <WallFrame wall={wall}>
      <Box m={m.carvedFrieze} p={[c, 3.29, 0.03]} s={[L, 0.24, 0.06]} r={0.01} cast={false} />
      <Box m={m.brass} p={[c, 3.165, 0.05]} s={[L, 0.014, 0.03]} r={0.003} cast={false} />
      <Box m={m.ebony} p={[c, 3.45, 0.05]} s={[L, 0.1, 0.1]} r={0.01} cast={false} />
    </WallFrame>
  );
}

/* --------------------------------- Ceiling -------------------------------- */

/**
 * Danchal poles on a carved girder with palm-rib matting above. Everything
 * faces downward only, so the ceiling vanishes when the camera rises above
 * it and the room reads as a cut-away model.
 */
function Ceiling({ m }: { m: AtelierMaterials }) {
  const len = z1 - z0;
  const poleGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(POLE_R, POLE_R * 1.08, len, 12, 6, true, -Math.PI / 2, Math.PI);
    // gentle irregularity like hand-cut mangrove poles
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const k = 1 + Math.sin(y * 3.1) * 0.06 + Math.sin(y * 7.7) * 0.03;
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    g.rotateX(Math.PI / 2);
    return g;
  }, [len]);
  const poles = useMemo(
    () => POLE_XS.map((x, i) => new THREE.Matrix4().makeTranslation(x + Math.sin(i * 7.1) * 0.015, CEIL - POLE_R + Math.sin(i * 3.3) * 0.006, z0 + len / 2)),
    [len],
  );
  const matGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    g.rotateX(Math.PI / 2);
    return g;
  }, []);
  return (
    <group>
      <mesh geometry={matGeo} material={m.matting} position={[0, CEIL, (z0 + z1) / 2]} receiveShadow />
      <Baked geo={poleGeo} mats={poles} material={m.pole} />
      {/* carved girder carrying the poles, with brass straps */}
      <Box m={m.carvedFrieze} p={[0, CEIL - POLE_R * 2 - 0.15, GIRDER_Z]} s={[x1 - x0, 0.3, 0.26]} r={0.02} cast={false} />
      {[-2.6, -0.9, 0.9, 2.6].map((x) => (
        <Box key={x} m={m.brassOld} p={[x, CEIL - POLE_R * 2 - 0.15, GIRDER_Z]} s={[0.05, 0.31, 0.27]} r={0.006} cast={false} />
      ))}
      {/* cut section of the roof (hides the pole ends), framed like the walls */}
      <Box m={m.ebony} p={[0, (CUT_Y + TOP) / 2 + 0.005, z1 + 0.012]} s={[x1 - x0 + 0.01, TOP - CUT_Y, 0.024]} r={0.004} cast={false} />
      <Box m={m.brass} p={[0, CUT_Y + 0.03, z1 + 0.026]} s={[x1 - x0 + T * 2 + 0.03, 0.012, 0.006]} r={0.002} cast={false} />
    </group>
  );
}

/* ------------------------------- Architraves ------------------------------- */

function Surround({ m, w, h, kind, band = 0.13, y = 0, u, depth = 0.045 }: { m: AtelierMaterials; w: number; h: number; kind: ArchKind; band?: number; y?: number; u: number; depth?: number }) {
  const geo = useMemo(() => boxUV(archBand(w + 0.01, h + 0.005, kind, band, depth).clone(), 1), [w, h, kind, band, depth]);
  const bead = useMemo(() => {
    const pts = archPoints(w + 0.01, h + 0.005, kind, 24).map((p) => new THREE.Vector3(p.x, p.y, 0));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 96, 0.009, 6, false);
  }, [w, h, kind]);
  return (
    <group position={[u, y, 0]}>
      <mesh geometry={geo} material={m.carvedPanel} receiveShadow />
      <mesh geometry={bead} material={m.brass} position={[0, 0, depth]} />
    </group>
  );
}

/* --------------------------------- Niches --------------------------------- */

let nicheGlowTex: THREE.Texture | null = null;
export function nicheGlowTexture() {
  if (nicheGlowTex) return nicheGlowTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 60, 4, 32, 120, 200);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(0.45, '#9a8a78');
  grd.addColorStop(1, '#2a221c');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  nicheGlowTex = t;
  return t;
}

function Niche({ m, glow, wall, n, kind }: { m: AtelierMaterials; glow: THREE.Material; wall: WallId; n: (typeof NICHES)[keyof typeof NICHES]; kind: ArchKind }) {
  const backGeo = useMemo(() => {
    const g = archPanel(n.w + 0.04, n.h + 0.03, kind).clone();
    // UVs: v from bottom (0) to crown (1) for the glow gradient
    const p = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (n.w + 0.04) + 0.5, p.getY(i) / (n.h + 0.03));
    return g;
  }, [n, kind]);
  return (
    <WallFrame wall={wall}>
      <group position={[n.c, n.y, 0]}>
        <mesh geometry={backGeo} material={glow} position={[0, -0.01, -NICHE_DEPTH]} />
        {n.shelves.map((sy) => {
          const sw = archHalfWidth(n.w, n.h, kind, sy - n.y + 0.03) * 2 - 0.004;
          return (
            <group key={sy} position={[0, sy - n.y, -NICHE_DEPTH / 2]}>
              <Box m={m.ebony} p={[0, 0, 0]} s={[sw, 0.028, NICHE_DEPTH - 0.01]} r={0.004} />
              <Box m={m.brass} p={[0, 0, NICHE_DEPTH / 2 - 0.004]} s={[sw, 0.03, 0.01]} r={0.003} cast={false} />
            </group>
          );
        })}
        {/* niche floor (sill) */}
        <Box m={m.marbleDark} p={[0, 0.012, -NICHE_DEPTH / 2 + 0.03]} s={[n.w + 0.12, 0.03, NICHE_DEPTH + 0.1]} r={0.006} />
      </group>
      <Surround m={m} w={n.w} h={n.h} kind={kind} u={n.c} y={n.y} />
    </WallFrame>
  );
}

/* ------------------------------ Mashrabiya ------------------------------- */

function Mashrabiya({ m, sky }: { m: AtelierMaterials; sky: THREE.Material }) {
  const uc = -WINDOW.z;
  const A = WINDOW.w / 2 + 0.03;
  const B = WINDOW.h / 2 + 0.03;
  const yc = WINDOW.y + WINDOW.h / 2;
  const spacing = 0.118; // along c (bar pitch ≈ 8.3 cm)
  const { bars, beads } = useMemo(() => {
    const bars: { s: number; t: number; len: number; ang: number }[] = [];
    const beads: [number, number][] = [];
    const cs: number[] = [];
    for (let c = -(A + B); c <= A + B; c += spacing) cs.push(c);
    for (const dir of [1, -1])
      for (const c of cs) {
        // dir 1: s + t = c (descending), dir -1: s - t = c (ascending)
        const sMin = Math.max(-A, c - B);
        const sMax = Math.min(A, c + B);
        if (sMax - sMin < 0.02) continue;
        const sm = (sMin + sMax) / 2;
        const tm = dir === 1 ? c - sm : sm - c;
        bars.push({ s: sm, t: tm, len: (sMax - sMin) * Math.SQRT2, ang: dir === 1 ? -Math.PI / 4 : Math.PI / 4 });
      }
    for (const c1 of cs)
      for (const c2 of cs) {
        const s = (c1 + c2) / 2;
        const t = (c1 - c2) / 2;
        if (Math.abs(s) < A - 0.01 && Math.abs(t) < B - 0.01) beads.push([s, t]);
      }
    return { bars, beads };
  }, [A, B]);
  const beadGeo = useMemo(() => {
    const g = new THREE.LatheGeometry(
      [
        [0.001, -0.026],
        [0.009, -0.024],
        [0.014, -0.012],
        [0.016, 0],
        [0.014, 0.012],
        [0.009, 0.024],
        [0.001, 0.026],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      10,
    );
    g.rotateX(Math.PI / 2);
    return g;
  }, []);
  const barGeo = useMemo(() => new THREE.BoxGeometry(1, 0.016, 0.034), []);
  const { barMats, beadMats } = useMemo(() => {
    const o = new THREE.Object3D();
    const barMats = bars.map((b) => {
      o.position.set(uc + b.s, yc + b.t, -T / 2);
      o.rotation.set(0, 0, b.ang);
      o.scale.set(b.len, 1, 1);
      o.updateMatrix();
      return o.matrix.clone();
    });
    const beadMats = beads.map(([s, t]) => new THREE.Matrix4().makeTranslation(uc + s, yc + t, -T / 2));
    return { barMats, beadMats };
  }, [bars, beads, uc, yc]);
  return (
    <WallFrame wall="left">
      <Baked geo={barGeo} mats={barMats} material={m.walnut} cast />
      <Baked geo={beadGeo} mats={beadMats} material={m.walnut} cast />
      {/* lattice frame, partly buried in the reveal */}
      <Box m={m.ebony} p={[uc, WINDOW.y + 0.02, -T / 2]} s={[WINDOW.w + 0.12, 0.05, 0.06]} r={0.006} />
      {[-1, 1].map((s) => (
        <Box key={s} m={m.ebony} p={[uc + s * (WINDOW.w / 2 + 0.03), yc, -T / 2]} s={[0.05, WINDOW.h + 0.1, 0.06]} r={0.006} />
      ))}
      {/* sill */}
      <Box m={m.marbleDark} p={[uc, WINDOW.y - 0.015, 0.0]} s={[WINDOW.w + 0.34, 0.04, T + 0.16]} r={0.008} />
      <Surround m={m} w={WINDOW.w} h={WINDOW.h} kind="ogee" u={uc} y={WINDOW.y} band={0.14} />
      {/* daylight beyond the lattice */}
      <mesh position={[uc, yc + 0.2, -T - 0.9]} material={sky}>
        <planeGeometry args={[4.5, 4]} />
      </mesh>
    </WallFrame>
  );
}

/* ---------------------------------- Door ---------------------------------- */

function Door({ m }: { m: AtelierMaterials }) {
  const leafW = DOOR.w / 2 - 0.01;
  const leafH = 2.02;
  const studs = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (const side of [-1, 1])
      for (let r = 0; r < 9; r++)
        for (let c = 0; c < 2; c++) {
          const u = side * (0.12 + c * (leafW - 0.24));
          out.push(new THREE.Matrix4().makeTranslation(u, 0.16 + r * ((leafH - 0.3) / 8), 0.0));
        }
    return out;
  }, [leafW]);
  const studGeo = useMemo(() => new THREE.SphereGeometry(0.017, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), []);
  const transom = useMemo(() => boxUV(archPanel(DOOR.w + 0.04, DOOR.h + 0.02, 'pointed', 0.05).clone(), 1), []);
  const recess = -0.12;
  return (
    <WallFrame wall="right">
      <group position={[DOOR.z, 0, recess]}>
        {/* carved transom filling the arch behind the leaves */}
        <mesh geometry={transom} material={m.carvedPanel} position={[0, 0, -0.12]} receiveShadow />
        {[-1, 1].map((side) => (
          <group key={side} position={[side * (leafW / 2 + 0.005), 0, 0]}>
            <Box m={m.walnut} p={[0, leafH / 2, -0.035]} s={[leafW, leafH, 0.07]} r={0.01} />
            {[0.55, 1.42].map((y) => (
              <Box key={y} m={m.carvedPanel} p={[0, y, 0.004]} s={[leafW - 0.2, 0.68, 0.02]} r={0.006} />
            ))}
            <Box m={m.ebony} p={[0, 0.985, 0.006]} s={[leafW - 0.08, 0.07, 0.024]} r={0.006} />
            {/* ring pull */}
            <mesh position={[-side * (leafW / 2 - 0.1), 1.02, 0.03]} material={m.brass} castShadow>
              <torusGeometry args={[0.055, 0.009, 10, 32]} />
            </mesh>
            <mesh position={[-side * (leafW / 2 - 0.1), 1.075, 0.022]} rotation={[Math.PI / 2, 0, 0]} material={m.brass}>
              <cylinderGeometry args={[0.022, 0.026, 0.02, 20]} />
            </mesh>
          </group>
        ))}
        <Baked geo={studGeo} mats={studs} material={m.brass} />
        {/* threshold */}
        <Box m={m.marbleDark} p={[0, 0.02, -0.02]} s={[DOOR.w + 0.1, 0.04, 0.4]} r={0.006} />
      </group>
      <Surround m={m} w={DOOR.w} h={DOOR.h} kind="pointed" u={DOOR.z} band={0.16} />
    </WallFrame>
  );
}

/* --------------------------------- Shell --------------------------------- */

export interface ShellLook {
  sky: THREE.Material;
  nicheGlow: THREE.Material;
}

const SKY: Record<Variant, [string, string, number]> = {
  morning: ['#CFE3F2', '#F4EBDD', 2.6],
  golden: ['#FFC27A', '#FFE3B0', 3.2],
  dusk: ['#1B2140', '#5A3A52', 0.55],
};

export function useShellLook(variant: Variant): ShellLook {
  return useMemo(() => {
    const [top, bottom, k] = SKY[variant];
    const sky = new THREE.MeshBasicMaterial({ map: skyTexture(top, bottom), color: new THREE.Color(k, k, k), fog: false });
    const nicheGlow = new THREE.MeshStandardMaterial({
      color: '#1A120C',
      roughness: 0.9,
      emissive: '#FFB467',
      emissiveMap: nicheGlowTexture(),
      emissiveIntensity: variant === 'dusk' ? 1.35 : 0.8,
    });
    return { sky, nicheGlow };
  }, [variant]);
}

export function Architecture({ m, look }: { m: AtelierMaterials; look: ShellLook }) {
  return (
    <group>
      <Floor m={m} />
      <Walls m={m} />
      {(['back', 'left', 'right'] as WallId[]).map((w) => (
        <group key={w}>
          <Wainscot m={m} wall={w} />
          <Frieze m={m} wall={w} />
        </group>
      ))}
      <Ceiling m={m} />
      <Niche m={m} glow={look.nicheGlow} wall="back" n={NICHES.grand} kind="ogee" />
      <Niche m={m} glow={look.nicheGlow} wall="back" n={NICHES.left} kind="pointed" />
      <Niche m={m} glow={look.nicheGlow} wall="right" n={NICHES.right} kind="pointed" />
      <Mashrabiya m={m} sky={look.sky} />
      <Door m={m} />
    </group>
  );
}
