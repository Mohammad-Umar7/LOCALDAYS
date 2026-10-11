import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { DatePalms, type PalmSpec } from '../../props/DatePalms';
import type { Quality } from '../../core/types';
import type { FarmMaterials } from './materials';

/* ------------------------------------------------------------------ */
/*  Date palms with a shadow-pass LOD.                                  */
/*                                                                      */
/*  Fronds are by far the heaviest thing on the farm (~1.9k triangles   */
/*  each, ~800 of them) and the shadow map used to draw them all again. */
/*  Leaflets are only 2–4 cm wide — below a shadow-map texel — so the   */
/*  shadow pass gets a stand-in frond with the identical rachis curve   */
/*  and leaflet layout, but one tapered quad per leaflet (~10× fewer    */
/*  triangles). The visible fronds are untouched.                       */
/*                                                                      */
/*  three r170 captures each mesh's geometry for the main pass during   */
/*  scene projection, *before* shadow maps are rendered, and the shadow */
/*  pass re-reads `object.geometry`. A degenerate switch mesh that the  */
/*  shadow traversal visits first swaps the registered fronds to their  */
/*  stand-in; each frond swaps itself back in onAfterShadow.            */
/* ------------------------------------------------------------------ */

export interface LodTarget {
  mesh: THREE.Mesh;
  high: THREE.BufferGeometry;
  low: THREE.BufferGeometry;
}
export type ShadowLod = Set<LodTarget>;

const noop = THREE.Object3D.prototype.onAfterShadow;

/** Must be mounted before the registered meshes in the scene graph. */
export function ShadowLodSwitch({ lod, material }: { lod: ShadowLod; material: THREE.Material }) {
  const mesh = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, -50, 0, 0, -50, 0, 0, -50, 0], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 2));
    const m = new THREE.Mesh(g, material);
    m.castShadow = true;
    m.frustumCulled = false;
    m.userData.noBatch = true;
    m.onBeforeShadow = () => {
      lod.forEach((t) => {
        t.mesh.geometry = t.low;
      });
    };
    return m;
  }, [lod, material]);
  return <primitive object={mesh} />;
}

function rand(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** Shadow stand-in for DatePalms' frond: same curve/leaflet layout, one tapered quad per leaflet. */
function shadowFrondGeometry(leafletsPerSide: number, length = 3.1) {
  const pos: number[] = [];
  const idx: number[] = [];
  const curve = (s: number) => new THREE.Vector3(s * length, Math.sin(s * Math.PI * 0.75) * 0.55 - s * s * 0.85, 0);
  const tangent = (s: number) => curve(Math.min(1, s + 0.01)).sub(curve(Math.max(0, s - 0.01))).normalize();
  // rachis: flat ribbon facing up (enough for a shadow)
  const segs = 8;
  for (let i = 0; i <= segs; i++) {
    const s = i / segs;
    const p = curve(s);
    const w = THREE.MathUtils.lerp(0.05, 0.008, s);
    pos.push(p.x, p.y, -w, p.x, p.y, w);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  // leaflets — the PRNG sequence mirrors DatePalms so every leaflet lands in the same place
  const r = rand(7);
  const up = new THREE.Vector3(0, 1, 0);
  for (let side = -1; side <= 1; side += 2) {
    for (let k = 0; k < leafletsPerSide; k++) {
      const s = 0.1 + (k / leafletsPerSide) * 0.88;
      const p0 = curve(s);
      const t = tangent(s);
      const lift = THREE.MathUtils.degToRad(28 + r() * 14);
      const sweep = THREE.MathUtils.degToRad(38 + r() * 10);
      const dir = new THREE.Vector3(0, 0, side).multiplyScalar(Math.cos(lift)).addScaledVector(up, Math.sin(lift)).normalize();
      dir.lerp(t, Math.sin(sweep) * 0.55).normalize();
      const envelope = Math.sin(Math.PI * Math.min(1, (s - 0.05) / 0.95));
      const len = 0.18 + 0.62 * Math.pow(envelope, 0.8) * (0.85 + r() * 0.3);
      r();
      r(); // tint draws in the original
      const w = (0.028 + 0.012 * envelope) * 1.15;
      const across = new THREE.Vector3().crossVectors(dir, t).normalize();
      const base = pos.length / 3;
      const tip = p0.clone().addScaledVector(dir, len).add(new THREE.Vector3(0, -0.12 * len, 0));
      const mid = p0.clone().addScaledVector(dir, len * 0.45).add(new THREE.Vector3(0, -0.025 * len, 0));
      const a = mid.clone().addScaledVector(across, -w);
      const b = mid.clone().addScaledVector(across, w);
      pos.push(p0.x, p0.y, p0.z, a.x, a.y, a.z, b.x, b.y, b.z, tip.x, tip.y, tip.z);
      idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

const LEAFLETS: Record<Quality, number> = { low: 24, medium: 32, high: 40 };

/**
 * DatePalms at a chosen detail level, registered with the shadow LOD.
 * Date bunches and stalks stop casting (they sit inside the crown's own shadow).
 */
export function FarmPalms({ palms, detail, lod }: { palms: PalmSpec[]; detail: Quality; lod: ShadowLod }) {
  const ref = useRef<THREE.Group>(null);
  const low = useMemo(() => shadowFrondGeometry(LEAFLETS[detail]), [detail]);
  useLayoutEffect(() => {
    const g = ref.current;
    if (!g) return;
    const registered: LodTarget[] = [];
    g.traverse((o) => {
      const mesh = o as THREE.InstancedMesh;
      if (!mesh.isInstancedMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat.vertexColors) {
        const t: LodTarget = { mesh, high: mesh.geometry, low };
        mesh.onAfterShadow = () => {
          mesh.geometry = t.high;
        };
        // self-heal: never let the stand-in survive into the next projection
        mesh.onBeforeRender = () => {
          if (mesh.geometry !== t.high) mesh.geometry = t.high;
        };
        lod.add(t);
        registered.push(t);
      } else {
        mesh.castShadow = false;
      }
    });
    return () => {
      registered.forEach((t) => {
        lod.delete(t);
        t.mesh.geometry = t.high;
        t.mesh.onAfterShadow = noop;
        t.mesh.onBeforeRender = THREE.Object3D.prototype.onBeforeRender;
      });
    };
  }, [palms, detail, low, lod]);
  return (
    <group ref={ref}>
      <DatePalms palms={palms} quality={detail} />
    </group>
  );
}

/** Circular irrigation basins around each palm — a signature of date farms. */
export function PalmBasins({ m, palms }: { m: FarmMaterials; palms: PalmSpec[] }) {
  const discRef = useRef<THREE.InstancedMesh>(null);
  const ringRef = useRef<THREE.InstancedMesh>(null);
  const discGeo = useMemo(() => {
    const g = new THREE.CircleGeometry(1.35, 40);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const ringGeo = useMemo(() => {
    const g = new THREE.TorusGeometry(1.42, 0.16, 6, 40);
    g.rotateX(Math.PI / 2);
    g.scale(1, 0.45, 1);
    return g;
  }, []);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    palms.forEach((p, i) => {
      o.position.set(p.position[0], 0.012, p.position[2]);
      o.rotation.set(0, i, 0);
      o.updateMatrix();
      discRef.current?.setMatrixAt(i, o.matrix);
      o.position.y = 0.03;
      o.updateMatrix();
      ringRef.current?.setMatrixAt(i, o.matrix);
    });
    for (const r of [discRef.current, ringRef.current]) {
      if (!r) continue;
      r.instanceMatrix.needsUpdate = true;
      r.computeBoundingSphere();
    }
  }, [palms]);
  return (
    <group>
      <instancedMesh ref={discRef} args={[discGeo, m.wetSoil, palms.length]} receiveShadow />
      <instancedMesh ref={ringRef} args={[ringGeo, m.soil, palms.length]} receiveShadow />
    </group>
  );
}
