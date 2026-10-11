import type { CategoryId, Experience, ExperienceKind, Provider, RegionId } from '@/data/types';
import { EXPERIENCES, PROVIDER_BY_ID, PROVIDERS } from '@/data/catalog';
import { CATEGORY_BY_ID } from '@/data/categories';
import { REGION_BY_ID } from '@/data/regions';
import { addDaysISO, rangeISO, upcomingWeekend } from '@/lib/dates';
import { dayAvailability, type AvailabilityCtx } from './availability';

export type WhenFilter = 'any' | 'today' | 'tomorrow' | 'weekend' | 'week' | `date:${string}`;
export type SortKey = 'recommended' | 'price-asc' | 'price-desc' | 'rating' | 'soonest';

export interface SearchParams {
  q: string;
  category: CategoryId | 'all';
  region: RegionId | 'all';
  when: WhenFilter;
  guests: number;
  family: boolean;
  overnight: boolean;
  kinds: ExperienceKind[];
  maxPrice: number | null;
  sort: SortKey;
}

export const DEFAULT_SEARCH: SearchParams = {
  q: '',
  category: 'all',
  region: 'all',
  when: 'any',
  guests: 2,
  family: false,
  overnight: false,
  kinds: [],
  maxPrice: null,
  sort: 'recommended',
};

const SYNONYMS: Record<string, string[]> = {
  farm: ['farm', 'date', 'dates', 'palm', 'harvest', 'vegetable', 'garden', 'organic', 'greenhouse', 'falaj'],
  honey: ['bee', 'bees', 'honey', 'hive', 'apiary', 'sidr', 'samar', 'beekeeper'],
  pottery: ['pottery', 'clay', 'ceramic', 'ceramics', 'wheel', 'mug', 'kiln', 'craft', 'artisan'],
  coastal: ['sea', 'fishing', 'fish', 'boat', 'dhow', 'coast', 'harbour', 'harbor', 'net', 'mangrove', 'beach'],
  fragrance: ['oud', 'bukhoor', 'perfume', 'fragrance', 'scent', 'attar', 'incense'],
};

function haystack(e: Experience, p: Provider) {
  return [e.title, e.summary, e.tags.join(' '), e.kind, p.name, p.tagline, REGION_BY_ID[p.regionId].name, CATEGORY_BY_ID[e.categoryId].name, CATEGORY_BY_ID[e.categoryId].shortName]
    .join(' ')
    .toLowerCase();
}

function textMatch(e: Experience, q: string) {
  if (!q.trim()) return true;
  const p = PROVIDER_BY_ID[e.providerId];
  const hay = haystack(e, p);
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((tok) => {
      if (hay.includes(tok)) return true;
      // Synonym expansion: "bees" matches the honey category
      return Object.entries(SYNONYMS).some(([cat, words]) => words.some((w) => w.startsWith(tok) || tok.startsWith(w)) && e.categoryId === cat);
    });
}

export function datesFor(when: WhenFilter, todayISO: string): string[] | null {
  if (when === 'any') return null;
  if (when === 'today') return [todayISO];
  if (when === 'tomorrow') return [addDaysISO(todayISO, 1)];
  if (when === 'week') return rangeISO(todayISO, 7);
  if (when === 'weekend') {
    const w = upcomingWeekend(todayISO);
    const days: string[] = [];
    for (let d = w.start; d <= w.end; d = addDaysISO(d, 1)) days.push(d);
    return days;
  }
  if (when.startsWith('date:')) return [when.slice(5)];
  return null;
}

/** Per-guest-equivalent price used for filters and sorting. */
export function comparablePrice(e: Experience) {
  if (e.priceUnit === 'per_booking') return Math.round(e.price / Math.max(1, e.includedGuests ?? 1));
  return e.price;
}

export interface ExperienceHit {
  e: Experience;
  firstOpen: string | null;
  remaining: number;
}

export function searchExperiences(p: SearchParams, ctx: AvailabilityCtx): ExperienceHit[] {
  const dates = datesFor(p.when, ctx.todayISO);
  const horizon = dates ?? rangeISO(ctx.todayISO, 30);
  const hits: ExperienceHit[] = [];
  for (const e of EXPERIENCES) {
    const prov = PROVIDER_BY_ID[e.providerId];
    if (p.category !== 'all' && e.categoryId !== p.category) continue;
    if (p.region !== 'all' && prov.regionId !== p.region) continue;
    if (p.family && !e.familyFriendly) continue;
    if (p.overnight && e.kind !== 'stay') continue;
    if (p.kinds.length && !p.kinds.includes(e.kind)) continue;
    if (p.maxPrice !== null && comparablePrice(e) > p.maxPrice) continue;
    if (e.maxGuests < p.guests && e.priceUnit !== 'per_night') continue;
    if (!textMatch(e, p.q)) continue;
    let firstOpen: string | null = null;
    let remaining = 0;
    for (const d of horizon) {
      const a = dayAvailability(e, d, Math.min(p.guests, e.maxGuests), ctx);
      if (a.status === 'available' || a.status === 'limited') {
        firstOpen = d;
        remaining = a.remaining;
        break;
      }
    }
    if (dates && !firstOpen) continue;
    hits.push({ e, firstOpen, remaining });
  }
  const providerRating = (h: ExperienceHit) => PROVIDER_BY_ID[h.e.providerId].rating;
  switch (p.sort) {
    case 'price-asc':
      hits.sort((a, b) => comparablePrice(a.e) - comparablePrice(b.e));
      break;
    case 'price-desc':
      hits.sort((a, b) => comparablePrice(b.e) - comparablePrice(a.e));
      break;
    case 'rating':
      hits.sort((a, b) => providerRating(b) - providerRating(a));
      break;
    case 'soonest':
      hits.sort((a, b) => (a.firstOpen ?? '9999').localeCompare(b.firstOpen ?? '9999'));
      break;
    default:
      hits.sort(
        (a, b) =>
          Number(!!PROVIDER_BY_ID[b.e.providerId].flagship) - Number(!!PROVIDER_BY_ID[a.e.providerId].flagship) ||
          Number(b.e.tags.includes('bestseller')) - Number(a.e.tags.includes('bestseller')) ||
          providerRating(b) - providerRating(a),
      );
  }
  return hits;
}

export function providersFromHits(hits: ExperienceHit[], sort: SortKey): { p: Provider; hits: ExperienceHit[] }[] {
  const map = new Map<string, ExperienceHit[]>();
  for (const h of hits) {
    const arr = map.get(h.e.providerId) ?? [];
    arr.push(h);
    map.set(h.e.providerId, arr);
  }
  const out = PROVIDERS.filter((p) => map.has(p.id)).map((p) => ({ p, hits: map.get(p.id)! }));
  const minPrice = (x: { hits: ExperienceHit[] }) => Math.min(...x.hits.map((h) => comparablePrice(h.e)));
  if (sort === 'price-asc') out.sort((a, b) => minPrice(a) - minPrice(b));
  else if (sort === 'price-desc') out.sort((a, b) => minPrice(b) - minPrice(a));
  else if (sort === 'rating') out.sort((a, b) => b.p.rating - a.p.rating);
  else if (sort === 'soonest')
    out.sort((a, b) => (a.hits.map((h) => h.firstOpen ?? '9999').sort()[0] ?? '').localeCompare(b.hits.map((h) => h.firstOpen ?? '9999').sort()[0] ?? ''));
  else out.sort((a, b) => Number(!!b.p.flagship) - Number(!!a.p.flagship) || b.p.rating - a.p.rating);
  return out;
}
