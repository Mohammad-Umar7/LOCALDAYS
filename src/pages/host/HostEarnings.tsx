import { CalendarCheck, Gift, Info, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { BarList, SERIES } from '@/components/charts/Charts';
import { ECONOMICS } from '@/config/economics';
import { earnings30 } from '@/services/hostData';
import { aed } from '@/lib/format';
import { useHost } from './useHost';
import { REWARDS } from '@/data/passport';
import { PRODUCTS } from '@/data/catalog';
import { liveBudget } from '@/services/passport';
import { useApp } from '@/store/app';
import { Badge } from '@/components/ui/primitives';
import type { Reward } from '@/data/types';
import { Kpi, Panel } from './ui';

export default function HostEarnings() {
  const { provider, weeks, store, presaleSold } = useHost();
  const e = useMemo(() => earnings30(provider.id, weeks, store, presaleSold), [provider.id, weeks, store, presaleSold]);
  const rows: [string, number, string?][] = [
    ['Experiences & stays', e.gross.experiences],
    ['Products', e.gross.products],
    ['Subscriptions', e.gross.subscriptions],
    ['Prepaid experiences redeemed', e.gross.presalesRedeemed],
  ];
  const deductions: [string, number, string][] = [
    ['LocalDays commission', e.commission, `${ECONOMICS.experienceCommission * 100}% experiences · ${ECONOMICS.productCommission * 100}% products · ${ECONOMICS.presaleCommission * 100}% prepaid`],
    ['Payment processing', e.processing, `${ECONOMICS.paymentProcessing * 100}% passed through at cost`],
    ['Variable costs (estimate)', e.variableCosts, 'ingredients, produce, materials, delivery'],
    ['Fixed costs (estimate)', e.fixedCosts, 'staff and running costs entered by the host'],
    [`${'LocalDays Pro'} plan`, e.proPlan, 'optional business tools'],
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label="Gross sales · 30 days" value={aed(e.grossTotal)} sub="experiences, products & subscriptions" />
        <Kpi label="LocalDays commission" value={aed(e.commission)} sub={`${((e.commission / Math.max(1, e.grossTotal)) * 100).toFixed(1)}% effective`} />
        <Kpi label="Estimated net earnings" value={aed(e.net)} sub="after all costs" />
        <Kpi label="Next payout (demo)" value={aed(Math.max(0, (e.grossTotal - e.commission - e.processing) / 4))} sub="every Tuesday" />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Where the money comes from" sub="Last 30 days">
          <BarList items={rows.map(([label, value], i) => ({ label, value, color: SERIES[i] }))} format={(n) => aed(n)} />
          <AfterTheVisit experiences={e.gross.experiences + e.gross.presalesRedeemed} after={e.gross.products + e.gross.subscriptions} />
        </Panel>
        <Panel title="From gross to net" sub="Estimates for planning — not accounting advice">
          <dl className="divide-y divide-line text-[13.5px]">
            <div className="flex justify-between py-2.5 font-semibold">
              <dt>Gross sales</dt>
              <dd className="tabular">{aed(e.grossTotal)}</dd>
            </div>
            {deductions.map(([k, v, note]) => (
              <div key={k} className="flex items-start justify-between gap-4 py-2.5">
                <dt>
                  <div className="text-ink">{k}</div>
                  <div className="text-[12px] text-ink-3">{note}</div>
                </dt>
                <dd className="tabular text-ink-2">−{aed(v)}</dd>
              </div>
            ))}
            <div className="flex justify-between py-3 text-[16px] font-semibold">
              <dt>Estimated net</dt>
              <dd className="tabular">{aed(e.net)}</dd>
            </div>
          </dl>
          <div className="mt-2 flex items-start gap-2 rounded-2xl bg-sand-50 p-3 text-[12.5px] text-ink-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0" /> Prepaid funds of {aed(e.presaleHeld)} are excluded until the experiences are delivered.
          </div>
        </Panel>
      </div>
      <RewardsPanel providerId={provider.id} />
      <Panel title="Payout schedule" sub="Simulated — production uses a licensed UAE payment provider">
        <div className="grid gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-sand-50 p-4">
              <div className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-3">
                <CalendarCheck className="h-4 w-4" /> {i === 0 ? 'Next Tuesday' : `In ${i + 1} weeks`}
              </div>
              <div className="tabular mt-1 text-[20px] font-semibold">{aed(Math.max(0, ((e.grossTotal - e.commission - e.processing) / 4) * (1 + (i % 2 ? 0.06 : -0.03))))}</div>
              <div className="text-[12px] text-ink-3">{i === 0 ? 'scheduled' : 'projected from confirmed bookings'}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/** What one redemption costs whoever funds it (estimate shown to the host before they opt in). */
function costPerRedemption(r: Reward) {
  if (r.value.type === 'fixed') return r.value.amount ?? 0;
  if (r.value.type === 'percent') {
    // Percent rewards apply to the host's subscription box for its first four deliveries
    const box = PRODUCTS.find((p) => p.providerId === r.appliesTo.providerId && p.subscription);
    const base = box?.subscription ? box.subscription.price * 4 : 120;
    return Math.round(((r.value.amount ?? 0) / 100) * base);
  }
  return 0;
}

function RewardsPanel({ providerId }: { providerId: string }) {
  const ledger = useApp((s) => s.usedRewards);
  const rewards = REWARDS.filter((r) => r.fundedBy.providerId === providerId || (r.fundedBy.type === 'platform' && r.appliesTo.providerId === providerId));
  if (!rewards.length) return null;
  return (
    <Panel title="Passport rewards at your venue" sub="Every reward names its funder and has a hard cap — none can cost more than you approved">
      <div className="grid gap-3 lg:grid-cols-2">
        {rewards.map((r) => {
          const b = liveBudget(r, ledger);
          const per = costPerRedemption(r);
          const hostFunded = r.fundedBy.type === 'host';
          const spent = r.budget.unit === 'AED' ? b.used : b.used * per;
          const max = r.budget.unit === 'AED' ? r.budget.cap : r.budget.cap * per;
          return (
            <div key={r.id} className="rounded-2xl border border-line p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <Gift className="mt-0.5 h-4 w-4 shrink-0 text-clay-600" />
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold leading-snug">{r.title}</div>
                    <div className="mt-0.5 text-[12px] text-ink-3">{r.rules[0]}</div>
                  </div>
                </div>
                <Badge tone={hostFunded ? 'warning' : 'success'}>{hostFunded ? 'You fund' : 'LocalDays funds'}</Badge>
              </div>
              <div className="mt-3 flex h-2 gap-[2px]" role="img" aria-label={`${b.used} of ${b.cap} used`}>
                <span className="h-full rounded-l-[4px] bg-clay-500" style={{ width: `${(b.used / b.cap) * 100}%` }} />
                <span className="h-full flex-1 rounded-r-[4px] bg-sand-100" />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
                <div>
                  <div className="text-ink-3">Redeemed</div>
                  <div className="font-semibold tabular">
                    {b.used.toLocaleString()} / {b.cap.toLocaleString()}
                    {r.budget.unit === 'AED' ? ' AED' : ''}
                  </div>
                </div>
                <div>
                  <div className="text-ink-3">{hostFunded ? 'Cost to you' : 'Paid by LocalDays'}</div>
                  <div className="font-semibold tabular">{per || r.budget.unit === 'AED' ? aed(spent) : 'No cash cost'}</div>
                </div>
                <div>
                  <div className="text-ink-3">Max this season</div>
                  <div className="font-semibold tabular">{per || r.budget.unit === 'AED' ? aed(max) : 'Capped'}</div>
                </div>
              </div>
              {!hostFunded && (
                <div className="mt-2.5 flex items-center gap-1.5 text-[12px] text-oasis-700">
                  <ShieldCheck className="h-3.5 w-3.5" /> You receive your full price on every redemption.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/** The thesis, in the host's own numbers: what an experience-only listing would have earned. */
function AfterTheVisit({ experiences, after }: { experiences: number; after: number }) {
  const total = experiences + after;
  const uplift = experiences > 0 ? after / experiences : 0;
  return (
    <div className="mt-6 rounded-2xl bg-ink p-5 text-paper">
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-honey-300">After the visit</div>
      <div className="mt-2 font-display text-[26px] leading-tight">
        {aed(after)} <span className="text-paper/60">came from guests who came back to buy.</span>
      </div>
      <div className="mt-4 space-y-2.5 text-[12.5px]">
        <div>
          <div className="flex justify-between text-paper/70">
            <span>Experience-only listing</span>
            <span className="tabular">{aed(experiences)}</span>
          </div>
          <div className="mt-1 h-2 rounded-[4px] bg-paper/35" style={{ width: `${(experiences / Math.max(1, total)) * 100}%` }} />
        </div>
        <div>
          <div className="flex justify-between">
            <span className="font-semibold">With LocalDays commerce</span>
            <span className="tabular font-semibold">{aed(total)}</span>
          </div>
          <div className="mt-1 h-2 w-full rounded-[4px] bg-honey-400" />
        </div>
      </div>
      <div className="mt-3 text-[12.5px] text-paper/60">
        +{Math.round(uplift * 100)}% on top of bookings this month — the relationship, not the ticket.
      </div>
    </div>
  );
}
