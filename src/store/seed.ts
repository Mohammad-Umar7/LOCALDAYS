import type { Booking, Order, PassportStamp, SignatureBlend } from '@/data/types';
import { EXPERIENCE_BY_ID, PRODUCTS, PROVIDER_BY_ID } from '@/data/catalog';
import { priceExperience, productUnitPrice } from '@/services/pricing';
import { getSlots, hasSpace, slotKey } from '@/services/availability';
import { addDaysISO } from '@/lib/dates';

export interface DemoUser {
  id: string;
  name: string;
  firstName: string;
  email: string;
  phone: string;
  kind: 'resident' | 'visitor';
  city: string;
  since: string;
}

export const DEMO_USER: DemoUser = {
  id: 'u-layla',
  name: 'Layla Haddad',
  firstName: 'Layla',
  email: 'layla.haddad@example.com',
  phone: '+971 50 000 0000',
  kind: 'resident',
  city: 'Sharjah',
  since: '2026',
};

/** A believable history for the demo customer, relative to "today". */
export function seedCustomerHistory(todayISO: string) {
  const customer = { name: DEMO_USER.name, email: DEMO_USER.email, phone: DEMO_USER.phone, userId: DEMO_USER.id };

  const fragExp = EXPERIENCE_BY_ID['ol-signature'];
  const potExp = EXPERIENCE_BY_ID['fh-mug'];
  const fragDate = addDaysISO(todayISO, -24);
  const potDate = addDaysISO(todayISO, -41);

  const bookings: Booking[] = [
    {
      ref: 'LD-FRG-7Q2KD',
      createdAt: addDaysISO(todayISO, -30),
      customer,
      experienceId: fragExp.id,
      providerId: fragExp.providerId,
      categoryId: fragExp.categoryId,
      date: fragDate,
      time: '16:00',
      guests: { adults: 1, children: 0 },
      addOnIds: [],
      price: priceExperience(fragExp, { guests: { adults: 1, children: 0 } }),
      status: 'completed',
      checkInCode: '4821',
      payment: { method: 'card', label: 'Visa •••• 4242 (demo)', paidAt: addDaysISO(todayISO, -30) },
      source: 'seed',
      completedAt: fragDate,
    },
    {
      ref: 'LD-POT-3MZ8P',
      createdAt: addDaysISO(todayISO, -45),
      customer,
      experienceId: potExp.id,
      providerId: potExp.providerId,
      categoryId: potExp.categoryId,
      date: potDate,
      time: '11:00',
      guests: { adults: 2, children: 0 },
      addOnIds: [],
      price: priceExperience(potExp, { guests: { adults: 2, children: 0 } }),
      status: 'completed',
      checkInCode: '1937',
      payment: { method: 'apple', label: 'Apple Pay (demo)', paidAt: addDaysISO(todayISO, -45) },
      source: 'seed',
      completedAt: potDate,
    },
  ];

  const stamps: PassportStamp[] = bookings.map((b) => ({
    id: `st-${b.ref}`,
    categoryId: b.categoryId,
    providerId: b.providerId,
    experienceId: b.experienceId,
    bookingRef: b.ref,
    regionId: PROVIDER_BY_ID[b.providerId].regionId,
    earnedAt: b.completedAt!,
  }));

  const blends: SignatureBlend[] = [
    {
      id: 'bl-layla-1',
      providerId: 'oud-lane',
      formulaId: 'OL-P-07',
      name: 'Layla’s Desert Rose',
      createdAt: fragDate,
      bookingRef: 'LD-FRG-7Q2KD',
      accords: [
        { noteId: 'saffron', share: 12 },
        { noteId: 'rose', share: 38 },
        { noteId: 'oud', share: 14 },
        { noteId: 'sandalwood', share: 18 },
        { noteId: 'musk', share: 18 },
      ],
      approvedBy: 'Fatima · Oud Lane Atelier',
      consent: true,
      reference: 'OL-SB-0142',
    },
  ];

  const orders: Order[] = [
    {
      ref: 'LD-ORD-9TQ4L',
      createdAt: addDaysISO(todayISO, -38),
      customer,
      lines: [{ productId: 'fh-matching', qty: 1, unitPrice: 150 }],
      total: 150,
      status: 'preparing',
      deliveryDate: addDaysISO(todayISO, 4),
      isReorder: false,
      providerIds: ['fakhar-house'],
      discount: 0,
      source: 'seed',
    },
  ];

  return { bookings, stamps, blends, orders };
}

/* ------------------------------------------------------------------------- */
/*  Other (fictional) Fadhal customers, so a host dashboard opened cold    */
/*  shows a living business: a few upcoming visits to check in and recent    */
/*  shop orders. Marked source 'seed': they never touch the demo customer's  */
/*  account and are excluded from the synthetic 12-week history totals.       */
/* ------------------------------------------------------------------------- */

const COMMUNITY = [
  { name: 'Omar Khalid', email: 'omar.k@example.com' },
  { name: 'Priya Raman', email: 'priya.r@example.com' },
  { name: 'Daniel Moreau', email: 'd.moreau@example.com' },
  { name: 'Aisha Rahman', email: 'aisha.rahman@example.com' },
  { name: 'Chen Wei', email: 'chen.wei@example.com' },
  { name: 'Noura Saeed', email: 'noura.s@example.com' },
  { name: 'Tom Becker', email: 'tom.becker@example.com' },
  { name: 'Mariam Yousef', email: 'mariam.y@example.com' },
];

const VISITS: { exp: string; day: number; who: number; adults: number; children: number; code: string }[] = [
  { exp: 'ghaf-harvest', day: 0, who: 1, adults: 2, children: 0, code: '3086' },
  { exp: 'ghaf-dinner', day: 3, who: 2, adults: 4, children: 0, code: '5512' },
  { exp: 'ghaf-family', day: 6, who: 3, adults: 2, children: 2, code: '7240' },
  { exp: 'ghaf-stay', day: 5, who: 6, adults: 2, children: 1, code: '9154' },
  { exp: 'wh-tasting', day: 1, who: 4, adults: 2, children: 0, code: '2675' },
  { exp: 'fh-mug', day: 2, who: 5, adults: 1, children: 0, code: '6031' },
  { exp: 'hh-heritage', day: 4, who: 7, adults: 3, children: 0, code: '4418' },
  { exp: 'ol-bukhoor', day: 2, who: 0, adults: 2, children: 0, code: '8827' },
];

const SHOP: { provider: string; daysAgo: number; who: number; picks: number[]; status: Order['status'] }[] = [
  { provider: 'ghaf-grove', daysAgo: 0, who: 4, picks: [2, 4], status: 'placed' },
  { provider: 'ghaf-grove', daysAgo: 1, who: 6, picks: [3], status: 'preparing' },
  { provider: 'ghaf-grove', daysAgo: 3, who: 0, picks: [2, 5], status: 'out_for_delivery' },
  { provider: 'ghaf-grove', daysAgo: 6, who: 2, picks: [4], status: 'delivered' },
  { provider: 'ghaf-grove', daysAgo: 9, who: 7, picks: [2], status: 'delivered' },
  { provider: 'wadi-hives', daysAgo: 1, who: 1, picks: [0, 1], status: 'preparing' },
  { provider: 'wadi-hives', daysAgo: 5, who: 3, picks: [2], status: 'delivered' },
  { provider: 'fakhar-house', daysAgo: 2, who: 5, picks: [0], status: 'preparing' },
  { provider: 'oud-lane', daysAgo: 4, who: 2, picks: [2, 3], status: 'out_for_delivery' },
  { provider: 'hamriyah-harbour', daysAgo: 3, who: 7, picks: [2], status: 'delivered' },
];

export function seedCommunity(todayISO: string) {
  const ctx = { todayISO, extra: {} as Record<string, number>, holds: {} as Record<string, number> };
  const bookings: Booking[] = [];
  VISITS.forEach((v, i) => {
    const exp = EXPERIENCE_BY_ID[v.exp];
    if (!exp) return;
    const c = COMMUNITY[v.who];
    const guests = { adults: v.adults, children: exp.familyFriendly ? v.children : 0 };
    const n = guests.adults + guests.children;
    // first open date from the planned day onwards
    for (let d = v.day; d < v.day + 10; d++) {
      const date = addDaysISO(todayISO, d);
      if (exp.priceUnit === 'per_night') {
        if (!hasSpace(exp, date, 1, ctx, 1)) continue;
        ctx.extra[slotKey(exp.id, date)] = (ctx.extra[slotKey(exp.id, date)] ?? 0) + 1;
        bookings.push(makeVisit(exp.id, date, undefined, guests, c, v.code, todayISO, i, 1));
        return;
      }
      const slot = getSlots(exp, date, ctx).find((s) => s.time && s.remaining >= n + 2);
      if (!slot) continue;
      const k = slotKey(exp.id, date, slot.time);
      ctx.extra[k] = (ctx.extra[k] ?? 0) + n;
      bookings.push(makeVisit(exp.id, date, slot.time, guests, c, v.code, todayISO, i));
      return;
    }
  });

  const orders: Order[] = [];
  SHOP.forEach((o, i) => {
    const items = PRODUCTS.filter((p) => p.providerId === o.provider && p.kind !== 'subscription_box' && !p.requiresBlend);
    const lines = [...new Set(o.picks.map((k) => items[k % Math.max(1, items.length)]).filter(Boolean))].map((p, j) => {
      const variantId = p.variants?.[0]?.id;
      return { productId: p.id, variantId, qty: j === 0 && i % 3 === 0 ? 2 : 1, unitPrice: productUnitPrice(p, variantId, false) };
    });
    if (!lines.length) return;
    const created = addDaysISO(todayISO, -o.daysAgo);
    orders.push({
      ref: `LD-ORD-C${String(i + 1).padStart(2, '0')}${o.provider.slice(0, 2).toUpperCase()}`,
      createdAt: created,
      customer: COMMUNITY[o.who],
      lines,
      total: lines.reduce((s, l) => s + l.qty * l.unitPrice, 0),
      status: o.status,
      deliveryDate: addDaysISO(created, 3),
      isReorder: i % 2 === 0,
      providerIds: [o.provider],
      discount: 0,
      source: 'seed',
    });
  });
  return { bookings, orders, slotExtra: ctx.extra };
}

function makeVisit(
  experienceId: string,
  date: string,
  time: string | undefined,
  guests: { adults: number; children: number },
  customer: { name: string; email: string },
  code: string,
  todayISO: string,
  i: number,
  nights?: number,
): Booking {
  const exp = EXPERIENCE_BY_ID[experienceId];
  const created = addDaysISO(todayISO, -(3 + i));
  return {
    ref: `LD-${exp.categoryId.slice(0, 3).toUpperCase()}-C${String(i + 1).padStart(3, '0')}`,
    createdAt: created,
    customer,
    experienceId,
    providerId: exp.providerId,
    categoryId: exp.categoryId,
    date,
    time,
    nights,
    guests,
    addOnIds: [],
    price: priceExperience(exp, { guests, nights }),
    status: 'confirmed',
    checkInCode: code,
    payment: { method: 'card', label: 'Card (demo)', paidAt: created },
    source: 'seed',
  };
}
