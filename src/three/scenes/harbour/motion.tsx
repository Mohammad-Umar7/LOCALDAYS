import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { sagCurve } from '../../props/geo';
import type { Vec3 } from '../../core/types';
import { shelterAt } from './layout';
import { sampleWaves, type WaterSample } from './waves';

/* ------------------------------------------------------------------ */
/*  Floating motion: boats sample the CPU twin of the wave field at    */
/*  bow, stern and both beams, then heave / pitch / roll toward it     */
/*  with inertia. Mooring lines are one merged mesh whose boat ends    */
/*  stretch with the hulls in the vertex shader.                       */
/* ------------------------------------------------------------------ */

export interface Pose {
  x: number;
  z: number;
  yaw: number;
}

export interface FloatOpts {
  halfL: number;
  halfB: number;
  /** response time constant (s) — heavier hulls lag more */
  tau?: number;
  rollGain?: number;
  pitchGain?: number;
  /** extra sit-down (+) / lift (−) of the waterline */
  sink?: number;
  seed?: number;
  /** slow mooring yaw drift amplitude (radians) */
  drift?: number;
}

export function useFloat(ref: MutableRefObject<THREE.Object3D | null>, pose: Pose, o: FloatOpts) {
  const st = useRef({ heave: 0, pitch: 0, roll: 0, init: false });
  const shelter = useMemo(() => shelterAt(pose.x, pose.z), [pose.x, pose.z]);
  const s = useMemo<WaterSample>(() => ({ y: 0, nx: 0, ny: 1, nz: 0 }), []);
  useFrame(({ clock }, dt) => {
    const obj = ref.current;
    if (!obj) return;
    const t = clock.elapsedTime;
    const seed = o.seed ?? 0;
    const yaw = pose.yaw + Math.sin(t * 0.11 + seed) * (o.drift ?? 0.01) + Math.sin(t * 0.053 + seed * 2.1) * (o.drift ?? 0.01) * 0.6;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const sx = Math.cos(yaw);
    const sz = -Math.sin(yaw);
    const h = (dx: number, dz: number) => sampleWaves(pose.x + dx, pose.z + dz, t, shelter, 0, s).y;
    const hb = h(fx * o.halfL, fz * o.halfL);
    const hs = h(-fx * o.halfL, -fz * o.halfL);
    const hp = h(-sx * o.halfB, -sz * o.halfB);
    const hsb = h(sx * o.halfB, sz * o.halfB);
    const hc = h(0, 0);
    const heave = (hb + hs + hp + hsb + hc * 2) / 6;
    const pitch = Math.atan2(hb - hs, o.halfL * 2) * (o.pitchGain ?? 1);
    const roll = Math.atan2(hsb - hp, o.halfB * 2) * (o.rollGain ?? 1.6);
    const k = st.current.init ? 1 - Math.exp(-Math.min(dt, 0.1) / (o.tau ?? 0.5)) : 1;
    st.current.init = true;
    st.current.heave += (heave - st.current.heave) * k;
    st.current.pitch += (pitch - st.current.pitch) * k;
    st.current.roll += (roll - st.current.roll) * k;
    obj.position.set(pose.x, st.current.heave - (o.sink ?? 0), pose.z);
    obj.rotation.set(-st.current.pitch, yaw, st.current.roll, 'YXZ');
  });
}

/* ------------------------------- Mooring lines ------------------------------ */

export interface LineSpec {
  /** fixed end (world) */
  from: Vec3;
  /** boat the other end is tied to and the attachment in boat-local space */
  boat: MutableRefObject<THREE.Object3D | null>;
  local: Vec3;
  /** rest pose of that boat (to compute the rest attachment point) */
  pose: Pose;
  sag?: number;
  radius?: number;
}

const MAX_LINES = 12;

export function MooringLines({ lines, material }: { lines: LineSpec[]; material: THREE.MeshStandardMaterial }) {
  const offsets = useMemo(() => ({ value: Array.from({ length: MAX_LINES }, () => new THREE.Vector3()) }), []);
  const rest = useMemo(
    () =>
      lines.map((l) => {
        const o = new THREE.Object3D();
        o.position.set(l.pose.x, 0, l.pose.z);
        o.rotation.set(0, l.pose.yaw, 0, 'YXZ');
        o.updateMatrixWorld();
        return o.localToWorld(new THREE.Vector3(...l.local));
      }),
    [lines],
  );
  const geo = useMemo(() => {
    const parts = lines.map((l, i) => {
      const a = new THREE.Vector3(...l.from);
      const b = rest[i];
      const pts = sagCurve(a, b, l.sag ?? 0.35, 20);
      const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, l.radius ?? 0.022, 6, false);
      const uv = g.attributes.uv as THREE.BufferAttribute;
      const n = uv.count;
      const tAttr = new Float32Array(n);
      const idAttr = new Float32Array(n);
      for (let k = 0; k < n; k++) {
        tAttr[k] = uv.getX(k);
        idAttr[k] = i;
        uv.setXY(k, uv.getY(k), uv.getX(k) * a.distanceTo(b) * 3);
      }
      g.setAttribute('aRopeT', new THREE.BufferAttribute(tAttr, 1));
      g.setAttribute('aRopeId', new THREE.BufferAttribute(idAttr, 1));
      return g;
    });
    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    const col = new Float32Array(merged.attributes.position.count * 3);
    const c = new THREE.Color('#CDB894');
    for (let i = 0; i < col.length; i += 3) {
      col[i] = c.r;
      col[i + 1] = c.g;
      col[i + 2] = c.b;
    }
    merged.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return merged;
  }, [lines, rest]);
  useEffect(() => () => geo.dispose(), [geo]);

  const mat = useMemo(() => {
    const m = material.clone();
    m.onBeforeCompile = (s) => {
      s.uniforms.uRopeOff = offsets;
      s.vertexShader = s.vertexShader
        .replace('#include <common>', `#include <common>\nattribute float aRopeT;\nattribute float aRopeId;\nuniform vec3 uRopeOff[${MAX_LINES}];`)
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           float rt = smoothstep(0.0, 1.0, aRopeT);
           transformed += uRopeOff[int(aRopeId + 0.5)] * rt;`,
        );
    };
    m.customProgramCacheKey = () => 'hb-mooring';
    return m;
  }, [material, offsets]);

  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    lines.forEach((l, i) => {
      const b = l.boat.current;
      if (!b || i >= MAX_LINES) return;
      b.updateMatrixWorld();
      tmp.set(...l.local);
      b.localToWorld(tmp);
      offsets.value[i].copy(tmp).sub(rest[i]);
    });
  });

  return <mesh geometry={geo} material={mat} castShadow frustumCulled={false} userData={{ noBatch: true }} />;
}

/* ------------------------------ Floating buoys ------------------------------ */

export interface BuoySpec {
  position: [number, number];
  scale?: number;
  color: string;
}

/** Instanced floats riding the waves (mooring buoys, net-line floats). */
export function Buoys({ items, geometry, material, sink = 0.0 }: { items: BuoySpec[]; geometry: THREE.BufferGeometry; material: THREE.Material; sink?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const shelter = useMemo(() => items.map((b) => shelterAt(b.position[0], b.position[1])), [items]);
  const s = useMemo<WaterSample>(() => ({ y: 0, nx: 0, ny: 1, nz: 0 }), []);
  const o = useMemo(() => new THREE.Object3D(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const n = useMemo(() => new THREE.Vector3(), []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const c = new THREE.Color();
    items.forEach((b, i) => m.setColorAt(i, c.set(b.color)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [items]);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime;
    items.forEach((b, i) => {
      // floats lag slightly behind the surface
      sampleWaves(b.position[0], b.position[1], t - 0.15, shelter[i], 0, s);
      o.position.set(b.position[0], s.y - sink * (b.scale ?? 1), b.position[1]);
      n.set(s.nx, s.ny, s.nz);
      o.quaternion.setFromUnitVectors(up, n);
      o.rotateY(i * 1.7 + t * 0.05);
      o.scale.setScalar(b.scale ?? 1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow frustumCulled={false} />;
}
