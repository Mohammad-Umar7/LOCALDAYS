import { useMemo } from 'react';
import * as THREE from 'three';
import { smoothLathe } from '../../props/geo';
import type { AtelierMaterials } from './materials';
import { DOOR, NICHES, ROOM } from './layout';
import { atelierMap } from './textures';
import { Box, WallFrame } from './Architecture';

/* ------------------------------------------------------------------ */
/*  Wall dressing for the plain plaster bays: pierced brass sconces,   */
/*  a large engraved brass tray and a framed gold calligraphy panel.   */
/* ------------------------------------------------------------------ */

let calligraphy: THREE.Texture | null = null;

/** Abstract thuluth-like gold strokes on indigo — evokes calligraphy without real text. */
function calligraphyTexture() {
  if (calligraphy) return calligraphy;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 360;
  const g = c.getContext('2d')!;
  const bg = g.createRadialGradient(256, 180, 30, 256, 180, 300);
  bg.addColorStop(0, '#1F2A4A');
  bg.addColorStop(1, '#0E1428');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 360);
  g.strokeStyle = '#B98A3E';
  g.lineWidth = 3;
  g.strokeRect(18, 18, 476, 324);
  g.lineWidth = 1.2;
  g.strokeRect(28, 28, 456, 304);
  g.strokeStyle = '#E2BE72';
  g.fillStyle = '#E2BE72';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const stroke = (pts: number[][], w: number) => {
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i += 3) g.bezierCurveTo(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], pts[i + 2][0], pts[i + 2][1]);
    g.stroke();
  };
  // tall verticals (alifs) and sweeping baselines
  for (const x of [118, 176, 300, 352, 404]) stroke([[x, 92], [x + 4, 140], [x - 2, 190], [x + 3, 236]], 9);
  stroke([[70, 250], [160, 300], [300, 300], [440, 236]], 10);
  stroke([[96, 200], [140, 150], [230, 150], [262, 220]], 7);
  stroke([[262, 220], [290, 270], [360, 280], [420, 190]], 7);
  stroke([[200, 110], [230, 80], [270, 90], [250, 130]], 5);
  for (const [x, y] of [
    [150, 280],
    [236, 118],
    [330, 250],
    [386, 132],
    [210, 262],
  ]) {
    g.beginPath();
    g.ellipse(x, y, 7, 5, 0.6, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  calligraphy = t;
  return t;
}

function Sconce({ m, glow }: { m: AtelierMaterials; glow: THREE.Material }) {
  const g = useMemo(
    () => ({
      plate: smoothLathe([[0.001, 0], [0.07, 0], [0.075, 0.008], [0.05, 0.016], [0.001, 0.018]], 32, 10),
      body: smoothLathe([[0.03, -0.07], [0.048, -0.04], [0.052, 0.0], [0.045, 0.04], [0.028, 0.065]], 24, 16),
      cap: smoothLathe([[0.001, 0.12], [0.006, 0.118], [0.012, 0.09], [0.034, 0.066], [0.03, 0.06], [0.001, 0.06]], 24, 12),
      foot: smoothLathe([[0.001, -0.1], [0.008, -0.098], [0.02, -0.08], [0.034, -0.068], [0.001, -0.066]], 24, 10),
    }),
    [],
  );
  return (
    <group>
      <mesh geometry={g.plate} material={m.brass} rotation={[Math.PI / 2, 0, 0]} castShadow />
      <mesh material={m.brass} position={[0, -0.02, 0.06]} rotation={[0.7, 0, 0]}>
        <torusGeometry args={[0.07, 0.005, 8, 24, Math.PI]} />
      </mesh>
      <group position={[0, -0.06, 0.13]}>
        <mesh geometry={g.body} material={glow} />
        <mesh geometry={g.cap} material={m.brass} castShadow />
        <mesh geometry={g.foot} material={m.brass} />
      </group>
    </group>
  );
}

export function WallDecor({ m }: { m: AtelierMaterials }) {
  const sconceGlow = useMemo(() => {
    const t = atelierMap('piercedLantern').clone();
    t.repeat.set(4, 2);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: m.brass.map, color: '#D8B068', metalness: 1, roughness: 0.3, emissive: '#FFB061', emissiveMap: t, emissiveIntensity: 3.4 });
  }, [m]);
  const trayMat = useMemo(() => {
    const n = atelierMap('carving').clone();
    n.repeat.set(3, 3);
    n.wrapS = n.wrapT = THREE.RepeatWrapping;
    n.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: m.brass.map, color: '#E0B870', metalness: 1, roughness: 0.32, normalMap: n, normalScale: new THREE.Vector2(0.8, 0.8) });
  }, [m]);
  const tray = useMemo(() => {
    const g = smoothLathe([[0.001, 0], [0.3, 0.0], [0.33, 0.012], [0.345, 0.028], [0.34, 0.034], [0.31, 0.018], [0.001, 0.012]], 64, 24).clone();
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) * 1.4 + 0.5, p.getZ(i) * 1.4 + 0.5);
    return g;
  }, []);
  const callMat = useMemo(() => new THREE.MeshStandardMaterial({ map: calligraphyTexture(), roughness: 0.55, metalness: 0.15 }), []);
  const between = (NICHES.left.c + NICHES.left.w / 2 + NICHES.grand.c - NICHES.grand.w / 2) / 2;
  return (
    <group>
      {/* sconces flanking the gap between the two back-wall niches */}
      <WallFrame wall="back">
        {[2.05].map((y) => (
          <group key={y} position={[between, y, 0]} scale={1.6}>
            <Sconce m={m} glow={sconceGlow} />
          </group>
        ))}
      </WallFrame>
      {/* engraved brass tray on the window wall */}
      <WallFrame wall="left">
        <group position={[-(ROOM.z0 + 0.95), 2.15, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh geometry={tray} material={trayMat} castShadow receiveShadow />
        </group>
        <mesh material={m.iron} position={[-(ROOM.z0 + 0.95), 2.52, 0.03]}>
          <cylinderGeometry args={[0.006, 0.006, 0.04, 6]} />
        </mesh>
      </WallFrame>
      {/* framed calligraphy between the display niche and the carved door */}
      <WallFrame wall="right">
        <group position={[(NICHES.right.c + NICHES.right.w / 2 + DOOR.z - DOOR.w / 2) / 2 + 0.02, 2.02, 0]}>
          <Box m={m.ebony} p={[0, 0, 0.02]} s={[0.66, 0.5, 0.04]} r={0.008} />
          <Box m={m.brass} p={[0, 0, 0.042]} s={[0.58, 0.42, 0.006]} r={0.002} cast={false} />
          <mesh material={callMat} position={[0, 0, 0.0465]}>
            <planeGeometry args={[0.56, 0.4]} />
          </mesh>
        </group>
      </WallFrame>
    </group>
  );
}

