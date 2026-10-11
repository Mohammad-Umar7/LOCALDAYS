import { useMemo } from 'react';
import * as THREE from 'three';
import { smoothLathe } from '../../props/geo';
import type { Quality, Vec3 } from '../../core/types';
import type { AtelierMaterials } from './materials';
import { DRAWERS, ROOM } from './layout';
import { chunk, rng } from './geom';
import { Box, rbox } from './Architecture';
import { Baked } from './Baked';

/* ------------------------------------------------------------------ */
/*  Apothecary wall: 48 labelled ingredient drawers with brass knobs,  */
/*  jar shelves above, carved doors below and a brass-railed ladder.   */
/* ------------------------------------------------------------------ */

const W = DRAWERS.x1 - DRAWERS.x0;
const CX = (DRAWERS.x0 + DRAWERS.x1) / 2;
const COLS = 8;
const ROWS = 6;
const BANK_Y0 = 0.99;
const CELL_H = 0.15;
const CELL_W = (W - 0.1) / COLS;
const FRONT = 0.38;
const OPEN: [number, number][] = [
  [2, 3],
  [5, 1],
];

export const JAR_FILL = ['#B8701C', '#8E2433', '#C9541E', '#B88E62', '#E2D2A2', '#6E7B3A', '#3B2416', '#D9B36A'];

export function Apothecary({ m, quality }: { m: AtelierMaterials; quality: Quality }) {
  const knobGeo = useMemo(() => {
    const g = smoothLathe([[0.001, 0], [0.007, 0], [0.006, 0.008], [0.004, 0.014], [0.011, 0.02], [0.012, 0.026], [0.006, 0.031], [0.001, 0.032]], 16, 16);
    const c = g.clone();
    c.rotateX(Math.PI / 2);
    return c;
  }, []);
  const jarGeo = useMemo(() => smoothLathe([[0.001, 0], [0.05, 0], [0.054, 0.008], [0.055, 0.15], [0.05, 0.165], [0.044, 0.172], [0.045, 0.185]], quality === 'high' ? 28 : 18, 12), [quality]);
  const lidGeo = useMemo(() => smoothLathe([[0.001, 0.18], [0.05, 0.18], [0.051, 0.198], [0.03, 0.206], [0.012, 0.21], [0.014, 0.226], [0.001, 0.232]], 20, 10), []);
  const cardGeo = useMemo(() => new THREE.PlaneGeometry(0.066, 0.03), []);

  const data = useMemo(() => {
    const faces: THREE.Matrix4[] = [];
    const knobs: THREE.Matrix4[] = [];
    const plates: THREE.Matrix4[] = [];
    const cards: THREE.Matrix4[] = [];
    const open: Vec3[] = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const x = -W / 2 + 0.05 + CELL_W * (c + 0.5);
        const y = BANK_Y0 + CELL_H * (r + 0.5);
        const isOpen = OPEN.some(([oc, or]) => oc === c && or === r);
        const z = FRONT + 0.011 + (isOpen ? 0.17 : 0);
        if (isOpen) open.push([x, y, z]);
        else faces.push(new THREE.Matrix4().makeTranslation(x, y, z));
        knobs.push(new THREE.Matrix4().makeTranslation(x, y - 0.022, z + 0.011));
        plates.push(new THREE.Matrix4().makeTranslation(x, y + 0.03, z + 0.012));
        cards.push(new THREE.Matrix4().makeTranslation(x, y + 0.03, z + 0.0142));
      }
    const r = rng(19);
    const jars: THREE.Matrix4[] = [];
    const fills: THREE.Matrix4[] = [];
    const fillCols: THREE.Color[] = [];
    [1.99, 2.38].forEach((sy, si) => {
      const n = 11;
      for (let i = 0; i < n; i++) {
        const x = -W / 2 + 0.17 + (i / (n - 1)) * (W - 0.34) + (r() - 0.5) * 0.03;
        const s = 0.85 + r() * 0.3;
        const mt = new THREE.Matrix4().compose(new THREE.Vector3(x, sy + 0.012, 0.2 + (r() - 0.5) * 0.04), new THREE.Quaternion(), new THREE.Vector3(s, s * (0.9 + r() * 0.25), s));
        jars.push(mt);
        const lvl = 0.4 + r() * 0.5;
        fills.push(mt.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(0, 0.006, 0), new THREE.Quaternion(), new THREE.Vector3(0.93, lvl, 0.93))));
        fillCols.push(new THREE.Color(JAR_FILL[(i + si * 3) % JAR_FILL.length]));
      }
    });
    return { faces, knobs, plates, cards, open, jars, fills, fillCols };
  }, []);

  const fillGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.05, 0.05, 1, 16, 1);
    g.translate(0, 0.5, 0);
    g.scale(1, 0.16, 1);
    return g;
  }, []);
  const petalGeo = useMemo(() => chunk(3, 2, [0.12, 0.035, 0.1], 0.18), []);

  // ladder
  const lx = 0.62;
  const railY = 2.24;
  const railZ = FRONT + 0.09;
  const foot = 0.72;
  const len = Math.hypot(railY, foot);
  const tilt = Math.atan2(foot, railY);

  return (
    <group position={[CX, 0, ROOM.z0]}>
      {/* base, cupboards, counter */}
      <Box m={m.ebony} p={[0, 0.05, 0.2]} s={[W - 0.06, 0.1, 0.38]} r={0.01} />
      <Box m={m.walnut} p={[0, 0.48, 0.21]} s={[W, 0.76, 0.42]} r={0.01} />
      {[0, 1, 2, 3].map((i) => {
        const dw = (W - 0.08) / 4;
        const x = -W / 2 + 0.04 + dw * (i + 0.5);
        return (
          <group key={i}>
            <Box m={m.carvedPanel} p={[x, 0.48, 0.425]} s={[dw - 0.03, 0.64, 0.02]} r={0.006} />
            <mesh position={[x + (i % 2 ? -1 : 1) * (dw / 2 - 0.06), 0.62, 0.445]} rotation={[Math.PI / 2, 0, 0]} material={m.brass}>
              <cylinderGeometry args={[0.012, 0.012, 0.024, 12]} />
            </mesh>
          </group>
        );
      })}
      <Box m={m.teak} p={[0, 0.885, 0.245]} s={[W + 0.06, 0.045, 0.49]} r={0.01} />
      <Box m={m.brass} p={[0, 0.885, 0.492]} s={[W + 0.06, 0.012, 0.006]} r={0.002} cast={false} />
      {/* upper carcass */}
      <Box m={m.walnut} p={[0, 1.81, 0.012]} s={[W, 1.82, 0.024]} r={0.004} cast={false} />
      {[-1, 1].map((s) => (
        <Box key={s} m={m.ebony} p={[s * (W / 2 - 0.025), 1.81, 0.2]} s={[0.05, 1.82, 0.4]} r={0.008} />
      ))}
      <Box m={m.ebony} p={[0, BANK_Y0 + (ROWS * CELL_H) / 2, 0.19]} s={[W - 0.06, ROWS * CELL_H + 0.03, FRONT - 0.01]} r={0.006} />
      {/* drawer grid mullions */}
      {Array.from({ length: COLS - 1 }).map((_, c) => (
        <Box key={'v' + c} m={m.ebony} p={[-W / 2 + 0.05 + CELL_W * (c + 1), BANK_Y0 + (ROWS * CELL_H) / 2, FRONT + 0.004]} s={[0.012, ROWS * CELL_H, 0.012]} r={0.003} cast={false} />
      ))}
      {[1.95, 2.34].map((y) => (
        <group key={y}>
          <Box m={m.ebony} p={[0, y, 0.2]} s={[W - 0.08, 0.035, 0.38]} r={0.006} />
          <Box m={m.brass} p={[0, y, 0.392]} s={[W - 0.08, 0.036, 0.006]} r={0.002} cast={false} />
        </group>
      ))}
      {/* crown */}
      <Box m={m.carvedFrieze} p={[0, 2.66, 0.405]} s={[W, 0.12, 0.03]} r={0.006} />
      <Box m={m.ebony} p={[0, 2.75, 0.24]} s={[W + 0.1, 0.07, 0.5]} r={0.012} />
      <Box m={m.brass} p={[0, 2.715, 0.488]} s={[W + 0.1, 0.01, 0.006]} r={0.002} cast={false} />

      {/* drawers */}
      <Baked geo={rbox(CELL_W - 0.016, CELL_H - 0.014, 0.022, 0.005)} mats={data.faces} material={m.teak} />
      <Baked geo={knobGeo} mats={data.knobs} material={m.brass} />
      <Baked geo={rbox(0.078, 0.04, 0.003, 0.0015)} mats={data.plates} material={m.brass} />
      <Baked geo={cardGeo} mats={data.cards} material={m.card} />
      {data.open.map((p, i) => (
        <group key={i} position={p}>
          <Box m={m.teak} p={[0, 0, 0]} s={[CELL_W - 0.016, CELL_H - 0.014, 0.022]} r={0.005} />
          {[-1, 1].map((s) => (
            <Box key={s} m={m.walnut} p={[s * (CELL_W / 2 - 0.02), -0.012, -0.12]} s={[0.012, CELL_H - 0.04, 0.24]} r={0.003} />
          ))}
          <Box m={m.walnut} p={[0, -CELL_H / 2 + 0.018, -0.12]} s={[CELL_W - 0.04, 0.01, 0.24]} r={0.003} />
          <mesh geometry={petalGeo} material={i === 0 ? m.petals : m.resin} position={[0, -0.03, -0.09]} castShadow />
          <mesh geometry={petalGeo} material={i === 0 ? m.petals : m.resin} position={[0.05, -0.034, -0.16]} rotation={[0, 1.3, 0]} scale={0.8} />
        </group>
      ))}

      {/* ingredient jars */}
      <Baked geo={fillGeo} mats={data.fills} colors={data.fillCols} material={m.fillVC} />
      <Baked geo={jarGeo} mats={data.jars} material={m.glass} renderOrder={2} receive={false} />
      <Baked geo={lidGeo} mats={data.jars} material={m.brassOld} />

      {/* library ladder on a brass rail */}
      <mesh position={[0, railY, railZ]} rotation={[0, 0, Math.PI / 2]} material={m.brass} castShadow>
        <cylinderGeometry args={[0.013, 0.013, W - 0.1, 16]} />
      </mesh>
      {[-1, 0, 1].map((s) => (
        <mesh key={s} position={[s * (W / 2 - 0.12), railY, (FRONT + railZ) / 2]} rotation={[Math.PI / 2, 0, 0]} material={m.brass}>
          <cylinderGeometry args={[0.008, 0.008, railZ - FRONT, 8]} />
        </mesh>
      ))}
      <group position={[lx, railY, railZ + 0.015]} rotation={[-tilt, 0, 0]}>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh geometry={rbox(0.05, len, 0.032, 0.008)} material={m.walnut} position={[s * 0.21, -len / 2, 0.02]} castShadow />
            <mesh position={[s * 0.21, 0.02, -0.005]} rotation={[0, 0, Math.PI / 2]} material={m.brass}>
              <torusGeometry args={[0.02, 0.005, 6, 12, Math.PI]} />
            </mesh>
          </group>
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} position={[0, -0.22 - i * 0.28, 0.02]} rotation={[0, 0, Math.PI / 2]} material={m.teak} castShadow>
            <cylinderGeometry args={[0.016, 0.016, 0.42, 10]} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={'w' + s} position={[s * 0.21, -len + 0.02, 0.02]} rotation={[0, 0, Math.PI / 2]} material={m.brass}>
            <cylinderGeometry args={[0.026, 0.026, 0.02, 16]} />
          </mesh>
        ))}
      </group>

      {/* on the counter: tins and a brass tray */}
      {[-0.95, -0.82, -0.69].map((x, i) => (
        <mesh key={x} position={[x, 0.908 + 0.045, 0.27 - i * 0.02]} material={i === 1 ? m.giftRed : m.brassOld} castShadow>
          <cylinderGeometry args={[0.055, 0.055, 0.09, 28]} />
        </mesh>
      ))}
      <mesh position={[0.25, 0.912, 0.26]} material={m.brass} castShadow receiveShadow>
        <cylinderGeometry args={[0.2, 0.19, 0.015, 48]} />
      </mesh>
    </group>
  );
}
