import type { CartItem, ImageRef, PresaleVoucher } from '@/data/types';
import { EXPERIENCE_BY_ID, PRESALE_BY_ID, PRODUCT_BY_ID, PROVIDER_BY_ID } from '@/data/catalog';
import { REWARD_BY_ID } from '@/data/passport';
import { priceExperience, productUnitPrice, vatPortion } from './pricing';
import { fmtDate, fmtTime } from '@/lib/format';

export interface CartLineView {
  id: string;
  type: CartItem['type'];
  title: string;
  provider: string;
  providerSlug: string;
  detail: string;
  image: ImageRef;
  categoryId: string;
  total: number;
  discount: number;
  qty?: number;
  editableQty: boolean;
  holdExpiresAt?: string;
  recurring?: string;
}

export function describeCartItem(item: CartItem, vouchers: PresaleVoucher[]): CartLineView | null {
  if (item.type === 'experience') {
    const exp = EXPERIENCE_BY_ID[item.experienceId];
    if (!exp) return null;
    const p = PROVIDER_BY_ID[exp.providerId];
    const voucher = item.voucherId ? vouchers.find((v) => v.id === item.voucherId) ?? null : null;
    const reward = item.rewardId ? REWARD_BY_ID[item.rewardId] ?? null : null;
    const price = priceExperience(exp, { guests: item.guests, nights: item.nights, addOnIds: item.addOnIds, voucher, reward });
    const g = item.guests.adults + item.guests.children;
    const when =
      exp.priceUnit === 'per_night'
        ? `${fmtDate(item.date)} · ${item.nights ?? 1} night${(item.nights ?? 1) > 1 ? 's' : ''}`
        : `${fmtDate(item.date)} · ${fmtTime(item.time)}`;
    return {
      id: item.id,
      type: 'experience',
      title: exp.title,
      provider: p.name,
      providerSlug: p.slug,
      detail: `${when} · ${g} guest${g > 1 ? 's' : ''}`,
      image: exp.image,
      categoryId: exp.categoryId,
      total: price.total,
      discount: price.discount,
      editableQty: false,
      holdExpiresAt: item.holdExpiresAt,
    };
  }
  if (item.type === 'product') {
    const prod = PRODUCT_BY_ID[item.productId];
    if (!prod) return null;
    const p = PROVIDER_BY_ID[prod.providerId];
    const unit = productUnitPrice(prod, item.variantId, !!item.subscribe);
    const variant = prod.variants?.find((v) => v.id === item.variantId);
    const reward = item.rewardId ? REWARD_BY_ID[item.rewardId] : undefined;
    const pctOff = reward?.value.type === 'percent' ? (reward.value.amount ?? 0) / 100 : 0;
    const discounted = Math.round(unit * (1 - pctOff));
    return {
      id: item.id,
      type: 'product',
      title: prod.name,
      provider: p.name,
      providerSlug: p.slug,
      detail: item.subscribe
        ? `${item.subscribe[0].toUpperCase()}${item.subscribe.slice(1)} subscription · ${prod.unit}${pctOff ? ` · Passport reward −${Math.round(pctOff * 100)}% on first 4 boxes` : ''}`
        : `${variant?.name ?? prod.unit}`,
      image: prod.image,
      categoryId: prod.categoryId,
      total: item.subscribe ? discounted : unit * item.qty,
      discount: item.subscribe ? unit - discounted : 0,
      qty: item.qty,
      editableQty: !item.subscribe,
      recurring: item.subscribe,
    };
  }
  const offer = PRESALE_BY_ID[item.offerId];
  if (!offer) return null;
  const exp = EXPERIENCE_BY_ID[offer.experienceId];
  const p = PROVIDER_BY_ID[offer.providerId];
  return {
    id: item.id,
    type: 'presale',
    title: offer.title,
    provider: p.name,
    providerSlug: p.slug,
    detail: `Prepaid experience · valid ${Math.round(offer.expiresInDays / 30)} months`,
    image: exp.image,
    categoryId: exp.categoryId,
    total: offer.presalePrice * item.qty,
    discount: (offer.regularPrice - offer.presalePrice) * item.qty,
    qty: item.qty,
    editableQty: true,
  };
}

export function cartTotals(lines: CartLineView[]) {
  const total = lines.reduce((s, l) => s + l.total, 0);
  const savings = lines.reduce((s, l) => s + l.discount, 0);
  return { total, savings, vat: vatPortion(total), recurring: lines.filter((l) => l.recurring) };
}
