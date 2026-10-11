import { ArrowRight, ArrowUpRight, BedDouble, Box, Check, Clock, Heart, Minus, Plus, Repeat, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Category, Experience, Product, Provider } from '@/data/types';
import { CATEGORY_BY_ID } from '@/data/categories';
import { PROVIDER_BY_ID, experiencesForProvider, startingPrice } from '@/data/catalog';
import { REGION_BY_ID } from '@/data/regions';
import { useApp, useAvailabilityCtx, useIsSaved, useMyBlends } from '@/store/app';
import { useUI } from '@/store/ui';
import { dayAvailability, nextAvailable } from '@/services/availability';
import { aed, fmtDate, fmtDuration } from '@/lib/format';
import { addDaysISO, relativeDayLabel } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { SmartImage } from '../ui/SmartImage';
import { Badge, Stars } from '../ui/primitives';
import { CategoryIcon } from '../brand/CategoryIcon';

export function SaveButton({ id, className }: { id: string; className?: string }) {
  const saved = useIsSaved(id);
  const toggle = useApp((s) => s.toggleSaved);
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(id);
      }}
      aria-label={saved ? 'Remove from saved' : 'Save'}
      aria-pressed={saved}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-ink shadow-soft backdrop-blur transition hover:scale-105 hover:bg-white',
        className,
      )}
    >
      <Heart className={cn('h-4 w-4 transition', saved && 'fill-clay-500 text-clay-500')} />
    </button>
  );
}

/* ------------------------------- Category card ------------------------------- */

export function CategoryCard({ c, index, hostCount, from }: { c: Category; index: number; hostCount: number; from: number }) {
  return (
    <Link
      to={`/c/${c.id}`}
      className="group relative flex aspect-[3/4] w-[78vw] shrink-0 snap-start flex-col justify-end overflow-hidden rounded-[28px] text-white shadow-lift sm:w-[46vw] md:w-auto"
    >
      <SmartImage img={c.image} aspect={3 / 4} width={800} className="absolute inset-0" category={c.id} zoom priority={index < 2} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/5" />
      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md ring-1 ring-white/25">
          <CategoryIcon id={c.id} className="h-5 w-5" />
        </span>
        <span className="font-arabic text-[26px] leading-none text-white/85 drop-shadow">{c.arabic}</span>
      </div>
      <div className="relative p-5 md:p-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">0{index + 1}</div>
        <h3 className="mt-2 font-display text-[26px] leading-[1.02] tracking-tight md:text-[28px]">{c.name}</h3>
        <p className="mt-2 text-[13.5px] leading-snug text-white/75">{c.tagline}</p>
        <div className="mt-4 flex items-center justify-between border-t border-white/15 pt-4 text-[12.5px] font-semibold">
          <span className="text-white/80">
            {hostCount} hosts · from {aed(from)}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink transition-transform duration-500 group-hover:rotate-45">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ------------------------------- Provider card ------------------------------- */

/** What a host offers, per tradition — the brief asks farm listings to show stays, dining and harvesting at a glance. */
const OFFER_MATRIX: Record<string, { label: string; test: (e: Experience) => boolean }[]> = {
  farm: [
    { label: 'Overnight stay', test: (e) => e.kind === 'stay' || e.priceUnit === 'per_night' },
    { label: 'Farm-to-table dining', test: (e) => e.kind === 'dining' },
    { label: 'Guided harvesting', test: (e) => /harvest|picking/i.test(e.title) },
    { label: 'Family activities', test: (e) => e.familyFriendly && e.kind !== 'stay' },
  ],
  honey: [
    { label: 'Hive visits', test: (e) => /hive|beekeeper|bee education/i.test(e.title) },
    { label: 'Tastings', test: (e) => e.kind === 'tasting' },
    { label: 'Workshops', test: (e) => e.kind === 'workshop' },
    { label: 'Family sessions', test: (e) => e.familyFriendly },
  ],
  pottery: [
    { label: 'Wheel sessions', test: (e) => /wheel|mug|beginners/i.test(e.title) },
    { label: 'Private & groups', test: (e) => /private|group/i.test(e.title) },
    { label: 'Family sessions', test: (e) => e.familyFriendly },
    { label: 'Kiln firing', test: (e) => /raku|firing|kiln/i.test(e.title + ' ' + e.summary) },
  ],
  coastal: [
    { label: 'Licensed boat trips', test: (e) => e.kind === 'boat' },
    { label: 'On-shore heritage', test: (e) => e.kind !== 'boat' && e.kind !== 'dining' },
    { label: 'Seafood dining', test: (e) => e.kind === 'dining' },
    { label: 'Group excursions', test: (e) => /group|crew/i.test(e.title) || e.maxGuests >= 14 },
  ],
  fragrance: [
    { label: 'Personal blends', test: (e) => /personal/i.test(e.title) },
    { label: 'Bukhoor making', test: (e) => /bukhoor/i.test(e.title) },
    { label: 'Oud appreciation', test: (e) => /oud|attar|discovery/i.test(e.title) },
    { label: 'Private groups', test: (e) => /private|group/i.test(e.title) },
  ],
};

export function ProviderCard({ p, guests = 2 }: { p: Provider; guests?: number }) {
  const cat = CATEGORY_BY_ID[p.categoryId];
  const ctx = useAvailabilityCtx();
  const exps = experiencesForProvider(p.id);
  const bookable = exps.filter((e) => e.priceUnit !== 'per_night');
  const soonest = bookable
    .map((e) => ({ e, a: nextAvailable(e, Math.min(guests, e.maxGuests), ctx) }))
    .filter((x) => x.a)
    .sort((a, b) => a.a!.date.localeCompare(b.a!.date))[0];
  // Next three dates on which at least one experience still has room for this party
  const openDates: string[] = [];
  for (let i = 0; i < 21 && openDates.length < 3; i++) {
    const d = addDaysISO(ctx.todayISO, i);
    const open = exps.some((e) => {
      const a = dayAvailability(e, d, Math.min(guests, e.maxGuests), ctx);
      return a.status === 'available' || a.status === 'limited';
    });
    if (open) openDates.push(d);
  }
  const offers = (OFFER_MATRIX[p.categoryId] ?? []).map((o) => ({ label: o.label, has: exps.some(o.test) }));
  const from = startingPrice(p.id);
  return (
    <Link to={`/p/${p.slug}`} className="group flex flex-col overflow-hidden rounded-[26px] border border-line/80 bg-white shadow-soft transition duration-500 hover:-translate-y-0.5 hover:shadow-lift">
      <div className="relative">
        <SmartImage img={p.hero} aspect={4 / 3} width={900} className="aspect-[4/3]" category={p.categoryId} zoom />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3.5">
          <div className="flex flex-wrap gap-1.5">
            {p.flagship && <Badge tone="glass">Flagship demo</Badge>}
            {p.overnight && (
              <Badge tone="glass" icon={<BedDouble className="h-3 w-3" />}>
                Overnight stays
              </Badge>
            )}
            {p.familyFriendly && (
              <Badge tone="glass" icon={<Users className="h-3 w-3" />}>
                Families
              </Badge>
            )}
          </div>
          <SaveButton id={p.id} />
        </div>
        <div className="absolute bottom-3 left-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
          Fictional demo host
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-2 text-[12.5px] font-semibold">
          <span className="inline-flex items-center gap-1.5" style={{ color: cat.theme.accent }}>
            <CategoryIcon id={p.categoryId} className="h-4 w-4" /> {REGION_BY_ID[p.regionId].name}
          </span>
          <Stars value={p.rating} count={p.reviewCount} />
        </div>
        <h3 className="mt-2 font-display text-[23px] leading-tight tracking-tight text-ink">{p.name}</h3>
        <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-ink-2">{p.tagline}</p>
        {offers.length > 0 && (
          <ul className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12.5px]">
            {offers.map((o) => (
              <li key={o.label} className={cn('flex min-w-0 items-center gap-1.5', o.has ? 'text-ink-2' : 'text-ink-4')}>
                {o.has ? <Check className="h-3.5 w-3.5 shrink-0 text-oasis-500" strokeWidth={2.5} /> : <Minus className="h-3.5 w-3.5 shrink-0" />}
                <span className={cn('truncate', !o.has && 'line-through decoration-ink/20')}>{o.label}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {p.highlights.slice(0, 2).map((h) => (
            <span key={h} className="rounded-full bg-sand-50 px-2.5 py-1 text-[11.5px] font-medium text-ink-2 ring-1 ring-inset ring-line">
              {h}
            </span>
          ))}
        </div>
        <div className="mt-auto pt-5">
          <div className="flex items-end justify-between gap-3 border-t border-line pt-4">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Open dates</div>
              {openDates.length ? (
                <div className="mt-1.5 flex gap-1">
                  {openDates.map((d) => (
                    <span key={d} className="rounded-lg bg-oasis-50 px-2 py-1 text-center text-[11px] font-semibold leading-tight text-oasis-700 ring-1 ring-inset ring-oasis-100">
                      {fmtDate(d, 'EEE')}
                      <span className="block text-[13px]">{fmtDate(d, 'd')}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="mt-1 text-[12.5px] text-ink-3">Check dates</div>
              )}
              {soonest && <div className="mt-1.5 truncate text-[11.5px] text-ink-3">Next: {soonest.e.title.split(':')[0]}</div>}
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[11px] text-ink-3">from</div>
              <div className="tabular text-[17px] font-semibold text-ink">{aed(from)}</div>
            </div>
          </div>
          <span className="mt-4 flex items-center justify-between rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-paper transition group-hover:bg-clay-500">
            <span className="inline-flex min-w-0 items-center gap-2">
              <Box className="h-4 w-4 shrink-0" /> {p.categoryId === 'farm' ? 'Explore the farm' : 'Step inside'}
              <span className="truncate font-normal text-paper/60">· 3D preview</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ------------------------------ Experience card ------------------------------ */

export function ExperienceCard({ e, compact, showProvider = true }: { e: Experience; compact?: boolean; showProvider?: boolean }) {
  const p = PROVIDER_BY_ID[e.providerId];
  const ctx = useAvailabilityCtx();
  const next = nextAvailable(e, Math.min(2, e.maxGuests), ctx);
  const unit = e.priceUnit === 'per_guest' ? '/ guest' : e.priceUnit === 'per_night' ? '/ night' : `/ ${e.includedGuests ?? 1} guests`;
  return (
    <Link to={`/book/${e.id}`} className="group flex flex-col">
      <div className="relative overflow-hidden rounded-[22px]">
        <SmartImage img={e.image} aspect={compact ? 1 : 4 / 5} width={700} className={compact ? 'aspect-square' : 'aspect-[4/5]'} category={e.categoryId} zoom />
        <div className="absolute inset-x-0 top-0 flex justify-between p-3">
          <Badge tone="glass">{e.kind === 'stay' ? 'Stay' : e.kind === 'boat' ? 'Licensed boat' : e.kind[0].toUpperCase() + e.kind.slice(1)}</Badge>
          <SaveButton id={e.id} />
        </div>
        {next && next.status === 'limited' && (
          <div className="absolute bottom-3 left-3 rounded-full bg-honey-400 px-2.5 py-1 text-[11px] font-bold text-ink">Few spots left</div>
        )}
      </div>
      <div className="mt-3.5 px-0.5">
        {showProvider && <div className="text-[12px] font-semibold text-ink-3">{p.name}</div>}
        <h3 className="mt-0.5 line-clamp-2 text-[16px] font-semibold leading-snug tracking-tight text-ink group-hover:underline group-hover:decoration-ink/20 group-hover:underline-offset-4">{e.title}</h3>
        <div className="mt-1.5 flex items-center gap-3 text-[12.5px] text-ink-3">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {fmtDuration(e.durationMins)}
          </span>
          {next && <span>Next: {relativeDayLabel(ctx.todayISO, next.date)}</span>}
        </div>
        <div className="mt-1.5 text-[14px]">
          <span className="font-semibold text-ink">{aed(e.price)}</span> <span className="text-ink-3">{unit}</span>
        </div>
      </div>
    </Link>
  );
}

/* ------------------------------- Product card ------------------------------- */

export function ProductCard({ prod, highlight, compact }: { prod: Product; highlight?: string; compact?: boolean }) {
  const add = useApp((s) => s.addProductToCart);
  const blends = useMyBlends();
  const toast = useUI((s) => s.toast);
  const p = PROVIDER_BY_ID[prod.providerId];
  const locked = prod.requiresBlend && !blends.some((b) => b.providerId === prod.providerId);
  return (
    <div className="group flex flex-col">
      <Link to={`/p/${p.slug}/shop`} className="relative block overflow-hidden rounded-[22px] bg-white">
        <SmartImage img={prod.image} aspect={1} width={600} className="aspect-square" category={prod.categoryId} zoom />
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {highlight && <Badge tone="dark">{highlight}</Badge>}
          {prod.subscription && (
            <Badge tone="honey" icon={<Repeat className="h-3 w-3" />}>
              Subscribe · {aed(prod.subscription.price)}
            </Badge>
          )}
          {prod.origin.type === 'partner' && <Badge tone="glass">Partner: {prod.origin.partnerName}</Badge>}
          {prod.kind === 'commission' && <Badge tone="glass">Made to commission</Badge>}
        </div>
      </Link>
      <div className="mt-3 flex items-start justify-between gap-3 px-0.5">
        <div className="min-w-0">
          {!compact && <div className="truncate text-[12px] font-semibold text-ink-3">{p.name}</div>}
          <div className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink">{prod.name}</div>
          <div className="mt-1 text-[13px] text-ink-3">
            <span className="font-semibold text-ink">{prod.kind === 'commission' ? `from ${aed(prod.price)}` : aed(prod.price)}</span> · {prod.unit}
          </div>
        </div>
        <button
          aria-label={`Add ${prod.name} to basket`}
          disabled={locked}
          title={locked ? 'Available after you create a blend at a workshop' : 'Add to basket'}
          onClick={() => {
            add(prod.id, { variantId: prod.variants?.[1]?.id ?? prod.variants?.[0]?.id });
            toast({ title: 'Added to basket', body: prod.name, tone: 'success' });
          }}
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-paper shadow-soft transition hover:scale-105 disabled:bg-sand-200 disabled:text-ink-4"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
