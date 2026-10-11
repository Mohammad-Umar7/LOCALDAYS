import { APPROVED_SWAPS, BOX_CONTENTS, CROPS, CROP_BY_ID, EXPERIENCE_USAGE, SUPPLIERS } from '@/data/farmOps';
import { EXPERIENCE_BY_ID } from '@/data/catalog';
import type { Subscription } from '@/data/types';
import { addDaysISO, daysBetween, rangeISO, weekdayOf } from '@/lib/dates';
import { round } from '@/lib/utils';
import { getSlots, type AvailabilityCtx } from '../availability';

/* ================================================================== */
/*  Harvest & Demand Intelligence (Ghaf Grove).                         */
/*  Every number is a deterministic calculation from bookings,         */
/*  subscriptions and the farmer's own recipes. "AI" only writes the   */
/*  explanation and ranks farmer-approved actions — it never predicts  */
/*  harvests or invents suppliers.                                      */
/* ================================================================== */

/** Subscribers outside the demo (fictional) whose boxes are due this week. */
const BASELINE_BOXES: Record<string, number> = { 'ghaf-box': 16, 'ghaf-family-box': 3 };

export interface DemandSource {
  key: string;
  label: string;
  kg: number;
  detail: string;
}

export interface CropLine {
  id: string;
  name: string;
  color: string;
  forecast: number;
  range: [number, number];
  supplyAdded: number;
  demand: number;
  sources: DemandSource[];
  balance: number;
  status: 'shortage' | 'tight' | 'ok' | 'surplus';
}

export interface Recommendation {
  id: string;
  kind: 'supplier' | 'swap-menu' | 'swap-box' | 'surplus';
  cropId: string;
  title: string;
  detail: string;
  impactKg: number;
  cost: number;
  tradeoff: string;
  approvedBy?: string;
  applied: boolean;
  supplier?: { name: string; distanceKm: number; availableKg: number; pricePerKg: number };
}

export interface HarvestReport {
  window: { start: string; end: string };
  crops: CropLine[];
  recommendations: Recommendation[];
  boxesDue: number;
  coversThisWeek: number;
  shortageCrop: CropLine | null;
}

export function harvestReport(
  ctx: AvailabilityCtx,
  subs: Subscription[],
  applied: string[],
  overrides: Record<string, number>,
): HarvestReport {
  const start = ctx.todayISO;
  const end = addDaysISO(start, 6);
  const days = rangeISO(start, 7);
  const demand: Record<string, DemandSource[]> = {};
  const push = (crop: string, s: DemandSource) => {
    (demand[crop] ??= []).push(s);
  };

  // 1) Subscription boxes due this week
  let boxesDue = 0;
  for (const [productId, contents] of Object.entries(BOX_CONTENTS)) {
    const demoDue = subs.filter((s) => s.productId === productId && s.status === 'active' && daysBetween(start, s.nextDelivery) >= 0 && daysBetween(s.nextDelivery, end) >= 0).length;
    const n = (BASELINE_BOXES[productId] ?? 0) + demoDue;
    if (!n) continue;
    boxesDue += n;
    for (const [crop, kg] of Object.entries(contents)) {
      push(crop, { key: `box:${productId}`, label: productId === 'ghaf-box' ? 'Seasonal Produce Boxes' : productId === 'ghaf-family-box' ? 'Family Harvest Boxes' : 'Herb bundles', kg: kg * n, detail: `${n} × ${kg} kg` });
    }
  }

  // 2) Confirmed experience covers in the window (baseline + demo bookings)
  let covers = 0;
  for (const [expId, usage] of Object.entries(EXPERIENCE_USAGE)) {
    const exp = EXPERIENCE_BY_ID[expId];
    if (!exp) continue;
    let units = 0;
    for (const d of days) for (const slot of getSlots(exp, d, { ...ctx, holds: {} })) units += slot.booked;
    if (!units) continue;
    if (expId === 'ghaf-dinner') covers = units;
    for (const [crop, kg] of Object.entries(usage.kg)) {
      push(crop, { key: `exp:${expId}`, label: usage.label, kg: kg * units, detail: `${units} ${usage.per === 'night' ? 'night' : 'guest'}${units > 1 ? 's' : ''} × ${kg} kg` });
    }
  }

  // 3) Farmer-approved adjustments that were applied
  const swapsApplied = APPROVED_SWAPS.filter((s) => applied.includes(s.id));
  const supplierApplied = applied.filter((a) => a.startsWith('supplier:'));

  const crops: CropLine[] = CROPS.map((c) => {
    const sources = (demand[c.id] ?? []).map((s) => ({ ...s, kg: round(s.kg, 2) }));
    let total = sources.reduce((a, s) => a + s.kg, 0);
    for (const sw of swapsApplied) {
      const affected = sw.appliesTo === 'ghaf-dinner' ? satGuests(ctx, days) : BASELINE_BOXES['ghaf-box'] + subs.filter((s) => s.productId === 'ghaf-box' && s.status === 'active').length;
      if (sw.cropOut === c.id) {
        total -= sw.kgSavedPerGuest * affected;
        sources.push({ key: `swap:${sw.id}`, label: `Applied: ${sw.title}`, kg: -round(sw.kgSavedPerGuest * affected, 2), detail: `${affected} ${sw.appliesTo === 'ghaf-dinner' ? 'Saturday covers' : 'boxes'}` });
      }
      if (sw.cropIn === c.id) {
        total += sw.kgUsedPerGuest * affected;
        sources.push({ key: `swapin:${sw.id}`, label: `Applied: ${sw.title}`, kg: round(sw.kgUsedPerGuest * affected, 2), detail: 'uses surplus' });
      }
    }
    const supplyAdded = supplierApplied
      .map((a) => a.split(':'))
      .filter(([, , crop]) => crop === c.id)
      .reduce((sum, [, , , kg]) => sum + Number(kg), 0);
    const forecast = overrides[c.id] ?? c.forecastKg;
    const demandKg = round(total, 1);
    const balance = round(forecast + supplyAdded - demandKg, 1);
    const status: CropLine['status'] = balance < -0.05 ? 'shortage' : balance < forecast * 0.1 ? 'tight' : balance > forecast * 0.15 ? 'surplus' : 'ok';
    return { id: c.id, name: c.name, color: c.color, forecast, range: c.range, supplyAdded, demand: demandKg, sources, balance, status };
  });

  const recs: Recommendation[] = [];
  const shortage = crops.filter((c) => c.status === 'shortage').sort((a, b) => a.balance - b.balance)[0] ?? null;
  const touched = (cropId: string) => applied.some((id) => id.includes(`:${cropId}`) || APPROVED_SWAPS.some((s) => s.id === id && s.cropOut === cropId));
  for (const c of crops.filter((x) => x.status === 'shortage' || touched(x.id))) {
    const gap = Math.max(0, -c.balance);
    // Farmer-approved swaps first (no cost), only if the substitute crop has surplus
    for (const sw of APPROVED_SWAPS.filter((s) => s.cropOut === c.id)) {
      const affected = sw.appliesTo === 'ghaf-dinner' ? satGuests(ctx, days) : BASELINE_BOXES['ghaf-box'] + subs.filter((s) => s.productId === 'ghaf-box' && s.status === 'active').length;
      const saves = round(sw.kgSavedPerGuest * affected, 1);
      const uses = round(sw.kgUsedPerGuest * affected, 1);
      const sub = crops.find((x) => x.id === sw.cropIn)!;
      if (sub.balance < uses && !applied.includes(sw.id)) continue;
      recs.push({
        id: sw.id,
        kind: sw.appliesTo === 'ghaf-dinner' ? 'swap-menu' : 'swap-box',
        cropId: c.id,
        title: sw.title,
        detail: `${sw.detail} Saves ${saves} kg of ${c.name.toLowerCase()}, uses ${uses} kg of ${sub.name.toLowerCase()} from surplus.`,
        impactKg: saves,
        cost: 0,
        tradeoff: sw.appliesTo === 'ghaf-dinner' ? 'Guests see the change on the printed menu' : 'Subscribers are notified before packing',
        approvedBy: sw.approvedBy,
        applied: applied.includes(sw.id),
      });
    }
    // Verified partner supply
    for (const sup of SUPPLIERS) {
      const offer = sup.offers.find((o) => o.cropId === c.id);
      if (!offer) continue;
      const prior = applied.find((x) => x.startsWith(`supplier:${sup.id}:${c.id}:`));
      const kg = prior ? Number(prior.split(':')[3]) : Math.min(offer.availableKg, Math.ceil(gap));
      if (!kg) continue;
      const id = prior ?? `supplier:${sup.id}:${c.id}:${kg}`;
      recs.push({
        id,
        kind: 'supplier',
        cropId: c.id,
        title: `Source ${kg} kg from ${sup.name}`,
        detail: `${sup.note}. ${offer.availableKg} kg available at AED ${offer.pricePerKg}/kg, ${sup.distanceKm} km away.`,
        impactKg: kg,
        cost: kg * offer.pricePerKg,
        tradeoff: `Keeps boxes and menus unchanged · AED ${kg * offer.pricePerKg} cost`,
        supplier: { name: sup.name, distanceKm: sup.distanceKm, availableKg: offer.availableKg, pricePerKg: offer.pricePerKg },
        applied: applied.some((a) => a.startsWith(`supplier:${sup.id}:${c.id}`)),
      });
    }
  }
  // Surplus ideas
  for (const c of crops.filter((x) => x.status === 'surplus')) {
    recs.push({
      id: `surplus:${c.id}`,
      kind: 'surplus',
      cropId: c.id,
      title: `Offer extra ${c.name.toLowerCase()} to subscribers`,
      detail: `${c.balance} kg uncommitted. Add a 1 kg add-on to this week’s boxes at AED ${Math.round((CROP_BY_ID[c.id].pricePerKg + 3) / 1)} or list it in the farm shop.`,
      impactKg: c.balance,
      cost: 0,
      tradeoff: 'Turns surplus into sales instead of waste',
      applied: applied.includes(`surplus:${c.id}`),
    });
  }

  return { window: { start, end }, crops, recommendations: recs, boxesDue, coversThisWeek: covers, shortageCrop: shortage };
}

function satGuests(ctx: AvailabilityCtx, days: string[]) {
  const sat = days.find((d) => weekdayOf(d) === 6);
  if (!sat) return 0;
  return getSlots(EXPERIENCE_BY_ID['ghaf-dinner'], sat, { ...ctx, holds: {} }).reduce((a, s) => a + s.booked, 0);
}

/** Plain-language explanation generated from the report (the "AI" layer — grounded only in these numbers). */
export function explainShortage(r: HarvestReport): string {
  const c = r.shortageCrop;
  if (!c) {
    const surplus = r.crops.filter((x) => x.status === 'surplus');
    return `Every crop covers its commitments for ${r.boxesDue} boxes and ${r.coversThisWeek} dinner covers this week.${
      surplus.length ? ` ${surplus.map((s) => `${s.name} has ${s.balance} kg spare`).join('; ')} — worth offering as add-ons before it goes to waste.` : ''
    }`;
  }
  const bySource = [...c.sources].filter((s) => s.kg > 0).sort((a, b) => b.kg - a.kg);
  const top = bySource.slice(0, 2);
  const rest = bySource.slice(2).reduce((a, s) => a + s.kg, 0);
  const gap = -c.balance;
  const pct = Math.round((gap / Math.max(1, c.demand)) * 100);
  const free = r.recommendations.filter((x) => x.cropId === c.id && x.cost === 0);
  const freeKg = free.reduce((a, x) => a + x.impactKg, 0);
  const sup = r.recommendations.find((x) => x.cropId === c.id && x.kind === 'supplier');
  const surpluses = r.crops.filter((x) => x.status === 'surplus');
  return [
    `Over the next 7 days you expect to harvest ${c.forecast} kg of ${c.name.toLowerCase()} — your last six comparable weeks ranged ${c.range[0]}–${c.range[1]} kg.`,
    `Confirmed commitments need ${c.demand} kg: ${top.map((t) => `${round(t.kg, 1)} kg for ${t.label.toLowerCase()} (${t.detail})`).join(' and ')}${rest > 0 ? `, plus ${round(rest, 1)} kg across other experiences` : ''}.`,
    `That leaves a ${round(gap, 1)} kg gap — about ${pct}% of demand.`,
    freeKg >= gap
      ? `Changes you have already approved can close it at no cost: ${free.map((x) => x.title.toLowerCase()).join(' plus ')} together free up ${round(freeKg, 1)} kg${surpluses.length ? `, using your ${surpluses.map((s) => s.name.toLowerCase()).join(' and ')} surplus` : ''}.`
      : free.length
        ? `Your approved swaps free up ${round(freeKg, 1)} kg; the rest needs extra supply.`
        : 'No approved swap applies, so extra supply is needed.',
    sup?.supplier
      ? `If you’d rather keep boxes and menus unchanged, ${sup.supplier.name} — a verified partner farm ${sup.supplier.distanceKm} km away — has ${sup.supplier.availableKg} kg available at AED ${sup.supplier.pricePerKg}/kg (AED ${sup.cost} for the ${sup.impactKg} kg you need).`
      : '',
  ]
    .filter(Boolean)
    .join(' ');
}
