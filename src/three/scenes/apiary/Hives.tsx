import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { roundedBox, sagCurve, smoothLathe, tubeAlong } from '../../props/geo';
import type { Quality, Vec3 } from '../../core/types';
import { CombBees } from './Bees';
import { grainBox, type ApiaryMaterials } from './materials';
import { DEMO_INDEX, groundY, HIVE, HIVES, type HiveSpec } from './layout';

/* ------------------------------------------------------------------ */
/*  The hive row: Langstroth hives (deep brood box + supers) on        */
/*  galvanised stands with ant moats, telescoping lids, reducers and   */
/*  landing boards. One demonstration hive opens when selected: the    */
/*  beekeeper sets the lid aside and three comb frames lift out onto a */
/*  frame perch hooked to the side of the box (nothing floats in air). */
/* ------------------------------------------------------------------ */

const { W, L } = HIVE;
const BOARD_TOP = 0.442;
const STACK_Y0 = 0.464;

function M({ geo, mat, p, r, s, cast = true }: { geo: THREE.BufferGeometry; mat: THREE.Material; p: Vec3; r?: Vec3; s?: Vec3; cast?: boolean }) {
  return <mesh geometry={geo} material={mat} position={p} rotation={r} scale={s} castShadow={cast} receiveShadow />;
}

/** Galvanised stand with four legs standing in ant-moat cups. */
function Stand({ m }: { m: ApiaryMaterials }) {
  const leg = roundedBox(0.03, 0.44, 0.03, 0.006, 2);
  const rail = roundedBox(0.034, 0.03, 0.6, 0.006, 2);
  const cross = roundedBox(0.4, 0.03, 0.034, 0.006, 2);
  const cup = useMemo(() => smoothLathe([[0.001, 0], [0.04, 0], [0.046, 0.01], [0.05, 0.06], [0.044, 0.061], [0.04, 0.012], [0.001, 0.012]], 20, 12), []);
  return (
    <group>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`}>
            <M geo={leg} mat={m.galvanised} p={[sx * 0.185, 0.2, sz * 0.25]} />
            <M geo={cup} mat={m.blackPlastic} p={[sx * 0.185, -0.004, sz * 0.25]} />
          </group>
        )),
      )}
      <M geo={rail} mat={m.galvanised} p={[-0.185, 0.405, 0]} />
      <M geo={rail} mat={m.galvanised} p={[0.185, 0.405, 0]} />
      <M geo={cross} mat={m.galvanised} p={[0, 0.405, 0.25]} />
      <M geo={cross} mat={m.galvanised} p={[0, 0.405, -0.25]} />
      <M geo={cross} mat={m.galvanised} p={[0, 0.12, 0.25]} />
      <M geo={cross} mat={m.galvanised} p={[0, 0.12, -0.25]} />
    </group>
  );
}

/** Bottom board, entrance reducer and alighting board (in hive-local space). */
function Floor({ m, paint }: { m: ApiaryMaterials; paint: THREE.Material }) {
  return (
    <group>
      <M geo={grainBox(W, 0.022, L + 0.07, 0.004, 1.3)} mat={paint} p={[0, 0.431, 0.035]} />
      <M geo={grainBox(0.019, 0.022, L, 0.003, 1.3)} mat={paint} p={[-(W / 2 - 0.0095), BOARD_TOP + 0.011, 0]} />
      <M geo={grainBox(0.019, 0.022, L, 0.003, 1.3)} mat={paint} p={[W / 2 - 0.0095, BOARD_TOP + 0.011, 0]} />
      <M geo={grainBox(W, 0.022, 0.019, 0.003, 1.3)} mat={paint} p={[0, BOARD_TOP + 0.011, -(L / 2 - 0.0095)]} />
      {/* dark cavity behind the entrance */}
      <M geo={roundedBox(W - 0.04, 0.021, L - 0.04, 0.002, 1)} mat={m.darkInterior} p={[0, BOARD_TOP + 0.0105, 0]} cast={false} />
      {/* entrance reducer with a central notch */}
      <M geo={grainBox(0.15, 0.02, 0.019, 0.003, 1.3)} mat={m.timberGrey} p={[-0.125, BOARD_TOP + 0.01, L / 2 - 0.006]} />
      <M geo={grainBox(0.15, 0.02, 0.019, 0.003, 1.3)} mat={m.timberGrey} p={[0.125, BOARD_TOP + 0.01, L / 2 - 0.006]} />
      {/* sloping alighting board */}
      <M geo={grainBox(W, 0.016, 0.13, 0.004, 1.3)} mat={paint} p={[0, 0.405, L / 2 + 0.125]} r={[0.42, 0, 0]} />
    </group>
  );
}

/** A painted box with routed handholds on all four faces. */
function Body({ m, y, h, paint }: { m: ApiaryMaterials; y: number; h: number; paint: THREE.Material }) {
  const hhX = roundedBox(0.006, 0.03, 0.12, 0.002, 1);
  const hhZ = roundedBox(0.12, 0.03, 0.006, 0.002, 1);
  const lipX = roundedBox(0.01, 0.008, 0.13, 0.002, 1);
  const lipZ = roundedBox(0.13, 0.008, 0.01, 0.002, 1);
  const hy = y + h * 0.64;
  return (
    <group>
      <M geo={grainBox(W, h - 0.002, L, 0.005, 1.3)} mat={paint} p={[0, y + h / 2, 0]} />
      <M geo={hhX} mat={m.handhold} p={[W / 2 - 0.002, hy, 0]} cast={false} />
      <M geo={hhX} mat={m.handhold} p={[-W / 2 + 0.002, hy, 0]} cast={false} />
      <M geo={hhZ} mat={m.handhold} p={[0, hy, L / 2 - 0.002]} cast={false} />
      <M geo={hhZ} mat={m.handhold} p={[0, hy, -L / 2 + 0.002]} cast={false} />
      <M geo={lipX} mat={paint} p={[W / 2 + 0.002, hy + 0.019, 0]} />
      <M geo={lipX} mat={paint} p={[-W / 2 - 0.002, hy + 0.019, 0]} />
      <M geo={lipZ} mat={paint} p={[0, hy + 0.019, L / 2 + 0.002]} />
      <M geo={lipZ} mat={paint} p={[0, hy + 0.019, -L / 2 - 0.002]} />
    </group>
  );
}

/** Telescoping outer cover with its galvanised top (local origin at the stack top). */
function Lid({ m, paint, stone }: { m: ApiaryMaterials; paint: THREE.Material; stone?: boolean }) {
  return (
    <group>
      <M geo={grainBox(W + 0.052, 0.074, L + 0.052, 0.006, 1.3)} mat={paint} p={[0, -0.006, 0]} />
      <M geo={roundedBox(W + 0.064, 0.012, L + 0.064, 0.004, 2)} mat={m.hiveTop} p={[0, 0.036, 0]} />
      {stone && <M geo={roundedBox(0.15, 0.07, 0.11, 0.03, 3)} mat={m.stone} p={[0.04, 0.075, -0.06]} r={[0, 0.5, 0.06]} />}
    </group>
  );
}

function stackHeight(h: HiveSpec) {
  return h.boxes.reduce((a, b) => a + (b === 'deep' ? HIVE.deep : HIVE.medium), 0);
}

function StaticHive({ m, h }: { m: ApiaryMaterials; h: HiveSpec }) {
  const gy = groundY(h.x, h.z);
  let y = STACK_Y0;
  const paints = m.paints;
  const top = STACK_Y0 + stackHeight(h);
  return (
    <group position={[h.x, gy, h.z]} rotation={[0, h.rot, 0]}>
      <Stand m={m} />
      <Floor m={m} paint={paints[h.paint[0]]} />
      {h.boxes.map((b, k) => {
        const bh = b === 'deep' ? HIVE.deep : HIVE.medium;
        const el = <Body key={k} m={m} y={y} h={bh} paint={paints[h.paint[k]]} />;
        y += bh;
        return el;
      })}
      <group position={[0, top, 0]}>
        <Lid m={m} paint={paints[(h.paint[0] + 1) % paints.length]} stone={h.rock} />
      </group>
    </group>
  );
}

/* ------------------------------ Demonstration hive ------------------------------ */

const FRAME_PITCH = 0.035;
const LIFTED = [4, 5, 6];

let frameGeo: THREE.BufferGeometry | null = null;
/** Medium frame woodwork (top bar with lugs, end bars, bottom bar) merged into one geometry. */
function frameGeometry() {
  if (frameGeo) return frameGeo;
  const parts: [THREE.BufferGeometry, number, number][] = [
    [grainBox(0.483, 0.019, 0.025, 0.003, 2), 0, 0],
    [grainBox(0.009, 0.14, 0.033, 0.002, 2), -0.214, -0.078],
    [grainBox(0.009, 0.14, 0.033, 0.002, 2), 0.214, -0.078],
    [grainBox(0.437, 0.01, 0.02, 0.002, 2), 0, -0.152],
  ];
  frameGeo = mergeGeometries(parts.map(([g, x, y]) => g.clone().translate(x, y, 0)), false);
  return frameGeo;
}

function frameParts(m: ApiaryMaterials) {
  return <M geo={frameGeometry()} mat={m.timberGrey} p={[0, 0, 0]} />;
}

function DemoHive({ m, h, active, quality }: { m: ApiaryMaterials; h: HiveSpec; active: boolean; quality: Quality }) {
  const gy = groundY(h.x, h.z);
  const paints = m.paints;
  const brood = HIVE.deep;
  const sup = HIVE.medium;
  const yT = STACK_Y0 + brood + sup;
  const wallT = 0.019;
  const lid = useRef<THREE.Group>(null);
  const frames = useRef<(THREE.Group | null)[]>([]);
  const prog = useRef(active ? 1 : 0);
  const combGeo = useMemo(() => new THREE.BoxGeometry(0.43, 0.13, 0.024), []);
  const restY = yT - 0.0095;
  // ground offset where the lid comes to rest (the terrace is not perfectly level)
  const lidDy = useMemo(() => {
    const c = Math.cos(h.rot);
    const s = Math.sin(h.rot);
    const lx = -0.68;
    const lz = 0.12;
    return groundY(h.x + lx * c + lz * s, h.z - lx * s + lz * c) - gy;
  }, [h, gy]);

  // Frame perch on the +x wall, below the telescoping lid's rim so the lid always clears it
  const perchY = yT - 0.062;
  const perchX = (k: number) => W / 2 + 0.058 + k * 0.05;
  const perch = useMemo(
    () => ({
      rail: roundedBox(0.19, 0.012, 0.012, 0.004, 2),
      strap: roundedBox(0.008, 0.16, 0.03, 0.003, 1),
      stop: roundedBox(0.012, 0.03, 0.012, 0.004, 1),
    }),
    [],
  );

  const tmpV = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }, dt) => {
    const target = active ? 1 : 0;
    const speed = 1 / 3.6;
    prog.current += THREE.MathUtils.clamp(target - prog.current, -speed * Math.min(dt, 0.05), speed * Math.min(dt, 0.05));
    const p = prog.current;
    const t = clock.elapsedTime;
    const ss = THREE.MathUtils.smoothstep;
    // lid: lift, swing aside and come to rest upside down on the ground
    const lg = lid.current;
    if (lg) {
      const a = ss(p, 0.0, 0.14);
      const b = ss(p, 0.12, 0.34);
      const up = 0.22 * a;
      const x = -0.68 * b;
      const restYl = -yT + 0.046 + lidDy;
      const y = THREE.MathUtils.lerp(up, restYl, ss(b, 0.35, 1)) + Math.sin(b * Math.PI) * 0.08;
      lg.position.set(x, yT + y, 0.12 * b);
      lg.rotation.set(0, 0.35 * b, Math.PI * ss(b, 0.15, 0.85));
    }
    // Frames: straight up out of the box, across, and down onto the perch rails — in order
    LIFTED.forEach((fi, k) => {
      const g = frames.current[k];
      if (!g) return;
      const start = 0.3 + k * 0.1;
      const fp = ss(p, start, start + 0.5);
      const lift = ss(fp, 0, 0.38);
      const slide = ss(fp, 0.38, 0.72);
      const drop = ss(fp, 0.72, 1);
      const x0 = (fi - 4.5) * FRAME_PITCH;
      const high = restY + 0.3;
      const y = drop > 0 ? THREE.MathUtils.lerp(high, perchY, drop) : THREE.MathUtils.lerp(restY, high, lift);
      tmpV.set(THREE.MathUtils.lerp(x0, perchX(k), slide), y, 0);
      // a gentle sway only while a frame is in the air
      const air = Math.sin(fp * Math.PI);
      g.position.copy(tmpV);
      g.rotation.set(0, Math.PI / 2, air * Math.sin(t * 2.2 + k) * 0.025);
      g.visible = true;
    });
  });

  return (
    <group position={[h.x, gy, h.z]} rotation={[0, h.rot, 0]}>
      <Stand m={m} />
      <Floor m={m} paint={paints[h.paint[0]]} />
      <Body m={m} y={STACK_Y0} h={brood} paint={paints[h.paint[0]]} />
      {/* open honey super: four walls, frames inside */}
      <group>
        <M geo={grainBox(W, sup - 0.002, wallT, 0.004, 1.3)} mat={paints[h.paint[1]]} p={[0, STACK_Y0 + brood + sup / 2, L / 2 - wallT / 2]} />
        <M geo={grainBox(W, sup - 0.002, wallT, 0.004, 1.3)} mat={paints[h.paint[1]]} p={[0, STACK_Y0 + brood + sup / 2, -L / 2 + wallT / 2]} />
        <M geo={grainBox(wallT, sup - 0.002, L - wallT * 2, 0.004, 1.3)} mat={paints[h.paint[1]]} p={[W / 2 - wallT / 2, STACK_Y0 + brood + sup / 2, 0]} />
        <M geo={grainBox(wallT, sup - 0.002, L - wallT * 2, 0.004, 1.3)} mat={paints[h.paint[1]]} p={[-W / 2 + wallT / 2, STACK_Y0 + brood + sup / 2, 0]} />
        <M geo={roundedBox(W - 0.04, 0.01, L - 0.04, 0.002, 1)} mat={m.darkInterior} p={[0, STACK_Y0 + brood + 0.006, 0]} cast={false} />
        {Array.from({ length: 10 }, (_, i) =>
          LIFTED.includes(i) ? null : (
            <group key={i} position={[(i - 4.5) * FRAME_PITCH, restY, 0]} rotation={[0, Math.PI / 2, 0]}>
              {frameParts(m)}
              <mesh geometry={combGeo} material={m.comb} position={[0, -0.083, 0]} receiveShadow />
            </group>
          ),
        )}
      </group>
      {/* frame perch: two rails on straps screwed to the side of the super */}
      <group>
        {[-1, 1].map((sz) => (
          <group key={sz}>
            <M geo={perch.rail} mat={m.galvanised} p={[W / 2 + 0.095, perchY - 0.016, sz * 0.226]} />
            <M geo={perch.strap} mat={m.galvanised} p={[W / 2 + 0.004, perchY - 0.08, sz * 0.226]} />
            <M geo={perch.stop} mat={m.galvanised} p={[W / 2 + 0.185, perchY - 0.004, sz * 0.226]} />
          </group>
        ))}
      </group>
      {/* animated: lid and lifted frames */}
      <group userData={{ noBatch: true }}>
        <group ref={lid} position={[0, yT, 0]}>
          <Lid m={m} paint={paints[(h.paint[0] + 1) % paints.length]} />
          <M geo={grainBox(W, 0.01, L, 0.002, 1.3)} mat={m.timberGrey} p={[0, -0.04, 0]} />
        </group>
        {LIFTED.map((fi, k) => (
          <group
            key={fi}
            ref={(g) => {
              frames.current[k] = g;
            }}
            position={[(fi - 4.5) * FRAME_PITCH, restY, 0]}
            rotation={[0, Math.PI / 2, 0]}
          >
            {frameParts(m)}
            <mesh geometry={combGeo} material={m.comb} position={[0, -0.083, 0]} castShadow receiveShadow />
            {quality !== 'low' && (
              <group position={[0, -0.083, 0]}>
                <CombBees width={0.42} height={0.12} depth={0.024} count={quality === 'high' ? 22 : 12} seed={fi * 7} />
              </group>
            )}
          </group>
        ))}
      </group>
    </group>
  );
}

/* --------------------------------- Smoker stand --------------------------------- */

/** Soft puffs of cool smoke drifting from the smoker nozzle while the beekeeper works. */
function SmokeWisp({ active, origin }: { active: boolean; origin: Vec3 }) {
  const N = 9;
  const ref = useRef<THREE.Points>(null);
  const level = useRef(0);
  const { geo, mat } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(N), 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(N), 1));
    const mt = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uScale: { value: 600 } },
      vertexShader: `attribute float aSize; attribute float aAlpha; uniform float uScale; varying float vA;
        void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; vA = aAlpha; }`,
      fragmentShader: `varying float vA;
        void main() { vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.05, d) * vA; if (a < 0.003) discard; gl_FragColor = vec4(vec3(0.74, 0.73, 0.7), a); }`,
    });
    return { geo: g, mat: mt };
  }, []);
  useFrame(({ clock, size, camera }, dt) => {
    level.current += THREE.MathUtils.clamp((active ? 1 : 0) - level.current, -dt * 0.5, dt * 0.5);
    const pts = ref.current;
    if (!pts) return;
    pts.visible = level.current > 0.01;
    if (!pts.visible) return;
    const persp = camera as THREE.PerspectiveCamera;
    mat.uniforms.uScale.value = size.height / (2 * Math.tan(THREE.MathUtils.degToRad((persp.fov ?? 36) / 2)));
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const sz = geo.attributes.aSize as THREE.BufferAttribute;
    const al = geo.attributes.aAlpha as THREE.BufferAttribute;
    const t = clock.elapsedTime;
    for (let i = 0; i < N; i++) {
      const age = (t * 0.3 + i / N) % 1;
      const sway = Math.sin(t * 1.3 + i * 1.7);
      pos.setXYZ(i, origin[0] + age * 0.22 + sway * 0.09 * age, origin[1] + age * 0.68 + Math.sin(t * 2.1 + i) * 0.02, origin[2] + Math.cos(t * 0.8 + i * 2.3) * 0.11 * age);
      sz.setX(i, 0.05 + age * (0.4 + (i % 3) * 0.08));
      al.setX(i, Math.sin(age * Math.PI) * (0.1 + (i % 2) * 0.05) * level.current);
    }
    pos.needsUpdate = true;
    sz.needsUpdate = true;
    al.needsUpdate = true;
  });
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} renderOrder={6} />;
}

function SmokerStand({ m, position, rotation, active }: { m: ApiaryMaterials; position: Vec3; rotation: number; active: boolean }) {
  const body = useMemo(() => smoothLathe([[0.001, 0], [0.05, 0], [0.052, 0.01], [0.052, 0.17], [0.05, 0.18]], 28, 12), []);
  const cage = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      const g = new THREE.CylinderGeometry(0.0025, 0.0025, 0.15, 4);
      g.translate(Math.cos(a) * 0.062, 0.085, Math.sin(a) * 0.062);
      parts.push(g);
    }
    for (const y of [0.015, 0.16]) {
      const t = new THREE.TorusGeometry(0.062, 0.003, 4, 28);
      t.rotateX(Math.PI / 2);
      t.translate(0, y, 0);
      parts.push(t.toNonIndexed());
    }
    return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)), false);
  }, []);
  const dome = useMemo(() => smoothLathe([[0.055, 0], [0.054, 0.012], [0.046, 0.032], [0.03, 0.048], [0.016, 0.056], [0.001, 0.058]], 28, 14), []);
  const nozzle = useMemo(() => tubeAlong([new THREE.Vector3(0.0, 0.03, 0), new THREE.Vector3(0.012, 0.062, 0), new THREE.Vector3(0.04, 0.085, 0), new THREE.Vector3(0.07, 0.09, 0)], 0.014, 12), []);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* timber stool */}
      <M geo={grainBox(0.38, 0.032, 0.3, 0.006, 1.5)} mat={m.timber} p={[0, 0.47, 0]} />
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => <M key={`${sx}${sz}`} geo={grainBox(0.035, 0.46, 0.035, 0.005, 1.5)} mat={m.timber} p={[sx * 0.155, 0.227, sz * 0.115]} r={[sz * 0.05, 0, -sx * 0.05]} />),
      )}
      <M geo={grainBox(0.31, 0.022, 0.022, 0.004, 1.5)} mat={m.timber} p={[0, 0.14, 0.12]} />
      {/* smoker */}
      <group position={[-0.08, 0.486, 0.02]} rotation={[0, -2.2, 0]}>
        <M geo={body} mat={m.stainless} p={[0, 0, 0]} />
        <M geo={cage} mat={m.steel} p={[0, 0, 0]} />
        <M geo={dome} mat={m.steel} p={[0, 0.18, 0]} />
        <M geo={nozzle} mat={m.steel} p={[0, 0.18, 0]} />
        <SmokeWisp active={active} origin={[0.075, 0.272, 0]} />
        {/* bellows */}
        <group position={[-0.075, 0.1, 0]} rotation={[0, 0, 0.12]}>
          <M geo={grainBox(0.012, 0.16, 0.1, 0.003, 2)} mat={m.timber} p={[-0.004, 0, 0]} />
          <M geo={grainBox(0.012, 0.16, 0.1, 0.003, 2)} mat={m.timber} p={[-0.06, 0.01, 0]} r={[0, 0, 0.2]} />
          <M geo={roundedBox(0.05, 0.12, 0.09, 0.012, 2)} mat={m.leather} p={[-0.032, 0.012, 0]} r={[0, 0, 0.1]} />
        </group>
      </group>
      {/* hive tool and bee brush */}
      <group position={[0.09, 0.488, -0.02]} rotation={[0, 0.5, 0]}>
        <M geo={roundedBox(0.24, 0.004, 0.032, 0.0015, 1)} mat={m.stainless} p={[0, 0, 0]} />
        <M geo={roundedBox(0.03, 0.004, 0.032, 0.0015, 1)} mat={m.stainless} p={[0.125, 0.012, 0]} r={[0, 0, 0.9]} />
      </group>
      <group position={[0.07, 0.492, 0.09]} rotation={[0, -0.3, 0]}>
        <M geo={grainBox(0.26, 0.016, 0.03, 0.004, 2)} mat={m.timberDark} p={[0, 0, 0]} />
        <M geo={roundedBox(0.14, 0.03, 0.026, 0.008, 2)} mat={m.wax} p={[0.05, -0.004, 0]} />
      </group>
    </group>
  );
}

/* ------------------------------ Guided-zone rope ------------------------------ */

function RopeBarrier({ m }: { m: ApiaryMaterials }) {
  const posts = useMemo(() => {
    const cx = -6.2;
    const cz = 9.5;
    const R = 14.1;
    const out: Vec3[] = [];
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = -0.44 + (i / (n - 1)) * 0.88;
      const x = cx + Math.sin(a) * R;
      const z = cz - Math.cos(a) * R;
      out.push([x, groundY(x, z), z]);
    }
    return out;
  }, []);
  const ropes = useMemo(
    () =>
      posts.slice(0, -1).map((p, i) => {
        const q = posts[i + 1];
        return tubeAlong(sagCurve(new THREE.Vector3(p[0], p[1] + 0.74, p[2]), new THREE.Vector3(q[0], q[1] + 0.74, q[2]), 0.09, 16), 0.011, 6);
      }),
    [posts],
  );
  const post = useMemo(() => grainBox(0.07, 0.86, 0.07, 0.012, 1.4), []);
  const cap = useMemo(() => new THREE.SphereGeometry(0.045, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), []);
  return (
    <group>
      {posts.map((p, i) => (
        <group key={i} position={p}>
          <M geo={post} mat={m.timberGrey} p={[0, 0.41, 0]} />
          <M geo={cap} mat={m.timberGrey} p={[0, 0.84, 0]} />
        </group>
      ))}
      {ropes.map((g, i) => (
        <mesh key={i} geometry={g} material={m.rope} castShadow />
      ))}
    </group>
  );
}

/** Small hexagonal welcome sign on a post. */
function HiveSign({ m, position, rotation }: { m: ApiaryMaterials; position: Vec3; rotation: number }) {
  const hexGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.24, 0.24, 0.03, 6, 1);
    g.rotateX(Math.PI / 2);
    g.rotateZ(Math.PI / 6);
    return g;
  }, []);
  const face = useMemo(() => {
    const g = new THREE.CircleGeometry(0.215, 6);
    g.rotateZ(Math.PI / 6);
    return g;
  }, []);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <M geo={grainBox(0.08, 1.2, 0.08, 0.012, 1.4)} mat={m.timberDark} p={[0, 0.6, -0.03]} />
      <M geo={hexGeo} mat={m.timberDark} p={[0, 1.18, 0]} />
      <mesh geometry={face} material={m.badge} position={[0, 1.18, 0.0155]} />
    </group>
  );
}

/** Slatted timber bench in the shade of the big Sidr, facing the hive row. */
function ShadeBench({ m, position, rotation }: { m: ApiaryMaterials; position: Vec3; rotation: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {[-0.13, 0, 0.13].map((z) => (
        <M key={z} geo={grainBox(1.9, 0.04, 0.11, 0.008, 1.2)} mat={m.timber} p={[0, 0.45, z]} />
      ))}
      {[-0.32, -0.2].map((y, i) => (
        <M key={i} geo={grainBox(1.9, 0.1, 0.03, 0.008, 1.2)} mat={m.timber} p={[0, 0.62 + i * 0.16 + 0.1, -0.24]} r={[-0.18, 0, 0]} />
      ))}
      {[-0.82, 0.82].map((x) => (
        <group key={x}>
          <M geo={grainBox(0.07, 0.44, 0.07, 0.01, 1.2)} mat={m.timberDark} p={[x, 0.22, 0.12]} />
          <M geo={grainBox(0.07, 0.9, 0.07, 0.01, 1.2)} mat={m.timberDark} p={[x, 0.45, -0.22]} r={[-0.1, 0, 0]} />
          <M geo={grainBox(0.07, 0.06, 0.46, 0.01, 1.2)} mat={m.timberDark} p={[x, 0.4, -0.04]} />
        </group>
      ))}
    </group>
  );
}

/** Wheelbarrow carrying two spare honey supers. */
function Barrow({ m, position, rotation }: { m: ApiaryMaterials; position: Vec3; rotation: number }) {
  const tray = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.44, 0.3, 0.3, 4, 1, true);
    g.rotateY(Math.PI / 4);
    g.scale(1.25, 1, 0.85);
    return g;
  }, []);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={tray} material={m.trayPaint} position={[0, 0.52, 0]} castShadow receiveShadow />
      <mesh position={[0.66, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow material={m.blackPlastic}>
        <torusGeometry args={[0.19, 0.055, 12, 28]} />
      </mesh>
      {[-0.22, 0.22].map((z) => (
        <group key={z}>
          <M geo={grainBox(1.5, 0.045, 0.045, 0.01, 1.2)} mat={m.timberDark} p={[-0.2, 0.46, z]} r={[0, 0, 0.3]} />
          <M geo={roundedBox(0.035, 0.38, 0.035, 0.008, 2)} mat={m.galvanised} p={[-0.32, 0.19, z]} />
        </group>
      ))}
      <M geo={grainBox(HIVE.W, HIVE.medium - 0.003, HIVE.L, 0.005, 1.3)} mat={m.paints[2]} p={[0.02, 0.62, 0]} r={[0, 1.4, 0.05]} />
      <M geo={grainBox(HIVE.W, HIVE.medium - 0.003, HIVE.L, 0.005, 1.3)} mat={m.paints[4]} p={[0.04, 0.79, 0.01]} r={[0, 1.5, 0.04]} />
    </group>
  );
}

export function Hives({ m, active, quality }: { m: ApiaryMaterials; active: string | null; quality: Quality }) {
  const demo = HIVES[DEMO_INDEX];
  const smoker = useMemo(() => {
    const fx = Math.sin(demo.rot);
    const fz = Math.cos(demo.rot);
    const rx = fz;
    const rz = -fx;
    const x = demo.x + rx * 0.72 + fx * 0.22;
    const z = demo.z + rz * 0.72 + fz * 0.22;
    return { p: [x, groundY(x, z), z] as Vec3, r: demo.rot };
  }, [demo]);
  return (
    <group>
      {HIVES.map((h, i) => (h.demo ? null : <StaticHive key={i} m={m} h={h} />))}
      <DemoHive m={m} h={demo} active={active === 'hives'} quality={quality} />
      <SmokerStand m={m} position={smoker.p} rotation={smoker.r} active={active === 'hives'} />
      <RopeBarrier m={m} />
      <HiveSign m={m} position={[-1.7, groundY(-1.7, -3.2), -3.2]} rotation={-0.45} />
      <ShadeBench m={m} position={[-12.2, groundY(-12.2, -10.9), -10.9]} rotation={0.42} />
      <Barrow m={m} position={[3.6, groundY(3.6, -5.6), -5.6]} rotation={2.5} />
    </group>
  );
}
