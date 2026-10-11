import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getTexSet, repeatSet } from '../materials/textures';
import { applyWind } from '../materials/wind';
import type { Quality, Vec3 } from '../core/types';

/* ------------------------------------------------------------------ */
/*  High-detail date palms: lathe trunks with leaf-base rings, crowns  */
/*  of instanced pinnate fronds (folded leaflets, vertex-coloured)    */
/*  that sway in the wind, and hanging fruit bunches.                  */
/* ------------------------------------------------------------------ */

export interface PalmSpec {
  position: Vec3;
  height?: number;
  lean?: number;
  leanDir?: number;
  seed?: number;
  fruit?: boolean;
  scale?: number;
}

function rand(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** One pinnate frond pointing along +X, origin at the attachment point. */
function buildFrondGeometry(leafletsPerSide: number, length = 3.1) {
  const positions: number[] = [];
  const colors: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const base = new THREE.Color('#5E7C4A');
  const tip = new THREE.Color('#9BB27A');
  const mid = new THREE.Color('#71905A');
  const rachisCol = new THREE.Color('#B9A46E');

  const curve = (s: number) => new THREE.Vector3(s * length, Math.sin(s * Math.PI * 0.75) * 0.55 - s * s * 0.85, 0);
  const tangent = (s: number) => curve(Math.min(1, s + 0.01)).sub(curve(Math.max(0, s - 0.01))).normalize();

  // --- rachis: tapered tube
  const radial = 6;
  const segs = 22;
  const startIndex = 0;
  for (let i = 0; i <= segs; i++) {
    const s = i / segs;
    const p = curve(s);
    const t = tangent(s);
    const n = new THREE.Vector3(0, 0, 1);
    const b = new THREE.Vector3().crossVectors(t, n).normalize();
    const r = THREE.MathUtils.lerp(0.045, 0.006, s);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const dir = new THREE.Vector3().addScaledVector(n, Math.cos(a)).addScaledVector(b, Math.sin(a)).normalize();
      positions.push(p.x + dir.x * r, p.y + dir.y * r, p.z + dir.z * r);
      normals.push(dir.x, dir.y, dir.z);
      colors.push(rachisCol.r, rachisCol.g, rachisCol.b);
    }
  }
  for (let i = 0; i < segs; i++)
    for (let j = 0; j < radial; j++) {
      const a = startIndex + i * (radial + 1) + j;
      const b2 = a + radial + 1;
      indices.push(a, b2, a + 1, b2, b2 + 1, a + 1);
    }

  // --- leaflets: folded V cross-section strips
  const r = rand(7);
  const along = 5;
  for (let side = -1; side <= 1; side += 2) {
    for (let k = 0; k < leafletsPerSide; k++) {
      const s = 0.1 + (k / leafletsPerSide) * 0.88;
      const p0 = curve(s);
      const t = tangent(s);
      const up = new THREE.Vector3(0, 1, 0);
      const side3 = new THREE.Vector3(0, 0, side);
      // Leaflet direction: sideways, raised into a V, swept toward the tip
      const lift = THREE.MathUtils.degToRad(28 + r() * 14);
      const sweep = THREE.MathUtils.degToRad(38 + r() * 10);
      const dir = side3
        .clone()
        .multiplyScalar(Math.cos(lift))
        .addScaledVector(up, Math.sin(lift))
        .normalize();
      dir.applyAxisAngle(new THREE.Vector3().crossVectors(dir, t).normalize(), -sweep * 0.0);
      dir.lerp(t, Math.sin(sweep) * 0.55).normalize();
      const envelope = Math.sin(Math.PI * Math.min(1, (s - 0.05) / 0.95));
      const len = 0.18 + 0.62 * Math.pow(envelope, 0.8) * (0.85 + r() * 0.3);
      const w = 0.028 + 0.012 * envelope;
      const across = new THREE.Vector3().crossVectors(dir, t).normalize();
      const fold = new THREE.Vector3().crossVectors(across, dir).normalize();
      const baseIdx = positions.length / 3;
      const tint = mid.clone().lerp(r() > 0.5 ? base : tip, r() * 0.5);
      for (let i = 0; i <= along; i++) {
        const u = i / along;
        const droop = u * u * 0.12 * len;
        const center = p0
          .clone()
          .addScaledVector(dir, u * len)
          .add(new THREE.Vector3(0, -droop, 0));
        const width = w * Math.sin(Math.PI * Math.min(1, u * 1.05 + 0.08)) * (1 - u * 0.35);
        const L = center.clone().addScaledVector(across, -width).addScaledVector(fold, -width * 0.45);
        const M = center.clone().addScaledVector(fold, width * 0.25);
        const R = center.clone().addScaledVector(across, width).addScaledVector(fold, -width * 0.45);
        positions.push(L.x, L.y, L.z, M.x, M.y, M.z, R.x, R.y, R.z);
        const c = tint.clone().lerp(tip, u * 0.55);
        const cd = c.clone().multiplyScalar(0.82);
        colors.push(cd.r, cd.g, cd.b, c.r, c.g, c.b, cd.r, cd.g, cd.b);
        normals.push(fold.x, fold.y, fold.z, fold.x, fold.y, fold.z, fold.x, fold.y, fold.z);
      }
      for (let i = 0; i < along; i++) {
        const a = baseIdx + i * 3;
        const b2 = a + 3;
        indices.push(a, b2, a + 1, b2, b2 + 1, a + 1, a + 1, b2 + 1, a + 2, b2 + 1, b2 + 2, a + 2);
      }
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function buildTrunk(height: number, lean: number, leanDir: number, seed: number) {
  const r = rand(seed);
  const pts: THREE.Vector2[] = [];
  const N = 56;
  const R = 0.22 + r() * 0.05;
  for (let i = 0; i <= N; i++) {
    const y = (i / N) * height;
    const t = y / height;
    let rad = R * (1 + 0.55 * Math.exp(-y * 2.6));
    rad *= 1 + 0.05 * Math.sin(y * 7.5 * Math.PI * 2 + r());
    rad *= 1 + 0.35 * THREE.MathUtils.smoothstep(t, 0.9, 1);
    pts.push(new THREE.Vector2(rad, y));
  }
  const g = new THREE.LatheGeometry(pts, 20);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const dx = Math.cos(leanDir) * lean;
  const dz = Math.sin(leanDir) * lean;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = y / height;
    pos.setX(i, pos.getX(i) + dx * t * t * height);
    pos.setZ(i, pos.getZ(i) + dz * t * t * height);
  }
  g.computeVertexNormals();
  // UVs: lathe gives u around, v along — keep but scale v by height
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * height * 0.6);
  return { geometry: g, top: new THREE.Vector3(dx * height, height, dz * height) };
}

export function DatePalms({ palms, quality = 'high' }: { palms: PalmSpec[]; quality?: Quality }) {
  const frondsPerPalm = quality === 'low' ? 14 : quality === 'medium' ? 20 : 26;
  const leaflets = quality === 'low' ? 24 : quality === 'medium' ? 32 : 40;

  const frondGeo = useMemo(() => buildFrondGeometry(leaflets), [leaflets]);
  const frondMat = useMemo(
    () =>
      applyWind(
        new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.78, metalness: 0, envMapIntensity: 0.6 }),
        { sway: 0.012, stiffness: 1, speed: 1.1, mode: 'radial' },
      ),
    [],
  );

  const barkSet = useMemo(() => repeatSet(getTexSet('bark'), 1, 1), []);
  const trunkMat = useMemo(
    () => new THREE.MeshStandardMaterial({ ...barkSet, color: '#D8C7AE', roughness: 1, normalScale: new THREE.Vector2(1.4, 1.4) }),
    [barkSet],
  );

  const trunks = useMemo(
    () =>
      palms.map((p, i) => {
        const h = p.height ?? 6;
        return buildTrunk(h, p.lean ?? 0.06, p.leanDir ?? i * 1.3, p.seed ?? i + 1);
      }),
    [palms],
  );

  const crownGeo = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push(new THREE.Vector2(0.28 + Math.sin(t * Math.PI) * 0.22 - t * 0.1, t * 0.7));
    }
    return new THREE.LatheGeometry(pts, 16);
  }, []);
  const crownMat = useMemo(() => new THREE.MeshStandardMaterial({ ...barkSet, color: '#A88B66', roughness: 1 }), [barkSet]);

  const frondRef = useRef<THREE.InstancedMesh>(null);
  const fruitRef = useRef<THREE.InstancedMesh>(null);
  const stalkRef = useRef<THREE.InstancedMesh>(null);

  const fruitSpecs = useMemo(() => {
    const out: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const stalks: THREE.Matrix4[] = [];
    palms.forEach((p, pi) => {
      if (!p.fruit) return;
      const r = rand((p.seed ?? pi) + 101);
      const s = p.scale ?? 1;
      const top = trunks[pi].top.clone().multiplyScalar(s).add(new THREE.Vector3(...p.position));
      const clusters = 3 + Math.floor(r() * 2);
      for (let c = 0; c < clusters; c++) {
        const a = (c / clusters) * Math.PI * 2 + r();
        const anchor = top.clone().add(new THREE.Vector3(Math.cos(a) * 0.35, -0.15, Math.sin(a) * 0.35));
        const hang = anchor.clone().add(new THREE.Vector3(Math.cos(a) * 0.45, -0.9 - r() * 0.3, Math.sin(a) * 0.45));
        // stalk
        const mid = anchor.clone().lerp(hang, 0.5);
        const dir = hang.clone().sub(anchor);
        const len = dir.length();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        stalks.push(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, len, 1)));
        const tone = new THREE.Color().setHSL(0.07 + r() * 0.03, 0.75, 0.32 + r() * 0.12);
        for (let k = 0; k < 34; k++) {
          const t = r();
          const pos = hang.clone().add(new THREE.Vector3((r() - 0.5) * 0.32, -t * 0.45 + 0.1, (r() - 0.5) * 0.32));
          const m = new THREE.Matrix4().compose(
            pos,
            new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 0.6, r() * 3, r() * 0.6)),
            new THREE.Vector3(0.028, 0.042, 0.028).multiplyScalar(0.9 + r() * 0.25),
          );
          out.push({ m, c: tone.clone().offsetHSL(0, 0, (r() - 0.5) * 0.08) });
        }
      }
    });
    return { fruit: out, stalks };
  }, [palms, trunks]);

  useLayoutEffect(() => {
    const mesh = frondRef.current;
    if (!mesh) return;
    let idx = 0;
    const tmpM = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const col = new THREE.Color();
    palms.forEach((p, pi) => {
      const r = rand((p.seed ?? pi) + 17);
      const s = p.scale ?? 1;
      const top = trunks[pi].top.clone().multiplyScalar(s).add(new THREE.Vector3(...p.position));
      top.y += 0.5 * s;
      for (let f = 0; f < frondsPerPalm; f++) {
        const t = f / frondsPerPalm;
        const yaw = f * 2.39996 + r() * 0.2;
        const pitch = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(62, -28, t) + (r() - 0.5) * 10);
        e.set(0, yaw, pitch, 'YZX');
        q.setFromEuler(e);
        const sc = (0.82 + r() * 0.3) * s * (t < 0.15 ? 0.75 : 1);
        tmpM.compose(top.clone().add(new THREE.Vector3(0, -t * 0.35 * s, 0)), q, new THREE.Vector3(sc, sc, sc));
        mesh.setMatrixAt(idx, tmpM);
        // Older (lower) fronds turn yellow-grey
        const age = THREE.MathUtils.smoothstep(t, 0.7, 1);
        col.setRGB(1, 1, 1).lerp(new THREE.Color('#E0C48A'), age * 0.7);
        mesh.setColorAt(idx, col);
        idx++;
      }
    });
    mesh.count = idx;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [palms, trunks, frondsPerPalm]);

  useLayoutEffect(() => {
    const fm = fruitRef.current;
    const sm = stalkRef.current;
    if (fm) {
      fruitSpecs.fruit.forEach((f, i) => {
        fm.setMatrixAt(i, f.m);
        fm.setColorAt(i, f.c);
      });
      fm.count = fruitSpecs.fruit.length;
      fm.instanceMatrix.needsUpdate = true;
      if (fm.instanceColor) fm.instanceColor.needsUpdate = true;
      fm.computeBoundingSphere();
    }
    if (sm) {
      fruitSpecs.stalks.forEach((m, i) => sm.setMatrixAt(i, m));
      sm.count = fruitSpecs.stalks.length;
      sm.instanceMatrix.needsUpdate = true;
      sm.computeBoundingSphere();
    }
  }, [fruitSpecs]);

  const maxFronds = palms.length * frondsPerPalm;
  const fruitGeo = useMemo(() => new THREE.SphereGeometry(1, 8, 6), []);
  const stalkGeo = useMemo(() => new THREE.CylinderGeometry(0.012, 0.02, 1, 5, 1), []);

  return (
    <group>
      {palms.map((p, i) => (
        <group key={i} position={p.position} scale={p.scale ?? 1}>
          <mesh geometry={trunks[i].geometry} material={trunkMat} castShadow receiveShadow />
          <mesh geometry={crownGeo} material={crownMat} position={trunks[i].top} castShadow />
        </group>
      ))}
      <instancedMesh ref={frondRef} args={[frondGeo, frondMat, Math.max(1, maxFronds)]} castShadow receiveShadow frustumCulled={false} />
      {fruitSpecs.fruit.length > 0 && (
        <>
          <instancedMesh ref={fruitRef} args={[fruitGeo, undefined, fruitSpecs.fruit.length]} castShadow>
            <meshStandardMaterial roughness={0.42} metalness={0} />
          </instancedMesh>
          <instancedMesh ref={stalkRef} args={[stalkGeo, undefined, Math.max(1, fruitSpecs.stalks.length)]} castShadow>
            <meshStandardMaterial color="#D8A245" roughness={0.7} />
          </instancedMesh>
        </>
      )}
    </group>
  );
}

/** Utility for scenes that want to merge static geometry. */
export function merge(geos: THREE.BufferGeometry[]) {
  return mergeGeometries(geos, false);
}
