import { Check, Crown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/primitives';
import { ECONOMICS, PRO_PLAN_FEATURES } from '@/config/economics';
import { BRAND } from '@/config/brand';
import { useUI } from '@/store/ui';
import { aed } from '@/lib/format';
import { Panel } from './ui';

export default function HostPlan() {
  const toast = useUI((s) => s.toast);
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
      <div className="relative overflow-hidden rounded-[26px] bg-ink p-7 text-paper">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-honey-400/20 blur-3xl" />
        <div className="relative">
          <Badge tone="honey" icon={<Crown className="h-3 w-3" />}>
            Active · demo
          </Badge>
          <div className="mt-4 font-display text-[34px] leading-tight">{BRAND.proPlanName}</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-[44px] leading-none">{aed(ECONOMICS.proPlanMonthly)}</span>
            <span className="text-paper/55">/ month · optional</span>
          </div>
          <p className="mt-3 text-[14px] text-paper/65">Commission-only hosting stays free. Pro adds the operating tools that turn visitors into regular customers.</p>
          <ul className="mt-6 space-y-2.5">
            {PRO_PLAN_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-[14px]">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-honey-300" /> {f}
              </li>
            ))}
          </ul>
          <Button className="mt-7" variant="light" onClick={() => toast({ title: 'Billing is simulated in this demo' })}>
            Manage subscription
          </Button>
        </div>
      </div>
      <Panel title="Commission & pricing" sub="All rates are illustrative and adjustable in one config file">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { k: 'Experience bookings', v: `${ECONOMICS.experienceCommission * 100}%`, d: 'e.g. AED 200 booking → AED 24 to LocalDays' },
            { k: 'Products & subscriptions', v: `${ECONOMICS.productCommission * 100}%`, d: 'on eligible orders, fulfilled by you' },
            { k: 'Prepaid experiences', v: `${ECONOMICS.presaleCommission * 100}%`, d: 'charged on redemption-based settlement' },
            { k: 'Payment processing', v: `${ECONOMICS.paymentProcessing * 100}%`, d: 'passed through at cost' },
          ].map((x) => (
            <div key={x.k} className="rounded-2xl bg-sand-50 p-4">
              <div className="text-[12.5px] font-semibold text-ink-3">{x.k}</div>
              <div className="mt-1 text-[26px] font-semibold">{x.v}</div>
              <div className="text-[12.5px] text-ink-2">{x.d}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-dashed border-line p-4 text-[13px] text-ink-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-clay-500" /> Pro includes {BRAND.intelligenceName}: harvest & demand planning, post-visit follow-ups and stock runway — always explainable, never black-box.
        </div>
      </Panel>
    </div>
  );
}
