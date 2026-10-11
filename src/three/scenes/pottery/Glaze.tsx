import { useMemo } from 'react';
import * as THREE from 'three';
import { roundedBox, tubeAlong } from '../../props/geo';
import type { Vec3 } from '../../core/types';
import { latheSimple, paint, rand } from './geometry';
import { COURT, FY, GLAZE } from './layout';
import type { PotteryMaterials } from './materials';
import { Instances, Slab, type InstanceSpec } from './parts';
import { mixRGB, rgb } from './tex';
import { Vessel } from './Vessels';

/* ------------------------------------------------------------------ */
/*  Glazing station: scrubbed counter with a deep ceramic sink, glaze  */
/*  buckets with coloured surfaces and drips, brushes in jars, dipping */
/*  tongs, a board of test tiles and a shelf of oxide jars.            */
/* ------------------------------------------------------------------ */

const X0 = GLAZE.x0;
const X1 = GLAZE.x1;
const ZB = COURT.z0 + 0.03;
const DEPTH = 0.62;
const TOP = FY + 0.9;

export const GLAZE_SWATCH = ['#1D4E7D', '#94BCA3', '#D6BF98', '#33302D', '#A4532F', '#ECE6D8'];

function useGlazeGeometry() {
  return useMemo(() => {
    const white = rgb('#E9E4DA');
    const bucket = (glaze: string, seed: number) => {
      const r = rand(seed);
      const gc = rgb(glaze);
      const drips = Array.from({ length: 4 }, () => ({ a: r() * Math.PI * 2, w: 0.08 + r() * 0.15, l: 0.2 + r() * 0.5 }));
      return latheSimple(
        [
          [0.0005, 0.006],
          [0.118, 0.006],
          [0.124, 0.0],
          [0.15, 0.34],
          [0.158, 0.352],
          [0.154, 0.36],
          [0.146, 0.346],
          [0.12, 0.018],
          [0.0005, 0.018],
        ],
        {
          segments: 40,
          color: (i, _j, th) => {
            if (i >= 5) return mixRGB(white, gc, 0.55); // glaze-coated inside
            if (i !== 3 && i !== 4) return white;
            let f = 0;
            for (const d of drips) {
              let da = Math.abs(th - d.a);
              da = Math.min(da, Math.PI * 2 - da);
              f = Math.max(f, Math.exp(-((da / (d.w * 0.25)) ** 2)));
            }
            return mixRGB(white, gc, i === 4 ? 0.7 : f * 0.75);
          },
        },
      );
    };
    const buckets = GLAZE_SWATCH.map((c, i) => bucket(c, i + 11));
    const surfaces = GLAZE_SWATCH.map((c) => {
      const g = new THREE.CircleGeometry(0.143, 40);
      g.rotateX(-Math.PI / 2);
      return paint(g, c);
    });
    const handle = new THREE.TorusGeometry(0.155, 0.0045, 6, 32, Math.PI);
    const lid = latheSimple(
      [
        [0.0005, 0.018],
        [0.15, 0.018],
        [0.162, 0.01],
        [0.162, -0.012],
        [0.152, -0.012],
        [0.15, 0.005],
        [0.0005, 0.005],
      ],
      { segments: 40 },
    );
    const brush = (len: number, rr: number) => {
      const h = new THREE.CylinderGeometry(rr * 0.6, rr, len, 8);
      h.translate(0, len / 2, 0);
      return h;
    };
    const tongs = tubeAlong(
      [new THREE.Vector3(-0.17, 0.0, 0), new THREE.Vector3(0.0, 0.0, 0.02), new THREE.Vector3(0.12, 0.0, 0.05), new THREE.Vector3(0.18, 0.0, 0.03), new THREE.Vector3(0.2, 0.0, 0.0)],
      0.005,
      6,
    );
    const tongs2 = tongs.clone();
    tongs2.scale(1, 1, -1);
    const sieve = latheSimple(
      [
        [0.0005, 0.01],
        [0.12, 0.01],
        [0.125, 0.0],
        [0.13, 0.07],
        [0.124, 0.07],
        [0.118, 0.012],
      ],
      { segments: 36 },
    );
    const tile = roundedBox(0.11, 0.085, 0.012, 0.004, 2);
    return { buckets, surfaces, handle, lid, brushLong: brush(0.24, 0.006), brushShort: brush(0.17, 0.008), tongs, tongs2, sieve, tile };
  }, []);
}

export function GlazeStation({ m }: { m: PotteryMaterials }) {
  const g = useGlazeGeometry();
  const cx = (X0 + X1) / 2;
  const zc = ZB + DEPTH / 2;
  const sinkX = X0 + 0.36;
  const tiles = useMemo(() => {
    const r = rand(5);
    const pal = ['#1D4E7D', '#2F7F82', '#5D93B8', '#94BCA3', '#6E9D7E', '#D6BF98', '#E9DFC8', '#B87A2E', '#A4532F', '#7A3A22', '#33302D', '#6B635B', '#C9A24E', '#3E5F8A', '#8FAFB0', '#D9946A'];
    const out: InstanceSpec[] = [];
    const cols = 9;
    const rows = 5;
    for (let i = 0; i < cols; i++)
      for (let k = 0; k < rows; k++) {
        const c = new THREE.Color(pal[(i * 3 + k * 5) % pal.length]).offsetHSL(0, (r() - 0.5) * 0.06, (r() - 0.5) * 0.06);
        out.push({ p: [cx - 0.72 + i * 0.18, TOP + 0.47 + k * 0.135, COURT.z0 + 0.045], r: [0, 0, (r() - 0.5) * 0.06], c });
      }
    return out;
  }, [cx]);
  const tileMat = useMemo(() => new THREE.MeshPhysicalMaterial({ roughness: 0.18, clearcoat: 0.9, clearcoatRoughness: 0.1, color: '#ffffff' }), []);
  const nails = useMemo<InstanceSpec[]>(() => tiles.map((t) => ({ p: [t.p[0], t.p[1] + 0.05, t.p[2] + 0.003] })), [tiles]);
  const bucketX = [0, 1, 2, 3, 4].map((i) => X0 + 0.58 + i * 0.4);
  const brushes = useMemo(() => {
    const out: { p: Vec3; r: Vec3; long: boolean }[] = [];
    const r = rand(9);
    [cx + 0.42, cx + 0.62].forEach((jx, ji) => {
      for (let k = 0; k < 5; k++)
        out.push({ p: [jx + (r() - 0.5) * 0.03, TOP + 0.02, zc - 0.05 + (r() - 0.5) * 0.03], r: [(r() - 0.5) * 0.35, 0, (r() - 0.5) * 0.35], long: (k + ji) % 2 === 0 });
    });
    return out;
  }, [cx, zc]);

  return (
    <group>
      {/* counter */}
      <Slab mat={m.woodWorn} position={[(sinkX + 0.32 + X1) / 2, TOP - 0.025, zc]} size={[X1 - sinkX - 0.32, 0.05, DEPTH]} r={0.012} uv={1.2} />
      <Slab mat={m.woodWorn} position={[cx, FY + 0.2, zc]} size={[X1 - X0 - 0.06, 0.03, DEPTH - 0.06]} r={0.008} uv={1.2} />
      {[X0 + 0.04, sinkX + 0.34, cx + 0.5, X1 - 0.04].map((x) =>
        [ZB + 0.04, ZB + DEPTH - 0.04].map((z) => <Slab key={`${x}:${z}`} mat={m.woodTurned} position={[x, FY + (TOP - FY - 0.05) / 2, z]} size={[0.06, TOP - FY - 0.05, 0.06]} r={0.008} />),
      )}
      <Slab mat={m.woodWorn} position={[cx, TOP - 0.09, ZB + DEPTH - 0.025]} size={[X1 - X0 - 0.02, 0.08, 0.03]} r={0.008} uv={1.2} />
      {/* deep sink + brass tap */}
      <group position={[sinkX, TOP, zc]}>
        <Slab mat={m.ceramicWhite} position={[0, -0.21, 0]} size={[0.64, 0.03, DEPTH - 0.02]} r={0.012} />
        <Slab mat={m.ceramicWhite} position={[0, -0.1, (DEPTH - 0.04) / 2]} size={[0.64, 0.24, 0.035]} r={0.012} />
        <Slab mat={m.ceramicWhite} position={[0, -0.1, -(DEPTH - 0.04) / 2]} size={[0.64, 0.24, 0.035]} r={0.012} />
        <Slab mat={m.ceramicWhite} position={[0.305, -0.1, 0]} size={[0.035, 0.24, DEPTH - 0.02]} r={0.012} />
        <Slab mat={m.ceramicWhite} position={[-0.305, -0.1, 0]} size={[0.035, 0.24, DEPTH - 0.02]} r={0.012} />
        <mesh position={[0, -0.19, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.slip} receiveShadow>
          <circleGeometry args={[0.16, 24]} />
        </mesh>
        <mesh position={[0, 0.2, -0.26]} material={m.brass} castShadow>
          <cylinderGeometry args={[0.014, 0.014, 0.4, 10]} />
        </mesh>
        <mesh geometry={useMemo(() => tubeAlong([new THREE.Vector3(0, 0.38, -0.26), new THREE.Vector3(0, 0.44, -0.18), new THREE.Vector3(0, 0.38, -0.08), new THREE.Vector3(0, 0.3, -0.07)], 0.013, 8), [])} material={m.brass} castShadow />
        <mesh position={[0, 0.3, -0.26]} rotation={[0, 0.5, Math.PI / 2]} material={m.brass} castShadow>
          <cylinderGeometry args={[0.008, 0.008, 0.12, 6]} />
        </mesh>
        <mesh position={[0.32, 0.03, 0.0]} rotation={[0, 0.3, 0]} geometry={useMemo(() => roundedBox(0.1, 0.03, 0.07, 0.014, 3), [])} material={m.sponge} castShadow />
      </group>
      {/* worktop tools */}
      {[cx + 0.42, cx + 0.62].map((x, i) => (
        <Vessel key={x} m={m} form="tumbler" glaze={i ? 'celadon' : 'sand'} position={[x, TOP, zc - 0.05]} seed={400 + i} />
      ))}
      {brushes.map((b, i) => (
        <group key={i} position={b.p} rotation={b.r}>
          <mesh geometry={b.long ? g.brushLong : g.brushShort} material={m.woodMid} castShadow />
          <mesh position={[0, b.long ? 0.245 : 0.175, 0]} material={m.dark}>
            <coneGeometry args={[0.007, 0.03, 8]} />
          </mesh>
        </group>
      ))}
      <group position={[cx - 0.05, TOP + 0.006, zc + 0.12]} rotation={[0, 0.35, 0]}>
        <mesh geometry={g.tongs} material={m.steel} castShadow />
        <mesh geometry={g.tongs2} material={m.steel} castShadow />
      </group>
      <mesh geometry={g.sieve} material={m.steel} position={[cx - 0.5, TOP, zc - 0.08]} castShadow receiveShadow />
      <Vessel m={m} form="pitcher" glaze="cream" position={[cx + 0.95, TOP, zc - 0.1]} rotation={2.6} seed={410} />
      {['gulf', 'celadon', 'honey', 'charcoal'].map((gl, i) => (
        <Vessel key={gl} m={m} form="smallBowl" glaze={gl as 'gulf'} position={[cx - 0.32 + i * 0.13, TOP, zc + 0.16]} scale={0.7} seed={420 + i} segments={40} />
      ))}
      {/* digital scale */}
      <Slab mat={m.enamelDark} position={[cx + 0.18, TOP + 0.02, zc + 0.08]} size={[0.24, 0.04, 0.22]} r={0.012} />
      <Slab mat={m.steel} position={[cx + 0.18, TOP + 0.044, zc + 0.06]} size={[0.2, 0.008, 0.16]} r={0.003} />

      {/* test-tile board */}
      <Slab mat={m.woodMid} position={[cx, TOP + 0.74, COURT.z0 + 0.02]} size={[1.78, 0.78, 0.025]} r={0.01} uv={1} />
      <Instances geometry={g.tile} material={tileMat} items={tiles} />
      <Instances geometry={useMemo(() => new THREE.SphereGeometry(0.006, 6, 4), [])} material={m.brass} items={nails} cast={false} />
      {/* shelf of oxide and stain jars */}
      <Slab mat={m.woodMid} position={[cx, TOP + 1.3, COURT.z0 + 0.13]} size={[1.9, 0.035, 0.24]} r={0.008} uv={1.2} />
      {[-1, 1].map((s) => (
        <Slab key={s} mat={m.iron} position={[cx + s * 0.8, TOP + 1.24, COURT.z0 + 0.1]} size={[0.025, 0.1, 0.18]} r={0.005} />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <Vessel key={i} m={m} form="jar" glaze={(['cream', 'sand', 'cream', 'honey', 'cream'] as const)[i % 5]} position={[cx - 0.8 + i * 0.2, TOP + 1.318, COURT.z0 + 0.13]} scale={0.48} seed={440 + i} drips={0} segments={36} />
      ))}

      {/* glaze buckets lined up in front of the counter */}
      {bucketX.map((x, i) => (
        <group key={x} position={[x, FY, ZB + DEPTH + 0.26 + (i % 2) * 0.05]} rotation={[0, i * 1.3, 0]}>
          <mesh geometry={g.buckets[i]} material={m.pan} castShadow receiveShadow />
          <mesh geometry={g.surfaces[i]} material={m.liquid} position={[0, 0.3, 0]} receiveShadow />
          <mesh geometry={g.handle} material={m.steel} position={[0, 0.355, 0]} rotation={[0, 0, i % 2 ? 0.3 : -1.2]} castShadow />
        </group>
      ))}
      <mesh geometry={g.lid} material={m.plastic} position={[X1 - 0.12, FY + 0.012, ZB + DEPTH + 0.66]} castShadow receiveShadow />
      {/* sixth glaze bucket on the low shelf + stirring stick across a bucket */}
      <group position={[X1 - 0.5, FY + 0.215, ZB + DEPTH / 2]} rotation={[0, 2, 0]}>
        <mesh geometry={g.buckets[5]} material={m.pan} castShadow receiveShadow />
        <mesh geometry={g.surfaces[5]} material={m.liquid} position={[0, 0.3, 0]} receiveShadow />
      </group>
      <Slab mat={m.woodWorn} position={[bucketX[2], FY + 0.37, ZB + DEPTH + 0.31]} rotation={[0, 0.5, 0.12]} size={[0.42, 0.012, 0.035]} r={0.004} />
    </group>
  );
}
