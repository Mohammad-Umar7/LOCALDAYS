import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { boxProjectUVs, roundedBox, wallGeometry, type Opening } from '../../props/geo';
import { CoffeeTray, Lantern, MajlisSeating, Rug } from '../../props/Decor';
import type { FarmMaterials } from './materials';
import type { Vec3 } from '../../core/types';

/* ------------------------------------------------------------------ */
/*  Traditional Emirati courtyard farmhouse:                            */
/*  plastered walls, barjeel wind tower, arcade (liwan), danchal beams, */
/*  stepped crenellations, carved doors, shutters and a majlis.         */
/* ------------------------------------------------------------------ */

const H = 4.6; // main block height
const X0 = -15;
const X1 = -3;
const Z0 = -10;
const Z1 = -2;
const T = 0.45; // wall thickness

function Wall({
  mat,
  position,
  rotation = 0,
  width,
  height,
  thickness = T,
  openings,
}: {
  mat: THREE.Material;
  position: Vec3;
  rotation?: number;
  width: number;
  height: number;
  thickness?: number;
  openings?: Opening[];
}) {
  const geo = useMemo(() => wallGeometry(width, height, thickness, openings ?? [], 0.03), [width, height, thickness, openings]);
  return <mesh geometry={geo} material={mat} position={position} rotation={[0, rotation, 0]} castShadow receiveShadow />;
}

function Slab({ mat, position, size, r = 0.05 }: { mat: THREE.Material; position: Vec3; size: Vec3; r?: number }) {
  const geo = useMemo(() => boxProjectUVs(roundedBox(size[0], size[1], size[2], r, 2).clone(), 0.5), [size, r]);
  return <mesh geometry={geo} material={mat} position={position} castShadow receiveShadow />;
}

/** Stepped triangular merlons (shurfa) along a line. */
function Merlons({ mat, from, to, y, spacing = 0.62, size = 0.42 }: { mat: THREE.Material; from: [number, number]; to: [number, number]; y: number; spacing?: number; size?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    const w = size;
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, w * 0.35);
    s.lineTo(w * 0.28, w * 0.35);
    s.lineTo(w * 0.28, w * 0.65);
    s.lineTo(w * 0.08, w * 0.65);
    s.lineTo(0, w * 0.95);
    s.lineTo(-w * 0.08, w * 0.65);
    s.lineTo(-w * 0.28, w * 0.65);
    s.lineTo(-w * 0.28, w * 0.35);
    s.lineTo(-w / 2, w * 0.35);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1 });
    g.translate(0, 0, -0.11);
    return boxProjectUVs(g, 0.5);
  }, [size]);
  const items = useMemo(() => {
    const a = new THREE.Vector2(...from);
    const b = new THREE.Vector2(...to);
    const len = a.distanceTo(b);
    const n = Math.max(1, Math.floor(len / spacing));
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    return Array.from({ length: n }, (_, i) => {
      const t = (i + 0.5) / n;
      return { x: a.x + (b.x - a.x) * t, z: a.y + (b.y - a.y) * t, rot: -ang };
    });
  }, [from, to, spacing]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    items.forEach((it, i) => {
      o.position.set(it.x, y, it.z);
      o.rotation.set(0, it.rot, 0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items, y]);
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} castShadow receiveShadow />;
}

/** Protruding mangrove-pole roof beams (danchal). */
function Danchal({ mat, from, to, y, out, spacing = 0.55 }: { mat: THREE.Material; from: [number, number]; to: [number, number]; y: number; out: [number, number]; spacing?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.075, 0.085, 0.7, 10, 1);
    g.rotateX(Math.PI / 2);
    return g;
  }, []);
  const items = useMemo(() => {
    const a = new THREE.Vector2(...from);
    const b = new THREE.Vector2(...to);
    const n = Math.max(1, Math.floor(a.distanceTo(b) / spacing));
    return Array.from({ length: n }, (_, i) => {
      const t = (i + 0.5) / n;
      return { x: a.x + (b.x - a.x) * t, z: a.y + (b.y - a.y) * t, j: Math.sin(i * 12.3) * 0.04 };
    });
  }, [from, to, spacing]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const ang = Math.atan2(out[0], out[1]);
    items.forEach((it, i) => {
      o.position.set(it.x + out[0] * 0.2, y + it.j, it.z + out[1] * 0.2);
      o.rotation.set(0, ang, 0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items, y, out]);
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} castShadow />;
}

/** Carved double door with iron studs, set into an arched opening. */
function Door({ m, position, rotation = 0, width = 1.5, height = 2.3, open = 0, archH = 0 }: { m: FarmMaterials; position: Vec3; rotation?: number; width?: number; height?: number; open?: number; archH?: number }) {
  const leafGeo = useMemo(() => boxProjectUVs(roundedBox(width / 2 - 0.02, height, 0.09, 0.015, 2).clone(), 0.8), [width, height]);
  const studRef = useRef<THREE.InstancedMesh>(null);
  const studs = useMemo(() => {
    const out: Vec3[] = [];
    for (const side of [-1, 1])
      for (let r = 0; r < 7; r++)
        for (let c = 0; c < 3; c++) out.push([side * (0.18 + c * ((width / 2 - 0.36) / 2)), 0.25 + r * ((height - 0.5) / 6), 0.055]);
    return out;
  }, [width, height]);
  useLayoutEffect(() => {
    const s = studRef.current;
    if (!s) return;
    const mt = new THREE.Matrix4();
    studs.forEach((p, i) => s.setMatrixAt(i, mt.makeTranslation(...p)));
    s.instanceMatrix.needsUpdate = true;
  }, [studs]);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (width / 2), 0, 0]} rotation={[0, side * open, 0]}>
          <mesh geometry={leafGeo} material={m.woodDark} position={[-side * (width / 4), height / 2, 0]} castShadow receiveShadow />
          {/* raised panels */}
          {[0.32, 0.7].map((f) => (
            <mesh key={f} position={[-side * (width / 4), height * f, 0.05]} castShadow>
              <boxGeometry args={[width / 2 - 0.22, height * 0.28, 0.03]} />
              <primitive object={m.woodDark} attach="material" />
            </mesh>
          ))}
        </group>
      ))}
      {open === 0 && (
        <instancedMesh ref={studRef} args={[undefined, undefined, studs.length]} castShadow>
          <sphereGeometry args={[0.022, 8, 6]} />
          <meshStandardMaterial color="#2a2420" metalness={0.8} roughness={0.4} />
        </instancedMesh>
      )}
      {archH > 0 && (
        <mesh position={[0, height + archH / 2 - 0.02, -0.02]}>
          <planeGeometry args={[width, archH]} />
          <meshStandardMaterial color="#2a1a10" roughness={1} />
        </mesh>
      )}
    </group>
  );
}

/** Window with teal shutters and a wooden lattice. */
function Window({ m, position, rotation = 0, w = 0.9, h = 1.2 }: { m: FarmMaterials; position: Vec3; rotation?: number; w?: number; h?: number }) {
  const bars = useMemo(() => {
    const out: { p: Vec3; s: Vec3 }[] = [];
    for (let i = 1; i < 6; i++) out.push({ p: [-w / 2 + (i * w) / 6, h / 2, 0], s: [0.03, h, 0.04] });
    for (let i = 1; i < 8; i++) out.push({ p: [0, (i * h) / 8, 0], s: [w, 0.03, 0.04] });
    return out;
  }, [w, h]);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, h / 2, -0.12]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#1a120c" roughness={1} />
      </mesh>
      {bars.map((b, i) => (
        <mesh key={i} position={b.p} castShadow>
          <boxGeometry args={b.s} />
          <primitive object={m.woodDark} attach="material" />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (w / 2 + 0.02), 0, 0.12]} rotation={[0, s * 1.15, 0]}>
          <mesh position={[s * (w / 4), h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[w / 2, h, 0.05]} />
            <primitive object={m.woodTeal} attach="material" />
          </mesh>
          {[0.25, 0.5, 0.75].map((f) => (
            <mesh key={f} position={[s * (w / 4), h * f, 0.03]}>
              <boxGeometry args={[w / 2 - 0.08, 0.025, 0.02]} />
              <meshStandardMaterial color="#4F8582" roughness={0.6} />
            </mesh>
          ))}
        </group>
      ))}
      {/* wooden lintel */}
      <mesh position={[0, h + 0.1, 0.05]} castShadow>
        <boxGeometry args={[w + 0.35, 0.16, 0.5]} />
        <primitive object={m.woodDark} attach="material" />
      </mesh>
    </group>
  );
}

/** Barjeel — the traditional wind tower that funnels breeze into the house. */
function Barjeel({ m, position }: { m: FarmMaterials; position: Vec3 }) {
  const S = 2.5;
  const lowerH = 2.3;
  const openH = 1.9;
  const postGeo = useMemo(() => boxProjectUVs(roundedBox(0.42, openH, 0.42, 0.04, 2).clone(), 0.5), []);
  const slats = useMemo(() => {
    const out: { p: Vec3; r: number }[] = [];
    for (let f = 0; f < 4; f++) {
      const r = (f * Math.PI) / 2;
      for (let i = 0; i < 6; i++) {
        const x = -S / 2 + 0.5 + (i * (S - 1)) / 5;
        const v = new THREE.Vector3(x, 0, S / 2 - 0.12).applyAxisAngle(new THREE.Vector3(0, 1, 0), r);
        out.push({ p: [v.x, lowerH + openH / 2, v.z], r });
      }
    }
    return out;
  }, []);
  return (
    <group position={position}>
      {/* solid lower shaft */}
      <Slab mat={m.plasterLight} position={[0, lowerH / 2, 0]} size={[S, lowerH, S]} r={0.06} />
      {/* string course */}
      <Slab mat={m.plasterLight} position={[0, lowerH + 0.06, 0]} size={[S + 0.18, 0.14, S + 0.18]} r={0.03} />
      {/* corner posts */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <mesh key={i} geometry={postGeo} material={m.plasterLight} position={[(sx * (S - 0.42)) / 2, lowerH + openH / 2, (sz * (S - 0.42)) / 2]} castShadow receiveShadow />
      ))}
      {/* inner X partitions that split the breeze */}
      {[Math.PI / 4, -Math.PI / 4].map((r) => (
        <mesh key={r} position={[0, lowerH + openH / 2, 0]} rotation={[0, r, 0]} castShadow receiveShadow>
          <boxGeometry args={[S * 1.25, openH, 0.12]} />
          <primitive object={m.plaster} attach="material" />
        </mesh>
      ))}
      {/* slatted openings */}
      {slats.map((s, i) => (
        <mesh key={i} position={s.p} rotation={[0, s.r, 0]} castShadow>
          <boxGeometry args={[0.06, openH, 0.08]} />
          <primitive object={m.woodDark} attach="material" />
        </mesh>
      ))}
      {/* cornice + cap */}
      <Slab mat={m.plasterLight} position={[0, lowerH + openH + 0.12, 0]} size={[S + 0.3, 0.24, S + 0.3]} r={0.05} />
      <Slab mat={m.plasterLight} position={[0, lowerH + openH + 0.3, 0]} size={[S + 0.1, 0.14, S + 0.1]} r={0.03} />
      <Merlons mat={m.plasterLight} from={[-S / 2, -S / 2]} to={[S / 2, -S / 2]} y={lowerH + openH + 0.37} spacing={0.5} size={0.36} />
      <Merlons mat={m.plasterLight} from={[-S / 2, S / 2]} to={[S / 2, S / 2]} y={lowerH + openH + 0.37} spacing={0.5} size={0.36} />
      <Merlons mat={m.plasterLight} from={[-S / 2, -S / 2]} to={[-S / 2, S / 2]} y={lowerH + openH + 0.37} spacing={0.5} size={0.36} />
      <Merlons mat={m.plasterLight} from={[S / 2, -S / 2]} to={[S / 2, S / 2]} y={lowerH + openH + 0.37} spacing={0.5} size={0.36} />
      {/* danchal poles bracing the tower */}
      <Danchal mat={m.danchal} from={[-S / 2, S / 2]} to={[S / 2, S / 2]} y={lowerH - 0.25} out={[0, 1]} spacing={0.6} />
      <Danchal mat={m.danchal} from={[S / 2, -S / 2]} to={[S / 2, S / 2]} y={lowerH - 0.25} out={[1, 0]} spacing={0.6} />
    </group>
  );
}

export function Farmhouse({ m, lit }: { m: FarmMaterials; lit: boolean }) {
  const W = X1 - X0;
  const D = Z1 - Z0;
  const cx = (X0 + X1) / 2;

  const frontOpenings: Opening[] = useMemo(
    () => [
      { x: 0, y: 0, w: 1.7, h: 3.0, kind: 'round' },
      { x: -3.6, y: 1.05, w: 0.95, h: 1.25, kind: 'flat' },
      { x: 3.6, y: 1.05, w: 0.95, h: 1.25, kind: 'flat' },
    ],
    [],
  );
  const sideOpenings: Opening[] = useMemo(() => [{ x: 0, y: 1.1, w: 0.9, h: 1.2, kind: 'flat' }], []);
  const backOpenings: Opening[] = useMemo(
    () => [
      { x: -3.5, y: 2.6, w: 0.6, h: 0.7, kind: 'flat' },
      { x: 0, y: 2.6, w: 0.6, h: 0.7, kind: 'flat' },
      { x: 3.5, y: 2.6, w: 0.6, h: 0.7, kind: 'flat' },
    ],
    [],
  );
  const arcadeOpenings: Opening[] = useMemo(() => [-4.4, -2.2, 0, 2.2, 4.4].map((x) => ({ x, y: 0, w: 1.62, h: 2.85, kind: 'round' as const })), []);
  const gateOpening: Opening[] = useMemo(() => [{ x: 0, y: 0, w: 2.2, h: 2.55, kind: 'round' }], []);

  return (
    <group>
      {/* ---------------- Main block ---------------- */}
      <Wall mat={m.plaster} position={[cx, 0, Z1 - T / 2]} width={W} height={H} openings={frontOpenings} />
      <Wall mat={m.plaster} position={[cx, 0, Z0 + T / 2]} width={W} height={H} openings={backOpenings} />
      <Wall mat={m.plaster} position={[X0 + T / 2, 0, (Z0 + Z1) / 2]} rotation={Math.PI / 2} width={D - T * 2} height={H} openings={sideOpenings} />
      <Wall mat={m.plaster} position={[X1 - T / 2, 0, (Z0 + Z1) / 2]} rotation={Math.PI / 2} width={D - T * 2} height={H} openings={sideOpenings} />
      {/* interior darkness + floor */}
      <mesh position={[cx, 0.26, (Z0 + Z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W - 0.8, D - 0.8]} />
        <meshStandardMaterial color="#3A2C20" roughness={1} />
      </mesh>
      {/* plinth */}
      <Slab mat={m.stone} position={[cx, 0.12, (Z0 + Z1) / 2]} size={[W + 0.25, 0.24, D + 0.25]} r={0.04} />
      {/* roof slab + parapet */}
      <Slab mat={m.plasterLight} position={[cx, H + 0.12, (Z0 + Z1) / 2]} size={[W + 0.3, 0.26, D + 0.3]} r={0.05} />
      <Slab mat={m.plasterLight} position={[cx, H + 0.48, Z1 + 0.02]} size={[W + 0.3, 0.5, 0.3]} r={0.04} />
      <Slab mat={m.plasterLight} position={[cx, H + 0.48, Z0 - 0.02]} size={[W + 0.3, 0.5, 0.3]} r={0.04} />
      <Slab mat={m.plasterLight} position={[X0 - 0.02, H + 0.48, (Z0 + Z1) / 2]} size={[0.3, 0.5, D + 0.3]} r={0.04} />
      <Slab mat={m.plasterLight} position={[X1 + 0.02, H + 0.48, (Z0 + Z1) / 2]} size={[0.3, 0.5, D + 0.3]} r={0.04} />
      <Merlons mat={m.plasterLight} from={[X0, Z1 + 0.02]} to={[X1, Z1 + 0.02]} y={H + 0.72} />
      <Merlons mat={m.plasterLight} from={[X0, Z0 - 0.02]} to={[X1, Z0 - 0.02]} y={H + 0.72} />
      <Merlons mat={m.plasterLight} from={[X0 - 0.02, Z0]} to={[X0 - 0.02, Z1]} y={H + 0.72} />
      <Merlons mat={m.plasterLight} from={[X1 + 0.02, Z0]} to={[X1 + 0.02, Z1]} y={H + 0.72} />
      {/* decorative recessed band under the parapet */}
      <Slab mat={m.plaster} position={[cx, H - 0.55, Z1 + 0.04]} size={[W - 0.4, 0.12, 0.1]} r={0.02} />
      {/* danchal beams */}
      <Danchal mat={m.danchal} from={[X0 + 0.3, Z0]} to={[X1 - 0.3, Z0]} y={H - 0.2} out={[0, -1]} />
      <Danchal mat={m.danchal} from={[X0, Z0 + 0.4]} to={[X0, Z1 - 0.4]} y={H - 0.2} out={[-1, 0]} />
      <Danchal mat={m.danchal} from={[X1, Z0 + 0.4]} to={[X1, Z1 - 0.4]} y={H - 0.2} out={[1, 0]} />
      {/* roof water spouts (marzam) */}
      {[-12, -6].map((x) => (
        <mesh key={x} position={[x, H + 0.15, Z0 - 0.55]} rotation={[Math.PI / 2 - 0.12, 0, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.9, 10, 1, true, 0, Math.PI]} />
          <primitive object={m.woodDark} attach="material" />
        </mesh>
      ))}

      {/* Barjeel on the north-east corner */}
      <Barjeel m={m} position={[-5.1, H + 0.25, -7.9]} />

      {/* Front door + windows */}
      <Door m={m} position={[cx, 0.24, Z1 - T / 2 - 0.08]} width={1.62} height={2.15} archH={0.8} />
      <Window m={m} position={[cx - 3.6, 1.05, Z1 - 0.1]} w={0.95} h={1.25} />
      <Window m={m} position={[cx + 3.6, 1.05, Z1 - 0.1]} w={0.95} h={1.25} />
      <Window m={m} position={[X0 - 0.05, 1.1, (Z0 + Z1) / 2]} rotation={-Math.PI / 2} />
      <Window m={m} position={[X1 + 0.05, 1.1, (Z0 + Z1) / 2]} rotation={Math.PI / 2} />

      {/* ---------------- Arcade (liwan) ---------------- */}
      <Wall mat={m.plasterLight} position={[cx, 0, -0.55]} width={11.4} height={3.55} thickness={0.42} openings={arcadeOpenings} />
      <Slab mat={m.plasterLight} position={[cx, 3.68, -1.2]} size={[11.7, 0.26, 1.75]} r={0.04} />
      <Merlons mat={m.plasterLight} from={[cx - 5.7, -0.4]} to={[cx + 5.7, -0.4]} y={3.82} spacing={0.58} size={0.36} />
      <Danchal mat={m.danchal} from={[cx - 5.5, -0.4]} to={[cx + 5.5, -0.4]} y={3.45} out={[0, 1]} spacing={0.6} />
      {/* arcade floor */}
      <mesh position={[cx, 0.03, -1.25]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[11.4, 1.5]} />
        <primitive object={m.stone} attach="material" />
      </mesh>

      {/* ---------------- Courtyard ---------------- */}
      <Wall mat={m.plaster} position={[X0 + 0.2, 0, 2.2]} rotation={Math.PI / 2} width={8.4} height={2.7} thickness={0.4} />
      <Wall mat={m.plaster} position={[X1 - 0.2, 0, 2.2]} rotation={Math.PI / 2} width={8.4} height={2.7} thickness={0.4} />
      <Wall mat={m.plaster} position={[cx, 0, 6.4]} width={W} height={2.7} thickness={0.4} openings={gateOpening} />
      <Merlons mat={m.plasterLight} from={[X0 + 0.2, -2]} to={[X0 + 0.2, 6.4]} y={2.7} spacing={0.6} size={0.34} />
      <Merlons mat={m.plasterLight} from={[X1 - 0.2, -2]} to={[X1 - 0.2, 6.4]} y={2.7} spacing={0.6} size={0.34} />
      <Merlons mat={m.plasterLight} from={[X0, 6.4]} to={[cx - 1.4, 6.4]} y={2.7} spacing={0.6} size={0.34} />
      <Merlons mat={m.plasterLight} from={[cx + 1.4, 6.4]} to={[X1, 6.4]} y={2.7} spacing={0.6} size={0.34} />
      {/* gate doors, swung open */}
      <Door m={m} position={[cx, 0.02, 6.62]} width={2.1} height={1.95} open={1.25} />
      {/* courtyard paving */}
      <mesh position={[cx, 0.025, 3.0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W - 0.8, 6.2]} />
        <primitive object={m.stone} attach="material" />
      </mesh>

      {/* Majlis */}
      <Rug position={[-12.2, 0.045, 2.9]} size={[3.2, 4.2]} rotation={Math.PI / 2} />
      <MajlisSeating position={[-14.25, 0.03, 2.9]} length={4.2} rotation={Math.PI / 2} />
      <MajlisSeating position={[-12.2, 0.03, 5.6]} length={2.8} rotation={Math.PI} colorIndex={2} />
      <CoffeeTray position={[-12.1, 0.05, 2.7]} rotation={0.4} />

      {/* Firepit */}
      <group position={[-7.4, 0, 3.4]}>
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.62, 0.12, Math.sin(a) * 0.62]} rotation={[0, -a, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.24, 0.24, 0.3]} />
              <primitive object={m.stone} attach="material" />
            </mesh>
          );
        })}
        {[0, 1.1, 2.2].map((r) => (
          <mesh key={r} position={[0, 0.1, 0]} rotation={[0.3, r, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.06, 0.07, 0.8, 8]} />
            <meshStandardMaterial color="#3a2618" roughness={1} />
          </mesh>
        ))}
        <mesh position={[0, 0.05, 0]}>
          <sphereGeometry args={[0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#2b130a" emissive="#ff6a1a" emissiveIntensity={lit ? 3 : 0.6} roughness={1} />
        </mesh>
        {lit && <pointLight position={[0, 0.6, 0]} color="#ff8a3a" intensity={6} distance={9} decay={2} />}
      </group>

      {/* Lanterns at the door and gate */}
      <Lantern position={[cx - 1.25, 2.25, Z1 + 0.15]} lit={lit} light={lit} />
      <Lantern position={[cx + 1.25, 2.25, Z1 + 0.15]} lit={lit} />
      <Lantern position={[cx - 1.5, 2.2, 6.8]} lit={lit} light={lit} />
      <Lantern position={[cx + 1.5, 2.2, 6.8]} lit={lit} />
      <Lantern position={[-12.2, 3.0, -1.2]} hanging lit={lit} light={lit} />

      {/* Potted plants in the courtyard corners */}
      {(
        [
          [-14.3, 0, -0.1],
          [-3.7, 0, -0.1],
          [-3.8, 0, 5.8],
        ] as Vec3[]
      ).map((p, i) => (
        <group key={i} position={p}>
          <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.32, 0.24, 0.6, 24]} />
            <primitive object={m.terracotta} attach="material" />
          </mesh>
          <mesh position={[0, 0.85, 0]} castShadow>
            <icosahedronGeometry args={[0.45, 3]} />
            <meshStandardMaterial color={i === 2 ? '#C2387A' : '#4C6B37'} roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
