import {
  ArrowRight,
  BadgeCheck,
  BedDouble,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileWarning,
  Globe2,
  HeartHandshake,
  Leaf,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
} from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { QuickBook } from '@/components/provider/QuickBook';
import { ProductCard, SaveButton } from '@/components/cards/Cards';
import { SmartImage } from '@/components/ui/SmartImage';
import { Avatar, Badge, DemoTag, Reveal, Stars } from '@/components/ui/primitives';
import { Button } from '@/components/ui/Button';
import { HotspotDetails } from '@/components/three/ExperienceViewer';
import { BlendStudio } from '@/components/fragrance/BlendStudio';
import { FORMULAS } from '@/data/catalog/fragrance';
import { SharjahMap } from '@/components/map/SharjahMap';
import { CategoryIcon } from '@/components/brand/CategoryIcon';
import { CATEGORY_BY_ID } from '@/data/categories';
import { PROVIDER_BY_SLUG, experiencesForProvider, presalesForProvider, productsForProvider, reviewsForProvider } from '@/data/catalog';
import { REGION_BY_ID, driveMinutes } from '@/data/regions';
import type { Experience, PresaleOffer, Provider } from '@/data/types';
import { useApp, useAvailabilityCtx } from '@/store/app';
import { useUI } from '@/store/ui';
import { upcomingOpenDates } from '@/services/availability';
import { aed, fmtDate, fmtDuration, fmtTime } from '@/lib/format';
import { cn, shortProviderName } from '@/lib/utils';
import NotFound from './NotFound';

const ExperienceViewer = lazy(() => import('@/components/three/ExperienceViewer').then((m) => ({ default: m.ExperienceViewer })));

export default function ProviderPage() {
  const { slug = '' } = useParams();
  const provider = PROVIDER_BY_SLUG[slug];
  if (!provider) return <NotFound />;
  return <ProviderView key={provider.id} provider={provider} />;
}

function ProviderView({ provider }: { provider: Provider }) {
  const cat = CATEGORY_BY_ID[provider.categoryId];
  const region = REGION_BY_ID[provider.regionId];
  const exps = experiencesForProvider(provider.id);
  const products = productsForProvider(provider.id);
  const reviews = reviewsForProvider(provider.id);
  const presales = presalesForProvider(provider.id);
  const [active, setActive] = useState<string | null>(null);
  const activeRecord = provider.scene.hotspots.find((h) => h.id === active) ?? null;
  const nav = useNavigate();

  return (
    <AppShell>
      {/* ------------------------------ Title + 3D venue (hero) ------------------------------
          The venue in 3D is the first thing guests see. Desktop: one grid — title across, viewer filling the
          rest of the first screen, pins alongside. Phones/tablets: title + viewer fill the screen above the
          fixed booking bar with the viewer taking what's left. Phones: 64px nav, bar top 129px from the bottom
          (it sits on the tab bar); tablets: 72px nav, no tab bar, so the bar top is 69px from the bottom. */}
      <section
        className="shell lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_clamp(500px,calc(100svh_-_250px),780px)] lg:gap-x-4"
        id="explore-3d"
      >
        <div className="flex min-h-[calc(100svh_-_193px)] flex-col pb-3 md:min-h-[calc(100svh_-_141px)] lg:contents">
          <div className="pb-5 pt-5 md:pt-6 lg:col-span-2">
            <nav className="hidden items-center gap-1.5 text-[12.5px] font-medium text-ink-3 sm:flex">
              <Link to="/experiences" className="hover:text-ink">
                Experiences
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <Link to={`/c/${cat.id}`} className="hover:text-ink">
                {cat.shortName}
              </Link>
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate text-ink">{provider.name}</span>
            </nav>
            <div className="flex flex-col gap-3 sm:mt-3 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <h1 className="font-display text-[32px] leading-[1.04] tracking-tight md:text-[44px]">{provider.name}</h1>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px] text-ink-2">
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: cat.theme.accent }}>
                    <CategoryIcon id={cat.id} className="h-4 w-4" /> {cat.name}
                  </span>
                  <Stars value={provider.rating} count={provider.reviewCount} />
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-ink-3" /> {provider.locationLabel}
                  </span>
                  {provider.arabicName && <span className="font-arabic text-[17px] text-ink-3">{provider.arabicName}</span>}
                  {provider.badges.length > 0 && (
                    <span className="flex flex-wrap items-center gap-2">
                      {provider.badges.map((b) => (
                        <Badge key={b} tone="neutral">
                          {b}
                        </Badge>
                      ))}
                    </span>
                  )}
                  <DemoTag className="hidden md:inline-flex" />
                </div>
              </div>
              {/* On phones the demo tag shares the actions row, keeping the header short so the 3D view stays in the first screen */}
              <div className="flex shrink-0 items-center justify-between gap-2 md:justify-end">
                <DemoTag className="md:hidden" />
                <div className="flex items-center gap-2">
                  <SaveButton id={provider.id} className="h-11 w-11 shadow-ring" />
                  <Button variant="outline" to={`/p/${provider.slug}/shop`} icon={<Store className="h-4 w-4" />}>
                    Host shop
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <div className="relative min-h-[300px] flex-1 overflow-hidden rounded-[28px]">
            <Suspense fallback={<div className="absolute inset-0 animate-pulse rounded-[28px]" style={{ background: cat.theme.gradient }} />}>
              <ExperienceViewer provider={provider} active={active} onSelect={setActive} panel={false} className="absolute inset-0" />
            </Suspense>
          </div>
        </div>
        <div className="mt-1 rounded-[28px] border border-line bg-white p-5 lg:mt-0 lg:min-h-0 lg:overflow-y-auto">
          {activeRecord ? (
            <HotspotDetails record={activeRecord} accent={cat.theme.accent} onClose={() => setActive(null)} />
          ) : (
            <div>
              <div className="eyebrow">Step inside</div>
              <h2 className="mt-1.5 font-display text-[22px] leading-tight tracking-tight">Explore {shortProviderName(provider.name)} in 3D</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">Tap a pin to see what happens there — details, prices and slots come straight from the host’s records.</p>
              <div className="mt-5 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-3">Inside this venue</div>
              <div className="mt-2 space-y-1">
                {provider.scene.hotspots.map((h, i) => (
                  <button key={h.id} onClick={() => setActive(h.id)} className="group flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition hover:bg-sand-50">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ background: cat.theme.accent }}>
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold">{h.title}</span>
                      <span className="block truncate text-[12.5px] text-ink-3">{h.kicker} · {h.summary}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-ink-4 transition group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
              <p className="mt-4 text-[11.5px] leading-relaxed text-ink-4">Rendered environments are illustrative previews, not verified representations of the property.</p>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------ Body ------------------------------ */}
      <section className="shell mt-10 grid gap-12 pb-28 lg:grid-cols-[1fr_400px] lg:gap-16">
        <div className="min-w-0">
          {/* Host */}
          <div className="flex items-center gap-4 border-b border-line pb-8">
            <Avatar initials={provider.hostInitials} size={58} color={cat.theme.accent} />
            <div className="min-w-0 flex-1">
              <div className="text-[17px] font-semibold">Hosted by {provider.hostName}</div>
              <div className="text-[13.5px] text-ink-3">
                {provider.hostRole} · {provider.responseTime} · Speaks {provider.languages.join(', ')}
              </div>
            </div>
            <Button variant="outline" size="sm" icon={<MessageCircle className="h-4 w-4" />} onClick={() => useUI.getState().toast({ title: 'Messaging is simulated in this demo', body: `${provider.hostName} would usually reply within the stated time.` })}>
              Message
            </Button>
          </div>

          {/* Highlights */}
          <div className="grid gap-4 border-b border-line py-8 sm:grid-cols-2">
            {[
              provider.overnight && { icon: BedDouble, t: 'Overnight stays available', d: 'Book the whole property for your group.' },
              provider.familyFriendly && { icon: Users, t: 'Great for families', d: 'Activities designed for children and grown-ups.' },
              { icon: HeartHandshake, t: 'Meet the people behind it', d: `${provider.hostName} hosts every experience personally.` },
              { icon: Leaf, t: provider.sustainability[0], d: provider.sustainability.slice(1).join(' · ') || 'Responsible hosting practices.' },
            ]
              .filter(Boolean)
              .slice(0, 4)
              .map((h) => {
                const x = h as { icon: typeof Users; t: string; d: string };
                return (
                  <div key={x.t} className="flex gap-3.5">
                    <x.icon className="mt-0.5 h-5 w-5 shrink-0 text-ink-2" />
                    <div>
                      <div className="text-[15px] font-semibold">{x.t}</div>
                      <div className="text-[13.5px] text-ink-3">{x.d}</div>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Story */}
          <div className="border-b border-line py-8">
            <h2 className="font-display text-[28px] tracking-tight">The story</h2>
            <div className="mt-4 space-y-4 text-[16px] leading-relaxed text-ink-2">
              {provider.story.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </div>

          {/* Photos */}
          <div className="border-b border-line py-8">
            <h2 className="font-display text-[28px] tracking-tight">A look around</h2>
            <div className="relative mt-5 grid h-[280px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-[24px] md:h-[400px]">
              <SmartImage img={provider.hero} width={1100} className="col-span-4 row-span-2 md:col-span-2" category={provider.categoryId} />
              {provider.gallery.slice(0, 4).map((g, i) => (
                <SmartImage key={i} img={g} width={600} className={cn('hidden md:block', i > 1 && 'md:col-span-1')} category={provider.categoryId} />
              ))}
              <span className="absolute bottom-3 left-3 rounded-full bg-black/45 px-3 py-1 text-[11.5px] font-semibold text-white backdrop-blur-md">Illustrative photography</span>
            </div>
          </div>

          {/* Fragrance: tune an approved formula before booking */}
          {provider.categoryId === 'fragrance' && FORMULAS.some((f) => f.providerId === provider.id) && (
            <div className="border-b border-line py-8" id="blend-studio">
              <BlendStudio providerId={provider.id} />
            </div>
          )}

          {/* Experiences */}
          <div className="border-b border-line py-8" id="experiences">
            <h2 className="font-display text-[28px] tracking-tight">Experiences & stays</h2>
            <div className="mt-6 space-y-4">
              {exps.map((e, i) => (
                <Reveal key={e.id} delay={i * 0.04}>
                  <ExperienceRow e={e} />
                </Reveal>
              ))}
            </div>
          </div>

          {/* Presale */}
          {presales.map((o) => (
            <PresaleCard key={o.id} offer={o} accent={cat.theme.accent} />
          ))}

          {/* Products */}
          {products.length > 0 && (
            <div className="border-b border-line py-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="font-display text-[28px] tracking-tight">From the {cat.id === 'farm' ? 'farm' : 'host'} shop</h2>
                  <p className="mt-1 text-[14px] text-ink-3">{cat.commerce.summary}</p>
                </div>
                <Link to={`/p/${provider.slug}/shop`} className="hidden shrink-0 items-center gap-1 text-[14px] font-semibold text-ink underline-offset-4 hover:underline sm:inline-flex">
                  Visit shop <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3">
                {products.slice(0, 6).map((p) => (
                  <ProductCard key={p.id} prod={p} compact />
                ))}
              </div>
            </div>
          )}

          {/* Facilities & safety */}
          <div className="grid gap-8 border-b border-line py-8 md:grid-cols-2">
            <div>
              <h3 className="font-display text-[22px] tracking-tight">Facilities</h3>
              <ul className="mt-4 space-y-2.5">
                {provider.facilities.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-[14.5px] text-ink-2">
                    <CheckCircle2 className="h-4 w-4 text-oasis-500" /> {f}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-display text-[22px] tracking-tight">Safety</h3>
              <ul className="mt-4 space-y-2.5">
                {provider.safety.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[14.5px] text-ink-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sea-500" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Cancellation + verification */}
          <div className="grid gap-8 border-b border-line py-8 md:grid-cols-2">
            <div>
              <h3 className="font-display text-[22px] tracking-tight">Cancellation</h3>
              <p className="mt-3 text-[14.5px] font-semibold">{provider.cancellation.summary}</p>
              <ul className="mt-2 space-y-1.5 text-[14px] text-ink-2">
                {provider.cancellation.rules.map((r) => (
                  <li key={r}>· {r}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-display text-[22px] tracking-tight">Licences & verification</h3>
              <div className="mt-3 rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-4">
                <div className="flex items-center gap-2 text-[13.5px] font-semibold text-amber-900">
                  <FileWarning className="h-4 w-4" /> Demo host — not yet verified
                </div>
                <ul className="mt-2 space-y-2 text-[13px] text-amber-900/80">
                  {provider.licences.map((l) => (
                    <li key={l.label}>
                      <span className="font-semibold">{l.label}:</span> {l.note}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Reviews */}
          <div className="border-b border-line py-8">
            <div className="flex items-end justify-between">
              <h2 className="font-display text-[28px] tracking-tight">What guests say</h2>
              <Badge tone="warning">Simulated reviews · demo data</Badge>
            </div>
            {reviews.length ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {reviews.map((r) => (
                  <figure key={r.id} className="rounded-[24px] border border-line bg-white p-5">
                    <div className="flex items-center gap-3">
                      <Avatar initials={r.author.split(' ').map((p) => p[0]).join('').slice(0, 2)} size={38} color="#857A6C" />
                      <div>
                        <div className="text-[14px] font-semibold">{r.author}</div>
                        <div className="text-[12px] text-ink-3">
                          {r.origin} · {r.monthsAgo} month{r.monthsAgo > 1 ? 's' : ''} ago
                        </div>
                      </div>
                    </div>
                    <blockquote className="mt-3 text-[14.5px] leading-relaxed text-ink-2">“{r.text}”</blockquote>
                  </figure>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-[14px] text-ink-3">New on LocalDays — no reviews yet.</p>
            )}
          </div>

          {/* Location */}
          <div className="py-8">
            <h2 className="font-display text-[28px] tracking-tight">Where you’ll be</h2>
            <p className="mt-2 text-[14.5px] text-ink-2">
              {provider.locationLabel} — {region.blurb} Exact address shared after booking.
            </p>
            <div className="mt-5 grid gap-5 md:grid-cols-[1.4fr_1fr]">
              <div className="overflow-hidden rounded-[24px] border border-line">
                <SharjahMap pins={[{ regionId: provider.regionId, color: cat.theme.accent }]} selected={provider.regionId} className="aspect-[4/3]" />
              </div>
              <div className="space-y-2">
                {(['sharjah-city', 'al-dhaid', 'khor-fakkan'] as const)
                  .filter((r) => r !== provider.regionId)
                  .map((r) => (
                    <div key={r} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-ring">
                      <span className="text-[14px] font-medium">From {REGION_BY_ID[r].name}</span>
                      <span className="tabular text-[14px] font-semibold">≈ {driveMinutes(r, provider.regionId)} min drive</span>
                    </div>
                  ))}
                <div className="flex items-center gap-2 rounded-2xl bg-sand-100 px-4 py-3 text-[13px] text-ink-2">
                  <Globe2 className="h-4 w-4" /> Drive times are estimates for planning only.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky booking card */}
        <aside className="hidden lg:block">
          <div className="sticky top-[96px]">
            <QuickBook provider={provider} />
            <Link
              to="/compose"
              className="mt-4 flex items-center gap-3 rounded-[22px] border border-line bg-white p-4 transition hover:shadow-soft"
            >
              <Sparkles className="h-5 w-5 text-clay-500" />
              <span className="flex-1 text-[13.5px]">
                <span className="block font-semibold">Make a day of it</span>
                <span className="text-ink-3">Day Composer pairs {shortProviderName(provider.name)} with nearby hosts.</span>
              </span>
              <ChevronRight className="h-4 w-4 text-ink-4" />
            </Link>
          </div>
        </aside>
      </section>

      {/* Mobile booking bar */}
      <div className="fixed inset-x-0 bottom-[60px] z-30 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur-xl md:bottom-0 md:pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[12px] text-ink-3">From</div>
            <div className="tabular text-[17px] font-semibold">{aed(Math.min(...exps.map((e) => (e.priceUnit === 'per_booking' ? Math.round(e.price / (e.includedGuests ?? 1)) : e.price))))} <span className="text-[12px] font-normal text-ink-3">/ guest</span></div>
          </div>
          <Button onClick={() => nav(`/book/${exps[0].id}`)}>Check availability</Button>
        </div>
      </div>
    </AppShell>
  );
}

function ExperienceRow({ e }: { e: Experience }) {
  const ctx = useAvailabilityCtx();
  const dates = useMemo(() => upcomingOpenDates(e, Math.min(2, e.maxGuests), ctx, 4), [e, ctx]);
  return (
    <div className="group flex flex-col gap-4 rounded-[26px] border border-line bg-white p-3 transition hover:shadow-soft sm:flex-row">
      <Link to={`/book/${e.id}`} className="relative block shrink-0 overflow-hidden rounded-[20px] sm:w-[220px]">
        <SmartImage img={e.image} aspect={4 / 3} width={500} className="aspect-[4/3] h-full sm:aspect-auto" category={e.categoryId} zoom />
        {e.tags.includes('bestseller') && <span className="absolute left-2.5 top-2.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-ink shadow-soft">Most booked</span>}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col px-1 pb-1 sm:py-2 sm:pr-3">
        <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold text-ink-3">
          <span className="capitalize">{e.kind === 'boat' ? 'Licensed boat trip' : e.kind}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {e.priceUnit === 'per_night' ? `Check-in ${e.stay?.checkIn}` : fmtDuration(e.durationMins)}
          </span>
          {e.minAge && (
            <>
              <span>·</span>
              <span>Ages {e.minAge}+</span>
            </>
          )}
          {e.seasonal && <Badge tone="honey">{e.seasonal}</Badge>}
        </div>
        <Link to={`/book/${e.id}`} className="mt-1.5 font-display text-[22px] leading-tight tracking-tight hover:underline hover:decoration-ink/20 hover:underline-offset-4">
          {e.title}
        </Link>
        <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-ink-2">{e.summary}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {dates.map((d) => (
            <Link
              key={d.date}
              to={`/book/${e.id}?date=${d.date}${d.slots[0]?.time ? `&time=${d.slots.find((s) => s.remaining >= 2)?.time ?? d.slots[0].time}` : ''}`}
              className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold transition hover:border-ink"
            >
              {fmtDate(d.date, 'EEE d')}
              {d.slots[0]?.time && <span className="font-medium text-ink-3"> · {fmtTime(d.slots.find((s) => s.remaining >= 2)?.time ?? d.slots[0].time)}</span>}
            </Link>
          ))}
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div className="text-[14px]">
            <span className="tabular text-[18px] font-semibold">{aed(e.price)}</span>{' '}
            <span className="text-ink-3">
              {e.priceUnit === 'per_guest' ? '/ guest' : e.priceUnit === 'per_night' ? '/ night' : `/ ${e.includedGuests} guests`}
              {e.childPrice && e.childPrice !== e.price ? ` · children ${aed(e.childPrice)}` : ''}
            </span>
          </div>
          <Button to={`/book/${e.id}`} size="sm" variant="dark" iconRight={<ArrowRight className="h-3.5 w-3.5" />}>
            Book
          </Button>
        </div>
      </div>
    </div>
  );
}

function PresaleCard({ offer, accent }: { offer: PresaleOffer; accent: string }) {
  const sold = offer.soldUnits + (useApp((s) => s.presaleSold[offer.id]) ?? 0);
  const paused = useApp((s) => s.host.presalePaused.includes(offer.id));
  const add = useApp((s) => s.addPresaleToCart);
  const setCart = useUI((s) => s.setCartOpen);
  const left = Math.max(0, offer.totalUnits - sold);
  return (
    <div className="border-b border-line py-8">
      <div className="relative overflow-hidden rounded-[28px] bg-ink p-6 text-paper md:p-8">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-30 blur-3xl" style={{ background: accent }} />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-md">
            <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.16em] text-honey-300">
              <BadgeCheck className="h-4 w-4" /> Prepaid experience · limited
            </div>
            <h3 className="mt-2 font-display text-[26px] leading-tight">{offer.title}</h3>
            <p className="mt-2 text-[14px] text-paper/65">
              Buy now, book any open slot later. Helps the host plan the season; you save {aed(offer.regularPrice - offer.presalePrice)}.
            </p>
            <details className="mt-3 text-[13px] text-paper/60">
              <summary className="cursor-pointer font-semibold text-paper/80">Terms, expiry & refunds</summary>
              <ul className="mt-2 space-y-1">
                {offer.terms.map((t) => (
                  <li key={t}>· {t}</li>
                ))}
                <li>· Offered within approved capacity: {offer.approvedCapacityNote}.</li>
              </ul>
            </details>
          </div>
          <div className="shrink-0 rounded-[22px] bg-white/[0.07] p-5 ring-1 ring-white/10 md:w-[240px]">
            <div className="flex items-baseline gap-2">
              <span className="tabular font-display text-[34px] leading-none">{aed(offer.presalePrice)}</span>
              <span className="text-[14px] text-paper/45 line-through">{aed(offer.regularPrice)}</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-honey-300" style={{ width: `${(sold / offer.totalUnits) * 100}%` }} />
            </div>
            <div className="mt-1.5 text-[12px] text-paper/55">
              {left} of {offer.totalUnits} left
            </div>
            <Button
              className="mt-4"
              block
              variant="light"
              disabled={left === 0 || paused}
              onClick={() => {
                add(offer.id, 1);
                setCart(true);
              }}
            >
              {paused ? 'Paused by host' : left === 0 ? 'Sold out' : 'Buy prepaid experience'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
