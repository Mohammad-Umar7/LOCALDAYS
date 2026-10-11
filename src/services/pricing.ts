import { ECONOMICS } from '@/config/economics';
import type { Experience, Guests, PresaleVoucher, PriceBreakdown, PriceLine, Product, Reward } from '@/data/types';
import { aed } from '@/lib/format';
import { round } from '@/lib/utils';

export function vatPortion(total: number) {
  return round(total - total / (1 + ECONOMICS.vatRate), 2);
}

export function guestTotal(g: Guests) {
  return g.adults + g.children;
}

export function basePrice(exp: Experience, guests: Guests, nights = 1) {
  const total = guestTotal(guests);
  if (exp.priceUnit === 'per_night') return exp.price * Math.max(1, nights);
  if (exp.priceUnit === 'per_booking') {
    const extra = Math.max(0, total - (exp.includedGuests ?? total));
    return exp.price + extra * (exp.extraGuestPrice ?? 0);
  }
  return guests.adults * exp.price + guests.children * (exp.childPrice ?? exp.price);
}

export function priceExperience(
  exp: Experience,
  opts: { guests: Guests; nights?: number; addOnIds?: string[]; voucher?: PresaleVoucher | null; reward?: Reward | null },
): PriceBreakdown {
  const { guests, nights = 1, addOnIds = [], voucher, reward } = opts;
  const lines: PriceLine[] = [];
  const total = guestTotal(guests);

  if (exp.priceUnit === 'per_night') {
    lines.push({ label: `${aed(exp.price)} × ${nights} night${nights > 1 ? 's' : ''}`, amount: exp.price * nights });
  } else if (exp.priceUnit === 'per_booking') {
    lines.push({ label: `${exp.title} (covers ${exp.includedGuests} guests)`, amount: exp.price });
    const extra = Math.max(0, total - (exp.includedGuests ?? total));
    if (extra > 0) lines.push({ label: `${extra} extra guest${extra > 1 ? 's' : ''} × ${aed(exp.extraGuestPrice ?? 0)}`, amount: extra * (exp.extraGuestPrice ?? 0) });
  } else {
    if (guests.adults) lines.push({ label: `${guests.adults} adult${guests.adults > 1 ? 's' : ''} × ${aed(exp.price)}`, amount: guests.adults * exp.price });
    if (guests.children)
      lines.push({
        label: `${guests.children} child${guests.children > 1 ? 'ren' : ''} × ${aed(exp.childPrice ?? exp.price)}`,
        amount: guests.children * (exp.childPrice ?? exp.price),
      });
  }

  for (const id of addOnIds) {
    const a = exp.addOns.find((x) => x.id === id);
    if (!a) continue;
    const qty = a.unit === 'per_guest' ? total : 1;
    lines.push({ label: qty > 1 ? `${a.name} × ${qty}` : a.name, amount: a.price * qty });
  }

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  let discount = 0;

  if (voucher && voucher.experienceId === exp.id && voucher.status === 'active') {
    // A presale voucher covers one unit at the regular price (one booking for per-booking, one adult otherwise)
    const covered = exp.priceUnit === 'per_guest' ? exp.price : exp.price;
    discount += Math.min(subtotal, covered);
    lines.push({ label: 'Prepaid experience voucher', amount: -Math.min(subtotal, covered) });
  }

  if (reward && subtotal - discount > 0) {
    let r = 0;
    if (reward.value.type === 'percent') r = round(((subtotal - discount) * (reward.value.amount ?? 0)) / 100);
    if (reward.value.type === 'fixed') r = Math.min(subtotal - discount, reward.value.amount ?? 0);
    if (r > 0) {
      discount += r;
      lines.push({ label: `Passport reward · ${reward.fundedBy.type === 'platform' ? 'funded by Fadhal' : 'host-funded'}`, amount: -r });
    }
  }

  const grand = Math.max(0, subtotal - discount);
  return { lines, subtotal, discount, total: grand, vatIncluded: vatPortion(grand) };
}

export function productUnitPrice(p: Product, variantId?: string, subscribe?: boolean) {
  if (subscribe && p.subscription) return p.subscription.price;
  if (variantId && p.variants) return p.variants.find((v) => v.id === variantId)?.price ?? p.price;
  return p.price;
}

/** Host-side split for any gross amount. */
export function hostSplit(gross: number, kind: 'experience' | 'product' | 'presale') {
  const rate =
    kind === 'experience' ? ECONOMICS.experienceCommission : kind === 'product' ? ECONOMICS.productCommission : ECONOMICS.presaleCommission;
  const commission = round(gross * rate, 2);
  const processing = round(gross * ECONOMICS.paymentProcessing, 2);
  return { gross, rate, commission, processing, net: round(gross - commission - processing, 2) };
}
