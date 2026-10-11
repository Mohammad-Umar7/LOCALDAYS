import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { makeNoise } from '../../materials/noise';
import { boxProjectUVs } from '../../props/geo';
import type { Quality } from '../../core/types';
import { BREAKWATER_PTS, BW_CREST, breakwaterCurve, groundHeight, moundAt, rng } from './layout';
import { PAL, type HarbourMaterials } from './materials';
import { box, mergeAll, place, rod, tint } from './util';

/* ------------------------------------------------------------------ */
/*  Rubble-mound breakwater: quarried armour rock (icosahedra cut by   */
/*  random planes into faceted blocks), piled crest-to-toe along the  */
/*  curve, with a wet band and weed at the tide line — and a harbour  */
/*  light on the round head.                                           */
/* ------------------------------------------------------------------ */

const nz = makeNoise(61);

function rockGeometry(detail: number, seed: number) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position as THREE.BufferAttribute;
  const r = rng(seed);
  const planes = Array.from({ length: 9 }, (_, k) => {
    const n = k < 2 ? new THREE.Vector3((r() - 0.5) * 0.3, k === 0 ? 1 : -1, (r() - 0.5) * 0.3).normalize() : new THREE.Vector3(r() - 0.5, (r() - 0.5) * 0.7, r() - 0.5).normalize();
    return { n, d: 0.5 + r() * 0.28 };
  });
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    for (const pl of planes) {
      const k = v.dot(pl.n) - pl.d;
      if (k > 0) v.addScaledVector(pl.n, -k * 0.97);
    }
    const n = nz(v.x * 2.1 + seed, v.y * 2.1 + v.z * 1.7, 4096, 4096) * 0.06 + nz(v.x * 6 + v.z * 5, v.y * 6 + seed, 4096, 4096) * 0.025;
    v.multiplyScalar(1 + n);
    v.y *= 0.72;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  boxProjectUVs(g, 0.42);
  return g;
}

interface Rock {
  m: THREE.Matrix4;
  c: THREE.Color;
}

function useRocks(quality: Quality) {
  return useMemo(() => {
    const r = rng(7);
    const curve = breakwaterCurve();
    const len = curve.getLength();
    const step = quality === 'high' ? 1.75 : 2.4;
    const n = Math.floor(len / step);
    const big: Rock[] = [];
    const small: Rock[] = [];
    const o = new THREE.Object3D();
    const add = (list: Rock[], x: number, y: number, z: number, s: number, flat = 0.75) => {
      o.position.set(x, y, z);
      o.rotation.set((r() - 0.5) * 0.5, r() * Math.PI * 2, (r() - 0.5) * 0.5);
      o.scale.set(s * (0.85 + r() * 0.35), s * flat * (0.8 + r() * 0.35), s * (0.85 + r() * 0.35));
      o.updateMatrix();
      const tone = 0.7 + r() * 0.42;
      const warm = r();
      list.push({ m: o.matrix.clone(), c: new THREE.Color(tone * (0.98 + warm * 0.06), tone * (0.95 + warm * 0.03), tone * (0.9 + (1 - warm) * 0.1)) });
    };
    for (let i = 0; i <= n; i++) {
      const t = (i + (r() - 0.5) * 0.4) / n;
      const p = curve.getPointAt(Math.min(1, Math.max(0, t)));
      const tg = curve.getTangentAt(Math.min(1, Math.max(0, t)));
      const side = new THREE.Vector3(-tg.z, 0, tg.x);
      const onLand = t < 0.07;
      const at = (off: number, along = 0) => ({ x: p.x + side.x * off + tg.x * along, z: p.z + side.z * off + tg.z * along });
      const surf = (off: number, x: number, z: number) => (onLand ? groundHeight(x, z) : Math.max(moundAt(off), groundHeight(x, z)));
      // crest armour: big blocks interlocking along the top
      for (const sOff of [-1.05, 1.05]) {
        const off = sOff + (r() - 0.5) * 0.7;
        const q = at(off, (r() - 0.5) * 0.8);
        const sc = 1.2 + r() * 0.75;
        add(big, q.x, surf(off, q.x, q.z) + sc * 0.4, q.z, sc);
      }
      if (r() > 0.4) {
        const q = at((r() - 0.5) * 0.6, (r() - 0.5));
        add(big, q.x, surf(0, q.x, q.z) + 0.85 + r() * 0.4, q.z, 0.95 + r() * 0.45);
      }
      if (onLand) continue;
      // slopes on both faces, stepping down into the water
      for (const sgn of [-1, 1]) {
        for (const [o0, o1, sz] of [
          [2.4, 3.0, 1.0],
          [3.5, 4.2, 0.95],
          [4.6, 5.4, 0.85],
        ] as const) {
          if (o0 > 4 && quality !== 'high') continue;
          const off = sgn * (o0 + r() * (o1 - o0));
          const q = at(off, (r() - 0.5) * 1.6);
          const sc = sz + r() * 0.35;
          add(small, q.x, surf(off, q.x, q.z) + sc * 0.32, q.z, sc);
        }
      }
    }
    // round head
    const end = curve.getPointAt(1);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      const sc = 1.0 + r() * 0.35;
      add(k % 2 ? small : big, end.x + Math.cos(a) * 3.0, moundAt(3.0) + sc * 0.42, end.z + Math.sin(a) * 3.0, sc);
    }
    return { big, small, end };
  }, [quality]);
}

function RockSet({ geo, items, material }: { geo: THREE.BufferGeometry; items: Rock[]; material: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    items.forEach((it, i) => {
      m.setMatrixAt(i, it.m);
      m.setColorAt(i, it.c);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[geo, material, items.length]} castShadow receiveShadow />;
}

/** Rock material with a wet band, weed and barnacle tint through the tidal zone. */
function useWetRock(m: HarbourMaterials) {
  return useMemo(() => {
    const mat = m.rock.clone();
    mat.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vRW;')
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
           vec4 rwp = vec4(transformed, 1.0);
           #ifdef USE_INSTANCING
             rwp = instanceMatrix * rwp;
           #endif
           vRW = (modelMatrix * rwp).xyz;`,
        );
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vRW;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           float wetB = 1.0 - smoothstep(-0.05, 0.6, vRW.y + sin(vRW.x * 1.7 + vRW.z * 1.3) * 0.08);
           float weed = 1.0 - smoothstep(-0.4, 0.12, vRW.y + sin(vRW.x * 3.1) * 0.06);
           diffuseColor.rgb *= mix(1.0, 0.55, wetB);
           diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.2, 0.1), weed * 0.65);`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
           roughnessFactor = mix(roughnessFactor, 0.45, (1.0 - smoothstep(-0.05, 0.45, vRW.y)) * 0.8);`,
        );
    };
    mat.customProgramCacheKey = () => 'hb-wetrock';
    return mat;
  }, [m]);
}

export function Breakwater({ m, quality, lit }: { m: HarbourMaterials; quality: Quality; lit: boolean }) {
  const rocks = useRocks(quality);
  const bigGeo = useMemo(() => rockGeometry(quality === 'high' ? 3 : 2, 3), [quality]);
  const smallGeo = useMemo(() => rockGeometry(2, 9), []);
  const mat = useWetRock(m);
  const beacon = useMemo(() => {
    const e = rocks.end;
    const y0 = BW_CREST + 0.8;
    const base = place(box(2.0, 1.2, 2.0, 0.08, 0.5), [e.x, y0 + 0.2, e.z]);
    const tower = place(new THREE.CylinderGeometry(0.42, 0.55, 3.2, 28, 4), [e.x, y0 + 2.4, e.z]);
    const band = place(new THREE.CylinderGeometry(0.44, 0.48, 0.7, 28, 1), [e.x, y0 + 2.2, e.z]);
    const gallery = place(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 28), [e.x, y0 + 4.05, e.z]);
    const rails: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      rails.push(rod(new THREE.Vector3(e.x + Math.cos(a) * 0.58, y0 + 4.05, e.z + Math.sin(a) * 0.58), new THREE.Vector3(e.x + Math.cos(a) * 0.58, y0 + 4.5, e.z + Math.sin(a) * 0.58), 0.015, 0.015, 4));
    }
    const ring = place(new THREE.TorusGeometry(0.58, 0.018, 4, 28), [e.x, y0 + 4.5, e.z], [Math.PI / 2, 0, 0]);
    const lamp = place(new THREE.CylinderGeometry(0.2, 0.2, 0.36, 18), [e.x, y0 + 4.3, e.z]);
    const cap = place(new THREE.ConeGeometry(0.3, 0.3, 18), [e.x, y0 + 4.63, e.z]);
    return { base, paint: mergeAll([tint(mergeAll([tower, gallery]), PAL.white), tint(mergeAll([band, cap]), PAL.beaconGreen)], true), metal: tint(mergeAll([...rails, ring]), PAL.steel), lamp };
  }, [rocks]);
  return (
    <group>
      <RockSet geo={bigGeo} items={rocks.big} material={mat} />
      <RockSet geo={smallGeo} items={rocks.small} material={mat} />
      <mesh geometry={beacon.base} material={m.concrete} castShadow receiveShadow />
      <mesh geometry={beacon.paint} material={m.paint} castShadow receiveShadow />
      <mesh geometry={beacon.metal} material={m.metal} castShadow receiveShadow />
      <mesh geometry={beacon.lamp}>
        <meshStandardMaterial color="#D9F7E6" emissive="#3DFF9A" emissiveIntensity={lit ? 5 : 0.4} roughness={0.2} />
      </mesh>
    </group>
  );
}

export { BREAKWATER_PTS };
