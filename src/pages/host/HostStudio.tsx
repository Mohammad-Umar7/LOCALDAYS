import { motion } from 'framer-motion';
import { Anchor, ArrowRight, BadgeCheck, CheckCircle2, CircleAlert, Flame, FlaskConical, Hexagon, ShieldCheck, Users, Waves, Wind } from 'lucide-react';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/Button';
import { CROPS, SUPPLIERS, APPROVED_SWAPS } from '@/data/farmOps';
import { FORMULAS, NOTE_BY_ID } from '@/data/catalog/fragrance';
import { PRODUCT_BY_ID } from '@/data/catalog';
import { REGION_BY_ID } from '@/data/regions';
import { useApp, type PipelineStage } from '@/store/app';
import { useUI } from '@/store/ui';
import { KILN_STAGES } from '../Account';
import { addDaysISO } from '@/lib/dates';
import { aed, fmtDate } from '@/lib/format';
import { seeded } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useHost } from './useHost';
import { Panel } from './ui';

export default function HostStudio() {
  const { provider } = useHost();
  switch (provider.categoryId) {
    case 'farm':
      return <FarmLog />;
    case 'honey':
      return <HoneyBatches />;
    case 'pottery':
      return <PotteryPipeline />;
    case 'coastal':
      return <CoastalOps />;
    case 'fragrance':
      return <Formulas />;
  }
}

/* --------------------------------- Farm --------------------------------- */

function FarmLog() {
  const r = seeded('farmlog');
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Harvest log" sub="Weekly harvests entered by the farmer — the basis of every forecast">
        <div className="space-y-3">
          {CROPS.map((c) => {
            const hist = Array.from({ length: 6 }, () => c.range[0] + r() * (c.range[1] - c.range[0]));
            const max = c.range[1] * 1.1;
            return (
              <div key={c.id} className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                <span className="w-28 text-[13px] font-semibold">{c.name}</span>
                <div className="flex h-8 flex-1 items-end gap-1">
                  {hist.map((h, i) => (
                    <div key={i} className="flex-1 rounded-t-[4px]" style={{ height: `${(h / max) * 100}%`, background: c.color, opacity: 0.35 + i * 0.1 }} />
                  ))}
                  <div className="flex-1 rounded-t-[4px] border-2 border-dashed" style={{ height: `${(c.forecastKg / max) * 100}%`, borderColor: c.color }} title="This week’s forecast" />
                </div>
                <span className="tabular w-16 text-right text-[12.5px] font-semibold">{c.forecastKg} kg</span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 text-[12px] text-ink-3">Solid bars: last six weeks · dashed: this week’s forecast</div>
      </Panel>
      <div className="space-y-5">
        <Panel title="Farmer-approved substitutions" sub="The only swaps Intelligence may suggest">
          <div className="space-y-2">
            {APPROVED_SWAPS.map((s) => (
              <div key={s.id} className="rounded-2xl bg-sand-50 p-3.5">
                <div className="text-[13.5px] font-semibold">{s.title}</div>
                <div className="text-[12.5px] text-ink-2">{s.detail}</div>
                <div className="mt-1 text-[11.5px] text-ink-3">Approved by {s.approvedBy}</div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Verified partner suppliers">
          <div className="space-y-2">
            {SUPPLIERS.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-line p-3.5">
                <BadgeCheck className="h-5 w-5 shrink-0 text-oasis-500" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold">{s.name}</div>
                  <div className="text-[12px] text-ink-3">
                    {REGION_BY_ID[s.regionId].name} · {s.distanceKm} km · {s.offers.map((o) => `${o.availableKg} kg ${o.cropId} @ AED ${o.pricePerKg}`).join(', ')}
                  </div>
                </div>
                <Badge tone="success">Verified (demo)</Badge>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* --------------------------------- Honey --------------------------------- */

function HoneyBatches() {
  const { ctx } = useHost();
  const toast = useUI((s) => s.toast);
  const batches = [
    { id: 'WH-SDR-11', flora: 'Sidr', site: 'Upper wadi', harvested: addDaysISO(ctx.todayISO, -9), kg: 64, jars500: 96, jars250: 40, sold: 71, reorders: 23, product: 'wh-sidr', status: 'On sale' },
    { id: 'WH-SDR-12', flora: 'Sidr', site: 'Lower wadi', harvested: addDaysISO(ctx.todayISO, -2), kg: 41, jars500: 0, jars250: 0, sold: 0, reorders: 0, product: 'wh-sidr', status: 'Settling' },
    { id: 'WH-SMR-07', flora: 'Samar', site: 'Foothills', harvested: addDaysISO(ctx.todayISO, -128), kg: 88, jars500: 150, jars250: 52, sold: 168, reorders: 41, product: 'wh-samar', status: 'On sale' },
    { id: 'WH-GHF-02', flora: 'Ghaf blossom', site: 'Plains', harvested: addDaysISO(ctx.todayISO, -190), kg: 9, jars500: 0, jars250: 36, sold: 24, reorders: 6, product: 'wh-ghaf', status: 'Low stock' },
  ];
  return (
    <div className="space-y-5">
      <Panel title="Harvest batches" sub="Every jar carries its batch — customers reorder the exact honey they tasted">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">
              <tr className="border-b border-line">
                <th className="py-2.5 pr-3">Batch</th>
                <th className="py-2.5 pr-3">Flora · site</th>
                <th className="py-2.5 pr-3">Harvested</th>
                <th className="py-2.5 pr-3 text-right">Kg</th>
                <th className="py-2.5 pr-3 text-right">Jars (500/250 g)</th>
                <th className="py-2.5 pr-3 text-right">Sold</th>
                <th className="py-2.5 pr-3 text-right">Reorders</th>
                <th className="py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {batches.map((b) => (
                <tr key={b.id}>
                  <td className="py-3 pr-3 font-mono font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      <Hexagon className="h-3.5 w-3.5 text-honey-600" /> {b.id}
                    </span>
                  </td>
                  <td className="py-3 pr-3">
                    {b.flora} <span className="text-ink-3">· {b.site}</span>
                  </td>
                  <td className="py-3 pr-3">{fmtDate(b.harvested, 'd MMM yyyy')}</td>
                  <td className="tabular py-3 pr-3 text-right">{b.kg}</td>
                  <td className="tabular py-3 pr-3 text-right">
                    {b.jars500}/{b.jars250}
                  </td>
                  <td className="tabular py-3 pr-3 text-right">{b.sold}</td>
                  <td className="tabular py-3 pr-3 text-right">{b.reorders}</td>
                  <td className="py-3">
                    {b.status === 'Settling' ? (
                      <Button size="sm" variant="dark" onClick={() => toast({ title: `${b.id} released`, body: 'Jars filled and listed in the shop (simulated).', tone: 'success' })}>
                        Jar & release
                      </Button>
                    ) : (
                      <Badge tone={b.status === 'Low stock' ? 'warning' : 'success'}>{b.status}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="grid gap-5 md:grid-cols-3">
        {[
          { t: 'Honey club fulfilment', d: '21 members · next shipment uses WH-SDR-11 (64 kg on hand, 10.5 kg needed).' },
          { t: 'Reorder rate', d: '31% of tasting guests reordered their batch within 30 days.' },
          { t: 'Never oversell', d: 'Club and reorders draw only from jarred batches — no “unlimited stock”.' },
        ].map((x) => (
          <div key={x.t} className="rounded-[22px] border border-honey-200 bg-honey-100/40 p-5">
            <div className="text-[14.5px] font-semibold">{x.t}</div>
            <div className="mt-1 text-[13px] text-ink-2">{x.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- Pottery --------------------------------- */

function PotteryPipeline() {
  const orders = useApp((s) => s.orders.filter((o) => o.providerIds.includes('fakhar-house')));
  const pipeline = useApp((s) => s.host.pipeline);
  const setStage = useApp((s) => s.setPipelineStage);
  const toast = useUI((s) => s.toast);
  const items = useMemo(() => {
    const demo = orders
      .filter((o) => o.lines.some((l) => ['commission', 'made_to_order'].includes(PRODUCT_BY_ID[l.productId]?.kind ?? '')))
      .map((o) => ({ id: o.ref, who: o.customer.name, what: PRODUCT_BY_ID[o.lines[0].productId].name, stage: (pipeline[o.ref] ?? (o.source === 'seed' ? 4 : 0)) as PipelineStage, demo: true }));
    const synth = [
      { id: 'FH-C-218', who: 'Noor A.', what: 'Dinner Set for Four · celadon', stage: 2 as PipelineStage },
      { id: 'FH-C-221', who: 'James T.', what: 'Personalised mug · “Dubai 2026”', stage: 1 as PipelineStage },
      { id: 'FH-C-207', who: 'Hessa K.', what: 'Water jar, traditional form', stage: 5 as PipelineStage },
      { id: 'FH-C-224', who: 'Rana S.', what: 'Matching mug · sand glaze', stage: 3 as PipelineStage },
      { id: 'FH-C-226', who: 'Aisha M.', what: 'Mabkhara pair · Gulf blue', stage: 0 as PipelineStage },
      { id: 'FH-C-201', who: 'Daniel F.', what: 'Serving bowls ×2', stage: 6 as PipelineStage },
    ].map((x) => ({ ...x, stage: (pipeline[x.id] ?? x.stage) as PipelineStage, demo: false }));
    return [...demo, ...synth];
  }, [orders, pipeline]);

  return (
    <div className="space-y-5">
      <Panel title="Studio pipeline" sub="Commissions and made-to-order pieces move through two firings before they ship">
        <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
          {KILN_STAGES.map((stage, si) => (
            <div key={stage} className="w-[220px] shrink-0 rounded-2xl bg-sand-50 p-3">
              <div className="mb-2 flex items-center justify-between text-[12px] font-bold uppercase tracking-[0.08em] text-ink-3">
                {stage}
                <span className="rounded-full bg-white px-1.5 text-ink-2">{items.filter((i) => i.stage === si).length}</span>
              </div>
              <div className="space-y-2">
                {items
                  .filter((i) => i.stage === si)
                  .map((i) => (
                    <motion.div layout key={i.id} className={cn('rounded-xl bg-white p-3 shadow-ring', i.demo && 'ring-2 ring-clay-300')}>
                      <div className="flex items-center justify-between font-mono text-[11px] text-ink-3">
                        {i.id}
                        {i.demo && <Badge tone="clay">demo</Badge>}
                      </div>
                      <div className="mt-1 text-[13px] font-semibold leading-snug">{i.what}</div>
                      <div className="text-[12px] text-ink-3">{i.who}</div>
                      {si < KILN_STAGES.length - 1 && (
                        <button
                          onClick={() => {
                            setStage(i.id, (si + 1) as PipelineStage);
                            if (si + 1 === KILN_STAGES.length - 1) toast({ title: `${i.id} ready to ship`, body: `${i.who} is notified (simulated).`, tone: 'success' });
                          }}
                          className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-clay-600"
                        >
                          Move to {KILN_STAGES[si + 1]} <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </motion.div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Kiln schedule">
          {[
            { d: 'Tuesday', t: 'Bisque firing · ≈1,000°C', load: 0.82 },
            { d: 'Thursday', t: 'Glaze firing · ≈1,240°C', load: 0.64 },
            { d: 'Saturday', t: 'Workshop pieces · bisque', load: 0.91 },
          ].map((k) => (
            <div key={k.d} className="mb-3 last:mb-0">
              <div className="mb-1 flex justify-between text-[13px]">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <Flame className="h-4 w-4 text-clay-500" /> {k.d}
                </span>
                <span className="text-ink-3">{k.t}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-clay-50">
                <div className="h-full rounded-full bg-clay-500" style={{ width: `${k.load * 100}%` }} />
              </div>
              <div className="mt-0.5 text-[11.5px] text-ink-3">{Math.round(k.load * 100)}% full — firings run only when loads are efficient</div>
            </div>
          ))}
        </Panel>
        <Panel title="Ready-made vs commissioned">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { k: 'Ready to sell', v: 35 },
              { k: 'Commissions open', v: items.filter((i) => i.stage < 6).length },
              { k: 'Awaiting glaze', v: items.filter((i) => i.stage === 3).length },
            ].map((x) => (
              <div key={x.k} className="rounded-2xl bg-sand-50 p-4">
                <div className="text-[24px] font-semibold">{x.v}</div>
                <div className="text-[12px] text-ink-3">{x.k}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[12.5px] text-ink-2">Commissions take a 30% deposit, refundable until throwing starts. Workshop guests who commission a matching piece: 18% (demo).</div>
        </Panel>
      </div>
    </div>
  );
}

/* --------------------------------- Coastal --------------------------------- */

function CoastalOps() {
  const toast = useUI((s) => s.toast);
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        <Panel title="Sea state · tomorrow 05:45" sub="Simulated marine forecast — real deployments read the official marine service">
          <div className="flex items-center gap-4 rounded-2xl bg-emerald-50 p-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            <div>
              <div className="text-[18px] font-semibold text-emerald-900">GO — boat trips can run</div>
              <div className="text-[12.5px] text-emerald-800">All thresholds within the operator’s safety policy</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[
              { icon: Wind, k: 'Wind', v: '11 kn', lim: 'limit 18 kn' },
              { icon: Waves, k: 'Waves', v: '0.5 m', lim: 'limit 1.2 m' },
              { icon: Anchor, k: 'Visibility', v: '9 km', lim: 'min 3 km' },
            ].map((x) => (
              <div key={x.k} className="rounded-2xl bg-sand-50 p-3">
                <x.icon className="mx-auto h-5 w-5 text-sea-500" />
                <div className="mt-1 text-[16px] font-semibold">{x.v}</div>
                <div className="text-[11.5px] text-ink-3">
                  {x.k} · {x.lim}
                </div>
              </div>
            ))}
          </div>
          <Button className="mt-4" variant="outline" size="sm" onClick={() => toast({ title: 'Weather cancellation simulated', body: 'Guests would be offered a free reschedule or full refund automatically.' })}>
            Simulate a weather cancellation
          </Button>
        </Panel>
        <Panel title="Licences & safety checklist" sub="Boat trips are listed only while every document is verified and in date">
          <ul className="space-y-2.5">
            {[
              { k: 'Marine activity licence (boat partner)', doc: true, renews: 'Mar 2027' },
              { k: 'Vessel registration & inspection certificate', doc: true, renews: 'Jan 2027' },
              { k: 'Captain certification', doc: true, renews: 'Nov 2027' },
              { k: 'Life jackets for every seat incl. children', doc: false },
              { k: 'Pre-departure safety briefing script', doc: false },
              { k: 'Fishing seasons & size-limit guidance shared with guests', doc: false },
            ].map((x) => (
              <li key={x.k} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5 text-[13.5px]">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="min-w-0">
                    {x.k}
                    {x.doc && <span className="block text-[11.5px] text-ink-3">Renews {x.renews} · reminder 60 days before</span>}
                  </span>
                </span>
                <Badge tone={x.doc ? 'neutral' : 'success'}>{x.doc ? 'Verified · demo' : 'In place'}</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
            Fictional operator — documents are marked verified so the demo can take boat bookings. In production LocalDays checks each document and hides boat trips the day one
            lapses.
          </p>
        </Panel>
      </div>
      <Panel title="Group enquiries" sub="Group days are this category’s strongest repeat-revenue channel">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { who: 'School trip · Year 7', n: 24, when: 'Tue next week', v: 2770, st: 'Quote sent' },
            { who: 'Corporate team day', n: 14, when: 'Thu in 2 weeks', v: 1670, st: 'Confirmed' },
            { who: 'Family reunion', n: 11, when: 'Saturday', v: 1450, st: 'New' },
          ].map((g) => (
            <div key={g.who} className="rounded-2xl bg-sand-50 p-4">
              <div className="flex items-center justify-between">
                <Users className="h-4 w-4 text-sea-500" />
                <Badge tone={g.st === 'Confirmed' ? 'success' : g.st === 'New' ? 'clay' : 'neutral'}>{g.st}</Badge>
              </div>
              <div className="mt-2 text-[14px] font-semibold">{g.who}</div>
              <div className="text-[12.5px] text-ink-3">
                {g.n} guests · {g.when}
              </div>
              <div className="tabular mt-2 text-[16px] font-semibold">{aed(g.v)}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* --------------------------------- Fragrance --------------------------------- */

function Formulas() {
  const { provider } = useHost();
  const blends = useApp((s) => s.blends.filter((b) => b.providerId === provider.id));
  const formulas = FORMULAS.filter((f) => f.providerId === provider.id);
  return (
    <div className="space-y-5">
      <Panel title="Approved formula library" sub="Guests can only tune within these ranges — nothing is ever invented">
        <div className="grid gap-4 md:grid-cols-2">
          {formulas.map((f) => (
            <div key={f.id} className="rounded-2xl border border-line p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-[12px] text-ink-3">{f.id}</div>
                  <div className="text-[16px] font-semibold">{f.name}</div>
                </div>
                <Badge tone="oud">{f.type === 'bukhoor' ? 'Bukhoor' : 'Perfume oil'}</Badge>
              </div>
              <div className="mt-3 space-y-2">
                {f.accords.map((a) => {
                  const n = NOTE_BY_ID[a.noteId];
                  return (
                    <div key={a.noteId}>
                      <div className="flex justify-between text-[12px]">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: n.color }} /> {n.name}
                        </span>
                        <span className="tabular text-ink-3">
                          {a.min}–{a.max}% · default {a.default}%
                        </span>
                      </div>
                      <div className="relative mt-1 h-1.5 rounded-full bg-sand-100">
                        <div className="absolute h-full rounded-full" style={{ left: `${a.min}%`, width: `${a.max - a.min}%`, background: n.color, opacity: 0.7 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Customer blends on file" sub="Saved only with the customer’s consent">
        {blends.length ? (
          <div className="divide-y divide-line">
            {blends.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-3 py-3">
                <FlaskConical className="h-5 w-5 text-oud-500" />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold">{b.name}</div>
                  <div className="text-[12.5px] text-ink-3">
                    {b.reference} · base {b.formulaId} · approved {fmtDate(b.createdAt)}
                  </div>
                </div>
                <div className="flex h-2 w-40 overflow-hidden rounded-full">
                  {b.accords.map((a) => (
                    <div key={a.noteId} style={{ width: `${a.share}%`, background: NOTE_BY_ID[a.noteId].color }} />
                  ))}
                </div>
                <Badge tone="success">Consent on file</Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[13px] text-ink-3">No blends saved for this atelier yet.</div>
        )}
      </Panel>
    </div>
  );
}
