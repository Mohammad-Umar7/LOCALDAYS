import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { StringLights } from '../../props/Decor';
import { roundedBox, smoothLathe, tubeAlong } from '../../props/geo';
import type { Quality, Vec3 } from '../../core/types';
import { grainBox, type ApiaryMaterials } from './materials';
import { HONEY, Jars, type JarItem } from './Jars';
import { groundY, KIOSK, rng } from './layout';

/* ------------------------------------------------------------------ */
/*  Tasting kiosk & shop: a timber stall on a deck under a striped     */
/*  awning. Shelves of amber jars glow when backlit; the counter holds */
/*  a five-honey tasting flight, spoons, comb and dates.               */
/* ------------------------------------------------------------------ */

const { w: KW, d: KD } = KIOSK;
const DECK = 0.16;
const WALL_H = 2.5;
const COUNTER_Y = 1.05;
const AWN = 1.95;
const AWN_TOP = 2.44;
const AWN_FRONT = 2.25;

function B({ geo, mat, p, r, cast = true }: { geo: THREE.BufferGeometry; mat: THREE.Material; p: Vec3; r?: Vec3; cast?: boolean }) {
  return <mesh geometry={geo} material={mat} position={p} rotation={r} castShadow={cast} receiveShadow />;
}

function awningGeometry(w: number, len: number) {
  const g = new THREE.PlaneGeometry(w, len, 16, 10);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const t = z / len + 0.5;
    // gentle sag between the ribs
    const rib = Math.abs(Math.sin((x / w + 0.5) * Math.PI * 3));
    p.setY(i, -Math.sin(t * Math.PI) * 0.05 - (1 - rib) * 0.015 * Math.sin(t * Math.PI));
  }
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.2, uv.getY(i));
  g.computeVertexNormals();
  return g;
}

function valanceGeometry(w: number, h: number, scallops: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, -h * 0.55);
  const step = w / scallops;
  for (let i = scallops - 1; i >= 0; i--) {
    const cx = -w / 2 + (i + 0.5) * step;
    for (let k = 0; k <= 8; k++) {
      const a = (k / 8) * Math.PI;
      s.lineTo(cx + Math.cos(a) * step * 0.5, -h * 0.55 - Math.sin(a) * h * 0.45);
    }
  }
  s.lineTo(-w / 2, 0);
  const g = new THREE.ShapeGeometry(s, 4);
  const p = g.attributes.position as THREE.BufferAttribute;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (p.getX(i) / w + 0.5) * 2.2;
    uv[i * 2 + 1] = 0.5;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

function Stool({ m, position }: { m: ApiaryMaterials; position: Vec3 }) {
  const seat = useMemo(() => smoothLathe([[0.001, 0.0], [0.17, 0.0], [0.18, 0.015], [0.175, 0.04], [0.001, 0.045]], 32, 10), []);
  return (
    <group position={position}>
      <mesh geometry={seat} material={m.timber} position={[0, 0.66, 0]} castShadow receiveShadow />
      {[0, 1, 2, 3].map((k) => {
        const a = (k / 4) * Math.PI * 2 + 0.4;
        return (
          <mesh key={k} geometry={grainBox(0.03, 0.68, 0.03, 0.006, 1.5)} material={m.timberDark} position={[Math.cos(a) * 0.12, 0.33, Math.sin(a) * 0.12]} rotation={[Math.sin(a) * 0.08, 0, -Math.cos(a) * 0.08]} castShadow />
        );
      })}
      <mesh position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow material={m.timberDark}>
        <torusGeometry args={[0.135, 0.01, 6, 24]} />
      </mesh>
    </group>
  );
}

function TastingSet({ m }: { m: ApiaryMaterials }) {
  const dish = useMemo(() => smoothLathe([[0.001, 0], [0.025, 0], [0.04, 0.012], [0.045, 0.022], [0.042, 0.023], [0.035, 0.014], [0.001, 0.008]], 24, 12), []);
  const spoon = useMemo(() => {
    const head = new THREE.SphereGeometry(0.012, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    head.scale(1, 0.5, 1.5);
    head.translate(0, 0.005, 0.07);
    const handle = new THREE.BoxGeometry(0.006, 0.003, 0.11);
    handle.translate(0, 0.006, 0.0);
    return [head, handle];
  }, []);
  const dipper = useMemo(() => smoothLathe([[0.001, 0], [0.012, 0.0], [0.02, 0.01], [0.012, 0.02], [0.02, 0.03], [0.012, 0.04], [0.02, 0.05], [0.006, 0.06], [0.005, 0.2], [0.008, 0.21], [0.001, 0.215]], 16, 40), []);
  const shades = [HONEY.ghaf, HONEY.wild, HONEY.comb, HONEY.samar, HONEY.sidr];
  const discRef = useRef<THREE.InstancedMesh>(null);
  const discGeo = useMemo(() => {
    const g = new THREE.CircleGeometry(0.034, 20);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  useLayoutEffect(() => {
    const d = discRef.current;
    if (!d) return;
    const mt = new THREE.Matrix4();
    shades.forEach((c, i) => {
      d.setMatrixAt(i, mt.makeTranslation(-0.24 + i * 0.12, 0, 0));
      d.setColorAt(i, new THREE.Color(c));
    });
    d.instanceMatrix.needsUpdate = true;
    if (d.instanceColor) d.instanceColor.needsUpdate = true;
    d.computeBoundingSphere();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <group>
      {/* flight board */}
      <B geo={grainBox(0.62, 0.025, 0.17, 0.008, 2)} mat={m.timberDark} p={[0, 0.0125, 0]} />
      {shades.map((c, i) => (
        <group key={i} position={[-0.24 + i * 0.12, 0.025, 0]}>
          <mesh geometry={dish} material={m.ceramic} receiveShadow />
          <group position={[0.02, 0.012, 0.07]} rotation={[0, 0.3 + i * 0.1, 0]}>
            {spoon.map((g, k) => (
              <mesh key={k} geometry={g} material={m.timber} />
            ))}
          </group>
        </group>
      ))}
      <instancedMesh ref={discRef} args={[discGeo, m.honey, shades.length]} position={[0, 0.041, 0]} />
      {/* honey dipper resting in an open jar */}
      <group position={[0.46, 0, -0.02]}>
        <mesh geometry={dipper} material={m.timber} position={[0.0, 0.03, 0]} rotation={[0, 0, -0.35]} castShadow />
      </group>
      {/* comb on a plate */}
      <group position={[-0.5, 0, 0.02]}>
        <mesh position={[0, 0.008, 0]} receiveShadow material={m.ceramic}>
          <cylinderGeometry args={[0.12, 0.1, 0.016, 32]} />
        </mesh>
        <mesh position={[0, 0.045, 0]} rotation={[0, 0.4, 0]} castShadow material={m.comb}>
          <boxGeometry args={[0.15, 0.06, 0.1]} />
        </mesh>
      </group>
      {/* dates */}
      <group position={[-0.27, 0, -0.2]}>
        <mesh position={[0, 0.03, 0]} material={m.ceramic}>
          <sphereGeometry args={[0.075, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        </mesh>
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} position={[Math.cos(i * 2.1) * 0.035, 0.022 + (i > 6 ? 0.015 : 0), Math.sin(i * 2.1) * 0.035]} scale={[0.016, 0.012, 0.025]} rotation={[0, i, 0]}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color="#5A2A12" roughness={0.35} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function GiftBoxes({ m }: { m: ApiaryMaterials }) {
  const kraft = useMemo(() => new THREE.MeshStandardMaterial({ color: '#B98E5E', roughness: 0.85 }), []);
  return (
    <group>
      {[
        [0, 0.05, 0, 0.3],
        [0.02, 0.15, 0.01, 0.1],
        [-0.01, 0.25, -0.01, -0.15],
      ].map(([x, y, z, r], i) => (
        <group key={i} position={[x, y, z]} rotation={[0, r, 0]}>
          <mesh geometry={roundedBox(0.3, 0.1, 0.12, 0.008, 2)} material={kraft} castShadow receiveShadow />
          <mesh geometry={roundedBox(0.035, 0.102, 0.122, 0.004, 1)} material={m.leather} position={[0.06, 0, 0]} />
        </group>
      ))}
    </group>
  );
}

export const Shop = memo(function Shop({ m, quality, lit }: { m: ApiaryMaterials; quality: Quality; lit: boolean }) {
  const gy = useMemo(() => {
    let lo = Infinity;
    const c = Math.cos(KIOSK.rot);
    const s = Math.sin(KIOSK.rot);
    for (const lx of [-2.5, 0, 2.5])
      for (const lz of [-1.3, 1, 3.3]) lo = Math.min(lo, groundY(KIOSK.x + lx * c + lz * s, KIOSK.z - lx * s + lz * c));
    return lo;
  }, []);

  const jars: JarItem[] = useMemo(() => {
    const r = rng(31);
    const out: JarItem[] = [];
    const types = [HONEY.sidr, HONEY.samar, HONEY.wild, HONEY.ghaf];
    // back wall: four shelves, grouped by honey
    const backZ = -KD / 2 + 0.2;
    [1.13, 1.45, 1.77, 2.07].forEach((y, li) => {
      let x = -KW / 2 + 0.28;
      let g = 0;
      while (x < KW / 2 - 0.28) {
        const type = types[(li + g) % types.length];
        const small = (li + g) % 3 === 2;
        const s = small ? 0.78 : 1;
        const n = 4 + Math.floor(r() * 3);
        for (let k = 0; k < n && x < KW / 2 - 0.28; k++) {
          out.push({ p: [x, y + 0.016, backZ + (r() - 0.5) * 0.02], s, honey: type, lid: g % 4, rot: r() * 0.6 - 0.3 });
          x += 0.1 * s + 0.006;
        }
        x += 0.07;
        g++;
      }
    });
    // side shelves
    for (const sx of [-1, 1]) {
      [1.2, 1.55, 1.9].forEach((y, li) => {
        for (let k = 0; k < 6; k++)
          out.push({ p: [sx * (KW / 2 - 0.2), y + 0.016, -0.42 + k * 0.105], honey: types[(li + k + (sx > 0 ? 1 : 0)) % types.length], lid: li, s: 0.92 });
      });
    }
    // counter display: a small pyramid
    const cz = KD / 2 + 0.05;
    const base = COUNTER_Y + 0.03;
    for (let i = 0; i < 4; i++) out.push({ p: [1.0 + i * 0.1, base, cz], honey: types[i % 4], lid: 0 });
    for (let i = 0; i < 3; i++) out.push({ p: [1.05 + i * 0.1, base + 0.118, cz], honey: types[(i + 1) % 4], lid: 0 });
    for (let i = 0; i < 2; i++) out.push({ p: [1.1 + i * 0.1, base + 0.236, cz], honey: types[(i + 2) % 4], lid: 0 });
    out.push({ p: [0.21, base, KD / 2 + 0.1], honey: HONEY.wild, lid: -1 });
    return out;
  }, []);

  const awning = useMemo(() => awningGeometry(KW + 0.3, AWN), []);
  const valance = useMemo(() => valanceGeometry(KW + 0.3, 0.22, 9), []);
  const awnPitch = Math.atan2(AWN_TOP - AWN_FRONT, AWN);
  const lightPts: Vec3[] = useMemo(
    () => [
      [-KW / 2 - 0.1, 2.2, KD / 2 + AWN - 0.02],
      [0, 2.2, KD / 2 + AWN - 0.02],
      [KW / 2 + 0.1, 2.2, KD / 2 + AWN - 0.02],
    ],
    [],
  );
  const lamp = useMemo(() => {
    const mt = m.lamp.clone();
    mt.emissiveIntensity = lit ? 4 : 0.2;
    return mt;
  }, [m, lit]);
  const cord = useMemo(() => tubeAlong([new THREE.Vector3(0, WALL_H, -0.1), new THREE.Vector3(0, WALL_H - 0.4, -0.1)], 0.005, 4), []);
  const slats = useMemo(() => Array.from({ length: 15 }, (_, i) => -KW / 2 + 0.17 + i * ((KW - 0.34) / 14)), []);

  return (
    <group position={[KIOSK.x, gy, KIOSK.z]} rotation={[0, KIOSK.rot, 0]}>
      {/* deck on bearers */}
      <B geo={grainBox(KW + 1.6, 0.1, KD + 2.4, 0.015, 1.1)} mat={m.deck} p={[0, DECK - 0.05, 0.95]} />
      {[-2.2, 0, 2.2].map((x) => (
        <B key={x} geo={grainBox(0.12, 0.3, KD + 2.3, 0.01, 1.1)} mat={m.timberDark} p={[x, DECK - 0.24, 0.95]} />
      ))}
      <B geo={grainBox(KW + 1.6, 0.06, 0.04, 0.01, 1.1)} mat={m.timberDark} p={[0, DECK - 0.07, 0.95 + (KD + 2.4) / 2]} />
      {/* kiosk body: corner posts, cladding */}
      <group position={[0, DECK, 0]}>
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => <B key={`${sx}${sz}`} geo={grainBox(0.12, WALL_H, 0.12, 0.012, 1.2)} mat={m.timberDark} p={[sx * (KW / 2 - 0.06), WALL_H / 2, sz * (KD / 2 - 0.06)]} />),
        )}
        <B geo={grainBox(KW - 0.12, WALL_H, 0.05, 0.008, 0.55)} mat={m.timber} p={[0, WALL_H / 2, -KD / 2 + 0.03]} />
        <B geo={grainBox(0.05, WALL_H, KD - 0.12, 0.008, 0.55)} mat={m.timber} p={[-KW / 2 + 0.03, WALL_H / 2, 0]} />
        <B geo={grainBox(0.05, WALL_H, KD - 0.12, 0.008, 0.55)} mat={m.timber} p={[KW / 2 - 0.03, WALL_H / 2, 0]} />
        {/* inner back panel, darker so the jars glow against it */}
        <B geo={grainBox(KW - 0.2, WALL_H - 0.3, 0.02, 0.005, 1.1)} mat={m.timberDark} p={[0, WALL_H / 2, -KD / 2 + 0.065]} cast={false} />
        {/* counter front with vertical slats */}
        <B geo={grainBox(KW - 0.12, COUNTER_Y - 0.02, 0.05, 0.008, 1.1)} mat={m.timberDark} p={[0, (COUNTER_Y - 0.02) / 2, KD / 2 - 0.03]} />
        {slats.map((x, i) => (
          <B key={i} geo={grainBox(0.07, COUNTER_Y - 0.12, 0.025, 0.006, 1.3)} mat={m.timber} p={[x, (COUNTER_Y - 0.02) / 2, KD / 2 + 0.005]} cast={false} />
        ))}
        <B geo={grainBox(KW + 0.1, 0.06, 0.62, 0.012, 1.1)} mat={m.timber} p={[0, COUNTER_Y, KD / 2 + 0.06]} />
        {/* header + fascia sign */}
        <B geo={grainBox(KW - 0.12, 0.3, 0.06, 0.008, 1.1)} mat={m.timber} p={[0, WALL_H - 0.15, KD / 2 - 0.03]} />
        <B geo={grainBox(KW + 0.66, 0.5, 0.06, 0.01, 1.1)} mat={m.timberDark} p={[0, WALL_H + 0.28, KD / 2 + 0.31]} />
        <mesh position={[0, WALL_H + 0.28, KD / 2 + 0.341]} material={m.sign}>
          <planeGeometry args={[KW * 0.82, 0.36]} />
        </mesh>
        {/* roof */}
        <B geo={grainBox(KW + 0.6, 0.1, KD + 0.6, 0.015, 1.1)} mat={m.timberDark} p={[0, WALL_H + 0.08, -0.05]} r={[-0.06, 0, 0]} />
        <B geo={roundedBox(KW + 0.66, 0.025, KD + 0.66, 0.006, 2)} mat={m.galvanised} p={[0, WALL_H + 0.145, -0.05]} r={[-0.06, 0, 0]} />
        {/* warm LED strips under each shelf lip */}
        {[1.13, 1.45, 1.77, 2.07].map((y) => (
          <mesh key={`led${y}`} position={[0, y - 0.022, -KD / 2 + 0.355]} material={lamp}>
            <boxGeometry args={[KW - 0.3, 0.012, 0.012]} />
          </mesh>
        ))}
        {/* shelves */}
        {[1.13, 1.45, 1.77, 2.07].map((y) => (
          <B key={y} geo={grainBox(KW - 0.2, 0.032, 0.28, 0.006, 1.1)} mat={m.timber} p={[0, y, -KD / 2 + 0.22]} />
        ))}
        {[-1, 1].map((sx) =>
          [1.2, 1.55, 1.9].map((y) => <B key={`${sx}${y}`} geo={grainBox(0.24, 0.032, 1.3, 0.006, 1.1)} mat={m.timber} p={[sx * (KW / 2 - 0.2), y, 0.12]} />),
        )}
        <Jars items={jars} m={m} quality={quality} />
        {/* counter dressing */}
        <group position={[-0.25, COUNTER_Y + 0.03, KD / 2 + 0.12]}>
          <TastingSet m={m} />
        </group>
        <group position={[-1.38, COUNTER_Y + 0.03, KD / 2 + 0.1]} rotation={[0, 0.2, 0]}>
          <GiftBoxes m={m} />
        </group>
        {/* pendant lamp */}
        <mesh geometry={cord} material={m.blackPlastic} />
        <mesh position={[0, WALL_H - 0.47, -0.1]} material={lamp}>
          <sphereGeometry args={[0.07, 20, 14]} />
        </mesh>
        <mesh position={[0, WALL_H - 0.4, -0.1]} castShadow material={m.brass}>
          <coneGeometry args={[0.14, 0.12, 24, 1, true]} />
        </mesh>
        {lit && <pointLight position={[0, WALL_H - 0.6, 0.25]} color="#FFC07A" intensity={16} distance={7} decay={2} />}
        {/* awning: fascia → front beam on two posts */}
        <group position={[0, AWN_TOP, KD / 2 + 0.08]} rotation={[awnPitch, 0, 0]}>
          <mesh geometry={awning} material={m.awning} position={[0, 0, AWN / 2]} castShadow receiveShadow />
          <mesh geometry={valance} material={m.awning} position={[0, -0.01, AWN + 0.005]} castShadow />
        </group>
        {[-1, 1].map((sx) => (
          <group key={sx}>
            <B geo={grainBox(0.08, AWN_FRONT, 0.08, 0.012, 1.2)} mat={m.timberDark} p={[sx * (KW / 2 + 0.1), AWN_FRONT / 2, KD / 2 + AWN - 0.05]} />
          </group>
        ))}
        <B geo={grainBox(KW + 0.34, 0.08, 0.06, 0.01, 1.2)} mat={m.timberDark} p={[0, AWN_FRONT, KD / 2 + AWN - 0.05]} />
        <StringLights points={lightPts} sag={0.22} bulbs={8} lit={lit} />
        {/* stools */}
        {[-0.95, 0.0, 0.95].map((x, i) => (
          <Stool key={i} m={m} position={[x, 0, KD / 2 + 0.72 + (i % 2) * 0.06]} />
        ))}
      </group>
    </group>
  );
});
