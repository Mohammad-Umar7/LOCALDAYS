import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, BrainCircuit, Check, ChevronDown, CircleCheck, Info, PackageSearch, RotateCcw, Sparkles, Truck, Undo2, Wheat } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/primitives';
import { experiencesForProvider, productsForProvider } from '@/data/catalog';
import { useApp } from '@/store/app';
import { useUI } from '@/store/ui';
import { explainShortage, harvestReport, type CropLine, type Recommendation } from '@/services/intelligence/harvest';
import { upcomingSlots } from '@/services/hostData';
import { aed, fmtDate, pct } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useHost } from './useHost';
import { Panel } from './ui';

export default function HostIntelligence() {
  const { provider } = useHost();
  return provider.id === 'ghaf-grove' ? <HarvestIntelligence /> : <DemandIntelligence />;
}

/* ============================ Farm: Harvest & Demand ============================ */

function HarvestIntelligence() {
  const { ctx, store } = useHost();
  const host = useApp((s) => s.host);
  const apply = useApp((s) => s.applyRecommendation);
  const undo = useApp((s) => s.undoRecommendation);
  const setOverride = useApp((s) => s.setForecastOverride);
  const toast = useUI((s) => s.toast);
  const report = useMemo(() => harvestReport(ctx, store.subscriptions, host.appliedRecs, host.forecastOverrides), [ctx, store.subscriptions, host.appliedRecs, host.forecastOverrides]);
  const explanation = useMemo(() => explainShortage(report), [report]);
  const [open, setOpen] = useState<string | null>('tomato');
  const shortage = report.shortageCrop;
  const recs = report.recommendations;
  const anyApplied = host.appliedRecs.length > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-[26px] bg-ink p-6 text-paper md:p-7">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-clay-500/25 blur-3xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-honey-300">
              <BrainCircuit className="h-3.5 w-3.5" /> Harvest & Demand Intelligence
            </div>
            <h2 className="mt-3 font-display text-[30px] leading-tight tracking-tight md:text-[36px]">
              {shortage ? (
                <>
                  {shortage.name}: <span className="text-honey-300">{Math.abs(shortage.balance)} kg short</span> this week
                </>
              ) : (
                <>Every commitment is covered this week</>
              )}
            </h2>
            <div className="mt-2 text-[13.5px] text-paper/60">
              {fmtDate(report.window.start, 'EEE d MMM')} – {fmtDate(report.window.end, 'EEE d MMM')} · {report.boxesDue} produce boxes · {report.coversThisWeek} dinner covers · deterministic kg maths, AI only explains
            </div>
          </div>
          <div className="flex gap-2">
            {(anyApplied || Object.keys(host.forecastOverrides).length > 0) && (
              <Button
                variant="glass"
                size="sm"
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={() => {
                  host.appliedRecs.forEach(undo);
                  Object.keys(host.forecastOverrides).forEach((k) => setOverride(k, null));
                }}
              >
                Reset scenario
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        {/* Explanation + actions */}
        <div className="space-y-5">
          <Panel
            title={
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-clay-500" /> What’s happening
              </span>
            }
            sub="Written from your harvest log, bookings and subscriptions — no external model in this demo"
          >
            <Typewriter text={explanation} />
          </Panel>

          <Panel title="Recommended actions" sub="Only farmer-approved swaps and verified partner supply are ever suggested">
            <div className="space-y-3">
              {recs.length === 0 && <div className="text-[13.5px] text-ink-3">No actions needed.</div>}
              {recs.map((r) => (
                <RecCard
                  key={r.id}
                  r={r}
                  onApply={() => {
                    apply(r.id);
                    toast({
                      title: r.kind === 'supplier' ? 'Purchase request drafted' : r.kind === 'swap-box' ? 'Box plan updated' : r.kind === 'surplus' ? 'Add-on offer queued' : 'Menu updated',
                      body: r.kind === 'swap-box' ? 'Subscribers will be notified before packing (simulated).' : r.kind === 'supplier' ? 'Sent to the partner for confirmation (simulated).' : r.title,
                      tone: 'success',
                    });
                  }}
                  onUndo={() => undo(r.id)}
                />
              ))}
            </div>
            {shortage === null && anyApplied && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex items-center gap-2 rounded-2xl bg-emerald-50 p-3 text-[13.5px] font-semibold text-emerald-800">
                <CircleCheck className="h-5 w-5" /> Gap closed — every box, dinner and basket is covered.
              </motion.div>
            )}
          </Panel>
        </div>

        {/* Crops */}
        <Panel title="Forecast vs committed demand" sub="Drag a forecast to test a hot week or a bumper harvest">
          <div className="space-y-2">
            {report.crops.map((c) => (
              <CropRow key={c.id} c={c} open={open === c.id} onToggle={() => setOpen(open === c.id ? null : c.id)} onForecast={(kg) => setOverride(c.id, kg)} />
            ))}
          </div>
          <details className="mt-4 rounded-2xl bg-sand-50 p-4 text-[12.5px] text-ink-2">
            <summary className="flex cursor-pointer items-center gap-1.5 font-semibold text-ink">
              <Info className="h-4 w-4" /> How these numbers are calculated
            </summary>
            <ul className="mt-2 space-y-1.5">
              <li>· Demand = boxes due this week × box contents + booked covers × the farmer’s recipe quantities + stays × breakfast basket.</li>
              <li>· Forecast = the farmer’s own harvest estimate; the range is the min–max of the last six comparable weeks. No prediction-accuracy claims are made.</li>
              <li>· Recommendations can only use swaps the farmer approved in advance and suppliers verified on Fadhal.</li>
              <li>· The explanation is generated from these figures only. In production an LLM may phrase it — it cannot change the numbers.</li>
            </ul>
          </details>
        </Panel>
      </div>
    </div>
  );
}

function Typewriter({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const step = Math.max(2, Math.round(text.length / 90));
    const t = setInterval(() => setN((v) => (v >= text.length ? (clearInterval(t), v) : v + step)), 16);
    return () => clearInterval(t);
  }, [text]);
  return (
    <p className="text-[15.5px] leading-relaxed text-ink">
      {text.slice(0, n)}
      {n < text.length && <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-clay-500 align-middle" />}
    </p>
  );
}

function RecCard({ r, onApply, onUndo }: { r: Recommendation; onApply: () => void; onUndo: () => void }) {
  const icon = r.kind === 'supplier' ? Truck : r.kind === 'surplus' ? PackageSearch : Wheat;
  const Icon = icon;
  return (
    <div className={cn('rounded-2xl border p-4 transition', r.applied ? 'border-emerald-200 bg-emerald-50/60' : 'border-line bg-white')}>
      <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', r.applied ? 'bg-emerald-500 text-white' : 'bg-sand-100 text-ink-2')}>
          {r.applied ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1 basis-[calc(100%-48px)] sm:basis-auto">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14.5px] font-semibold">{r.title}</span>
            {r.cost === 0 ? <Badge tone="success">No cost</Badge> : <Badge tone="warning">{aed(r.cost)}</Badge>}
            {r.approvedBy && <Badge tone="neutral">Approved by {r.approvedBy}</Badge>}
          </div>
          <div className="mt-1 text-[13px] text-ink-2">{r.detail}</div>
          <div className="mt-1 text-[12px] text-ink-3">{r.tradeoff}</div>
        </div>
        <div className="ml-12 shrink-0 sm:ml-0">
          {r.applied ? (
            <button onClick={onUndo} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[12px] font-semibold text-ink-3 hover:bg-white hover:text-ink">
              <Undo2 className="h-3.5 w-3.5" /> Undo
            </button>
          ) : (
            <Button size="sm" variant="dark" onClick={onApply}>
              Apply
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function CropRow({ c, open, onToggle, onForecast }: { c: CropLine; open: boolean; onToggle: () => void; onForecast: (kg: number) => void }) {
  const max = Math.max(c.forecast + c.supplyAdded, c.demand, c.range[1]) * 1.1;
  const tone = c.status === 'shortage' ? 'text-red-700 bg-red-50' : c.status === 'tight' ? 'text-amber-800 bg-amber-50' : c.status === 'surplus' ? 'text-emerald-700 bg-emerald-50' : 'text-ink-2 bg-sand-50';
  return (
    <div className={cn('rounded-2xl border transition', open ? 'border-ink/15 bg-sand-50/60' : 'border-transparent')}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-3 py-3 text-left">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.color }} />
        <span className="w-[108px] shrink-0 text-[13.5px] font-semibold">{c.name}</span>
        <span className="relative h-5 flex-1">
          {/* forecast range */}
          <span className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-sand-200" style={{ left: `${(c.range[0] / max) * 100}%`, width: `${((c.range[1] - c.range[0]) / max) * 100}%` }} />
          {/* demand bar */}
          <motion.span className="absolute left-0 top-1/2 h-2.5 -translate-y-1/2 rounded-r-[4px]" style={{ background: c.color, opacity: 0.85 }} initial={false} animate={{ width: `${(c.demand / max) * 100}%` }} transition={{ duration: 0.6 }} />
          {/* forecast marker */}
          <motion.span className="absolute top-0 h-5 w-[2px] rounded bg-ink" initial={false} animate={{ left: `${((c.forecast + c.supplyAdded) / max) * 100}%` }} transition={{ duration: 0.6 }} />
        </span>
        <span className={cn('w-[92px] shrink-0 rounded-full px-2 py-1 text-center text-[11.5px] font-bold tabular', tone)}>
          {c.status === 'shortage' ? `${c.balance} kg` : c.status === 'surplus' ? `+${c.balance} kg` : c.status === 'tight' ? `Tight +${c.balance}` : `OK +${c.balance}`}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-ink-3 transition', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-3 px-3 pb-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Mini label="Forecast" value={`${c.forecast} kg`} sub={`range ${c.range[0]}–${c.range[1]}`} />
                <Mini label="Committed" value={`${c.demand} kg`} sub={`${c.sources.filter((s) => s.kg > 0).length} sources`} />
                <Mini label="Partner supply" value={`${c.supplyAdded} kg`} sub="verified" />
              </div>
              <label className="block">
                <span className="flex justify-between text-[12px] font-semibold text-ink-2">
                  What if the harvest is… <span className="tabular">{c.forecast} kg</span>
                </span>
                <input type="range" min={Math.round(c.range[0] * 0.6)} max={Math.round(c.range[1] * 1.4)} value={c.forecast} onChange={(e) => onForecast(Number(e.target.value))} className="mt-1.5 w-full accent-clay-500" />
              </label>
              <ul className="space-y-1.5">
                {c.sources.map((s) => (
                  <li key={s.key} className="flex items-center justify-between gap-3 text-[12.5px]">
                    <span className="min-w-0 truncate text-ink-2">
                      {s.label} <span className="text-ink-4">· {s.detail}</span>
                    </span>
                    <span className={cn('tabular shrink-0 font-semibold', s.kg < 0 ? 'text-emerald-700' : 'text-ink')}>{s.kg > 0 ? '' : '−'}{Math.abs(s.kg)} kg</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl bg-white px-2 py-2.5 shadow-ring">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-3">{label}</div>
      <div className="tabular mt-0.5 text-[15px] font-semibold">{value}</div>
      <div className="text-[11px] text-ink-3">{sub}</div>
    </div>
  );
}

/* ============================ Other hosts: demand & stock ============================ */

function DemandIntelligence() {
  const { provider, ctx, weeks } = useHost();
  const slots = useMemo(() => upcomingSlots(provider.id, ctx, 14), [provider.id, ctx]);
  const exps = experiencesForProvider(provider.id);
  const products = productsForProvider(provider.id).filter((p) => p.stock !== undefined);
  const weeklyProducts = weeks.slice(-4).reduce((s, w) => s + w.products, 0) / 4;
  const avgPrice = products.length ? products.reduce((s, p) => s + p.price, 0) / products.length : 1;
  const unitsPerWeek = weeklyProducts / avgPrice;

  const perExp = exps.map((e) => {
    const s = slots.filter((x) => x.experienceId === e.id);
    const booked = s.reduce((a, x) => a + x.booked, 0);
    const cap = s.reduce((a, x) => a + x.capacity, 0) || 1;
    return { e, fill: booked / cap, sessions: s.length };
  });

  return (
    <div className="space-y-5">
      <div className="rounded-[26px] bg-ink p-6 text-paper">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-honey-300">
          <BrainCircuit className="h-3.5 w-3.5" /> Demand intelligence
        </div>
        <h2 className="mt-3 font-display text-[28px] leading-tight">Where your next two weeks are full — and where they aren’t.</h2>
        <p className="mt-2 text-[13.5px] text-paper/60">Calculated from live bookings and recent sales. Recommendations are rules you can audit, never black-box predictions.</p>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Session fill · next 14 days">
          <div className="space-y-3">
            {perExp.map(({ e, fill, sessions }) => (
              <div key={e.id}>
                <div className="mb-1 flex justify-between gap-3 text-[13px]">
                  <span className="truncate font-medium">{e.title}</span>
                  <span className="tabular shrink-0 font-semibold">
                    {pct(fill)} <span className="font-normal text-ink-3">· {sessions} sessions</span>
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-sand-100">
                  <div className={cn('h-full rounded-full', fill > 0.85 ? 'bg-clay-500' : fill < 0.35 ? 'bg-amber-400' : 'bg-oasis-400')} style={{ width: `${fill * 100}%` }} />
                </div>
                {fill < 0.35 && sessions > 0 && <div className="mt-1 text-[12px] text-amber-800">Under-booked: try a family bundle with a neighbouring host via the Day Composer.</div>}
                {fill > 0.85 && <div className="mt-1 text-[12px] text-clay-700">Nearly full: consider an extra session or a prepaid presale within approved capacity.</div>}
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Stock runway" sub={`≈ ${Math.max(1, Math.round(unitsPerWeek))} units sold per week (4-week average)`}>
          <div className="divide-y divide-line">
            {products.map((p) => {
              const weeksLeft = (p.stock ?? 0) / Math.max(0.5, unitsPerWeek / Math.max(1, products.length));
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                  <span className="min-w-0 truncate font-medium">{p.name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="tabular text-ink-3">{p.stock} in stock</span>
                    {weeksLeft < 3 ? (
                      <Badge tone="warning" icon={<AlertTriangle className="h-3 w-3" />}>
                        ~{Math.max(1, Math.round(weeksLeft))} wk left
                      </Badge>
                    ) : (
                      <Badge tone="success">{Math.round(weeksLeft)}+ wks</Badge>
                    )}
                  </span>
                </div>
              );
            })}
            {products.length === 0 && <div className="py-4 text-[13px] text-ink-3">This host sells passes and experiences rather than stocked products.</div>}
          </div>
        </Panel>
      </div>
      <div className="text-[12px] text-ink-3">
        Tip: switch to <span className="font-semibold">Ghaf Grove Farmstay</span> in the host switcher to see the full Harvest & Demand Intelligence demo.
      </div>
    </div>
  );
}
