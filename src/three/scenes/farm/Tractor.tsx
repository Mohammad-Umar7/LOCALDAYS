import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { boxProjectUVs, roundedBox, smoothLathe } from '../../props/geo';
import { rng } from './layout';
import type { FarmMaterials } from './materials';

/* ------------------------------------------------------------------ */
/*  A well-used farm tractor with a hay trailer, parked on the service */
/*  track: lugged rear tyres, cream rims, red bonnet with a dark       */
/*  grille, fenders, seat, steering wheel, exhaust stack and roll bar. */
/*  Local frame: tractor faces +X, origin on the ground at the rear    */
/*  axle; the trailer hitches behind (−X).                             */
/* ------------------------------------------------------------------ */

function merge(list: THREE.BufferGeometry[]) {
  const g = mergeGeometries(
    list.map((x) => {
      const y = x.index ? x.toNonIndexed() : x;
      if (!y.attributes.uv) y.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(y.attributes.position.count * 2), 2));
      return y;
    }),
    false,
  );
  list.forEach((x) => x.dispose());
  return g!;
}

const rb = (w: number, h: number, d: number, r = 0.03, s = 2) => boxProjectUVs(roundedBox(w, h, d, r, s).clone(), 1);

/** Tyre as a lathe of a rounded section, axis along Z, centred at the origin. */
function tyre(radius: number, width: number, seg = 36) {
  const t = width / 2;
  const prof: [number, number][] = [
    [radius * 0.62, -t * 0.95],
    [radius * 0.9, -t],
    [radius - 0.03, -t * 0.92],
    [radius, -t * 0.6],
    [radius, t * 0.6],
    [radius - 0.03, t * 0.92],
    [radius * 0.9, t],
    [radius * 0.62, t * 0.95],
  ];
  const g = new THREE.LatheGeometry(
    prof.map(([r, y]) => new THREE.Vector2(r, y)),
    seg,
  );
  g.rotateX(Math.PI / 2);
  return g;
}

/** Chevron lugs around a tractor tyre. */
function lugs(radius: number, width: number, n: number) {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    for (const s of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.06, 0.035, width * 0.5);
      g.rotateY(s * 0.55);
      g.translate(0.02 * s, 0, (s * width) / 4);
      g.translate(radius + 0.005, 0, 0);
      g.rotateZ(a + (s > 0 ? 0.08 : 0));
      parts.push(g);
    }
  }
  return merge(parts);
}

function rim(radius: number, width: number) {
  const parts: THREE.BufferGeometry[] = [];
  const dish = smoothLathe(
    [
      [0.001, 0],
      [radius * 0.25, 0.01],
      [radius * 0.55, -0.02],
      [radius * 0.62, 0.02],
      [radius * 0.66, 0.04],
    ],
    24,
    8,
  ).clone();
  dish.rotateX(Math.PI / 2);
  dish.translate(0, 0, width / 2 - 0.04);
  parts.push(dish);
  const hub = new THREE.CylinderGeometry(radius * 0.18, radius * 0.2, width * 0.9, 16);
  hub.rotateX(Math.PI / 2);
  parts.push(hub);
  for (let k = 0; k < 6; k++) {
    const b = new THREE.CylinderGeometry(0.012, 0.012, 0.03, 6);
    b.rotateX(Math.PI / 2);
    const a = (k / 6) * Math.PI * 2;
    b.translate(Math.cos(a) * radius * 0.12, Math.sin(a) * radius * 0.12, width * 0.45);
    parts.push(b);
  }
  return merge(parts);
}

const DUST = new THREE.Color('#B09A7C');

/**
 * Bakes a sun-faded base colour plus caked dust into vertex colours: dust builds
 * up toward the ground and in blotches (a cheap positional noise), so the
 * machine looks worked rather than showroom-new.
 */
function dusty(g: THREE.BufferGeometry, base: string, amount: number) {
  const p = g.attributes.position as THREE.BufferAttribute;
  const n = g.attributes.normal as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color(base);
  const out = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const low = 1 - THREE.MathUtils.smoothstep(y, 0.12, 1.2);
    const blotch = 0.5 + 0.5 * Math.sin(x * 7.3 + z * 5.1) * Math.sin(y * 9.7 - x * 3.3 + z * 2.1);
    const up = Math.max(0, n.getY(i)) * 0.35; // dust settles on upward faces
    const d = THREE.MathUtils.clamp((low * 0.85 + up) * (0.55 + 0.6 * blotch) * amount, 0, 0.9);
    out.copy(c).lerp(DUST, d);
    col.set([out.r, out.g, out.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export function TractorRig({ m, position, rotation = 0 }: { m: FarmMaterials; position: [number, number, number]; rotation?: number }) {
  // colour lives in the vertices (paint fading into dust toward the ground), so the materials stay white
  const mats = useMemo(
    () => ({
      paint: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.08, name: 'farm:tractorPaint' }),
      rubber: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, name: 'farm:rubber' }),
      cream: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05, name: 'farm:cream' }),
    }),
    [],
  );
  const geo = useMemo(() => {
    const r = rng(8);
    const paint: THREE.BufferGeometry[] = [];
    const rubber: THREE.BufferGeometry[] = [];
    const cream: THREE.BufferGeometry[] = [];
    const iron: THREE.BufferGeometry[] = [];
    const wood: THREE.BufferGeometry[] = [];
    const straw: THREE.BufferGeometry[] = [];
    const twine: THREE.BufferGeometry[] = [];
    const glass: THREE.BufferGeometry[] = [];
    const R = 0.74; // rear tyre
    const F = 0.4; // front tyre
    const wheelbase = 2.05;
    // ---- wheels
    for (const s of [-1, 1]) {
      rubber.push(tyre(R, 0.42).translate(0, R, s * 0.78));
      rubber.push(lugs(R - 0.01, 0.42, 30).translate(0, R, s * 0.78));
      cream.push(rim(R, 0.42).applyMatrix4(new THREE.Matrix4().makeRotationY(s > 0 ? 0 : Math.PI)).translate(0, R, s * 0.78));
      rubber.push(tyre(F, 0.2, 28).translate(wheelbase, F, s * 0.62));
      cream.push(rim(F, 0.2).applyMatrix4(new THREE.Matrix4().makeRotationY(s > 0 ? 0 : Math.PI)).translate(wheelbase, F, s * 0.62));
    }
    // ---- chassis, engine and bonnet
    iron.push(rb(2.3, 0.32, 0.5, 0.04).translate(1.05, 0.62, 0));
    iron.push(new THREE.CylinderGeometry(0.06, 0.06, 1.24, 10).rotateX(Math.PI / 2).translate(wheelbase, F, 0)); // front axle
    iron.push(new THREE.CylinderGeometry(0.09, 0.09, 1.3, 12).rotateX(Math.PI / 2).translate(0, R, 0)); // rear axle housing
    paint.push(rb(1.55, 0.5, 0.62, 0.08, 3).translate(1.45, 1.06, 0)); // bonnet
    paint.push(rb(0.22, 0.62, 0.66, 0.05, 2).translate(2.25, 1.0, 0)); // nose
    iron.push(rb(0.04, 0.42, 0.5, 0.01, 1).translate(2.37, 1.0, 0)); // grille
    for (let k = 0; k < 6; k++) cream.push(new THREE.BoxGeometry(0.02, 0.38, 0.012).translate(2.39, 1.0, -0.2 + k * 0.08));
    for (const s of [-1, 1]) glass.push(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 16).rotateZ(Math.PI / 2).translate(2.38, 1.2, s * 0.24));
    paint.push(rb(0.9, 0.38, 0.6, 0.06, 2).translate(0.35, 0.95, 0)); // transmission / tank
    iron.push(rb(0.7, 0.3, 0.5, 0.05, 2).translate(1.2, 0.72, 0)); // engine block below bonnet
    // ---- fenders over the rear wheels
    for (const s of [-1, 1]) {
      // after the two rotations theta is the polar angle in the wheel plane (0 = forward, pi/2 = up)
      const f = new THREE.CylinderGeometry(R + 0.08, R + 0.08, 0.46, 20, 1, true, Math.PI * 0.32, Math.PI * 0.62);
      f.rotateX(Math.PI / 2);
      f.rotateZ(Math.PI / 2);
      paint.push(f.translate(0, R, s * 0.78));
      const plate = new THREE.RingGeometry(R * 0.55, R + 0.08, 20, 1, Math.PI * 0.32, Math.PI * 0.62);
      if (s > 0) plate.rotateY(Math.PI); // face the seat
      paint.push(plate.translate(0, R, s * 0.78 - s * 0.23));
      paint.push(rb(0.9, 0.04, 0.5, 0.01, 1).translate(-0.05, R + 0.86, s * 0.78));
    }
    // ---- operator's station: platform, seat, steering, levers, roll bar, exhaust
    iron.push(rb(0.9, 0.05, 1.0, 0.01, 1).translate(-0.05, 0.92, 0));
    iron.push(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8).translate(-0.15, 1.12, 0));
    cream.push(rb(0.42, 0.08, 0.45, 0.04, 2).translate(-0.18, 1.4, 0)); // seat
    cream.push(rb(0.08, 0.36, 0.42, 0.04, 2).rotateZ(-0.2).translate(-0.4, 1.58, 0)); // backrest
    iron.push(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8).rotateZ(-0.75).translate(0.5, 1.48, 0)); // steering column
    iron.push(new THREE.TorusGeometry(0.18, 0.018, 8, 24).rotateY(Math.PI / 2).rotateZ(-0.75).translate(0.27, 1.73, 0)); // wheel
    for (const s of [-1, 1]) iron.push(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 6).rotateX(s * 0.3).translate(0.1, 1.2, s * 0.35));
    for (const s of [-1, 1]) iron.push(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 10).translate(-0.62, 1.55, s * 0.62)); // ROPS uprights
    iron.push(new THREE.TorusGeometry(0.62, 0.035, 8, 20, Math.PI).rotateY(Math.PI / 2).translate(-0.62, 2.2, 0));
    iron.push(new THREE.CylinderGeometry(0.045, 0.05, 1.05, 12).translate(1.55, 1.75, 0.22)); // exhaust stack
    iron.push(new THREE.CylinderGeometry(0.06, 0.045, 0.08, 12).translate(1.55, 2.3, 0.22));
    iron.push(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 12).translate(1.2, 1.42, -0.22)); // air intake
    // ---- drawbar to the trailer
    iron.push(rb(0.9, 0.06, 0.08, 0.01, 1).translate(-0.9, 0.5, 0));

    // ---- hay trailer: flat bed with low rails on two wheels, loaded with bales
    const tx = -3.1;
    for (const s of [-1, 1]) {
      rubber.push(tyre(0.42, 0.22, 28).translate(tx, 0.42, s * 0.92));
      cream.push(rim(0.42, 0.22).applyMatrix4(new THREE.Matrix4().makeRotationY(s > 0 ? 0 : Math.PI)).translate(tx, 0.42, s * 0.92));
    }
    iron.push(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 10).rotateX(Math.PI / 2).translate(tx, 0.42, 0));
    iron.push(rb(1.25, 0.07, 0.08, 0.01, 1).rotateZ(-0.2).translate(-1.75, 0.66, 0)); // tongue
    for (let k = 0; k < 9; k++) wood.push(rb(2.7, 0.05, 0.18, 0.01, 1).translate(tx, 0.9, -0.8 + k * 0.2));
    for (const s of [-1, 1]) {
      wood.push(rb(2.7, 0.12, 0.05, 0.01, 1).translate(tx, 1.14, s * 0.86));
      for (const dx of [-1.25, 0, 1.25]) wood.push(rb(0.06, 0.32, 0.06, 0.01, 1).translate(tx + dx, 1.06, s * 0.86));
      iron.push(rb(2.5, 0.1, 0.08, 0.01, 1).translate(tx, 0.8, s * 0.55)); // bed rails
    }
    for (const dx of [-1.33, 1.33]) wood.push(rb(0.05, 0.12, 1.7, 0.01, 1).translate(tx + dx, 1.14, 0));
    const bale = (x: number, y: number, z: number, rot: number) => {
      const mm = new THREE.Matrix4().compose(new THREE.Vector3(x, y + 0.2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(1, 1, 1));
      straw.push(boxProjectUVs(roundedBox(0.92, 0.4, 0.46, 0.06, 2).clone(), 1.1).applyMatrix4(mm));
      for (const dx of [-0.22, 0.22]) twine.push(new THREE.BoxGeometry(0.018, 0.408, 0.468).translate(dx, 0, 0).applyMatrix4(mm));
    };
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) bale(tx - 0.65 + i * 1.0 + (r() - 0.5) * 0.04, 0.93, -0.52 + j * 0.5, (r() - 0.5) * 0.06);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) bale(tx - 0.45 + i * 0.96, 1.33, -0.27 + j * 0.52, Math.PI / 2 + (r() - 0.5) * 0.08);
    bale(tx + 0.1, 1.73, 0, 0.1);
    return {
      paint: dusty(merge(paint), '#8F4E3E', 0.62),
      rubber: dusty(merge(rubber), '#2E2A27', 0.85),
      cream: dusty(merge(cream), '#CDBF9F', 0.5),
      iron: merge(iron),
      wood: merge(wood),
      straw: merge(straw),
      twine: merge(twine),
      glass: merge(glass),
    };
  }, []);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={geo.paint} material={mats.paint} castShadow receiveShadow />
      <mesh geometry={geo.rubber} material={mats.rubber} castShadow receiveShadow />
      <mesh geometry={geo.cream} material={mats.cream} castShadow receiveShadow />
      <mesh geometry={geo.iron} material={m.iron} castShadow receiveShadow />
      <mesh geometry={geo.wood} material={m.woodGrey} castShadow receiveShadow />
      <mesh geometry={geo.straw} material={m.straw} castShadow receiveShadow />
      <mesh geometry={geo.twine} material={m.rope} castShadow receiveShadow />
      <mesh geometry={geo.glass} material={m.glass} />
    </group>
  );
}
