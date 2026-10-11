import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ECONOMICS } from '@/config/economics';
import type {
  Booking,
  CartItem,
  Customer,
  Frequency,
  Guests,
  Order,
  PassportStamp,
  PresaleVoucher,
  SignatureBlend,
  Subscription,
} from '@/data/types';
import { EXPERIENCE_BY_ID, PRESALE_BY_ID, PRODUCT_BY_ID, PROVIDER_BY_ID } from '@/data/catalog';
import { FORMULA_BY_ID } from '@/data/catalog/fragrance';
import { REWARD_BY_ID } from '@/data/passport';
import { slotKey, hasSpace, type AvailabilityCtx } from '@/services/availability';
import { priceExperience, productUnitPrice } from '@/services/pricing';
import { addDaysISO, daysBetween, demoTodayISO, rangeISO } from '@/lib/dates';
import { makeCode, makeRef, round, uid } from '@/lib/utils';
import { DEMO_USER, seedCommunity, seedCustomerHistory, type DemoUser } from './seed';

export type PipelineStage = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface HostState {
  activeProviderId: string;
  appliedRecs: string[];
  forecastOverrides: Record<string, number>;
  followUps: string[];
  pipeline: Record<string, PipelineStage>;
  presalePaused: string[];
}

export interface CheckoutResult {
  bookings: Booking[];
  order?: Order;
  subscriptions: Subscription[];
  vouchers: PresaleVoucher[];
  total: number;
}

export interface AppState {
  dayOffset: number;
  user: DemoUser | null;
  cart: CartItem[];
  bookings: Booking[];
  orders: Order[];
  subscriptions: Subscription[];
  vouchers: PresaleVoucher[];
  stamps: PassportStamp[];
  blends: SignatureBlend[];
  saved: string[];
  usedRewards: string[];
  slotExtra: Record<string, number>;
  stockDelta: Record<string, number>;
  presaleSold: Record<string, number>;
  host: HostState;
  lastStamp: PassportStamp | null;

  // selectors
  todayISO: () => string;
  availabilityCtx: () => AvailabilityCtx;

  // session
  signIn: () => void;
  signInAs: (u: { name: string; email: string }) => void;
  signOut: () => void;

  // cart
  addExperienceToCart: (i: {
    experienceId: string;
    date: string;
    time?: string;
    nights?: number;
    guests: Guests;
    addOnIds: string[];
    voucherId?: string;
    rewardId?: string;
    source?: 'web' | 'composer';
  }) => { ok: boolean; reason?: string; id?: string };
  addProductToCart: (productId: string, opts?: { qty?: number; variantId?: string; subscribe?: Frequency; rewardId?: string }) => void;
  addPresaleToCart: (offerId: string, qty?: number) => void;
  updateCartQty: (id: string, qty: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  pruneExpiredHolds: () => void;
  checkout: (customer: Customer, payment: { method: string; label: string }) => CheckoutResult;

  // post-booking
  completeBooking: (ref: string) => PassportStamp | null;
  cancelBooking: (ref: string) => void;
  clearLastStamp: () => void;

  // commerce
  toggleSaved: (id: string) => void;
  setSubscriptionStatus: (id: string, status: Subscription['status']) => void;
  setSubscriptionFrequency: (id: string, f: Frequency) => void;
  skipNextDelivery: (id: string) => void;
  reorder: (orderRef: string) => void;
  saveBlend: (b: Omit<SignatureBlend, 'id' | 'reference' | 'createdAt'>) => SignatureBlend;

  // demo clock
  advanceDays: (n: number) => { deliveries: number; revenue: number };
  resetDemo: () => void;

  // host
  setActiveProvider: (id: string) => void;
  applyRecommendation: (id: string) => void;
  undoRecommendation: (id: string) => void;
  setForecastOverride: (cropId: string, kg: number | null) => void;
  sendFollowUp: (id: string) => void;
  setPipelineStage: (orderId: string, stage: PipelineStage) => void;
  togglePresalePaused: (offerId: string) => void;
}

const FREQ_DAYS: Record<Frequency, number> = { weekly: 7, fortnightly: 14, monthly: 30 };

function initialData(offset = 0) {
  const today = demoTodayISO(offset);
  const seed = seedCustomerHistory(today);
  const community = seedCommunity(today);
  return {
    dayOffset: offset,
    user: DEMO_USER as DemoUser | null,
    cart: [] as CartItem[],
    bookings: [...seed.bookings, ...community.bookings],
    orders: [...seed.orders, ...community.orders],
    subscriptions: [] as Subscription[],
    vouchers: [] as PresaleVoucher[],
    stamps: seed.stamps,
    blends: seed.blends,
    saved: ['ghaf-grove', 'wadi-hives'],
    usedRewards: [] as string[],
    slotExtra: community.slotExtra as Record<string, number>,
    stockDelta: {} as Record<string, number>,
    presaleSold: {} as Record<string, number>,
    lastStamp: null as PassportStamp | null,
    host: {
      activeProviderId: 'ghaf-grove',
      appliedRecs: [],
      forecastOverrides: {},
      followUps: [],
      pipeline: {},
      presalePaused: [],
    } as HostState,
  };
}

export function holdsFromCart(cart: CartItem[], excludeId?: string) {
  const holds: Record<string, number> = {};
  const now = Date.now();
  for (const c of cart) {
    if (c.type !== 'experience' || c.id === excludeId) continue;
    if (new Date(c.holdExpiresAt).getTime() < now) continue;
    const exp = EXPERIENCE_BY_ID[c.experienceId];
    if (!exp) continue;
    if (exp.priceUnit === 'per_night') {
      for (const d of rangeISO(c.date, c.nights ?? 1)) holds[slotKey(exp.id, d)] = (holds[slotKey(exp.id, d)] ?? 0) + 1;
    } else {
      const k = slotKey(exp.id, c.date, c.time);
      holds[k] = (holds[k] ?? 0) + c.guests.adults + c.guests.children;
    }
  }
  return holds;
}

const PREFIX: Record<string, string> = { farm: 'FRM', honey: 'HNY', pottery: 'POT', coastal: 'SEA', fragrance: 'FRG' };

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialData(),

      todayISO: () => demoTodayISO(get().dayOffset),
      availabilityCtx: () => ({ todayISO: get().todayISO(), extra: get().slotExtra, holds: holdsFromCart(get().cart) }),

      signIn: () => set({ user: DEMO_USER, saved: adoptGuestSaves(get().saved, DEMO_USER.email) }),
      signInAs: ({ name, email }) =>
        set({
          user: { ...DEMO_USER, id: `u-${email.toLowerCase()}`, name, firstName: name.split(" ")[0] || name, email, phone: "" },
          saved: adoptGuestSaves(get().saved, email),
        }),
      signOut: () => set({ user: null }),

      addExperienceToCart: (i) => {
        const exp = EXPERIENCE_BY_ID[i.experienceId];
        if (!exp) return { ok: false, reason: 'Experience not found' };
        const guests = i.guests.adults + i.guests.children;
        const ctx: AvailabilityCtx = { todayISO: get().todayISO(), extra: get().slotExtra, holds: holdsFromCart(get().cart) };
        if (exp.priceUnit === 'per_night') {
          if (!hasSpace(exp, i.date, 1, ctx, i.nights ?? 1)) return { ok: false, reason: 'Those nights were just taken. Try other dates.' };
        } else {
          const slotOk = hasSpace(exp, i.date, guests, ctx);
          if (!slotOk) return { ok: false, reason: 'Not enough space left in that slot.' };
        }
        const id = uid('ci');
        const item: CartItem = {
          type: 'experience',
          id,
          experienceId: exp.id,
          date: i.date,
          time: i.time,
          nights: i.nights,
          guests: i.guests,
          addOnIds: i.addOnIds,
          voucherId: i.voucherId,
          rewardId: i.rewardId,
          source: i.source ?? 'web',
          holdExpiresAt: new Date(Date.now() + ECONOMICS.holdMinutes * 60_000).toISOString(),
        };
        set({ cart: [...get().cart, item] });
        return { ok: true, id };
      },

      addProductToCart: (productId, opts = {}) => {
        const { qty = 1, variantId, subscribe, rewardId } = opts;
        const cart = [...get().cart];
        const existing = cart.find(
          (c) => c.type === 'product' && c.productId === productId && c.variantId === variantId && c.subscribe === subscribe,
        );
        if (existing && existing.type === 'product') {
          existing.qty += qty;
          set({ cart });
        } else {
          set({ cart: [...cart, { type: 'product', id: uid('ci'), productId, qty, variantId, subscribe, rewardId }] });
        }
      },

      addPresaleToCart: (offerId, qty = 1) => {
        const cart = [...get().cart];
        const existing = cart.find((c) => c.type === 'presale' && c.offerId === offerId);
        if (existing && existing.type === 'presale') {
          existing.qty += qty;
          set({ cart });
        } else set({ cart: [...cart, { type: 'presale', id: uid('ci'), offerId, qty }] });
      },

      updateCartQty: (id, qty) =>
        set({
          cart: get()
            .cart.map((c) => (c.id === id && (c.type === 'product' || c.type === 'presale') ? { ...c, qty: Math.max(1, qty) } : c))
            .filter(Boolean),
        }),
      removeFromCart: (id) => set({ cart: get().cart.filter((c) => c.id !== id) }),
      clearCart: () => set({ cart: [] }),
      pruneExpiredHolds: () => {
        const now = Date.now();
        const cart = get().cart.filter((c) => c.type !== 'experience' || new Date(c.holdExpiresAt).getTime() > now);
        if (cart.length !== get().cart.length) set({ cart });
      },

      checkout: (customer, payment) => {
        const s = get();
        const today = s.todayISO();
        const nowISO = new Date().toISOString();
        const bookings: Booking[] = [];
        const subscriptions: Subscription[] = [];
        const vouchers: PresaleVoucher[] = [];
        const slotExtra = { ...s.slotExtra };
        const stockDelta = { ...s.stockDelta };
        const presaleSold = { ...s.presaleSold };
        let vouchersState = [...s.vouchers];
        const usedRewards = [...s.usedRewards];
        const orderLines: Order['lines'] = [];
        let orderTotal = 0;
        let orderDiscount = 0;
        let orderRewardId: string | undefined;

        for (const item of s.cart) {
          if (item.type === 'experience') {
            const exp = EXPERIENCE_BY_ID[item.experienceId];
            if (!exp) continue;
            const voucher = item.voucherId ? vouchersState.find((v) => v.id === item.voucherId) ?? null : null;
            const reward = item.rewardId ? REWARD_BY_ID[item.rewardId] ?? null : null;
            const price = priceExperience(exp, { guests: item.guests, nights: item.nights, addOnIds: item.addOnIds, voucher, reward });
            const ref = makeRef(`LD-${PREFIX[exp.categoryId]}`);
            bookings.push({
              ref,
              createdAt: nowISO,
              customer,
              experienceId: exp.id,
              providerId: exp.providerId,
              categoryId: exp.categoryId,
              date: item.date,
              time: item.time,
              nights: item.nights,
              guests: item.guests,
              addOnIds: item.addOnIds,
              price,
              status: 'confirmed',
              checkInCode: makeCode(),
              payment: { ...payment, paidAt: nowISO },
              voucherId: voucher?.id,
              rewardId: reward?.id,
              source: item.source ?? 'web',
            });
            if (exp.priceUnit === 'per_night') {
              for (const d of rangeISO(item.date, item.nights ?? 1)) slotExtra[slotKey(exp.id, d)] = (slotExtra[slotKey(exp.id, d)] ?? 0) + 1;
            } else {
              const k = slotKey(exp.id, item.date, item.time);
              slotExtra[k] = (slotExtra[k] ?? 0) + item.guests.adults + item.guests.children;
            }
            if (voucher) vouchersState = vouchersState.map((v) => (v.id === voucher.id ? { ...v, status: 'redeemed', redeemedBookingRef: ref } : v));
            if (reward) usedRewards.push(ownKey(customer.email, reward.id));
          } else if (item.type === 'product') {
            const p = PRODUCT_BY_ID[item.productId];
            if (!p) continue;
            const unit = productUnitPrice(p, item.variantId, !!item.subscribe);
            if (item.subscribe && p.subscription) {
              const first = addDaysISO(today, 3);
              const reward = item.rewardId ? REWARD_BY_ID[item.rewardId] : undefined;
              const promo =
                reward && reward.value.type === 'percent'
                  ? { price: round(unit * (1 - (reward.value.amount ?? 0) / 100)), remaining: 4, rewardId: reward.id }
                  : undefined;
              if (promo) usedRewards.push(ownKey(customer.email, promo.rewardId));
              subscriptions.push({
                promo,
                id: uid('sub'),
                productId: p.id,
                providerId: p.providerId,
                frequency: item.subscribe,
                price: unit,
                startedAt: today,
                nextDelivery: first,
                status: 'active',
                deliveries: 0,
                customer,
                sourceBookingRef: [...s.bookings].reverse().find((b) => b.providerId === p.providerId && b.customer.email === customer.email)?.ref,
              });
            } else {
              orderLines.push({ productId: p.id, variantId: item.variantId, qty: item.qty, unitPrice: unit });
              orderTotal += unit * item.qty;
              stockDelta[p.id] = (stockDelta[p.id] ?? 0) - item.qty;
              if (item.rewardId) {
                const r = REWARD_BY_ID[item.rewardId];
                if (r?.value.type === 'percent') orderDiscount += round((unit * item.qty * (r.value.amount ?? 0)) / 100);
                if (r?.value.type === 'fixed') orderDiscount += Math.min(unit * item.qty, r.value.amount ?? 0);
                orderRewardId = item.rewardId;
                usedRewards.push(ownKey(customer.email, item.rewardId));
              }
            }
          } else if (item.type === 'presale') {
            const offer = PRESALE_BY_ID[item.offerId];
            if (!offer) continue;
            for (let q = 0; q < item.qty; q++) {
              vouchers.push({
                id: uid('vch'),
                offerId: offer.id,
                providerId: offer.providerId,
                experienceId: offer.experienceId,
                purchasedAt: today,
                pricePaid: offer.presalePrice,
                regularPrice: offer.regularPrice,
                expiresAt: addDaysISO(today, offer.expiresInDays),
                status: 'active',
                ownerEmail: customer.email.toLowerCase(),
              });
            }
            presaleSold[offer.id] = (presaleSold[offer.id] ?? 0) + item.qty;
          }
        }

        let order: Order | undefined;
        if (orderLines.length) {
          order = {
            ref: makeRef('LD-ORD'),
            createdAt: nowISO,
            customer,
            lines: orderLines,
            total: Math.max(0, orderTotal - orderDiscount),
            discount: orderDiscount,
            status: 'placed',
            deliveryDate: addDaysISO(today, 2),
            isReorder: s.orders.some((o) => o.lines.some((l) => orderLines.some((x) => x.productId === l.productId))),
            providerIds: [...new Set(orderLines.map((l) => PRODUCT_BY_ID[l.productId].providerId))],
            rewardId: orderRewardId,
            source: 'web',
          };
        }

        const total =
          bookings.reduce((a, b) => a + b.price.total, 0) +
          (order?.total ?? 0) +
          subscriptions.reduce((a, sub) => a + (sub.promo ? sub.promo.price : sub.price), 0) +
          vouchers.reduce((a, v) => a + v.pricePaid, 0);

        // First subscription box is charged at checkout and recorded as an order
        const subOrders: Order[] = subscriptions.map((sub) => ({
          ref: makeRef('LD-SUB'),
          createdAt: nowISO,
          customer,
          lines: [{ productId: sub.productId, qty: 1, unitPrice: sub.price }],
          total: sub.promo ? sub.promo.price : sub.price,
          discount: sub.promo ? sub.price - sub.promo.price : 0,
          status: 'placed',
          deliveryDate: sub.nextDelivery,
          isReorder: false,
          providerIds: [sub.providerId],
          source: 'subscription',
        }));
        const subsWithFirst = subscriptions.map((sub) => ({
          ...sub,
          deliveries: 1,
          nextDelivery: addDaysISO(sub.nextDelivery, FREQ_DAYS[sub.frequency]),
          promo: sub.promo ? { ...sub.promo, remaining: sub.promo.remaining - 1 } : undefined,
        }));

        set({
          bookings: [...s.bookings, ...bookings],
          orders: [...s.orders, ...(order ? [order] : []), ...subOrders],
          subscriptions: [...s.subscriptions, ...subsWithFirst],
          vouchers: [...vouchersState, ...vouchers],
          slotExtra,
          stockDelta,
          presaleSold,
          usedRewards,
          cart: [],
        });
        return { bookings, order, subscriptions: subsWithFirst, vouchers, total };
      },

      completeBooking: (ref) => {
        const s = get();
        const b = s.bookings.find((x) => x.ref === ref);
        if (!b || b.status === 'completed') return null;
        const exp = EXPERIENCE_BY_ID[b.experienceId];
        const today = s.todayISO();
        const bookings = s.bookings.map((x) => (x.ref === ref ? { ...x, status: 'completed' as const, completedAt: today } : x));
        let stamp: PassportStamp | null = null;
        const stamps = [...s.stamps];
        if (exp?.stampEligible && !stamps.some((st) => st.bookingRef === ref)) {
          stamp = {
            id: `st-${ref}`,
            categoryId: b.categoryId,
            providerId: b.providerId,
            experienceId: b.experienceId,
            bookingRef: ref,
            regionId: PROVIDER_BY_ID[b.providerId].regionId,
            earnedAt: today,
          };
          stamps.push(stamp);
        }
        // Fragrance workshops: the maker saves the approved formula with the customer's consent
        let blends = s.blends;
        if (['ol-signature', 'ol-bukhoor', 'ss-signature', 'mh-pair'].includes(b.experienceId) && !s.blends.some((x) => x.bookingRef === ref)) {
          const formulaId =
            b.experienceId === 'ol-bukhoor' ? 'OL-B-03' : b.experienceId === 'ss-signature' ? 'SS-P-04' : b.experienceId === 'mh-pair' ? 'MH-B-01' : 'OL-P-12';
          const f = FORMULA_BY_ID[formulaId];
          blends = [
            ...s.blends,
            {
              id: uid('bl'),
              providerId: f.providerId,
              formulaId,
              name: `${b.customer.name.split(' ')[0]}’s ${f.name}`,
              createdAt: today,
              bookingRef: ref,
              accords: f.accords.map((a) => ({ noteId: a.noteId, share: a.default })),
              approvedBy: `${PROVIDER_BY_ID[f.providerId].hostName} · ${PROVIDER_BY_ID[f.providerId].name}`,
              consent: true,
              reference: `${formulaId.split('-')[0]}-SB-${String(Math.floor(200 + Math.random() * 700)).padStart(4, '0')}`,
            },
          ];
        }
        set({ bookings, stamps, blends, lastStamp: stamp });
        return stamp;
      },

      cancelBooking: (ref) => {
        const s = get();
        const b = s.bookings.find((x) => x.ref === ref);
        if (!b || b.status !== 'confirmed') return;
        const exp = EXPERIENCE_BY_ID[b.experienceId];
        const slotExtra = { ...s.slotExtra };
        if (exp.priceUnit === 'per_night') {
          for (const d of rangeISO(b.date, b.nights ?? 1)) slotExtra[slotKey(exp.id, d)] = Math.max(0, (slotExtra[slotKey(exp.id, d)] ?? 0) - 1);
        } else {
          const k = slotKey(exp.id, b.date, b.time);
          slotExtra[k] = Math.max(0, (slotExtra[k] ?? 0) - (b.guests.adults + b.guests.children));
        }
        set({ bookings: s.bookings.map((x) => (x.ref === ref ? { ...x, status: 'cancelled' } : x)), slotExtra });
      },

      clearLastStamp: () => set({ lastStamp: null }),

      toggleSaved: (id) => {
        const owner = get().user?.email ?? GUEST;
        const saved = get().saved;
        const mine = (e: string) => {
          const [who, x] = ownedEntry(e);
          return who === owner && x === id;
        };
        set({ saved: saved.some(mine) ? saved.filter((e) => !mine(e)) : [...saved, ownKey(owner, id)] });
      },

      setSubscriptionStatus: (id, status) =>
        set({ subscriptions: get().subscriptions.map((s) => (s.id === id ? { ...s, status } : s)) }),
      setSubscriptionFrequency: (id, f) =>
        set({ subscriptions: get().subscriptions.map((s) => (s.id === id ? { ...s, frequency: f } : s)) }),
      skipNextDelivery: (id) =>
        set({
          subscriptions: get().subscriptions.map((s) => (s.id === id ? { ...s, nextDelivery: addDaysISO(s.nextDelivery, FREQ_DAYS[s.frequency]) } : s)),
        }),

      reorder: (orderRef) => {
        const o = get().orders.find((x) => x.ref === orderRef);
        if (!o) return;
        for (const l of o.lines) get().addProductToCart(l.productId, { qty: l.qty, variantId: l.variantId });
      },

      saveBlend: (b) => {
        const blend: SignatureBlend = {
          ...b,
          id: uid('bl'),
          createdAt: get().todayISO(),
          reference: `${b.formulaId.split('-')[0]}-SB-${String(Math.floor(200 + Math.random() * 700)).padStart(4, '0')}`,
        };
        set({ blends: [...get().blends, blend] });
        return blend;
      },

      advanceDays: (n) => {
        const s = get();
        const newOffset = s.dayOffset + n;
        const newToday = demoTodayISO(newOffset);
        let deliveries = 0;
        let revenue = 0;
        const newOrders: Order[] = [];
        const subscriptions = s.subscriptions.map((sub) => {
          if (sub.status !== 'active') return sub;
          let next = sub.nextDelivery;
          let count = sub.deliveries;
          let promo = sub.promo ? { ...sub.promo } : undefined;
          while (daysBetween(next, newToday) >= 0) {
            count += 1;
            deliveries += 1;
            const charged = promo && promo.remaining > 0 ? promo.price : sub.price;
            if (promo && promo.remaining > 0) promo.remaining -= 1;
            revenue += charged;
            newOrders.push({
              ref: makeRef('LD-SUB'),
              createdAt: next,
              customer: sub.customer,
              lines: [{ productId: sub.productId, qty: 1, unitPrice: charged }],
              total: charged,
              discount: sub.price - charged,
              status: 'delivered',
              deliveryDate: next,
              isReorder: true,
              providerIds: [sub.providerId],
              source: 'subscription',
            });
            next = addDaysISO(next, FREQ_DAYS[sub.frequency]);
          }
          return { ...sub, nextDelivery: next, deliveries: count, promo };
        });
        // Orders placed in the past are now delivered
        const orders = s.orders.map((o) => (daysBetween(o.deliveryDate, newToday) >= 0 ? { ...o, status: 'delivered' as const } : o));
        set({ dayOffset: newOffset, subscriptions, orders: [...orders, ...newOrders] });
        return { deliveries, revenue };
      },

      resetDemo: () => set({ ...initialData(0) }),

      setActiveProvider: (id) => set({ host: { ...get().host, activeProviderId: id } }),
      applyRecommendation: (id) => {
        const h = get().host;
        if (!h.appliedRecs.includes(id)) set({ host: { ...h, appliedRecs: [...h.appliedRecs, id] } });
      },
      undoRecommendation: (id) => set({ host: { ...get().host, appliedRecs: get().host.appliedRecs.filter((x) => x !== id) } }),
      setForecastOverride: (cropId, kg) => {
        const o = { ...get().host.forecastOverrides };
        if (kg === null) delete o[cropId];
        else o[cropId] = kg;
        set({ host: { ...get().host, forecastOverrides: o } });
      },
      sendFollowUp: (id) => {
        const h = get().host;
        if (!h.followUps.includes(id)) set({ host: { ...h, followUps: [...h.followUps, id] } });
      },
      setPipelineStage: (orderId, stage) => set({ host: { ...get().host, pipeline: { ...get().host.pipeline, [orderId]: stage } } }),
      togglePresalePaused: (offerId) => {
        const h = get().host;
        set({
          host: {
            ...h,
            presalePaused: h.presalePaused.includes(offerId) ? h.presalePaused.filter((x) => x !== offerId) : [...h.presalePaused, offerId],
          },
        });
      },
    }),
    {
      name: 'localdays-demo-v1',
      // v2: per-customer ownership (saved items, rewards, vouchers) and seeded community bookings.
      // Older demo states are simply replaced with a fresh one.
      version: 2,
      migrate: (persisted, version) => (version < 2 ? (initialData(0) as unknown as AppState) : (persisted as AppState)),
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => {
        const { todayISO, availabilityCtx, lastStamp, ...rest } = s;
        void todayISO;
        void availabilityCtx;
        void lastStamp;
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')) as Partial<AppState>;
      },
    },
  ),
);

/** Reactive "today" for components. */
export function useTodayISO() {
  const offset = useApp((s) => s.dayOffset);
  return demoTodayISO(offset);
}

/** Reactive availability context (re-renders when bookings, holds or the demo clock change). */
export function useAvailabilityCtx(): AvailabilityCtx {
  const offset = useApp((s) => s.dayOffset);
  const extra = useApp((s) => s.slotExtra);
  const cart = useApp((s) => s.cart);
  return useMemo(() => ({ todayISO: demoTodayISO(offset), extra, holds: holdsFromCart(cart) }), [offset, extra, cart]);
}

/* ------------------------- Per-customer views of shared state ------------------------- */
/* Stamps and Signature Blends belong to whoever made the booking they came from; saved
   items and redeemed rewards are stored as `${email}|${id}`. Bare legacy ids belong to
   the seeded demo customer. */

const GUEST = 'guest';
export const ownKey = (owner: string | undefined, id: string) => `${(owner ?? GUEST).toLowerCase()}|${id}`;
export function ownedEntry(entry: string): [string, string] {
  const i = entry.indexOf('|');
  return i < 0 ? [DEMO_USER.email.toLowerCase(), entry] : [entry.slice(0, i), entry.slice(i + 1)];
}
function adoptGuestSaves(saved: string[], email: string) {
  const owner = email.toLowerCase();
  const out: string[] = [];
  for (const e of saved) {
    const [who, id] = ownedEntry(e);
    const key = who === GUEST ? ownKey(owner, id) : e;
    if (!out.includes(key)) out.push(key);
  }
  return out;
}

const NONE: never[] = [];
const useEmail = () => useApp((s) => s.user?.email?.toLowerCase());

/** Bookings made by the signed-in customer. */
export function useMyBookings(): Booking[] {
  const bookings = useApp((s) => s.bookings);
  const email = useEmail();
  return useMemo(() => (email ? bookings.filter((b) => b.customer.email.toLowerCase() === email) : NONE), [bookings, email]);
}

/** Passport stamps earned on the signed-in customer's own verified visits. */
export function useMyStamps(): PassportStamp[] {
  const stamps = useApp((s) => s.stamps);
  const mine = useMyBookings();
  return useMemo(() => {
    if (!mine.length) return NONE;
    const refs = new Set(mine.map((b) => b.ref));
    return stamps.filter((st) => refs.has(st.bookingRef));
  }, [stamps, mine]);
}

/** Signature Blends saved from the signed-in customer's own workshops. */
export function useMyBlends(): SignatureBlend[] {
  const blends = useApp((s) => s.blends);
  const mine = useMyBookings();
  return useMemo(() => {
    if (!mine.length) return NONE;
    const refs = new Set(mine.map((b) => b.ref));
    return blends.filter((b) => refs.has(b.bookingRef));
  }, [blends, mine]);
}

/** Saved host / experience ids for the signed-in customer (or this browser's guest). */
export function useMySaved(): string[] {
  const saved = useApp((s) => s.saved);
  const owner = useEmail() ?? GUEST;
  return useMemo(() => saved.map(ownedEntry).filter(([who]) => who === owner).map(([, id]) => id), [saved, owner]);
}

export function useIsSaved(id: string): boolean {
  return useApp((s) => {
    const owner = s.user?.email?.toLowerCase() ?? GUEST;
    return s.saved.some((e) => {
      const [who, x] = ownedEntry(e);
      return who === owner && x === id;
    });
  });
}

/** Prepaid-experience vouchers bought by the signed-in customer. */
export function useMyVouchers(): PresaleVoucher[] {
  const vouchers = useApp((s) => s.vouchers);
  const email = useEmail();
  return useMemo(() => (email ? vouchers.filter((v) => (v.ownerEmail ?? DEMO_USER.email.toLowerCase()) === email) : NONE), [vouchers, email]);
}

/** Reward ids the signed-in customer has already redeemed. */
export function useMyUsedRewards(): string[] {
  const used = useApp((s) => s.usedRewards);
  const owner = useEmail();
  return useMemo(() => (owner ? used.map(ownedEntry).filter(([who]) => who === owner).map(([, id]) => id) : NONE), [used, owner]);
}
