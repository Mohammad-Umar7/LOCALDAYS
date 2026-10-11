import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, CalendarDays, MapPin, Search, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BRAND } from '@/config/brand';
import { CATEGORIES } from '@/data/categories';
import { PROVIDERS } from '@/data/catalog';
import type { CategoryId, ImageRef } from '@/data/types';
import { useTodayISO } from '@/store/app';
import { upcomingWeekend, addDaysISO } from '@/lib/dates';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { SmartImage } from '../ui/SmartImage';
import { Button } from '../ui/Button';
import { CategoryIcon } from '../brand/CategoryIcon';

const SLIDES: { id: CategoryId; img: ImageRef; place: string }[] = [
  { id: 'farm', img: { key: 'farm_dates', i: 2, alt: 'A date palm oasis surrounded by golden dunes' }, place: 'Al Dhaid' },
  { id: 'honey', img: { key: 'honey_bees', i: 1, alt: 'Gloved hands lifting a frame of bees' }, place: 'Wadi Al Helo' },
  { id: 'pottery', img: { key: 'pottery_wheel', i: 1, alt: 'Hands shaping clay on a wheel' }, place: 'Heart of Sharjah' },
  { id: 'coastal', img: { key: 'coastal_dhow', i: 0, alt: 'Wooden boats in a harbour beneath mountains' }, place: 'Khor Fakkan' },
  { id: 'fragrance', img: { key: 'fragrance_bottles', i: 0, alt: 'Ornate perfume bottles on wooden shelves' }, place: 'Heart of Sharjah' },
];
const DURATION = 6500;

export function Hero() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setI((v) => (v + 1) % SLIDES.length), DURATION);
    return () => clearTimeout(t);
  }, [i, paused]);

  const slide = SLIDES[i];
  const cat = CATEGORIES.find((c) => c.id === slide.id)!;

  return (
    <section ref={ref} className="relative isolate flex min-h-[100svh] items-end overflow-hidden bg-ink pt-24 text-white md:h-[100svh] md:max-h-[980px] md:min-h-[760px] md:pt-0">
      {/* Background photography, crossfading with a slow Ken Burns drift */}
      <motion.div className="absolute inset-0 -z-10" style={{ y }}>
        <AnimatePresence initial={false}>
          <motion.div
            key={slide.id}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.12 }}
            animate={{ opacity: 1, scale: 1.02 }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 1.4, ease: 'easeInOut' }, scale: { duration: DURATION / 1000 + 1.6, ease: 'linear' } }}
          >
            <SmartImage img={slide.img} width={2000} className="h-full w-full" category={slide.id} priority />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-t from-[#120d08] via-[#120d08]/45 to-[#120d08]/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#120d08]/75 via-[#120d08]/20 to-transparent" />
        <div className="grain absolute inset-0" />
      </motion.div>

      {/* Arabic watermark for the current tradition */}
      <AnimatePresence mode="wait">
        <motion.div
          key={cat.arabic}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none absolute right-[-1vw] top-[14%] hidden font-arabic leading-none lg:block"
          style={{ fontSize: 'min(16vw, 240px)', color: 'transparent', WebkitTextStroke: '1px rgba(255,255,255,0.28)' }}
          aria-hidden
        >
          {cat.arabic}
        </motion.div>
      </AnimatePresence>

      <motion.div style={{ opacity: fade }} className="shell relative w-full pb-10 md:pb-16">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }} className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 py-1.5 pl-2 pr-3.5 text-[12.5px] font-medium text-white/90 backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-honey-300 opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-honey-300" />
          </span>
          Sharjah · {PROVIDERS.length} local hosts · 5 living traditions
        </motion.div>

        <h1 className="display-xl max-w-5xl text-balance">
          <motion.span className="block" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}>
            {BRAND.taglineLead}
          </motion.span>
          <motion.span className="serif-italic block text-honey-300" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}>
            {BRAND.taglineEmphasis}
          </motion.span>
        </h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.5 }} className="mt-6 max-w-xl text-pretty text-[16px] leading-relaxed text-white/80 md:text-[18px]">
          {BRAND.promise}
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.65 }}>
          <SearchBar onFocus={() => setPaused(true)} />
        </motion.div>

        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap gap-3">
            <Button to="/experiences" size="lg" iconRight={<ArrowRight className="h-4 w-4" />}>
              Explore Experiences
            </Button>
            <Button to="/how-it-works" size="lg" variant="glass">
              How Fadhal Works
            </Button>
          </div>
          {/* Slide indicator */}
          <div className="flex items-end gap-4">
            <div className="hidden text-right lg:block">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Now showing</div>
              <div className="mt-1 flex items-center justify-end gap-2 whitespace-nowrap text-[14px] font-semibold">
                <CategoryIcon id={slide.id} className="h-4 w-4 text-honey-300" />
                {cat.name}
              </div>
              <div className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-white/55">
                <MapPin className="h-3 w-3" /> {slide.place} · illustrative photo
              </div>
            </div>
            <div className="flex gap-1.5">
              {SLIDES.map((s, k) => (
                <button key={s.id} aria-label={`Show ${s.id}`} onClick={() => setI(k)} className="group relative h-10 w-8 md:w-10">
                  <span className="absolute inset-x-0 bottom-0 h-[3px] overflow-hidden rounded-full bg-white/25">
                    {k === i ? (
                      <motion.span key={`${i}-${paused}`} className="absolute inset-y-0 left-0 rounded-full bg-white" initial={{ width: '0%' }} animate={{ width: paused ? '100%' : '100%' }} transition={{ duration: paused ? 0 : DURATION / 1000, ease: 'linear' }} />
                    ) : (
                      k < i && <span className="absolute inset-0 rounded-full bg-white/70" />
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function SearchBar({ onFocus }: { onFocus: () => void }) {
  const today = useTodayISO();
  const nav = useNavigate();
  const weekend = useMemo(() => upcomingWeekend(today), [today]);
  const [what, setWhat] = useState<'all' | CategoryId>('all');
  const [when, setWhen] = useState<'any' | 'weekend' | 'tomorrow' | 'week'>('weekend');
  const [guests, setGuests] = useState(2);
  const [kids, setKids] = useState(true);

  const whenLabel: Record<typeof when, string> = {
    any: 'Any time',
    weekend: `This weekend · ${fmtDate(weekend.start, 'd')}–${fmtDate(weekend.end, 'd MMM')}`,
    tomorrow: `Tomorrow · ${fmtDate(addDaysISO(today, 1), 'EEE d MMM')}`,
    week: 'Next 7 days',
  };

  const go = () => {
    const q = new URLSearchParams();
    if (when !== 'any') q.set('when', when);
    q.set('guests', String(guests));
    if (kids) q.set('family', '1');
    nav(what === 'all' ? `/experiences?${q}` : `/c/${what}?${q}`);
  };

  return (
    <div onFocusCapture={onFocus} className="mt-8 grid max-w-4xl grid-cols-1 gap-1 rounded-[26px] bg-white p-1.5 text-ink shadow-float sm:grid-cols-[1.2fr_1.3fr_1fr_auto] sm:rounded-full">
      <Field icon={<CategoryIcon id={what === 'all' ? 'farm' : what} className="h-4 w-4" />} label="Tradition">
        <select value={what} onChange={(e) => setWhat(e.target.value as typeof what)} className="w-full cursor-pointer appearance-none bg-transparent text-[14.5px] font-semibold outline-none">
          <option value="all">All five traditions</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field icon={<CalendarDays className="h-4 w-4" />} label="When">
        <select value={when} onChange={(e) => setWhen(e.target.value as typeof when)} className="w-full cursor-pointer appearance-none bg-transparent text-[14.5px] font-semibold outline-none">
          {(Object.keys(whenLabel) as (typeof when)[]).map((k) => (
            <option key={k} value={k}>
              {whenLabel[k]}
            </option>
          ))}
        </select>
      </Field>
      <Field icon={<Users className="h-4 w-4" />} label="Who">
        <div className="flex items-center justify-between gap-2">
          <select value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="cursor-pointer appearance-none bg-transparent text-[14.5px] font-semibold outline-none">
            {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
              <option key={n} value={n}>
                {n} guest{n > 1 ? 's' : ''}
              </option>
            ))}
          </select>
          <label className="flex cursor-pointer items-center gap-1.5 text-[12px] font-semibold text-ink-3">
            <input type="checkbox" checked={kids} onChange={(e) => setKids(e.target.checked)} className="h-3.5 w-3.5 accent-clay-500" /> Kids
          </label>
        </div>
      </Field>
      <button onClick={go} className="m-0.5 flex h-14 items-center justify-center gap-2 rounded-[20px] bg-clay-500 px-6 text-[15px] font-semibold text-white transition hover:bg-clay-600 sm:rounded-full">
        <Search className="h-4 w-4" />
        <span className="sm:hidden lg:inline">Search</span>
      </button>
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className={cn('group flex items-center gap-3 rounded-[20px] px-4 py-2.5 transition hover:bg-sand-50 sm:rounded-full sm:px-5')}>
      <span className="text-ink-3">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-3">{label}</div>
        {children}
      </div>
    </div>
  );
}

