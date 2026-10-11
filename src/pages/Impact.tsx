import { motion, useInView } from 'framer-motion';
import { AlertTriangle, ArrowRight, Building2, Coins, Compass, Flag, Landmark, Leaf, Map as MapIcon, Repeat, ShieldCheck, Store, Table2, Ticket, TreePalm, Users } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { BarList, DataTable, Legend, SERIES, StackedColumns } from '@/components/charts/Charts';
import { SharjahMap } from '@/components/map/SharjahMap';
import { REGION_BY_ID } from '@/data/regions';
import { Badge, Reveal, SectionHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/Button';
import { ECONOMICS } from '@/config/economics';
import { CATEGORIES } from '@/data/categories';
import { PROVIDERS } from '@/data/catalog';
import type { RegionId } from '@/data/types';
import { useApp, useAvailabilityCtx } from '@/store/app';
import { hostHistory } from '@/services/hostData';
import { aed, compactNum, pct } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function Impact() {
  return (
    <AppShell>
      <Lifecycle />
      <Streams />
      <Pilot />
      <Simulator />
      <Hypotheses />
      <ImpactAndRoadmap />
    </AppShell>
  );
}

/* ------------------------------- Lifecycle ------------------------------- */

function CountUp({ to, prefix = '', duration = 1.6 }: { to: number; prefix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / (duration * 1000));
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);
  return (
    <span ref={ref} className="tabular">
      {prefix}
      {v.toLocaleString()}
    </span>
  );
}

function Lifecycle() {
  const steps = [
    { k: 'Visit', v: 0, t: 'Discovers Ghaf Grove in 3D, books in two minutes.' },
    { k: 'Experience', v: 450, t: 'Family Farm Day — harvest, plant, lunch under the palms.' },
    { k: 'Purchase', v: 0, t: 'Leaves with a basket; the farm shop now remembers them.' },
    { k: 'Subscribe', v: 120, t: 'Weekly AED 120 produce box from the same beds.' },
    { k: 'Repeat', v: 360, t: 'Three more boxes in the first month.' },
  ];
  let acc = 0;
  return (
    <section className="relative overflow-hidden bg-ink text-paper">
      <div className="pattern-girih-light absolute inset-0 opacity-50" />
      <div className="absolute left-1/2 top-10 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-clay-500/20 blur-[130px]" />
      <div className="shell relative py-16 md:py-24">
        <div className="max-w-3xl">
          <div className="eyebrow text-honey-300/80">Business model & impact</div>
          <h1 className="display-lg mt-4 text-balance">
            A cultural experience shouldn’t end <span className="serif-italic text-honey-300">when the visitor leaves.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[16.5px] text-paper/65">
            Our hypothesis: local experiences are the best customer-acquisition channel a small business can have. LocalDays turns one booking into a relationship — and we measure whether
            it works rather than assume it does.
          </p>
        </div>
        <div className="mt-12 grid gap-3 md:grid-cols-5">
          {steps.map((s, i) => {
            acc += s.v;
            const total = acc;
            return (
              <Reveal key={s.k} delay={i * 0.12}>
                <div className={cn('relative h-full rounded-[24px] p-5 ring-1', i === 4 ? 'bg-clay-500 ring-clay-400' : 'bg-white/[0.06] ring-white/10')}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-paper/55">0{i + 1}</span>
                    {i < 4 && <ArrowRight className="hidden h-4 w-4 text-paper/30 md:block" />}
                  </div>
                  <div className="mt-3 font-display text-[26px]">{s.k}</div>
                  <p className="mt-1 text-[13px] text-paper/65">{s.t}</p>
                  <div className="mt-4 border-t border-white/10 pt-3">
                    <div className="text-[11px] text-paper/50">Farm’s gross sales so far</div>
                    <div className="font-display text-[22px]">
                      <CountUp to={total} prefix="AED " />
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
        <p className="mt-5 text-[13px] text-paper/50">
          AED 450 visit + 4 × AED 120 boxes = AED 930 in month one, before fulfilment costs and commission. Illustrative example from the demo data — not a guaranteed outcome.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------- Streams ------------------------------- */

function Streams() {
  const cards = [
    {
      icon: Ticket,
      k: 'A',
      t: 'Experience commissions',
      d: `${ECONOMICS.experienceCommission * 100}% of every booking`,
      ex: [`AED 200 booking`, `× ${ECONOMICS.experienceCommission * 100}%`, `= AED ${200 * ECONOMICS.experienceCommission} to LocalDays`],
    },
    {
      icon: Repeat,
      k: 'B',
      t: 'Recurring commerce',
      d: `${ECONOMICS.productCommission * 100}% of eligible orders & subscriptions`,
      ex: ['AED 120 weekly box', `× ${ECONOMICS.productCommission * 100}% × 52 weeks`, `= AED ${Math.round(120 * ECONOMICS.productCommission * 52).toLocaleString('en-US')} / subscriber / year`],
    },
    {
      icon: Building2,
      k: 'C',
      t: 'Business software',
      d: 'Optional LocalDays Pro',
      ex: [`AED ${ECONOMICS.proPlanMonthly} / month`, 'bookings · stock · CRM · intelligence', `= AED ${(ECONOMICS.proPlanMonthly * 12).toLocaleString('en-US')} / host / year`],
    },
    {
      icon: Coins,
      k: 'D',
      t: 'Prepaid experiences',
      d: `${ECONOMICS.presaleCommission * 100}% commission, customer-funded only`,
      ex: ['20 × AED 200 presale', `= AED 4,000 collected · AED ${4000 * ECONOMICS.presaleCommission} commission`, 'tracked as obligations, not profit'],
    },
  ];
  return (
    <section className="py-16 md:py-24">
      <div className="shell">
        <SectionHeader eyebrow="How LocalDays earns" title="Four revenue streams. One of them repeats every week." description="All rates are illustrative and adjustable in a single configuration file." />
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((c, i) => (
            <Reveal key={c.k} delay={i * 0.06}>
              <div className="flex h-full flex-col rounded-[26px] border border-line bg-white p-6">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-clay-50 text-clay-600">
                    <c.icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-[40px] leading-none text-sand-300">{c.k}</span>
                </div>
                <div className="mt-5 text-[18px] font-semibold">{c.t}</div>
                <div className="text-[13.5px] text-ink-3">{c.d}</div>
                <div className="mt-auto pt-5">
                  <div className="space-y-0.5 rounded-2xl bg-sand-50 p-4 font-mono text-[12.5px] text-ink-2">
                    {c.ex.map((l) => (
                      <div key={l}>{l}</div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- Pilot dashboard ------------------------------- */

function Pilot() {
  const ctx = useAvailabilityCtx();
  const bookings = useApp((s) => s.bookings);
  const orders = useApp((s) => s.orders);
  const subscriptions = useApp((s) => s.subscriptions);
  const vouchers = useApp((s) => s.vouchers);
  const [table, setTable] = useState(false);
  const store = useMemo(() => ({ bookings, orders, subscriptions, vouchers }), [bookings, orders, subscriptions, vouchers]);
  const all = useMemo(() => PROVIDERS.map((p) => ({ p, weeks: hostHistory(p.id, ctx.todayISO, store) })), [ctx.todayISO, store]);

  const weeks = all[0].weeks.map((w, i) => {
    const sum = (k: 'experiences' | 'products' | 'subscriptions' | 'presales') => all.reduce((s, x) => s + x.weeks[i][k], 0);
    const exp = sum('experiences');
    const prod = sum('products');
    const subs = sum('subscriptions');
    const pre = sum('presales');
    return {
      label: w.label,
      gmv: exp + prod + subs + pre,
      platform: { exp: exp * ECONOMICS.experienceCommission, prod: (prod + subs) * ECONOMICS.productCommission, saas: (PROVIDERS.length * 0.6 * ECONOMICS.proPlanMonthly) / 4.3, pre: pre * ECONOMICS.presaleCommission },
      exp,
      prod: prod + subs,
    };
  });
  const gmv = weeks.reduce((s, w) => s + w.gmv, 0);
  const platform = weeks.reduce((s, w) => s + w.platform.exp + w.platform.prod + w.platform.saas + w.platform.pre, 0);
  const firstShare = weeks.slice(0, 4).reduce((s, w) => s + w.prod, 0) / weeks.slice(0, 4).reduce((s, w) => s + w.gmv, 0);
  const lastShare = weeks.slice(-4).reduce((s, w) => s + w.prod, 0) / weeks.slice(-4).reduce((s, w) => s + w.gmv, 0);
  const byCat = CATEGORIES.map((c, i) => ({
    label: c.shortName,
    value: all.filter((x) => x.p.categoryId === c.id).reduce((s, x) => s + x.weeks.reduce((a, w) => a + w.experiences + w.products + w.subscriptions, 0), 0),
    color: c.theme.accent,
  }));
  const regionGmv = new Map<RegionId, number>();
  all.forEach(({ p, weeks: w }) => regionGmv.set(p.regionId, (regionGmv.get(p.regionId) ?? 0) + w.reduce((a, x) => a + x.experiences + x.products, 0)));
  const maxRegion = Math.max(1, ...regionGmv.values());
  const outside = [...regionGmv.entries()].filter(([r]) => r !== 'sharjah-city').reduce((a, [, v]) => a + v, 0) / [...regionGmv.values()].reduce((a, v) => a + v, 0);
  const subscribersNow = all.reduce((s, x) => s + x.weeks[x.weeks.length - 1].subscribers, 0);

  return (
    <section className="bg-sand-100 py-16 md:py-24">
      <div className="shell">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <SectionHeader eyebrow="Pilot dashboard" title="12 weeks, 15 hosts, 9 regions." description="Simulated pilot built from the demo hosts’ fictional histories — plus every booking, order and subscription you make in this demo, live." />
          <Badge tone="warning">Simulated data · not actual results</Badge>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { k: 'Gross bookings & sales (GMV)', v: aed(gmv), s: '12 weeks' },
            { k: 'LocalDays net revenue', v: aed(platform), s: `${((platform / gmv) * 100).toFixed(1)}% blended take rate` },
            { k: 'Kept by local businesses', v: pct(1 - platform / gmv - ECONOMICS.paymentProcessing), s: 'after commission & processing' },
            { k: 'Spend outside Sharjah City', v: pct(outside), s: 'tourism dispersed to 8 regions' },
            { k: 'Products’ share of host sales', v: `${pct(firstShare)} → ${pct(lastShare)}`, s: 'first 4 weeks vs last 4' },
            { k: 'Active subscriptions', v: subscribersNow, s: 'produce boxes, honey & date clubs' },
            { k: 'Hosts on LocalDays Pro', v: `${Math.round(PROVIDERS.length * 0.6)} of ${PROVIDERS.length}`, s: 'assumed 60% adoption' },
            { k: 'Heritage sessions delivered', v: compactNum(Math.round(all.reduce((s, x) => s + x.weeks.reduce((a, w) => a + w.guests, 0), 0) / 6)), s: 'workshops, tours & demos' },
          ].map((x) => (
            <div key={x.k} className="rounded-[22px] bg-white p-5 shadow-ring">
              <div className="text-[12.5px] font-semibold text-ink-3">{x.k}</div>
              <div className="mt-2 text-[24px] font-semibold leading-none tracking-tight md:text-[28px]">{x.v}</div>
              <div className="mt-1.5 text-[12px] text-ink-3">{x.s}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
          <div className="flex flex-col rounded-[26px] bg-white p-5 shadow-ring md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[16px] font-semibold">LocalDays revenue by stream</div>
                <div className="text-[12.5px] text-ink-3">Weekly, all hosts</div>
              </div>
              <button onClick={() => setTable((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink-2">
                <Table2 className="h-3.5 w-3.5" /> {table ? 'Chart' : 'Table'}
              </button>
            </div>
            <Legend
              className="my-3"
              series={[
                { key: 'exp', label: 'A · Experience commissions' },
                { key: 'prod', label: 'B · Recurring commerce' },
                { key: 'saas', label: 'C · Pro subscriptions' },
                { key: 'pre', label: 'D · Prepaid commissions' },
              ]}
            />
            {table ? (
              <DataTable columns={['Week of', 'A', 'B', 'C', 'D']} rows={weeks.map((w) => [w.label, aed(w.platform.exp), aed(w.platform.prod), aed(w.platform.saas), aed(w.platform.pre)])} />
            ) : (
              // Grows to fill the card when it sits beside the taller map column
              <FillHeight min={280}>
                {(h) => (
                  <StackedColumns
                    data={weeks.map((w) => ({ label: w.label, values: w.platform }))}
                    series={[
                      { key: 'exp', label: 'Experience commissions' },
                      { key: 'prod', label: 'Recurring commerce' },
                      { key: 'saas', label: 'Pro subscriptions' },
                      { key: 'pre', label: 'Prepaid commissions' },
                    ]}
                    height={h}
                  />
                )}
              </FillHeight>
            )}
            <StreamTotals weeks={weeks} />
          </div>
          <div className="space-y-5">
            <div className="rounded-[26px] bg-white p-5 shadow-ring md:p-6">
              <div className="mb-4 text-[16px] font-semibold">Host sales by tradition · 12 weeks</div>
              <BarList items={byCat} format={(n) => aed(n)} />
            </div>
            <div className="overflow-hidden rounded-[26px] bg-white shadow-ring">
              <SharjahMap
                pins={[...regionGmv.entries()].map(([regionId, v]) => ({
                  regionId,
                  color: '#C0532B',
                  size: Math.sqrt(v / maxRegion),
                  label: REGION_BY_ID[regionId].name,
                  sub: `AED ${Math.round(v / 1000)}k`,
                }))}
                className="aspect-[4/3]"
              />
              <div className="border-t border-line px-5 py-3 text-[12px] text-ink-3">12-week host sales by region, AED (simulated). Circle area follows sales.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- Simulator ------------------------------- */

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <label className="block">
      <span className="flex justify-between gap-3 text-[13px]">
        <span className="font-medium text-ink-2">{label}</span>
        <span className="tabular font-semibold">{fmt(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1.5 w-full accent-clay-500" />
    </label>
  );
}

function Simulator() {
  const [visitors, setVisitors] = useState(3000);
  const [booking, setBooking] = useState(320);
  const [buy, setBuy] = useState(0.18);
  const [spend, setSpend] = useState(140);
  const [subRate, setSubRate] = useState(0.06);
  const [subPrice, setSubPrice] = useState(120);
  const [hosts, setHosts] = useState(60);
  const [pro, setPro] = useState(0.45);
  const [expRate, setExpRate] = useState<number>(ECONOMICS.experienceCommission);
  const [prodRate, setProdRate] = useState<number>(ECONOMICS.productCommission);

  const m = useMemo(() => {
    const expGmv = visitors * booking;
    const buyers = visitors * buy;
    const oneOff = buyers * spend;
    const subscribers = visitors * subRate;
    // cohort subscriptions accumulate with ~8% monthly churn → steady-state multiplier ≈ 1/0.08 in the long run; we show month-12 level
    const steady = subscribers * ((1 - Math.pow(0.92, 12)) / 0.08);
    const subGmv = steady * subPrice * 4.3;
    const prodGmv = oneOff + subGmv;
    const platform = expGmv * expRate + prodGmv * prodRate + hosts * pro * ECONOMICS.proPlanMonthly;
    const hostIncome = expGmv + prodGmv - (expGmv * expRate + prodGmv * prodRate) - (expGmv + prodGmv) * ECONOMICS.paymentProcessing;
    const perVisitor12 = booking + buy * spend * 3 + subRate * subPrice * 4.3 * 7;
    return { expGmv, prodGmv, platform, hostIncome, steady, perVisitor12, withoutCommerce: booking };
  }, [visitors, booking, buy, spend, subRate, subPrice, hosts, pro, expRate, prodRate]);

  return (
    <section className="py-16 md:py-24">
      <div className="shell">
        <SectionHeader eyebrow="Unit economics" title="Move the assumptions. Watch the model." description="A scenario model for month 12 of a city-wide rollout. Every input is an assumption to validate — this is not a forecast." />
        <div className="mt-10 grid gap-6 xl:grid-cols-[1fr_1.1fr]">
          <div className="grid gap-5 rounded-[26px] border border-line bg-white p-6 sm:grid-cols-2">
            <Slider label="Experience guests / month" value={visitors} min={500} max={20000} step={500} onChange={setVisitors} fmt={(v) => v.toLocaleString()} />
            <Slider label="Avg. booking value" value={booking} min={80} max={900} step={10} onChange={setBooking} fmt={(v) => aed(v)} />
            <Slider label="Guests who buy after visiting" value={buy} min={0} max={0.5} step={0.01} onChange={setBuy} fmt={(v) => pct(v)} />
            <Slider label="Avg. one-off product spend" value={spend} min={20} max={500} step={10} onChange={setSpend} fmt={(v) => aed(v)} />
            <Slider label="Guests who subscribe" value={subRate} min={0} max={0.2} step={0.005} onChange={setSubRate} fmt={(v) => pct(v, 1)} />
            <Slider label="Subscription price / week" value={subPrice} min={40} max={250} step={5} onChange={setSubPrice} fmt={(v) => aed(v)} />
            <Slider label="Hosts on the platform" value={hosts} min={15} max={400} step={5} onChange={setHosts} fmt={(v) => `${v}`} />
            <Slider label="Hosts choosing Pro" value={pro} min={0} max={1} step={0.05} onChange={setPro} fmt={(v) => pct(v)} />
            <Slider label="Experience commission" value={expRate} min={0.05} max={0.2} step={0.01} onChange={setExpRate} fmt={(v) => pct(v)} />
            <Slider label="Product commission" value={prodRate} min={0.03} max={0.2} step={0.01} onChange={setProdRate} fmt={(v) => pct(v)} />
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { k: 'Monthly GMV', v: aed(m.expGmv + m.prodGmv) },
                { k: 'LocalDays revenue / month', v: aed(m.platform) },
                { k: 'Local business income / month', v: aed(m.hostIncome) },
                { k: 'Active subscriptions (month 12)', v: Math.round(m.steady).toLocaleString() },
              ].map((x) => (
                <div key={x.k} className="rounded-[22px] bg-ink p-5 text-paper">
                  <div className="text-[12px] font-semibold text-paper/55">{x.k}</div>
                  <div className="mt-2 text-[24px] font-semibold leading-none md:text-[28px]">{x.v}</div>
                </div>
              ))}
            </div>
            <div className="rounded-[22px] border border-line bg-white p-5">
              <div className="text-[14px] font-semibold">Value of one guest to their host over 12 months</div>
              <div className="mt-4 space-y-3">
                <BarList
                  items={[
                    { label: 'Experience only (typical platform)', value: m.withoutCommerce, color: '#B3A897' },
                    { label: 'Experience + LocalDays commerce', value: m.perVisitor12, color: SERIES[0] },
                  ]}
                  format={(n) => aed(n)}
                />
              </div>
              <div className="mt-3 text-[12px] text-ink-3">Assumes buyers purchase 3× a year and subscribers stay ~7 months on average (8% monthly churn).</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- Hypotheses ------------------------------- */

function Hypotheses() {
  const rows = [
    ['Experiences convert guests into product customers', '% of guests buying from the host within 30 days', '≥ 15%', 'Orders linked to the booking’s customer'],
    ['Subscriptions retain', 'Subscribers still active after 8 weeks', '≥ 60%', 'Subscription status history'],
    ['Hosts earn more from relationships', 'Products & subscriptions as share of host sales', '≥ 20% by week 12', 'Host ledger'],
    ['The Passport drives exploration', 'Stamp holders who try a second tradition in 60 days', '≥ 25%', 'Verified stamps'],
    ['Tourism spreads beyond the city', 'Bookings outside Sharjah City', '≥ 60%', 'Booking regions'],
    ['Presales stay safe', 'Presale units redeemed or refunded before expiry', '100% · zero unfunded obligations', 'Voucher ledger'],
    ['Rewards never burden hosts', 'Host-funded rewards issued beyond their cap', '0', 'Reward budget log'],
  ];
  return (
    <section className="bg-white py-16 md:py-24">
      <div className="shell">
        <SectionHeader eyebrow="What we must prove" title="Hypotheses, not promises." description="The pilot is designed to test each assumption with data the product already captures." />
        <div className="mt-10 overflow-x-auto rounded-[26px] border border-line">
          <table className="w-full min-w-[820px] text-left text-[14px]">
            <thead className="bg-sand-50 text-[11.5px] font-bold uppercase tracking-[0.1em] text-ink-3">
              <tr>
                <th className="px-5 py-3.5">Hypothesis</th>
                <th className="px-5 py-3.5">Metric</th>
                <th className="px-5 py-3.5">Pilot target</th>
                <th className="px-5 py-3.5">Measured from</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, i) => (
                <tr key={r[0]}>
                  <td className="px-5 py-4 font-semibold">
                    <span className="mr-2 font-mono text-[12px] text-ink-3">H{i + 1}</span>
                    {r[0]}
                  </td>
                  <td className="px-5 py-4 text-ink-2">{r[1]}</td>
                  <td className="px-5 py-4">
                    <Badge tone="clay">{r[2]}</Badge>
                  </td>
                  <td className="px-5 py-4 text-ink-3">{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- Impact & roadmap ------------------------------- */

function ImpactAndRoadmap() {
  return (
    <section className="py-16 md:py-24">
      <div className="shell space-y-16">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeader eyebrow="Sustainable tourism" title="Impact we’ll measure — honestly." />
            <div className="mt-8 grid gap-3">
              {[
                { icon: Store, t: 'More income stays local', d: `Hosts keep ${Math.round((1 - ECONOMICS.experienceCommission - ECONOMICS.paymentProcessing) * 100)}–${Math.round((1 - ECONOMICS.productCommission - ECONOMICS.paymentProcessing) * 100)}% of every sale; repeat purchases go straight to the farm, apiary or studio.` },
                { icon: MapIcon, t: 'Visitors spread out', d: 'Five traditions across nine regions pull spend to Al Dhaid, Mleiha, Kalba and the east coast.' },
                { icon: Leaf, t: 'Shorter food chains', d: 'Produce boxes travel farm-to-door with reusable crates. We report kg sold direct — not unverified carbon claims.' },
                { icon: Landmark, t: 'Living heritage', d: 'Net-making, falaj, bukhoor and pottery skills earn a living, so they’re passed on.' },
              ].map((x) => (
                <div key={x.t} className="flex gap-4 rounded-[22px] border border-line bg-white p-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-oasis-50 text-oasis-600">
                    <x.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-[15.5px] font-semibold">{x.t}</div>
                    <div className="mt-1 text-[14px] text-ink-2">{x.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionHeader eyebrow="Risks & safeguards" title="Built-in guard-rails." />
            <div className="mt-8 grid gap-3">
              {[
                ['Boat & marine safety', 'Boat experiences require a verified licensed operator; weather go/no-go and automatic refunds.'],
                ['Presale liability', 'Customer-funded only, capped at 25% of approved capacity, held until redemption, always refundable if no slot.'],
                ['Reward costs', 'Every reward names its funder and a hard cap; platform rewards pay hosts full price.'],
                ['Food & product quality', 'Food partners and producers must hold the relevant permits before going live.'],
                ['Personal data & formulas', 'Signature blends are stored only with consent and shared only with the maker.'],
                ['Heritage, not theme parks', 'Hosts set capacity and what is offered; nothing is staged for the camera.'],
              ].map(([t, d]) => (
                <div key={t} className="flex gap-3 rounded-[22px] bg-sand-100 p-4">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-oasis-600" />
                  <div>
                    <div className="text-[14.5px] font-semibold">{t}</div>
                    <div className="text-[13.5px] text-ink-2">{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <SectionHeader eyebrow="Roadmap" title="Same architecture, every corner of Sharjah." description="Provider → experiences → products → relationships. New sectors plug into the same booking engine, Passport and host tools." />
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {[
              { icon: TreePalm, p: 'Phase 1 · now', t: 'Five living traditions', d: '15 pilot hosts across farms, apiaries, studios, harbours and ateliers.' },
              { icon: Landmark, p: 'Phase 2', t: 'Heritage sites & cultural centres', d: 'Timed entries and guided programmes using the same slots and Passport.' },
              { icon: Compass, p: 'Phase 3', t: 'Nature & eco-tourism', d: 'Mangroves, wadis and conservation centres with capacity caps that protect habitats.' },
              { icon: Users, p: 'Phase 4', t: 'Groups, schools & GCC visitors', d: 'Group days, education programmes and multilingual discovery.' },
            ].map((x, i) => (
              <Reveal key={x.t} delay={i * 0.08}>
                <div className={cn('h-full rounded-[24px] p-5', i === 0 ? 'bg-ink text-paper' : 'border border-line bg-white')}>
                  <x.icon className={cn('h-6 w-6', i === 0 ? 'text-honey-300' : 'text-clay-500')} />
                  <div className={cn('mt-4 text-[12px] font-bold uppercase tracking-[0.14em]', i === 0 ? 'text-paper/50' : 'text-ink-3')}>{x.p}</div>
                  <div className="mt-1 text-[17px] font-semibold">{x.t}</div>
                  <div className={cn('mt-1.5 text-[13.5px]', i === 0 ? 'text-paper/65' : 'text-ink-2')}>{x.d}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 rounded-[30px] bg-clay-500 px-6 py-12 text-center text-white">
          <Flag className="h-7 w-7" />
          <div className="max-w-2xl font-display text-[32px] leading-tight md:text-[40px]">Don’t just visit. Live it — and keep the people behind it thriving.</div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="light" to="/experiences">
              Explore experiences
            </Button>
            <Button variant="glass" to="/hosts">
              Become a host
            </Button>
          </div>
          <div className="text-[12px] text-white/70">
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5" /> All figures on this page are simulated or illustrative for the hackathon demo.
          </div>
        </div>
      </div>
    </section>
  );
}

/** 12-week totals per revenue stream, plus how the mix shifted — fills the chart card with the takeaway. */
function StreamTotals({ weeks }: { weeks: { platform: { exp: number; prod: number; saas: number; pre: number } }[] }) {
  const keys = [
    { k: 'exp', label: 'A · Experiences' },
    { k: 'prod', label: 'B · Recurring commerce' },
    { k: 'saas', label: 'C · Pro plans' },
    { k: 'pre', label: 'D · Prepaid' },
  ] as const;
  const total = (ws: typeof weeks, k: (typeof keys)[number]['k']) => ws.reduce((s, w) => s + w.platform[k], 0);
  const all = keys.map((x) => total(weeks, x.k));
  const sum = all.reduce((a, b) => a + b, 0) || 1;
  const share = (ws: typeof weeks) => {
    const t = keys.reduce((s, x) => s + total(ws, x.k), 0) || 1;
    return total(ws, 'prod') / t;
  };
  const first = share(weeks.slice(0, 4));
  const last = share(weeks.slice(-4));
  return (
    <div className="mt-5 border-t border-line pt-5">
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
        {keys.map((x, i) => (
          <div key={x.k}>
            <div className="flex items-center gap-1.5 text-[12px] text-ink-3">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: SERIES[i] }} />
              {x.label}
            </div>
            <div className="mt-1 text-[18px] font-semibold tabular tracking-tight">{aed(all[i])}</div>
            <div className="text-[12px] text-ink-3">{all[i] / sum < 0.01 ? '<1' : Math.round((all[i] / sum) * 100)}% of revenue</div>
          </div>
        ))}
      </div>
      <p className="mt-4 rounded-2xl bg-sand-50 px-4 py-3 text-[13px] leading-relaxed text-ink-2">
        Recurring commerce grew from <span className="font-semibold text-ink">{Math.round(first * 100)}%</span> to{' '}
        <span className="font-semibold text-ink">{Math.round(last * 100)}%</span> of LocalDays revenue between the first and last four weeks — the post-visit relationship, not
        the ticket, is what compounds.
      </p>
    </div>
  );
}

/** Takes the remaining height of a flex column (never less than `min`) and hands it to a chart. */
function FillHeight({ min, children }: { min: number; children: (h: number) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(min);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setH(Math.max(min, Math.floor(e.contentRect.height))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);
  return (
    <div ref={ref} className="relative flex-1" style={{ minHeight: min }}>
      <div className="absolute inset-0">{children(h)}</div>
    </div>
  );
}
