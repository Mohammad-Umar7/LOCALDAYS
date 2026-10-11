import { useMemo } from 'react';
import * as THREE from 'three';
import { getTexSet } from '../../materials/textures';
import type { AtelierMaterials } from './materials';
import { CENTRE_RUG } from './layout';
import { Baked } from './Baked';

/* ------------------------------------------------------------------ */
/*  Hand-knotted style centre rug: madder field, navy medallion and    */
/*  spandrels, star border, abrash (dye-lot) banding and fringes.      */
/* ------------------------------------------------------------------ */

let rugTex: THREE.Texture | null = null;

function star8(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.55;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

function diamond(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  g.beginPath();
  g.moveTo(x, y - ry);
  g.lineTo(x + rx, y);
  g.lineTo(x, y + ry);
  g.lineTo(x - rx, y);
  g.closePath();
}

function rugTexture() {
  if (rugTex) return rugTex;
  const W = 1024;
  const H = 768;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const madder = '#5A1417';
  const madderLight = '#6E1D1F';
  const navy = '#1A2238';
  const ivory = '#D6C49E';
  const gold = '#B9843A';
  const brown = '#2A1A12';
  // field
  g.fillStyle = madder;
  g.fillRect(0, 0, W, H);
  // field lattice of small lozenges
  g.fillStyle = madderLight;
  for (let y = 0; y < H; y += 36)
    for (let x = (y / 36) % 2 ? 18 : 0; x < W; x += 36) {
      diamond(g, x, y, 12, 12);
      g.fill();
    }
  g.fillStyle = gold;
  for (let y = 18; y < H; y += 36) for (let x = (y / 36) % 2 ? 0 : 18; x < W; x += 36) g.fillRect(x - 2, y - 2, 4, 4);
  // spandrels (quarter medallions in the corners)
  const B = 96;
  for (const [cx, cy] of [
    [B, B],
    [W - B, B],
    [B, H - B],
    [W - B, H - B],
  ]) {
    g.fillStyle = ivory;
    g.beginPath();
    g.ellipse(cx, cy, 200, 150, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = navy;
    g.beginPath();
    g.ellipse(cx, cy, 192, 142, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = gold;
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      star8(g, cx + Math.cos(a) * 120, cy + Math.sin(a) * 90, 9);
    }
  }
  // central medallion with pendants
  const mx = W / 2;
  const my = H / 2;
  g.fillStyle = ivory;
  diamond(g, mx, my, 270, 200);
  g.fill();
  g.fillStyle = navy;
  diamond(g, mx, my, 258, 190);
  g.fill();
  g.fillStyle = madder;
  diamond(g, mx, my, 196, 142);
  g.fill();
  g.fillStyle = ivory;
  diamond(g, mx, my, 150, 108);
  g.fill();
  g.fillStyle = navy;
  diamond(g, mx, my, 142, 100);
  g.fill();
  g.fillStyle = gold;
  star8(g, mx, my, 70);
  g.fillStyle = madder;
  star8(g, mx, my, 40);
  g.fillStyle = ivory;
  star8(g, mx, my, 14);
  for (const s of [-1, 1]) {
    g.fillStyle = navy;
    diamond(g, mx + s * 300, my, 40, 26);
    g.fill();
    g.fillStyle = gold;
    star8(g, mx + s * 300, my, 12);
  }
  // borders: outer guard, main star border, inner guard
  const band = (inset: number, width: number, color: string) => {
    g.fillStyle = color;
    g.fillRect(inset, inset, W - inset * 2, width);
    g.fillRect(inset, H - inset - width, W - inset * 2, width);
    g.fillRect(inset, inset, width, H - inset * 2);
    g.fillRect(W - inset - width, inset, width, H - inset * 2);
  };
  band(0, 14, brown);
  band(14, 10, ivory);
  band(24, 58, navy);
  band(82, 8, gold);
  band(90, 4, brown);
  g.fillStyle = gold;
  for (let x = 54; x < W - 40; x += 46) {
    star8(g, x, 53, 13);
    star8(g, x, H - 53, 13);
  }
  for (let y = 100; y < H - 80; y += 46) {
    star8(g, 53, y, 13);
    star8(g, W - 53, y, 13);
  }
  g.fillStyle = madder;
  for (let x = 54; x < W - 40; x += 46) {
    star8(g, x, 53, 5);
    star8(g, x, H - 53, 5);
  }
  // abrash banding + pile noise
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    const abrash = 1 + Math.sin(y * 0.021) * 0.04 + Math.sin(y * 0.073 + 1.7) * 0.025;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const n = 1 + (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1) * 0.06;
      const k = abrash * n * (0.94 + 0.06 * Math.sin(x * 0.9 + y * 0.31));
      d[i] = Math.min(255, d[i] * k);
      d[i + 1] = Math.min(255, d[i + 1] * k);
      d[i + 2] = Math.min(255, d[i + 2] * k);
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  rugTex = t;
  return t;
}

export function CentreRug({ m }: { m: AtelierMaterials }) {
  const { w, d } = CENTRE_RUG;
  const mat = useMemo(() => {
    const fab = getTexSet('fabric', { base: '#FFFFFF', seed: 51, weave: 260 });
    const n = fab.normalMap!.clone();
    n.repeat.set(10, 8);
    n.needsUpdate = true;
    return new THREE.MeshPhysicalMaterial({ map: rugTexture(), normalMap: n, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.95, sheen: 0.6, sheenColor: new THREE.Color('#C87A5A'), sheenRoughness: 0.5 });
  }, []);
  const fringe = useMemo(() => {
    const mats: THREE.Matrix4[] = [];
    for (const s of [-1, 1])
      for (let z = -d / 2 + 0.02; z <= d / 2 - 0.02; z += 0.022)
        mats.push(new THREE.Matrix4().compose(new THREE.Vector3(s * (w / 2 + 0.035), 0.004, z + Math.sin(z * 37) * 0.003), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.sin(z * 53) * 0.12, 0)), new THREE.Vector3(1, 1, 1)));
    return mats;
  }, [w, d]);
  const fringeGeo = useMemo(() => new THREE.BoxGeometry(0.075, 0.004, 0.007), []);
  return (
    <group position={[CENTRE_RUG.x, 0, CENTRE_RUG.z]}>
      <mesh material={mat} position={[0, 0.006, 0]} receiveShadow>
        <boxGeometry args={[w, 0.012, d]} />
      </mesh>
      <Baked geo={fringeGeo} mats={fringe} material={m.linen} />
    </group>
  );
}
