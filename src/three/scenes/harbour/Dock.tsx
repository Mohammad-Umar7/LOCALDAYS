import { useMemo } from 'react';
import * as THREE from 'three';
import { makeNoise } from '../../materials/noise';
import { Lantern } from '../../props/Decor';
import { sagCurve, smoothLathe } from '../../props/geo';
import type { Quality, Vec3 } from '../../core/types';
import { JETTY, groundHeight, jettyPiles, rng } from './layout';
import { PAL, type HarbourMaterials } from './materials';
import { box, mergeAll, place, rod, shiftUV, tint } from './util';

/* ------------------------------------------------------------------ */
/*  Timber jetty on driven piles (with a marine-growth band at the    */
/*  tide line), bearers, joists, gapped planking with per-board tone,  */
/*  kerbs, cast-iron bollards, tyre fenders, lamp posts, a boarding   */
/*  ladder — and the T-head briefing point: heritage marker stone,    */
/*  life-jacket rack, shade umbrella and bench.                        */
/* ------------------------------------------------------------------ */

const D = JETTY.deck;
const PLANK_T = 0.055;
const nz = makeNoise(91);

/** Dock lamp posts (deck positions); lanterns hang from an arm toward the walkway. */
export const LAMP_POSTS: Vec3[] = [
  [-1.5, D, 0.2],
  [1.5, D, -12.2],
  [-1.5, D, -21.8],
  [-6.0, D, -33.1],
  [6.0, D, -34.6],
];
export const LAMP_GLASS: [number, number, number][] = LAMP_POSTS.map(([x, y, z]) => [x + (x > 0 ? -0.36 : 0.36), y + 1.29 + 0.18, z]);

export const BOLLARDS: Vec3[] = [
  [-1.32, D, -9.6],
  [-1.32, D, -27.6],
  [1.32, D, -8.4],
  [1.32, D, -16.4],
  [-5.75, D, -30.5],
  [5.75, D, -30.5],
  [-5.75, D, -35.75],
  [5.75, D, -35.75],
];

function coil(x: number, z: number, y: number, r = 0.3, turns = 5) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= turns * 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rr = r - (i / (turns * 24)) * r * 0.55;
    pts.push(new THREE.Vector3(x + Math.cos(a) * rr, y + 0.024 + Math.floor(i / 24) * 0.006, z + Math.sin(a) * rr));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 36, 0.024, 5, false);
}

function tyreGeometry() {
  const g = new THREE.TorusGeometry(0.34, 0.12, 10, 30);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const ang = Math.atan2(v.y, v.x);
    const rad = Math.hypot(v.x, v.y);
    if (rad > 0.4) {
      const tread = Math.sign(Math.sin(ang * 34)) * 0.008;
      const k = (rad + tread) / rad;
      v.x *= k;
      v.y *= k;
    }
    v.z *= 0.85;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function bollardGeometry() {
  return smoothLathe(
    [
      [0.001, 0],
      [0.22, 0],
      [0.22, 0.04],
      [0.15, 0.07],
      [0.12, 0.2],
      [0.125, 0.33],
      [0.19, 0.38],
      [0.2, 0.43],
      [0.17, 0.47],
      [0.001, 0.49],
    ],
    28,
    40,
  );
}

/** Life jacket: bevelled vest panel with a V neck and reflective tape. */
function vestGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.2, 0);
  s.lineTo(0.2, 0);
  s.quadraticCurveTo(0.23, 0.25, 0.2, 0.5);
  s.lineTo(0.09, 0.56);
  s.lineTo(0.0, 0.36);
  s.lineTo(-0.09, 0.56);
  s.lineTo(-0.2, 0.5);
  s.quadraticCurveTo(-0.23, 0.25, -0.2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 3, curveSegments: 8 });
  g.translate(0, -0.56, -0.025);
  return g;
}

function plaqueRelief() {
  // dhow silhouette: hull + lateen sail, in relief on the bronze plaque
  const hull = new THREE.Shape();
  hull.moveTo(-0.17, 0.0);
  hull.quadraticCurveTo(-0.05, -0.05, 0.16, -0.01);
  hull.lineTo(0.2, 0.05);
  hull.lineTo(-0.2, 0.06);
  hull.closePath();
  const sail = new THREE.Shape();
  sail.moveTo(-0.12, 0.08);
  sail.quadraticCurveTo(0.02, 0.12, 0.17, 0.08);
  sail.lineTo(-0.05, 0.27);
  sail.closePath();
  const g = new THREE.ExtrudeGeometry([hull, sail], { depth: 0.008, bevelEnabled: false });
  return g;
}

function useDockParts(quality: Quality) {
  return useMemo(() => {
    const r = rng(17);
    const piles = jettyPiles();
    const pileGeos: THREE.BufferGeometry[] = [];
    const growth: THREE.BufferGeometry[] = [];
    const tallPiles = new Set(['-6,-30.2', '6,-30.2', '-6,-36', '6,-36']);
    piles.forEach(([x, z, rad], i) => {
      const floor = groundHeight(x, z);
      const top = tallPiles.has(`${x},${z}`) ? D + 0.85 : D - 0.42;
      const g = rod(new THREE.Vector3(x, floor - 0.4, z), new THREE.Vector3(x + (r() - 0.5) * 0.03, top, z + (r() - 0.5) * 0.03), rad, rad * 0.93, 14, 6);
      shiftUV(g, r(), r() * 3);
      pileGeos.push(g);
      if (top > D) pileGeos.push(place(new THREE.SphereGeometry(rad * 0.98, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), [x, top, z]));
      // barnacle/weed band through the tidal range
      if (floor < 0.2) {
        const b = new THREE.CylinderGeometry(rad + 0.03, rad + 0.045, 0.95, 16, 5, true);
        const p = b.attributes.position as THREE.BufferAttribute;
        for (let k = 0; k < p.count; k++) {
          const px = p.getX(k);
          const py = p.getY(k);
          const pz = p.getZ(k);
          const n = 1 + nz(Math.atan2(pz, px) * 3 + i, py * 6, 4096, 4096) * 0.18;
          p.setXYZ(k, px * n, py + (py > 0.4 ? nz(i, Math.atan2(pz, px) * 4, 4096, 4096) * 0.08 : 0), pz * n);
        }
        b.computeVertexNormals();
        b.translate(x, -0.2, z);
        growth.push(b);
      }
    });

    // bearers & joists
    const frame: THREE.BufferGeometry[] = [];
    const bearerY = D - PLANK_T - 0.18 - 0.12;
    for (let k = 0; k < 9; k++) {
      const z = 1.5 - k * JETTY.pileStep;
      frame.push(place(box(3.7, 0.24, 0.26, 0.02, 0.5), [0, bearerY, z]));
      // X bracing on every other bent
      if (k % 2 === 1 && groundHeight(0, z) < 0) {
        const lo = Math.max(groundHeight(0, z) + 0.3, -0.9);
        for (const s of [1, -1]) {
          const a = new THREE.Vector3(-1.45, bearerY - 0.15, z + s * 0.2);
          const b = new THREE.Vector3(1.45, lo, z + s * 0.2);
          if (s < 0) [a.x, b.x] = [b.x, a.x];
          frame.push(rod(a, b, 0.05, 0.05, 6));
        }
      }
    }
    for (const x of [-1.38, -0.46, 0.46, 1.38]) frame.push(place(box(0.14, 0.18, JETTY.z0 - JETTY.z1 + 0.2, 0.015, 0.5), [x, D - PLANK_T - 0.09, (JETTY.z0 + JETTY.z1) / 2 - 0.1]));
    for (const x of [-6, -3, 0, 3, 6]) frame.push(place(box(0.26, 0.24, 6.6, 0.02, 0.5), [x, bearerY, -33.1]));
    for (let z = -30.1; z >= -36.15; z -= 1.2) frame.push(place(box(12.6, 0.18, 0.14, 0.015, 0.5), [0, D - PLANK_T - 0.09, z]));

    // planks: per-board tone, UV offset and a hair of twist
    const planks: THREE.BufferGeometry[] = [];
    const tone = new THREE.Color();
    for (let z = JETTY.z0 - 1.6; z > JETTY.z1 + 0.05; z -= 0.2) {
      const g = box(3.24 + (r() - 0.5) * 0.04, PLANK_T, 0.185, 0.012, 0.5, 1);
      shiftUV(g, r() * 4, r() * 4);
      place(g, [(r() - 0.5) * 0.03, D - PLANK_T / 2 + (r() - 0.5) * 0.008, z], [(r() - 0.5) * 0.012, (r() - 0.5) * 0.01, (r() - 0.5) * 0.01]);
      tone.setHSL(0.08 + r() * 0.02, 0.12 + r() * 0.08, 0.55 + r() * 0.16);
      planks.push(tint(g, tone));
    }
    for (let x = JETTY.head.x0 + 0.1; x < JETTY.head.x1; x += 0.2) {
      const g = box(0.185, PLANK_T, 6.2 + (r() - 0.5) * 0.04, 0.012, 0.5, 1);
      shiftUV(g, r() * 4, r() * 4);
      place(g, [x, D - PLANK_T / 2 + (r() - 0.5) * 0.008, -33.1], [(r() - 0.5) * 0.01, (r() - 0.5) * 0.008, (r() - 0.5) * 0.012]);
      tone.setHSL(0.08 + r() * 0.02, 0.12 + r() * 0.08, 0.55 + r() * 0.16);
      planks.push(tint(g, tone));
    }

    // kerbs (wheel guards) along the edges
    const kerb: THREE.BufferGeometry[] = [];
    for (const x of [-JETTY.halfW + 0.08, JETTY.halfW - 0.08]) kerb.push(place(box(0.14, 0.1, JETTY.z0 - JETTY.z1 - 1.8, 0.02, 0.5), [x, D + 0.05, (JETTY.z0 - 1.6 + JETTY.z1) / 2 + 0.1]));
    kerb.push(place(box(12.4, 0.1, 0.14, 0.02, 0.5), [0, D + 0.05, -36.13]));
    for (const s of [-1, 1]) {
      kerb.push(place(box(0.14, 0.1, 6.2, 0.02, 0.5), [s * 6.13, D + 0.05, -33.1]));
      kerb.push(place(box(4.5, 0.1, 0.14, 0.02, 0.5), [s * 3.95, D + 0.05, -30.07]));
    }

    // abutment (stone) and steps down to the yard
    const abut: THREE.BufferGeometry[] = [];
    const gz = groundHeight(0, 6);
    abut.push(place(box(4.0, D - gz + 0.4, 4.2, 0.08, 0.45), [0, (D + gz - 0.4) / 2 - 0.01, 5.7]));
    for (let i = 0; i < 3; i++) {
      const h = (D - gz) * (1 - (i + 1) / 4);
      abut.push(place(box(3.0, h + 0.2, 0.38, 0.05, 0.45), [0, gz + h / 2 - 0.1, 7.95 + i * 0.38]));
    }

    // railing: landward east side (nets get draped over it) and the seaward edge of the head
    const rail: THREE.BufferGeometry[] = [];
    const railRun = (a: [number, number], b: [number, number], posts: number) => {
      for (let i = 0; i <= posts; i++) {
        const t = i / posts;
        const x = a[0] + (b[0] - a[0]) * t;
        const z = a[1] + (b[1] - a[1]) * t;
        rail.push(place(box(0.11, 1.05, 0.11, 0.02, 0.5), [x, D + 0.52, z]));
      }
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const ang = Math.atan2(b[0] - a[0], b[1] - a[1]);
      for (const y of [D + 1.02, D + 0.58]) rail.push(place(box(0.08, y > D + 1 ? 0.09 : 0.07, len + 0.1, 0.02, 0.5), [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2], [0, ang, 0]));
    };
    railRun([1.5, 3.4], [1.5, -7.6], 6);
    railRun([-5.95, -36.0], [5.95, -36.0], 8);

    // ladder on the east face of the head
    const ladder: THREE.BufferGeometry[] = [];
    for (const z of [-33.5, -32.9]) ladder.push(rod(new THREE.Vector3(6.28, -1.4, z), new THREE.Vector3(6.28, D + 0.85, z), 0.028, 0.028, 8));
    for (let y = -1.2; y < D; y += 0.3) ladder.push(rod(new THREE.Vector3(6.28, y, -33.5), new THREE.Vector3(6.28, y, -32.9), 0.018, 0.018, 6));

    // bollards
    const bol = bollardGeometry();
    const bollards = BOLLARDS.map((p) => place(bol.clone(), p));

    // tyre fenders hanging on ropes
    const tyreG = tyreGeometry();
    const tyres: THREE.BufferGeometry[] = [];
    const tyreRopes: THREE.BufferGeometry[] = [];
    const tyreAt = (x: number, z: number, out: number) => {
      const g = tyreG.clone();
      g.rotateY(Math.PI / 2);
      g.rotateZ(out * 0.12);
      place(g, [x + out * 0.15, 0.78, z]);
      tyres.push(g);
      const pts = sagCurve(new THREE.Vector3(x - out * 0.1, D + 0.02, z), new THREE.Vector3(x + out * 0.13, 1.1, z), 0.02, 8);
      tyreRopes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.018, 5, false));
    };
    for (const z of [-11.5, -15.8, -20.2, -24.6]) tyreAt(-JETTY.halfW, z, -1);
    for (const z of [-9.8, -13.6]) tyreAt(JETTY.halfW, z, 1);
    for (const x of [-4.5, 4.5]) {
      const g = tyreG.clone();
      g.rotateZ(0.08);
      place(g, [x, 0.78, -36.38]);
      tyres.push(g);
    }

    // coiled ropes on the deck
    const coils = [coil(-1.0, -9.0, D, 0.3), coil(1.0, -16.9, D, 0.28, 4), coil(-5.2, -31.1, D, 0.32), coil(4.9, -31.0, D, 0.26, 4)];

    // lamp posts
    const lamps = LAMP_POSTS;
    const lampGeo: THREE.BufferGeometry[] = [];
    lamps.forEach(([x, y, z]) => {
      lampGeo.push(place(box(0.13, 2.5, 0.13, 0.02, 0.5), [x, y + 1.25, z]));
      const s = x > 0 ? -1 : 1;
      lampGeo.push(place(box(0.42, 0.07, 0.07, 0.015, 0.5), [x + s * 0.2, y + 2.38, z]));
    });

    const T = tint;
    return {
      timber: mergeAll([T(mergeAll(pileGeos), PAL.pile), T(mergeAll(frame), PAL.pile), T(mergeAll(lampGeo), PAL.timber)], true),
      matte: mergeAll([...(growth.length ? [T(mergeAll(growth), PAL.growth)] : []), T(mergeAll(tyres), PAL.rubber)], true),
      planks: mergeAll([mergeAll(planks, true), T(mergeAll(kerb), '#FFFFFF'), T(mergeAll(rail), '#F4F0EA')], true),
      stone: T(mergeAll(abut), '#FFFFFF'),
      metal: mergeAll([T(mergeAll(ladder), PAL.galv), T(mergeAll(bollards), PAL.iron)], true),
      rope: mergeAll([T(mergeAll(tyreRopes), PAL.rope), T(mergeAll(coils), PAL.rope)], true),
      lamps,
    };
  }, [quality]);
}

/** Heritage marker, life-jacket rack, umbrella and bench at the jetty head. */
function BriefingPoint({ m }: { m: HarbourMaterials }) {
  const parts = useMemo(() => {
    // marker stone on a plinth with a bronze plaque
    const stone = place(box(0.78, 1.18, 0.34, 0.07, 0.6, 3), [-3.9, D + 0.2 + 0.59, -34.9], [0, 0.25, 0]);
    const plinth = place(box(1.15, 0.2, 0.62, 0.04, 0.6), [-3.9, D + 0.1, -34.9], [0, 0.25, 0]);
    const plaque = box(0.5, 0.36, 0.025, 0.012, 1);
    const relief = plaqueRelief();
    relief.translate(0, -0.12, 0.012);
    const plaqueAll = mergeAll([plaque, relief]);
    place(plaqueAll, [-3.9 + Math.sin(0.25) * 0.18, D + 1.0, -34.9 + Math.cos(0.25) * 0.18], [0, 0.25, 0]);

    // life-jacket rack
    const rack: THREE.BufferGeometry[] = [];
    const rx = 3.3;
    const rz = -35.55;
    for (const x of [-1.05, 1.05]) rack.push(place(box(0.1, 2.0, 0.1, 0.02, 0.5), [rx + x, D + 1.0, rz]));
    rack.push(place(box(2.3, 0.1, 0.1, 0.02, 0.5), [rx, D + 1.72, rz]));
    rack.push(place(box(2.5, 0.05, 0.5, 0.015, 0.5), [rx, D + 2.03, rz + 0.08], [-0.12, 0, 0]));
    const vests: THREE.BufferGeometry[] = [];
    const tape: THREE.BufferGeometry[] = [];
    const vg = vestGeometry();
    for (let i = 0; i < 6; i++) {
      const x = rx - 0.85 + i * 0.34;
      const s = 0.92 + (i % 3) * 0.06;
      vests.push(place(vg.clone(), [x, D + 1.66, rz + 0.1], [0.05, (i - 2.5) * 0.05, 0], s));
      tape.push(place(box(0.4 * s, 0.03, 0.1, 0.01, 1), [x, D + 1.66 - 0.32 * s, rz + 0.1], [0.05, (i - 2.5) * 0.05, 0]));
      rack.push(place(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 6), [x, D + 1.7, rz + 0.06], [Math.PI / 2, 0, 0]));
    }

    // umbrella (striped canopy via vertex colours), pole and weighted base
    const ux = 0.9;
    const uz = -33.4;
    const canopy: THREE.BufferGeometry[] = [];
    const segs = 8;
    const R = 1.75;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      const g = new THREE.BufferGeometry();
      const pts: number[] = [];
      const rows = 6;
      const cols = 6;
      const P = (t: number, s: number) => {
        const a = a0 + (a1 - a0) * s;
        const rr = R * t;
        const edgeSag = Math.sin(s * Math.PI) * 0.06 * t;
        return [Math.cos(a) * (rr - edgeSag), 0.55 * (1 - t) ** 1.2 - 0.05 * t, Math.sin(a) * (rr - edgeSag)];
      };
      for (let j = 0; j < rows; j++)
        for (let k = 0; k < cols; k++) {
          const t0 = j / rows;
          const t1 = (j + 1) / rows;
          const s0 = k / cols;
          const s1 = (k + 1) / cols;
          pts.push(...P(t0, s0), ...P(t1, s0), ...P(t1, s1), ...P(t0, s0), ...P(t1, s1), ...P(t0, s1));
        }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      g.computeVertexNormals();
      tint(g, i % 2 ? '#2C7D84' : '#EFE6D2');
      canopy.push(g);
    }
    const canopyGeo = mergeAll(canopy, true);
    place(canopyGeo, [ux, D + 2.35, uz]);
    const pole = rod(new THREE.Vector3(ux, D, uz), new THREE.Vector3(ux, D + 2.95, uz), 0.03, 0.025, 10);
    const ribs: THREE.BufferGeometry[] = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      ribs.push(rod(new THREE.Vector3(ux, D + 2.86, uz), new THREE.Vector3(ux + Math.cos(a) * R * 0.98, D + 2.29, uz + Math.sin(a) * R * 0.98), 0.012, 0.01, 5));
    }
    const base = place(new THREE.CylinderGeometry(0.32, 0.36, 0.12, 24), [ux, D + 0.06, uz]);

    // bench under the umbrella
    const bench: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) bench.push(place(box(1.7, 0.05, 0.13, 0.015, 0.5), [ux - 0.2, D + 0.45, uz + 0.75 + i * 0.15]));
    for (const x of [-0.85, 0.45]) bench.push(place(box(0.08, 0.43, 0.42, 0.015, 0.5), [ux + x, D + 0.215, uz + 0.9]));

    // cooler box and water jerrycan
    const cooler = place(box(0.62, 0.42, 0.42, 0.06, 0.8, 3), [rx + 1.55, D + 0.21, rz + 0.35]);
    const coolerLid = place(box(0.64, 0.07, 0.44, 0.03, 0.8), [rx + 1.55, D + 0.44, rz + 0.35]);
    const can = place(box(0.36, 0.48, 0.18, 0.05, 0.8, 3), [rx - 1.55, D + 0.24, rz + 0.3], [0, 0.4, 0]);
    const T = tint;
    return {
      stone: mergeAll([T(stone, PAL.marker), T(plinth, '#FFFFFF')], true),
      metal: mergeAll([T(plaqueAll, PAL.brass), T(mergeAll([pole, ...ribs]), PAL.steel)], true),
      timber: mergeAll([T(mergeAll(rack), PAL.timber), T(mergeAll(bench), PAL.timber)], true),
      paint: mergeAll([T(mergeAll(vests), PAL.lifejacket), T(mergeAll(tape), PAL.white), T(cooler, PAL.white), T(coolerLid, PAL.crateBlue), T(can, PAL.crateBlue)], true),
      cloth: canopyGeo,
      base,
    };
  }, []);
  return (
    <group>
      <mesh geometry={parts.stone} material={m.stone} castShadow receiveShadow />
      <mesh geometry={parts.metal} material={m.metal} castShadow receiveShadow />
      <mesh geometry={parts.timber} material={m.timber} castShadow receiveShadow />
      <mesh geometry={parts.paint} material={m.paint} castShadow receiveShadow />
      <mesh geometry={parts.cloth} material={m.cloth} castShadow receiveShadow />
      <mesh geometry={parts.base} material={m.concrete} castShadow receiveShadow />
    </group>
  );
}

export function Dock({ m, quality, lit }: { m: HarbourMaterials; quality: Quality; lit: boolean }) {
  const d = useDockParts(quality);
  return (
    <group>
      <mesh geometry={d.timber} material={m.timber} castShadow receiveShadow />
      <mesh geometry={d.matte} material={m.matte} castShadow receiveShadow />
      <mesh geometry={d.planks} material={m.dockWood} castShadow receiveShadow />
      <mesh geometry={d.stone} material={m.stone} castShadow receiveShadow />
      <mesh geometry={d.metal} material={m.metal} castShadow receiveShadow />
      <mesh geometry={d.rope} material={m.rope} castShadow receiveShadow />
      {d.lamps.map(([x, y, z], i) => (
        <Lantern key={i} position={[x + (x > 0 ? -0.36 : 0.36), y + 1.29, z]} scale={1.25} lit={lit} light={lit && (i === 1 || i === 3)} hanging />
      ))}
      <BriefingPoint m={m} />
    </group>
  );
}
