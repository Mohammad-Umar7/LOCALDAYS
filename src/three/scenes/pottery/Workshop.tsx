import { useMemo } from 'react';
import * as THREE from 'three';
import { roundedBox } from '../../props/geo';
import type { Vec3 } from '../../core/types';
import { latheSimple, paintBy, rand, type FormName } from './geometry';
import { ARCHES, CART, COURT, FY, TABLE } from './layout';
import type { PotteryMaterials } from './materials';
import { Slab } from './parts';
import { mixRGB, rgb } from './tex';
import { Vessel } from './Vessels';

/* ------------------------------------------------------------------ */
/*  Class tables: a long scrubbed table with stools, canvas boards,    */
/*  hand-building projects, banding wheels and tools; aprons on pegs;  */
/*  a ware cart of leather-hard pieces drying in the arch light.       */
/* ------------------------------------------------------------------ */

function useWorkshopGeometry() {
  return useMemo(() => {
    const seat = latheSimple(
      [
        [0.0005, 0.0],
        [0.15, 0.0],
        [0.165, 0.012],
        [0.168, 0.028],
        [0.158, 0.038],
        [0.0005, 0.036],
      ],
      { segments: 36 },
    );
    const leg = new THREE.CylinderGeometry(0.016, 0.02, 0.6, 10);
    const ring = new THREE.TorusGeometry(0.135, 0.009, 6, 36);
    ring.rotateX(Math.PI / 2);
    const coil = new THREE.TorusGeometry(0.05, 0.009, 8, 28);
    coil.rotateX(Math.PI / 2);
    const pin = new THREE.CylinderGeometry(0.022, 0.022, 0.3, 14);
    pin.rotateZ(Math.PI / 2);
    const banding = latheSimple(
      [
        [0.0005, 0],
        [0.07, 0],
        [0.075, 0.012],
        [0.03, 0.02],
        [0.025, 0.06],
        [0.11, 0.062],
        [0.115, 0.075],
        [0.0005, 0.076],
      ],
      { segments: 36 },
    );
    const slab = roundedBox(0.2, 0.012, 0.14, 0.005, 2);
    const knife = roundedBox(0.16, 0.004, 0.018, 0.002, 1);
    const castor = new THREE.CylinderGeometry(0.035, 0.035, 0.025, 14);
    castor.rotateX(Math.PI / 2);
    return { seat, leg, ring, coil, pin, banding, slab, knife, castor };
  }, []);
}

/** A hanging apron: bib, waist ties and a soft drape. */
function apronGeometry(color: string, seed: number) {
  const r = rand(seed);
  const g = new THREE.PlaneGeometry(0.62, 0.86, 10, 16);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i); // -0.43 .. 0.43 (top)
    const v = THREE.MathUtils.clamp((0.43 - y) / 0.86, 0, 1); // 0 top .. 1 bottom
    const width = v < 0.3 ? THREE.MathUtils.lerp(0.26, 0.5, Math.pow(v / 0.3, 1.6)) : THREE.MathUtils.lerp(0.5, 0.6, (v - 0.3) / 0.7);
    const nx = (x / 0.31) * (width / 2);
    const fold = Math.sin(nx * 26 + r() * 0.2 + seed) * 0.012 * v + Math.sin(nx * 9 + seed) * 0.01 * v;
    p.setXYZ(i, nx, y, 0.02 + fold + v * v * 0.05);
  }
  g.computeVertexNormals();
  g.translate(0, -0.43, 0);
  const c = rgb(color);
  const dirty = rgb('#8E7C69');
  paintBy(g, (x, y) => {
    const smear = Math.max(0, Math.sin(x * 23 + y * 7 + seed) * Math.sin(y * 11 - seed)) * 0.35 * Math.min(1, -y * 1.5);
    return mixRGB(c, dirty, smear);
  });
  return g;
}

export function Workshop({ m }: { m: PotteryMaterials }) {
  const g = useWorkshopGeometry();
  const { x, z, l, w } = TABLE;
  const top = FY + 0.78;
  const stools = useMemo(() => {
    const out: { p: Vec3; r: number }[] = [];
    const r = rand(12);
    for (let i = 0; i < 3; i++) {
      const dx = -l / 2 + 0.55 + i * ((l - 1.1) / 2);
      out.push({ p: [x + dx + (r() - 0.5) * 0.12, FY, z - w / 2 - 0.3 + (r() - 0.5) * 0.08], r: r() });
      out.push({ p: [x + dx + (r() - 0.5) * 0.12, FY, z + w / 2 + 0.32 + (r() - 0.5) * 0.08], r: r() });
    }
    out.push({ p: [x - l / 2 - 0.35, FY, z + 0.05], r: 0.3 });
    return out;
  }, [x, z, l, w]);
  const places = useMemo(() => [-1.15, -0.4, 0.4, 1.15].flatMap((dx, i) => [{ dx, dz: -0.2, i: i * 2 }, { dx: dx + 0.1, dz: 0.22, i: i * 2 + 1 }]), []);
  const aprons = useMemo(() => [apronGeometry('#D9CEB9', 3), apronGeometry('#2F4867', 7), apronGeometry('#A4532F', 11)], []);
  const pierZ = (ARCHES.z[1] + ARCHES.z[2]) / 2;
  const pierW = ARCHES.z[2] - ARCHES.z[1] - ARCHES.w - 0.06;

  return (
    <group>
      {/* table */}
      <Slab mat={m.woodWorn} position={[x, top - 0.03, z]} size={[l, 0.06, w]} r={0.015} uv={1} />
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => <Slab key={`${sx}${sz}`} mat={m.woodTurned} position={[x + sx * (l / 2 - 0.12), FY + (top - FY - 0.06) / 2, z + sz * (w / 2 - 0.1)]} size={[0.08, top - FY - 0.06, 0.08]} r={0.01} />),
      )}
      {[-1, 1].map((sx) => (
        <Slab key={sx} mat={m.woodWorn} position={[x + sx * (l / 2 - 0.12), FY + 0.16, z]} size={[0.06, 0.06, w - 0.2]} r={0.008} />
      ))}
      <Slab mat={m.woodWorn} position={[x, FY + 0.16, z]} size={[l - 0.24, 0.06, 0.06]} r={0.008} />

      {/* stools */}
      {stools.map((s, i) => (
        <group key={i} position={s.p} rotation={[0, s.r, 0]}>
          <mesh geometry={g.seat} material={m.woodTurned} position={[0, 0.6, 0]} castShadow receiveShadow />
          {[0, 1, 2, 3].map((k) => {
            const a = (k / 4) * Math.PI * 2 + 0.785;
            return <mesh key={k} geometry={g.leg} material={m.woodTurned} position={[Math.cos(a) * 0.1, 0.3, Math.sin(a) * 0.1]} rotation={[Math.sin(a) * 0.1, 0, -Math.cos(a) * 0.1]} castShadow />;
          })}
          <mesh geometry={g.ring} material={m.woodTurned} position={[0, 0.22, 0]} castShadow />
        </group>
      ))}

      {/* places: canvas board + a project + tools */}
      {places.map((pl) => {
        const px = x + pl.dx;
        const pz = z + pl.dz;
        const kind = pl.i % 4;
        const forms: FormName[] = ['bowl', 'cylinder', 'smallBowl', 'mug'];
        return (
          <group key={pl.i}>
            <Slab mat={m.canvas} position={[px, top + 0.004, pz]} rotation={[0, (pl.i % 3) * 0.06 - 0.06, 0]} size={[0.44, 0.008, 0.32]} r={0.003} cast={false} uv={4} />
            {kind === 0 && <Vessel m={m} form="smallBowl" body="green" position={[px - 0.05, top + 0.008, pz]} seed={600 + pl.i} scale={1.2} />}
            {kind === 1 &&
              [0, 1, 2, 3, 4].map((k) => <mesh key={k} geometry={g.coil} material={m.clayDry} position={[px - 0.04, top + 0.017 + k * 0.016, pz]} rotation={[0, k, 0]} scale={1 - k * 0.03} castShadow receiveShadow />)}
            {kind === 2 && <mesh geometry={g.slab} material={m.clayDry} position={[px - 0.04, top + 0.014, pz]} rotation={[0, 0.2, 0]} castShadow receiveShadow />}
            {kind === 3 && <Vessel m={m} form={forms[pl.i % 4]} body="green" position={[px - 0.04, top + 0.008, pz]} seed={610 + pl.i} />}
            <mesh geometry={g.knife} material={m.woodMid} position={[px + 0.15, top + 0.012, pz + 0.06]} rotation={[0, 1.2 + pl.i, 0]} castShadow />
            {pl.i % 2 === 0 && <Vessel m={m} form="cup" glaze="cream" position={[px + 0.16, top + 0.008, pz - 0.08]} seed={620 + pl.i} drips={0} segments={36} />}
          </group>
        );
      })}
      <mesh geometry={g.pin} material={m.woodMid} position={[x - 0.05, top + 0.022, z + 0.02]} rotation={[0, 0.3, 0]} castShadow />
      {[-0.75, 0.85].map((dx, i) => (
        <group key={dx} position={[x + dx, top, z + (i ? -0.02 : 0.03)]}>
          <mesh geometry={g.banding} material={m.iron} castShadow receiveShadow />
          {i === 0 ? (
            [0, 1, 2, 3, 4, 5].map((k) => <mesh key={k} geometry={g.coil} material={m.clayDry} position={[0, 0.087 + k * 0.016, 0]} rotation={[0, k * 1.3, 0]} scale={0.9 + Math.sin(k) * 0.05} castShadow receiveShadow />)
          ) : (
            <Vessel m={m} form="jar" body="green" position={[0, 0.077, 0]} seed={630} scale={0.8} />
          )}
        </group>
      ))}
      {/* jar of tools in the middle of the table */}
      <Vessel m={m} form="tumbler" glaze="charcoal" position={[x + 0.02, top, z - 0.02]} seed={640} />
      {[0, 1, 2, 3].map((k) => (
        <mesh key={k} position={[x + 0.02 + Math.cos(k * 1.6) * 0.012, top + 0.12, z - 0.02 + Math.sin(k * 1.6) * 0.012]} rotation={[Math.cos(k * 1.6) * 0.2, 0, Math.sin(k * 1.6) * 0.2]} material={m.woodMid} castShadow>
          <cylinderGeometry args={[0.005, 0.006, 0.2, 6]} />
        </mesh>
      ))}

      {/* aprons on a peg rail on the pier between the arches */}
      <Slab mat={m.woodDark} position={[COURT.x1 - 0.025, FY + 1.68, pierZ]} size={[0.035, 0.07, pierW]} r={0.01} />
      {[-pierW * 0.3, pierW * 0.3].map((dz, i) => (
        <group key={dz}>
          <mesh position={[COURT.x1 - 0.07, FY + 1.69, pierZ + dz]} rotation={[0, 0, Math.PI / 2 - 0.25]} material={m.woodMid} castShadow>
            <cylinderGeometry args={[0.009, 0.011, 0.09, 8]} />
          </mesh>
          <mesh geometry={aprons[i]} material={m.cloth} position={[COURT.x1 - 0.075 - i * 0.028, FY + 1.63 - i * 0.02, pierZ + dz * 0.6]} rotation={[0, -Math.PI / 2 + (i - 1) * 0.05, 0]} castShadow receiveShadow />
        </group>
      ))}

      <WareCart m={m} g={g} />
    </group>
  );
}

/** Wooden ware cart with boards of leather-hard pots drying. */
function WareCart({ m, g }: { m: PotteryMaterials; g: ReturnType<typeof useWorkshopGeometry> }) {
  const { x, z } = CART;
  const L = 1.5;
  const Dp = 0.56;
  const levels = [0.22, 0.6, 0.98, 1.36];
  const items = useMemo(() => {
    const forms: FormName[] = ['bowl', 'cylinder', 'mug', 'smallBowl', 'tumbler', 'plate', 'jar', 'cup'];
    const r = rand(21);
    const out: { f: FormName; p: Vec3; r: number }[] = [];
    let k = 0;
    levels.forEach((y, li) => {
      let xx = x - L / 2 + 0.12;
      while (xx < x + L / 2 - 0.12) {
        const f = forms[(k * 3 + li) % forms.length];
        const rad = f === 'plate' ? 0.15 : f === 'bowl' ? 0.09 : f === 'jar' ? 0.075 : 0.05;
        if (xx + rad * 2 > x + L / 2 - 0.05) break;
        if (li === 3 && f === 'jar') {
          k++;
          continue;
        }
        out.push({ f, p: [xx + rad, FY + y + 0.03, z + (r() - 0.5) * 0.16], r: r() * 6 });
        xx += rad * 2 + 0.04 + r() * 0.04;
        k++;
      }
    });
    return out;
  }, [x, z]);
  return (
    <group>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`}>
            <Slab mat={m.woodTurned} position={[x + sx * (L / 2), FY + 0.06 + 0.82, z + sz * (Dp / 2)]} size={[0.05, 1.62, 0.05]} r={0.008} />
            <mesh geometry={g.castor} material={m.rubber} position={[x + sx * (L / 2), FY + 0.035, z + sz * (Dp / 2)]} castShadow />
          </group>
        )),
      )}
      {levels.map((y) => (
        <Slab key={y} mat={m.woodWorn} position={[x, FY + y + 0.012, z]} size={[L - 0.03, 0.024, Dp - 0.02]} r={0.005} uv={1.2} />
      ))}
      {[-1, 1].map((sz) => (
        <Slab key={sz} mat={m.woodWorn} position={[x, FY + 1.66, z + sz * (Dp / 2)]} size={[L + 0.05, 0.05, 0.05]} r={0.008} />
      ))}
      {items.map((it, i) => (
        <Vessel key={i} m={m} form={it.f} body="green" position={it.p} rotation={it.r} seed={700 + i} segments={40} />
      ))}
    </group>
  );
}
