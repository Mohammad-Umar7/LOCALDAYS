import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Car, Check, ChevronDown, Clock, Loader2, MapPin, Mic, MicOff, RefreshCw, Repeat2, ShieldCheck, Sparkles, Users, UtensilsCrossed, Wallet, Wand2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { SmartImage } from '@/components/ui/SmartImage';
import { Badge } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/overlays';
import { SharjahMap } from '@/components/map/SharjahMap';
import { CategoryIcon } from '@/components/brand/CategoryIcon';
import { Stamp } from '@/components/passport/Stamp';
import { CATEGORY_BY_ID, CATEGORIES } from '@/data/categories';
import { PROVIDER_BY_ID } from '@/data/catalog';
import { REGION_BY_ID } from '@/data/regions';
import type { CategoryId } from '@/data/types';
import { useApp, useAvailabilityCtx, useMyStamps } from '@/store/app';
import { useUI } from '@/store/ui';
import { alternativesFor, composeDay, parseIntent, type ComposerIntent, type DayPlan, type PlanStop } from '@/services/intelligence/composer';
import { addDaysISO } from '@/lib/dates';
import { aed, fmtDate, fmtDuration, fmtTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { BRAND } from '@/config/brand';

const EXAMPLES = [
  'A slow Saturday with my parents — dates, the sea, under AED 800',
  'Family of 4 this weekend, hands-on and morning only',
  'Romantic evening: make a perfume then dinner',
  'Bees and pottery tomorrow, no boats, budget 600',
  'Group of 8 colleagues next week, heritage and seafood',
];

type Phase = 'idle' | 'thinking' | 'done';

// Minimal typing for the Web Speech API (Chrome exposes it without an API key)
type Recognition = { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; start: () => void; stop: () => void };
function getRecognition(): Recognition | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return C ? new C() : null;
}

export default function Composer() {
  const [sp, setSp] = useSearchParams();
  const ctx = useAvailabilityCtx();
  const stamps = useMyStamps();
  const [text, setText] = useState(sp.get('q') ?? '');
  const [intent, setIntent] = useState<ComposerIntent | null>(null);
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [step, setStep] = useState(0);
  const [variation, setVariation] = useState(0);
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const voiceSupported = typeof window !== 'undefined' && !!getRecognition;

  const run = (input: string, edit?: Partial<ComposerIntent>, v = 0) => {
    if (!input.trim() && !edit) return;
    const base = edit && intent ? { ...intent, ...edit } : parseIntent(input, ctx.todayISO, stamps.map((s) => s.categoryId));
    setIntent(base);
    setVariation(v);
    const p = composeDay(base, ctx, stamps, v);
    setPhase('thinking');
    setStep(0);
    setPlan(p);
    if (!edit) setSp(input ? { q: input } : {}, { replace: true });
  };

  // Staged reasoning reveal
  useEffect(() => {
    if (phase !== 'thinking') return;
    if (step >= 4) {
      const t = setTimeout(() => {
        setPhase('done');
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
      }, 350);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), step === 0 ? 450 : 520);
    return () => clearTimeout(t);
  }, [phase, step]);

  useEffect(() => {
    const q = sp.get('q');
    if (q) run(q);
    if (sp.get('voice') === '1') startVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startVoice = () => {
    const rec = getRecognition();
    if (!rec) return;
    recRef.current = rec;
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.onresult = (e) => {
      const t = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(' ');
      setText(t);
    };
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  };

  return (
    <AppShell>
      <section className="relative overflow-hidden bg-ink text-paper">
        <div className="pattern-girih-light absolute inset-0 opacity-50" />
        <div className="absolute -left-32 top-0 h-[420px] w-[420px] rounded-full bg-clay-500/25 blur-[120px]" />
        <div className="absolute -right-24 bottom-0 h-[360px] w-[360px] rounded-full bg-honey-400/15 blur-[120px]" />
        <div className="shell relative py-14 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-honey-300">
              <Sparkles className="h-3.5 w-3.5" /> {BRAND.intelligenceName} · {BRAND.composerName}
            </div>
            <h1 className="display-lg mt-6 text-balance">
              What kind of day are you <span className="serif-italic text-honey-300">dreaming of?</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-[16px] text-paper/65">Say it the way you’d tell a friend. We’ll turn it into a bookable day using live availability from real hosts.</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(text);
            }}
            className="mx-auto mt-10 max-w-3xl rounded-[28px] bg-white p-2 text-ink shadow-float"
          >
            <div className="flex items-start gap-3 p-3">
              <Wand2 className="mt-1 h-5 w-5 shrink-0 text-clay-500" />
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    run(text);
                  }
                }}
                rows={2}
                placeholder={EXAMPLES[0]}
                className="min-h-[56px] flex-1 resize-none bg-transparent text-[17px] leading-relaxed outline-none placeholder:text-ink-4"
                aria-label="Describe your day"
              />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line px-3 pt-2">
              <div className="text-[12px] text-ink-3">Try: who’s coming, when, budget, what you love, what to avoid</div>
              <div className="flex items-center gap-2">
                {voiceSupported && (
                  <button
                    type="button"
                    onClick={() => (listening ? recRef.current?.stop() : startVoice())}
                    className={cn('flex h-10 w-10 items-center justify-center rounded-full transition', listening ? 'animate-pulse bg-clay-500 text-white' : 'text-ink-2 hover:bg-ink/5')}
                    aria-label={listening ? 'Stop listening' : 'Speak your request'}
                  >
                    {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                )}
                <Button type="submit" disabled={!text.trim() || phase === 'thinking'} iconRight={<ArrowRight className="h-4 w-4" />}>
                  Compose my day
                </Button>
              </div>
            </div>
          </form>
          <div className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => {
                  setText(ex);
                  run(ex);
                }}
                className="rounded-full border border-white/15 px-3 py-1.5 text-[12.5px] text-paper/75 transition hover:border-white/40 hover:text-paper"
              >
                {ex}
              </button>
            ))}
          </div>

          {/* Understanding + reasoning */}
          <AnimatePresence>
            {intent && plan && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-10 grid max-w-5xl gap-4 lg:grid-cols-[1.4fr_1fr]">
                <IntentEditor intent={intent} onChange={(edit) => run(intent.raw, edit, variation)} todayISO={ctx.todayISO} />
                <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-5">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-paper/45">Reasoning</div>
                  <ul className="mt-3 space-y-3 text-[13.5px]">
                    {[
                      `Understood ${Math.max(1, intent.understood.length)} signal${intent.understood.length === 1 ? '' : 's'} from your words`,
                      `Checked ${plan.stats.experiences} experiences · ${plan.stats.slots} live slots on ${fmtDate(intent.date, 'EEE d MMM')}`,
                      `Kept ${plan.stats.eligible} slots that fit ${intent.adults + intent.children} guests${intent.children ? ' with kids' : ''}${intent.parts.length ? `, ${intent.parts.join(' & ')}` : ''}`,
                      `Compared ${plan.stats.routes.toLocaleString()} routes for drive time, heat, budget and variety`,
                    ].map((line, i) => (
                      <li key={line} className="flex items-start gap-2.5">
                        <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full', phase === 'done' || i < step ? 'bg-oasis-500 text-white' : i === step ? 'bg-white/15' : 'bg-white/5')}>
                          {phase === 'done' || i < step ? <Check className="h-3 w-3" /> : i === step ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        </span>
                        <span className={phase === 'done' || i <= step ? 'text-paper/85' : 'text-paper/30'}>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      <div ref={resultRef} />
      <AnimatePresence mode="wait">
        {phase === 'done' && plan && <PlanView key={`${plan.intent.date}-${variation}-${plan.stops.map((s) => s.experience.id).join()}`} plan={plan} onAnother={() => intent && run(intent.raw, intent, variation + 1)} setPlan={setPlan} />}
      </AnimatePresence>

      <section className="shell py-14">
        <div className="mx-auto flex max-w-3xl items-start gap-3 rounded-[24px] border border-line bg-white p-5 text-[13.5px] text-ink-2">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-oasis-500" />
          <p>
            <span className="font-semibold text-ink">How this works.</span> In this demo, {BRAND.intelligenceName} runs entirely in your browser: transparent rules turn your words into constraints, then a planner searches live slots
            for the best route. It can only recommend real hosts, real prices and real availability. In production, a language model can improve understanding — the same guard-rails keep it from inventing anything.
          </p>
        </div>
      </section>
    </AppShell>
  );
}

/* ------------------------------ Intent editor ------------------------------ */

function IntentEditor({ intent, onChange, todayISO }: { intent: ComposerIntent; onChange: (e: Partial<ComposerIntent>) => void; todayISO: string }) {
  const days = Array.from({ length: 14 }, (_, i) => addDaysISO(todayISO, i));
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-paper/45">What we understood · tap to adjust</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <ChipSelect label={fmtDate(intent.date, 'EEE d MMM')} icon={<Clock className="h-3.5 w-3.5" />}>
          {(close) =>
            days.map((d) => (
              <button
                key={d}
                onClick={() => {
                  onChange({ date: d });
                  close();
                }}
                className={cn('w-full rounded-xl px-3 py-2 text-left text-[13px] hover:bg-sand-50', d === intent.date && 'font-semibold')}
              >
                {fmtDate(d, 'EEEE d MMM')}
              </button>
            ))
          }
        </ChipSelect>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 py-1 pl-3 pr-1 text-[13px] font-semibold">
          <Users className="h-3.5 w-3.5" /> {intent.adults} adult{intent.adults > 1 ? 's' : ''}
          <MiniStep onDec={() => onChange({ adults: Math.max(1, intent.adults - 1) })} onInc={() => onChange({ adults: intent.adults + 1 })} />
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 py-1 pl-3 pr-1 text-[13px] font-semibold">
          {intent.children} kid{intent.children === 1 ? '' : 's'}
          <MiniStep onDec={() => onChange({ children: Math.max(0, intent.children - 1) })} onInc={() => onChange({ children: intent.children + 1 })} />
        </span>
        <ChipSelect label={intent.budget ? `≤ ${aed(intent.budget)}${intent.budgetPerPerson ? ' pp' : ''}` : 'Any budget'} icon={<Wallet className="h-3.5 w-3.5" />}>
          {(close) =>
            [null, 300, 500, 800, 1200, 2000].map((b) => (
              <button
                key={String(b)}
                onClick={() => {
                  onChange({ budget: b, budgetPerPerson: false });
                  close();
                }}
                className="w-full rounded-xl px-3 py-2 text-left text-[13px] hover:bg-sand-50"
              >
                {b ? `Up to ${aed(b)} total` : 'Any budget'}
              </button>
            ))
          }
        </ChipSelect>
        <ChipSelect label={intent.pace === 'relaxed' ? 'Relaxed · 2 stops' : intent.pace === 'packed' ? 'Packed · 4 stops' : 'Balanced · 3 stops'} icon={<Repeat2 className="h-3.5 w-3.5" />}>
          {(close) =>
            (['relaxed', 'balanced', 'packed'] as const).map((p) => (
              <button
                key={p}
                onClick={() => {
                  onChange({ pace: p });
                  close();
                }}
                className="w-full rounded-xl px-3 py-2 text-left text-[13px] capitalize hover:bg-sand-50"
              >
                {p}
              </button>
            ))
          }
        </ChipSelect>
        {intent.parts.map((p) => (
          <span key={p} className="rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold">
            {p[0].toUpperCase() + p.slice(1)} only
          </span>
        ))}
        {intent.avoid.map((c) => (
          <span key={c} className="rounded-full bg-clay-500/30 px-3 py-1.5 text-[13px] font-semibold">
            No {CATEGORY_BY_ID[c].shortName.toLowerCase()}
          </span>
        ))}
        {intent.avoidBoats && <span className="rounded-full bg-clay-500/30 px-3 py-1.5 text-[13px] font-semibold">No boats</span>}
        {intent.region && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 py-1 pl-3 pr-1 text-[13px] font-semibold">
            <MapPin className="h-3.5 w-3.5" /> {REGION_BY_ID[intent.region].name}
            <button aria-label="Any region" onClick={() => onChange({ region: null })} className="ml-0.5 flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/15">
              <X className="h-3 w-3" />
            </button>
          </span>
        )}
        {intent.meals.map((m) => (
          <span key={m} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold capitalize">
            <UtensilsCrossed className="h-3.5 w-3.5" /> {m}
          </span>
        ))}
        {intent.seafood && !intent.meals.length && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold">
            <UtensilsCrossed className="h-3.5 w-3.5" /> Seafood
          </span>
        )}
        {intent.noCar && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold">
            <Car className="h-3.5 w-3.5" /> One region
          </span>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => {
          const w = intent.interests[c.id] ?? 0;
          // Interests we spread evenly (none named) are not "understood" — don't light them up
          const on = !intent.interestsInferred && w >= 1;
          return (
            <button
              key={c.id}
              onClick={() => {
                const next = intent.interestsInferred ? {} : { ...intent.interests };
                if (on) next[c.id] = 0.2;
                else next[c.id] = 2;
                onChange({ interests: next, interestsInferred: false, avoid: intent.avoid.filter((x) => x !== c.id) });
              }}
              className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition', on ? 'bg-paper text-ink' : 'bg-white/5 text-paper/55 hover:text-paper')}
            >
              <CategoryIcon id={c.id} className="h-3.5 w-3.5" />
              {c.shortName}
            </button>
          );
        })}
      </div>
      {intent.interestsInferred && <div className="mt-2 text-[12px] text-paper/45">No tradition named — favouring Passport stamps you haven’t earned yet. Tap one to focus.</div>}
    </div>
  );
}

function MiniStep({ onDec, onInc }: { onDec: () => void; onInc: () => void }) {
  return (
    <span className="ml-1 inline-flex overflow-hidden rounded-full bg-white/10">
      <button onClick={onDec} className="px-2 py-0.5 hover:bg-white/15" aria-label="Fewer">
        −
      </button>
      <button onClick={onInc} className="px-2 py-0.5 hover:bg-white/15" aria-label="More">
        +
      </button>
    </span>
  );
}

function ChipSelect({ label, icon, children }: { label: string; icon: React.ReactNode; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold hover:bg-white/15">
        {icon} {label} <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="thin-scrollbar absolute left-0 top-10 z-30 max-h-64 w-56 overflow-y-auto rounded-2xl bg-white p-1.5 text-ink shadow-float"
          >
            {children(() => setOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* --------------------------------- Plan --------------------------------- */

function PlanView({ plan, onAnother, setPlan }: { plan: DayPlan; onAnother: () => void; setPlan: (p: DayPlan) => void }) {
  const add = useApp((s) => s.addExperienceToCart);
  const toast = useUI((s) => s.toast);
  const nav = useNavigate();
  const ctx = useAvailabilityCtx();
  const [swapIdx, setSwapIdx] = useState<number | null>(null);
  const alts = useMemo(() => (swapIdx === null ? [] : alternativesFor(plan, swapIdx, ctx)), [swapIdx, plan, ctx]);
  const guests = plan.intent.adults + plan.intent.children;

  const bookAll = () => {
    let ok = 0;
    for (const s of plan.stops) {
      const r = add({
        experienceId: s.experience.id,
        date: plan.intent.date,
        time: s.time,
        guests: { adults: plan.intent.adults, children: plan.intent.children },
        addOnIds: [],
        source: 'composer',
      });
      if (r.ok) ok++;
    }
    toast({ title: `${ok} experience${ok === 1 ? '' : 's'} held for 10 minutes`, body: 'Your composed day is ready to check out.', tone: 'success' });
    nav('/checkout');
  };

  if (!plan.stops.length) {
    return (
      <section className="shell py-14">
        <div className="mx-auto max-w-2xl rounded-[28px] border border-line bg-white p-8 text-center">
          <div className="font-display text-[26px]">Nothing fits every wish on {fmtDate(plan.intent.date, 'EEE d MMM')}.</div>
          <p className="mt-2 text-[14.5px] text-ink-2">{plan.notes[0]}</p>
        </div>
      </section>
    );
  }

  return (
    <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="shell py-12 md:py-16">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="eyebrow">Composed for you · {fmtDate(plan.intent.date, 'EEEE d MMMM')}</div>
          <h2 className="mt-3 font-display text-[36px] leading-tight tracking-tight md:text-[44px]">
            {plan.stops.length} hosts, {plan.regions.length} region{plan.regions.length > 1 ? 's' : ''}, one good day.
          </h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={<RefreshCw className="h-4 w-4" />} onClick={onAnother}>
            Show another plan
          </Button>
        </div>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Timeline */}
        <ol className="relative space-y-3">
          {plan.stops.map((s, i) => {
            const p = PROVIDER_BY_ID[s.experience.providerId];
            const cat = CATEGORY_BY_ID[s.experience.categoryId];
            return (
              <motion.li key={s.experience.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 * i + 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
                {i > 0 && (
                  <div className="ml-[34px] flex items-center gap-2 border-l-2 border-dashed border-line py-3 pl-6 text-[12.5px] text-ink-3">
                    <Car className="h-3.5 w-3.5" />
                    {s.driveMins ? `${fmtDuration(s.driveMins)} drive · ${REGION_BY_ID[s.fromRegion!].name} → ${REGION_BY_ID[p.regionId].name}` : 'Same area — a short walk or drive'}
                  </div>
                )}
                <div className="flex gap-4">
                  <div className="flex w-[70px] shrink-0 flex-col items-center pt-2">
                    <div className="tabular rounded-full bg-ink px-2.5 py-1 text-[12px] font-bold text-paper">{fmtTime(s.time).replace(' ', '')}</div>
                    <div className="mt-1 text-[11px] text-ink-3">to {fmtTime(s.end).replace(' ', '')}</div>
                  </div>
                  {/* Whole card opens the venue (stretched link on the title); Swap sits above it */}
                  <div className="group relative flex min-w-0 flex-1 flex-col gap-4 rounded-[26px] border border-line bg-white p-3 transition hover:border-ink/25 hover:shadow-soft sm:flex-row">
                    <SmartImage img={s.experience.image} aspect={4 / 3} width={460} className="aspect-[16/9] shrink-0 rounded-[20px] sm:aspect-[4/3] sm:w-[190px]" category={s.experience.categoryId} />
                    <div className="min-w-0 flex-1 px-1 pb-1 sm:py-1.5 sm:pr-2">
                      <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold" style={{ color: cat.theme.accent }}>
                        <CategoryIcon id={cat.id} className="h-3.5 w-3.5" /> {cat.shortName} · {p.name}
                      </div>
                      <Link
                        to={`/p/${p.slug}`}
                        className="mt-1 block font-display text-[21px] leading-tight tracking-tight after:absolute after:inset-0 after:rounded-[26px] after:content-[''] group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4"
                      >
                        {s.experience.title}
                      </Link>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {s.reasons.map((r) => (
                          <span key={r} className="rounded-full bg-sand-50 px-2.5 py-1 text-[11.5px] font-semibold text-ink-2 ring-1 ring-inset ring-line">
                            {r}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="tabular text-[15px] font-semibold">
                          {aed(s.price)} <span className="text-[12px] font-normal text-ink-3">for {guests}</span>
                        </span>
                        <button onClick={() => setSwapIdx(i)} className="relative z-10 inline-flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-semibold hover:border-ink">
                          <Repeat2 className="h-3.5 w-3.5" /> Swap
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ol>

        {/* Summary */}
        <aside className="space-y-4">
          <div className="sticky top-[96px] space-y-4">
            <div className="overflow-hidden rounded-[26px] border border-line bg-white">
              <SharjahMap
                pins={plan.regions.map((r) => ({ regionId: r, color: '#B5502B' }))}
                route={plan.stops.map((s) => PROVIDER_BY_ID[s.experience.providerId].regionId)}
                className="aspect-[4/3]"
              />
            </div>
            <div className="rounded-[26px] border border-line bg-white p-5">
              <div className="flex items-baseline justify-between">
                <span className="text-[14px] text-ink-2">Total for {guests}</span>
                <span className="tabular font-display text-[30px]">{aed(plan.total)}</span>
              </div>
              {plan.intent.budget && (
                <Badge tone={plan.withinBudget ? 'success' : 'warning'} className="mt-2">
                  {plan.withinBudget ? 'Within budget' : 'Over budget'} · {aed(plan.intent.budgetPerPerson ? plan.intent.budget * guests : plan.intent.budget)}
                </Badge>
              )}
              {plan.newStamps.length > 0 && (
                <div className="mt-4 flex items-center gap-3 rounded-2xl bg-sand-50 p-3">
                  <div className="flex -space-x-6">
                    {plan.newStamps.slice(0, 3).map((c) => (
                      <Stamp key={c} id={c as CategoryId} size={52} rotate={-6} />
                    ))}
                  </div>
                  <div className="text-[12.5px] text-ink-2">
                    Earn {plan.newStamps.length} new Passport stamp{plan.newStamps.length > 1 ? 's' : ''}
                  </div>
                </div>
              )}
              <Button className="mt-5" block size="lg" onClick={bookAll} iconRight={<ArrowRight className="h-4 w-4" />}>
                Book this day
              </Button>
              <div className="mt-2 text-center text-[12px] text-ink-3">All slots held for 10 minutes at checkout</div>
            </div>
            {plan.notes.length > 0 && (
              <ul className="space-y-2 rounded-[22px] bg-sand-100 p-4 text-[12.5px] text-ink-2">
                {plan.notes.map((n) => (
                  <li key={n} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-clay-500" />
                    {n}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <Sheet open={swapIdx !== null} onClose={() => setSwapIdx(null)} title="Swap this stop">
        <p className="text-[13.5px] text-ink-3">Alternatives that keep the rest of your day on time.</p>
        <div className="mt-4 space-y-3">
          {alts.length === 0 && <div className="rounded-2xl bg-sand-50 p-4 text-[13.5px] text-ink-2">No other host fits this time window — try “Show another plan”.</div>}
          {alts.map((a) => (
            <AltRow
              key={a.experience.id}
              stop={a}
              guests={guests}
              onPick={() => {
                if (swapIdx === null) return;
                const stops = plan.stops.map((s, i) => (i === swapIdx ? { ...a, reasons: ['Your pick'] } : s));
                setPlan({ ...plan, stops, total: stops.reduce((t, s) => t + s.price, 0), regions: [...new Set(stops.map((s) => PROVIDER_BY_ID[s.experience.providerId].regionId))] });
                setSwapIdx(null);
              }}
            />
          ))}
        </div>
      </Sheet>
    </motion.section>
  );
}

function AltRow({ stop, guests, onPick }: { stop: PlanStop; guests: number; onPick: () => void }) {
  const p = PROVIDER_BY_ID[stop.experience.providerId];
  return (
    <button onClick={onPick} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-3 text-left transition hover:border-ink">
      <SmartImage img={stop.experience.image} aspect={1} width={180} className="h-16 w-16 shrink-0 rounded-xl" category={stop.experience.categoryId} />
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-semibold text-ink-3">
          {fmtTime(stop.time)} · {p.name}
        </div>
        <div className="truncate text-[14.5px] font-semibold">{stop.experience.title}</div>
        <div className="text-[12.5px] text-ink-3">
          {aed(stop.price)} for {guests}
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-ink-4" />
    </button>
  );
}
