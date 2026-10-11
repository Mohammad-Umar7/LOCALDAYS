import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, FlaskConical, RotateCcw, ShieldCheck } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import type { Formula } from '@/data/types';
import { FORMULAS, NOTE_BY_ID } from '@/data/catalog/fragrance';
import { EXPERIENCES, PROVIDER_BY_ID } from '@/data/catalog';
import { aed } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '../ui/Button';

const BlendBottle = lazy(() => import('@/three/scenes/atelier/BlendBottle'));

const TIER_ORDER = { top: 0, heart: 1, base: 2 } as const;
const FAMILY_LABEL: Record<string, string> = {
  woody: 'Woody',
  floral: 'Floral',
  amber: 'Amber',
  citrus: 'Citrus',
  spice: 'Spiced',
  musk: 'Musky',
  smoky: 'Smoky',
  green: 'Green',
};

/**
 * Move one accord and re-balance the others proportionally so the blend always
 * totals 100% — and every accord stays inside the maker's approved range.
 */
export function rebalance(f: Formula, values: number[], idx: number, wanted: number): number[] {
  const a = f.accords;
  const others = a.map((_, i) => i).filter((i) => i !== idx);
  const minOthers = others.reduce((s, i) => s + a[i].min, 0);
  const maxOthers = others.reduce((s, i) => s + a[i].max, 0);
  const v = Math.max(a[idx].min, 100 - maxOthers, Math.min(a[idx].max, 100 - minOthers, wanted));
  const out = [...values];
  out[idx] = v;
  let free = [...others];
  for (let iter = 0; iter < 12 && free.length; iter++) {
    const fixed = others.filter((i) => !free.includes(i)).reduce((s, i) => s + out[i], 0);
    const target = 100 - v - fixed;
    const cur = free.reduce((s, i) => s + out[i], 0);
    free.forEach((i) => (out[i] = cur > 0 ? (out[i] * target) / cur : target / free.length));
    const next: number[] = [];
    let clamped = false;
    free.forEach((i) => {
      if (out[i] < a[i].min) {
        out[i] = a[i].min;
        clamped = true;
      } else if (out[i] > a[i].max) {
        out[i] = a[i].max;
        clamped = true;
      } else next.push(i);
    });
    free = next;
    if (!clamped) break;
  }
  // integer percentages, with rounding drift absorbed by an accord that has room
  const r = out.map((x) => Math.round(x));
  let drift = 100 - r.reduce((s, x) => s + x, 0);
  for (const i of others) {
    if (!drift) break;
    const room = drift > 0 ? a[i].max - r[i] : r[i] - a[i].min;
    const step = Math.sign(drift) * Math.min(Math.abs(drift), room);
    r[i] += step;
    drift -= step;
  }
  return r;
}

export function BlendStudio({ providerId }: { providerId: string }) {
  const formulas = FORMULAS.filter((f) => f.providerId === providerId);
  const provider = PROVIDER_BY_ID[providerId];
  const [formulaId, setFormulaId] = useState(formulas[0]?.id);
  const formula = formulas.find((f) => f.id === formulaId) ?? formulas[0];
  const [values, setValues] = useState<number[]>(() => formula?.accords.map((x) => x.default) ?? []);
  const [name, setName] = useState('');

  const pick = (f: Formula) => {
    setFormulaId(f.id);
    setValues(f.accords.map((x) => x.default));
  };

  const accords = useMemo(
    () =>
      formula
        ? formula.accords
            .map((x, i) => ({ ...x, note: NOTE_BY_ID[x.noteId], share: values[i] ?? x.default, i }))
            .sort((p, q) => TIER_ORDER[p.note.tier] - TIER_ORDER[q.note.tier])
        : [],
    [formula, values],
  );
  // Weight bottle colours by share so the liquid gradient reads like the blend
  const colors = useMemo(() => accords.flatMap((x) => Array.from({ length: Math.max(1, Math.round(x.share / 10)) }, () => x.note.color)), [accords]);
  const families = useMemo(() => {
    const m: Record<string, number> = {};
    accords.forEach((x) => (m[x.note.family] = (m[x.note.family] ?? 0) + x.share));
    return Object.entries(m).sort((p, q) => q[1] - p[1]);
  }, [accords]);
  const changed = formula ? formula.accords.some((x, i) => x.default !== values[i]) : false;

  if (!formula) return null;
  const workshop =
    EXPERIENCES.find((e) => e.providerId === providerId && (formula.type === 'bukhoor' ? /bukhoor/i.test(e.title) : /personal|signature|attar workshop/i.test(e.title))) ??
    EXPERIENCES.find((e) => e.providerId === providerId && e.kind === 'workshop');

  return (
    <section className="relative overflow-hidden rounded-[30px] bg-[#1F0E15] text-paper">
      <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-oud-400/25 blur-[110px]" />
      <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-brass-400/15 blur-[100px]" />
      <div className="relative grid gap-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {/* Bottle */}
        <div className="relative h-[400px] overflow-hidden lg:h-full lg:min-h-[640px]">
          <Suspense fallback={<BottleFallback colors={colors} />}>
            {/* BlendBottle sets position:relative inline, so give it a sized box */}
            <div className="absolute inset-0">
              <BlendBottle colors={colors} fill={0.86} className="h-full w-full" />
            </div>
          </Suspense>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
            <span className="rounded-full bg-black/40 px-3 py-1.5 text-[11.5px] font-semibold backdrop-blur-md">Live preview · 3D</span>
            <span className="rounded-full bg-black/40 px-3 py-1.5 font-mono text-[11.5px] text-brass-300 backdrop-blur-md">{formula.id}</span>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1F0E15] via-[#1F0E15]/70 to-transparent p-5 pt-16">
            <div className="font-display text-[26px] leading-tight">{name.trim() || `My ${formula.name}`}</div>
            <div className="mt-2 flex h-2.5 gap-[2px]">
              {accords.map((x, i) => (
                <motion.span
                  key={x.noteId}
                  layout
                  className={cn('h-full', i === 0 && 'rounded-l-[4px]', i === accords.length - 1 && 'rounded-r-[4px]')}
                  style={{ width: `${x.share}%`, background: x.note.color }}
                  transition={{ type: 'spring', damping: 30, stiffness: 260 }}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-paper/70">
              {families.slice(0, 3).map(([fam, pct]) => (
                <span key={fam}>
                  {FAMILY_LABEL[fam]} <span className="tabular text-paper">{pct}%</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="p-5 md:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-brass-400/30 px-3 py-1.5 text-[11.5px] font-semibold text-brass-300">
            <FlaskConical className="h-3.5 w-3.5" /> Blend Studio · preview before you book
          </div>
          <h2 className="mt-4 font-display text-[30px] leading-[1.08] tracking-tight md:text-[36px]">
            Tune a <span className="serif-italic text-brass-300">maker-approved</span> formula.
          </h2>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-paper/65">
            {provider.hostName.split(' ')[0]} only offers formulas they can make well. Move any accord — the others re-balance so the blend stays at 100% and inside the ranges
            the perfumer approved.
          </p>

          <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
            {formulas.map((f) => (
              <button
                key={f.id}
                onClick={() => pick(f)}
                className={cn(
                  'shrink-0 rounded-2xl px-3.5 py-2 text-left transition',
                  f.id === formula.id ? 'bg-paper text-ink' : 'bg-white/[0.06] text-paper/80 ring-1 ring-white/10 hover:bg-white/10',
                )}
              >
                <div className="text-[13.5px] font-semibold">{f.name}</div>
                <div className={cn('text-[11px]', f.id === formula.id ? 'text-ink-3' : 'text-paper/45')}>{f.type === 'bukhoor' ? 'Bukhoor' : 'Perfume oil'}</div>
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.p key={formula.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 text-[13.5px] text-paper/70">
              {formula.description}
            </motion.p>
          </AnimatePresence>

          <div className="mt-5 space-y-3.5">
            {accords.map((x) => {
              const lo = x.min;
              const hi = x.max;
              return (
                <div key={x.noteId}>
                  <div className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: x.note.color }} />
                      <span className="font-semibold">{x.note.name}</span>
                      <span className="text-[11px] uppercase tracking-[0.12em] text-paper/40">{x.note.tier}</span>
                    </span>
                    <span className="tabular">
                      <span className="text-[15px] font-semibold">{x.share}%</span>
                      <span className="ml-2 text-[11.5px] text-paper/45">
                        approved {lo}–{hi}%
                      </span>
                    </span>
                  </div>
                  <input
                    type="range"
                    min={lo}
                    max={hi}
                    step={1}
                    value={x.share}
                    onChange={(e) => setValues((v) => rebalance(formula, v, x.i, Number(e.target.value)))}
                    aria-label={`${x.note.name}, ${x.share} percent, approved range ${lo} to ${hi} percent`}
                    className="blend-range mt-1.5 w-full"
                    style={{ ['--c' as string]: x.note.color, ['--p' as string]: `${((x.share - lo) / Math.max(1, hi - lo)) * 100}%` }}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-paper/60">
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <Check className="h-3.5 w-3.5" /> 100% · every accord inside its approved range
            </span>
            {changed && (
              <button onClick={() => setValues(formula.accords.map((a) => a.default))} className="inline-flex items-center gap-1 font-semibold text-paper/75 hover:text-paper">
                <RotateCcw className="h-3.5 w-3.5" /> Perfumer’s default
              </button>
            )}
          </div>

          <div className="mt-5 space-y-3">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-paper/45">Name your blend</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 32))}
                placeholder={`My ${formula.name}`}
                className="mt-1.5 w-full rounded-xl bg-white/[0.07] px-3.5 py-2.5 text-[14px] text-paper outline-none ring-1 ring-white/10 placeholder:text-paper/35 focus:ring-brass-400/60"
              />
            </label>
            {workshop && (
              <Button to={`/book/${workshop.id}`} variant="primary" block iconRight={<ArrowRight className="h-4 w-4" />}>
                Make it at the workshop · {aed(workshop.price)}
              </Button>
            )}
          </div>
          <p className="mt-4 flex gap-2 text-[12px] leading-relaxed text-paper/50">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brass-300" />
            This is a preview. Your perfumer finalises the blend with you in the workshop; with your consent the approved formula reference is saved to your account so you can
            reorder or gift it — no new recipes are ever invented.
          </p>
        </div>
      </div>
    </section>
  );
}

function BottleFallback({ colors }: { colors: string[] }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#140D09]">
      <div className="relative h-48 w-32">
        <div className="absolute left-1/2 top-0 h-10 w-8 -translate-x-1/2 rounded-t-md bg-gradient-to-b from-brass-300 to-brass-600" />
        <div
          className="absolute inset-x-0 bottom-0 top-9 rounded-[38%_38%_24%_24%] opacity-90 ring-1 ring-white/20"
          style={{ background: `linear-gradient(180deg, ${colors.join(', ')})` }}
        />
      </div>
    </div>
  );
}
