import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { StaticBatch } from '../../core/StaticBatch';
import { Lantern, StringLights } from '../../props/Decor';
import { boxProjectUVs, roundedBox, sagCurve, smoothLathe } from '../../props/geo';
import type { Quality, Vec3 } from '../../core/types';
import { DHOW_POSE } from './layout';
import { PAL, type HarbourMaterials } from './materials';
import { MajlisSet, type MajlisSpec, type RugSpec } from './Majlis';
import { mergeAll, place, rod, tint } from './util';
import { useFloat } from './motion';
import { centrePath, circle, deckGeometry, hullBand, makeHull, roundRect, sheerPath, sweep, transomGeometry, type Hull } from './hull';

/* ------------------------------------------------------------------ */
/*  Traditional Gulf dhow (sambuk type, ≈16.6 m): lofted carvel hull   */
/*  with lime-white (chunam) bottom, raked transom and clipper stem,   */
/*  rubbing strakes, raised poop with balustrade, main + mizzen masts  */
/*  carrying furled lateen sails on their long yards, rigging, a       */
/*  guest canopy with majlis seating, and a UAE ensign.                */
/* ------------------------------------------------------------------ */

export const DHOW_HULL: Hull = makeHull({
  zStern: -8.0,
  zBow: 8.6,
  halfBeam: 2.25,
  beamAt: 0.42,
  transomFrac: 0.6,
  sheerStern: 2.7,
  sheerMid: 1.25,
  sheerBow: 2.2,
  sheerMidU: 0.56,
  keelY: -1.2,
  transomFootY: 0.15,
  transomRake: 1.1,
  runU: 0.32,
  forefootU: 0.64,
  stemRake: 0.62,
  fullness: (u) => (u < 0.45 ? THREE.MathUtils.lerp(1.7, 2.35, THREE.MathUtils.smoothstep(u, 0, 0.45)) : THREE.MathUtils.lerp(2.35, 1.15, THREE.MathUtils.smoothstep(u, 0.45, 1))),
  flare: 0.05,
});

const U_POOP = 0.22;
const INSET = 0.075;
export const mainDeckY = (u: number) => (u < 0.55 ? 0.52 + 0.25 * ((0.55 - u) / 0.55) ** 2 : 0.52 + 0.55 * ((u - 0.55) / 0.45) ** 2);
export const poopDeckY = (u: number) => 1.62 + (0.15 * (U_POOP - u)) / U_POOP;
const uOfZ = (z: number) => (z - DHOW_HULL.spec.zStern) / (DHOW_HULL.spec.zBow - DHOW_HULL.spec.zStern);

/** Half-breadth of the inner bulwark at a given hull station and height. */
function innerHalf(u: number, y: number) {
  const v = DHOW_HULL.vAtY(u, y);
  return DHOW_HULL.point(u, v).x - INSET;
}

function orientBetween(g: THREE.BufferGeometry, a: THREE.Vector3, b: THREE.Vector3) {
  // geometry built along +y from 0..len → place between a and b
  const dir = b.clone().sub(a);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return g;
}

function spar(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, radial = 14) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, len, radial, 6, false);
  g.translate(0, len / 2, 0);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.6, uv.getY(i) * len * 0.35);
  return orientBetween(g, a, b);
}

/** Lateen yard: two spars fished together, swelling in the middle. */
function yardGeometry(a: THREE.Vector3, b: THREE.Vector3, rMax: number) {
  const len = a.distanceTo(b);
  const prof: [number, number][] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    prof.push([0.25 * rMax + 0.75 * rMax * Math.sin(Math.PI * t) ** 0.6, t * len]);
  }
  const g = smoothLathe(prof, 14, 48).clone();
  return orientBetween(g, a, b);
}

/** Sail furled along a yard: lumpy canvas bundle hanging under it, with lashings. */
function furledSail(a: THREE.Vector3, b: THREE.Vector3, rMax: number, hang: THREE.Vector3, seed: number) {
  const len = a.distanceTo(b);
  const dir = b.clone().sub(a).normalize();
  const side = new THREE.Vector3().crossVectors(dir, hang).normalize();
  const down = new THREE.Vector3().crossVectors(side, dir).normalize();
  const along = 72;
  const around = 14;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const lashEvery = 0.78;
  const lashings: number[] = [];
  for (let i = 0; i <= along; i++) {
    const t = 0.04 + 0.9 * (i / along);
    const s = t * len;
    const env = Math.sin(Math.PI * ((t - 0.04) / 0.9)) ** 0.75;
    const ph = (s / lashEvery) % 1;
    const pinch = 0.8 + 0.2 * Math.sin(Math.PI * ph) ** 0.5;
    const r = (0.035 + rMax * env) * pinch;
    const centre = a.clone().addScaledVector(dir, s).addScaledVector(down, r * 0.85 + 0.06);
    for (let j = 0; j <= around; j++) {
      const ang = (j / around) * Math.PI * 2;
      const fold = 1 + 0.1 * Math.sin(ang * 3 + s * 1.7 + seed) + 0.06 * Math.sin(ang * 7 - s * 3.1);
      const cx = Math.cos(ang) * r * fold;
      const cy = Math.sin(ang) * r * fold * 1.12;
      pos.push(centre.x + side.x * cx + down.x * cy, centre.y + side.y * cx + down.y * cy, centre.z + side.z * cx + down.z * cy);
      uv.push(j / around, s * 0.8);
    }
  }
  for (let s = lashEvery; s < len * 0.94; s += lashEvery) if (s > len * 0.05) lashings.push(s);
  const R = around + 1;
  for (let i = 0; i < along; i++)
    for (let j = 0; j < around; j++) {
      const p = i * R + j;
      idx.push(p, p + R, p + 1, p + R, p + R + 1, p + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // lashing rings
  const rings = lashings.map((s) => {
    const t = s / len;
    const env = Math.sin(Math.PI * ((t - 0.04) / 0.9)) ** 0.75;
    const r = 0.035 + rMax * env;
    const ring = new THREE.TorusGeometry(r * 0.62 + 0.06, 0.016, 5, 18);
    ring.scale(1, 1.25, 1);
    const centre = a.clone().addScaledVector(dir, s).addScaledVector(down, r * 0.5);
    const m = new THREE.Matrix4().makeBasis(side, down, dir);
    ring.applyMatrix4(m);
    ring.translate(centre.x, centre.y, centre.z);
    return ring;
  });
  return { sail: g, lashings: mergeGeometries(rings, false) };
}

function rope(a: Vec3 | THREE.Vector3, b: Vec3 | THREE.Vector3, sag = 0.05, r = 0.014, segs = 14) {
  const A = Array.isArray(a) ? new THREE.Vector3(...a) : a;
  const B = Array.isArray(b) ? new THREE.Vector3(...b) : b;
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sagCurve(A, B, sag, segs)), segs * 2, r, 5, false);
}

function deadwoodGeometry(h: Hull) {
  const s = new THREE.Shape();
  const sp = h.spec;
  const foot = h.centre(0);
  const zAft = foot.x + 0.22;
  s.moveTo(zAft, sp.keelY - 0.24);
  const ff = h.centre(sp.forefootU - 0.04);
  s.lineTo(ff.x, sp.keelY - 0.24);
  // outer edge of the stem (offset forward/down from the rabbet)
  const N = 26;
  for (let i = 0; i <= N; i++) {
    const u = sp.forefootU - 0.04 + (1 - (sp.forefootU - 0.04)) * (i / N);
    const c = h.centre(u);
    const c2 = h.centre(Math.min(1, u + 0.01));
    const c1 = h.centre(Math.max(0, u - 0.01));
    const tz = c2.x - c1.x;
    const ty = c2.y - c1.y;
    const l = Math.hypot(tz, ty) || 1;
    // outward normal of the profile (forward / down)
    const nzv = ty / l;
    const ny = -tz / l;
    s.lineTo(c.x + nzv * 0.13, c.y + ny * 0.13);
  }
  // stem head post rising above the sheer
  const head = h.centre(1);
  const pre = h.centre(0.985);
  const tz = head.x - pre.x;
  const ty = head.y - pre.y;
  const l = Math.hypot(tz, ty);
  s.lineTo(head.x + (tz / l) * 0.6 + 0.08, head.y + (ty / l) * 0.6);
  s.lineTo(head.x + (tz / l) * 0.6 - 0.06, head.y + (ty / l) * 0.6 + 0.02);
  for (let i = N; i >= 0; i--) {
    const u = (i / N) * 0.999;
    const c = h.centre(u);
    s.lineTo(c.x, c.y + 0.04);
  }
  s.lineTo(zAft, foot.y + 0.02);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -0.09);
  // shape is in (z, y) → rotate so shape-x becomes boat z
  g.rotateY(-Math.PI / 2);
  boxProjectUVs(g, 0.6);
  return g;
}

function rudderGeometry(h: Hull) {
  const foot = h.centre(0);
  const s = new THREE.Shape();
  const z0 = foot.x + 0.12;
  s.moveTo(z0, h.spec.keelY - 0.2);
  s.lineTo(z0 - 0.95, h.spec.keelY - 0.05);
  s.lineTo(z0 - 1.12, foot.y + 0.35);
  s.lineTo(z0 - 0.2, foot.y + 0.45);
  s.lineTo(z0, foot.y + 0.1);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
  g.translate(0, 0, -0.07);
  g.rotateY(-Math.PI / 2);
  boxProjectUVs(g, 0.6);
  return g;
}

/** UAE ensign (CanvasTexture — no text). */
function flagTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#00843D';
  g.fillRect(0, 0, 128, 22);
  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 21, 128, 22);
  g.fillStyle = '#111111';
  g.fillRect(0, 42, 128, 22);
  g.fillStyle = '#C8102E';
  g.fillRect(0, 0, 32, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function Flag({ position, rotation = 0, size = [1.2, 0.6] }: { position: Vec3; rotation?: number; size?: [number, number] }) {
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: flagTexture(), side: THREE.DoubleSide, roughness: 0.8 });
    const time = { value: 0 };
    m.userData.time = time;
    m.onBeforeCompile = (s) => {
      s.uniforms.uFT = time;
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uFT;').replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float fx = uv.x;
         transformed.z += sin(fx * 7.0 - uFT * 6.0) * 0.09 * fx + sin(fx * 13.0 - uFT * 9.0 + uv.y * 2.0) * 0.025 * fx;
         transformed.y -= fx * fx * 0.06;`,
      );
    };
    m.customProgramCacheKey = () => 'hb-flag';
    return m;
  }, []);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(size[0], size[1], 16, 4);
    g.translate(size[0] / 2, -size[1] / 2, 0);
    return g;
  }, [size]);
  useFrame(({ clock }) => {
    (mat.userData.time as { value: number }).value = clock.elapsedTime;
  });
  return <mesh geometry={geo} material={mat} position={position} rotation={[0, rotation, 0]} castShadow userData={{ noBatch: true }} />;
}

function useDhowParts(quality: Quality) {
  return useMemo(() => {
    const h = DHOW_HULL;
    const hi = quality !== 'low';
    const st = hi ? 120 : 70;
    const wl0 = (u: number) => h.vAtY(u, -0.07);
    const wl1 = (u: number) => h.vAtY(u, 0.11);
    const bottom = hullBand(h, { stations: st, rows: hi ? 12 : 7, v0: () => 0, v1: wl0, planks: 16 });
    const boot = hullBand(h, { stations: st, rows: 2, v0: wl0, v1: wl1, planks: 16 });
    const topsides = hullBand(h, { stations: st, rows: hi ? 16 : 9, v0: wl1, v1: () => 1, planks: 16 });

    // deck extents
    let uEnd = 0.95;
    for (let u = 0.97; u > 0.6; u -= 0.005) {
      if (innerHalf(u, mainDeckY(u)) > 0.14) {
        uEnd = u;
        break;
      }
    }
    const deckMain = deckGeometry(h, U_POOP, uEnd, mainDeckY, INSET, 56, 0.05);
    const deckPoop = deckGeometry(h, 0.008, U_POOP, poopDeckY, INSET, 16, 0.03);
    const innerMain = hullBand(h, { stations: 70, rows: 4, u0: U_POOP - 0.004, u1: Math.min(0.995, uEnd + 0.02), v0: (u) => h.vAtY(u, mainDeckY(u) - 0.02), v1: () => 1, inset: INSET, planks: 16 });
    const innerPoop = hullBand(h, { stations: 18, rows: 3, u0: 0.0, u1: U_POOP + 0.004, v0: (u) => h.vAtY(u, poopDeckY(u) - 0.02), v1: () => 1, inset: INSET, planks: 16 });
    const transom = transomGeometry(h, 18, 0.2);
    const transomIn = transom.clone();
    transomIn.translate(0, 0, 0.06);
    transomIn.setIndex(Array.from(transomIn.index!.array).reverse());
    transomIn.computeVertexNormals();

    // poop break bulkhead (main deck → poop deck)
    const zBreak = THREE.MathUtils.lerp(h.spec.zStern, h.spec.zBow, U_POOP);
    const yMain = mainDeckY(U_POOP);
    const yPoop = poopDeckY(U_POOP);
    const wBreak = innerHalf(U_POOP, yPoop) * 2;
    const breakGeo = boxProjectUVs(roundedBox(wBreak, yPoop - yMain + 0.06, 0.12, 0.02, 2).clone(), 0.6);
    breakGeo.translate(0, (yPoop + yMain) / 2 - 0.02, zBreak);

    // cap rails & wales
    const caps: THREE.BufferGeometry[] = [];
    const wales: THREE.BufferGeometry[] = [];
    for (const side of [1, -1]) {
      const cp = sheerPath(h, side, 0, INSET / 2 - 0.005, 0.0, 0.997, 110).map((p) => p.add(new THREE.Vector3(0, 0.03, 0)));
      caps.push(sweep(cp, roundRect(0.17, 0.085, 0.03, 2), new THREE.Vector3(0, 1, 0), 1.5));
      for (const drop of [0.3, 0.64]) {
        const wp = sheerPath(h, side, drop, -0.03, 0.01, 0.975, 100);
        wales.push(sweep(wp, circle(0.055, 8).map(([x, y]) => [x * 0.7, y] as [number, number]), new THREE.Vector3(0, 1, 0), 1.5));
      }
    }
    // transom cap
    const tTop = h.point(0, 1);
    const tCap: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++) {
      const s = (i / 20) * 2 - 1;
      tCap.push(new THREE.Vector3(tTop.x * s, tTop.y + 0.2 * (1 - s * s) + 0.04, tTop.z - 0.01));
    }
    caps.push(sweep(tCap, roundRect(0.12, 0.1, 0.03, 2), new THREE.Vector3(0, 0, -1), 1.5));
    // transom carving: frame moulding
    const frame: THREE.Vector3[] = [];
    for (let i = 0; i <= 28; i++) {
      const v = 0.25 + 0.7 * (i / 28);
      const p = h.point(0, v);
      frame.push(new THREE.Vector3(p.x * 0.82, p.y, p.z - 0.04));
    }
    const frameL = frame.map((p) => p.clone().setX(-p.x)).reverse();
    const fTopY = tTop.y - 0.06;
    const framePts = [...frameL, new THREE.Vector3(0, fTopY + 0.1, tTop.z - 0.04), ...frame];
    const moulding = sweep(framePts, circle(0.035, 6), new THREE.Vector3(0, 0, -1), 1);

    const deadwood = deadwoodGeometry(h);
    const rudder = rudderGeometry(h);
    const foot = h.centre(0);
    const rudderStock = spar(new THREE.Vector3(0, foot.y + 0.3, foot.x - 0.75), new THREE.Vector3(0, tTop.y + 0.55, tTop.z - 0.32), 0.08, 0.07, 10);

    // masts and yards
    const mainBase = new THREE.Vector3(0, mainDeckY(uOfZ(1.2)), 1.2);
    const rakeM = THREE.MathUtils.degToRad(6);
    const mainTop = mainBase.clone().add(new THREE.Vector3(0, Math.cos(rakeM), Math.sin(rakeM)).multiplyScalar(13));
    const mast = spar(mainBase.clone().add(new THREE.Vector3(0, -0.4, 0)), mainTop, 0.17, 0.095, 16);
    const mastHead = boxProjectUVs(roundedBox(0.3, 0.55, 0.36, 0.05, 2).clone(), 0.6);
    mastHead.translate(mainTop.x, mainTop.y - 0.55, mainTop.z);

    const yardAng = THREE.MathUtils.degToRad(46);
    const yd = new THREE.Vector3(0, Math.sin(yardAng), -Math.cos(yardAng));
    const yS = new THREE.Vector3(-0.3, mainTop.y - 1.25, mainBase.z + Math.tan(rakeM) * (mainTop.y - 1.25 - mainBase.y) + 0.24);
    const yF = yS.clone().addScaledVector(yd, -10.6);
    const yA = yS.clone().addScaledVector(yd, 7.4);
    const yard = yardGeometry(yF, yA, 0.15);
    const hang = new THREE.Vector3(0, -Math.cos(yardAng), -Math.sin(yardAng));
    const mainSail = furledSail(yF, yA, 0.3, hang, 1);

    const mizBase = new THREE.Vector3(0, poopDeckY(uOfZ(-5.0)), -5.0);
    const rakeZ = THREE.MathUtils.degToRad(4);
    const mizTop = mizBase.clone().add(new THREE.Vector3(0, Math.cos(rakeZ), Math.sin(rakeZ)).multiplyScalar(7.6));
    const mizzen = spar(mizBase.clone().add(new THREE.Vector3(0, -0.3, 0)), mizTop, 0.11, 0.065, 12);
    const mAng = THREE.MathUtils.degToRad(50);
    const md = new THREE.Vector3(0, Math.sin(mAng), -Math.cos(mAng));
    const mS = new THREE.Vector3(-0.22, mizTop.y - 0.8, mizBase.z + Math.tan(rakeZ) * (mizTop.y - 0.8 - mizBase.y) + 0.17);
    const mF = mS.clone().addScaledVector(md, -5.2);
    const mA = mS.clone().addScaledVector(md, 3.8);
    const mYard = yardGeometry(mF, mA, 0.09);
    const mHang = new THREE.Vector3(0, -Math.cos(mAng), -Math.sin(mAng));
    const mizSail = furledSail(mF, mA, 0.19, mHang, 4);

    // rigging
    const lines: THREE.BufferGeometry[] = [];
    const rail = (z: number, side: number) => {
      const u = uOfZ(z);
      const s = h.sheer(u);
      return new THREE.Vector3((s.x - 0.02) * side, s.y + 0.06, z);
    };
    const mh = mainTop.clone().add(new THREE.Vector3(0, -0.35, 0));
    for (const side of [1, -1]) {
      for (const z of [-0.1, -0.95, -1.8]) lines.push(rope(mh, rail(z, side), 0.02, 0.016));
      lines.push(rope(mizTop.clone().add(new THREE.Vector3(0, -0.2, 0)), rail(-6.1, side), 0.02, 0.013));
    }
    const stemHead = new THREE.Vector3(0, h.spec.sheerBow + 0.55, h.spec.zBow + 0.35);
    lines.push(rope(mh, stemHead, 0.06, 0.016)); // forestay
    lines.push(rope(yF.clone().addScaledVector(yd, 0.3), stemHead.clone().add(new THREE.Vector3(0, -0.2, -0.2)), 0.12, 0.018)); // tack
    lines.push(rope(yA.clone().addScaledVector(yd, -0.4), rail(-7.6, -1), 0.3, 0.012)); // brace
    lines.push(rope(mainTop, yS, 0.01, 0.03)); // halyard
    lines.push(rope(mainTop.clone().add(new THREE.Vector3(0, -0.2, -0.1)), new THREE.Vector3(0.75, poopDeckY(uOfZ(-3.9)) + 0.1, -3.95), 0.04, 0.02)); // halyard tackle
    lines.push(rope(mizTop, mS, 0.01, 0.022));
    lines.push(rope(mA.clone().addScaledVector(md, -0.3), new THREE.Vector3(-0.3, tTop.y + 0.3, tTop.z + 0.1), 0.12, 0.011));
    const rigging = mergeGeometries(lines, false);

    // balustrade on the poop (sides + across the transom)
    const posts: THREE.BufferGeometry[] = [];
    const baluster = smoothLathe(
      [
        [0.001, 0],
        [0.035, 0],
        [0.03, 0.06],
        [0.022, 0.12],
        [0.04, 0.25],
        [0.022, 0.38],
        [0.03, 0.45],
        [0.035, 0.5],
        [0.001, 0.5],
      ],
      8,
      14,
    );
    const railTops: THREE.Vector3[][] = [[], []];
    const postH = 0.62;
    for (const [k, side] of [
      [0, 1],
      [1, -1],
    ] as const) {
      for (let u = 0.015; u <= U_POOP + 0.001; u += 0.026) {
        const s = h.sheer(u);
        const x = (s.x - INSET / 2) * side;
        const g = baluster.clone();
        g.scale(1, postH / 0.5, 1);
        g.translate(x, s.y + 0.07, s.z);
        posts.push(g);
        railTops[k].push(new THREE.Vector3(x, s.y + 0.07 + postH, s.z));
      }
    }
    const sternRail: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const s = (i / 8) * 2 - 1;
      const x = tTop.x * 0.92 * s;
      const y = tTop.y + 0.2 * (1 - s * s) + 0.08;
      const g = baluster.clone();
      g.scale(1, (postH - 0.1) / 0.5, 1);
      g.translate(x, y, tTop.z + 0.04);
      posts.push(g);
      sternRail.push(new THREE.Vector3(x, y + postH - 0.1, tTop.z + 0.04));
    }
    const railGeo = mergeGeometries(
      [
        sweep(railTops[0], roundRect(0.1, 0.06, 0.02, 2), new THREE.Vector3(0, 1, 0), 1.2),
        sweep(railTops[1], roundRect(0.1, 0.06, 0.02, 2), new THREE.Vector3(0, 1, 0), 1.2),
        sweep(sternRail, roundRect(0.1, 0.06, 0.02, 2), new THREE.Vector3(0, 0, -1), 1.2),
      ],
      false,
    );
    const balusters = mergeGeometries(posts.map((p) => (p.index ? p.toNonIndexed() : p)), false);

    // canopy over the guest deck (aft main deck)
    const cz0 = -3.75;
    const cz1 = -0.35;
    const cx = 1.72;
    const cTop = 2.95;
    const canopy = new THREE.PlaneGeometry(cx * 2 + 0.3, cz1 - cz0 + 0.3, 20, 12);
    canopy.rotateX(-Math.PI / 2);
    {
      const p = canopy.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) / (cx + 0.15);
        const z = p.getZ(i) / ((cz1 - cz0) / 2 + 0.15);
        p.setY(i, -0.12 * (1 - x * x) * (1 - z * z) + 0.06 * (1 - x * x));
      }
      canopy.translate(0, cTop, (cz0 + cz1) / 2);
      canopy.computeVertexNormals();
    }
    const valance: THREE.BufferGeometry[] = [];
    for (const side of [1, -1]) {
      const v = new THREE.PlaneGeometry(cz1 - cz0 + 0.3, 0.26, 24, 2);
      const p = v.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const xx = p.getX(i);
        const yy = p.getY(i);
        if (yy < 0) p.setY(i, yy + Math.abs(Math.sin(xx * Math.PI * 2.2)) * 0.08);
      }
      v.rotateY(Math.PI / 2);
      v.translate(side * (cx + 0.15), cTop - 0.08, (cz0 + cz1) / 2);
      valance.push(v);
    }
    const canopyGeo = mergeGeometries([canopy, ...valance], false);
    const poles: THREE.BufferGeometry[] = [];
    for (const z of [cz0, (cz0 + cz1) / 2, cz1])
      for (const side of [1, -1]) poles.push(spar(new THREE.Vector3(side * cx, mainDeckY(uOfZ(z)), z), new THREE.Vector3(side * cx, cTop, z), 0.035, 0.03, 8));
    const polesGeo = mergeGeometries(poles, false);

    // deck furniture
    const hatch = boxProjectUVs(roundedBox(1.5, 0.32, 1.3, 0.04, 2).clone(), 0.7);
    hatch.translate(0, mainDeckY(uOfZ(3.6)) + 0.16, 3.6);
    const hatchLid = boxProjectUVs(roundedBox(1.62, 0.07, 1.42, 0.025, 2).clone(), 0.7);
    hatchLid.translate(0, mainDeckY(uOfZ(3.6)) + 0.35, 3.6);
    const bitts: THREE.BufferGeometry[] = [];
    const bittGeo = (x: number, z: number, y: number, hgt = 0.62) => {
      const g = boxProjectUVs(roundedBox(0.18, hgt, 0.18, 0.03, 2).clone(), 0.7);
      g.translate(x, y + hgt / 2, z);
      bitts.push(g);
    };
    bittGeo(0.32, 6.9, mainDeckY(uOfZ(6.9)));
    bittGeo(-0.32, 6.9, mainDeckY(uOfZ(6.9)));
    const winch = new THREE.CylinderGeometry(0.17, 0.17, 1.1, 18);
    winch.rotateZ(Math.PI / 2);
    winch.translate(0, mainDeckY(uOfZ(6.0)) + 0.32, 6.0);
    bitts.push(winch);
    bittGeo(0.55, 5.95, mainDeckY(uOfZ(5.95)), 0.5);
    bittGeo(-0.55, 5.95, mainDeckY(uOfZ(5.95)), 0.5);
    for (const side of [1, -1]) bittGeo(side * 1.05, -7.1, poopDeckY(uOfZ(-7.1)), 0.5);
    const ladder: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const g = boxProjectUVs(roundedBox(0.9, 0.05, 0.24, 0.015, 2).clone(), 0.7);
      g.translate(0, yMain + 0.22 + i * 0.24, zBreak + 0.75 - i * 0.2);
      ladder.push(g);
    }
    for (const sx of [-0.47, 0.47]) ladder.push(spar(new THREE.Vector3(sx, yMain, zBreak + 0.95), new THREE.Vector3(sx, yPoop + 0.05, zBreak + 0.05), 0.03, 0.03, 6));
    const furniture = mergeGeometries([...bitts, ...ladder, hatch].map((g) => (g.index ? g.toNonIndexed() : g)), false);

    // coiled ropes on deck
    const coil = (x: number, z: number, y: number, r = 0.32, turns = 5) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= turns * 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const rr = r - (i / (turns * 24)) * r * 0.55;
        pts.push(new THREE.Vector3(x + Math.cos(a) * rr, y + 0.025 + (i % 24 < 12 ? 0 : 0.012) + Math.floor(i / 24) * 0.004, z + Math.sin(a) * rr));
      }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 40, 0.024, 5, false);
    };
    const coils = mergeGeometries([coil(0.6, 4.9, mainDeckY(uOfZ(4.9))), coil(-0.7, 0.2, mainDeckY(uOfZ(0.2)), 0.28, 4), coil(-0.9, -6.4, poopDeckY(uOfZ(-6.4)), 0.25, 4)], false);

    // fenders hanging on the jetty (starboard) side
    const fenders: THREE.BufferGeometry[] = [];
    for (const z of [-4.5, -0.5, 3.5]) {
      const u = uOfZ(z);
      const s = h.sheer(u);
      const v = h.vAtY(u, 0.55);
      const p = h.point(u, v);
      const f = new THREE.CapsuleGeometry(0.13, 0.45, 4, 10);
      f.translate(-(p.x + 0.12), 0.55, z);
      fenders.push(f);
      lines.push(rope(new THREE.Vector3(-s.x, s.y + 0.05, z), new THREE.Vector3(-(p.x + 0.12), 0.85, z), 0.02, 0.012));
    }
    const fenderGeo = mergeGeometries(fenders, false);
    const fenderLines = mergeGeometries(lines.slice(-3), false);

    // lifebuoys (orange with white bands) on the poop rail
    const buoys: THREE.BufferGeometry[] = [];
    for (const side of [1, -1]) {
      const by = poopDeckY(0.1) + 0.45;
      buoys.push(tint(place(new THREE.TorusGeometry(0.3, 0.075, 10, 28), [side * 1.62, by, -6.3], [0, Math.PI / 2, 0]), PAL.orange));
      for (let k = 0; k < 4; k++) buoys.push(tint(place(new THREE.TorusGeometry(0.3, 0.079, 10, 4, 0.32), [side * 1.62, by, -6.3], [(k / 4) * Math.PI * 2 + 0.6, Math.PI / 2, 0], 1), PAL.white));
    }
    const staff = rod(new THREE.Vector3(0, tTop.y + 0.1, tTop.z - 0.05), new THREE.Vector3(0, tTop.y + 2.15, tTop.z - 0.8), 0.035, 0.025, 8);

    const T = (g: THREE.BufferGeometry, c: string) => tint(g, c);
    return {
      wood: mergeAll(
        [
          T(topsides, PAL.teak),
          T(innerMain, PAL.teakDark),
          T(innerPoop, PAL.teakDark),
          T(transom, PAL.teak),
          T(transomIn, PAL.teakDark),
          T(breakGeo, PAL.teakDark),
          T(mergeGeometries(wales, false), PAL.teakDark),
          T(rudderStock, PAL.teakDark),
          T(mast, PAL.spar),
          T(mastHead, PAL.teakDark),
          T(yard, PAL.spar),
          T(mizzen, PAL.spar),
          T(mYard, PAL.spar),
          T(balusters, PAL.teakDark),
          T(polesGeo, PAL.teakDark),
          T(furniture, PAL.teakDark),
          T(staff, PAL.teakDark),
          T(deadwood, PAL.teakDark),
          T(moulding, PAL.teakDark),
          T(rudder, PAL.teakDark),
        ],
        true,
      ),
      matte: mergeAll([T(bottom, PAL.chunam), T(boot, PAL.bootTop)], true),
      paint: mergeAll([T(mergeGeometries(caps, false), PAL.dhowTeal), T(railGeo, PAL.dhowTeal), T(hatchLid, PAL.dhowTeal), ...buoys], true),
      cloth: mergeAll([T(mainSail.sail, PAL.sail), T(mizSail.sail, PAL.sail), T(canopyGeo, PAL.canvas)], true),
      rope: mergeAll([T(mainSail.lashings, PAL.rope), T(mizSail.lashings, PAL.rope), T(rigging, PAL.rope), T(coils, PAL.rope), T(fenderGeo, PAL.rope), T(fenderLines, PAL.rope)], true),
      deck: mergeAll([T(deckMain, '#FFFFFF'), T(deckPoop, '#FFFFFF')], true),
      mainTop,
      mizTop,
      tTop,
      seatY: mainDeckY(uOfZ(-2.05)),
    };
  }, [quality]);
}

export function Dhow({ m, quality, lit, boatRef }: { m: HarbourMaterials; quality: Quality; lit: boolean; boatRef?: MutableRefObject<THREE.Group | null> }) {
  const own = useRef<THREE.Group>(null);
  const ref = boatRef ?? own;
  useFloat(ref as MutableRefObject<THREE.Object3D | null>, DHOW_POSE, { halfL: 6.8, halfB: 2.0, tau: 0.9, rollGain: 1.8, pitchGain: 1.2, sink: 0.02, seed: 1.3, drift: 0.008 });
  const d = useDhowParts(quality);
  const seats = useMemo<MajlisSpec[]>(
    () => [
      { position: [1.42, d.seatY, -2.05], length: 2.9, rotation: -Math.PI / 2, colorIndex: 0 },
      { position: [-1.42, d.seatY, -2.05], length: 2.9, rotation: Math.PI / 2, colorIndex: 2 },
    ],
    [d.seatY],
  );
  const rugs = useMemo<RugSpec[]>(() => [{ position: [0, d.seatY + 0.012, -2.05], size: [1.5, 2.6] }], [d.seatY]);
  return (
    <group ref={ref} position={[DHOW_POSE.x, 0, DHOW_POSE.z]} rotation={[0, DHOW_POSE.yaw, 0]} userData={{ noBatch: true }}>
      <StaticBatch deps={[quality, lit]}>
        <mesh geometry={d.wood} material={m.wood} castShadow receiveShadow />
        <mesh geometry={d.matte} material={m.matte} castShadow receiveShadow />
        <mesh geometry={d.paint} material={m.paint} castShadow receiveShadow />
        <mesh geometry={d.cloth} material={m.cloth} castShadow receiveShadow />
        <mesh geometry={d.rope} material={m.rope} castShadow receiveShadow />
        <mesh geometry={d.deck} material={m.dockWood} castShadow receiveShadow />
        <MajlisSet m={m} seats={seats} rugs={rugs} />
        <Lantern position={[0, d.mainTop.y - 3.2, d.mainTop.z + 0.12]} scale={0.9} lit={lit} light={lit} hanging />
        <Lantern position={[0.0, d.tTop.y + 0.75, d.tTop.z + 0.2]} scale={0.8} lit={lit} />
        {lit && (
          <StringLights
            lit
            sag={0.15}
            bulbs={7}
            points={[
              [1.86, 2.85, -3.85],
              [1.86, 2.85, -0.25],
              [-1.86, 2.85, -0.25],
              [-1.86, 2.85, -3.85],
            ]}
          />
        )}
      </StaticBatch>
      <Flag position={[0, d.tTop.y + 2.0, d.tTop.z - 0.75]} rotation={Math.PI / 2} />
    </group>
  );
}
