import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { smoothLathe } from '../../props/geo';
import type { Quality, Vec3 } from '../../core/types';
import type { ApiaryMaterials } from './materials';

/* ------------------------------------------------------------------ */
/*  Instanced honey jars: amber bodies that glow when backlit, gold    */
/*  or bronze lids, wrap-around labels, and clear empties.            */
/* ------------------------------------------------------------------ */

export const HONEY = {
  sidr: '#8A4A0E',
  samar: '#B8670F',
  wild: '#D9962A',
  ghaf: '#E6B547',
  comb: '#C7801A',
  creamed: '#EAD6A6',
};

const LID_COLORS = ['#D4A64E', '#B98C3E', '#2F3B2E', '#E3C27A'];

export interface JarItem {
  p: Vec3;
  /** overall scale (1 ≈ 500 g jar, 11 cm tall) */
  s?: number;
  honey?: string;
  empty?: boolean;
  lid?: number;
  label?: boolean;
  rot?: number;
}

export const JAR_H = 0.112;

let geos: ReturnType<typeof buildGeos> | null = null;
function buildGeos(seg: number) {
  return {
    seg,
    body: smoothLathe(
      [
        [0.001, 0],
        [0.036, 0],
        [0.041, 0.004],
        [0.0425, 0.02],
        [0.0425, 0.078],
        [0.04, 0.092],
        [0.032, 0.1],
        [0.031, 0.104],
      ],
      seg,
      14,
    ),
    lid: smoothLathe(
      [
        [0.033, 0.098],
        [0.0345, 0.1],
        [0.0345, 0.114],
        [0.032, 0.117],
        [0.001, 0.117],
      ],
      seg,
      6,
    ),
    label: (() => {
      const g = new THREE.CylinderGeometry(0.0432, 0.0432, 0.046, seg, 1, true);
      g.translate(0, 0.05, 0);
      return g;
    })(),
  };
}
function useJarGeos(quality: Quality) {
  const seg = quality === 'low' ? 12 : 18;
  if (!geos || geos.seg !== seg) geos = buildGeos(seg);
  return geos;
}

function useSet(ref: React.RefObject<THREE.InstancedMesh>, mats: THREE.Matrix4[], cols?: THREE.Color[]) {
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    mats.forEach((mt, i) => m.setMatrixAt(i, mt));
    if (cols) cols.forEach((c, i) => m.setColorAt(i, c));
    m.count = mats.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [ref, mats, cols]);
}

export function Jars({ items, m, quality, shadows = false }: { items: JarItem[]; m: ApiaryMaterials; quality: Quality; shadows?: boolean }) {
  const g = useJarGeos(quality);
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const glassRef = useRef<THREE.InstancedMesh>(null);
  const lidRef = useRef<THREE.InstancedMesh>(null);
  const labelRef = useRef<THREE.InstancedMesh>(null);
  const lidMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.75, roughness: 0.32 }), []);

  const data = useMemo(() => {
    const full: THREE.Matrix4[] = [];
    const fullC: THREE.Color[] = [];
    const empty: THREE.Matrix4[] = [];
    const lids: THREE.Matrix4[] = [];
    const lidC: THREE.Color[] = [];
    const labels: THREE.Matrix4[] = [];
    const q = new THREE.Quaternion();
    const yAxis = new THREE.Vector3(0, 1, 0);
    items.forEach((it, i) => {
      const s = it.s ?? 1;
      q.setFromAxisAngle(yAxis, it.rot ?? i * 1.37);
      const mt = new THREE.Matrix4().compose(new THREE.Vector3(...it.p), q, new THREE.Vector3(s, s, s));
      if (it.empty) empty.push(mt);
      else {
        full.push(mt);
        fullC.push(new THREE.Color(it.honey ?? HONEY.samar));
        if (it.label !== false) labels.push(mt);
      }
      if (it.lid !== -1) {
        lids.push(mt);
        lidC.push(new THREE.Color(LID_COLORS[(it.lid ?? i) % LID_COLORS.length]));
      }
    });
    return { full, fullC, empty, lids, lidC, labels };
  }, [items]);

  useSet(bodyRef, data.full, data.fullC);
  useSet(glassRef, data.empty);
  useSet(lidRef, data.lids, data.lidC);
  useSet(labelRef, data.labels);

  return (
    <group>
      {data.full.length > 0 && <instancedMesh ref={bodyRef} args={[g.body, m.honey, data.full.length]} castShadow={shadows} receiveShadow />}
      {data.empty.length > 0 && <instancedMesh ref={glassRef} args={[g.body, m.jarGlass, data.empty.length]} renderOrder={4} />}
      {data.lids.length > 0 && <instancedMesh ref={lidRef} args={[g.lid, lidMat, data.lids.length]} castShadow={shadows} receiveShadow />}
      {data.labels.length > 0 && <instancedMesh ref={labelRef} args={[g.label, m.label, data.labels.length]} receiveShadow />}
    </group>
  );
}
