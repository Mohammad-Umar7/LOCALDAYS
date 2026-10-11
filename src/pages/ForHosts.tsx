import { motion } from 'framer-motion';
import { ArrowRight, BrainCircuit, Check, CheckCircle2, Coins, Repeat, Send, Store, Ticket, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { SmartImage } from '@/components/ui/SmartImage';
import { Reveal, SectionHeader } from '@/components/ui/primitives';
import { CategoryIcon } from '@/components/brand/CategoryIcon';
import { ECONOMICS, PRO_PLAN_FEATURES } from '@/config/economics';
import { BRAND } from '@/config/brand';
import { CATEGORIES } from '@/data/categories';
import { REGIONS } from '@/data/regions';
import type { CategoryId } from '@/data/types';
import { aed } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function ForHosts() {
  return (
    <AppShell>
      <section className="relative overflow-hidden bg-oasis-950 text-paper">
        <SmartImage img={{ key: 'pottery_wheel', i: 2, alt: 'Hands shaping clay' }} width={1900} className="absolute inset-0 opacity-35" category="pottery" />
        <div className="absolute inset-0 bg-gradient-to-r from-oasis-950 via-oasis-950/85 to-oasis-950/30" />
        <div className="shell relative py-16 md:py-24">
          <div className="max-w-2xl">
            <div className="eyebrow text-honey-300/80">For farmers, makers & guides</div>
            <h1 className="display-lg mt-4 text-balance">
              Your craft brings people in. <span className="serif-italic text-honey-300">We help them come back.</span>
            </h1>
            <p className="mt-5 text-[16.5px] text-paper/70">
              {BRAND.name} gives small businesses a new way to find customers through experiences — and the tools to keep selling to them long after the visit.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href="#apply" size="lg" iconRight={<ArrowRight className="h-4 w-4" />}>
                Apply to host
              </Button>
              <Button to="/host" size="lg" variant="glass">
                Explore the host dashboard
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="shell py-16 md:py-24">
        <SectionHeader eyebrow="What you get" title="Bookings are the start. Relationships are the business." />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: Users, t: 'New customers', d: 'Residents and visitors discovering local traditions, with live availability and secure payments.' },
            { icon: Store, t: 'A storefront that remembers', d: 'Guests see what they tried at your venue and can reorder from anywhere in the UAE.' },
            { icon: Repeat, t: 'Recurring orders', d: 'Weekly boxes, honey clubs, refills and season passes — capped to what you can reliably supply.' },
            { icon: Ticket, t: 'Prepaid experiences', d: 'Sell a limited number of future slots at a small discount. Customer-funded, never a loan.' },
            { icon: BrainCircuit, t: 'Intelligence you can audit', d: 'Harvest & demand planning, stock runway and post-visit follow-ups — every number explained.' },
            { icon: Coins, t: 'Weekly payouts', d: 'Clear statements: gross, commission, processing and estimated net — no surprises.' },
          ].map((x, i) => (
            <Reveal key={x.t} delay={i * 0.05}>
              <div className="h-full rounded-[24px] border border-line bg-white p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-clay-50 text-clay-600">
                  <x.icon className="h-5 w-5" />
                </span>
                <div className="mt-5 text-[17px] font-semibold">{x.t}</div>
                <p className="mt-1.5 text-[14px] text-ink-2">{x.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <Estimator />

      <section id="pricing" className="shell py-16 md:py-24">
        <SectionHeader eyebrow="Pricing" title="Free to list. Pay only when you sell." description="Illustrative rates for the pilot — set in one configuration file." />
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <div className="rounded-[28px] border border-line bg-white p-7">
            <div className="text-[13px] font-bold uppercase tracking-[0.14em] text-ink-3">Commission</div>
            <div className="mt-2 font-display text-[34px]">Hosting</div>
            <div className="mt-4 space-y-2.5 text-[15px]">
              {[
                [`${ECONOMICS.experienceCommission * 100}%`, 'on experience bookings'],
                [`${ECONOMICS.productCommission * 100}%`, 'on products & subscriptions'],
                [`${ECONOMICS.presaleCommission * 100}%`, 'on prepaid experiences'],
                ['AED 0', 'monthly fee'],
              ].map(([v, k]) => (
                <div key={k} className="flex items-baseline gap-3">
                  <span className="w-16 font-display text-[24px]">{v}</span>
                  <span className="text-ink-2">{k}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[28px] bg-ink p-7 text-paper">
            <div className="text-[13px] font-bold uppercase tracking-[0.14em] text-honey-300">Optional</div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="font-display text-[34px]">{BRAND.proPlanName}</span>
              <span className="text-paper/55">{aed(ECONOMICS.proPlanMonthly)} / month</span>
            </div>
            <ul className="mt-4 space-y-2.5">
              {PRO_PLAN_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[14.5px]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-honey-300" /> {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <Apply />
    </AppShell>
  );
}

function EstSlider({ l, v, min, max, step, set, f }: { l: string; v: number; min: number; max: number; step: number; set: (n: number) => void; f: (n: number) => string }) {
  return (
    <label className="block">
      <span className="flex justify-between text-[13px]">
        <span className="font-medium text-paper/70">{l}</span>
        <span className="tabular font-semibold">{f(v)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => set(Number(e.target.value))} className="mt-1.5 w-full accent-honey-400" />
    </label>
  );
}

function Estimator() {
  const [sessions, setSessions] = useState(6);
  const [guests, setGuests] = useState(10);
  const [price, setPrice] = useState(150);
  const [buyers, setBuyers] = useState(0.2);
  const [basket, setBasket] = useState(120);
  const r = useMemo(() => {
    const exp = sessions * guests * price * 4.3;
    const prod = sessions * guests * 4.3 * buyers * basket;
    const fees = exp * ECONOMICS.experienceCommission + prod * ECONOMICS.productCommission + (exp + prod) * ECONOMICS.paymentProcessing;
    return { exp, prod, fees, net: exp + prod - fees };
  }, [sessions, guests, price, buyers, basket]);
  return (
    <section className="bg-ink py-16 text-paper md:py-24">
      <div className="shell grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <div className="eyebrow text-paper/50">Estimate</div>
          <h2 className="display-md mt-4">What could hosting add up to?</h2>
          <p className="mt-3 max-w-md text-[15px] text-paper/60">An illustrative monthly estimate before your own costs. Adjust it to your venue.</p>
          <div className="mt-8 space-y-5">
            <EstSlider l="Sessions per week" v={sessions} min={1} max={20} step={1} set={setSessions} f={(n) => `${n}`} />
            <EstSlider l="Guests per session" v={guests} min={2} max={30} step={1} set={setGuests} f={(n) => `${n}`} />
            <EstSlider l="Price per guest" v={price} min={40} max={500} step={5} set={setPrice} f={(n) => aed(n)} />
            <EstSlider l="Guests who buy afterwards" v={buyers} min={0} max={0.6} step={0.01} set={setBuyers} f={(n) => `${Math.round(n * 100)}%`} />
            <EstSlider l="Average order" v={basket} min={20} max={400} step={10} set={setBasket} f={(n) => aed(n)} />
          </div>
        </div>
        <div className="rounded-[28px] bg-white/[0.06] p-7 ring-1 ring-white/10">
          {[
            ['Experience sales / month', r.exp],
            ['Product sales / month', r.prod],
            ['Fadhal fees & processing', -r.fees],
          ].map(([k, v]) => (
            <div key={k as string} className="flex justify-between border-b border-white/10 py-3 text-[15px]">
              <span className="text-paper/70">{k}</span>
              <span className="tabular font-semibold">{aed(v as number)}</span>
            </div>
          ))}
          <div className="flex items-baseline justify-between pt-5">
            <span className="text-[15px] font-semibold">Before your costs</span>
            <motion.span key={Math.round(r.net)} initial={{ opacity: 0.5, y: 4 }} animate={{ opacity: 1, y: 0 }} className="tabular font-display text-[40px]">
              {aed(r.net)}
            </motion.span>
          </div>
          <div className="mt-2 text-[12px] text-paper/45">Illustrative only — not a guarantee of bookings or income.</div>
        </div>
      </div>
    </section>
  );
}

/** What we'd check before a host goes live — shown after applying (illustrative, not legal advice). */
const DOCS: Record<CategoryId, string[]> = {
  farm: ['Trade licence', 'Food-handling permit for dining & produce', 'Stay licence for overnight guests'],
  honey: ['Trade licence', 'Food-safety approval for honey sales', 'Bee-safety plan for visitors'],
  pottery: ['Trade licence', 'Kiln & studio safety check'],
  coastal: ['Marine activity licence', 'Vessel registration & inspection', 'Captain certification', 'Licensed food partner for seafood'],
  fragrance: ['Trade licence', 'Product compliance for perfumes & bukhoor', 'Burner & smoke safety'],
};

function Apply() {
  const [cat, setCat] = useState<CategoryId>('farm');
  const [sent, setSent] = useState(false);
  const [name, setName] = useState('');
  const [biz, setBiz] = useState('');
  if (sent) {
    const steps = [
      { t: 'Application received', d: 'Just now', done: true },
      { t: 'Documents check', d: DOCS[cat].join(' · ') },
      { t: 'Verification visit', d: 'Safety, capacity and what guests can genuinely expect' },
      { t: 'Listing & 3D preview', d: 'Your sessions, prices, shop and an illustrative venue preview' },
      { t: 'First guests', d: 'Commission only when you sell — weekly payouts' },
    ];
    return (
      <section id="apply" className="shell py-16 md:py-24">
        <div className="mx-auto max-w-2xl rounded-[28px] border border-line bg-white p-6 md:p-10">
          <div className="flex items-start gap-4">
            <CheckCircle2 className="h-11 w-11 shrink-0 text-oasis-500" />
            <div>
              <div className="font-display text-[28px] leading-tight md:text-[32px]">Application received (simulated)</div>
              <p className="mt-2 text-[14.5px] text-ink-2">
                Thanks{name ? `, ${name.split(' ')[0]}` : ''}. Here’s how {biz || 'your business'} would go live — in the real product our host team arranges the visit within a week.
              </p>
            </div>
          </div>
          <ol className="relative mt-8 space-y-5 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-line">
            {steps.map((st, i) => (
              <li key={st.t} className="relative flex gap-4">
                <span className={cn('relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold', st.done ? 'bg-oasis-500 text-white' : 'bg-sand-100 text-ink-2 ring-4 ring-white')}>
                  {st.done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </span>
                <div className="pt-1">
                  <div className="text-[15px] font-semibold">{st.t}</div>
                  <div className="text-[13px] text-ink-3">{st.d}</div>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap gap-2">
            <Button to="/host" variant="dark">
              Preview a host dashboard
            </Button>
            <Button variant="outline" onClick={() => setSent(false)}>
              Edit application
            </Button>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section id="apply" className="shell py-16 md:py-24">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
        <SectionHeader eyebrow="Apply" title="Tell us about your tradition." description="No obligations. We’ll check what licences apply and visit before anything goes live." />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
          className="space-y-4 rounded-[28px] border border-line bg-white p-6 md:p-8"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <input required className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            <input required className="input" placeholder="Business name" value={biz} onChange={(e) => setBiz(e.target.value)} />
          </div>
          <div>
            <div className="label">Tradition</div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button type="button" key={c.id} onClick={() => setCat(c.id)} className={cn('chip', cat === c.id && 'chip-active')}>
                  <CategoryIcon id={c.id} className="h-4 w-4" /> {c.shortName}
                </button>
              ))}
            </div>
          </div>
          <select className="input" defaultValue="" required>
            <option value="" disabled>
              Region
            </option>
            {REGIONS.map((r) => (
              <option key={r.id}>{r.name}</option>
            ))}
          </select>
          <textarea className="input min-h-[110px]" placeholder="What would guests do with you? What do you sell?" />
          <label className="flex items-start gap-2.5 text-[13px] text-ink-2">
            <input type="checkbox" required className="mt-0.5 h-4 w-4 accent-clay-500" /> I understand Fadhal will verify licences and permits relevant to my activity before listing.
          </label>
          <Button type="submit" size="lg" icon={<Send className="h-4 w-4" />}>
            Send application
          </Button>
          <p className="text-[12px] text-ink-3">Demo form — nothing is sent anywhere.</p>
        </form>
      </div>
    </section>
  );
}
