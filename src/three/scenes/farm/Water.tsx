import { useMemo } from 'react';
import * as THREE from 'three';
import { getTexSet, repeatSet } from '../../materials/textures';
import { boxProjectUVs, roundedBox, tubeAlong } from '../../props/geo';
import { BED_Z } from './Garden';
import type { FarmMaterials } from './materials';
import type { Vec3 } from '../../core/types';

/* ------------------------------------------------------------------ */
/*  Traditional falaj channel feeding a stone pool, beside a modern    */
/*  solar-powered drip-irrigation station that waters the beds.        */
/* ------------------------------------------------------------------ */

export const FALAJ_PATH: [number, number][] = [
  [2.4, -40],
  [2.6, -30],
  [1.8, -21],
  [2.2, -13],
  [2.0, -7.4],
];
export const POOL = { x: 2.0, z: -5.6, w: 3.2, d: 2.4 };

/** Extrudes a profile along a 2D path on the ground. */
function channelGeometry(path: [number, number][], halfWidth: number, y0: number, y1: number, offset: number) {
  const curve = new THREE.CatmullRomCurve3(path.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const n = 120;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const prof: [number, number][] = [
    [offset - halfWidth, y0],
    [offset - halfWidth, y1],
    [offset + halfWidth, y1],
    [offset + halfWidth, y0],
  ];
  const len = curve.getLength();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t);
    const tg = curve.getTangentAt(t);
    const side = new THREE.Vector3(-tg.z, 0, tg.x);
    for (let k = 0; k < prof.length; k++) {
      const [o, y] = prof[k];
      pos.push(p.x + side.x * o, y, p.z + side.z * o);
      uv.push(k / (prof.length - 1), t * len * 0.8);
    }
  }
  for (let i = 0; i < n; i++)
    for (let k = 0; k < prof.length - 1; k++) {
      const a = i * prof.length + k;
      const b = a + prof.length;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function stripGeometry(path: [number, number][], halfWidth: number, y: number) {
  const curve = new THREE.CatmullRomCurve3(path.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const n = 120;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const len = curve.getLength();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t);
    const tg = curve.getTangentAt(t);
    const side = new THREE.Vector3(-tg.z, 0, tg.x);
    pos.push(p.x - side.x * halfWidth, y, p.z - side.z * halfWidth, p.x + side.x * halfWidth, y, p.z + side.z * halfWidth);
    uv.push(0, t * len, 1, t * len);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    // counter-clockwise seen from above, so the strip faces up
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function solarTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0E1A2E';
  g.fillRect(0, 0, 256, 512);
  for (let y = 0; y < 10; y++)
    for (let x = 0; x < 6; x++) {
      const grd = g.createLinearGradient(0, 0, 40, 48);
      grd.addColorStop(0, '#1C3355');
      grd.addColorStop(1, '#13253F');
      g.fillStyle = grd;
      g.fillRect(6 + x * 41.5, 6 + y * 50, 38, 46);
      g.strokeStyle = 'rgba(190,200,215,0.35)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(6 + x * 41.5 + 19, 6 + y * 50);
      g.lineTo(6 + x * 41.5 + 19, 6 + y * 50 + 46);
      g.stroke();
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function Water({ m }: { m: FarmMaterials }) {
  const stoneSet = useMemo(() => repeatSet(getTexSet('stone', { base: '#CDB794', dark: '#A48C69', mortar: '#7E6C57', cells: 5, seed: 17 }), 1, 1), []);
  const stoneMat = useMemo(() => new THREE.MeshStandardMaterial({ ...stoneSet, roughness: 0.95 }), [stoneSet]);
  const curbL = useMemo(() => channelGeometry(FALAJ_PATH, 0.16, 0, 0.26, -0.42), []);
  const curbR = useMemo(() => channelGeometry(FALAJ_PATH, 0.16, 0, 0.26, 0.42), []);
  const bed = useMemo(() => stripGeometry(FALAJ_PATH, 0.3, 0.015), []);
  const surface = useMemo(() => stripGeometry(FALAJ_PATH, 0.29, 0.12), []);
  const solarMap = useMemo(() => solarTexture(), []);

  // Main drip line → header pipe along the bed ends → laterals on each bed
  const header = useMemo(
    () =>
      tubeAlong(
        [
          new THREE.Vector3(5.6, 0.08, -4.2),
          new THREE.Vector3(6.4, 0.06, -1.8),
          new THREE.Vector3(7.1, 0.06, 0.6),
          new THREE.Vector3(7.15, 0.06, 5),
          new THREE.Vector3(7.15, 0.06, 10.6),
        ],
        0.03,
        6,
      ),
    [],
  );

  const poolRim = useMemo(() => {
    const items: { p: Vec3; s: Vec3 }[] = [];
    const { x, z, w, d } = POOL;
    items.push({ p: [x, 0.18, z - d / 2], s: [w + 0.5, 0.36, 0.28] });
    items.push({ p: [x, 0.18, z + d / 2], s: [w + 0.5, 0.36, 0.28] });
    items.push({ p: [x - w / 2, 0.18, z], s: [0.28, 0.36, d] });
    items.push({ p: [x + w / 2, 0.18, z], s: [0.28, 0.36, d] });
    return items.map((it) => ({ ...it, g: boxProjectUVs(roundedBox(it.s[0], it.s[1], it.s[2], 0.05, 2).clone(), 0.6) }));
  }, []);

  return (
    <group>
      {/* Falaj channel */}
      <mesh geometry={curbL} material={stoneMat} castShadow receiveShadow />
      <mesh geometry={curbR} material={stoneMat} castShadow receiveShadow />
      <mesh geometry={bed} receiveShadow>
        <meshStandardMaterial color="#5B4D3A" roughness={1} />
      </mesh>
      <mesh geometry={surface} material={m.water} receiveShadow />

      {/* Stone pool (birka) */}
      {poolRim.map((it, i) => (
        <mesh key={i} geometry={it.g} material={stoneMat} position={it.p} castShadow receiveShadow />
      ))}
      <mesh position={[POOL.x, 0.02, POOL.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[POOL.w, POOL.d]} />
        <meshStandardMaterial color="#3F4C40" roughness={1} />
      </mesh>
      <mesh position={[POOL.x, 0.24, POOL.z]} rotation={[-Math.PI / 2, 0, 0]} material={m.stillWater} receiveShadow>
        <planeGeometry args={[POOL.w - 0.1, POOL.d - 0.1]} />
      </mesh>

      {/* Drip station */}
      <group position={[5.6, 0, -5.4]}>
        <mesh position={[0, 0.06, 0]} receiveShadow>
          <boxGeometry args={[3.2, 0.12, 2.2]} />
          <meshStandardMaterial color="#BDB3A3" roughness={0.95} />
        </mesh>
        {/* water tank */}
        <mesh position={[-0.6, 0.95, -0.2]} castShadow receiveShadow material={m.blueTank}>
          <cylinderGeometry args={[0.72, 0.72, 1.65, 40]} />
        </mesh>
        {[0.35, 0.75, 1.15, 1.55].map((y) => (
          <mesh key={y} position={[-0.6, y, -0.2]} rotation={[Math.PI / 2, 0, 0]} material={m.blueTank} castShadow>
            <torusGeometry args={[0.73, 0.025, 8, 48]} />
          </mesh>
        ))}
        <mesh position={[-0.6, 1.85, -0.2]} material={m.blueTank} castShadow>
          <cylinderGeometry args={[0.22, 0.25, 0.1, 24]} />
        </mesh>
        {/* pump + filter */}
        <mesh position={[0.55, 0.32, 0.3]} castShadow geometry={roundedBox(0.5, 0.36, 0.34, 0.05, 3)}>
          <meshStandardMaterial color="#3C4A55" metalness={0.5} roughness={0.45} />
        </mesh>
        <mesh position={[0.95, 0.42, 0.3]} castShadow material={m.glass}>
          <cylinderGeometry args={[0.1, 0.1, 0.55, 24]} />
        </mesh>
        <mesh geometry={tubeAlong([new THREE.Vector3(-0.1, 0.25, 0.1), new THREE.Vector3(0.2, 0.25, 0.3), new THREE.Vector3(0.35, 0.3, 0.3)], 0.035, 8)} material={m.pipe} />
        {/* moisture sensor */}
        <group position={[1.3, 0, -0.6]}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <cylinderGeometry args={[0.02, 0.02, 1, 6]} />
            <primitive object={m.galvanised} attach="material" />
          </mesh>
          <mesh position={[0, 1.02, 0]} castShadow geometry={roundedBox(0.18, 0.12, 0.06, 0.02, 2)}>
            <meshStandardMaterial color="#EDEDE6" roughness={0.4} />
          </mesh>
          <mesh position={[0, 1.02, 0.032]}>
            <planeGeometry args={[0.12, 0.06]} />
            <meshStandardMaterial color="#0d2a1a" emissive="#4BE38A" emissiveIntensity={1.2} />
          </mesh>
        </group>
      </group>

      {/* Solar panel on an angled frame: short legs at the front, tall at the back, panel resting on both */}
      <group position={[8.6, 0, -6.4]} rotation={[0, -0.5, 0]}>
        {[-0.9, 0.9].map((x) => (
          <group key={x}>
            <mesh position={[x, 0.6, 0.45]} castShadow material={m.galvanised}>
              <boxGeometry args={[0.06, 1.2, 0.06]} />
            </mesh>
            <mesh position={[x, 0.92, -0.45]} castShadow material={m.galvanised}>
              <boxGeometry args={[0.06, 1.84, 0.06]} />
            </mesh>
            {/* diagonal brace */}
            <mesh position={[x, 0.75, 0]} rotation={[-0.6, 0, 0]} castShadow material={m.galvanised}>
              <boxGeometry args={[0.04, 1.1, 0.04]} />
            </mesh>
          </group>
        ))}
        <group position={[0, 1.55, 0]} rotation={[0.62, 0, 0]}>
          <mesh castShadow geometry={roundedBox(2.1, 0.06, 1.25, 0.02, 2)} material={m.galvanised} />
          <mesh position={[0, 0.032, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2.02, 1.18]} />
            <meshPhysicalMaterial map={solarMap} metalness={0.3} roughness={0.12} clearcoat={1} clearcoatRoughness={0.04} />
          </mesh>
        </group>
      </group>

      {/* Drip header + laterals */}
      <mesh geometry={header} material={m.pipe} />
      {BED_Z.map((z) => (
        <group key={z}>
          {[-0.2, 0.2].map((dz) => (
            <mesh key={dz} position={[12, 0.38, z + dz]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.009, 0.009, 8.6, 5]} />
              <primitive object={m.pipe} attach="material" />
            </mesh>
          ))}
          <mesh geometry={tubeAlong([new THREE.Vector3(7.15, 0.06, z), new THREE.Vector3(7.5, 0.3, z), new THREE.Vector3(7.7, 0.38, z)], 0.018, 5)} material={m.pipe} />
        </group>
      ))}
    </group>
  );
}
