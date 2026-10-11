import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { boxProjectUVs, roundedBox, tubeAlong } from '../../props/geo';
import type { Variant, Vec3 } from '../../core/types';
import { latheSimple, paintBy } from './geometry';
import { ARCHES, COURT, FY, KILN } from './layout';
import type { PotteryMaterials } from './materials';
import { Slab } from './parts';
import { Vessel } from './Vessels';

/* ------------------------------------------------------------------ */
/*  Kiln corner: a sprung-arch gas kiln in a steel frame (door with    */
/*  glowing spy-holes, burners, flue), kiln furniture, a controller    */
/*  and a rack of pale bisque ware waiting for its glaze.              */
/* ------------------------------------------------------------------ */

const W = 1.3;
const D = 1.2;
const BASE = 0.22;
const BODY = 1.33;
const RISE = 0.22;
/** flue position relative to the kiln centre (clear of the danchal above) */
const FLUE: [number, number] = [0.32, -0.25];

let glowTex: THREE.Texture | null = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,200,140,1)');
  g.addColorStop(0.25, 'rgba(255,130,50,0.55)');
  g.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

export function Kiln({ m, variant, active }: { m: PotteryMaterials; variant: Variant; active?: string | null }) {
  const hot = useRef(1);
  const focus = active === 'kiln';
  const dusk = variant === 'dusk';
  const glowMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2B0F05', emissive: '#FF6A1C', emissiveIntensity: 3, roughness: 1 }), []);
  const seamMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1A0A04', emissive: '#FF5A14', emissiveIntensity: 1, roughness: 1 }), []);
  const flameMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#5FA8FF', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }), []);
  const halo = useMemo(() => new THREE.SpriteMaterial({ map: glowTexture(), color: '#FFB27A', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }), []);
  const light = useRef<THREE.PointLight>(null);
  const haloRef = useRef<THREE.Sprite>(null);
  const base = dusk ? 1 : 0.55;

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    // flicker, a little hotter while the kiln hotspot is selected
    hot.current = THREE.MathUtils.damp(hot.current, focus ? 1.35 : 1, 2, Math.min(0.05, delta));
    const f = (0.86 + Math.sin(t * 7.3) * 0.05 + Math.sin(t * 13.1 + 1.2) * 0.04 + Math.sin(t * 2.1) * 0.05) * hot.current;
    glowMat.emissiveIntensity = (dusk ? 6.5 : 3.6) * f;
    seamMat.emissiveIntensity = (dusk ? 2.6 : 0.5) * f;
    flameMat.opacity = (dusk ? 0.85 : 0.35) * (0.8 + Math.sin(t * 23) * 0.2);
    if (light.current) light.current.intensity = (dusk ? 7 : 1.4) * f;
    if (haloRef.current) {
      haloRef.current.material.opacity = base * f;
      const s = (dusk ? 0.5 : 0.3) * (0.95 + f * 0.05);
      haloRef.current.scale.set(s, s, s);
    }
  });

  const geo = useMemo(() => {
    const body = boxProjectUVs(roundedBox(W, BODY, D, 0.02, 2).clone(), 1);
    // soot: darker towards the crown and above the door
    paintBy(body, (x, y, z) => {
      const top = THREE.MathUtils.smoothstep(y, -0.2, BODY / 2) * 0.32;
      const door = z > D / 2 - 0.02 ? Math.exp(-((x + 0.08) ** 2) / 0.12) * THREE.MathUtils.smoothstep(y, 0.15, 0.6) * 0.3 : 0;
      const k = 1 - top - door;
      return [k, k * 0.96, k * 0.93];
    });
    // segmental (sprung) arch roof
    const R = (W * W) / 4 / (2 * RISE) + RISE / 2;
    const half = Math.asin(W / 2 / R);
    const arch = new THREE.CylinderGeometry(R, R, D, 40, 1, false, Math.PI - half, half * 2);
    arch.rotateX(Math.PI / 2);
    arch.translate(0, BASE + BODY + RISE - R, 0);
    boxProjectUVs(arch, 1);
    paintBy(arch, () => [0.6, 0.57, 0.54]);
    const flue = new THREE.CylinderGeometry(0.12, 0.12, 4.0, 24, 1, true);
    const cap = latheSimple(
      [
        [0.0005, 0.16],
        [0.2, 0.02],
        [0.205, 0.0],
        [0.19, 0.0],
        [0.0005, 0.13],
      ],
      { segments: 28 },
    );
    const collar = new THREE.CylinderGeometry(0.16, 0.16, 0.12, 24);
    const tank = latheSimple(
      [
        [0.0005, 0],
        [0.15, 0],
        [0.16, 0.03],
        [0.16, 0.7],
        [0.14, 0.8],
        [0.07, 0.84],
        [0.06, 0.86],
        [0.0005, 0.86],
      ],
      { segments: 36 },
    );
    const tankRing = new THREE.TorusGeometry(0.1, 0.015, 8, 28);
    tankRing.rotateX(Math.PI / 2);
    const hose = tubeAlong(
      [new THREE.Vector3(1.19, 0.93, -0.55), new THREE.Vector3(1.08, 0.72, -0.42), new THREE.Vector3(0.95, 0.1, -0.2), new THREE.Vector3(0.82, 0.07, 0.2), new THREE.Vector3(0.72, 0.28, 0.3)],
      0.012,
      8,
    );
    const manifold = tubeAlong([new THREE.Vector3(0.7, 0.28, 0.3), new THREE.Vector3(0.72, 0.28, -0.25), new THREE.Vector3(0.72, 0.28, -0.42)], 0.018, 8);
    return { body, arch, flue, cap, collar, tank, tankRing, hose, manifold };
  }, []);

  const cx = KILN.x;
  const cz = KILN.z;
  const doorW = 0.86;
  const doorH = 1.02;
  const doorY = BASE + 0.12;
  const doorX = -0.08;
  const peep: Vec3[] = [
    [doorX - 0.18, doorY + doorH * 0.72, 0],
    [doorX - 0.18, doorY + doorH * 0.3, 0],
  ];

  return (
    <group>
      <group position={[cx, FY, cz]}>
        {/* stand */}
        {[
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].map(([sx, sz], i) => (
          <Slab key={i} mat={m.steel} position={[(sx * (W - 0.08)) / 2, BASE / 2, (sz * (D - 0.08)) / 2]} size={[0.07, BASE, 0.07]} r={0.006} />
        ))}
        <Slab mat={m.steel} position={[0, BASE - 0.03, 0]} size={[W + 0.04, 0.06, D + 0.04]} r={0.008} />
        {/* brick body + arch */}
        <mesh geometry={geo.body} material={m.kilnBrick} position={[0, BASE + BODY / 2, 0]} castShadow receiveShadow />
        <mesh geometry={geo.arch} material={m.kilnBrick} castShadow receiveShadow />
        {/* steel frame: corner angles, bands, skewbacks, tie rods */}
        {[
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].map(([sx, sz], i) => (
          <Slab key={i} mat={m.iron} position={[(sx * (W + 0.02)) / 2, BASE + BODY / 2 + 0.04, (sz * (D + 0.02)) / 2]} size={[0.06, BODY + 0.08, 0.06]} r={0.006} />
        ))}
        {[0.42, 1.0].map((y) => (
          <group key={y}>
            <Slab mat={m.iron} position={[0, BASE + y, D / 2 + 0.012]} size={[W + 0.04, 0.05, 0.016]} r={0.004} />
            <Slab mat={m.iron} position={[0, BASE + y, -D / 2 - 0.012]} size={[W + 0.04, 0.05, 0.016]} r={0.004} />
            <Slab mat={m.iron} position={[W / 2 + 0.012, BASE + y, 0]} size={[0.016, 0.05, D + 0.04]} r={0.004} />
            <Slab mat={m.iron} position={[-W / 2 - 0.012, BASE + y, 0]} size={[0.016, 0.05, D + 0.04]} r={0.004} />
          </group>
        ))}
        {[-1, 1].map((s) => (
          <Slab key={s} mat={m.iron} position={[(s * (W + 0.03)) / 2, BASE + BODY + 0.03, 0]} size={[0.08, 0.1, D + 0.08]} r={0.008} />
        ))}
        {[-0.42, 0.42].map((z) => (
          <group key={z}>
            <mesh position={[0, BASE + BODY + 0.05, z]} rotation={[0, 0, Math.PI / 2]} material={m.steel} castShadow>
              <cylinderGeometry args={[0.012, 0.012, W + 0.3, 8]} />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[(s * (W + 0.22)) / 2, BASE + BODY + 0.05, z]} rotation={[0, 0, Math.PI / 2]} material={m.steel} castShadow>
                <cylinderGeometry args={[0.028, 0.028, 0.035, 6]} />
              </mesh>
            ))}
          </group>
        ))}
        {/* door: steel frame with brick panel, hinges, latch */}
        <group position={[doorX, 0, D / 2]}>
          <Slab mat={m.brick} position={[0, doorY + doorH / 2, 0.05]} size={[doorW - 0.08, doorH - 0.08, 0.08]} r={0.01} uv={1} />
          <Slab mat={m.iron} position={[0, doorY + doorH - 0.025, 0.06]} size={[doorW, 0.05, 0.1]} r={0.006} />
          <Slab mat={m.iron} position={[0, doorY + 0.025, 0.06]} size={[doorW, 0.05, 0.1]} r={0.006} />
          <Slab mat={m.iron} position={[-doorW / 2 + 0.025, doorY + doorH / 2, 0.06]} size={[0.05, doorH, 0.1]} r={0.006} />
          <Slab mat={m.iron} position={[doorW / 2 - 0.025, doorY + doorH / 2, 0.06]} size={[0.05, doorH, 0.1]} r={0.006} />
          {[0.22, 0.8].map((f) => (
            <group key={f}>
              <mesh position={[doorW / 2 + 0.03, doorY + doorH * f, 0.05]} material={m.iron} castShadow>
                <cylinderGeometry args={[0.022, 0.022, 0.12, 12]} />
              </mesh>
              <Slab mat={m.iron} position={[doorW / 2 - 0.12, doorY + doorH * f, 0.115]} size={[0.3, 0.04, 0.012]} r={0.004} />
            </group>
          ))}
          <Slab mat={m.iron} position={[-doorW / 2 - 0.02, doorY + doorH * 0.52, 0.12]} size={[0.035, 0.26, 0.03]} r={0.008} />
          <Slab mat={m.iron} position={[-doorW / 2 - 0.02, doorY + doorH * 0.52 + 0.17, 0.14]} size={[0.03, 0.12, 0.03]} r={0.01} />
          {/* glowing seam around the door */}
          <mesh position={[0, doorY + doorH + 0.004, 0.012]} material={seamMat} userData={{ noBatch: true }}>
            <boxGeometry args={[doorW - 0.04, 0.008, 0.01]} />
          </mesh>
          <mesh position={[-doorW / 2 - 0.004, doorY + doorH / 2, 0.012]} material={seamMat} userData={{ noBatch: true }}>
            <boxGeometry args={[0.008, doorH - 0.04, 0.01]} />
          </mesh>
          {/* spy-holes: the upper plug is pulled, showing the fire */}
          {peep.map((p, i) => (
            <group key={i} position={[p[0], p[1], 0.1]}>
              <mesh rotation={[Math.PI / 2, 0, 0]} material={m.steel} castShadow>
                <cylinderGeometry args={[0.036, 0.04, 0.05, 16]} />
              </mesh>
              {i === 0 ? (
                <mesh position={[0, 0, 0.026]} material={glowMat} userData={{ noBatch: true }}>
                  <circleGeometry args={[0.024, 20]} />
                </mesh>
              ) : (
                <mesh position={[0, 0, 0.035]} rotation={[Math.PI / 2, 0, 0]} material={m.refractory} castShadow>
                  <cylinderGeometry args={[0.022, 0.026, 0.045, 14]} />
                </mesh>
              )}
            </group>
          ))}
        </group>
        <sprite ref={haloRef} material={halo} position={[doorX + peep[0][0], peep[0][1], D / 2 + 0.17]} scale={0.3} userData={{ noBatch: true }} />
        {/* burners with gas manifold */}
        {[-0.3, 0.25].map((z) => (
          <group key={z} position={[W / 2 + 0.02, 0.32, z]}>
            <mesh rotation={[0, 0, Math.PI / 2]} position={[0.08, 0, 0]} material={m.steel} castShadow>
              <cylinderGeometry args={[0.035, 0.035, 0.18, 14]} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]} position={[0.2, 0, 0]} material={m.brass} castShadow>
              <cylinderGeometry args={[0.018, 0.018, 0.1, 10]} />
            </mesh>
            <mesh rotation={[0, 0, -Math.PI / 2]} position={[-0.015, 0, 0]} material={flameMat} userData={{ noBatch: true }}>
              <coneGeometry args={[0.03, 0.08, 12, 1, true]} />
            </mesh>
          </group>
        ))}
        <mesh geometry={geo.manifold} material={m.brass} castShadow />
        <mesh geometry={geo.hose} material={m.rubber} castShadow />
        {/* propane cylinder */}
        <group position={[1.2, 0, -0.55]}>
          <mesh geometry={geo.tank} material={m.enamel} castShadow receiveShadow />
          <mesh geometry={geo.tankRing} material={m.steel} position={[0, 0.93, 0]} castShadow />
          <mesh position={[0, 0.9, 0]} material={m.brass} castShadow>
            <cylinderGeometry args={[0.025, 0.03, 0.08, 10]} />
          </mesh>
        </group>
        {/* flue */}
        <mesh geometry={geo.collar} material={m.steel} position={[FLUE[0], BASE + BODY + RISE - 0.02, FLUE[1]]} castShadow />
        <mesh geometry={geo.flue} material={m.steel} position={[FLUE[0], BASE + BODY + RISE + 2.0, FLUE[1]]} castShadow receiveShadow />
        <mesh geometry={geo.cap} material={m.steel} position={[FLUE[0], BASE + BODY + RISE + 4.08, FLUE[1]]} castShadow />
        {[0, 2.1, 4.2].map((a) => (
          <mesh key={a} position={[FLUE[0] + Math.cos(a) * 0.1, BASE + BODY + RISE + 4.04, FLUE[1] + Math.sin(a) * 0.1]} material={m.steel}>
            <cylinderGeometry args={[0.008, 0.008, 0.1, 5]} />
          </mesh>
        ))}
        <Slab mat={m.steel} position={[FLUE[0], 3.4, -0.625]} size={[0.06, 0.05, 0.75]} r={0.01} />
        <pointLight ref={light} position={[doorX, 0.95, D / 2 + 0.9]} color="#FF7B32" distance={dusk ? 6 : 3.5} decay={2} intensity={1} />
      </group>

      {/* controller on the wall with a lit read-out */}
      <group position={[cx - 1.0, FY + 1.45, COURT.z0 + 0.05]}>
        <Slab mat={m.enamelDark} position={[0, 0, 0]} size={[0.22, 0.28, 0.08]} r={0.012} />
        <mesh position={[0, 0.06, 0.042]} userData={{ noBatch: true }}>
          <planeGeometry args={[0.13, 0.05]} />
          <meshStandardMaterial color="#300A02" emissive="#FF5A1E" emissiveIntensity={2.2} />
        </mesh>
        <mesh geometry={useMemo(() => tubeAlong([new THREE.Vector3(0, -0.14, 0), new THREE.Vector3(0.05, -0.5, 0.02), new THREE.Vector3(0.4, -0.9, 0.3), new THREE.Vector3(0.75, -0.95, 0.5)], 0.008, 6), [])} material={m.rubber} />
      </group>

      <KilnFurniture m={m} />
      <BisqueRack m={m} />
    </group>
  );
}

/** Stacked kiln shelves and posts on a low trolley. */
function KilnFurniture({ m }: { m: PotteryMaterials }) {
  const x = KILN.x - 1.0;
  const z = KILN.z + 0.75;
  return (
    <group position={[x, FY, z]}>
      {[
        [-0.26, -0.18],
        [0.26, -0.18],
        [-0.26, 0.18],
        [0.26, 0.18],
      ].map(([dx, dz], i) => (
        <Slab key={i} mat={m.steel} position={[dx, 0.14, dz]} size={[0.035, 0.28, 0.035]} r={0.005} />
      ))}
      <Slab mat={m.steel} position={[0, 0.27, 0]} size={[0.6, 0.025, 0.44]} r={0.005} />
      {Array.from({ length: 7 }, (_, i) => (
        <Slab key={i} mat={m.refractory} position={[Math.sin(i * 2.1) * 0.012, 0.296 + i * 0.026, Math.cos(i * 1.3) * 0.01]} size={[0.52, 0.022, 0.4]} r={0.006} uv={1.5} />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[-0.18 + (i % 3) * 0.06, 0.5 + Math.floor(i / 3) * 0.0, -0.08 + Math.floor(i / 3) * 0.08]} material={m.refractory} castShadow>
          <cylinderGeometry args={[0.022, 0.022, 0.1, 10]} />
        </mesh>
      ))}
    </group>
  );
}

/** Steel rack of bisque-fired pieces along the end wall. */
function BisqueRack({ m }: { m: PotteryMaterials }) {
  const x = COURT.x1 - 0.27;
  const z0 = COURT.z0 + 0.35;
  const z1 = ARCHES.z[0] - ARCHES.w / 2 - 0.12;
  const levels = [0.08, 0.5, 0.92, 1.34];
  const items = useMemo(() => {
    const forms = ['bowl', 'mug', 'jar', 'cup', 'smallBowl', 'tumbler', 'cylinder', 'planter'] as const;
    const out: { f: (typeof forms)[number]; p: Vec3; r: number; s: number }[] = [];
    let k = 0;
    levels.forEach((y, li) => {
      let zz = z0 + 0.1;
      while (zz < z1 - 0.12) {
        const f = forms[(k * 5 + li * 3) % forms.length];
        const s = f === 'jar' || f === 'planter' ? 0.8 : 1;
        const w = f === 'bowl' ? 0.19 : f === 'planter' ? 0.18 : f === 'jar' ? 0.15 : 0.11;
        if (zz + w / 2 > z1 - 0.06) break;
        out.push({ f, p: [x + Math.sin(k * 3.1) * 0.03, FY + y + 0.025, zz + w / 2], r: k * 1.7, s });
        zz += w + 0.025;
        k++;
      }
    });
    return out;
  }, [x]);
  return (
    <group>
      {[z0, z1].flatMap((z) =>
        [x - 0.19, x + 0.19].map((xx) => (
          <mesh key={`${z}:${xx}`} position={[xx, FY + 0.9, z]} material={m.steel} castShadow>
            <cylinderGeometry args={[0.014, 0.014, 1.8, 8]} />
          </mesh>
        )),
      )}
      {levels.map((y) => (
        <Slab key={y} mat={m.woodWorn} position={[x, FY + y + 0.012, (z0 + z1) / 2]} size={[0.42, 0.025, z1 - z0 + 0.04]} r={0.006} uv={1.2} />
      ))}
      {items.map((it, i) => (
        <Vessel key={i} m={m} form={it.f} body="bisque" position={it.p} rotation={it.r} scale={it.s} seed={300 + i} segments={40} />
      ))}
    </group>
  );
}
