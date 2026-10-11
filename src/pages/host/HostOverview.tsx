import { ArrowRight, BrainCircuit, CalendarClock, Check, Lightbulb, Send, Table2, Truck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable, LineArea, Legend, StackedColumns, SERIES } from '@/components/charts/Charts';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/primitives';
import { EXPERIENCE_BY_ID, PRESALES, experiencesForProvider, productsForProvider } from '@/data/catalog';
import { getSlots } from '@/services/availability';
import { useApp } from '@/store/app';
import { useUI } from '@/store/ui';
import { earnings30, hostCustomers, upcomingSlots, weekdayUtilisation } from '@/services/hostData';
import { harvestReport } from '@/services/intelligence/harvest';
import { aed, fmtDate, fmtTime, pct } from '@/lib/format';
import { rangeISO, relativeDayLabel } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { useHost } from './useHost';
import { Kpi, Panel } from './ui';

const MIX = [
  { key: 'experiences', label: 'Experiences' },
  { key: 'products', label: 'Products' },
  { key: 'subscriptions', label: 'Subscriptions' },
  { key: 'presales', label: 'Prepaid' },
];

export default function HostOverview() {
  const { provider, ctx, weeks, store, presaleSold } = useHost();
  const host = useApp((s) => s.host);
  const sendFollowUp = useApp((s) => s.sendFollowUp);
  const toast = useUI((s) => s.toast);
  const [table, setTable] = useState(false);

  const slots = useMemo(() => upcomingSlots(provider.id, ctx, 14), [provider.id, ctx]);
  const util = useMemo(() => weekdayUtilisation(provider.id, ctx), [provider.id, ctx]);
  const customers = useMemo(() => hostCustomers(provider.id, ctx.todayISO, host.followUps), [provider.id, ctx.todayISO, host.followUps]);
  const earn = useMemo(() => earnings30(provider.id, weeks, store, presaleSold), [provider.id, weeks, store, presaleSold]);
  const harvest = useMemo(
    () => (provider.id === 'ghaf-grove' ? harvestReport(ctx, store.subscriptions, host.appliedRecs, host.forecastOverrides) : null),
    [provider.id, ctx, store.subscriptions, host.appliedRecs, host.forecastOverrides],
  );

  const last = weeks[weeks.length - 1];
  const prev = weeks[weeks.length - 2];
  const tourism30 = weeks.slice(-4).reduce((s, w) => s + w.experiences, 0);
  const tourismPrev = weeks.slice(-8, -4).reduce((s, w) => s + w.experiences, 0);
  const products30 = weeks.slice(-4).reduce((s, w) => s + w.products + w.subscriptions, 0);
  const productsPrev = weeks.slice(-8, -4).reduce((s, w) => s + w.products + w.subscriptions, 0);
  const guests14 = slots.filter((s) => EXPERIENCE_BY_ID[s.experienceId].priceUnit !== 'per_night').reduce((a, s) => a + s.booked, 0);
  const stays = slots.filter((s) => EXPERIENCE_BY_ID[s.experienceId].priceUnit === 'per_night');
  // Nights actually offered in the window (upcomingSlots only lists nights that have bookings)
  const nightsOffered = useMemo(
    () =>
      experiencesForProvider(provider.id)
        .filter((e) => e.priceUnit === 'per_night')
        .reduce((a, e) => a + rangeISO(ctx.todayISO, 14).reduce((n, d) => n + getSlots(e, d, { ...ctx, holds: {} }).reduce((m, sl) => m + sl.capacity, 0), 0), 0),
    [provider.id, ctx],
  );
  const nightsBooked = stays.reduce((a, s) => a + s.booked, 0);
  const retention = customers.filter((c) => c.boughtAfterVisit).length / customers.length;
  const notOffered = customers.filter((c) => !c.offerSent && !c.boughtAfterVisit && c.visits > 0);
  const offerSent = host.followUps.includes(`post-visit:${provider.id}`);
  const subPlan = productsForProvider(provider.id).find((p) => p.subscription)?.subscription;
  const nextDelivery = store.subscriptions.filter((s) => s.providerId === provider.id && s.status === 'active');
  const delta = (a: number, b: number) => (b ? `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%` : '—');

  const insights: { id: string; title: string; body: string; action?: { label: string; run: () => void; done?: boolean } }[] = [];
  if (harvest?.shortageCrop)
    insights.push({
      id: 'harvest',
      title: `${harvest.shortageCrop.name}: ${Math.abs(harvest.shortageCrop.balance)} kg short this week`,
      body: `Committed demand ${harvest.shortageCrop.demand} kg vs ${harvest.shortageCrop.forecast} kg forecast. Approved swaps and a verified partner can close the gap.`,
    });
  if (util.weekday < 0.5 && util.weekend > 0.6)
    insights.push({
      id: 'weekday',
      title: `Weekdays are ${pct(util.weekday)} full vs ${pct(util.weekend)} at weekends`,
      body: 'A weekday school or corporate package could use idle capacity without discounting your weekend slots.',
    });
  if (notOffered.length)
    insights.push({
      id: 'followup',
      title: `${notOffered.length} recent guests haven’t been offered your shop`,
      body: 'Guests who get a personalised post-visit offer within 48 hours are the most likely to reorder. Send one now?',
      action: {
        label: offerSent ? 'Offer sent' : 'Send post-visit offer',
        done: offerSent,
        run: () => {
          sendFollowUp(`post-visit:${provider.id}`);
          toast({ title: 'Post-visit offers scheduled', body: `${notOffered.length} guests will receive a personalised shop link (simulated).`, tone: 'success' });
        },
      },
    });
  if (subPlan && last.subscribers >= subPlan.capacity * 0.8)
    insights.push({ id: 'cap', title: 'Subscriptions near your approved capacity', body: `${last.subscribers} of ${subPlan.capacity} places taken. Pause new sign-ups or add partner supply before promising more boxes.` });
  const offer = PRESALES.find((o) => o.providerId === provider.id);
  if (offer)
    insights.push({
      id: 'presale',
      title: `${earn.presaleObligations.units} prepaid experiences still to deliver`,
      body: `Worth ${aed(earn.presaleObligations.value)} at full price. Keep ${earn.presaleObligations.units} slots free within the next ${Math.round(offer.expiresInDays / 30)} months.`,
    });

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <Kpi label="Confirmed guests · next 14 days" value={guests14} sub={`${slots.length} sessions`} />
        <Kpi label="Tourism revenue · 30 days" value={aed(tourism30)} delta={{ v: delta(tourism30, tourismPrev), good: tourism30 >= tourismPrev }} trend={weeks.map((w) => w.experiences)} tone={SERIES[0]} />
        <Kpi label="Product & subscription sales · 30 days" value={aed(products30)} delta={{ v: delta(products30, productsPrev), good: products30 >= productsPrev }} trend={weeks.map((w) => w.products + w.subscriptions)} tone={SERIES[1]} />
        <Kpi label="Estimated net earnings · 30 days" value={aed(earn.net)} sub="after costs & commission" />
        {subPlan && <Kpi label="Active subscribers" value={last.subscribers} delta={{ v: `+${last.subscribers - weeks[0].subscribers} in 12 wks`, good: true }} trend={weeks.map((w) => w.subscribers)} tone={SERIES[2]} />}
        <Kpi label="Guests who bought again" value={pct(retention)} sub="within 30 days of visiting" />
        {nightsOffered > 0 && (
          <Kpi label="Upcoming stays · 14 days" value={`${nightsBooked} nights`} sub={`${pct(nightsBooked / nightsOffered)} of ${nightsOffered} nights offered`} />
        )}
        {offer && <Kpi label="Prepaid commitments outstanding" value={earn.presaleObligations.units} sub={`${aed(earn.presaleHeld)} held until redeemed`} />}
        {harvest && <Kpi label="Harvest forecast · 7 days" value={`${Math.round(harvest.crops.reduce((a, c) => a + c.forecast, 0))} kg`} sub={`${harvest.crops.length} crops · from your harvest log`} />}
        {harvest && <Kpi label="Committed produce · 7 days" value={`${Math.round(harvest.crops.reduce((a, c) => a + c.demand, 0))} kg`} sub={`${harvest.boxesDue} boxes · ${harvest.coversThisWeek} dinner covers`} />}
        {harvest && <Kpi label="Upcoming deliveries · 7 days" value={`${harvest.boxesDue} boxes`} sub="packed Wednesday · delivered Thursday" />}
        <Kpi
          label="After-visit share of sales · 30 days"
          value={pct(products30 / Math.max(1, products30 + tourism30))}
          sub="products & subscriptions from past guests"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Panel
          title="Revenue mix · last 12 weeks"
          sub="Experiences bring guests in; products and subscriptions keep them buying"
          action={
            <button onClick={() => setTable((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink-2 hover:border-ink/30">
              <Table2 className="h-3.5 w-3.5" /> {table ? 'Chart' : 'Table'}
            </button>
          }
        >
          <Legend series={MIX} className="mb-3" />
          {table ? (
            <DataTable
              columns={['Week of', 'Experiences', 'Products', 'Subscriptions', 'Prepaid']}
              rows={weeks.map((w) => [w.label, aed(w.experiences), aed(w.products), aed(w.subscriptions), aed(w.presales)])}
            />
          ) : (
            <StackedColumns data={weeks.map((w) => ({ label: w.label, values: { experiences: w.experiences, products: w.products, subscriptions: w.subscriptions, presales: w.presales } }))} series={MIX} height={260} />
          )}
        </Panel>

        <Panel
          title={
            <span className="inline-flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-clay-500" /> LocalDays Intelligence
            </span>
          }
          sub="Rule-based insights from your bookings, orders and harvest log"
        >
          <div className="space-y-3">
            {insights.slice(0, 4).map((i) => (
              <div key={i.id} className="rounded-2xl bg-sand-50 p-4">
                <div className="flex items-start gap-2.5">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-honey-600" />
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold leading-snug">{i.title}</div>
                    <div className="mt-1 text-[12.5px] text-ink-2">{i.body}</div>
                    {i.id === 'harvest' && (
                      <Link to="/host/intelligence" className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-clay-600">
                        Open Harvest & Demand AI <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                    {i.action && (
                      <Button size="sm" variant={i.action.done ? 'soft' : 'dark'} className="mt-2.5" disabled={i.action.done} onClick={i.action.run} icon={i.action.done ? <Check className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}>
                        {i.action.label}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {insights.length === 0 && <div className="text-[13px] text-ink-3">All clear — nothing needs your attention today.</div>}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        {subPlan ? (
          <Panel title="Active subscribers" sub={`Approved capacity ${subPlan.capacity}`}>
            <LineArea data={weeks.map((w) => ({ label: w.label, value: w.subscribers }))} color={SERIES[2]} label="Active subscribers by week" height={210} />
            <div className="mt-3 flex items-center gap-2 text-[12.5px] text-ink-3">
              <Truck className="h-4 w-4" /> {nextDelivery.length ? `Next demo delivery ${fmtDate(nextDelivery[0].nextDelivery)}` : 'Deliveries every Thursday (demo)'}
            </div>
          </Panel>
        ) : (
          <Panel title="Repeat experiences" sub="Season passes and group days drive repeat revenue in this category">
            <LineArea data={weeks.map((w) => ({ label: w.label, value: w.guests }))} color={SERIES[1]} label="Guests per week" height={210} />
          </Panel>
        )}
        <Panel
          title="Coming up"
          sub="Next 14 days · live from your calendar"
          action={
            <Link to="/host/bookings" className="text-[12.5px] font-semibold text-clay-600">
              All bookings →
            </Link>
          }
        >
          <div className="divide-y divide-line">
            {slots.slice(0, 7).map((s) => {
              const e = EXPERIENCE_BY_ID[s.experienceId];
              const fill = s.booked / s.capacity;
              return (
                <div key={s.key} className="flex items-center gap-3 py-2.5">
                  <div className="w-[86px] shrink-0">
                    <div className="text-[12.5px] font-semibold">{relativeDayLabel(ctx.todayISO, s.date)}</div>
                    <div className="text-[11.5px] text-ink-3">{s.time ? fmtTime(s.time) : 'Night'}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium">{e.title}</div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sand-100">
                      <div className={cn('h-full rounded-full', fill > 0.9 ? 'bg-clay-500' : 'bg-oasis-400')} style={{ width: `${fill * 100}%` }} />
                    </div>
                  </div>
                  <div className="w-[64px] shrink-0 text-right text-[12.5px] font-semibold tabular">
                    {s.booked}/{s.capacity}
                    {s.demo > 0 && <Badge tone="clay" className="ml-1 px-1.5 py-0">new</Badge>}
                  </div>
                </div>
              );
            })}
            {slots.length === 0 && <div className="py-6 text-center text-[13px] text-ink-3">No bookings in the next 14 days.</div>}
          </div>
          <div className="mt-3 flex items-center gap-2 text-[12px] text-ink-3">
            <CalendarClock className="h-3.5 w-3.5" /> Weekdays {pct(util.weekday)} full · weekends {pct(util.weekend)} full
          </div>
        </Panel>
      </div>
    </div>
  );
}
