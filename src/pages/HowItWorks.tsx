import { AnimatePresence, motion } from 'framer-motion';
import { BadgeCheck, Box, CalendarCheck2, ChevronDown, Compass, KeyRound, Repeat, ShoppingBag, Sparkles, Store, Ticket, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Reveal, SectionHeader } from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/Tabs';
import { BRAND } from '@/config/brand';
import { ECONOMICS } from '@/config/economics';
import { cn } from '@/lib/utils';
import { aed } from '@/lib/format';
import { hostSplit } from '@/services/pricing';
import { EXPERIENCE_BY_ID, PRODUCT_BY_ID } from '@/data/catalog';

const GUEST_STEPS = [
  { icon: Compass, t: 'Discover', d: 'Browse five traditions or describe your day to the Day Composer. Every listing shows live availability.' },
  { icon: Box, t: 'Step inside', d: 'Explore an illustrative 3D preview of the venue. Pins open real details — rooms, menus, workshops, prices.' },
  { icon: CalendarCheck2, t: 'Book', d: 'Pick a date and time; spots are held for 10 minutes while you check out as a guest or with an account.' },
  { icon: KeyRound, t: 'Live it', d: 'Show your 4-digit code on arrival. The host verifies your visit and your Passport stamp appears.' },
  { icon: ShoppingBag, t: 'Take it home', d: 'The host’s shop remembers what you tried — reorder honey by batch, subscribe to the farm, refill your blend.' },
];
const HOST_STEPS = [
  { icon: Store, t: 'Apply', d: 'Tell us what you grow, make or know. We check licences and food or marine permits where relevant.' },
  { icon: BadgeCheck, t: 'Get verified', d: 'A LocalDays visit confirms safety, capacity and what guests can genuinely expect.' },
  { icon: Sparkles, t: 'List & host', d: 'Set your sessions, capacity, prices and products. Your page and 3D preview go live.' },
  { icon: Repeat, t: 'Keep the relationship', d: 'Post-visit offers, subscriptions, prepaid experiences and reorders turn guests into regulars.' },
  { icon: Ticket, t: 'Get paid weekly', d: `Commission only on what you sell (${ECONOMICS.experienceCommission * 100}% experiences, ${ECONOMICS.productCommission * 100}% products). Pro tools optional.` },
];
const FAQ = [
  ['Are these real hosts?', `Not yet. ${BRAND.demoNotice} Every listing is data-driven so verified operators can replace the demo hosts.`],
  ['Are the 3D venues the actual properties?', 'No — they are illustrative previews built to show how a venue could be explored. Verified scans or models of real properties would be clearly labelled as such.'],
  ['How does the Day Composer work?', `It parses your request into explicit constraints (date, party, budget, interests, timing, things to avoid) and searches live slots for the best route, considering drive times and midday heat. In this demo it runs entirely in your browser and can only recommend real records.`],
  ['What counts for a Passport stamp?', 'Only an experience your host verifies with your check-in code. No points for browsing, clicking or sharing.'],
  ['Who pays for rewards?', 'Each reward names its funder — the host or LocalDays — and has a hard cap, so small businesses are never surprised by a cost.'],
  ['What happens to prepaid experiences?', 'They are customer-funded presales within approved capacity. Funds are held until the experience is delivered, refundable within 14 days, and always refundable if the host can’t offer a slot.'],
  ['Do you take a booking fee?', 'No. Prices include VAT and guests pay what the host charges. LocalDays earns a commission from the host’s side.'],
];

export default function HowItWorks() {
  const [tab, setTab] = useState<'guests' | 'hosts'>('guests');
  const [open, setOpen] = useState<number | null>(0);
  const steps = tab === 'guests' ? GUEST_STEPS : HOST_STEPS;
  return (
    <AppShell>
      <section className="border-b border-line bg-sand-100">
        <div className="shell py-14 md:py-20">
          <div className="eyebrow">How {BRAND.name} works</div>
          <h1 className="display-lg mt-4 max-w-3xl text-balance">
            From the first click to the <span className="serif-italic text-clay-500">hundredth jar</span> of honey.
          </h1>
          <div className="mt-8">
            <Tabs value={tab} onChange={setTab} items={[{ id: 'guests', label: 'For guests' }, { id: 'hosts', label: 'For hosts' }]} />
          </div>
        </div>
      </section>
      <section className="shell py-14 md:py-20">
        <AnimatePresence mode="wait">
          <motion.ol key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="relative grid gap-4 md:grid-cols-5">
            {steps.map((s, i) => (
              <li key={s.t} className="relative rounded-[26px] border border-line bg-white p-6">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-clay-50 text-clay-600">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-[36px] leading-none text-sand-300">{i + 1}</span>
                </div>
                <div className="mt-5 text-[17px] font-semibold">{s.t}</div>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{s.d}</p>
              </li>
            ))}
          </motion.ol>
        </AnimatePresence>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {tab === 'guests' ? (
            <>
              <Button to="/experiences">Explore experiences</Button>
              <Button to="/compose" variant="outline" icon={<Wand2 className="h-4 w-4" />}>
                Try the Day Composer
              </Button>
            </>
          ) : (
            <>
              <Button to="/hosts">Become a host</Button>
              <Button to="/host" variant="outline">
                See the host dashboard
              </Button>
            </>
          )}
        </div>
      </section>
      <MoneySplit />
      <section className="bg-white py-14 md:py-20">
        <div className="shell grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeader eyebrow="Questions" title="Honest answers." description="What is real, what is illustrative, and who pays for what." />
          </div>
          <div className="divide-y divide-line rounded-[26px] border border-line">
            {FAQ.map(([q, a], i) => (
              <Reveal key={q} delay={i * 0.03}>
                <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
                  <span className="text-[15.5px] font-semibold">{q}</span>
                  <ChevronDown className={cn('h-4 w-4 shrink-0 transition', open === i && 'rotate-180')} />
                </button>
                <AnimatePresence initial={false}>
                  {open === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <p className="px-5 pb-5 text-[14.5px] leading-relaxed text-ink-2">{a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}

/* ------------------------- Where the money goes ------------------------- */

const SPLIT_COLORS = { host: '#1A9E6E', localdays: '#C0532B', processing: '#B7AC9C' };

function MoneySplit() {
  const visit = EXPERIENCE_BY_ID['ghaf-family'];
  const box = PRODUCT_BY_ID['ghaf-box'];
  const rows = [
    { label: visit.title, sub: 'One booking · experience commission', split: hostSplit(visit.price, 'experience') },
    { label: `${box.name} subscription`, sub: 'Each weekly box · product commission', split: hostSplit(box.subscription?.price ?? box.price, 'product') },
  ];
  return (
    <section className="border-t border-line bg-sand-50 py-14 md:py-20">
      <div className="shell grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-center">
        <SectionHeader
          eyebrow="Where your dirhams go"
          title={
            <>
              Most of it stays <span className="serif-italic text-clay-500">on the farm.</span>
            </>
          }
          description="Guests pay the host’s price, VAT included — no booking fee. LocalDays earns only when the host sells, and every split is shown to the host before they list."
        />
        <div className="rounded-[26px] border border-line bg-white p-5 md:p-7">
          <div className="mb-5 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-ink-2" aria-hidden>
            {[
              ['Host keeps', SPLIT_COLORS.host],
              ['LocalDays commission', SPLIT_COLORS.localdays],
              ['Card processing', SPLIT_COLORS.processing],
            ].map(([l, c]) => (
              <span key={l} className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c }} />
                {l}
              </span>
            ))}
          </div>
          <div className="space-y-6">
            {rows.map((r, i) => {
              const parts = [
                { k: 'Host keeps', v: r.split.net, c: SPLIT_COLORS.host },
                { k: `LocalDays · ${Math.round(r.split.rate * 100)}%`, v: r.split.commission, c: SPLIT_COLORS.localdays },
                { k: 'Processing', v: r.split.processing, c: SPLIT_COLORS.processing },
              ];
              return (
                <Reveal key={r.label} delay={i * 0.1}>
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold">{r.label}</div>
                      <div className="text-[12.5px] text-ink-3">{r.sub}</div>
                    </div>
                    <div className="shrink-0 font-display text-[22px] tabular">{aed(r.split.gross)}</div>
                  </div>
                  <div className="mt-3 flex h-4 w-full gap-[2px]" role="img" aria-label={parts.map((p) => `${p.k} ${aed(p.v)}`).join(', ')}>
                    {parts.map((p, j) => (
                      <motion.span
                        key={p.k}
                        title={`${p.k}: ${aed(p.v)}`}
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.15 + j * 0.12, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                        className={cn('h-full origin-left', j === 0 && 'rounded-l-[4px]', j === parts.length - 1 && 'rounded-r-[4px]')}
                        style={{ width: `${(p.v / r.split.gross) * 100}%`, background: p.c }}
                      />
                    ))}
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-2 text-[12.5px]">
                    {parts.map((p) => (
                      <div key={p.k}>
                        <div className="text-ink-3">{p.k}</div>
                        <div className="font-semibold tabular text-ink">{aed(p.v)}</div>
                      </div>
                    ))}
                  </div>
                </Reveal>
              );
            })}
          </div>
          <p className="mt-6 border-t border-line pt-4 text-[12px] leading-relaxed text-ink-3">
            Demo rates from one config file: {ECONOMICS.experienceCommission * 100}% on experiences, {ECONOMICS.productCommission * 100}% on products and subscriptions,{' '}
            {ECONOMICS.paymentProcessing * 100}% card processing (simulated). Hosts on LocalDays Pro pay the same commission — Pro adds tools, not fees on guests.
          </p>
        </div>
      </div>
    </section>
  );
}
