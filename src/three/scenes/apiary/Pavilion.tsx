import { memo, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Lantern, StringLights } from '../../props/Decor';
import { roundedBox, smoothLathe, tubeAlong } from '../../props/geo';
import type { Quality, Vec3 } from '../../core/types';
import { CombBees } from './Bees';
import { grainBox, type ApiaryMaterials } from './materials';
import { areesh } from './tex';
import { OBS_EXIT, PAV_DECK, PAVILION, pavilionGround } from './layout';

/* ------------------------------------------------------------------ */
/*  Safe observation pavilion: a hexagonal timber pavilion with a      */
/*  palm-frond (areesh) roof that throws dappled shade, fine insect    */
/*  screens, benches, and a glass observation hive at its heart whose  */
/*  clear tube lets the colony fly out the back.                       */
/* ------------------------------------------------------------------ */

const R_POST = 2.62;
const POST_H = 2.42;
const EAVE_R = 3.25;
const APEX_H = 1.62;
const deg = Math.PI / 180;
/** Vertex k sits at 30° + 60°k; side k (vertex k → k+1) faces 60° + 60°k. Side 5 (+X) holds the door. */
const vAng = (k: number) => (30 + 60 * k) * deg;
const sAng = (k: number) => (60 + 60 * k) * deg;
const DOOR_SIDE = 5;

function sideTransform(k: number, inset: number): { p: Vec3; yaw: number } {
  const a = sAng(k);
  const ap = R_POST * Math.cos(30 * deg) - inset;
  return { p: [Math.cos(a) * ap, 0, Math.sin(a) * ap], yaw: Math.atan2(Math.cos(a), Math.sin(a)) };
}

function hexShape(r: number) {
  const s = new THREE.Shape();
  for (let k = 0; k < 6; k++) {
    const a = vAng(k);
    if (k === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

function hexSlab(r: number, h: number, bevel: number) {
  const g = new THREE.ExtrudeGeometry(hexShape(r), { depth: h - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2 });
  g.rotateX(Math.PI / 2);
  g.translate(0, h - bevel, 0);
  return g;
}

/** Hexagonal pyramid roof built from six planar faces with affine per-face UVs (fronds run straight down each slope). */
function roofGeometry(r: number, h: number) {
  const pos: number[] = [];
  const uv: number[] = [];
  const apex = new THREE.Vector3(0, h / 2, 0);
  for (let k = 0; k < 6; k++) {
    const a0 = vAng(k);
    const a1 = vAng(k + 1);
    const p0 = new THREE.Vector3(Math.cos(a0) * r, -h / 2, Math.sin(a0) * r);
    const p1 = new THREE.Vector3(Math.cos(a1) * r, -h / 2, Math.sin(a1) * r);
    const mid = p0.clone().lerp(p1, 0.5);
    const e = p1.clone().sub(p0).normalize();
    const sdir = apex.clone().sub(mid).normalize();
    const uvOf = (p: THREE.Vector3) => [p.clone().sub(mid).dot(e) * 0.62 + k * 0.37, p.clone().sub(mid).dot(sdir) * 0.62];
    // outward winding (counter-clockwise seen from outside)
    for (const p of [p0, apex, p1]) {
      pos.push(p.x, p.y, p.z);
      uv.push(...uvOf(p));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  // make sure normals face outward/up
  const n = g.attributes.normal as THREE.BufferAttribute;
  if (n.getY(0) < 0) {
    const idx = [] as number[];
    for (let i = 0; i < 6; i++) idx.push(i * 3, i * 3 + 2, i * 3 + 1);
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}

function Screen({ m, w, h, y }: { m: ApiaryMaterials; w: number; h: number; y: number }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w * 21, uv.getY(i) * h * 21);
    return g;
  }, [w, h]);
  return <mesh geometry={geo} material={m.screen} position={[0, y + h / 2, 0]} renderOrder={3} />;
}

/** Glass observation hive on a pedestal: two combs behind glass, shutters folded open, bees inside. */
function ObservationHive({ m, quality, yaw }: { m: ApiaryMaterials; quality: Quality; yaw: number }) {
  const combGeo = useMemo(() => new THREE.BoxGeometry(0.44, 0.215, 0.026), []);
  const cabW = 0.56;
  const cabH = 0.6;
  const cabD = 0.1;
  const y0 = 0.82;
  const tube = useMemo(() => {
    // from the cabinet base, down the pedestal side and out through the back-left wall
    const exit = new THREE.Vector3(OBS_EXIT.x - PAVILION.x, OBS_EXIT.y - PAV_DECK, OBS_EXIT.z - PAVILION.z);
    const start = new THREE.Vector3(cabW / 2 - 0.06, y0 - 0.02, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const mid1 = start.clone().add(new THREE.Vector3(0, -0.18, 0));
    const mid2 = start.clone().lerp(exit, 0.5).setY(0.5);
    return tubeAlong([start, mid1, mid2, exit.clone().multiplyScalar(0.94).setY(exit.y - 0.04), exit], 0.017, 10);
  }, [yaw]);
  return (
    <group>
      <mesh geometry={tube} material={m.tube} renderOrder={4} />
      <group rotation={[0, yaw, 0]}>
        {/* pedestal */}
        <mesh geometry={roundedBox(0.44, 0.05, 0.36, 0.015, 2)} material={m.timberDark} position={[0, 0.025, 0]} castShadow receiveShadow />
        <mesh geometry={grainBox(0.11, y0 - 0.05, 0.11, 0.01, 1.5)} material={m.timberDark} position={[0, (y0 - 0.05) / 2 + 0.05, 0]} castShadow receiveShadow />
        <mesh geometry={grainBox(0.5, 0.04, 0.18, 0.008, 1.5)} material={m.timberDark} position={[0, y0 - 0.02, 0]} castShadow receiveShadow />
        {/* cabinet frame */}
        <group position={[0, y0, 0]}>
          <mesh geometry={grainBox(cabW, 0.045, cabD, 0.008, 1.5)} material={m.timber} position={[0, 0.0225, 0]} castShadow />
          <mesh geometry={grainBox(cabW + 0.04, 0.05, cabD + 0.04, 0.01, 1.5)} material={m.timber} position={[0, cabH - 0.02, 0]} castShadow />
          <mesh geometry={grainBox(0.045, cabH, cabD, 0.008, 1.5)} material={m.timber} position={[-cabW / 2 + 0.0225, cabH / 2, 0]} castShadow />
          <mesh geometry={grainBox(0.045, cabH, cabD, 0.008, 1.5)} material={m.timber} position={[cabW / 2 - 0.0225, cabH / 2, 0]} castShadow />
          <mesh geometry={grainBox(cabW - 0.09, 0.02, cabD - 0.03, 0.004, 1.5)} material={m.timberGrey} position={[0, 0.29, 0]} />
          <mesh geometry={combGeo} material={m.comb} position={[0, 0.17, 0]} receiveShadow />
          <mesh geometry={combGeo} material={m.comb} position={[0, 0.41, 0]} receiveShadow />
          {quality !== 'low' && (
            <>
              <group position={[0, 0.29, 0]}>
                <CombBees width={0.42} height={0.44} depth={0.026} count={quality === 'high' ? 60 : 32} seed={3} />
              </group>
            </>
          )}
          {/* glass both sides */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0, cabH / 2, s * (cabD / 2 - 0.004)]} material={m.glass} renderOrder={5}>
              <planeGeometry args={[cabW - 0.08, cabH - 0.09]} />
            </mesh>
          ))}
          {/* shutters folded open */}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * (cabW / 2), 0, cabD / 2 + 0.01]} rotation={[0, s * 1.9, 0]}>
              <mesh geometry={grainBox(cabW / 2 - 0.01, cabH - 0.04, 0.018, 0.004, 1.5)} material={m.timber} position={[-s * (cabW / 4), cabH / 2, 0]} castShadow />
            </group>
          ))}
          {/* feeder jar on top */}
          <mesh position={[0.12, cabH + 0.05, 0]} material={m.glass} renderOrder={4}>
            <cylinderGeometry args={[0.04, 0.04, 0.09, 20]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function Bench({ m, len }: { m: ApiaryMaterials; len: number }) {
  return (
    <group>
      {[-0.11, 0.0, 0.11].map((dz) => (
        <mesh key={dz} geometry={grainBox(len, 0.035, 0.1, 0.008, 1.2)} material={m.timber} position={[0, 0.45, dz]} castShadow receiveShadow />
      ))}
      {[-len / 2 + 0.12, len / 2 - 0.12].map((x) => (
        <group key={x}>
          <mesh geometry={grainBox(0.05, 0.43, 0.3, 0.008, 1.2)} material={m.timberDark} position={[x, 0.215, 0]} castShadow receiveShadow />
        </group>
      ))}
    </group>
  );
}

function SideWall({ m, k, quality }: { m: ApiaryMaterials; k: number; quality: Quality }) {
  const { p, yaw } = sideTransform(k, 0);
  const len = R_POST - 0.13;
  const kickH = 0.84;
  const scrH = POST_H - kickH - 0.12;
  const door = k === DOOR_SIDE;
  const boards = useMemo(() => {
    const n = 9;
    return Array.from({ length: n }, (_, i) => -len / 2 + (i + 0.5) * (len / n));
  }, [len]);
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      {!door && (
        <>
          {/* board-and-batten kick wall */}
          <mesh geometry={grainBox(len, kickH, 0.035, 0.006, 1.2)} material={m.timber} position={[0, kickH / 2, 0]} castShadow receiveShadow />
          {boards.map((x, i) => (
            <mesh key={i} geometry={grainBox(0.035, kickH - 0.06, 0.02, 0.005, 1.2)} material={m.timberDark} position={[x, kickH / 2, 0.026]} castShadow={quality === 'high'} receiveShadow />
          ))}
          <mesh geometry={grainBox(len + 0.02, 0.06, 0.09, 0.01, 1.2)} material={m.timberDark} position={[0, kickH + 0.03, 0.01]} castShadow receiveShadow />
          <group position={[0, 0, 0.0]}>
            <Screen m={m} w={len} h={scrH} y={kickH + 0.06} />
          </group>
          <mesh geometry={grainBox(0.05, scrH, 0.05, 0.008, 1.2)} material={m.timberDark} position={[0, kickH + 0.06 + scrH / 2, 0.01]} castShadow receiveShadow />
        </>
      )}
      {door && (
        <>
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh geometry={grainBox(0.5, kickH, 0.035, 0.006, 1.2)} material={m.timber} position={[s * (len / 2 - 0.25), kickH / 2, 0]} castShadow receiveShadow />
              <group position={[s * (len / 2 - 0.25), 0, 0]}>
                <Screen m={m} w={0.5} h={scrH} y={kickH + 0.06} />
              </group>
              <mesh geometry={grainBox(0.52, 0.06, 0.09, 0.01, 1.2)} material={m.timberDark} position={[s * (len / 2 - 0.25), kickH + 0.03, 0.01]} castShadow />
              {/* door jambs */}
              <mesh geometry={grainBox(0.08, 2.12, 0.1, 0.01, 1.2)} material={m.timberDark} position={[s * 0.5, 1.06, 0.01]} castShadow receiveShadow />
            </group>
          ))}
          <mesh geometry={grainBox(1.08, 0.1, 0.1, 0.01, 1.2)} material={m.timberDark} position={[0, 2.15, 0.01]} castShadow />
          <Screen m={m} w={len} h={POST_H - 2.2} y={2.2} />
          {/* screen door, swung open on its left hinge */}
          <group position={[-0.46, 0.02, 0.04]} rotation={[0, -1.95, 0]}>
          <group position={[0.46, 0, 0]}>
            <mesh geometry={grainBox(0.06, 2.06, 0.04, 0.008, 1.2)} material={m.timber} position={[-0.43, 1.03, 0]} castShadow />
            <mesh geometry={grainBox(0.06, 2.06, 0.04, 0.008, 1.2)} material={m.timber} position={[0.43, 1.03, 0]} castShadow />
            <mesh geometry={grainBox(0.8, 0.07, 0.04, 0.008, 1.2)} material={m.timber} position={[0, 2.03, 0]} castShadow />
            <mesh geometry={grainBox(0.8, 0.07, 0.04, 0.008, 1.2)} material={m.timber} position={[0, 0.88, 0]} castShadow />
            <mesh geometry={grainBox(0.8, 0.82, 0.025, 0.006, 1.2)} material={m.timber} position={[0, 0.45, 0]} castShadow />
            <group position={[0, 0, 0]}>
              <Screen m={m} w={0.8} h={1.08} y={0.915} />
            </group>
            <mesh geometry={roundedBox(0.03, 0.14, 0.03, 0.01, 2)} material={m.brass} position={[0.34, 1.0, 0.035]} castShadow />
          </group>
          </group>
          {/* threshold */}
          <mesh geometry={grainBox(0.94, 0.03, 0.16, 0.008, 1.2)} material={m.timberDark} position={[0, 0.015, 0.02]} receiveShadow />
        </>
      )}
    </group>
  );
}

function InfoLectern({ m, position, yaw }: { m: ApiaryMaterials; position: Vec3; yaw: number }) {
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      {[-0.36, 0.36].map((x) => (
        <mesh key={x} geometry={grainBox(0.07, 1.05, 0.07, 0.01, 1.3)} material={m.timberDark} position={[x, 0.5, 0]} castShadow receiveShadow />
      ))}
      <group position={[0, 1.02, 0.02]} rotation={[-0.55, 0, 0]}>
        <mesh geometry={grainBox(0.86, 0.66, 0.04, 0.01, 1.3)} material={m.timberDark} castShadow receiveShadow />
        <mesh position={[0, 0, 0.0215]} material={m.info}>
          <planeGeometry args={[0.78, 0.585]} />
        </mesh>
      </group>
    </group>
  );
}

export const Pavilion = memo(function Pavilion({ m, quality, lit }: { m: ApiaryMaterials; quality: Quality; lit: boolean }) {
  const gy = pavilionGround();
  const plinth = useMemo(() => hexSlab(2.98, 0.2 + 0.25, 0.035), []);
  const deck = useMemo(() => {
    const g = hexSlab(2.8, 0.08, 0.012);
    g.translate(0, PAV_DECK - 0.08 + 0.25, 0);
    return g;
  }, []);
  const thatch = useMemo(() => {
    const set = areesh();
    const mat = new THREE.MeshStandardMaterial({
      map: set.map,
      normalMap: set.normalMap,
      alphaMap: set.alphaMap,
      alphaTest: 0.5,
      roughness: 0.95,
      side: THREE.DoubleSide,
      normalScale: new THREE.Vector2(1.2, 1.2),
    });
    return mat;
  }, []);
  const underMat = useMemo(() => {
    const set = areesh();
    return new THREE.MeshStandardMaterial({ map: set.map, color: '#8A7656', roughness: 1, side: THREE.DoubleSide });
  }, []);
  const roofGeo = useMemo(() => roofGeometry(EAVE_R, APEX_H + (EAVE_R - R_POST) * (APEX_H / R_POST)), []);
  const roofH = APEX_H + (EAVE_R - R_POST) * (APEX_H / R_POST);
  const eaveY = PAV_DECK + POST_H - (EAVE_R - R_POST) * (APEX_H / R_POST);

  const rafters = useMemo(() => {
    // hip rafters to every vertex and common rafters to every side midpoint
    const out: { p: THREE.Vector3; q: THREE.Quaternion; len: number }[] = [];
    const apex = new THREE.Vector3(0, PAV_DECK + POST_H + APEX_H, 0);
    for (let k = 0; k < 12; k++) {
      const a = (15 + 30 * k + 15) * deg;
      const rr = k % 2 === 0 ? EAVE_R - 0.05 : (EAVE_R - 0.05) * Math.cos(30 * deg);
      const foot = new THREE.Vector3(Math.cos(a) * rr, eaveY - 0.08, Math.sin(a) * rr);
      const dir = apex.clone().sub(foot);
      const len = dir.length();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
      out.push({ p: foot.clone().lerp(apex, 0.5).add(new THREE.Vector3(0, -0.06, 0)), q, len });
    }
    return out;
  }, [eaveY]);
  const rafterGeo = useMemo(() => grainBox(1, 0.11, 0.07, 0.01, 1.2), []);

  const ring = useMemo(() => {
    const out: { p: Vec3; yaw: number; len: number }[] = [];
    for (let k = 0; k < 6; k++) {
      const { p, yaw } = sideTransform(k, 0);
      out.push({ p: [p[0], PAV_DECK + POST_H - 0.08, p[2]], yaw, len: R_POST + 0.12 });
    }
    return out;
  }, []);

  const fascia = useMemo(() => {
    const out: { p: Vec3; yaw: number; len: number }[] = [];
    for (let k = 0; k < 6; k++) {
      const a = sAng(k);
      const ap = EAVE_R * Math.cos(30 * deg);
      out.push({ p: [Math.cos(a) * ap, eaveY - 0.02, Math.sin(a) * ap], yaw: Math.atan2(Math.cos(a), Math.sin(a)), len: EAVE_R });
    }
    return out;
  }, [eaveY]);

  const hiveYaw = 60 * deg;
  const benchSides = [0, 1, 2, 3];
  const lanternRing = useMemo(() => [1, 3].map((k) => vAng(k)), []);
  const eaveLights = useMemo(() => {
    const pts: Vec3[] = [];
    // open ring: no string across the doorway side
    for (let k = 0; k <= 5; k++) {
      const a = vAng(k);
      pts.push([Math.cos(a) * (EAVE_R - 0.12), eaveY - 0.12, Math.sin(a) * (EAVE_R - 0.12)]);
    }
    return pts;
  }, [eaveY]);
  const capGeo = useMemo(() => smoothLathe([[0.001, 0.42], [0.04, 0.4], [0.07, 0.3], [0.2, 0.08], [0.34, 0.0], [0.001, 0.0]], 6, 10), []);
  const thatchUnder = useMemo(() => {
    const g = roofGeo.clone();
    g.scale(0.985, 1, 0.985);
    return g;
  }, [roofGeo]);
  const eaveRim = useMemo(() => {
    // thick lower edge of the thatch so it doesn't read paper-thin
    const parts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 6; k++) {
      const a0 = vAng(k);
      const a1 = vAng(k + 1);
      const p0 = new THREE.Vector3(Math.cos(a0) * EAVE_R, 0, Math.sin(a0) * EAVE_R);
      const p1 = new THREE.Vector3(Math.cos(a1) * EAVE_R, 0, Math.sin(a1) * EAVE_R);
      const len = p0.distanceTo(p1);
      const g = new THREE.CylinderGeometry(0.06, 0.06, len, 8, 1);
      g.rotateZ(Math.PI / 2);
      g.rotateY(-Math.atan2(p1.z - p0.z, p1.x - p0.x));
      const mid = p0.clone().lerp(p1, 0.5);
      g.translate(mid.x, 0, mid.z);
      parts.push(g);
    }
    return mergeGeometries(parts, false);
  }, []);

  return (
    <group position={[PAVILION.x, gy - 0.25, PAVILION.z]}>
      <mesh geometry={plinth} material={m.stone} castShadow receiveShadow />
      <group position={[0, 0.25, 0]}>
        <mesh geometry={deck} material={m.deck} position={[0, -0.25, 0]} castShadow receiveShadow />
        {/* steps at the door */}
        {[0, 1].map((i) => (
          <mesh
            key={i}
            geometry={roundedBox(0.42, PAV_DECK - i * 0.11, 1.3, 0.02, 2)}
            material={m.stone}
            position={[R_POST * Math.cos(30 * deg) + 0.38 + i * 0.36, (PAV_DECK - i * 0.11) / 2 - 0.02, 0]}
            castShadow
            receiveShadow
          />
        ))}
        {/* posts */}
        {Array.from({ length: 6 }, (_, k) => {
          const a = vAng(k);
          return (
            <mesh
              key={k}
              geometry={grainBox(0.13, POST_H, 0.13, 0.015, 1.2)}
              material={m.timberDark}
              position={[Math.cos(a) * R_POST, PAV_DECK + POST_H / 2, Math.sin(a) * R_POST]}
              rotation={[0, -a, 0]}
              castShadow
              receiveShadow
            />
          );
        })}
        {/* ring beam */}
        {ring.map((b, i) => (
          <mesh key={i} geometry={grainBox(b.len, 0.16, 0.11, 0.012, 1.2)} material={m.timberDark} position={b.p} rotation={[0, b.yaw, 0]} castShadow receiveShadow />
        ))}
        {/* walls */}
        <group position={[0, PAV_DECK, 0]}>
          {Array.from({ length: 6 }, (_, k) => (
            <SideWall key={k} m={m} k={k} quality={quality} />
          ))}
        </group>
        {/* rafters */}
        {rafters.map((r, i) => (
          <mesh key={i} geometry={rafterGeo} material={m.timberDark} position={r.p} quaternion={r.q} scale={[r.len, 1, 1]} castShadow receiveShadow />
        ))}
        {/* fascia */}
        {fascia.map((f, i) => (
          <mesh key={i} geometry={grainBox(f.len, 0.13, 0.05, 0.01, 1.2)} material={m.timberDark} position={f.p} rotation={[0, f.yaw, 0]} castShadow receiveShadow />
        ))}
        {/* areesh thatch, two staggered layers for depth */}
        <mesh geometry={roofGeo} material={thatch} position={[0, eaveY + roofH / 2 + 0.09, 0]} castShadow receiveShadow />
        <mesh geometry={thatchUnder} material={underMat} position={[0, eaveY + roofH / 2 + 0.02, 0]} receiveShadow />
        <mesh geometry={eaveRim} material={thatch} position={[0, eaveY - 0.01, 0]} castShadow />
        <mesh geometry={capGeo} material={m.timberDark} position={[0, eaveY + roofH - 0.12, 0]} castShadow />
        <mesh position={[0, eaveY + roofH + 0.36, 0]} castShadow material={m.brass}>
          <sphereGeometry args={[0.06, 16, 12]} />
        </mesh>
        {/* interior */}
        <group position={[0, PAV_DECK, 0]}>
          <ObservationHive m={m} quality={quality} yaw={hiveYaw} />
          {benchSides.map((k) => {
            const { p, yaw } = sideTransform(k, 0.34);
            return (
              <group key={k} position={p} rotation={[0, yaw, 0]}>
                <Bench m={m} len={1.7} />
              </group>
            );
          })}
          {/* child step */}
          <group position={[0.5, 0, 0.29]} rotation={[0, hiveYaw, 0]}>
            <mesh geometry={grainBox(0.42, 0.2, 0.28, 0.02, 1.2)} material={m.timber} position={[0, 0.1, 0]} castShadow receiveShadow />
          </group>
        </group>
        <StringLights points={eaveLights} sag={0.16} bulbs={7} lit={lit} />
        {lanternRing.map((a, i) => (
          <Lantern key={i} position={[Math.cos(a) * 1.25, PAV_DECK + 1.95, Math.sin(a) * 1.25]} hanging lit={lit} light={lit && i === 0} scale={0.9} />
        ))}
      </group>
      <InfoLectern m={m} position={[3.45, 0.25, 1.75]} yaw={70 * deg} />
    </group>
  );
});
