import { useLayoutEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import type { Quality } from '../../core/types';
import { tintGeometry, type ApiaryMaterials } from './materials';

const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();

/**
 * Runs before the static batcher (child layout effects fire first):
 *  - swaps tinted paint/timber materials for shared vertex-coloured masters
 *    (colour baked into the geometry), so all hive paints collapse into one
 *    draw call and all timber into another;
 *  - on medium/low quality, small props stop casting shadows, which merges
 *    their buckets and lightens the shadow pass.
 */
export function VertexTint({ m, quality, deps, children }: { m: ApiaryMaterials; quality: Quality; deps: unknown[]; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    const g = ref.current;
    if (!g) return;
    g.updateWorldMatrix(true, true);
    const minCaster = quality === 'high' ? 0 : quality === 'medium' ? 0.14 : 0.3;
    g.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || Array.isArray(mesh.material)) return;
      // remember the authored flag so a later quality change can restore it
      if (mesh.userData.cast0 === undefined) mesh.userData.cast0 = mesh.castShadow;
      let cast = mesh.userData.cast0 as boolean;
      if (minCaster > 0 && cast) {
        if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
        mesh.matrixWorld.decompose(_p, _q, _s);
        const r = (mesh.geometry.boundingSphere?.radius ?? 1) * Math.max(_s.x, _s.y, _s.z);
        if (r < minCaster) cast = false;
      }
      mesh.castShadow = cast;
      const t = m.tints.get(mesh.material as THREE.Material);
      if (!t) return;
      mesh.geometry = tintGeometry(mesh.geometry, t.color);
      mesh.material = t.master;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return <group ref={ref}>{children}</group>;
}
