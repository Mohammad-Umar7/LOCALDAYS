import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, BadgeCheck, CalendarCheck2, Compass, HandCoins, Mic, Repeat, ShieldCheck, Sparkles, Store, Ticket } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CATEGORIES } from '@/data/categories';
import { EXPERIENCE_BY_ID, EXPERIENCES, PRODUCT_BY_ID, PROVIDER_BY_ID, providersByCategory, startingPrice } from '@/data/catalog';
import { REWARDS, CHALLENGES } from '@/data/passport';
import { driveMinutes, REGION_BY_ID } from '@/data/regions';
import { useAvailabilityCtx, useApp, useMyStamps } from '@/store/app';
import { getSlots } from '@/services/availability';
import { composeDay, parseIntent } from '@/services/intelligence/composer';
import { upcomingWeekend, rangeISO, daysBetween } from '@/lib/dates';
import { aed, fmtDate, fmtTime } from '@/lib/format';
import { ECONOMICS } from '@/config/economics';
import { cn } from '@/lib/utils';
import { Button } from '../ui/Button';
import { SectionHeader, Reveal, Badge } from '../ui/primitives';
import { SmartImage } from '../ui/SmartImage';
import { CategoryCard, ExperienceCard, ProductCard } from '../cards/Cards';
import { Stamp } from '../passport/Stamp';
import { CategoryIcon } from '../brand/CategoryIcon';

const ExperienceViewer = lazy(() => import('../three/ExperienceViewer').then((m) => ({ default: m.ExperienceViewer })));

/* --------------------------------- Categories --------------------------------- */

export function CategoriesSection() {
  return (
    <section className="relative py-20 md:py-28">
      <div className="shell">
        <SectionHeader
          eyebrow="Five living traditions"
          title={
            <>
              Choose how you want to <span className="serif-italic text-clay-500">live</span> Sharjah.
            </>
          }
          description="Every path leads to real hosts with real availability — and to the products and relationships that continue after your visit."
          action={
            <Button to="/experiences" variant="outline" iconRight={<ArrowRight className="h-4 w-4" />}>
              All experiences
            </Button>
          }
        />
      </div>
      <div className="no-scrollbar mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:px-6 md:mx-auto md:grid md:max-w-[1360px] md:grid-cols-5 md:gap-5 md:overflow-visible md:px-6 md:pb-0 lg:px-10">
        {CATEGORIES.map((c, i) => {
          const hosts = providersByCategory(c.id);
          return (
            <Reveal key={c.id} delay={i * 0.06} className="contents md:block">
              <CategoryCard c={c} index={i} hostCount={hosts.length} from={Math.min(...hosts.map((h) => startingPrice(h.id)))} />
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------ Composer teaser ------------------------------ */

const PROMPTS = [
  'A slow Saturday with my parents — dates, the sea, under AED 800',
  'Something hands-on for two kids this weekend, morning only',
  'Romantic evening: fragrance workshop then dinner',
  'Bees and pottery tomorrow, we have a car',
];

export function ComposerTeaser() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  return (
    <section className="relative overflow-hidden bg-ink py-20 text-paper md:py-28">
      <div className="pattern-girih-light absolute inset-0 opacity-50" />
      <div className="absolute -left-40 top-10 h-96 w-96 rounded-full bg-clay-500/25 blur-[120px]" />
      <div className="absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-honey-400/15 blur-[110px]" />
      <div className="shell relative grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-honey-300">
            <Sparkles className="h-3.5 w-3.5" /> LocalDays Intelligence · Day Composer
          </div>
          <h2 className="display-lg mt-6 text-balance">
            Describe your day.
            <br />
            <span className="serif-italic text-honey-300">We’ll compose it.</span>
          </h2>
          <p className="mt-5 max-w-lg text-[16.5px] leading-relaxed text-paper/70">
            Not a chatbot. Tell us who’s coming, when, and what you love — the composer checks live availability across all hosts, plans the drive between regions,
            respects your budget and builds a bookable day in seconds.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              nav(`/compose?q=${encodeURIComponent(q || PROMPTS[0])}`);
            }}
            className="mt-8 flex items-center gap-2 rounded-full bg-white p-1.5 pl-5 text-ink shadow-float"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-clay-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={PROMPTS[0]}
              className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none placeholder:text-ink-4"
              aria-label="Describe your perfect day"
            />
            <button type="button" aria-label="Speak" onClick={() => nav('/compose?voice=1')} className="hidden h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-ink/5 sm:flex">
              <Mic className="h-4 w-4" />
            </button>
            <button className="flex h-11 items-center gap-2 rounded-full bg-clay-500 px-5 text-[14px] font-semibold text-white hover:bg-clay-600">
              Compose <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {PROMPTS.slice(1).map((p) => (
              <Link key={p} to={`/compose?q=${encodeURIComponent(p)}`} className="rounded-full border border-white/15 px-3 py-1.5 text-[12.5px] text-paper/75 transition hover:border-white/40 hover:text-paper">
                {p}
              </Link>
            ))}
          </div>
        </div>
        <ComposerPreview />
      </div>
    </section>
  );
}

function ComposerPreview() {
  // Computed live by the same engine as /compose — never a canned mock-up
  const ctx = useAvailabilityCtx();
  const stamps = useMyStamps();
  const plan = useMemo(() => composeDay(parseIntent(PROMPTS[0], ctx.todayISO, stamps.map((s) => s.categoryId)), ctx, stamps), [ctx, stamps]);
  const { intent } = plan;
  const guests = intent.adults + intent.children;
  const hosts = new Set(plan.stops.map((s) => s.experience.providerId)).size;
  return (
    <div className="relative">
      <div className="rounded-[30px] border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl md:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-paper/45">Live result · computed on this device</div>
            <div className="mt-1 font-display text-[22px]">
              {fmtDate(intent.date, 'EEEE')} with parents · {guests} guests
            </div>
          </div>
          {intent.budget !== null && plan.stops.length > 0 && (
            <Badge tone={plan.withinBudget ? 'honey' : 'clay'} className="shrink-0">
              {plan.withinBudget ? `Within ${aed(intent.budget)}` : 'Over budget'}
            </Badge>
          )}
        </div>
        <ol className="relative mt-6 space-y-4 before:absolute before:bottom-6 before:left-[19px] before:top-6 before:w-px before:bg-white/15">
          {plan.stops.map((s, i) => {
            const e = s.experience;
            const m = s.driveMins;
            const dur = m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
            return (
              <motion.li
                key={e.id}
                initial={{ opacity: 0, x: 16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + i * 0.18, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              >
                {i > 0 && s.fromRegion && (
                  <div className="mb-2 ml-12 text-[11.5px] text-paper/45">
                    {m ? `${dur} drive · ${REGION_BY_ID[s.fromRegion].name} → ${REGION_BY_ID[PROVIDER_BY_ID[e.providerId].regionId].name}` : 'Same area — a short walk or drive'}
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper text-[11px] font-bold text-ink">{s.time}</span>
                  <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-white/[0.07] p-2.5 pr-4">
                    <SmartImage img={e.image} aspect={1} width={160} className="h-12 w-12 shrink-0 rounded-xl" category={e.categoryId} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold">{e.title}</div>
                      <div className="truncate text-[12px] text-paper/55">
                        {PROVIDER_BY_ID[e.providerId].name}
                        {s.reasons[0] && <span className="text-honey-300/80"> · {s.reasons[0]}</span>}
                      </div>
                    </div>
                    <span className="hidden shrink-0 text-[12.5px] font-semibold text-paper/80 sm:block">{aed(s.price)}</span>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ol>
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-[13px]">
          <span className="text-paper/55">
            {hosts} hosts · {plan.regions.length} {plan.regions.length === 1 ? 'region' : 'regions'} · {plan.stats.eligible} open slots weighed
          </span>
          <span className="shrink-0 font-semibold">{aed(plan.total)} total</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Featured strip ------------------------------- */

export function FeaturedExperiences() {
  const ids = ['ghaf-family', 'wh-beekeeper', 'fh-mug', 'hh-sail', 'ol-signature', 'ghaf-dinner', 'kfc-seaglaze', 'rimal-glamping'];
  return (
    <section className="py-20 md:py-28">
      <div className="shell">
        <SectionHeader
          eyebrow="Featured local experiences"
          title="Loved by families, made by hosts."
          action={
            <Button to="/experiences" variant="outline" iconRight={<ArrowRight className="h-4 w-4" />}>
              See all
            </Button>
          }
        />
      </div>
      <div className="no-scrollbar mt-10 flex snap-x gap-5 overflow-x-auto scroll-px-4 px-4 pb-2 sm:scroll-px-6 sm:px-6 lg:scroll-px-[max(2.5rem,calc((100vw_-_1360px)/2_+_2.5rem))] lg:px-[max(2.5rem,calc((100vw_-_1360px)/2_+_2.5rem))]">
        {ids.map((id, i) => (
          <Reveal key={id} delay={i * 0.05} className="w-[72vw] shrink-0 snap-start sm:w-[300px]">
            <ExperienceCard e={EXPERIENCE_BY_ID[id]} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------- How it works --------------------------------- */

export function HowItWorks() {
  const steps = [
    { icon: Compass, title: 'Discover', body: 'Five traditions, real hosts, live availability. Step inside each venue in 3D before you book.' },
    { icon: CalendarCheck2, title: 'Book & live it', body: 'Hold your spots, pay securely and spend the day with the people who keep the tradition alive.' },
    { icon: BadgeCheck, title: 'Collect your stamp', body: 'Your host verifies the visit and a stamp lands in your LocalDays Passport.' },
    { icon: Repeat, title: 'Take it home', body: 'Reorder the honey you tasted, subscribe to the farm’s produce, refill your signature blend.' },
  ];
  return (
    <section className="bg-sand-100 py-20 md:py-28">
      <div className="shell">
        <SectionHeader
          align="center"
          eyebrow="How LocalDays works"
          title={
            <>
              The visit is <span className="serif-italic text-clay-500">the beginning</span>.
            </>
          }
          description="Tourism platforms stop at the ticket. LocalDays turns a great day into a lasting relationship with a local business."
        />
        <div className="mt-14 grid gap-4 md:grid-cols-4">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08}>
              <div className="relative h-full rounded-[26px] bg-white p-6 shadow-soft">
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-clay-50 text-clay-600">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-[44px] leading-none text-sand-300">0{i + 1}</span>
                </div>
                <h3 className="mt-6 font-display text-[23px] tracking-tight">{s.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-8">
          <div className="flex flex-wrap items-center justify-center gap-2 text-[13px] font-semibold text-ink-2">
            {['Visit', 'Experience', 'Purchase', 'Subscribe', 'Repeat'].map((w, i, a) => (
              <span key={w} className="inline-flex items-center gap-2">
                <span className={cn('rounded-full px-4 py-2', i === a.length - 1 ? 'bg-clay-500 text-white' : 'bg-white shadow-ring')}>{w}</span>
                {i < a.length - 1 && <ArrowRight className="h-4 w-4 text-ink-4" />}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* --------------------------------- Immersive farm --------------------------------- */

export function ImmersiveFarm() {
  const provider = PROVIDER_BY_ID['ghaf-grove'];
  const [active, setActive] = useState<string | null>(null);
  const [mount, setMount] = useState(false);
  return (
    <section className="relative overflow-hidden bg-[#17110b] py-20 text-paper md:py-28">
      <div className="absolute inset-0 opacity-60" style={{ background: 'radial-gradient(60% 50% at 70% 40%, rgba(219,150,43,0.18), transparent 70%)' }} />
      <div className="shell relative">
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="eyebrow text-honey-300/80">Immersive preview · Farmhouse & Farm-to-Table</div>
            <h2 className="display-lg mt-4 max-w-3xl text-balance">
              Walk the farm <span className="serif-italic text-honey-300">before</span> you book it.
            </h2>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-paper/65">
              Orbit Ghaf Grove in real time. Every pin opens live details from the host’s own records — rooms, menus, harvest beds, the falaj — with prices and slots you can book.
            </p>
          </div>
          <Button to={`/p/${provider.slug}`} variant="light" size="lg" iconRight={<ArrowUpRight className="h-4 w-4" />}>
            Explore Ghaf Grove
          </Button>
        </div>
        <motion.div
          className="mt-10"
          onViewportEnter={() => setMount(true)}
          viewport={{ once: true, margin: '200px' }}
        >
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[30px] ring-1 ring-white/10 sm:aspect-[16/10] lg:aspect-[16/8]">
            {mount ? (
              <Suspense fallback={<div className="absolute inset-0 bg-[#2a1d12]" />}>
                <ExperienceViewer provider={provider} active={active} onSelect={setActive} className="absolute inset-0" />
              </Suspense>
            ) : (
              <SmartImage img={provider.hero} className="absolute inset-0" category="farm" />
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* --------------------------------- This weekend --------------------------------- */

export function ThisWeekend() {
  const ctx = useAvailabilityCtx();
  const wk = upcomingWeekend(ctx.todayISO);
  const days = rangeISO(wk.start, daysBetween(wk.start, wk.end) + 1);
  const items = useMemo(() => {
    const out: { id: string; date: string; time?: string; remaining: number }[] = [];
    for (const e of EXPERIENCES) {
      if (e.priceUnit === 'per_night') continue;
      for (const d of days) {
        const slot = getSlots(e, d, ctx).find((s) => s.remaining >= 2);
        if (slot) {
          out.push({ id: e.id, date: d, time: slot.time, remaining: slot.remaining });
          break;
        }
      }
    }
    // One per category first, then the rest, max 6
    const seen = new Set<string>();
    const first = out.filter((o) => {
      const c = EXPERIENCE_BY_ID[o.id].categoryId;
      if (seen.has(c)) return false;
      seen.add(c);
      return true;
    });
    return [...first, ...out.filter((o) => !first.includes(o))].slice(0, 6);
  }, [ctx, days]);

  return (
    <section className="py-20 md:py-28">
      <div className="shell">
        <SectionHeader
          eyebrow={`This weekend · ${fmtDate(wk.start, 'EEE d')} – ${fmtDate(wk.end, 'EEE d MMM')}`}
          title="Spots still open this weekend."
          description="Live availability from LocalDays hosts. Seats are held for 10 minutes while you check out."
          action={
            <Button to="/experiences?when=weekend" variant="outline" iconRight={<ArrowRight className="h-4 w-4" />}>
              Plan the weekend
            </Button>
          }
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => {
            const e = EXPERIENCE_BY_ID[it.id];
            const p = PROVIDER_BY_ID[e.providerId];
            return (
              <Reveal key={it.id} delay={i * 0.05}>
                <Link to={`/book/${e.id}?date=${it.date}${it.time ? `&time=${it.time}` : ''}`} className="group flex items-center gap-4 rounded-[24px] border border-line bg-white p-3 pr-5 shadow-soft transition hover:shadow-lift">
                  <SmartImage img={e.image} aspect={1} width={240} className="h-24 w-24 shrink-0 rounded-[18px]" category={e.categoryId} zoom />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.12em]" style={{ color: CATEGORIES.find((c) => c.id === e.categoryId)!.theme.accent }}>
                      <CategoryIcon id={e.categoryId} className="h-3.5 w-3.5" /> {fmtDate(it.date, 'EEE')} · {fmtTime(it.time)}
                    </div>
                    <div className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug">{e.title}</div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[12.5px] text-ink-3">
                      <span className="truncate">{p.name}</span>
                      <span className={cn('shrink-0 font-semibold', it.remaining <= 4 ? 'text-amber-700' : 'text-oasis-600')}>{it.remaining} left</span>
                    </div>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- Products --------------------------------- */

export function ProductsSection() {
  const ids = ['ghaf-box', 'wh-sidr', 'fh-mug-ready', 'ol-house-bukhoor', 'ghaf-khalas', 'hh-pass'];
  return (
    <section className="bg-white py-20 md:py-28">
      <div className="shell">
        <SectionHeader
          eyebrow="Take Sharjah home"
          title={
            <>
              Real products from the hosts <span className="serif-italic text-clay-500">you meet</span>.
            </>
          }
          description="Every item is made, grown or packed by a participating host — and you can reorder it long after you’ve flown home."
        />
        <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-6">
          {ids.map((id, i) => (
            <Reveal key={id} delay={i * 0.05}>
              <ProductCard prod={PRODUCT_BY_ID[id]} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- Passport --------------------------------- */

export function PassportPreview() {
  const stamps = useMyStamps();
  const earned = new Set(stamps.map((s) => s.categoryId));
  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      <div className="shell grid items-center gap-14 lg:grid-cols-2">
        <div>
          <SectionHeader
            eyebrow="LocalDays Passport"
            title={
              <>
                Stamps you <span className="serif-italic text-clay-500">earn</span>, not points you click.
              </>
            }
            description="Each stamp is verified by your host when you complete a real experience. Explore different traditions to unlock rewards that hosts and LocalDays fund transparently."
          />
          <div className="mt-8 space-y-3">
            {CHALLENGES.slice(0, 3).map((c) => {
              const r = REWARDS.find((x) => x.id === c.rewardId)!;
              return (
                <div key={c.id} className="flex items-center gap-4 rounded-2xl border border-line bg-white p-4 shadow-ring">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-honey-100 text-honey-700">
                    <Ticket className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14.5px] font-semibold">{c.description}</div>
                    <div className="text-[12.5px] text-ink-3">
                      Unlocks: {r.title} · funded by {r.fundedBy.name}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <Button to="/passport" variant="dark" className="mt-8" iconRight={<ArrowRight className="h-4 w-4" />}>
            Open the Passport
          </Button>
        </div>
        <Reveal>
          <div className="relative mx-auto max-w-[560px]">
            <div className="relative rounded-[32px] bg-[#2B3A2F] p-3 shadow-lift">
              <div className="grid grid-cols-2 gap-0 overflow-hidden rounded-[24px] bg-[#F4EBDA]">
                <div className="relative border-r border-dashed border-[#D9C9AA] p-6">
                  <div className="pattern-girih absolute inset-0 opacity-40" />
                  <div className="relative">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-3">Passport · page 2</div>
                    <div className="mt-6 grid grid-cols-1 place-items-center gap-4">
                      {CATEGORIES.slice(0, 2).map((c, i) => (
                        <Stamp key={c.id} id={c.id} earned={earned.has(c.id)} size={150} rotate={i ? 6 : -9} date={earned.has(c.id) ? 'Verified' : undefined} />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="relative p-6">
                  <div className="pattern-girih absolute inset-0 opacity-40" />
                  <div className="relative grid grid-cols-1 place-items-center gap-2 pt-6">
                    {CATEGORIES.slice(2).map((c, i) => (
                      <Stamp key={c.id} id={c.id} earned={earned.has(c.id)} size={i === 1 ? 120 : 132} rotate={[8, -4, 10][i]} date={earned.has(c.id) ? 'Verified' : undefined} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------ Supporting local ------------------------------ */

export function SupportLocal() {
  const booking = 450;
  const commission = booking * ECONOMICS.experienceCommission;
  const processing = booking * ECONOMICS.paymentProcessing;
  const host = booking - commission - processing;
  const sub = 120;
  return (
    <section className="bg-oasis-900 py-20 text-paper md:py-28">
      <div className="shell">
        <SectionHeader
          dark
          eyebrow="How LocalDays supports local businesses"
          title={
            <>
              A booking is good. <span className="serif-italic text-honey-300">A regular customer</span> is a livelihood.
            </>
          }
          description="Hosts keep the large majority of every sale, and the relationship continues after the visit through products, refills and subscriptions."
        />
        <div className="mt-12 grid gap-5 lg:grid-cols-[1.25fr_1fr]">
          <div className="rounded-[28px] bg-white/[0.06] p-6 ring-1 ring-white/10 md:p-8">
            <div className="text-[13px] font-semibold text-paper/60">A family books Ghaf Grove’s Family Farm Day</div>
            <div className="mt-1 font-display text-[40px] leading-none tabular">{aed(booking)}</div>
            <div className="mt-6 flex h-4 overflow-hidden rounded-full">
              <div className="bg-honey-300" style={{ width: `${(host / booking) * 100}%` }} />
              <div className="bg-clay-400" style={{ width: `${(commission / booking) * 100}%` }} />
              <div className="bg-white/30" style={{ width: `${(processing / booking) * 100}%` }} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Split color="bg-honey-300" label="Farm keeps" value={aed(host)} />
              <Split color="bg-clay-400" label={`LocalDays (${ECONOMICS.experienceCommission * 100}%)`} value={aed(commission)} />
              <Split color="bg-white/30" label="Payment processing" value={aed(processing)} />
            </div>
            <div className="mt-8 rounded-2xl bg-white/[0.06] p-5">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-honey-300">
                <Repeat className="h-4 w-4" /> After the visit
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-paper/80">
                They subscribe to the weekly {aed(sub)} produce box. Four weeks later the same family has generated <strong className="text-paper">{aed(sub * 4)}</strong> more in gross
                sales for the farm — without another tourism booking.
              </p>
            </div>
          </div>
          <div className="grid gap-5">
            {[
              { icon: Store, title: 'A storefront that remembers the visit', body: 'Post-visit shops show guests exactly what they tasted, picked or made.' },
              { icon: HandCoins, title: 'Prepaid experiences, honestly accounted', body: 'Customer-funded presales within approved capacity — tracked as obligations, never as profit.' },
              { icon: ShieldCheck, title: 'Rewards that never surprise a host', body: 'Every reward has a named funder and a hard cap, visible to customers and hosts.' },
            ].map((f) => (
              <div key={f.title} className="flex gap-4 rounded-[24px] bg-white/[0.06] p-5 ring-1 ring-white/10">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-honey-300">
                  <f.icon className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-[15.5px] font-semibold">{f.title}</div>
                  <div className="mt-1 text-[14px] leading-relaxed text-paper/60">{f.body}</div>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-3">
              <Button to="/hosts" variant="light" iconRight={<ArrowRight className="h-4 w-4" />}>
                Become a host
              </Button>
              <Button to="/impact" variant="glass">
                See the business model
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Split({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', color)} />
      <div>
        <div className="text-[12.5px] text-paper/55">{label}</div>
        <div className="tabular text-[17px] font-semibold">{value}</div>
      </div>
    </div>
  );
}
