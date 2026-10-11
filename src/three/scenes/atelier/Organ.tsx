import { useMemo } from 'react';
import * as THREE from 'three';
import { smoothLathe } from '../../props/geo';
import type { Quality } from '../../core/types';
import type { AtelierMaterials } from './materials';
import { ORGAN } from './layout';
import { annularSector, bakeInstances, cached, rng, seatGeo } from './geom';
import { Box } from './Architecture';
import { Baked } from './Baked';

/** Liquid in the top-tier decanters, coloured per vertex. */
function decanterLiquid(k: number) {
  return cached(`decliq:${k}`, () => {
    const g = new THREE.CylinderGeometry(0.04, 0.034, 0.042, 20);
    g.translate(0, 0.021, 0);
    return bakeInstances(g, [new THREE.Matrix4()], [new THREE.Color(k ? '#C4475F' : '#D9A23A')]);
  });
}

/* ------------------------------------------------------------------ */
/*  The perfumer's organ: a tiered walnut amphitheatre of essences     */
/*  around the perfumer's desk, brass-edged, with smelling strips.     */
/* ------------------------------------------------------------------ */

export const ESSENCE_COLORS = ['#E3CF62', '#D9822B', '#C4475F', '#EADCA6', '#C2722A', '#5B321F', '#C59E74', '#A9BF4B', '#D46F7E', '#F0BE7C', '#9C5A2E', '#E8C46A'];

const TIERS = [
  { rIn: 0.78, rOut: 0.95, h: 0.92 },
  { rIn: 0.95, rOut: 1.12, h: 1.08 },
  { rIn: 1.12, rOut: 1.29, h: 1.24 },
  { rIn: 1.29, rOut: 1.46, h: 1.4 },
];

/* Bottle geometry (metres; base at y = 0) */
export function organBottleGeos(seg: number) {
  return {
    amber: smoothLathe(
      [
        [0.001, 0],
        [0.016, 0],
        [0.0192, 0.004],
        [0.0196, 0.014],
        [0.0196, 0.05],
        [0.017, 0.06],
        [0.009, 0.067],
        [0.0066, 0.072],
        [0.0066, 0.079],
      ],
      seg,
      14,
    ),
    amberCap: smoothLathe(
      [
        [0.001, 0.077],
        [0.0086, 0.077],
        [0.0092, 0.08],
        [0.0092, 0.093],
        [0.0074, 0.098],
        [0.004, 0.106],
        [0.0042, 0.112],
        [0.001, 0.114],
      ],
      Math.max(10, seg / 2),
      10,
    ),
    flacon: (() => {
      const g = new THREE.LatheGeometry(
        (
          [
            [0.001, 0],
            [0.021, 0],
            [0.0235, 0.003],
            [0.0235, 0.058],
            [0.02, 0.066],
            [0.0085, 0.07],
            [0.0075, 0.08],
          ] as [number, number][]
        ).map(([r, y]) => new THREE.Vector2(r, y)),
        4,
      );
      g.rotateY(Math.PI / 4);
      const n = g.toNonIndexed();
      n.computeVertexNormals();
      return n;
    })(),
    flaconLiquid: (() => {
      const g = new THREE.LatheGeometry(
        (
          [
            [0.001, 0.004],
            [0.0205, 0.004],
            [0.0205, 0.046],
            [0.001, 0.046],
          ] as [number, number][]
        ).map(([r, y]) => new THREE.Vector2(r, y)),
        4,
      );
      g.rotateY(Math.PI / 4);
      return g;
    })(),
    stopper: smoothLathe(
      [
        [0.001, 0.078],
        [0.0085, 0.079],
        [0.0115, 0.088],
        [0.009, 0.098],
        [0.001, 0.101],
      ],
      8,
      8,
    ),
  };
}


export function Organ({ m, quality }: { m: AtelierMaterials; quality: Quality }) {
  const { a0, a1 } = ORGAN;
  const seg = quality === 'high' ? 20 : 14;
  const geos = useMemo(() => organBottleGeos(seg), [seg]);

  const { amber, flacon, liquidCols, strips } = useMemo(() => {
    const r = rng(7);
    const amber: THREE.Matrix4[] = [];
    const flacon: THREE.Matrix4[] = [];
    const liquidCols: THREE.Color[] = [];
    const o = new THREE.Object3D();
    TIERS.slice(0, 3).forEach((t, ti) => {
      const rad = (t.rIn + t.rOut) / 2 + 0.005;
      const spacing = 0.064 + ti * 0.004;
      const span = a1 - a0 - 0.06;
      const n = Math.floor((span * rad) / spacing);
      for (let i = 0; i < n; i++) {
        if (quality === 'low' && i % 2) continue;
        const a = a0 + 0.03 + ((i + 0.5) / n) * span;
        const x = Math.cos(a) * rad;
        const z = -Math.sin(a) * rad;
        o.position.set(x, t.h, z);
        o.rotation.set(0, a + (r() - 0.5) * 0.5, 0);
        const s = 0.92 + r() * 0.18;
        o.scale.set(s, s * (0.95 + r() * 0.15), s);
        o.updateMatrix();
        if (r() < 0.56) amber.push(o.matrix.clone());
        else {
          flacon.push(o.matrix.clone());
          liquidCols.push(new THREE.Color(ESSENCE_COLORS[Math.floor(r() * ESSENCE_COLORS.length)]));
        }
      }
    });
    // smelling strips fanned in a brass cup on the desk
    const strips: THREE.Matrix4[] = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 13 - 0.5) * 0.9;
      const tilt = 0.12 + r() * 0.12;
      o.position.set(0, 0, 0);
      o.rotation.set(Math.cos(a * 3) * tilt, a, Math.sin(a) * 0.5);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      strips.push(new THREE.Matrix4().multiplyMatrices(o.matrix, new THREE.Matrix4().makeTranslation(0, 0.075, 0)));
    }
    return { amber, flacon, liquidCols, strips };
  }, [a0, a1, quality]);
  const stripGeo = useMemo(() => new THREE.BoxGeometry(0.008, 0.15, 0.0006), []);

  const deskGeo = useMemo(() => annularSector(0.5, 0.8, a0 + 0.02, a1 - 0.02, 0.045, 0.008, 64), [a0, a1]);
  const tierGeos = useMemo(() => TIERS.map((t) => annularSector(t.rIn, t.rOut, a0, a1, t.h, 0.008, 64)), [a0, a1]);
  const edgeGeos = useMemo(() => TIERS.map((t) => annularSector(t.rIn - 0.006, t.rIn + 0.012, a0, a1, 0.014, 0.003, 64)), [a0, a1]);
  const plinthGeo = useMemo(() => annularSector(0.76, 1.48, a0 - 0.01, a1 + 0.01, 0.06, 0.006, 64), [a0, a1]);
  const deskEdge = useMemo(() => annularSector(0.494, 0.508, a0 + 0.02, a1 - 0.02, 0.05, 0.003, 64), [a0, a1]);
  const top = useMemo(() => {
    // decanters along the top tier
    const out: { p: [number, number, number]; s: number; k: number }[] = [];
    const t = TIERS[3];
    const rad = (t.rIn + t.rOut) / 2;
    const n = 15;
    for (let i = 0; i < n; i++) {
      const a = a0 + 0.08 + ((i + 0.5) / n) * (a1 - a0 - 0.16);
      out.push({ p: [Math.cos(a) * rad, t.h, -Math.sin(a) * rad], s: 0.9 + ((i * 37) % 7) / 20, k: i % 3 });
    }
    return out;
  }, [a0, a1]);
  const decanter = useMemo(
    () =>
      smoothLathe(
        [
          [0.001, 0],
          [0.034, 0],
          [0.044, 0.02],
          [0.046, 0.06],
          [0.036, 0.1],
          [0.014, 0.125],
          [0.012, 0.15],
          [0.016, 0.158],
        ],
        quality === 'high' ? 32 : 20,
        18,
      ),
    [quality],
  );
  const decanterStopper = useMemo(() => smoothLathe([[0.001, 0.152], [0.013, 0.154], [0.022, 0.172], [0.016, 0.192], [0.001, 0.2]], 16, 16), []);
  const cupGeo = useMemo(() => smoothLathe([[0.001, 0], [0.028, 0], [0.03, 0.01], [0.026, 0.06], [0.03, 0.068]], 32, 16), []);

  return (
    <group position={[ORGAN.x, 0, ORGAN.z]}>
      {/* structure */}
      <mesh geometry={plinthGeo} material={m.ebony} castShadow receiveShadow />
      {tierGeos.map((g, i) => (
        <mesh key={i} geometry={g} material={m.walnut} castShadow receiveShadow />
      ))}
      {edgeGeos.map((g, i) => (
        <mesh key={i} geometry={g} material={m.brass} position={[0, TIERS[i].h - 0.012, 0]} />
      ))}
      <mesh geometry={deskGeo} material={m.teak} position={[0, 0.74, 0]} castShadow receiveShadow />
      <mesh geometry={deskEdge} material={m.brass} position={[0, 0.737, 0]} />
      {/* desk brackets */}
      {[0.15, 0.85, 1.55, 2.25, 2.95].map((a) => (
        <Box key={a} m={m.ebony} p={[Math.cos(a) * 0.72, 0.6, -Math.sin(a) * 0.72]} s={[0.12, 0.24, 0.04]} rot={[0, a, 0]} r={0.006} />
      ))}
      {/* essences */}
      <Baked geo={geos.amber} mats={amber} material={m.amberGlass} />
      <Baked geo={geos.amberCap} mats={amber} material={m.iron} />
      <Baked geo={geos.flaconLiquid} mats={flacon} colors={liquidCols} material={m.liquidVC} />
      <Baked geo={geos.flacon} mats={flacon} material={m.glass} renderOrder={2} receive={false} />
      <Baked geo={geos.stopper} mats={flacon} material={m.gold} />
      {/* crystal decanters on the top tier */}
      {top.map((d, i) => (
        <group key={i} position={d.p} scale={d.s}>
          <mesh geometry={decanter} material={d.k === 1 ? m.amberGlass : m.glass} renderOrder={2} />
          {d.k !== 1 && (
            <mesh material={m.liquidVC} geometry={decanterLiquid(d.k)} position={[0, 0.003, 0]} />
          )}
          <mesh geometry={decanterStopper} material={m.gold} />
        </group>
      ))}
      {/* smelling strips in a brass cup, and the perfumer's notebook */}
      <group position={[0.42, 0.785, -0.42]}>
        <mesh geometry={cupGeo} material={m.brass} castShadow />
        <Baked geo={stripGeo} mats={strips} material={m.paper} />
      </group>
      <group position={[-0.05, 0.786, -0.62]} rotation={[0, 0.12, 0]}>
        <Box m={m.velvetRed} p={[0, 0.004, 0]} s={[0.34, 0.008, 0.24]} r={0.003} />
        <Box m={m.paper} p={[-0.082, 0.011, 0]} s={[0.16, 0.006, 0.22]} r={0.002} rot={[0, 0, 0.05]} />
        <Box m={m.paper} p={[0.082, 0.011, 0]} s={[0.16, 0.006, 0.22]} r={0.002} rot={[0, 0, -0.05]} />
        <mesh position={[0.06, 0.018, 0.02]} rotation={[0, 0.6, Math.PI / 2]} material={m.gold}>
          <cylinderGeometry args={[0.004, 0.004, 0.14, 8]} />
        </mesh>
      </group>
      {/* perfumer's stool */}
      <group position={[0.18, 0, -0.12]}>
        <mesh position={[0, 0.515, 0]} geometry={seatGeo(0.19, 0.1)} material={m.velvetRed} castShadow />
        <mesh position={[0, 0.51, 0]} material={m.brass}>
          <torusGeometry args={[0.18, 0.012, 8, 32]} />
        </mesh>
        {[0, 1, 2, 3].map((k) => {
          const a = (k / 4) * Math.PI * 2 + 0.4;
          return (
            <mesh key={k} position={[Math.cos(a) * 0.12, 0.26, Math.sin(a) * 0.12]} rotation={[Math.sin(a) * 0.14, 0, -Math.cos(a) * 0.14]} material={m.brass} castShadow>
              <cylinderGeometry args={[0.011, 0.014, 0.52, 10]} />
            </mesh>
          );
        })}
        <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.brass}>
          <torusGeometry args={[0.135, 0.008, 6, 28]} />
        </mesh>
      </group>
    </group>
  );
}
