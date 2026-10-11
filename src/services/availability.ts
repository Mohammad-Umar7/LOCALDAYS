import type { Experience } from '@/data/types';
import { addDaysISO, daysBetween, rangeISO, weekdayOf } from '@/lib/dates';
import { clamp, seeded } from '@/lib/utils';

export interface Slot {
  key: string;
  experienceId: string;
  date: string;
  time?: string;
  capacity: number;
  booked: number;
  remaining: number;
  /** Seats taken by the platform's baseline (fictional) demand */
  baseline: number;
}

export interface AvailabilityCtx {
  todayISO: string;
  /** Guests/units booked through the demo (key → count) */
  extra: Record<string, number>;
  /** Seats held in carts (key → count) */
  holds?: Record<string, number>;
}

export const slotKey = (experienceId: string, date: string, time?: string) => `${experienceId}|${date}|${time ?? 'night'}`;

/**
 * Hand-tuned baseline bookings for the flagship farm's next seven days, so
 * the Harvest & Demand Intelligence story is stable for demos.
 */
const FLAGSHIP_CALIBRATION: Record<string, (dow: number, time?: string) => number> = {
  'ghaf-dinner': (dow) => (dow === 4 ? 18 : dow === 5 ? 22 : dow === 6 ? 22 : 0),
  'ghaf-family': (dow) => (dow === 5 ? 15 : dow === 6 ? 20 : dow === 0 ? 10 : 0),
  'ghaf-harvest': (dow, time) => (time === '08:00' ? (dow === 5 || dow === 6 ? 9 : 4) : dow === 5 || dow === 6 ? 7 : 2),
  'ghaf-breakfast': (dow) => (dow === 5 ? 6 : dow === 6 ? 8 : 0),
  'ghaf-stay': (dow) => (dow === 4 || dow === 5 || dow === 6 ? 1 : 0),
};

export function isOfferedOn(exp: Experience, date: string) {
  return exp.schedule.days.includes(weekdayOf(date));
}

export function baselineBooked(exp: Experience, date: string, time: string | undefined, todayISO: string) {
  const ahead = daysBetween(todayISO, date);
  const dow = weekdayOf(date);
  const cal = FLAGSHIP_CALIBRATION[exp.id];
  if (cal && ahead >= 0 && ahead < 7) return clamp(cal(dow, time), 0, exp.capacity);

  const r = seeded(`${exp.id}|${date}|${time ?? ''}`);
  const weekend = dow === 5 || dow === 6 || dow === 0;
  const popularity = exp.tags.includes('bestseller') ? 1.25 : 1;
  let occ = (weekend ? 0.58 : 0.3) * popularity;
  occ *= Math.max(0.12, 1 - Math.max(0, ahead) / 40);
  if (exp.priceUnit === 'per_night') {
    // Stays: small unit counts — book whole units
    const units = Array.from({ length: exp.capacity }, () => (r() < occ ? 1 : 0)).reduce((a: number, b: number) => a + b, 0);
    return units;
  }
  const jitter = 0.55 + r() * 0.9;
  let booked = Math.round(exp.capacity * occ * jitter);
  // A few popular near-term slots sell out entirely
  if (weekend && ahead <= 10 && r() < 0.1 * popularity) booked = exp.capacity;
  return clamp(booked, 0, exp.capacity);
}

function isPastTime(date: string, time: string | undefined, todayISO: string) {
  if (!time) return false;
  if (date !== todayISO) return daysBetween(todayISO, date) < 0;
  const now = new Date();
  const [h, m] = time.split(':').map(Number);
  // Same-day slots close two hours before start
  return h * 60 + m - (now.getHours() * 60 + now.getMinutes()) < 120;
}

export function getSlots(exp: Experience, date: string, ctx: AvailabilityCtx): Slot[] {
  if (!isOfferedOn(exp, date) || daysBetween(ctx.todayISO, date) < 0) return [];
  const times: (string | undefined)[] = exp.priceUnit === 'per_night' ? [undefined] : exp.schedule.times;
  return times
    .filter((t) => !isPastTime(date, t, ctx.todayISO))
    .map((time) => {
      const key = slotKey(exp.id, date, time);
      const baseline = baselineBooked(exp, date, time, ctx.todayISO);
      const booked = clamp(baseline + (ctx.extra[key] ?? 0) + (ctx.holds?.[key] ?? 0), 0, exp.capacity);
      return { key, experienceId: exp.id, date, time, capacity: exp.capacity, booked, remaining: exp.capacity - booked, baseline };
    });
}

/** Units/guests needed for a booking to fit a slot. */
export function demandFor(exp: Experience, guests: number) {
  return exp.priceUnit === 'per_night' ? 1 : guests;
}

export function hasSpace(exp: Experience, date: string, guests: number, ctx: AvailabilityCtx, nights = 1) {
  if (exp.priceUnit === 'per_night') {
    return rangeISO(date, nights).every((d) => (getSlots(exp, d, ctx)[0]?.remaining ?? 0) >= 1);
  }
  return getSlots(exp, date, ctx).some((s) => s.remaining >= guests);
}

export interface DayAvailability {
  date: string;
  status: 'closed' | 'soldout' | 'limited' | 'available';
  remaining: number;
  slots: Slot[];
}

export function dayAvailability(exp: Experience, date: string, guests: number, ctx: AvailabilityCtx): DayAvailability {
  const slots = getSlots(exp, date, ctx);
  if (!slots.length) return { date, status: 'closed', remaining: 0, slots };
  const best = Math.max(...slots.map((s) => s.remaining));
  const need = demandFor(exp, guests);
  if (best < need) return { date, status: 'soldout', remaining: best, slots };
  const limited = exp.priceUnit === 'per_night' ? best <= 1 && exp.capacity > 1 : best <= Math.max(3, exp.capacity * 0.2);
  return { date, status: limited ? 'limited' : 'available', remaining: best, slots };
}

export function nextAvailable(exp: Experience, guests: number, ctx: AvailabilityCtx, from = ctx.todayISO, horizon = 60) {
  for (let i = 0; i < horizon; i++) {
    const d = addDaysISO(from, i);
    const a = dayAvailability(exp, d, guests, ctx);
    if (a.status === 'available' || a.status === 'limited') return a;
  }
  return null;
}

export function upcomingOpenDates(exp: Experience, guests: number, ctx: AvailabilityCtx, count = 5, horizon = 45) {
  const out: DayAvailability[] = [];
  for (let i = 0; i < horizon && out.length < count; i++) {
    const a = dayAvailability(exp, addDaysISO(ctx.todayISO, i), guests, ctx);
    if (a.status === 'available' || a.status === 'limited') out.push(a);
  }
  return out;
}
