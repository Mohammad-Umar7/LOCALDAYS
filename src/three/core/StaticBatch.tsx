import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const DEFAULT_OBC = THREE.Material.prototype.onBeforeCompile;

/** Materials that look identical share a bucket even if they are different instances. */
function materialSignature(m: THREE.Material): string {
  if (m.onBeforeCompile !== DEFAULT_OBC) return m.uuid;
  const s = m as THREE.MeshPhysicalMaterial;
  const tex = (t?: THREE.Texture | null) => (t ? `${t.source.uuid}:${t.repeat.x},${t.repeat.y}:${t.offset.x},${t.offset.y}` : '-');
  return [
    m.type,
    s.color?.getHexString(),
    s.emissive?.getHexString(),
    s.emissiveIntensity,
    s.roughness,
    s.metalness,
    s.transmission ?? '',
    s.clearcoat ?? '',
    m.transparent ? `t${m.opacity}` : 'o',
    m.side,
    m.vertexColors ? 'vc' : '',
    m.depthWrite ? 'dw' : '',
    tex(s.map),
    tex(s.normalMap),
    tex(s.roughnessMap),
    tex(s.alphaMap),
    s.envMapIntensity ?? '',
    (m as THREE.MeshBasicMaterial).fog === false ? 'nf' : '',
  ].join('|');
}

/**
 * Merges every static, non-instanced mesh inside it into one draw call per
 * material (world transforms baked in). Cuts draw calls by an order of
 * magnitude for richly detailed procedural scenery.
 *
 * Skips InstancedMesh, multi-material meshes and anything with
 * `userData.noBatch = true` (use that for meshes you animate).
 */
export function StaticBatch({ children, enabled = true, deps = [] }: { children: ReactNode; enabled?: boolean; deps?: unknown[] }) {
  const group = useRef<THREE.Group>(null);
  const [merged, setMerged] = useState<THREE.Mesh[]>([]);

  useLayoutEffect(() => {
    if (!enabled) return;
    const g = group.current;
    if (!g) return;
    g.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
    type Bucket = { mat: THREE.Material; geos: THREE.BufferGeometry[]; cast: boolean; receive: boolean; order: number };
    const buckets = new Map<string, Bucket>();
    const originals: THREE.Mesh[] = [];

    g.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || mesh.userData.noBatch) return;
      if (Array.isArray(mesh.material) || !mesh.visible) return;
      // Skip anything under an ancestor flagged noBatch
      let p: THREE.Object3D | null = mesh.parent;
      while (p && p !== g) {
        if (p.userData.noBatch) return;
        p = p.parent;
      }
      const src = mesh.geometry;
      if (!src.attributes.position) return;
      let geo = src.index ? src.toNonIndexed() : src.clone();
      for (const name of Object.keys(geo.attributes)) {
        if (!['position', 'normal', 'uv', 'color'].includes(name)) geo.deleteAttribute(name);
      }
      if (!geo.attributes.normal) geo.computeVertexNormals();
      if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
      const m = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
      geo.applyMatrix4(m);
      geo = geo.index ? geo.toNonIndexed() : geo;
      const hasColor = !!geo.attributes.color;
      const key = `${materialSignature(mesh.material)}|${hasColor ? 'c' : ''}|${mesh.castShadow ? 1 : 0}${mesh.receiveShadow ? 1 : 0}|${mesh.renderOrder}`;
      let b = buckets.get(key);
      if (!b) {
        b = { mat: mesh.material, geos: [], cast: mesh.castShadow, receive: mesh.receiveShadow, order: mesh.renderOrder };
        buckets.set(key, b);
      }
      b.geos.push(geo);
      originals.push(mesh);
    });

    const out: THREE.Mesh[] = [];
    buckets.forEach((b) => {
      if (!b.geos.length) return;
      const mergedGeo = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false);
      b.geos.forEach((x) => x !== mergedGeo && x.dispose());
      if (!mergedGeo) return;
      mergedGeo.computeBoundingSphere();
      mergedGeo.computeBoundingBox();
      const mm = new THREE.Mesh(mergedGeo, b.mat);
      mm.castShadow = b.cast;
      mm.receiveShadow = b.receive;
      mm.renderOrder = b.order;
      mm.matrixAutoUpdate = false;
      out.push(mm);
    });
    originals.forEach((o) => (o.visible = false));
    setMerged(out);
    return () => {
      originals.forEach((o) => (o.visible = true));
      out.forEach((m) => m.geometry.dispose());
      setMerged([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return (
    <>
      <group ref={group}>{children}</group>
      {merged.map((m) => (
        <primitive key={m.uuid} object={m} />
      ))}
    </>
  );
}
