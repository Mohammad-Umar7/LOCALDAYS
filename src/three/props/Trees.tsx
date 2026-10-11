import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getTexSet, repeatSet } from '../materials/textures';
import { applyWind } from '../materials/wind';
import type { Quality, Vec3 } from '../core/types';

/* ------------------------------------------------------------------ */
/*  Procedural broadleaf / desert trees (Ghaf, Sidr, Samar).            */
/*  Recursive tapered branches merged into one mesh, plus thousands     */
/*  of instanced leaves clustered at branch tips, swaying in the wind. */
/* ------------------------------------------------------------------ */

export interface TreeStyle {
  trunkHeight: number;
  trunkRadius: number;
  levels: number;
  branchCount: [number, number];
  spread: number;
  lengthDecay: number;
  radiusDecay: number;
  gnarl: number;
  /** Positive = leaves hang below tips (ghaf weeping habit) */
  droop: number;
  leafColor: string;
  leafColor2: string;
  leafSize: number;
  leavesPerTip: number;
  clusterRadius: number;
  barkColor: string;
  /** Flatten canopy (acacia/samar umbrella shape) */
  umbrella?: number;
  flowers?: { color: string; share: number };
}

export const TREE_STYLES = {
  ghaf: {
    trunkHeight: 2.1,
    trunkRadius: 0.26,
    levels: 4,
    branchCount: [2, 3],
    spread: 0.9,
    lengthDecay: 0.7,
    radiusDecay: 0.6,
    gnarl: 0.38,
    droop: 0.75,
    leafColor: '#6F8152',
    leafColor2: '#9AA873',
    leafSize: 0.12,
    leavesPerTip: 300,
    clusterRadius: 0.85,
    barkColor: '#8A7864',
  },
  sidr: {
    trunkHeight: 1.6,
    trunkRadius: 0.21,
    levels: 4,
    branchCount: [2, 3],
    spread: 1.0,
    lengthDecay: 0.7,
    radiusDecay: 0.6,
    gnarl: 0.45,
    droop: 0.2,
    leafColor: '#4C6A31',
    leafColor2: '#6F8C45',
    leafSize: 0.12,
    leavesPerTip: 240,
    clusterRadius: 0.72,
    barkColor: '#6E5A48',
    flowers: { color: '#E8D86A', share: 0.06 },
  },
  samar: {
    trunkHeight: 1.5,
    trunkRadius: 0.18,
    levels: 4,
    branchCount: [2, 3],
    spread: 1.1,
    lengthDecay: 0.78,
    radiusDecay: 0.6,
    gnarl: 0.5,
    droop: 0.05,
    leafColor: '#6A7B42',
    leafColor2: '#8D9A5A',
    leafSize: 0.09,
    leavesPerTip: 220,
    clusterRadius: 0.8,
    barkColor: '#5A4A3E',
    umbrella: 0.6,
    flowers: { color: '#F4E7A8', share: 0.05 },
  },
  bougainvillea: {
    trunkHeight: 0.5,
    trunkRadius: 0.06,
    levels: 3,
    branchCount: [3, 4],
    spread: 1.15,
    lengthDecay: 0.72,
    radiusDecay: 0.6,
    gnarl: 0.5,
    droop: 0.25,
    leafColor: '#3E6A2C',
    leafColor2: '#557F38',
    leafSize: 0.085,
    leavesPerTip: 170,
    clusterRadius: 0.42,
    barkColor: '#5A4636',
    flowers: { color: '#D2357F', share: 0.42 },
  },
  shrub: {
    trunkHeight: 0.15,
    trunkRadius: 0.04,
    levels: 2,
    branchCount: [4, 5],
    spread: 1.3,
    lengthDecay: 0.8,
    radiusDecay: 0.6,
    gnarl: 0.6,
    droop: 0.1,
    leafColor: '#7E8150',
    leafColor2: '#A19A62',
    leafSize: 0.07,
    leavesPerTip: 70,
    clusterRadius: 0.3,
    barkColor: '#6A5A46',
  },
} satisfies Record<string, TreeStyle>;

export interface TreeSpec {
  position: Vec3;
  seed?: number;
  scale?: number;
  rotation?: number;
}

function rng(seed: number) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function taperedTube(points: THREE.Vector3[], r0: number, r1: number, radial = 7) {
  const curve = new THREE.CatmullRomCurve3(points);
  const segs = Math.max(4, points.length * 3);
  const frames = curve.computeFrenetFrames(segs, false);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPointAt(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const r = THREE.MathUtils.lerp(r0, r1, t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const cx = Math.cos(a);
      const cy = Math.sin(a);
      pos.push(p.x + r * (cx * N.x + cy * B.x), p.y + r * (cx * N.y + cy * B.y), p.z + r * (cx * N.z + cy * B.z));
      uv.push(j / radial, t * curve.getLength() * 1.2);
    }
  }
  for (let i = 0; i < segs; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

interface Built {
  wood: THREE.BufferGeometry;
  tips: { p: THREE.Vector3; d: THREE.Vector3; size: number }[];
}

function buildTree(style: TreeStyle, seed: number, quality: Quality): Built {
  const r = rng(seed);
  const geos: THREE.BufferGeometry[] = [];
  const tips: Built['tips'] = [];
  const radial = quality === 'low' ? 5 : 7;

  const grow = (start: THREE.Vector3, dir: THREE.Vector3, length: number, radius: number, level: number) => {
    const pts = [start.clone()];
    const steps = 3;
    const d = dir.clone();
    let p = start.clone();
    for (let i = 1; i <= steps; i++) {
      d.add(new THREE.Vector3((r() - 0.5) * style.gnarl, (r() - 0.5) * style.gnarl * 0.4, (r() - 0.5) * style.gnarl)).normalize();
      if (style.umbrella && level >= 1) d.y *= 1 - style.umbrella * 0.5;
      d.normalize();
      p = p.clone().addScaledVector(d, length / steps);
      pts.push(p);
    }
    geos.push(taperedTube(pts, radius, radius * style.radiusDecay, radial));
    const end = pts[pts.length - 1];
    if (level >= style.levels) {
      tips.push({ p: end, d: d.clone(), size: length });
      return;
    }
    const n = style.branchCount[0] + Math.floor(r() * (style.branchCount[1] - style.branchCount[0] + 1));
    for (let i = 0; i < n; i++) {
      const yaw = (i / n) * Math.PI * 2 + r() * 0.8;
      const out = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
      const nd = d
        .clone()
        .multiplyScalar(1 - style.spread * 0.6)
        .addScaledVector(out, style.spread)
        .add(new THREE.Vector3(0, 0.35 - level * 0.08, 0))
        .normalize();
      const from = pts[Math.max(1, pts.length - 1 - Math.floor(r() * 2))];
      grow(from, nd, length * style.lengthDecay * (0.85 + r() * 0.3), radius * style.radiusDecay, level + 1);
    }
  };

  grow(new THREE.Vector3(0, -0.1, 0), new THREE.Vector3((r() - 0.5) * 0.15, 1, (r() - 0.5) * 0.15).normalize(), style.trunkHeight, style.trunkRadius, 1);
  const wood = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  return { wood, tips };
}

function leafGeometry() {
  // Small elongated leaf (two triangles + a fold) with origin at the stem
  const g = new THREE.BufferGeometry();
  const v = new Float32Array([0, 0, 0, -0.35, 0.5, 0.06, 0, 1, 0, 0.35, 0.5, 0.06]);
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

export function Trees({ trees, style, quality = 'high' }: { trees: TreeSpec[]; style: TreeStyle; quality?: Quality }) {
  const leafScale = quality === 'low' ? 0.5 : quality === 'medium' ? 0.75 : 1;
  const built = useMemo(() => trees.map((t, i) => buildTree(style, t.seed ?? i + 3, quality)), [trees, style, quality]);
  const barkSet = useMemo(() => repeatSet(getTexSet('furrowBark', { base: style.barkColor, dark: '#3A2F26', seed: 21 }), 1, 1), [style.barkColor]);
  const woodMat = useMemo(() => new THREE.MeshStandardMaterial({ ...barkSet, roughness: 1 }), [barkSet]);
  const leafGeo = useMemo(() => leafGeometry(), []);
  const leafMat = useMemo(
    () =>
      applyWind(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.82, envMapIntensity: 0.5 }), {
        sway: 0.03,
        stiffness: 0.45,
        speed: 1.3,
      }),
    [],
  );
  const leafRef = useRef<THREE.InstancedMesh>(null);
  const flowerRef = useRef<THREE.InstancedMesh>(null);

  const counts = useMemo(() => {
    let leaves = 0;
    built.forEach((b) => (leaves += b.tips.length * Math.round(style.leavesPerTip * leafScale)));
    return leaves;
  }, [built, style, leafScale]);

  useLayoutEffect(() => {
    const mesh = leafRef.current;
    if (!mesh) return;
    const fl = flowerRef.current;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const c = new THREE.Color();
    const c1 = new THREE.Color(style.leafColor);
    const c2 = new THREE.Color(style.leafColor2);
    const fc = style.flowers ? new THREE.Color(style.flowers.color) : null;
    let i = 0;
    let fi = 0;
    trees.forEach((t, ti) => {
      const r = rng((t.seed ?? ti) + 77);
      const s = t.scale ?? 1;
      const rot = new THREE.Matrix4().makeRotationY(t.rotation ?? 0);
      const per = Math.round(style.leavesPerTip * leafScale);
      const zAxis = new THREE.Vector3(0, 0, 1);
      const down = new THREE.Vector3(0, -1, 0);
      built[ti].tips.forEach((tip) => {
        // Each tip carries 3–5 clumps so silhouettes read as natural masses, not noise
        const clumps = Array.from({ length: 3 + Math.floor(r() * 3) }, () => {
          const o = new THREE.Vector3((r() - 0.5) * 2, (r() - 0.35) * 1.2, (r() - 0.5) * 2).multiplyScalar(style.clusterRadius * 0.55);
          o.addScaledVector(tip.d, style.clusterRadius * 0.4);
          o.y -= style.droop * style.clusterRadius * 0.45;
          if (style.umbrella) o.y *= 1 - style.umbrella;
          return { o, r: style.clusterRadius * (0.55 + r() * 0.35) };
        });
        for (let k = 0; k < per; k++) {
          const cl = clumps[Math.floor(r() * clumps.length)];
          const u = r() * Math.PI * 2;
          const v = Math.acos(2 * r() - 1);
          // Bias towards the clump surface (where light hits)
          const shell = 0.45 + 0.55 * Math.sqrt(r());
          const dir = new THREE.Vector3(Math.sin(v) * Math.cos(u), Math.cos(v) * 0.75, Math.sin(v) * Math.sin(u));
          const off = cl.o.clone().addScaledVector(dir, cl.r * shell);
          if (style.droop > 0.3) off.y -= style.droop * cl.r * 0.6 * r() * (1 - Math.max(0, dir.y));
          if (style.umbrella) off.y = cl.o.y + (off.y - cl.o.y) * (1 - style.umbrella);
          const p = tip.p.clone().add(off).applyMatrix4(rot).multiplyScalar(s).add(new THREE.Vector3(...t.position));
          // Leaf faces outward, twisted randomly, tips hanging for weeping habits
          const outward = dir.clone().applyMatrix4(rot).normalize();
          q.setFromUnitVectors(zAxis, outward);
          const twist = new THREE.Quaternion().setFromAxisAngle(zAxis, r() * Math.PI * 2);
          q.multiply(twist);
          if (style.droop > 0.3) {
            const hang = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0).applyQuaternion(q), down);
            q.premultiply(new THREE.Quaternion().slerp(hang, style.droop * 0.45 * r()));
          }
          e.set(0, 0, 0);
          const ls = style.leafSize * s * (0.7 + r() * 0.6);
          m.compose(p, q, new THREE.Vector3(ls, ls * 1.6, ls));
          const isFlower = fc && fl && r() < (style.flowers?.share ?? 0) * (0.6 + shell * 0.8);
          if (isFlower) {
            fl!.setMatrixAt(fi, m);
            c.copy(fc!).offsetHSL((r() - 0.5) * 0.03, 0, (r() - 0.5) * 0.1);
            fl!.setColorAt(fi, c);
            fi++;
          } else {
            mesh.setMatrixAt(i, m);
            // Inner leaves sit in the canopy's own shade
            c.copy(c1).lerp(c2, r() * shell).multiplyScalar(0.62 + 0.42 * shell).offsetHSL(0, 0, (r() - 0.5) * 0.05);
            mesh.setColorAt(i, c);
            i++;
          }
        }
      });
    });
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    if (fl) {
      fl.count = fi;
      fl.instanceMatrix.needsUpdate = true;
      if (fl.instanceColor) fl.instanceColor.needsUpdate = true;
      fl.computeBoundingSphere();
    }
  }, [built, trees, style, leafScale]);

  return (
    <group>
      {trees.map((t, i) => (
        <mesh
          key={i}
          geometry={built[i].wood}
          material={woodMat}
          position={t.position}
          rotation={[0, t.rotation ?? 0, 0]}
          scale={t.scale ?? 1}
          castShadow
          receiveShadow
        />
      ))}
      <instancedMesh ref={leafRef} args={[leafGeo, leafMat, Math.max(1, counts)]} castShadow receiveShadow frustumCulled={false} />
      {style.flowers && (
        <instancedMesh ref={flowerRef} args={[leafGeo, leafMat, Math.max(1, counts)]} castShadow frustumCulled={false} />
      )}
    </group>
  );
}
