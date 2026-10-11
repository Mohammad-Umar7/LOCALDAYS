import type { Booking, Order, PresaleVoucher, Subscription } from '@/data/types';
import { EXPERIENCE_BY_ID, PRESALES, PRODUCT_BY_ID, PROVIDER_BY_ID, experiencesForProvider, productsForProvider } from '@/data/catalog';
import { ECONOMICS } from '@/config/economics';
import { FARM_COSTS } from '@/data/farmOps';
import { addDaysISO, daysBetween, rangeISO } from '@/lib/dates';
import { fmtDate } from '@/lib/format';
import { round, seeded } from '@/lib/utils';
import { getSlots, type AvailabilityCtx } from './availability';

/* ------------------------------------------------------------------ */
/*  Host analytics: a deterministic, fictional 12-week history for     */
/*  each demo host, with everything the demo user does layered on top  */
/*  in real time. Labelled as demo data wherever it is shown.          */
/* ------------------------------------------------------------------ */

const PRODUCT_SHARE: Record<string, [number, number]> = {
  farm: [0.1, 0.24],
  honey: [0.3, 0.46],
  pottery: [0.22, 0.34],
  coastal: [0.04, 0.07],
  fragrance: [0.34, 0.5],
};
const SUB_BASE: Record<string, [number, number]> = {
  'ghaf-grove': [6, 19],
  'sidr-valley': [8, 14],
  'rimal-dates': [11, 17],
  'wadi-hives': [9, 21],
  'dhaid-bee-garden': [0, 0],
};

export interface HostWeek {
  label: string;
  start: string;
  experiences: number;
  products: number;
  subscriptions: number;
  presales: number;
  guests: number;
  subscribers: number;
}

export interface StoreSlice {
  bookings: Booking[];
  orders: Order[];
  subscriptions: Subscription[];
  vouchers: PresaleVoucher[];
}

function weeklyExperienceBase(providerId: string) {
  return experiencesForProvider(providerId).reduce((sum, e) => {
    const sessions = e.priceUnit === 'per_night' ? 7 * e.capacity : e.schedule.days.length * Math.max(1, e.schedule.times.length);
    const perUnit = e.priceUnit === 'per_booking' ? e.price / Math.max(1, e.includedGuests ?? 1) : e.price;
    const occupancy = e.priceUnit === 'per_night' ? 0.42 : 0.38;
    const units = e.priceUnit === 'per_night' ? sessions * occupancy : sessions * e.capacity * occupancy;
    return sum + units * perUnit;
  }, 0);
}

export function hostHistory(providerId: string, todayISO: string, store: StoreSlice): HostWeek[] {
  const p = PROVIDER_BY_ID[providerId];
  const r = seeded(`hist:${providerId}`);
  const base = weeklyExperienceBase(providerId) * 0.55;
  const [s0, s1] = PRODUCT_SHARE[p.categoryId];
  const [sub0, sub1] = SUB_BASE[providerId] ?? [0, 0];
  const subPrice = productsForProvider(providerId).find((x) => x.subscription)?.subscription?.price ?? 0;
  const weeks: HostWeek[] = [];
  for (let w = 11; w >= 0; w--) {
    const start = addDaysISO(todayISO, -7 * w - 6);
    const t = (11 - w) / 11;
    const season = 0.72 + 0.4 * t; // winter season ramping up
    const noise = 0.85 + r() * 0.3;
    const exp = base * season * noise;
    const subscribers = Math.round(sub0 + (sub1 - sub0) * t);
    const subs = subscribers * subPrice;
    const products = exp * (s0 + (s1 - s0) * t) * (0.9 + r() * 0.2);
    const presales = PRESALES.some((o) => o.providerId === providerId) && w < 6 ? 200 * Math.round(r() * 3) : 0;
    const guests = Math.round(exp / Math.max(60, base / 120));
    weeks.push({ label: fmtDate(start, 'd MMM'), start, experiences: exp, products, subscriptions: subs, presales, guests, subscribers });
  }
  // Layer the live demo activity on top
  const end = addDaysISO(todayISO, 0);
  for (const b of store.bookings.filter((x) => x.providerId === providerId && x.status !== 'cancelled' && x.source !== 'seed')) {
    const idx = weekIndex(weeks, b.createdAt.slice(0, 10), end);
    if (idx >= 0) {
      weeks[idx].experiences += b.price.total;
      weeks[idx].guests += b.guests.adults + b.guests.children;
    }
  }
  for (const o of store.orders.filter((x) => x.providerIds.includes(providerId) && x.source !== 'seed')) {
    const idx = weekIndex(weeks, o.createdAt.slice(0, 10), end);
    if (idx < 0) continue;
    const amount = o.lines.filter((l) => PRODUCT_BY_ID[l.productId]?.providerId === providerId).reduce((s, l) => s + l.unitPrice * l.qty, 0);
    if (o.source === 'subscription') weeks[idx].subscriptions += amount;
    else weeks[idx].products += amount;
  }
  const liveSubs = store.subscriptions.filter((s) => s.providerId === providerId && s.status === 'active').length;
  weeks[weeks.length - 1].subscribers += liveSubs;
  for (const v of store.vouchers.filter((x) => x.providerId === providerId)) {
    const idx = weekIndex(weeks, v.purchasedAt, end);
    if (idx >= 0) weeks[idx].presales += v.pricePaid;
  }
  return weeks.map((w) => ({ ...w, experiences: round(w.experiences), products: round(w.products), subscriptions: round(w.subscriptions), presales: round(w.presales) }));
}

function weekIndex(weeks: HostWeek[], iso: string, end: string) {
  if (daysBetween(iso, end) < 0) return weeks.length - 1;
  for (let i = weeks.length - 1; i >= 0; i--) if (daysBetween(weeks[i].start, iso) >= 0) return i;
  return -1;
}

/* ------------------------------ Upcoming slots ------------------------------ */

export interface UpcomingSlot {
  key: string;
  date: string;
  time?: string;
  experienceId: string;
  booked: number;
  capacity: number;
  revenue: number;
  demo: number;
}

export function upcomingSlots(providerId: string, ctx: AvailabilityCtx, days = 14): UpcomingSlot[] {
  const out: UpcomingSlot[] = [];
  for (const e of experiencesForProvider(providerId)) {
    for (const d of rangeISO(ctx.todayISO, days)) {
      for (const s of getSlots(e, d, { ...ctx, holds: {} })) {
        if (!s.booked) continue;
        const perUnit = e.priceUnit === 'per_booking' ? e.price / Math.max(1, e.includedGuests ?? 1) : e.price;
        out.push({ key: s.key, date: d, time: s.time, experienceId: e.id, booked: s.booked, capacity: s.capacity, revenue: e.priceUnit === 'per_night' ? s.booked * e.price : s.booked * perUnit * 0.92, demo: ctx.extra[s.key] ?? 0 });
      }
    }
  }
  return out.sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));
}

export function weekdayUtilisation(providerId: string, ctx: AvailabilityCtx) {
  const buckets = { weekday: { b: 0, c: 0 }, weekend: { b: 0, c: 0 } };
  for (const e of experiencesForProvider(providerId)) {
    if (e.priceUnit === 'per_night') continue;
    for (const d of rangeISO(ctx.todayISO, 14)) {
      const dow = new Date(d).getDay();
      const k = dow === 5 || dow === 6 || dow === 0 ? 'weekend' : 'weekday';
      for (const s of getSlots(e, d, { ...ctx, holds: {} })) {
        buckets[k].b += s.booked;
        buckets[k].c += s.capacity;
      }
    }
  }
  return { weekday: buckets.weekday.c ? buckets.weekday.b / buckets.weekday.c : 0, weekend: buckets.weekend.c ? buckets.weekend.b / buckets.weekend.c : 0 };
}

/* ------------------------------ Customers (CRM) ------------------------------ */

const FIRST = ['Fatma', 'Ahmed', 'Sara', 'James', 'Noura', 'Omar', 'Priya', 'Lena', 'Yousef', 'Mariam', 'Hassan', 'Chloe', 'Arjun', 'Hessa', 'Daniel', 'Aisha', 'Tom', 'Reem', 'Kenji', 'Layal', 'Bilal', 'Sofia', 'Rashid', 'Emma', 'Zainab', 'Lucas', 'Huda', 'Ivan', 'Maha', 'Ali'];
const LAST = 'ABCDEFGHJKLMNOPRSTW';
const ORIGINS = ['Resident · Sharjah', 'Resident · Dubai', 'Resident · Ajman', 'Visitor · UK', 'Visitor · Germany', 'Resident · Abu Dhabi', 'Visitor · India', 'Visitor · France', 'Resident · Sharjah', 'Visitor · Saudi Arabia'];

export interface CustomerRow {
  name: string;
  origin: string;
  firstVisit: string;
  visits: number;
  spentExperiences: number;
  spentProducts: number;
  subscriber: boolean;
  lastActivity: string;
  boughtAfterVisit: boolean;
  offerSent: boolean;
}

export function hostCustomers(providerId: string, todayISO: string, followUps: string[]): CustomerRow[] {
  const r = seeded(`crm:${providerId}`);
  const out: CustomerRow[] = [];
  const subs = SUB_BASE[providerId]?.[1] ?? 0;
  for (let i = 0; i < 36; i++) {
    const daysAgo = Math.floor(r() * 80) + 1;
    const visits = 1 + (r() < 0.28 ? 1 : 0) + (r() < 0.08 ? 1 : 0);
    const bought = r() < 0.36;
    const subscriber = i < subs && bought;
    out.push({
      name: `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}.`,
      origin: ORIGINS[Math.floor(r() * ORIGINS.length)],
      firstVisit: addDaysISO(todayISO, -daysAgo),
      visits,
      spentExperiences: Math.round((150 + r() * 600) * visits),
      spentProducts: bought ? Math.round(60 + r() * (subscriber ? 900 : 300)) : 0,
      subscriber,
      lastActivity: addDaysISO(todayISO, -Math.floor(r() * Math.min(daysAgo, 20))),
      boughtAfterVisit: bought,
      offerSent: bought || followUps.includes(`post-visit:${providerId}`) || r() < 0.3,
    });
  }
  return out.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

/* ------------------------------ Earnings ------------------------------ */

export interface Earnings {
  gross: { experiences: number; products: number; subscriptions: number; presalesRedeemed: number };
  commission: number;
  processing: number;
  variableCosts: number;
  fixedCosts: number;
  proPlan: number;
  net: number;
  grossTotal: number;
  presaleHeld: number;
  presaleObligations: { units: number; value: number };
}

export function earnings30(providerId: string, weeks: HostWeek[], store: StoreSlice, presaleSoldExtra: Record<string, number>): Earnings {
  const last4 = weeks.slice(-4);
  const sum = (k: keyof HostWeek) => last4.reduce((s, w) => s + (w[k] as number), 0);
  const experiences = sum('experiences');
  const products = sum('products');
  const subscriptions = sum('subscriptions');
  const offers = PRESALES.filter((o) => o.providerId === providerId);
  const sold = offers.reduce((s, o) => s + o.soldUnits + (presaleSoldExtra[o.id] ?? 0), 0);
  const redeemed = offers.reduce((s, o) => s + o.redeemedUnits, 0) + store.vouchers.filter((v) => v.providerId === providerId && v.status === 'redeemed').length;
  const presalesRedeemed = offers.length ? redeemed * offers[0].presalePrice : 0;
  const outstandingUnits = Math.max(0, sold - redeemed);
  const presaleHeld = offers.length ? outstandingUnits * offers[0].presalePrice : 0;
  const commission = experiences * ECONOMICS.experienceCommission + (products + subscriptions) * ECONOMICS.productCommission + presalesRedeemed * ECONOMICS.presaleCommission;
  const grossTotal = experiences + products + subscriptions + presalesRedeemed;
  const processing = grossTotal * ECONOMICS.paymentProcessing;
  const cat = PROVIDER_BY_ID[providerId].categoryId;
  const variableCosts = experiences * FARM_COSTS.experienceVariableCostShare + (products + subscriptions) * FARM_COSTS.produceCostShare + (cat === 'farm' ? (subscriptions / 120) * FARM_COSTS.deliveryPerBox : 0);
  const fixedCosts = FARM_COSTS.labourPerWeek * 4.3 * (cat === 'farm' ? 1 : 0.6);
  const proPlan = ECONOMICS.proPlanMonthly;
  const net = grossTotal - commission - processing - variableCosts - fixedCosts - proPlan;
  return {
    gross: { experiences, products, subscriptions, presalesRedeemed },
    commission,
    processing,
    variableCosts,
    fixedCosts,
    proPlan,
    net,
    grossTotal,
    presaleHeld,
    presaleObligations: { units: outstandingUnits, value: offers.length ? outstandingUnits * offers[0].regularPrice : 0 },
  };
}

export function experienceLabel(id: string) {
  return EXPERIENCE_BY_ID[id]?.title ?? id;
}
