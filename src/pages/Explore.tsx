import { motion } from 'framer-motion';
import { ArrowUpDown, LayoutGrid, Map as MapIcon, Rows3, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ExperienceCard, ProviderCard } from '@/components/cards/Cards';
import { SharjahMap } from '@/components/map/SharjahMap';
import { CategoryIcon } from '@/components/brand/CategoryIcon';
import { SmartImage } from '@/components/ui/SmartImage';
import { Badge, EmptyState, Reveal } from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/overlays';
import { CATEGORIES, CATEGORY_BY_ID } from '@/data/categories';
import { providersByCategory, PROVIDERS, EXPERIENCES } from '@/data/catalog';
import { REGION_BY_ID } from '@/data/regions';
import type { CategoryId, ExperienceKind, RegionId } from '@/data/types';
import { useAvailabilityCtx } from '@/store/app';
import { DEFAULT_SEARCH, providersFromHits, searchExperiences, type SearchParams, type SortKey, type WhenFilter } from '@/services/search';
import { addDaysISO, upcomingWeekend } from '@/lib/dates';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const KINDS: { id: ExperienceKind; label: string }[] = [
  { id: 'stay', label: 'Stays' },
  { id: 'dining', label: 'Dining' },
  { id: 'workshop', label: 'Workshops' },
  { id: 'tour', label: 'Tours' },
  { id: 'tasting', label: 'Tastings' },
  { id: 'package', label: 'Packages' },
  { id: 'demonstration', label: 'Demonstrations' },
  { id: 'boat', label: 'Licensed boats' },
];

const PRICE_PRESETS: { label: string; value: number | null }[] = [
  { label: 'Any price', value: null },
  { label: 'Under AED 100', value: 100 },
  { label: 'Under AED 200', value: 200 },
  { label: 'Under AED 300', value: 300 },
];

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'soonest', label: 'Soonest available' },
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
  { id: 'rating', label: 'Top rated' },
];

export default function Explore() {
  const { categoryId } = useParams();
  const [sp] = useSearchParams();
  const category = (categoryId && CATEGORY_BY_ID[categoryId as CategoryId] ? categoryId : 'all') as CategoryId | 'all';
  const cat = category !== 'all' ? CATEGORY_BY_ID[category] : null;
  const ctx = useAvailabilityCtx();

  const [params, setParams] = useState<SearchParams>(() => ({
    ...DEFAULT_SEARCH,
    category,
    when: (sp.get('when') as WhenFilter) ?? 'any',
    guests: Number(sp.get('guests') ?? 2),
    family: sp.get('family') === '1',
    q: sp.get('q') ?? '',
  }));
  const [view, setView] = useState<'hosts' | 'experiences' | 'map'>('hosts');
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setParams((p) => ({ ...p, category, region: 'all' }));
  }, [category]);

  const hits = useMemo(() => searchExperiences(params, ctx), [params, ctx]);
  const providers = useMemo(() => providersFromHits(hits, params.sort), [hits, params.sort]);
  const set = <K extends keyof SearchParams>(k: K, v: SearchParams[K]) => setParams((p) => ({ ...p, [k]: v }));

  const regionsHere = useMemo(() => {
    const list = category === 'all' ? PROVIDERS : providersByCategory(category);
    return [...new Set(list.map((p) => p.regionId))];
  }, [category]);
  // Only offer experience types this tradition actually has (no "boats" filter on farms)
  const kindsHere = useMemo(() => {
    const present = new Set(EXPERIENCES.filter((e) => category === 'all' || e.categoryId === category).map((e) => e.kind));
    return KINDS.filter((k) => present.has(k.id));
  }, [category]);

  const weekend = upcomingWeekend(ctx.todayISO);
  const WHEN: { id: WhenFilter; label: string }[] = [
    { id: 'any', label: 'Any date' },
    { id: 'today', label: 'Today' },
    { id: 'tomorrow', label: 'Tomorrow' },
    { id: 'weekend', label: `This weekend` },
    { id: 'week', label: 'Next 7 days' },
  ];
  const activeFilters =
    (params.region !== 'all' ? 1 : 0) + (params.family ? 1 : 0) + (params.overnight ? 1 : 0) + params.kinds.length + (params.maxPrice ? 1 : 0) + (params.when !== 'any' ? 1 : 0);

  const pins = useMemo(() => {
    const counts = new Map<RegionId, number>();
    providers.forEach(({ p }) => counts.set(p.regionId, (counts.get(p.regionId) ?? 0) + 1));
    return [...counts.entries()].map(([regionId, count]) => ({ regionId, count, color: cat?.theme.accent ?? '#B5502B' }));
  }, [providers, cat]);

  return (
    <AppShell>
      {/* ------------------------------ Header ------------------------------ */}
      {cat ? (
        <section className="relative overflow-hidden text-white" style={{ background: cat.theme.deep }}>
          <SmartImage img={cat.heroImage} width={1900} className="absolute inset-0 opacity-55" category={cat.id} priority />
          <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${cat.theme.deep} 15%, ${cat.theme.deep}cc 45%, transparent)` }} />
          <div className="grain absolute inset-0" />
          <div className="shell relative grid gap-10 py-14 md:py-20 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
                  <CategoryIcon id={cat.id} />
                </span>
                <span className="font-arabic text-[28px] text-white/80">{cat.arabic}</span>
                <span className="text-[13px] italic text-white/50">{cat.arabicLatin}</span>
              </div>
              <h1 className="display-lg mt-6 max-w-2xl text-balance">{cat.name}</h1>
              <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-white/75">{cat.description}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Badge tone="glass">{providersByCategory(cat.id).length} hosts</Badge>
                <Badge tone="glass">{regionsHere.map((r) => REGION_BY_ID[r].name).join(' · ')}</Badge>
                <Badge tone="glass">Fictional demo listings</Badge>
              </div>
            </div>
            <div className="self-end rounded-[26px] bg-white/10 p-6 ring-1 ring-white/15 backdrop-blur-md">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">After your visit</div>
              <div className="mt-2 font-display text-[24px] leading-tight">{cat.commerce.headline}</div>
              <p className="mt-2 text-[14px] leading-relaxed text-white/70">{cat.commerce.summary}</p>
            </div>
          </div>
        </section>
      ) : (
        <section className="border-b border-line bg-sand-100">
          <div className="shell py-12 md:py-16">
            <div className="eyebrow">All experiences</div>
            <h1 className="display-lg mt-4 max-w-3xl">Every way to live Sharjah, in one place.</h1>
            <div className="no-scrollbar mt-8 flex gap-2 overflow-x-auto pb-1">
              {[{ id: 'all', label: 'All traditions' } as const, ...CATEGORIES.map((c) => ({ id: c.id, label: c.shortName }))].map((c) => (
                <button
                  key={c.id}
                  onClick={() => set('category', c.id as CategoryId | 'all')}
                  className={cn('chip shrink-0', params.category === c.id && 'chip-active')}
                >
                  {c.id !== 'all' && <CategoryIcon id={c.id as CategoryId} className="h-4 w-4" />}
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------ Filter bar ------------------------------ */}
      <div className="sticky top-[64px] z-30 border-b border-line/80 bg-paper/90 backdrop-blur-xl md:top-[72px]">
        <div className="shell flex items-center gap-2 py-3">
          <div className="relative min-w-0 flex-1 md:max-w-xs">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              value={params.q}
              onChange={(e) => set('q', e.target.value)}
              placeholder={cat ? `Search ${cat.shortName.toLowerCase()} experiences` : 'Search bees, dhow, mugs…'}
              className="h-10 w-full rounded-full border border-line bg-white pl-10 pr-4 text-[14px] outline-none transition focus:border-ink/30"
            />
          </div>
          <div className="no-scrollbar hidden flex-1 items-center gap-1.5 overflow-x-auto lg:flex">
            {WHEN.map((w) => (
              <button key={w.id} onClick={() => set('when', w.id)} className={cn('chip shrink-0 py-2', params.when === w.id && 'chip-active')}>
                {w.label}
                {w.id === 'weekend' && <span className="opacity-60">{fmtDate(weekend.start, 'd')}–{fmtDate(weekend.end, 'd MMM')}</span>}
              </button>
            ))}
            <input
              type="date"
              aria-label="Pick a date"
              min={ctx.todayISO}
              max={addDaysISO(ctx.todayISO, 90)}
              value={params.when.startsWith('date:') ? params.when.slice(5) : ''}
              onChange={(e) => set('when', e.target.value ? (`date:${e.target.value}` as WhenFilter) : 'any')}
              className="chip h-[38px] shrink-0 cursor-pointer"
            />
          </div>
          <button onClick={() => setFiltersOpen(true)} className="chip relative h-10 shrink-0 px-4">
            <SlidersHorizontal className="h-4 w-4" /> Filters
            {activeFilters > 0 && <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-clay-500 px-1 text-[10.5px] font-bold text-white">{activeFilters}</span>}
          </button>
          <label className="chip relative hidden h-10 shrink-0 cursor-pointer px-4 md:inline-flex">
            <ArrowUpDown className="h-4 w-4" />
            <select value={params.sort} onChange={(e) => set('sort', e.target.value as SortKey)} className="cursor-pointer appearance-none bg-transparent pr-1 outline-none">
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* ------------------------------ Results ------------------------------ */}
      <section className="shell py-8 md:py-10">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-display text-[26px] tracking-tight">
              {providers.length} host{providers.length === 1 ? '' : 's'} · {hits.length} experience{hits.length === 1 ? '' : 's'}
            </div>
            <div className="text-[13.5px] text-ink-3">
              Showing live availability for {params.guests} guest{params.guests > 1 ? 's' : ''}
              {params.when !== 'any' ? ` · ${WHEN.find((w) => w.id === params.when)?.label ?? fmtDate(params.when.slice(5))}` : ''}
            </div>
          </div>
          <Tabs
            value={view}
            onChange={setView}
            items={[
              { id: 'hosts', label: 'Hosts', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
              { id: 'experiences', label: 'Experiences', icon: <Rows3 className="h-3.5 w-3.5" /> },
              { id: 'map', label: 'Map', icon: <MapIcon className="h-3.5 w-3.5" /> },
            ]}
          />
        </div>

        {hits.length === 0 ? (
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="Nothing matches those filters"
            body="Try another date or fewer filters — or let the Day Composer find a day for you."
            action={
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setParams({ ...DEFAULT_SEARCH, category })}>
                  Clear filters
                </Button>
                <Button to="/compose" variant="dark">
                  Open Day Composer
                </Button>
              </div>
            }
          />
        ) : view === 'hosts' ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map(({ p }, i) => (
              <Reveal key={p.id} delay={(i % 3) * 0.06}>
                <ProviderCard p={p} guests={params.guests} />
              </Reveal>
            ))}
          </div>
        ) : view === 'experiences' ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {hits.map((h, i) => (
              <Reveal key={h.e.id} delay={(i % 4) * 0.05}>
                <ExperienceCard e={h.e} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
            <div className="overflow-hidden rounded-[28px] border border-line shadow-soft">
              <SharjahMap pins={pins} selected={params.region === 'all' ? null : params.region} onSelect={(r) => set('region', r ?? 'all')} className="aspect-square" />
            </div>
            <div className="space-y-4">
              {params.region !== 'all' && (
                <div className="flex items-center justify-between rounded-2xl bg-sand-100 px-4 py-3">
                  <div>
                    <div className="text-[14px] font-semibold">{REGION_BY_ID[params.region].name}</div>
                    <div className="text-[12.5px] text-ink-3">{REGION_BY_ID[params.region].blurb}</div>
                  </div>
                  <button onClick={() => set('region', 'all')} className="rounded-full p-1.5 hover:bg-white" aria-label="Clear region">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {providers.map(({ p }) => (
                <ProviderCard key={p.id} p={p} guests={params.guests} />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ------------------------------ Filter sheet ------------------------------ */}
      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        footer={
          <div className="flex items-center justify-between gap-3">
            <button onClick={() => setParams({ ...DEFAULT_SEARCH, category, q: params.q })} className="text-[14px] font-semibold text-ink underline underline-offset-4">
              Clear all
            </button>
            <Button onClick={() => setFiltersOpen(false)}>Show {hits.length} experiences</Button>
          </div>
        }
      >
        <FilterGroup title="When">
          <div className="flex flex-wrap gap-2">
            {WHEN.map((w) => (
              <button key={w.id} onClick={() => set('when', w.id)} className={cn('chip', params.when === w.id && 'chip-active')}>
                {w.label}
              </button>
            ))}
          </div>
        </FilterGroup>
        <FilterGroup title="Guests">
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
              <button key={n} onClick={() => set('guests', n)} className={cn('chip w-12 justify-center', params.guests === n && 'chip-active')}>
                {n}
              </button>
            ))}
          </div>
        </FilterGroup>
        <FilterGroup title="Region">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => set('region', 'all')} className={cn('chip', params.region === 'all' && 'chip-active')}>
              All regions
            </button>
            {regionsHere.map((r) => (
              <button key={r} onClick={() => set('region', r)} className={cn('chip', params.region === r && 'chip-active')}>
                {REGION_BY_ID[r].name}
              </button>
            ))}
          </div>
        </FilterGroup>
        <FilterGroup title="Price per guest">
          <div className="flex flex-wrap gap-2">
            {PRICE_PRESETS.map((p) => (
              <button key={p.label} onClick={() => set('maxPrice', p.value)} className={cn('chip', params.maxPrice === p.value && 'chip-active')}>
                {p.label}
              </button>
            ))}
          </div>
        </FilterGroup>
        <FilterGroup title="Experience type">
          <div className="flex flex-wrap gap-2">
            {kindsHere.map((k) => {
              const on = params.kinds.includes(k.id);
              return (
                <button key={k.id} onClick={() => set('kinds', on ? params.kinds.filter((x) => x !== k.id) : [...params.kinds, k.id])} className={cn('chip', on && 'chip-active')}>
                  {k.label}
                </button>
              );
            })}
          </div>
        </FilterGroup>
        <FilterGroup title="Good to know">
          <Toggle label="Family friendly" hint="Suitable for children" value={params.family} onChange={(v) => set('family', v)} />
          <Toggle label="Overnight stays" hint="Farmhouses and desert glamping" value={params.overnight} onChange={(v) => set('overnight', v)} />
        </FilterGroup>
        <FilterGroup title="Sort by">
          <div className="flex flex-wrap gap-2">
            {SORTS.map((s) => (
              <button key={s.id} onClick={() => set('sort', s.id)} className={cn('chip', params.sort === s.id && 'chip-active')}>
                {s.label}
              </button>
            ))}
          </div>
        </FilterGroup>
      </Sheet>
    </AppShell>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line py-5 last:border-0">
      <div className="mb-3 text-[13px] font-bold uppercase tracking-[0.12em] text-ink-3">{title}</div>
      {children}
    </div>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="flex w-full items-center justify-between gap-4 py-2.5 text-left" role="switch" aria-checked={value}>
      <span>
        <span className="block text-[15px] font-semibold">{label}</span>
        {hint && <span className="block text-[13px] text-ink-3">{hint}</span>}
      </span>
      <span className={cn('relative h-7 w-12 shrink-0 rounded-full transition', value ? 'bg-ink' : 'bg-sand-300')}>
        <motion.span layout className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow', value ? 'right-1' : 'left-1')} />
      </span>
    </button>
  );
}

