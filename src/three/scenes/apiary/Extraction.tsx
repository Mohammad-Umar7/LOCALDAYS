import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { boxProjectUVs, roundedBox, smoothLathe, tubeAlong } from '../../props/geo';
import type { Quality, Vec3 } from '../../core/types';
import { grainBox, type ApiaryMaterials } from './materials';
import { HONEY, JAR_H, Jars, type JarItem } from './Jars';
import { groundY, HIVE, SHED } from './layout';

/* ------------------------------------------------------------------ */
/*  Honey processing room: an open-fronted, white-rendered shed with   */
/*  a corrugated mono-pitch roof. Inside: a hand-crank stainless       */
/*  extractor, uncapping tank, settling tank filling jars, food-grade  */
/*  buckets, shelving with supers, a sink — behind a glass clean line. */
/* ------------------------------------------------------------------ */

const { w: SW, d: SD } = SHED;
const FLOOR = 0.15;
const H_FRONT = 3.15;
const H_BACK = 2.7;
const T = 0.2;

function B({ geo, mat, p, r, cast = true }: { geo: THREE.BufferGeometry; mat: THREE.Material; p: Vec3; r?: Vec3; cast?: boolean }) {
  return <mesh geometry={geo} material={mat} position={p} rotation={r} castShadow={cast} receiveShadow />;
}

function sideWallGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-SD / 2, 0);
  s.lineTo(SD / 2, 0);
  s.lineTo(SD / 2, H_FRONT + 0.1);
  s.lineTo(-SD / 2, H_BACK + 0.1);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: T - 0.04, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
  // shape (x→z, y→y), extrude along x
  g.rotateY(-Math.PI / 2);
  g.translate((T - 0.04) / 2, 0, 0);
  boxProjectUVs(g, 0.5);
  return g;
}

function corrugatedRoof(w: number, d: number) {
  const g = new THREE.PlaneGeometry(w, d, 140, 2);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    p.setY(i, Math.sin((x / 0.076) * Math.PI * 2) * 0.012);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Hand-crank radial extractor with honey gate, strainer and bucket.
 * The drum never moves: the crank turns flat on top of the gearbox (vertical
 * spindle, so it can never sweep into the lid) and drives the frame basket at a
 * 1:4 gear ratio. The front half-lid is off, as it would be mid-extraction, so
 * the spinning frames are visible.
 */
function Extractor({ m, position, active }: { m: ApiaryMaterials; position: Vec3; active: boolean }) {
  const crank = useRef<THREE.Group>(null);
  const basket = useRef<THREE.Group>(null);
  const drum = useMemo(
    () =>
      smoothLathe(
        [
          [0.001, 0.0],
          [0.12, 0.02],
          [0.3, 0.1],
          [0.32, 0.14],
          [0.32, 0.66],
          [0.335, 0.69],
          [0.32, 0.7],
          [0.305, 0.69],
          [0.305, 0.16],
          [0.285, 0.12],
          [0.11, 0.05],
          [0.001, 0.04],
        ],
        48,
        48,
      ),
    [],
  );
  // Half-lids sit on the rolled rim; a small lip keeps them from z-fighting the bridge
  const lidHalf = useMemo(() => {
    const g = new THREE.CircleGeometry(0.322, 32, 0, Math.PI);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const lidHinge = useMemo(() => roundedBox(0.62, 0.012, 0.02, 0.004, 2), []);
  const bucket = useMemo(() => smoothLathe([[0.001, 0], [0.135, 0], [0.14, 0.01], [0.155, 0.32], [0.163, 0.33], [0.16, 0.345], [0.15, 0.335], [0.142, 0.02], [0.001, 0.018]], 32, 24), []);
  const legGeo = useMemo(() => roundedBox(0.035, 0.46, 0.035, 0.006, 2), []);
  // Basket: four radial shallow frames on a central axle with top and bottom spider rings
  const frameBar = useMemo(() => roundedBox(0.24, 0.014, 0.022, 0.003, 1), []);
  const frameSide = useMemo(() => roundedBox(0.012, 0.2, 0.026, 0.003, 1), []);
  const combPanel = useMemo(() => new THREE.BoxGeometry(0.22, 0.17, 0.016), []);
  const spin = useRef(0);
  useFrame((_, dt) => {
    const step = (active ? 2.4 : 0) * Math.min(dt, 0.05);
    spin.current += step;
    if (crank.current) crank.current.rotation.y = -spin.current;
    if (basket.current) basket.current.rotation.y = spin.current * 4;
  });
  return (
    <group position={position}>
      {[0, 1, 2].map((k) => {
        const a = (k / 3) * Math.PI * 2 + Math.PI / 6;
        return <B key={k} geo={legGeo} mat={m.stainless} p={[Math.cos(a) * 0.29, 0.23, Math.sin(a) * 0.29]} />;
      })}
      <group position={[0, 0.42, 0]}>
        <mesh geometry={drum} material={m.stainless} castShadow receiveShadow />
        {/* frame basket inside the drum (spins only while extracting) */}
        <group ref={basket} position={[0, 0.51, 0]} userData={{ noBatch: true }}>
          <mesh material={m.stainless} castShadow>
            <cylinderGeometry args={[0.012, 0.012, 0.42, 10]} />
          </mesh>
          {[0.13, -0.13].map((y) => (
            <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.stainless}>
              <torusGeometry args={[0.27, 0.006, 6, 40]} />
            </mesh>
          ))}
          {[0, 1, 2, 3].map((k) => (
            <group key={k} rotation={[0, (k * Math.PI) / 2, 0]}>
              <group position={[0.15, 0, 0]}>
                <mesh geometry={frameBar} material={m.timberGrey} position={[0, 0.1, 0]} castShadow />
                <mesh geometry={frameBar} material={m.timberGrey} position={[0, -0.1, 0]} />
                <mesh geometry={frameSide} material={m.timberGrey} position={[0.115, 0, 0]} />
                <mesh geometry={frameSide} material={m.timberGrey} position={[-0.115, 0, 0]} />
                <mesh geometry={combPanel} material={m.comb} rotation={[0, 0, Math.PI / 2]} scale={[0.85, 1.3, 1]} />
              </group>
            </group>
          ))}
        </group>
        {/* back half-lid closed under the bridge; the front half is off */}
        <mesh geometry={lidHalf} material={m.stainless} position={[0, 0.703, 0]} castShadow />
        <mesh geometry={lidHinge} material={m.stainless} position={[0, 0.708, 0]} castShadow />
        {/* bridge, gearbox and a crank that turns flat on top */}
        <B geo={roundedBox(0.68, 0.025, 0.05, 0.006, 2)} mat={m.stainless} p={[0, 0.725, 0]} />
        <B geo={roundedBox(0.13, 0.1, 0.1, 0.02, 3)} mat={m.blackPlastic} p={[0, 0.79, 0]} />
        <group ref={crank} position={[0, 0.84, 0]} userData={{ noBatch: true }}>
          {/* spindle cap, arm and a turned wooden knob standing up */}
          <mesh material={m.stainless} castShadow>
            <cylinderGeometry args={[0.022, 0.022, 0.03, 16]} />
          </mesh>
          <B geo={roundedBox(0.19, 0.014, 0.03, 0.006, 2)} mat={m.stainless} p={[0.09, 0.022, 0]} />
          <mesh position={[0.175, 0.07, 0]} castShadow material={m.timberDark}>
            <cylinderGeometry args={[0.017, 0.019, 0.09, 12]} />
          </mesh>
        </group>
        {/* honey gate */}
        <group position={[0, 0.06, 0.31]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.03]} castShadow material={m.stainless}>
            <cylinderGeometry args={[0.028, 0.028, 0.07, 16]} />
          </mesh>
          <B geo={roundedBox(0.07, 0.07, 0.05, 0.01, 2)} mat={m.whitePlastic} p={[0, -0.01, 0.075]} />
          <B geo={roundedBox(0.02, 0.1, 0.02, 0.006, 2)} mat={m.blackPlastic} p={[0, 0.07, 0.085]} r={[-0.4, 0, 0]} />
        </group>
      </group>
      {/* bucket with a double strainer catching the honey stream */}
      <group position={[0, 0, 0.42]}>
        <mesh geometry={bucket} material={m.whitePlastic} castShadow receiveShadow />
        <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.honeyStream}>
          <circleGeometry args={[0.15, 28]} />
        </mesh>
        <mesh position={[0, 0.355, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow material={m.stainless}>
          <torusGeometry args={[0.165, 0.008, 6, 32]} />
        </mesh>
        <mesh position={[0, 0.3, 0]} material={m.stainless}>
          <cylinderGeometry args={[0.15, 0.12, 0.1, 24, 1, true]} />
        </mesh>
        <mesh position={[0, 0.405, -0.035]} material={m.honeyStream} castShadow>
          <cylinderGeometry args={[0.0045, 0.006, 0.1, 8]} />
        </mesh>
      </group>
    </group>
  );
}

function UncappingTank({ m, position }: { m: ApiaryMaterials; position: Vec3 }) {
  const comb = useMemo(() => new THREE.BoxGeometry(0.43, 0.2, 0.03), []);
  const cappings = useMemo(() => {
    const out: { p: Vec3; s: Vec3; r: number }[] = [];
    let s = 7;
    const r = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    for (let i = 0; i < 26; i++) out.push({ p: [(r() - 0.5) * 0.8, 0.27 + r() * 0.05, (r() - 0.5) * 0.34], s: [0.06 + r() * 0.06, 0.02 + r() * 0.03, 0.05 + r() * 0.05], r: r() * 3 });
    return out;
  }, []);
  return (
    <group position={position}>
      {[-1, 1].map((sx) => [-1, 1].map((sz) => <B key={`${sx}${sz}`} geo={roundedBox(0.035, 0.48, 0.035, 0.006, 2)} mat={m.stainless} p={[sx * 0.49, 0.24, sz * 0.2]} />))}
      <group position={[0, 0.46, 0]}>
        {/* tank walls */}
        <B geo={roundedBox(1.06, 0.36, 0.02, 0.006, 2)} mat={m.stainless} p={[0, 0.18, 0.24]} />
        <B geo={roundedBox(1.06, 0.36, 0.02, 0.006, 2)} mat={m.stainless} p={[0, 0.18, -0.24]} />
        <B geo={roundedBox(0.02, 0.36, 0.46, 0.006, 2)} mat={m.stainless} p={[0.52, 0.18, 0]} />
        <B geo={roundedBox(0.02, 0.36, 0.46, 0.006, 2)} mat={m.stainless} p={[-0.52, 0.18, 0]} />
        <B geo={roundedBox(1.02, 0.02, 0.46, 0.006, 2)} mat={m.stainless} p={[0, 0.01, 0]} />
        {cappings.map((c, i) => (
          <mesh key={i} position={c.p} scale={c.s} rotation={[0, c.r, 0]} material={m.wax}>
            <sphereGeometry args={[1, 10, 6]} />
          </mesh>
        ))}
        {/* frame rest bar + a capped frame standing ready */}
        <B geo={grainBox(0.06, 0.04, 0.5, 0.008, 1.5)} mat={m.timber} p={[0.1, 0.38, 0]} />
        <group position={[0.1, 0.56, 0]} rotation={[0, 0.25, 0]}>
          <B geo={grainBox(0.483, 0.019, 0.025, 0.003, 2)} mat={m.timberGrey} p={[0, 0.115, 0]} />
          <B geo={grainBox(0.009, 0.22, 0.033, 0.002, 2)} mat={m.timberGrey} p={[-0.214, 0, 0]} />
          <B geo={grainBox(0.009, 0.22, 0.033, 0.002, 2)} mat={m.timberGrey} p={[0.214, 0, 0]} />
          <B geo={grainBox(0.437, 0.01, 0.02, 0.002, 2)} mat={m.timberGrey} p={[0, -0.11, 0]} />
          <mesh geometry={comb} material={m.comb} castShadow receiveShadow />
        </group>
        {/* uncapping fork */}
        <group position={[-0.3, 0.37, 0.25]} rotation={[0, 0.3, 0]}>
          <B geo={roundedBox(0.12, 0.022, 0.03, 0.008, 2)} mat={m.blackPlastic} p={[-0.06, 0, 0]} />
          {[-0.01, -0.0033, 0.0033, 0.01].map((z) => (
            <B key={z} geo={roundedBox(0.09, 0.003, 0.003, 0.001, 1)} mat={m.stainless} p={[0.045, 0, z * 2.4]} cast={false} />
          ))}
        </group>
      </group>
    </group>
  );
}

function Pail({ m, position, lid = true, honey = false }: { m: ApiaryMaterials; position: Vec3; lid?: boolean; honey?: boolean }) {
  const body = useMemo(() => smoothLathe([[0.001, 0], [0.135, 0], [0.14, 0.01], [0.155, 0.32], [0.163, 0.33], [0.16, 0.345], [0.15, 0.335], [0.142, 0.02], [0.001, 0.018]], 32, 24), []);
  const handle = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI;
      pts.push(new THREE.Vector3(Math.cos(a) * 0.165, 0.31 + Math.sin(a) * 0.09, 0));
    }
    return tubeAlong(pts, 0.003, 4);
  }, []);
  return (
    <group position={position}>
      <mesh geometry={body} material={m.whitePlastic} castShadow receiveShadow />
      <mesh geometry={handle} material={m.stainless} rotation={[0.5, 0, 0]} castShadow />
      {lid && (
        <mesh position={[0, 0.35, 0]} castShadow receiveShadow material={m.whitePlastic}>
          <cylinderGeometry args={[0.168, 0.168, 0.025, 32]} />
        </mesh>
      )}
      {!lid && honey && (
        <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.honeyStream}>
          <circleGeometry args={[0.15, 28]} />
        </mesh>
      )}
    </group>
  );
}

function SettlingTank({ m, position, quality }: { m: ApiaryMaterials; position: Vec3; quality: Quality }) {
  const tank = useMemo(() => smoothLathe([[0.001, 0], [0.26, 0.0], [0.28, 0.03], [0.28, 0.6], [0.29, 0.62], [0.001, 0.62]], 40, 16), []);
  const jars: JarItem[] = useMemo(() => {
    const out: JarItem[] = [];
    const top = 0.44 + 0.015;
    out.push({ p: [0, top, 0.33], honey: HONEY.wild, lid: -1, label: false });
    for (let i = 0; i < 8; i++) out.push({ p: [0.24 + (i % 4) * 0.1, top, 0.2 + Math.floor(i / 4) * 0.12], honey: i % 3 === 0 ? HONEY.sidr : HONEY.wild, lid: 0 });
    for (let i = 0; i < 6; i++) out.push({ p: [-0.25 - (i % 3) * 0.1, top, 0.2 + Math.floor(i / 3) * 0.12], honey: HONEY.creamed, lid: 3 });
    return out;
  }, []);
  return (
    <group position={position}>
      {[-1, 1].map((sx) => [-1, 1].map((sz) => <B key={`${sx}${sz}`} geo={roundedBox(0.035, 0.62, 0.035, 0.006, 2)} mat={m.stainless} p={[sx * 0.2, 0.31, sz * 0.2]} />))}
      <B geo={roundedBox(0.5, 0.02, 0.5, 0.006, 2)} mat={m.stainless} p={[0, 0.62, 0]} />
      <group position={[0, 0.63, 0]}>
        <mesh geometry={tank} material={m.stainless} castShadow receiveShadow />
        <mesh position={[0, 0.635, 0]} castShadow material={m.stainless}>
          <cylinderGeometry args={[0.24, 0.29, 0.03, 40]} />
        </mesh>
        <mesh position={[0, 0.66, 0]} castShadow material={m.stainless}>
          <torusGeometry args={[0.05, 0.01, 8, 20]} />
        </mesh>
      </group>
      {/* gate + stream into the jar on the bottling table */}
      <group position={[0, 0.69, 0.3]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow material={m.stainless}>
          <cylinderGeometry args={[0.026, 0.026, 0.08, 16]} />
        </mesh>
        <B geo={roundedBox(0.07, 0.07, 0.05, 0.01, 2)} mat={m.whitePlastic} p={[0, -0.015, 0.045]} />
        <B geo={roundedBox(0.02, 0.1, 0.02, 0.006, 2)} mat={m.blackPlastic} p={[0, 0.06, 0.06]} r={[-0.5, 0, 0]} />
      </group>
      <mesh position={[0, 0.455 + JAR_H + 0.07, 0.33]} material={m.honeyStream}>
        <cylinderGeometry args={[0.004, 0.0055, 0.15, 8]} />
      </mesh>
      {/* bottling table */}
      <B geo={roundedBox(1.1, 0.03, 0.5, 0.008, 2)} mat={m.stainless} p={[0, 0.44, 0.3]} />
      {[-0.52, 0.52].map((x) => [0.08, 0.52].map((z) => <B key={`${x}${z}`} geo={roundedBox(0.03, 0.44, 0.03, 0.005, 2)} mat={m.stainless} p={[x, 0.22, z]} />))}
      <Jars items={jars} m={m} quality={quality} shadows />
    </group>
  );
}

function Shelving({ m, position, rotation }: { m: ApiaryMaterials; position: Vec3; rotation: number }) {
  const levels = [0.3, 0.85, 1.4, 1.95];
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {[-0.85, 0.85].map((x) => [-0.2, 0.2].map((z) => <B key={`${x}${z}`} geo={roundedBox(0.03, 2.2, 0.03, 0.005, 2)} mat={m.galvanised} p={[x, 1.1, z]} />))}
      {levels.map((y) => (
        <B key={y} geo={roundedBox(1.76, 0.025, 0.44, 0.005, 2)} mat={m.galvanised} p={[0, y, 0]} />
      ))}
      {/* stacked spare supers */}
      {[0, 1, 2].map((i) => (
        <B key={i} geo={grainBox(HIVE.L, HIVE.medium - 0.004, HIVE.W, 0.005, 1.3)} mat={m.paints[(i * 2 + 1) % m.paints.length]} p={[-0.45, 0.31 + HIVE.medium / 2 + i * HIVE.medium, 0]} />
      ))}
      {[0, 1].map((i) => (
        <B key={i} geo={grainBox(HIVE.L, HIVE.medium - 0.004, HIVE.W, 0.005, 1.3)} mat={m.paints[(i + 4) % m.paints.length]} p={[0.42, 0.31 + HIVE.medium / 2 + i * HIVE.medium, 0]} />
      ))}
      {/* frames standing in a row */}
      {Array.from({ length: 9 }, (_, i) => (
        <group key={i} position={[-0.55 + i * 0.045, 0.865 + 0.08, 0]} rotation={[0, Math.PI / 2, 0]}>
          <B geo={grainBox(0.36, 0.016, 0.022, 0.003, 2)} mat={m.timberGrey} p={[0, 0.07, 0]} />
          <mesh position={[0, -0.005, 0]} material={i % 3 === 0 ? m.wax : m.comb} castShadow>
            <boxGeometry args={[0.33, 0.13, 0.02]} />
          </mesh>
        </group>
      ))}
      {/* boxes of lids and a crate */}
      <B geo={roundedBox(0.42, 0.22, 0.32, 0.01, 2)} mat={m.timberGrey} p={[0.5, 0.865 + 0.11, 0]} />
      <B geo={roundedBox(0.5, 0.26, 0.36, 0.01, 2)} mat={m.whitePlastic} p={[-0.4, 1.415 + 0.13, 0]} />
      <B geo={roundedBox(0.36, 0.18, 0.3, 0.01, 2)} mat={m.timber} p={[0.45, 1.415 + 0.09, 0]} />
    </group>
  );
}

function Sink({ m, position }: { m: ApiaryMaterials; position: Vec3 }) {
  const tap = useMemo(() => tubeAlong([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.22, 0), new THREE.Vector3(0, 0.28, 0.08), new THREE.Vector3(0, 0.22, 0.17)], 0.012, 8), []);
  return (
    <group position={position}>
      <B geo={roundedBox(0.9, 0.86, 0.55, 0.01, 2)} mat={m.stainless} p={[0, 0.43, 0]} />
      <B geo={roundedBox(0.6, 0.02, 0.38, 0.01, 2)} mat={m.darkInterior} p={[0, 0.865, 0.03]} cast={false} />
      <mesh geometry={tap} material={m.stainless} position={[0, 0.87, -0.2]} castShadow />
      <B geo={roundedBox(0.9, 0.5, 0.012, 0.004, 2)} mat={m.ceramic} p={[0, 1.12, -0.27]} cast={false} />
      <B geo={roundedBox(0.26, 0.32, 0.12, 0.02, 2)} mat={m.whitePlastic} p={[0.62, 1.35, -0.22]} />
    </group>
  );
}

/** Outside the shed: spare supers stacked on a pallet and a rain barrel under the downpipe. */
function ShedYard({ m }: { m: ApiaryMaterials }) {
  const barrel = useMemo(() => smoothLathe([[0.001, 0], [0.26, 0], [0.28, 0.06], [0.29, 0.45], [0.28, 0.84], [0.26, 0.9], [0.001, 0.9]], 32, 24), []);
  const stacks = [
    { x: 0, z: 0, n: 4, p0: 0 },
    { x: 0, z: 0.56, n: 3, p0: 2 },
  ];
  return (
    <group>
      <group position={[SW / 2 + 0.85, 0, 0.9]} rotation={[0, 0.08, 0]}>
        {/* pallet */}
        {[-0.45, 0, 0.45].map((x) => (
          <B key={x} geo={grainBox(0.1, 0.09, 1.2, 0.01, 1.3)} mat={m.timberGrey} p={[x, 0.045, 0.28]} />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <B key={i} geo={grainBox(1.0, 0.022, 0.12, 0.004, 1.3)} mat={m.timberGrey} p={[0, 0.101, -0.28 + i * 0.187]} />
        ))}
        {stacks.map((st, si) =>
          Array.from({ length: st.n }, (_, k) => (
            <B
              key={`${si}${k}`}
              geo={grainBox(HIVE.W, HIVE.medium - 0.003, HIVE.L, 0.005, 1.3)}
              mat={m.paints[(st.p0 + k * 3) % m.paints.length]}
              p={[st.x + (k % 2) * 0.012, 0.112 + HIVE.medium / 2 + k * HIVE.medium, st.z + (k % 2) * 0.01 - 0.0]}
              r={[0, (k % 3) * 0.015 - 0.015, 0]}
            />
          )),
        )}
        <B geo={roundedBox(HIVE.W + 0.05, 0.06, HIVE.L + 0.05, 0.008, 2)} mat={m.hiveTop} p={[0, 0.112 + 4 * HIVE.medium + 0.03, 0]} />
      </group>
      <group position={[SW / 2 + 0.38, 0, -SD / 2 - 0.42]}>
        <mesh geometry={barrel} material={m.barrel} castShadow receiveShadow />
        <mesh position={[0, 0.905, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.blackPlastic}>
          <circleGeometry args={[0.25, 24]} />
        </mesh>
      </group>
    </group>
  );
}

export function Extraction({ m, quality, lit, active }: { m: ApiaryMaterials; quality: Quality; lit: boolean; active: boolean }) {
  const gy = useMemo(() => {
    let lo = Infinity;
    for (const sx of [-1, 0, 1]) for (const sz of [-1, 0, 1]) lo = Math.min(lo, groundY(SHED.x + (sx * SW) / 2, SHED.z + (sz * SD) / 2));
    return lo;
  }, []);
  const side = useMemo(() => sideWallGeometry(), []);
  const back = useMemo(() => boxProjectUVs(roundedBox(SW, H_BACK + 0.1, T, 0.02, 2).clone(), 0.5), []);
  const slab = useMemo(() => boxProjectUVs(roundedBox(SW + 0.4, 0.4, SD + 0.5, 0.04, 2).clone(), 0.4), []);
  const pitch = Math.atan2(H_FRONT - H_BACK, SD);
  const roofLen = (SD + 0.9) / Math.cos(pitch);
  const roof = useMemo(() => corrugatedRoof(SW + 0.7, roofLen), [roofLen]);
  const roofMat = useMemo(() => {
    const r = m.galvanised.clone();
    r.side = THREE.DoubleSide;
    return r;
  }, [m]);
  const roofY = (H_FRONT + H_BACK) / 2 + 0.11;
  const lamp = useMemo(() => {
    const mt = m.lamp.clone();
    mt.emissiveIntensity = lit ? 3.2 : 0.5;
    return mt;
  }, [m, lit]);
  return (
    <group position={[SHED.x, gy, SHED.z]}>
      {/* slab + floor */}
      <B geo={slab} mat={m.concrete} p={[0, FLOOR - 0.2, 0]} />
      <mesh position={[0.3, FLOOR + 0.003, SD / 2 - 0.55]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[SW - 0.9, 0.06]} />
        <meshStandardMaterial color="#E2B42E" roughness={0.6} />
      </mesh>
      {/* walls */}
      <B geo={back} mat={m.whiteWall} p={[0, (H_BACK + 0.1) / 2, -SD / 2 + T / 2]} />
      <B geo={side} mat={m.whiteWall} p={[-SW / 2 + T / 2, 0, 0]} />
      <B geo={side} mat={m.whiteWall} p={[SW / 2 - T / 2, 0, 0]} />
      {/* grey plinth band outside */}
      <B geo={roundedBox(SW + 0.03, 0.32, T + 0.03, 0.01, 2)} mat={m.concrete} p={[0, 0.16, -SD / 2 + T / 2]} />
      <B geo={roundedBox(T + 0.03, 0.32, SD, 0.01, 2)} mat={m.concrete} p={[-SW / 2 + T / 2, 0.16, 0]} />
      <B geo={roundedBox(T + 0.03, 0.32, SD, 0.01, 2)} mat={m.concrete} p={[SW / 2 - T / 2, 0.16, 0]} />
      {/* louvred vent high on the back wall */}
      {[0, 1, 2, 3].map((i) => (
        <B key={i} geo={roundedBox(0.9, 0.035, 0.06, 0.008, 2)} mat={m.galvanised} p={[-1.2, 2.05 + i * 0.09, -SD / 2 + T + 0.02]} r={[0.5, 0, 0]} />
      ))}
      {/* dark steel trims on the open front */}
      {[-1, 1].map((sx) => (
        <B key={sx} geo={roundedBox(0.26, H_FRONT + 0.05, 0.1, 0.012, 2)} mat={m.steel} p={[sx * (SW / 2 - T / 2), (H_FRONT + 0.05) / 2, SD / 2 + 0.03]} />
      ))}
      {/* front lintel and purlins */}
      <B geo={roundedBox(SW + 0.1, 0.22, 0.16, 0.01, 2)} mat={m.steel} p={[0, H_FRONT - 0.04, SD / 2 - 0.02]} />
      {[-1.4, -0.2, 1.0].map((z) => (
        <B key={z} geo={roundedBox(SW, 0.12, 0.06, 0.01, 2)} mat={m.galvanised} p={[0, H_BACK + ((z + SD / 2) / SD) * (H_FRONT - H_BACK) + 0.05, z]} />
      ))}
      <mesh geometry={roof} material={roofMat} position={[0, roofY, 0.05]} rotation={[-pitch, 0, 0]} castShadow receiveShadow />
      {/* gutter + downpipe */}
      <mesh position={[0, H_BACK + 0.02, -SD / 2 - 0.4]} rotation={[0, 0, -Math.PI / 2]} castShadow material={m.galvanised}>
        <cylinderGeometry args={[0.07, 0.07, SW + 0.6, 16, 1, true, 0, Math.PI]} />
      </mesh>
      <mesh position={[SW / 2 + 0.05, H_BACK / 2, -SD / 2 - 0.35]} castShadow material={m.galvanised}>
        <cylinderGeometry args={[0.045, 0.045, H_BACK, 12]} />
      </mesh>
      {/* wall clock and hygiene notice board */}
      <group position={[-0.1, 2.15, -SD / 2 + T + 0.012]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow material={m.steel}>
          <cylinderGeometry args={[0.16, 0.16, 0.035, 32]} />
        </mesh>
        <mesh position={[0, 0, 0.019]} material={m.ceramic}>
          <circleGeometry args={[0.14, 32]} />
        </mesh>
        <mesh position={[0.03, 0.03, 0.022]} rotation={[0, 0, -0.8]} material={m.blackPlastic}>
          <boxGeometry args={[0.012, 0.11, 0.003]} />
        </mesh>
        <mesh position={[-0.035, 0.015, 0.023]} rotation={[0, 0, 1.1]} material={m.blackPlastic}>
          <boxGeometry args={[0.014, 0.08, 0.003]} />
        </mesh>
      </group>
      <group position={[-2.05, 1.55, -SD / 2 + T + 0.015]}>
        <B geo={roundedBox(0.9, 0.62, 0.03, 0.01, 2)} mat={m.timberDark} p={[0, 0, 0]} />
        <mesh position={[0, 0, 0.0165]} material={m.cork}>
          <planeGeometry args={[0.82, 0.54]} />
        </mesh>
        {[
          [-0.22, 0.1, 0.24, 0.3, '#F4F1E8'],
          [0.1, 0.12, 0.22, 0.26, '#F6E7B0'],
          [0.28, -0.1, 0.18, 0.22, '#E9F0F2'],
          [-0.12, -0.14, 0.26, 0.18, '#F4F1E8'],
        ].map(([x, y, w, h, c], i) => (
          <mesh key={i} position={[x as number, y as number, 0.018]} rotation={[0, 0, (i - 1.5) * 0.04]}>
            <planeGeometry args={[w as number, h as number]} />
            <meshStandardMaterial color={c as string} roughness={0.9} />
          </mesh>
        ))}
      </group>
      {/* LED battens */}
      {[-1.4, 1.4].map((x) => (
        <mesh key={x} position={[x, H_BACK + 0.15, -0.2]} rotation={[-pitch, 0, 0]} material={lamp}>
          <boxGeometry args={[0.08, 0.04, 1.4]} />
        </mesh>
      ))}
      {/* equipment */}
      <group position={[0, FLOOR, 0]}>
        <Extractor m={m} position={[-1.15, 0, -0.55]} active={active} />
        <UncappingTank m={m} position={[0.45, 0, -0.62]} />
        <SettlingTank m={m} position={[2.15, 0, -1.2]} quality={quality} />
        <Shelving m={m} position={[-SW / 2 + T + 0.28, 0, -0.65]} rotation={Math.PI / 2} />
        <Sink m={m} position={[1.0, 0, -SD / 2 + T + 0.3]} />
        <Pail m={m} position={[2.75, 0, 0.55]} />
        <Pail m={m} position={[2.75, 0.345, 0.55]} />
        <Pail m={m} position={[2.42, 0, 0.75]} lid={false} honey />
        <Pail m={m} position={[-2.55, 0, 1.15]} />
        <Pail m={m} position={[-2.2, 0, 1.4]} />
        {/* clean line: low stainless rail with a glass guard */}
        {[-2.9, -1.6, -0.3, 1.0].map((x) => (
          <B key={x} geo={roundedBox(0.04, 1.0, 0.04, 0.01, 2)} mat={m.stainless} p={[x, 0.5, SD / 2 - 0.45]} />
        ))}
        <B geo={roundedBox(3.95, 0.04, 0.05, 0.015, 2)} mat={m.stainless} p={[-0.95, 1.0, SD / 2 - 0.45]} />
        <mesh position={[-0.95, 0.62, SD / 2 - 0.45]} material={m.glass} renderOrder={5}>
          <planeGeometry args={[3.85, 0.66]} />
        </mesh>
      </group>
      {lit && <pointLight position={[0, H_BACK - 0.2, 0.2]} color="#FFE2B8" intensity={5} distance={9} decay={2} />}
      <ShedYard m={m} />
    </group>
  );
}
