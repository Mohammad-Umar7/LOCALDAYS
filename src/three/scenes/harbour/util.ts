import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { boxProjectUVs, roundedBox } from '../../props/geo';

/* Small geometry helpers for assembling merged props. */

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

/** Rounded box with world-scale box-projected UVs (fresh, mutable geometry). */
export function box(w: number, h: number, d: number, r = 0.02, uvScale = 0.6, seg = 1) {
  return boxProjectUVs(roundedBox(w, h, d, r, seg).clone(), uvScale);
}

/** Transforms a geometry in place: rotation (Euler XYZ), then translation. */
export function place(g: THREE.BufferGeometry, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0], scale: number | [number, number, number] = 1) {
  _e.set(rot[0], rot[1], rot[2]);
  _q.setFromEuler(_e);
  if (typeof scale === 'number') _s.set(scale, scale, scale);
  else _s.set(scale[0], scale[1], scale[2]);
  _p.set(pos[0], pos[1], pos[2]);
  _m.compose(_p, _q, _s);
  g.applyMatrix4(_m);
  return g;
}

/** Plain box (12 triangles) with box-projected UVs — for small hidden-edge parts. */
export function slab(w: number, h: number, d: number, uvScale = 0.6) {
  return boxProjectUVs(new THREE.BoxGeometry(w, h, d), uvScale);
}

/** Orients a +Y-built geometry (base at origin) from a to b. */
export function between(g: THREE.BufferGeometry, a: THREE.Vector3, b: THREE.Vector3) {
  const dir = b.clone().sub(a);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}

/** Cylinder from a to b with world-scaled UVs. */
export function rod(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1 = r0, radial = 10, rows = 1) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, len, radial, rows, false);
  g.translate(0, len / 2, 0);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(0.3, r0 * 6), uv.getY(i) * len * 0.5);
  return between(g, a, b);
}

/** Adds a constant vertex colour. */
export function tint(g: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** Offsets UVs (to de-repeat merged copies of the same part). */
export function shiftUV(g: THREE.BufferGeometry, du: number, dv: number) {
  const uv = g.attributes.uv as THREE.BufferAttribute | undefined;
  if (!uv) return g;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + du, uv.getY(i) + dv);
  return g;
}

/** Merge anything: normalises indexing and keeps position/normal/uv(/color). */
export function mergeAll(list: THREE.BufferGeometry[], keepColor = false) {
  const keep = keepColor ? ['position', 'normal', 'uv', 'color'] : ['position', 'normal', 'uv'];
  const prepared = list.map((g) => {
    let x = g.index ? g.toNonIndexed() : g;
    if (x === g) x = g.clone();
    for (const name of Object.keys(x.attributes)) if (!keep.includes(name)) x.deleteAttribute(name);
    if (!x.attributes.normal) x.computeVertexNormals();
    if (!x.attributes.uv) x.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2));
    if (keepColor && !x.attributes.color) tint(x, '#ffffff');
    return x;
  });
  const out = mergeGeometries(prepared, false);
  prepared.forEach((p) => p.dispose());
  return out;
}
