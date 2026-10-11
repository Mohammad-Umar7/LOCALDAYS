import type { CategoryId, Experience, PresaleOffer, Product, Provider, Review } from '../types';
import { PHOTOS } from '../photos';
import { farmExperiences, farmPresales, farmProducts, farmProviders, farmReviews } from './farm';
import { honeyExperiences, honeyPresales, honeyProducts, honeyProviders, honeyReviews } from './honey';
import { potteryExperiences, potteryPresales, potteryProducts, potteryProviders, potteryReviews } from './pottery';
import { coastalExperiences, coastalPresales, coastalProducts, coastalProviders, coastalReviews } from './coastal';
import {
  fragranceExperiences,
  fragrancePresales,
  fragranceProducts,
  fragranceProviders,
  fragranceReviews,
} from './fragrance';

export const PROVIDERS: Provider[] = [
  ...farmProviders,
  ...honeyProviders,
  ...potteryProviders,
  ...coastalProviders,
  ...fragranceProviders,
];

export const EXPERIENCES: Experience[] = [
  ...farmExperiences,
  ...honeyExperiences,
  ...potteryExperiences,
  ...coastalExperiences,
  ...fragranceExperiences,
];

export const PRODUCTS: Product[] = uniquePhotosPerProvider([
  ...farmProducts,
  ...honeyProducts,
  ...potteryProducts,
  ...coastalProducts,
  ...fragranceProducts,
]);

/**
 * A host's shop should never show the same photo twice. Products that collide on a
 * photo move to the next unused photo in the same topic (and take its description).
 */
function uniquePhotosPerProvider(list: Product[]): Product[] {
  const used = new Map<string, Set<string>>();
  return list.map((p) => {
    const set = used.get(p.providerId) ?? new Set<string>();
    used.set(p.providerId, set);
    const pool = PHOTOS[p.image.key]?.length ?? 0;
    let i = p.image.i ?? 0;
    for (let n = 0; n < pool && set.has(`${p.image.key}:${i % pool}`); n++) i++;
    const idx = pool ? i % pool : 0;
    set.add(`${p.image.key}:${idx}`);
    if (idx === (p.image.i ?? 0)) return p;
    return { ...p, image: { ...p.image, i: idx, alt: PHOTOS[p.image.key][idx].alt } };
  });
}

export const PRESALES: PresaleOffer[] = [
  ...farmPresales,
  ...honeyPresales,
  ...potteryPresales,
  ...coastalPresales,
  ...fragrancePresales,
];

export const REVIEWS: Review[] = [
  ...farmReviews,
  ...honeyReviews,
  ...potteryReviews,
  ...coastalReviews,
  ...fragranceReviews,
];

export const PROVIDER_BY_ID: Record<string, Provider> = Object.fromEntries(PROVIDERS.map((p) => [p.id, p]));
export const PROVIDER_BY_SLUG: Record<string, Provider> = Object.fromEntries(PROVIDERS.map((p) => [p.slug, p]));
export const EXPERIENCE_BY_ID: Record<string, Experience> = Object.fromEntries(EXPERIENCES.map((e) => [e.id, e]));
export const PRODUCT_BY_ID: Record<string, Product> = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
export const PRESALE_BY_ID: Record<string, PresaleOffer> = Object.fromEntries(PRESALES.map((p) => [p.id, p]));

export const providersByCategory = (c: CategoryId) => PROVIDERS.filter((p) => p.categoryId === c);
export const experiencesForProvider = (providerId: string) =>
  (PROVIDER_BY_ID[providerId]?.experienceIds ?? []).map((id) => EXPERIENCE_BY_ID[id]).filter(Boolean);
export const productsForProvider = (providerId: string) =>
  (PROVIDER_BY_ID[providerId]?.productIds ?? []).map((id) => PRODUCT_BY_ID[id]).filter(Boolean);
export const reviewsForProvider = (providerId: string) => REVIEWS.filter((r) => r.providerId === providerId);
export const presalesForProvider = (providerId: string) => PRESALES.filter((p) => p.providerId === providerId);

/** Lowest per-guest-equivalent starting price for a provider (used on cards). */
export function startingPrice(providerId: string): number {
  const exps = experiencesForProvider(providerId).filter((e) => e.priceUnit !== 'per_night');
  const list = exps.length ? exps : experiencesForProvider(providerId);
  return Math.min(
    ...list.map((e) => (e.priceUnit === 'per_booking' ? Math.round(e.price / Math.max(1, e.includedGuests ?? 1)) : e.price)),
  );
}

// Integrity checks in development: every referenced id must exist.
if (import.meta.env.DEV) {
  for (const p of PROVIDERS) {
    for (const id of p.experienceIds) if (!EXPERIENCE_BY_ID[id]) console.warn(`[catalog] ${p.id} → missing experience ${id}`);
    for (const id of p.productIds) if (!PRODUCT_BY_ID[id]) console.warn(`[catalog] ${p.id} → missing product ${id}`);
    for (const h of p.scene.hotspots) {
      for (const id of h.experienceIds ?? []) if (!EXPERIENCE_BY_ID[id]) console.warn(`[catalog] hotspot ${h.id} → missing experience ${id}`);
      for (const id of h.productIds ?? []) if (!PRODUCT_BY_ID[id]) console.warn(`[catalog] hotspot ${h.id} → missing product ${id}`);
    }
  }
  for (const e of EXPERIENCES) if (!PROVIDER_BY_ID[e.providerId]) console.warn(`[catalog] experience ${e.id} → missing provider`);
  for (const p of PRODUCTS) if (!PROVIDER_BY_ID[p.providerId]) console.warn(`[catalog] product ${p.id} → missing provider`);
}
