import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Gift, Leaf, PackageCheck, Repeat, Sparkles, Truck, Users } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ProductCard } from '@/components/cards/Cards';
import { BlendCard } from '@/components/account/BlendCard';
import { SmartImage } from '@/components/ui/SmartImage';
import { Avatar, Badge, DemoTag } from '@/components/ui/primitives';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { CATEGORY_BY_ID } from '@/data/categories';
import { EXPERIENCE_BY_ID, PROVIDER_BY_SLUG, productsForProvider } from '@/data/catalog';
import { BOX_CONTENTS, CROP_BY_ID } from '@/data/farmOps';
import type { Frequency, Product, Provider } from '@/data/types';
import { useApp, useMyStamps, useMyBookings, useMyBlends, useMyUsedRewards } from '@/store/app';
import { useUI } from '@/store/ui';
import { rewardsForProducts, unlockedRewards } from '@/services/passport';
import { aed, fmtDate } from '@/lib/format';
import { cn, shortProviderName } from '@/lib/utils';
import NotFound from './NotFound';

const ClayStudio = lazy(() => import('@/three/scenes/pottery/ClayStudio').then((m) => ({ default: m.ClayStudio })));

export default function Storefront() {
  const { slug = '' } = useParams();
  const provider = PROVIDER_BY_SLUG[slug];
  if (!provider) return <NotFound />;
  return <Shop key={provider.id} provider={provider} />;
}

type Filter = 'all' | 'subscribe' | 'pantry' | 'gift' | 'partner' | 'commission';

function Shop({ provider }: { provider: Provider }) {
  const cat = CATEGORY_BY_ID[provider.categoryId];
  const products = productsForProvider(provider.id);
  const user = useApp((s) => s.user);
  const bookings = useApp((s) => s.bookings);
  const orders = useApp((s) => s.orders);
  const stamps = useMyStamps();
  const myBookings = useMyBookings();
  const allMyBlends = useMyBlends();
  const blends = allMyBlends.filter((b) => b.providerId === provider.id);
  const usedRewards = useMyUsedRewards();
  const rewardLedger = useApp((s) => s.usedRewards);
  const visit = bookings
    .filter((b) => b.providerId === provider.id && b.status === 'completed' && b.customer.email === user?.email)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const bought = new Set(orders.filter((o) => o.customer.email === user?.email).flatMap((o) => o.lines.map((l) => l.productId)));
  const rewards = rewardsForProducts(provider.id, unlockedRewards(stamps, myBookings), usedRewards, rewardLedger);
  const [filter, setFilter] = useState<Filter>('all');

  const hero = products.find((p) => p.kind === 'subscription_box') ?? products.find((p) => p.subscription);
  const filtered = products.filter((p) => {
    if (filter === 'subscribe') return !!p.subscription;
    if (filter === 'pantry') return p.tags.includes('pantry') || p.tags.includes('dates');
    if (filter === 'gift') return p.tags.includes('gift');
    if (filter === 'partner') return p.origin.type === 'partner';
    if (filter === 'commission') return p.kind === 'commission' || p.kind === 'made_to_order';
    return true;
  });
  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Everything' },
    ...(products.some((p) => p.subscription) ? [{ id: 'subscribe' as const, label: 'Subscribe' }] : []),
    ...(products.some((p) => p.tags.includes('pantry') || p.tags.includes('dates')) ? [{ id: 'pantry' as const, label: 'Pantry' }] : []),
    ...(products.some((p) => p.tags.includes('gift')) ? [{ id: 'gift' as const, label: 'Gifts' }] : []),
    ...(products.some((p) => p.origin.type === 'partner') ? [{ id: 'partner' as const, label: 'Partner farms' }] : []),
    ...(products.some((p) => p.kind === 'commission') ? [{ id: 'commission' as const, label: 'Commissions' }] : []),
  ];

  return (
    <AppShell>
      {/* Header */}
      <section className="relative overflow-hidden text-white" style={{ background: cat.theme.deep }}>
        <SmartImage img={provider.hero} width={1800} className="absolute inset-0 opacity-45" category={provider.categoryId} />
        <div className="absolute inset-0" style={{ background: `linear-gradient(100deg, ${cat.theme.deep} 20%, ${cat.theme.deep}aa 55%, transparent)` }} />
        <div className="shell relative py-12 md:py-16">
          <Link to={`/p/${provider.slug}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/70 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> {provider.name}
          </Link>
          <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                <Avatar initials={provider.hostInitials} size={44} color={cat.theme.accent} />
                <div className="text-[13px] text-white/75">
                  {BYLINE[cat.id] ?? 'Made and packed by'} {provider.hostName}
                  <div>
                    <DemoTag className="border-white/30 text-white/60" />
                  </div>
                </div>
              </div>
              <h1 className="display-lg mt-5">{shortProviderName(provider.name)} shop</h1>
              <p className="mt-3 text-[16.5px] text-white/75">{cat.commerce.summary}</p>
            </div>
            {visit ? (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-sm rounded-[24px] bg-white/12 p-5 ring-1 ring-white/20 backdrop-blur-md">
                <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-honey-300">
                  <Sparkles className="h-4 w-4" /> Remembering your visit
                </div>
                <div className="mt-2 text-[15px] leading-snug">
                  Welcome back{user ? `, ${user.firstName}` : ''}. You joined <strong>{EXPERIENCE_BY_ID[visit.experienceId].title}</strong> on {fmtDate(visit.date, 'EEE d MMM')}. Here’s what came out of
                  the same {cat.id === 'farm' ? 'beds' : cat.id === 'honey' ? 'hives' : 'studio'} this week.
                </div>
              </motion.div>
            ) : (
              <div className="max-w-sm rounded-[24px] bg-white/10 p-5 text-[14px] text-white/75 ring-1 ring-white/15 backdrop-blur-md">
                Visited {shortProviderName(provider.name)}? Products you tried during your experience will be highlighted here after check-in.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="shell space-y-14 py-12 pb-28">
        {/* Subscription hero */}
        {hero && <SubscriptionHero product={hero} provider={provider} rewardId={rewards[0]?.id} rewardTitle={rewards[0]?.title} visited={!!visit} />}

        {/* Category specific blocks */}
        {provider.categoryId === 'fragrance' && (
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            {blends.length ? (
              blends.map((b) => <BlendCard key={b.id} blend={b} bottle="top" />)
            ) : (
              <div className="rounded-[28px] border border-dashed border-oud-300 bg-oud-100/40 p-8">
                <div className="font-display text-[26px]">Your Signature Blend lives here</div>
                <p className="mt-2 text-[14.5px] text-ink-2">Create it at a workshop — with your consent the maker saves the approved formula so you can reorder refills and gifts from anywhere.</p>
                <Button className="mt-5" to={`/book/ol-signature`}>
                  Book the Personalised Fragrance Workshop
                </Button>
              </div>
            )}
            <div className="flex flex-col rounded-[28px] bg-ink p-6 text-paper">
              <div className="eyebrow text-paper/50">How refills work</div>
              <ol className="mt-4 space-y-4 text-[14px]">
                {['You blend within the maker’s approved ranges at the workshop.', 'The maker approves and saves the formula reference to your account.', 'Reorder any size, or send it as a gift — re-blended by hand in 3–4 days.'].map((t, i) => (
                  <li key={t} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[12px] font-bold">{i + 1}</span>
                    <span className="text-paper/80">{t}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-auto pt-8">
                <div className="rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10">
                  <div className="font-display text-[22px] leading-tight">Curious about a second scent?</div>
                  <p className="mt-1.5 text-[13.5px] text-paper/65">Tune one of {provider.hostName.split(' ')[0]}’s approved formulas in the Blend Studio and preview it in 3D before you book.</p>
                  <Button to={`/p/${provider.slug}#blend-studio`} variant="light" size="sm" className="mt-4">
                    Open the Blend Studio
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        {provider.categoryId === 'pottery' && <CommissionStudio provider={provider} />}
        {provider.categoryId === 'honey' && (
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { t: 'Batch-tracked', d: 'Every jar carries a batch number — reorder the exact honey you tasted while stock lasts.' },
              { t: 'Harvest-honest', d: 'Seasonal varieties sell out. The monthly club pauses automatically if a harvest falls short.' },
              { t: 'Never sugar-fed', d: 'Colonies move with the bloom; honey for sale is never from sugar feeding.' },
            ].map((x) => (
              <div key={x.t} className="rounded-[24px] border border-honey-200 bg-honey-100/40 p-5">
                <div className="text-[16px] font-semibold">{x.t}</div>
                <div className="mt-1 text-[14px] text-ink-2">{x.d}</div>
              </div>
            ))}
          </div>
        )}
        {provider.categoryId === 'coastal' && (
          <div className="rounded-[28px] bg-sea-800 p-6 text-white md:p-8">
            <div className="grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-center">
              <div>
                <div className="eyebrow text-white/50">Why no subscription here</div>
                <div className="mt-2 font-display text-[28px] leading-tight">The sea isn’t a production line.</div>
                <p className="mt-2 text-[14.5px] text-white/70">
                  Fishing families earn more reliably from repeat experiences, season passes and group days than from forced product subscriptions. Seafood is only sold through licensed partners.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button variant="light" to="/book/hh-crew" icon={<Users className="h-4 w-4" />}>
                  Plan a group day
                </Button>
                <Button variant="glass" to="/book/hh-sail">
                  Book the sunset dhow again
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* All products */}
        <div>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-display text-[30px] tracking-tight">Everything from {shortProviderName(provider.name)}</h2>
              <p className="mt-1 text-[14px] text-ink-3">Fulfilled by the host · Fadhal takes a 10% commission on product sales</p>
            </div>
            {filters.length > 1 && <Tabs value={filter} onChange={setFilter} items={filters} size="sm" />}
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((p) => (
              <ProductCard key={p.id} prod={p} compact highlight={bought.has(p.id) ? 'You bought this' : visit && p.hotspotId && EXPERIENCE_BY_ID[visit.experienceId].hotspotId === p.hotspotId ? 'From your visit' : undefined} />
            ))}
          </div>
        </div>

        {/* Delivery */}
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Truck, t: 'Delivered by the host', d: 'Next-day across Sharjah, Dubai and Ajman. 2–3 days elsewhere in the UAE.' },
            { icon: Leaf, t: 'Reusable packaging', d: 'Produce crates and jars are collected on your next delivery.' },
            { icon: PackageCheck, t: 'Honest stock', d: 'Quantities reflect real harvests and kiln loads — not unlimited inventory.' },
          ].map((x) => (
            <div key={x.t} className="flex gap-3 rounded-[22px] bg-white p-5 shadow-ring">
              <x.icon className="h-5 w-5 shrink-0 text-ink-2" />
              <div>
                <div className="text-[14.5px] font-semibold">{x.t}</div>
                <div className="mt-0.5 text-[13.5px] text-ink-2">{x.d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function SubscriptionHero({ product, provider, rewardId, rewardTitle, visited }: { product: Product; provider: Provider; rewardId?: string; rewardTitle?: string; visited: boolean }) {
  const plan = product.subscription!;
  const [freq, setFreq] = useState<Frequency>(plan.frequencies[0]);
  const add = useApp((s) => s.addProductToCart);
  const subs = useApp((s) => s.subscriptions.filter((x) => x.productId === product.id && x.status === 'active').length);
  const setCart = useUI((s) => s.setCartOpen);
  const cat = CATEGORY_BY_ID[provider.categoryId];
  const contents = BOX_CONTENTS[product.id];
  const taken = Math.min(plan.capacity, Math.round(plan.capacity * 0.68) + subs);
  const monthly = freq === 'weekly' ? plan.price * 4 : freq === 'fortnightly' ? plan.price * 2 : plan.price;
  const visitPrice = 450;

  return (
    <div className="overflow-hidden rounded-[32px] border border-line bg-white shadow-soft">
      <div className="grid lg:grid-cols-[1fr_1.1fr]">
        <div className="relative min-h-[300px]">
          <SmartImage img={product.image} width={1100} className="absolute inset-0" category={product.categoryId} />
          <div className="absolute left-4 top-4 flex flex-col gap-2">
            <Badge tone="dark" icon={<Repeat className="h-3 w-3" />}>
              Subscription
            </Badge>
            {visited && <Badge tone="honey">Same beds you harvested</Badge>}
          </div>
        </div>
        <div className="p-6 md:p-9">
          <div className="text-[12.5px] font-bold uppercase tracking-[0.14em]" style={{ color: cat.theme.accent }}>
            {HERO_EYEBROW[cat.id] ?? 'Keep it coming'}
          </div>
          <h2 className="mt-2 font-display text-[34px] leading-tight tracking-tight">{product.name}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{product.description}</p>

          {contents && (
            <div className="mt-5">
              <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-3">In this week’s box</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(contents).map(([crop, kg]) => (
                  <span key={crop} className="inline-flex items-center gap-1.5 rounded-full bg-sand-50 px-3 py-1.5 text-[12.5px] font-medium ring-1 ring-inset ring-line">
                    <span className="h-2 w-2 rounded-full" style={{ background: CROP_BY_ID[crop]?.color }} />
                    {CROP_BY_ID[crop]?.name ?? crop} · {kg >= 1 ? `${kg} kg` : `${Math.round(kg * 1000)} g`}
                  </span>
                ))}
                <span className="rounded-full bg-sand-50 px-3 py-1.5 text-[12.5px] font-medium text-ink-3 ring-1 ring-inset ring-line">+ a greenhouse surprise</span>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {plan.frequencies.map((f) => (
              <button key={f} onClick={() => setFreq(f)} className={cn('chip capitalize', freq === f && 'chip-active')}>
                {f}
              </button>
            ))}
          </div>
          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <div className="tabular font-display text-[40px] leading-none">{aed(plan.price)}</div>
              <div className="mt-1 text-[13px] text-ink-3">
                per {product.kind === 'subscription_box' ? 'box' : 'delivery'} · {aed(product.price - plan.price)} less than one-off · ≈ {aed(monthly)} / month
              </div>
            </div>
            <Button
              size="lg"
              onClick={() => {
                add(product.id, { subscribe: freq, rewardId });
                setCart(true);
              }}
              iconRight={<ArrowRight className="h-4 w-4" />}
            >
              Subscribe
            </Button>
          </div>
          {rewardTitle && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-oasis-50 px-3 py-2.5 text-[13px] text-oasis-700">
              <Gift className="h-4 w-4" /> Passport reward ready: {rewardTitle}
            </div>
          )}
          <div className="mt-5">
            <div className="flex items-center justify-between text-[12.5px] text-ink-3">
              <span>
                {taken} of {plan.capacity} subscriber places taken
              </span>
              <span>Capped to what the farm can reliably grow</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand-100">
              <div className="h-full rounded-full" style={{ width: `${(taken / plan.capacity) * 100}%`, background: cat.theme.accent }} />
            </div>
          </div>
          {provider.categoryId === 'farm' && (
            <div className="mt-6 rounded-2xl bg-ink p-4 text-[13.5px] text-paper">
              <div className="flex flex-wrap items-center gap-1.5 font-semibold">
                {['Visit', 'Experience', 'Purchase', 'Subscribe', 'Repeat'].map((w, i) => (
                  <span key={w} className="inline-flex items-center gap-1.5">
                    {w}
                    {i < 4 && <ArrowRight className="h-3 w-3 text-paper/40" />}
                  </span>
                ))}
              </div>
              <div className="mt-1.5 text-paper/65">
                A {aed(visitPrice)} Family Farm Day + four weekly boxes = <strong className="text-honey-300">{aed(visitPrice + plan.price * 4)}</strong> for the farm in the first month — before costs and commission.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const BYLINE: Record<string, string> = {
  farm: 'Grown, picked and packed by',
  honey: 'Harvested and jarred by',
  pottery: 'Thrown, fired and packed by',
  coastal: 'Hosted by',
  fragrance: 'Blended and packed by',
};

const HERO_EYEBROW: Record<string, string> = {
  farm: 'Keep the farm in your kitchen',
  honey: 'Keep the wadi in your kitchen',
  pottery: 'Keep the studio on your table',
  coastal: 'Keep the coast close',
  fragrance: 'Keep your scent close',
};

const FORMS = [
  { id: 'mug', label: 'Mug', params: { height: 0.45, belly: 0.35, neck: 0.85, lip: 0.4 } },
  { id: 'bowl', label: 'Bowl', params: { height: 0.15, belly: 0.8, neck: 1, lip: 0.7 } },
  { id: 'vase', label: 'Vase', params: { height: 0.9, belly: 0.75, neck: 0.25, lip: 0.45 } },
  { id: 'jar', label: 'Water jar', params: { height: 0.75, belly: 0.95, neck: 0.35, lip: 0.3 } },
] as const;
const GLAZES = [
  { id: 'sand', label: 'Sand', color: '#D9C2A0' },
  { id: 'gulf', label: 'Gulf blue', color: '#2D5E86' },
  { id: 'celadon', label: 'Celadon', color: '#9DB9A2' },
  { id: 'charcoal', label: 'Charcoal', color: '#3A3634' },
  { id: 'terracotta', label: 'Terracotta', color: '#B5653C' },
] as const;

function CommissionStudio({ provider }: { provider: Provider }) {
  const [form, setForm] = useState<(typeof FORMS)[number]>(FORMS[0]);
  const [glaze, setGlaze] = useState<(typeof GLAZES)[number]['id']>('gulf');
  const [params, setParams] = useState<{ height: number; belly: number; neck: number; lip: number }>({ ...FORMS[0].params });
  const [text, setText] = useState('');
  const add = useApp((s) => s.addProductToCart);
  const toast = useUI((s) => s.toast);
  const commissionId = useMemo(() => (text ? 'fh-custom' : 'fh-matching'), [text]);
  if (provider.id !== 'fakhar-house') return null;
  return (
    <div className="overflow-hidden rounded-[32px] border border-line bg-white shadow-soft">
      <div className="grid lg:grid-cols-[1.1fr_1fr]">
        <div className="relative min-h-[380px] bg-[#2a1d14]">
          <Suspense fallback={<div className="absolute inset-0 animate-pulse bg-[#3a2a1e]" />}>
            <ClayStudio {...params} glaze={glaze} handle={form.id === 'mug'} className="absolute inset-0" />
          </Suspense>
          <span className="absolute left-4 top-4 rounded-full bg-black/45 px-3 py-1.5 text-[11.5px] font-semibold text-white backdrop-blur-md">Live preview · illustrative</span>
        </div>
        <div className="p-6 md:p-9">
          <div className="eyebrow">Commission a piece</div>
          <h2 className="mt-2 font-display text-[32px] leading-tight tracking-tight">Shape it here. Latifa throws it by hand.</h2>
          <p className="mt-2 text-[14.5px] text-ink-2">Choose a form and glaze, tune the proportions, add a name or date to carve. Every commission is wheel-thrown, bisque fired, glazed and glaze fired — about four weeks.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {FORMS.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setForm(f);
                  setParams({ ...f.params });
                }}
                className={cn('chip', form.id === f.id && 'chip-active')}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {(['height', 'belly', 'neck', 'lip'] as const).map((k) => (
              <label key={k} className="block">
                <span className="flex justify-between text-[12.5px] font-semibold capitalize text-ink-2">
                  {k}
                  <span className="tabular text-ink-3">{Math.round(params[k] * 100)}</span>
                </span>
                <input type="range" min={0} max={1} step={0.01} value={params[k]} onChange={(e) => setParams({ ...params, [k]: Number(e.target.value) })} className="mt-1.5 w-full accent-clay-500" />
              </label>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {GLAZES.map((g) => (
              <button key={g.id} onClick={() => setGlaze(g.id)} className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold', glaze === g.id ? 'border-ink' : 'border-line')}>
                <span className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ background: g.color }} />
                {g.label}
                {glaze === g.id && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
          <input value={text} onChange={(e) => setText(e.target.value.slice(0, 24))} placeholder="Carve a name or date (optional)" className="input mt-5" />
          <div className="mt-5 flex items-center justify-between gap-4">
            <div className="text-[13.5px] text-ink-2">
              {text ? 'Personalised commission' : 'Matching piece'} · from <span className="font-semibold text-ink">{aed(text ? 350 : 150)}</span> · 30% deposit refundable until throwing starts
            </div>
            <Button
              onClick={() => {
                add(commissionId);
                toast({ title: 'Commission added', body: `${form.label} in ${GLAZES.find((g) => g.id === glaze)?.label} glaze — Latifa will confirm the design.`, tone: 'success' });
              }}
            >
              Commission
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
