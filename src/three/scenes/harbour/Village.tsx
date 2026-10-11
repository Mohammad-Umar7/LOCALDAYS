import { useMemo } from 'react';
import * as THREE from 'three';
import type { Quality } from '../../core/types';
import { groundHeight, rng, shoreZ } from './layout';
import type { HarbourMaterials } from './materials';
import { mergeAll, place, tint } from './util';

/* ------------------------------------------------------------------ */
/*  The town along the far shore of the bay: low whitewashed houses   */
/*  with parapets, a mosque with dome and minaret, and palm groves —  */
/*  hazed by distance, built from a few hundred triangles.            */
/* ------------------------------------------------------------------ */

const HOUSE = ['#E9E1D2', '#E2D6C0', '#EDE8DE', '#DCCDB2', '#E6DDCC', '#D3C3A6', '#CFC6B8'];

function farPalm(x: number, y: number, z: number, h: number, r: () => number, trunks: THREE.BufferGeometry[], crowns: THREE.BufferGeometry[]) {
  const lean = (r() - 0.5) * 0.25;
  const t = new THREE.CylinderGeometry(0.16, 0.24, h, 5, 1);
  t.translate(0, h / 2, 0);
  t.rotateZ(lean);
  t.translate(x, y, z);
  trunks.push(tint(t, '#7A6650'));
  const top = new THREE.Vector3(x - Math.sin(lean) * h, y + h * Math.cos(lean), z);
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + r();
    const len = 2.2 + r() * 0.8;
    const g = new THREE.BufferGeometry();
    const tip = new THREE.Vector3(Math.cos(a) * len, -0.9 - r() * 0.5, Math.sin(a) * len);
    const side = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(0.35);
    const mid = tip.clone().multiplyScalar(0.5).add(new THREE.Vector3(0, 0.55, 0));
    const v = [new THREE.Vector3(0, 0.1, 0), mid.clone().add(side), tip, new THREE.Vector3(0, 0.1, 0), tip, mid.clone().sub(side)];
    g.setAttribute('position', new THREE.Float32BufferAttribute(v.flatMap((p) => [p.x + top.x, p.y + top.y, p.z + top.z]), 3));
    g.computeVertexNormals();
    crowns.push(tint(g, r() > 0.3 ? '#5F7A45' : '#7D8B52'));
  }
}

/** Flat-roofed house: walls, parapet, windows/doors on every facade, optional upper room. */
function house(out: THREE.BufferGeometry[], x: number, y: number, z: number, w: number, d: number, h: number, yaw: number, c: string, r: () => number) {
  const add = (g: THREE.BufferGeometry, col: string) => out.push(tint(place(g, [x, y, z], [0, yaw, 0]), col));
  const body = new THREE.BoxGeometry(w, h, d);
  body.translate(0, h / 2, 0);
  add(body, c);
  const par = new THREE.BoxGeometry(w + 0.25, 0.55, d + 0.25);
  par.translate(0, h + 0.27, 0);
  add(par, c);
  const facades: [number, number, number][] = [
    [0, -d / 2, w],
    [0, d / 2, w],
    [-w / 2, 0, d],
    [w / 2, 0, d],
  ];
  facades.forEach(([fx, fz, len], fi) => {
    const n = Math.max(1, Math.floor(len / 3.2));
    for (let k = 0; k < n; k++) {
      const t = -len / 2 + (k + 0.5) * (len / n);
      const isDoor = fi === 0 && k === Math.floor(n / 2);
      const wh = isDoor ? 2.1 : 1.15;
      const wy = isDoor ? 1.05 : Math.min(h * 0.58, h - 1);
      const g = fi < 2 ? new THREE.BoxGeometry(isDoor ? 1.1 : 0.85, wh, 0.12) : new THREE.BoxGeometry(0.12, wh, 0.85);
      g.translate(fi < 2 ? t : fx + Math.sign(fx) * 0.02, wy, fi < 2 ? fz + Math.sign(fz) * 0.02 : t);
      add(g, isDoor ? '#6A4A2E' : '#3B4046');
    }
  });
  if (r() > 0.5) {
    const uw = w * (0.35 + r() * 0.2);
    const ud = d * (0.4 + r() * 0.2);
    const up = new THREE.BoxGeometry(uw, 2.6, ud);
    up.translate(w * 0.2, h + 1.3, -d * 0.12);
    add(up, c);
  }
}

function shrub(sc: number, seed: number) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 5.1 + seed) * Math.sin(v.z * 4.3 + seed * 1.7) * 0.22 + Math.sin(v.y * 9 + v.x * 7 + seed) * 0.12;
    v.multiplyScalar(1 + n);
    v.y = Math.max(-0.15, v.y) * 0.55;
    p.setXYZ(i, v.x * sc * 1.25, v.y * sc, v.z * sc * 1.25);
  }
  g.computeVertexNormals();
  return g;
}

export function Village({ m, quality }: { m: HarbourMaterials; quality: Quality }) {
  const geo = useMemo(() => {
    const r = rng(101);
    const houses: THREE.BufferGeometry[] = [];
    const trunks: THREE.BufferGeometry[] = [];
    const crowns: THREE.BufferGeometry[] = [];
    const step = quality === 'low' ? 15 : 9.5;
    for (let x = -112; x > -380; x -= step * (0.7 + r() * 0.6)) {
      const rows = 1 + Math.floor(r() * 3);
      for (let k = 0; k < rows; k++) {
        const z = shoreZ(x) + 16 + k * 13 + r() * 6;
        const w = 6 + r() * 8;
        const d = 6 + r() * 7;
        const h = 3.8 + r() * 4.2;
        const y = groundHeight(x, z) - 0.3;
        const yaw = (r() - 0.5) * 0.3;
        const c = HOUSE[Math.floor(r() * HOUSE.length)];
        house(houses, x, y, z, w, d, h, yaw, c, r);
        if (r() > 0.5) farPalm(x + w * 0.7 + 2, groundHeight(x + w * 0.7 + 2, z - 4), z - 4, 7 + r() * 4, r, trunks, crowns);
      }
      if (r() > 0.45) farPalm(x + r() * 6, groundHeight(x, shoreZ(x) + 7), shoreZ(x) + 7 + r() * 4, 7 + r() * 5, r, trunks, crowns);
    }
    // mosque with dome and minaret
    const mx = -205;
    const mz = shoreZ(-205) + 26;
    const my = groundHeight(mx, mz) - 0.3;
    houses.push(tint(place(new THREE.BoxGeometry(16, 8, 16), [mx, my + 4, mz]), '#F2EEE6'));
    houses.push(tint(place(new THREE.SphereGeometry(5.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), [mx, my + 8, mz]), '#E7DFC9'));
    houses.push(tint(place(new THREE.CylinderGeometry(1.1, 1.3, 26, 12), [mx + 10, my + 13, mz + 6]), '#F2EEE6'));
    houses.push(tint(place(new THREE.CylinderGeometry(1.6, 1.6, 0.8, 12), [mx + 10, my + 21, mz + 6]), '#E2D8C4'));
    houses.push(tint(place(new THREE.ConeGeometry(1.0, 3.2, 12), [mx + 10, my + 27.6, mz + 6]), '#C9B98F'));
    // inland edge of Hamriyah behind the harbour yard: courtyard houses, a barjeel, palm groves, scrub
    const shrubs: THREE.BufferGeometry[] = [];
    const inland: [number, number][] = [];
    for (let k = 0; k < (quality === 'low' ? 10 : 18); k++) inland.push([-70 + r() * 120, 42 + r() * 70]);
    inland.forEach(([hx, hz]) => {
      const w = 7 + r() * 9;
      const d = 7 + r() * 8;
      const h = 3.6 + r() * 3.4;
      const y = groundHeight(hx, hz) - 0.4;
      const yaw = (r() - 0.5) * 0.2;
      const c = HOUSE[Math.floor(r() * HOUSE.length)];
      house(houses, hx, y, hz, w, d, h, yaw, c, r);
      // courtyard wall
      const cw = w + 6;
      const cd = d + 5;
      for (const [ox, oz, sx, sz] of [
        [0, -cd / 2, cw, 0.35],
        [0, cd / 2, cw, 0.35],
        [-cw / 2, 0, 0.35, cd],
        [cw / 2, 0, 0.35, cd],
      ] as const)
        houses.push(tint(place(new THREE.BoxGeometry(sx, 2.2, sz), [hx + ox, y + 1.1, hz + oz], [0, yaw, 0]), c));
      for (let t = 0; t < 2; t++) farPalm(hx + (r() - 0.5) * cw * 0.7, y + 0.3, hz + (r() - 0.5) * cd * 0.7, 6 + r() * 4, r, trunks, crowns);
    });
    // barjeel (wind tower) on the nearest house
    {
      const [bx, bz] = inland[0];
      const by = groundHeight(bx, bz) - 0.4;
      houses.push(tint(place(new THREE.BoxGeometry(3.2, 11, 3.2), [bx + 2, by + 5.5, bz]), '#E7DCC6'));
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        houses.push(tint(place(new THREE.BoxGeometry(0.9, 4.2, 0.2), [bx + 2 + Math.cos(a) * 1.62, by + 8.4, bz + Math.sin(a) * 1.62], [0, -a + Math.PI / 2, 0]), '#5A4634'));
      }
    }
    // palm groves and desert scrub on the dunes
    for (let k = 0; k < (quality === 'low' ? 18 : 40); k++) {
      const px = -90 + r() * 170;
      const pz = 26 + r() * 95;
      farPalm(px, groundHeight(px, pz) - 0.2, pz, 6 + r() * 5, r, trunks, crowns);
    }
    for (let k = 0; k < (quality === 'low' ? 60 : 140); k++) {
      const sx = -110 + r() * 220;
      const sz = 22 + r() * 120;
      const sc = 0.4 + r() * 0.9;
      const tone = ['#6F7044', '#857A4E', '#5F6A3C', '#8E8358'][Math.floor(r() * 4)];
      shrubs.push(tint(place(shrub(sc, k * 1.37), [sx, groundHeight(sx, sz) + sc * 0.05, sz], [0, r() * 6, 0]), tone));
    }
    return { paint: mergeAll(houses, true), matte: mergeAll([...trunks, ...crowns, ...shrubs], true) };
  }, [quality]);
  return (
    <group>
      <mesh geometry={geo.paint} material={m.paint} castShadow receiveShadow />
      <mesh geometry={geo.matte} material={m.matte} castShadow receiveShadow />
    </group>
  );
}

