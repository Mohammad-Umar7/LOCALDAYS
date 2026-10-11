import { AlertCircle, Pause, Play, ShieldCheck, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { ECONOMICS } from '@/config/economics';
import { EXPERIENCE_BY_ID, presalesForProvider } from '@/data/catalog';
import { useApp } from '@/store/app';
import { aed } from '@/lib/format';
import { useHost } from './useHost';
import { Kpi, Panel } from './ui';

export default function HostPresales() {
  const { provider } = useHost();
  const offers = presalesForProvider(provider.id);
  const extra = useApp((s) => s.presaleSold);
  const vouchers = useApp((s) => s.vouchers.filter((v) => v.providerId === provider.id));
  const paused = useApp((s) => s.host.presalePaused);
  const toggle = useApp((s) => s.togglePresalePaused);

  if (!offers.length)
    return (
      <EmptyState
        icon={<Ticket className="h-6 w-6" />}
        title="No prepaid offers yet"
        body="Prepaid experiences let you sell a capped number of future slots at a small discount — customer-funded, never a loan. Switch to Ghaf Grove, Wadi Hives, Fakhar House, Hamriyah Harbour or Oud Lane to see one live."
      />
    );

  return (
    <div className="space-y-5">
      {offers.map((o) => {
        const sold = o.soldUnits + (extra[o.id] ?? 0);
        const redeemed = o.redeemedUnits + vouchers.filter((v) => v.offerId === o.id && v.status === 'redeemed').length;
        const outstanding = sold - redeemed;
        const cash = sold * o.presalePrice;
        const commission = cash * ECONOMICS.presaleCommission;
        const releasedToHost = redeemed * o.presalePrice * (1 - ECONOMICS.presaleCommission);
        const held = outstanding * o.presalePrice;
        const isPaused = paused.includes(o.id);
        return (
          <div key={o.id} className="space-y-5">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Kpi label="Sold" value={`${sold}/${o.totalUnits}`} sub={`${aed(o.presalePrice)} each (regular ${aed(o.regularPrice)})`} />
              <Kpi label="Redeemed" value={redeemed} sub="released to you on redemption" />
              <Kpi label="Outstanding obligations" value={outstanding} sub={`${aed(outstanding * o.regularPrice)} of service owed`} />
              <Kpi label="Customer funds held" value={aed(held)} sub="not income until redeemed" />
            </div>
            <Panel
              title={o.title}
              sub={`${EXPERIENCE_BY_ID[o.experienceId].title} · ${o.approvedCapacityNote}`}
              action={
                <Button size="sm" variant={isPaused ? 'dark' : 'outline'} icon={isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />} onClick={() => toggle(o.id)}>
                  {isPaused ? 'Resume sales' : 'Pause sales'}
                </Button>
              }
            >
              <div className="h-3 overflow-hidden rounded-full bg-sand-100">
                <div className="flex h-full">
                  <div className="h-full bg-oasis-500" style={{ width: `${(redeemed / o.totalUnits) * 100}%` }} />
                  <div className="h-full bg-honey-400" style={{ width: `${(outstanding / o.totalUnits) * 100}%` }} />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-[12.5px] text-ink-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-oasis-500" /> Redeemed {redeemed}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-honey-400" /> Outstanding {outstanding}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-sand-200" /> Unsold {o.totalUnits - sold}
                </span>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-sand-50 p-4">
                  <div className="text-[13px] font-semibold">Settlement (illustrative)</div>
                  <dl className="mt-2 space-y-1.5 text-[13px]">
                    {[
                      ['Customer payments received', aed(cash)],
                      [`Fadhal commission (${ECONOMICS.presaleCommission * 100}%)`, `−${aed(commission)}`],
                      ['Released to you (redeemed)', aed(releasedToHost)],
                      ['Held until redemption', aed(held)],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3">
                        <dt className="text-ink-2">{k}</dt>
                        <dd className="tabular font-semibold">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="rounded-2xl border border-line p-4 text-[13px]">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="h-4 w-4 text-oasis-500" /> Guard-rails
                  </div>
                  <ul className="mt-2 space-y-1.5 text-ink-2">
                    <li>· Capped at {Math.round(ECONOMICS.presale.maxShareOfCapacity * 100)}% of approved capacity</li>
                    <li>· Customer-funded only — no lending, no transferable wallet</li>
                    <li>· Refundable within {ECONOMICS.presale.refundWindowDays} days; always refundable if you can’t offer a slot</li>
                    <li>· Expires after {Math.round(o.expiresInDays / 30)} months — terms shown before purchase</li>
                  </ul>
                </div>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-[12.5px] text-amber-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                Advance payments are obligations, not profit. They become revenue only when the experience is delivered.
              </div>
              {vouchers.length > 0 && (
                <div className="mt-4">
                  <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-ink-3">Sold in this demo</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {vouchers.map((v) => (
                      <Badge key={v.id} tone={v.status === 'redeemed' ? 'success' : 'honey'}>
                        {v.status} · {aed(v.pricePaid)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          </div>
        );
      })}
    </div>
  );
}
