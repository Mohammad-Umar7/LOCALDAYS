import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { bakeInstances } from './geom';

/** Static copies of a geometry baked into one mesh (merged further by StaticBatch). */
export function Baked({
  geo,
  mats,
  colors,
  material,
  cast = false,
  receive = true,
  renderOrder,
}: {
  geo: THREE.BufferGeometry;
  mats: THREE.Matrix4[];
  colors?: THREE.Color[];
  material: THREE.Material;
  cast?: boolean;
  receive?: boolean;
  renderOrder?: number;
}) {
  const g = useMemo(() => bakeInstances(geo, mats, colors), [geo, mats, colors]);
  if (!mats.length) return null;
  return <mesh geometry={g} material={material} castShadow={cast} receiveShadow={receive} renderOrder={renderOrder} />;
}

/**
 * Turns shadow casting off for small static meshes before StaticBatch merges
 * them: fewer caster buckets and lighter shadow passes. Contact shading of
 * small props comes from N8AO instead.
 */
export function ShadowPolicy({ minRadius = 0.11, children }: { minRadius?: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    const g = ref.current;
    if (!g) return;
    g.updateWorldMatrix(true, true);
    const s = new THREE.Sphere();
    g.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.castShadow) return;
      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
      s.copy(mesh.geometry.boundingSphere!).applyMatrix4(mesh.matrixWorld);
      if (s.radius < minRadius) mesh.castShadow = false;
    });
  });
  return <group ref={ref}>{children}</group>;
}

const DEFAULT_OBC = THREE.Material.prototype.onBeforeCompile;
const tintCache = new Map<string, THREE.BufferGeometry>();

export interface TintTargets {
  matte: THREE.Material;
  gloss: THREE.Material;
  metal: THREE.Material;
}

/**
 * Folds every plain (untextured, non-emissive, opaque) standard material into
 * three shared vertex-colour materials before StaticBatch merges, so dozens of
 * small prop colours cost three draw calls instead of one each.
 */
export function TintPolicy({ targets, children }: { targets: TintTargets; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    const g = ref.current;
    if (!g) return;
    g.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || mesh.userData.noBatch) return;
      let p: THREE.Object3D | null = mesh.parent;
      while (p && p !== g) {
        if (p.userData.noBatch) return;
        p = p.parent;
      }
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (Array.isArray(mat) || mat.type !== 'MeshStandardMaterial') return;
      if (mat.map || mat.normalMap || mat.emissiveMap || mat.roughnessMap || mat.alphaMap || mat.transparent || mat.vertexColors) return;
      if (mat.emissiveIntensity > 0 && mat.emissive.getHex() !== 0) return;
      if (mat.onBeforeCompile !== DEFAULT_OBC || mat.side !== THREE.FrontSide) return;
      const target = mat.metalness > 0.5 ? targets.metal : mat.roughness < 0.5 ? targets.gloss : targets.matte;
      const key = `${mesh.geometry.uuid}:${mat.color.getHexString()}`;
      let tg = tintCache.get(key);
      if (!tg) {
        tg = bakeInstances(mesh.geometry, [new THREE.Matrix4()], [mat.color]);
        tintCache.set(key, tg);
      }
      mesh.geometry = tg;
      mesh.material = target;
    });
  });
  return <group ref={ref}>{children}</group>;
}
