import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { smoothLathe } from '../../props/geo';
import type { Quality, Vec3 } from '../../core/types';
import type { AtelierMaterials } from './materials';
import { BUKHOOR, MIXING, OUD, PACKAGING } from './layout';
import { cached, chunk, cushionGeo, rng, seatGeo } from './geom';
import { Box } from './Architecture';
import { Baked } from './Baked';
import { bottleGeos, CrystalBottle, tintedGeometry } from './Glassware';
import { organBottleGeos } from './Organ';

/* ------------------------------------------------------------------ */
/*  Work stations: the mixing bench, the oud display, the bukhoor      */
/*  preparation table and the gift-wrapping bench.                     */
/* ------------------------------------------------------------------ */

/* ------------------------------ Furniture -------------------------------- */

function cylinder(r: number, h: number) {
  return cached(`cyl:${r}:${h}`, () => new THREE.CylinderGeometry(r, r, h, 24));
}

function turnedLeg(h: number) {
  return cached(`leg:${h}`, () =>
    smoothLathe(
      [
        [0.001, 0],
        [0.026, 0],
        [0.03, 0.02],
        [0.022, 0.05],
        [0.027, 0.09],
        [0.019, 0.2],
        [0.017, h * 0.55],
        [0.026, h * 0.72],
        [0.02, h * 0.8],
        [0.028, h * 0.86],
        [0.028, h],
        [0.001, h],
      ],
      14,
      22,
    ),
  );
}

export function Table({
  m,
  w,
  d,
  h,
  top,
  base = 'walnut',
  inlay = true,
  shelf = false,
}: {
  m: AtelierMaterials;
  w: number;
  d: number;
  h: number;
  top: THREE.Material;
  base?: 'walnut' | 'teak' | 'ebony';
  inlay?: boolean;
  shelf?: boolean;
}) {
  const t = 0.045;
  const legH = h - t;
  return (
    <group>
      <Box m={top} p={[0, h - t / 2, 0]} s={[w, t, d]} r={0.012} />
      {inlay && <Box m={m.brass} p={[0, h - t + 0.006, 0]} s={[w + 0.004, 0.008, d + 0.004]} r={0.003} cast={false} />}
      <Box m={m[base]} p={[0, h - t - 0.07, 0]} s={[w - 0.1, 0.12, d - 0.1]} r={0.008} />
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <mesh key={i} geometry={turnedLeg(legH - 0.01)} material={m[base]} position={[sx * (w / 2 - 0.07), 0, sz * (d / 2 - 0.07)]} castShadow receiveShadow />
      ))}
      {shelf && <Box m={m[base]} p={[0, 0.16, 0]} s={[w - 0.12, 0.025, d - 0.12]} r={0.006} />}
    </group>
  );
}

/** Thin-walled open vessel (beaker, jar, bowl) from an outer profile + wall thickness. */
function vessel(outer: [number, number][], wall: number, seg = 40) {
  return cached(`vessel:${wall}:${seg}:${JSON.stringify(outer)}`, () => {
    const inner = outer
      .slice(1)
      .reverse()
      .map(([r, y]) => [Math.max(0.0008, r - wall), Math.max(wall, y)] as [number, number]);
    const pts = [...outer, ...inner, [0.0008, wall] as [number, number]];
    const g = new THREE.LatheGeometry(
      pts.map(([r, y]) => new THREE.Vector2(r, y)),
      seg,
    );
    g.computeVertexNormals();
    return g;
  });
}

/** Plump velvet floor cushion with a tuft button and gold corner tassels. */
function FloorCushion({ m, mat, p, size, rot = 0 }: { m: AtelierMaterials; mat: THREE.Material; p: Vec3; size: Vec3; rot?: number }) {
  const [w, h, d] = size;
  const tassel = useMemo(() => smoothLathe([[0.001, 0], [0.012, 0.004], [0.009, 0.03], [0.004, 0.04], [0.006, 0.048], [0.001, 0.052]], 10, 10), []);
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <mesh geometry={cushionGeo(w, h, d)} material={mat} castShadow receiveShadow />
      <mesh material={m.gold} position={[0, h * 1.17, 0]} scale={[1, 0.5, 1]}>
        <sphereGeometry args={[0.014, 12, 8]} />
      </mesh>
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <mesh key={i} geometry={tassel} material={m.giftGold} position={[sx * (w / 2 + 0.01), h * 0.45, sz * (d / 2 + 0.01)]} rotation={[sz * 1.9, 0, -sx * 1.9]} />
      ))}
    </group>
  );
}

/** Low carved majlis table on stubby turned feet with a pierced apron. */
function LowTable({ m, w, d, h }: { m: AtelierMaterials; w: number; d: number; h: number }) {
  const foot = useMemo(() => smoothLathe([[0.001, 0], [0.04, 0], [0.045, 0.03], [0.03, 0.08], [0.038, 0.15], [0.03, h - 0.12], [0.04, h - 0.1], [0.04, h - 0.05], [0.001, h - 0.05]], 16, 20), [h]);
  return (
    <group>
      <Box m={m.teak} p={[0, h - 0.025, 0]} s={[w, 0.05, d]} r={0.014} />
      <Box m={m.brass} p={[0, h - 0.044, 0]} s={[w + 0.004, 0.008, d + 0.004]} r={0.003} cast={false} />
      <Box m={m.carvedFrieze} p={[0, h - 0.1, d / 2 - 0.04]} s={[w - 0.12, 0.1, 0.02]} r={0.004} />
      <Box m={m.carvedFrieze} p={[0, h - 0.1, -d / 2 + 0.04]} s={[w - 0.12, 0.1, 0.02]} r={0.004} />
      {[-1, 1].map((sx) => (
        <Box key={sx} m={m.carvedFrieze} p={[sx * (w / 2 - 0.04), h - 0.1, 0]} s={[0.02, 0.1, d - 0.12]} r={0.004} />
      ))}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <mesh key={i} geometry={foot} material={m.walnut} position={[sx * (w / 2 - 0.07), 0, sz * (d / 2 - 0.07)]} castShadow />
      ))}
    </group>
  );
}

/* --------------------------------- Mixing -------------------------------- */

function Dropper({ m, color }: { m: AtelierMaterials; color: string }) {
  const drop = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const d = drop.current;
    if (!d) return;
    const t = (clock.elapsedTime * 0.7) % 1;
    // swell at the tip, then fall into the bottle neck
    if (t < 0.6) {
      d.position.y = 0;
      d.scale.setScalar(0.4 + (t / 0.6) * 0.6);
    } else {
      const k = (t - 0.6) / 0.4;
      d.position.y = -k * k * 0.07;
      d.scale.setScalar(1 - k * 0.3);
    }
    d.visible = t < 0.97;
  });
  const dropMat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.05, emissive: color, emissiveIntensity: 0.2 }), [color]);
  return (
    <group>
      {/* brass retort stand */}
      <mesh position={[0.11, 0.006, 0]} material={m.brass} castShadow receiveShadow>
        <cylinderGeometry args={[0.05, 0.055, 0.012, 32]} />
      </mesh>
      <mesh position={[0.11, 0.19, 0]} material={m.brass} castShadow>
        <cylinderGeometry args={[0.005, 0.005, 0.37, 10]} />
      </mesh>
      <mesh position={[0.055, 0.3, 0]} rotation={[0, 0, Math.PI / 2]} material={m.brass}>
        <cylinderGeometry args={[0.004, 0.004, 0.11, 8]} />
      </mesh>
      <mesh position={[0, 0.3, 0]} material={m.brass}>
        <torusGeometry args={[0.009, 0.003, 6, 16]} />
      </mesh>
      {/* glass pipette with rubber bulb */}
      <mesh position={[0, 0.27, 0]} material={m.glass} renderOrder={2}>
        <cylinderGeometry args={[0.0045, 0.0015, 0.13, 10]} />
      </mesh>
      <mesh position={[0, 0.25, 0]} geometry={tintedGeometry(cylinder(0.0028, 0.07), color)} material={m.liquidVC} />
      <mesh position={[0, 0.355, 0]} material={m.rubber} castShadow>
        <sphereGeometry args={[0.013, 16, 12]} />
      </mesh>
      <mesh position={[0, 0.34, 0]} material={m.rubber}>
        <cylinderGeometry args={[0.006, 0.008, 0.02, 10]} />
      </mesh>
      <group position={[0, 0.2, 0]}>
        <mesh ref={drop} material={dropMat} userData={{ noBatch: true }}>
          <sphereGeometry args={[0.0035, 10, 8]} />
        </mesh>
      </group>
    </group>
  );
}

/** The hero bottle being filled — liquid level eases up, pauses, and resets. */
function FillingBottle({ m, quality }: { m: AtelierMaterials; quality: Quality }) {
  const liq = useRef<THREE.Mesh>(null);
  const g = bottleGeos('attar', quality);
  const color = '#C0611F';
  const liquidMat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.1, envMapIntensity: 1.4, emissive: '#4A1A04', emissiveIntensity: 0.5 }), []);
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime / 22) % 1;
    const f = t < 0.85 ? 0.18 + (t / 0.85) * 0.74 : 0.92 - ((t - 0.85) / 0.15) * 0.74;
    if (liq.current) liq.current.scale.y = f;
  });
  return (
    <group>
      <group scale={1.35}>
        <mesh ref={liq} geometry={g.liquid} material={liquidMat} scale={[1, 0.5, 1]} userData={{ noBatch: true }} />
        <mesh geometry={g.body} material={m.crystal} castShadow renderOrder={2} userData={{ noBatch: true }} />
      </group>
      {/* gold stopper waiting beside it */}
      <mesh geometry={g.cap} material={m.gold} position={[-0.1, -0.12 * 1.35, 0.06]} scale={1.35} castShadow />
      <group position={[0, 0.0, 0]}>
        <Dropper m={m} color={color} />
      </group>
    </group>
  );
}

export function MixingStation({ m, quality }: { m: AtelierMaterials; quality: Quality }) {
  const { w, d, h } = MIXING;
  const amber = useMemo(() => organBottleGeos(16), []);
  const tubeGeo = useMemo(() => new THREE.CylinderGeometry(0.004, 0.0015, 0.17, 8), []);
  const bulbGeo = useMemo(() => new THREE.SphereGeometry(0.011, 12, 10), []);
  const droppers = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < 8; i++) out.push(new THREE.Matrix4().makeTranslation(-0.75 + (i % 4) * 0.05, h + 0.012, 0.12 + Math.floor(i / 4) * 0.05));
    return out;
  }, [h]);
  const pipettes = useMemo(() => {
    const tubes: THREE.Matrix4[] = [];
    const bulbs: THREE.Matrix4[] = [];
    for (let i = 0; i < 5; i++) {
      const x = 0.55 + i * 0.035;
      tubes.push(new THREE.Matrix4().makeTranslation(x, h + 0.1, -0.2));
      bulbs.push(new THREE.Matrix4().makeTranslation(x, h + 0.175, -0.2));
    }
    return { tubes, bulbs };
  }, [h]);
  const beaker = useMemo(() => vessel([[0.001, 0], [0.032, 0], [0.034, 0.004], [0.034, 0.1], [0.038, 0.106]], 0.0025, 40), []);
  const gradCyl = useMemo(() => vessel([[0.001, 0], [0.04, 0], [0.04, 0.008], [0.021, 0.012], [0.021, 0.23], [0.025, 0.236]], 0.002, 32), []);
  const stripDish = useMemo(() => vessel([[0.001, 0], [0.06, 0], [0.075, 0.01], [0.078, 0.014]], 0.002, 40), []);
  const vialGeo = useMemo(() => vessel([[0.001, 0], [0.0095, 0], [0.0095, 0.1], [0.011, 0.104]], 0.0012, 16), []);
  const vialLiquid = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.0078, 0.0078, 0.06, 12);
    g.translate(0, 0.032, 0);
    return g;
  }, []);
  const { vials, vialColors } = useMemo(() => {
    const cols = ['#C4475F', '#E3CF62', '#D9822B', '#8FAE6B', '#C2722A', '#EADCA6', '#D46F7E', '#9C5A2E'];
    return {
      vials: cols.map((_, i) => new THREE.Matrix4().makeTranslation(-0.1 + i * 0.0285, 0.024, 0)),
      vialColors: cols.map((c) => new THREE.Color(c)),
    };
  }, []);
  const beakerSmall = useMemo(() => vessel([[0.001, 0], [0.024, 0], [0.026, 0.004], [0.026, 0.07], [0.029, 0.075]], 0.002, 32), []);
  const funnel = useMemo(() => vessel([[0.004, 0], [0.005, 0.05], [0.04, 0.1], [0.042, 0.104]], 0.002, 32), []);
  const liquids: { p: Vec3; r: number; hgt: number; c: string }[] = [
    { p: [0.3, h, -0.05], r: 0.031, hgt: 0.055, c: '#C4475F' },
    { p: [0.38, h, 0.08], r: 0.031, hgt: 0.035, c: '#E3CF62' },
    { p: [0.25, h, 0.12], r: 0.023, hgt: 0.04, c: '#8FAE6B' },
  ];
  return (
    <group position={[MIXING.x, 0, MIXING.z]}>
      <Table m={m} w={w} d={d} h={h} top={m.marble} shelf />
      {/* precision scale */}
      <group position={[-0.5, h, -0.08]}>
        <Box m={m.ceramic} p={[0, 0.025, 0]} s={[0.19, 0.05, 0.23]} r={0.012} />
        <Box m={m.iron} p={[0, 0.03, 0.112]} s={[0.12, 0.03, 0.01]} r={0.004} />
        <mesh position={[0, 0.03, 0.118]} userData={{ noBatch: true }}>
          <planeGeometry args={[0.09, 0.018]} />
          <meshBasicMaterial color={new THREE.Color('#7FE0C8').multiplyScalar(1.6)} toneMapped />
        </mesh>
        <mesh position={[0, 0.056, -0.01]} material={m.steel} castShadow>
          <cylinderGeometry args={[0.065, 0.065, 0.006, 40]} />
        </mesh>
        <mesh geometry={beakerSmall} material={m.glass} position={[0, 0.06, -0.01]} renderOrder={2} />
      </group>
      {/* hero bottle under the dropper */}
      <group position={[-0.05, h, -0.05]}>
        <FillingBottle m={m} quality={quality} />
      </group>
      {/* beakers with tinctures */}
      {liquids.map((l, i) => (
        <group key={i} position={l.p}>
          <mesh position={[0, l.hgt / 2 + 0.003, 0]} geometry={tintedGeometry(cylinder(l.r, l.hgt), l.c)} material={m.liquidVC} />
          <mesh geometry={i === 2 ? beakerSmall : beaker} material={m.glass} renderOrder={2} />
        </group>
      ))}
      {/* glass stirring rods leaning in the first beaker */}
      {[0, 1].map((k) => (
        <mesh key={k} position={[0.3 + k * 0.012, h + 0.1, -0.05]} rotation={[0.18 - k * 0.3, 0, 0.25 + k * 0.1]} material={m.glass} renderOrder={2}>
          <cylinderGeometry args={[0.0035, 0.0035, 0.2, 8]} />
        </mesh>
      ))}
      {/* pipette rack */}
      <Box m={m.walnut} p={[0.62, h + 0.03, -0.2]} s={[0.22, 0.06, 0.06]} r={0.008} />
      <Baked geo={tubeGeo} mats={pipettes.tubes} material={m.glass} renderOrder={2} receive={false} />
      <Baked geo={bulbGeo} mats={pipettes.bulbs} material={m.rubber} />
      {/* dropper bottles in a tray */}
      <Box m={m.teak} p={[-0.675, h + 0.006, 0.145]} s={[0.24, 0.012, 0.13]} r={0.004} />
      <Baked geo={amber.amber} mats={droppers} material={m.amberGlass} />
      <Baked geo={amber.amberCap} mats={droppers} material={m.iron} />
      {/* test-tube rack of trial blends */}
      <group position={[0.7, h, 0.13]}>
        <Box m={m.walnut} p={[0, 0.012, 0]} s={[0.27, 0.024, 0.07]} r={0.004} />
        <Box m={m.walnut} p={[0, 0.07, 0]} s={[0.27, 0.014, 0.07]} r={0.003} />
        {[-1, 1].map((sx) => (
          <Box key={sx} m={m.walnut} p={[sx * 0.128, 0.045, 0]} s={[0.014, 0.07, 0.07]} r={0.003} />
        ))}
        <Baked geo={vialGeo} mats={vials} material={m.glass} renderOrder={2} receive={false} />
        <Baked geo={vialLiquid} mats={vials} colors={vialColors} material={m.liquidVC} />
      </group>
      {/* graduated cylinder */}
      <group position={[0.47, h, -0.2]}>
        <mesh material={m.glass} geometry={gradCyl} renderOrder={2} />
        <mesh geometry={tintedGeometry(cylinder(0.0185, 0.12), '#C78A2E')} material={m.liquidVC} position={[0, 0.075, 0]} />
      </group>
      {/* dish of smelling strips */}
      <group position={[-0.84, h, -0.2]} rotation={[0, 0.4, 0]}>
        <mesh geometry={stripDish} material={m.brass} castShadow />
        {[0, 1, 2, 3, 4].map((k) => (
          <Box key={k} m={m.paper} p={[-0.05 + k * 0.025, 0.012 + k * 0.0012, (k % 2) * 0.01]} s={[0.008, 0.002, 0.15]} r={0.0008} rot={[0, (k - 2) * 0.12, 0]} cast={false} />
        ))}
      </group>
      {/* funnel and formula book */}
      <mesh geometry={funnel} material={m.glass} position={[0.16, h + 0.0, 0.2]} renderOrder={2} />
      <group position={[-0.25, h, 0.2]} rotation={[0, -0.2, 0]}>
        <Box m={m.velvetGreen} p={[0, 0.004, 0]} s={[0.3, 0.008, 0.21]} r={0.003} />
        <Box m={m.paper} p={[-0.073, 0.011, 0]} s={[0.14, 0.006, 0.19]} r={0.002} rot={[0, 0, 0.05]} />
        <Box m={m.paper} p={[0.073, 0.011, 0]} s={[0.14, 0.006, 0.19]} r={0.002} rot={[0, 0, -0.05]} />
        <mesh position={[0.07, 0.018, 0.03]} rotation={[0, -0.5, Math.PI / 2]} material={m.gold}>
          <cylinderGeometry args={[0.004, 0.004, 0.13, 8]} />
        </mesh>
      </group>
      {/* stools */}
      {[-0.45, 0.45].map((x, i) => (
        <group key={x} position={[x, 0, d / 2 + 0.36]} rotation={[0, i * 0.4 - 0.2, 0]}>
          <mesh position={[0, 0.6, 0]} geometry={seatGeo(0.17, 0.09)} material={m.velvetGreen} castShadow receiveShadow />
          <mesh position={[0, 0.6, 0]} material={m.brass}>
            <torusGeometry args={[0.16, 0.01, 8, 32]} />
          </mesh>
          {[0, 1, 2, 3].map((k) => {
            const a = (k / 4) * Math.PI * 2 + 0.785;
            return (
              <mesh key={k} position={[Math.cos(a) * 0.11, 0.3, Math.sin(a) * 0.11]} rotation={[Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12]} material={m.brass} castShadow>
                <cylinderGeometry args={[0.01, 0.013, 0.61, 10]} />
              </mesh>
            );
          })}
          <mesh position={[0, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.brass}>
            <torusGeometry args={[0.125, 0.007, 6, 28]} />
          </mesh>
        </group>
      ))}
      {/* storage on the lower shelf */}
      {[-0.55, -0.3, 0.4].map((x, i) => (
        <Box key={x} m={i === 1 ? m.giftRed : m.ebony} p={[x, 0.24, 0]} s={[0.2, 0.13, 0.3]} r={0.008} />
      ))}
    </group>
  );
}

/* ------------------------------- Oud display ------------------------------ */

function VelvetTray({ m, w, d, mat }: { m: AtelierMaterials; w: number; d: number; mat: THREE.Material }) {
  return (
    <group>
      <Box m={m.brass} p={[0, 0.012, 0]} s={[w, 0.024, d]} r={0.008} />
      <Box m={mat} p={[0, 0.022, 0]} s={[w - 0.024, 0.008, d - 0.024]} r={0.003} />
    </group>
  );
}

export function OudDisplay({ m, quality }: { m: AtelierMaterials; quality: Quality }) {
  const { w, d, h } = OUD;
  const chips = useMemo(() => {
    const r = rng(41);
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2;
      const rr = Math.sqrt(r()) * 0.055;
      const s = 0.012 + r() * 0.01;
      out.push(new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * rr, 0.018 + r() * 0.012 + (0.055 - rr) * 0.25, Math.sin(a) * rr), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)), new THREE.Vector3(s * 1.8, s * 0.7, s)));
    }
    return out;
  }, []);
  const cloche = useMemo(() => smoothLathe([[0.11, 0], [0.112, 0.06], [0.108, 0.14], [0.09, 0.2], [0.05, 0.235], [0.015, 0.245], [0.016, 0.258], [0.001, 0.262]], quality === 'high' ? 56 : 32, 22), [quality]);
  const knob = useMemo(() => smoothLathe([[0.001, 0.255], [0.012, 0.256], [0.016, 0.268], [0.01, 0.282], [0.001, 0.285]], 20, 12), []);
  const dish = useMemo(() => vessel([[0.001, 0], [0.04, 0], [0.065, 0.02], [0.072, 0.026]], 0.003, 40), []);
  const pieces: { tray: number; p: Vec3; s: Vec3; r: number; seed: number }[] = [
    { tray: 0, p: [-0.05, 0.04, -0.03], s: [0.085, 0.02, 0.026], r: 0.4, seed: 1 },
    { tray: 0, p: [0.07, 0.037, 0.045], s: [0.06, 0.016, 0.02], r: 2.1, seed: 2 },
    { tray: 0, p: [0.06, 0.035, -0.055], s: [0.045, 0.014, 0.017], r: 1.1, seed: 3 },
    { tray: 1, p: [0.0, 0.045, 0.0], s: [0.12, 0.028, 0.036], r: 0.9, seed: 4 },
    { tray: 1, p: [-0.09, 0.036, 0.06], s: [0.05, 0.016, 0.018], r: 2.6, seed: 5 },
    { tray: 2, p: [-0.05, 0.04, 0.0], s: [0.075, 0.024, 0.03], r: 1.7, seed: 6 },
    { tray: 2, p: [0.07, 0.036, 0.04], s: [0.055, 0.016, 0.02], r: 0.2, seed: 7 },
    { tray: 2, p: [0.06, 0.034, -0.05], s: [0.04, 0.013, 0.016], r: 2.9, seed: 8 },
  ];
  const trays: { p: Vec3; w: number; d: number; mat: THREE.Material }[] = [
    { p: [-0.42, h, 0.05], w: 0.3, d: 0.24, mat: m.velvetRed },
    { p: [0.0, h, 0.12], w: 0.34, d: 0.26, mat: m.velvetGreen },
    { p: [0.42, h, 0.05], w: 0.3, d: 0.24, mat: m.velvetRed },
  ];
  return (
    <group position={[OUD.x, 0, OUD.z]}>
      <Table m={m} w={w} d={d} h={h} top={m.marbleDark} base="ebony" />
      {trays.map((t, i) => (
        <group key={i} position={t.p}>
          <VelvetTray m={m} w={t.w} d={t.d} mat={t.mat} />
          {pieces
            .filter((pc) => pc.tray === i)
            .map((pc, k) => (
              <mesh key={k} geometry={chunk(pc.seed, 3, [1, 1, 1], 0.42, true)} material={m.agarwood} position={pc.p} scale={pc.s} rotation={[0, pc.r, 0.1]} castShadow receiveShadow />
            ))}
          {/* label card on a brass easel */}
          <group position={[0, 0.026, t.d / 2 + 0.035]} rotation={[-0.35, 0, 0]}>
            <Box m={m.brass} p={[0, 0.002, 0]} s={[0.07, 0.004, 0.02]} r={0.001} />
            <mesh position={[0, 0.02, -0.004]} rotation={[-0.1, 0, 0]} material={m.card}>
              <planeGeometry args={[0.07, 0.035]} />
            </mesh>
          </group>
        </group>
      ))}
      {/* cloches over prize pieces */}
      {[
        [-0.3, -0.2],
        [0.3, -0.2],
      ].map(([x, z], i) => (
        <group key={i} position={[x, h, z]}>
          <mesh material={m.walnut} position={[0, 0.015, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.125, 0.13, 0.03, 48]} />
          </mesh>
          <mesh material={m.brass} position={[0, 0.031, 0]}>
            <torusGeometry args={[0.112, 0.004, 8, 48]} />
          </mesh>
          <mesh material={i ? m.velvetRed : m.velvetGreen} position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.07, 0.075, 0.02, 32]} />
          </mesh>
          <mesh geometry={chunk(10 + i, 3, [1, 1, 1], 0.45, true)} material={m.agarwood} position={[0, 0.072, 0]} scale={[0.085, 0.03, 0.034]} rotation={[0.2, i * 1.3, 0]} castShadow />
          <group position={[0, 0.03, 0]}>
            <mesh geometry={cloche} material={m.crystal} renderOrder={2} />
            <mesh geometry={knob} material={m.brass} castShadow />
          </group>
        </group>
      ))}
      {/* dish of oud chips */}
      <group position={[0.0, h, -0.2]}>
        <mesh geometry={dish} material={m.brass} castShadow receiveShadow />
        <Baked geo={chunk(21, 1, [1, 1, 1], 0.3)} mats={chips} material={m.agarwood} />
      </group>
      {/* oud oil vials */}
      <group position={[0.56, h, -0.22]}>
        <Box m={m.walnut} p={[0, 0.015, 0]} s={[0.1, 0.03, 0.1]} r={0.006} />
        {[0, 1, 2, 3].map((k) => (
          <CrystalBottle key={k} m={m} design="slender" quality={quality} color="#4A220E" position={[((k % 2) - 0.5) * 0.045, 0.03, (Math.floor(k / 2) - 0.5) * 0.045]} scale={0.38} />
        ))}
      </group>
    </group>
  );
}

/* ------------------------------ Bukhoor table ----------------------------- */

export function BukhoorTable({ m, quality }: { m: AtelierMaterials; quality: Quality }) {
  const { w, d, h } = BUKHOOR;
  const discGeo = useMemo(() => new THREE.CylinderGeometry(0.019, 0.02, 0.012, 16), []);
  const bowls: { p: Vec3; s: number }[] = [
    { p: [-0.46, h, -0.12], s: 1 },
    { p: [-0.18, h, 0.0], s: 0.8 },
    { p: [0.04, h, -0.16], s: 0.9 },
  ];
  const pieces = useMemo(() => {
    const r = rng(53);
    const out: THREE.Matrix4[] = [];
    bowls.forEach((b) => {
      for (let i = 0; i < 16; i++) {
        const a = r() * Math.PI * 2;
        const rr = Math.sqrt(r()) * 0.075 * b.s;
        const s = (0.012 + r() * 0.01) * b.s;
        const y = 0.03 * b.s + (0.075 * b.s - rr) * 0.35 + r() * 0.012;
        out.push(new THREE.Matrix4().compose(new THREE.Vector3(b.p[0] + Math.cos(a) * rr, b.p[1] + y, b.p[2] + Math.sin(a) * rr), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)), new THREE.Vector3(s * 1.3, s * 0.8, s)));
      }
    });
    return out;
  }, []);
  const discs = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let i = -2; i <= 2; i++)
      for (let j = -2; j <= 2; j++) {
        if (Math.hypot(i, j) > 2.3) continue;
        out.push(new THREE.Matrix4().makeTranslation(0.42 + i * 0.048, h + 0.022, 0.12 + j * 0.048));
      }
    return out;
  }, [h]);
  const bowl = useMemo(() => vessel([[0.001, 0], [0.04, 0], [0.05, 0.006], [0.08, 0.035], [0.095, 0.058], [0.098, 0.062]], 0.004, 48), []);
  const mortar = useMemo(() => vessel([[0.001, 0], [0.05, 0], [0.052, 0.012], [0.04, 0.02], [0.05, 0.04], [0.062, 0.085], [0.066, 0.09]], 0.012, 48), []);
  const pestle = useMemo(() => smoothLathe([[0.001, 0], [0.018, 0.0], [0.022, 0.02], [0.012, 0.05], [0.009, 0.15], [0.012, 0.17], [0.001, 0.175]], 20, 24), []);
  const pan = useMemo(() => vessel([[0.001, 0], [0.05, 0.004], [0.075, 0.02], [0.078, 0.023]], 0.002, 40), []);
  const jar = useMemo(() => vessel([[0.001, 0], [0.055, 0], [0.058, 0.008], [0.058, 0.16], [0.05, 0.172], [0.05, 0.185]], 0.003, quality === 'high' ? 40 : 24), [quality]);
  const lid = useMemo(() => smoothLathe([[0.001, 0.18], [0.054, 0.18], [0.055, 0.2], [0.02, 0.206], [0.014, 0.222], [0.001, 0.226]], 28, 16), []);
  const spoon = useMemo(() => vessel([[0.001, 0], [0.02, 0.006], [0.028, 0.016], [0.029, 0.018]], 0.003, 20), []);
  const jars: { p: Vec3; fill: THREE.Material; lvl: number }[] = [
    { p: [0.3, h, -0.2], fill: m.sugar, lvl: 0.12 },
    { p: [0.43, h, -0.21], fill: m.resin, lvl: 0.1 },
    { p: [0.56, h, -0.18], fill: m.powder, lvl: 0.11 },
  ];
  return (
    <group position={[BUKHOOR.x, 0, BUKHOOR.z]} rotation={[0, 0.08, 0]}>
      <LowTable m={m} w={w} d={d} h={h} />
      {/* floor cushions for blending seated, majlis-style */}
      <FloorCushion m={m} mat={m.velvetRed} p={[0.05, 0, d / 2 + 0.36]} size={[0.6, 0.11, 0.5]} rot={0.04} />
      <FloorCushion m={m} mat={m.velvetGreen} p={[w / 2 + 0.34, 0, 0.02]} size={[0.46, 0.1, 0.54]} rot={0.12} />
      {bowls.map((b, i) => (
        <mesh key={i} geometry={bowl} material={m.brass} position={b.p} scale={b.s} castShadow receiveShadow />
      ))}
      <Baked geo={chunk(31, 1, [1, 1, 1], 0.32)} mats={pieces} material={m.bukhoor} />
      {/* mortar & pestle */}
      <group position={[0.07, h, 0.16]}>
        <mesh geometry={mortar} material={m.brassOld} castShadow receiveShadow />
        <mesh geometry={pestle} material={m.brassOld} position={[0.02, 0.05, 0]} rotation={[0, 0, -0.42]} castShadow />
      </group>
      {/* traditional balance */}
      <group position={[-0.5, h, 0.18]}>
        <mesh material={m.brass} position={[0, 0.008, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.06, 0.016, 32]} />
        </mesh>
        <mesh material={m.brass} position={[0, 0.17, 0]} castShadow>
          <cylinderGeometry args={[0.006, 0.008, 0.32, 12]} />
        </mesh>
        <mesh material={m.brass} position={[0, 0.33, 0]} rotation={[0, 0, Math.PI / 2 + 0.04]} castShadow>
          <cylinderGeometry args={[0.004, 0.004, 0.32, 8]} />
        </mesh>
        <mesh material={m.brass} position={[0, 0.345, 0]}>
          <coneGeometry args={[0.01, 0.03, 12]} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.155, 0.33 - s * 0.006, 0]}>
            {[0, 1, 2].map((k) => {
              const a = (k / 3) * Math.PI * 2;
              return (
                <mesh key={k} material={m.brassOld} position={[Math.cos(a) * 0.03, -0.1, Math.sin(a) * 0.03]} rotation={[Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3]}>
                  <cylinderGeometry args={[0.0012, 0.0012, 0.21, 4]} />
                </mesh>
              );
            })}
            <mesh geometry={pan} material={m.brass} position={[0, -0.2, 0]} castShadow />
          </group>
        ))}
      </group>
      {/* ingredient jars */}
      {jars.map((j, i) => (
        <group key={i} position={j.p}>
          <mesh material={j.fill} position={[0, j.lvl / 2 + 0.004, 0]}>
            <cylinderGeometry args={[0.053, 0.053, j.lvl, 28]} />
          </mesh>
          <mesh geometry={jar} material={m.glass} renderOrder={2} />
          <mesh geometry={lid} material={i % 2 ? m.cork : m.brassOld} castShadow />
        </group>
      ))}
      {/* tray of drying bukhoor discs */}
      <mesh material={m.brass} position={[0.42, h + 0.008, 0.12]} receiveShadow castShadow>
        <cylinderGeometry args={[0.15, 0.145, 0.016, 48]} />
      </mesh>
      <Baked geo={discGeo} mats={discs} material={m.bukhoor} />
      {/* wooden spoons */}
      {[0, 1].map((k) => (
        <group key={k} position={[0.2 + k * 0.05, h + 0.012, -0.02 + k * 0.03]} rotation={[0, 1.1 + k * 0.35, 0]}>
          <mesh geometry={spoon} material={m.teak} rotation={[Math.PI / 2 - 0.15, 0, 0]} position={[0, 0.012, 0]} castShadow />
          <mesh material={m.teak} position={[0, 0.008, -0.13]} rotation={[Math.PI / 2 - 0.06, 0, 0]} castShadow>
            <cylinderGeometry args={[0.006, 0.008, 0.22, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------- Packaging ------------------------------- */

function GiftBox({ m, size, ribbon = true, open = false }: { m: AtelierMaterials; size: Vec3; ribbon?: boolean; open?: boolean }) {
  const [w, h, d] = size;
  const lidH = Math.min(0.045, h * 0.35);
  return (
    <group>
      <Box m={m.giftRed} p={[0, (h - (open ? 0 : lidH * 0.6)) / 2, 0]} s={[w, h - (open ? 0 : lidH * 0.6), d]} r={0.004} />
      {!open && <Box m={m.giftRed} p={[0, h - lidH / 2, 0]} s={[w + 0.008, lidH, d + 0.008]} r={0.004} />}
      {ribbon && !open && (
        <>
          <Box m={m.ribbon} p={[0, h / 2, 0]} s={[w + 0.012, h + 0.006, 0.022]} r={0.002} cast={false} />
          <Box m={m.ribbon} p={[0, h / 2, 0]} s={[0.022, h + 0.006, d + 0.012]} r={0.002} cast={false} />
          {[-1, 1].map((s) => (
            <mesh key={s} material={m.ribbon} position={[s * 0.022, h + 0.016, 0]} rotation={[Math.PI / 2, s * 0.5, 0]} scale={[1, 1, 0.55]} castShadow>
              <torusGeometry args={[0.022, 0.006, 8, 20]} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

export function PackagingBench({ m, quality }: { m: AtelierMaterials; quality: Quality }) {
  const { w, d, h } = PACKAGING;
  const tissue = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.26, 0.26, 10, 10);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const edge = Math.max(Math.abs(x), Math.abs(y)) / 0.13;
      p.setZ(i, Math.sin(x * 40) * Math.cos(y * 33) * 0.008 + edge * edge * 0.05);
    }
    g.computeVertexNormals();
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const sheet = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.62, 0.42, 24, 8);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      // curl back up near the roll
      const t = (y + 0.21) / 0.42;
      p.setZ(i, t > 0.82 ? Math.pow((t - 0.82) / 0.18, 2) * 0.05 : 0);
    }
    g.computeVertexNormals();
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  return (
    <group position={[PACKAGING.x, 0, PACKAGING.z]} rotation={[0, -0.08, 0]}>
      <Table m={m} w={w} d={d} h={h} top={m.teak} shelf />
      {/* paper roll with an unrolled sheet */}
      <mesh material={m.giftPaper} position={[-0.1, h + 0.05, -0.27]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.7, 40]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={m.cork} position={[-0.1 + s * 0.352, h + 0.05, -0.27]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.014, 0.014, 0.012, 16]} />
        </mesh>
      ))}
      <mesh geometry={sheet} material={m.giftPaper} position={[-0.1, h + 0.003, -0.04]} receiveShadow castShadow />
      {/* finished gift sets, stacked */}
      <group position={[0.5, h, -0.12]} rotation={[0, 0.2, 0]}>
        <GiftBox m={m} size={[0.3, 0.1, 0.22]} />
        <group position={[0.01, 0.1 + 0.006, 0]} rotation={[0, -0.25, 0]}>
          <GiftBox m={m} size={[0.24, 0.085, 0.18]} />
        </group>
        <group position={[-0.01, 0.2, 0]} rotation={[0, 0.3, 0]}>
          <GiftBox m={m} size={[0.16, 0.08, 0.13]} />
        </group>
      </group>
      {/* open box with tissue and a bottle being nested */}
      <group position={[-0.35, h, 0.14]} rotation={[0, 0.35, 0]}>
        <GiftBox m={m} size={[0.24, 0.09, 0.24]} open />
        <mesh geometry={tissue} material={m.tissue} position={[0, 0.06, 0]} />
        {/* faceted flacon with a flat cap — the teardrop attar stopper read as a candle flame here */}
        <CrystalBottle m={m} design="facet" quality={quality} color="#B8434F" position={[0, 0.05, 0]} rotation={0.4} scale={0.85} />
        <group position={[0.2, 0, -0.1]} rotation={[0, -0.6, 0]}>
          <Box m={m.giftRed} p={[0, 0.012, 0]} s={[0.25, 0.024, 0.25]} r={0.004} />
        </group>
      </group>
      {/* ribbon spools */}
      {[0, 1, 2].map((k) => (
        <group key={k} position={[0.15 + k * 0.085, h + 0.03, 0.22]} rotation={[0, 0, 0]}>
          <mesh material={k === 1 ? m.giftRed : m.ribbon} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.03, 32]} />
          </mesh>
          <mesh material={m.teak} position={[0, 0.0, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.034, 16]} />
          </mesh>
        </group>
      ))}
      {/* trailing ribbon & cards */}
      <Box m={m.ribbon} p={[0.15, h + 0.002, 0.07]} s={[0.4, 0.002, 0.02]} r={0.0008} rot={[0, 0.5, 0]} cast={false} />
      <group position={[0.02, h, 0.24]} rotation={[0, -0.3, 0]}>
        {[0, 1, 2].map((k) => (
          <Box key={k} m={m.giftCream} p={[k * 0.006, 0.002 + k * 0.003, k * 0.004]} s={[0.1, 0.002, 0.07]} r={0.0008} cast={false} />
        ))}
      </group>
      {/* scissors */}
      <group position={[0.3, h + 0.004, 0.06]} rotation={[0, 1.1, 0]}>
        {[-1, 1].map((s) => (
          <group key={s} rotation={[0, s * 0.12, 0]}>
            <Box m={m.steel} p={[0.07, 0, 0]} s={[0.12, 0.003, 0.01]} r={0.001} cast={false} />
            <mesh material={m.brass} position={[-0.02, 0, s * 0.018]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.016, 0.004, 6, 16]} />
            </mesh>
          </group>
        ))}
      </group>
      {/* boxes waiting on the shelf */}
      {[-0.4, 0.0, 0.38].map((x, i) => (
        <group key={x} position={[x, 0.17, 0]}>
          <GiftBox m={m} size={[0.28, 0.12 - i * 0.02, 0.3]} ribbon={i !== 1} />
        </group>
      ))}
    </group>
  );
}
