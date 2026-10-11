import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, Check, Clock, Gift, Info, ShieldCheck, Ticket, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Calendar, type DayStatus } from '@/components/ui/Calendar';
import { Button } from '@/components/ui/Button';
import { SmartImage } from '@/components/ui/SmartImage';
import { Badge, Counter, DemoTag } from '@/components/ui/primitives';
import { CATEGORY_BY_ID } from '@/data/categories';
import { EXPERIENCE_BY_ID, PROVIDER_BY_ID } from '@/data/catalog';
import { useApp, useAvailabilityCtx, useMyStamps, useMyBookings, useMyUsedRewards, useMyVouchers } from '@/store/app';
import { useUI } from '@/store/ui';
import { dayAvailability, getSlots } from '@/services/availability';
import { priceExperience } from '@/services/pricing';
import { rewardsForExperience, unlockedRewards } from '@/services/passport';
import { addDaysISO, daysBetween } from '@/lib/dates';
import { aed, fmtDate, fmtDateLong, fmtDuration, fmtTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import NotFound from './NotFound';

const STEPS = ['Date & time', 'Guests & extras', 'Review'];

export default function Booking() {
  const { experienceId = '' } = useParams();
  const exp = EXPERIENCE_BY_ID[experienceId];
  if (!exp) return <NotFound />;
  return <BookingFlow key={exp.id} experienceId={exp.id} />;
}

function BookingFlow({ experienceId }: { experienceId: string }) {
  const exp = EXPERIENCE_BY_ID[experienceId];
  const provider = PROVIDER_BY_ID[exp.providerId];
  const cat = CATEGORY_BY_ID[exp.categoryId];
  const [sp] = useSearchParams();
  const ctx = useAvailabilityCtx();
  const nav = useNavigate();
  const addToCart = useApp((s) => s.addExperienceToCart);
  const toast = useUI((s) => s.toast);
  const vouchers = useMyVouchers();
  const stamps = useMyStamps();
  const bookings = useMyBookings();
  const usedRewards = useMyUsedRewards();
  const rewardLedger = useApp((s) => s.usedRewards);

  const isStay = exp.priceUnit === 'per_night';
  const [step, setStep] = useState(0);
  const [adults, setAdults] = useState(Number(sp.get('adults') ?? Math.min(2, exp.maxGuests)));
  const [children, setChildren] = useState(Number(sp.get('children') ?? (exp.familyFriendly && !exp.minAge ? 1 : 0)));
  const guests = adults + children;
  const [date, setDate] = useState<string | null>(sp.get('date'));
  const [end, setEnd] = useState<string | null>(null);
  const [time, setTime] = useState<string | undefined>(sp.get('time') ?? undefined);
  const [addOns, setAddOns] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [agree, setAgree] = useState(false);
  const voucher = vouchers.find((v) => v.experienceId === exp.id && v.status === 'active') ?? null;
  const [useVoucher, setUseVoucher] = useState(!!voucher);
  const rewards = useMemo(
    () => rewardsForExperience(exp.id, unlockedRewards(stamps, bookings), usedRewards, rewardLedger),
    [exp.id, stamps, bookings, usedRewards, rewardLedger],
  );
  const [rewardId, setRewardId] = useState<string | null>(null);

  const nights = isStay && date && end ? Math.max(1, daysBetween(date, end)) : 1;
  const need = isStay ? 1 : guests;

  // Default to the first open date if none chosen (or the chosen one is unavailable)
  useEffect(() => {
    if (date && ['available', 'limited'].includes(dayAvailability(exp, date, need, ctx).status)) return;
    for (let i = 0; i < 60; i++) {
      const d = addDaysISO(ctx.todayISO, i);
      const a = dayAvailability(exp, d, need, ctx);
      if (a.status === 'available' || a.status === 'limited') {
        setDate(d);
        if (isStay) setEnd(addDaysISO(d, 1));
        return;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [need]);

  useEffect(() => {
    if (isStay && date && !end) setEnd(addDaysISO(date, 1));
  }, [isStay, date, end]);

  const slots = date ? getSlots(exp, date, ctx) : [];
  const chosenSlot = slots.find((s) => s.time === time && s.remaining >= need) ?? (isStay ? slots[0] : undefined);
  useEffect(() => {
    if (!isStay && date && !slots.some((s) => s.time === time && s.remaining >= need)) {
      setTime(slots.find((s) => s.remaining >= need)?.time);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, need]);

  const price = priceExperience(exp, {
    guests: { adults, children },
    nights,
    addOnIds: addOns,
    voucher: useVoucher ? voucher : null,
    reward: rewardId ? rewards.find((r) => r.id === rewardId) ?? null : null,
  });

  const getStatus = (iso: string): DayStatus => dayAvailability(exp, iso, need, ctx).status;
  const canNext = step === 0 ? !!date && (isStay ? !!end : !!chosenSlot) : step === 1 ? guests >= exp.minGuests && guests <= exp.maxGuests : agree || !needsAck(exp.kind, exp.safety);

  const finish = () => {
    if (!date) return;
    const r = addToCart({
      experienceId: exp.id,
      date,
      time: isStay ? undefined : chosenSlot?.time,
      nights: isStay ? nights : undefined,
      guests: { adults, children },
      addOnIds: addOns,
      voucherId: useVoucher && voucher ? voucher.id : undefined,
      rewardId: rewardId ?? undefined,
    });
    if (!r.ok) {
      toast({ title: 'That slot just filled up', body: r.reason, tone: 'warning' });
      setStep(0);
      return;
    }
    toast({ title: 'Spots held for 10 minutes', body: `${exp.title} · ${fmtDate(date)}`, tone: 'success' });
    nav('/checkout');
  };

  return (
    <AppShell footer={false} tabBar={false}>
      <div className="shell grid gap-10 py-8 pb-28 md:py-12 lg:grid-cols-[1fr_420px] lg:gap-14">
        <div className="min-w-0">
          <Link to={`/p/${provider.slug}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-3 hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> {provider.name}
          </Link>
          <h1 className="mt-3 font-display text-[34px] leading-[1.05] tracking-tight md:text-[44px]">{exp.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
            <Badge tone="neutral" icon={<Clock className="h-3 w-3" />}>
              {isStay ? `Check-in ${exp.stay?.checkIn} · out ${exp.stay?.checkOut}` : fmtDuration(exp.durationMins)}
            </Badge>
            <Badge tone="neutral" icon={<Users className="h-3 w-3" />}>
              {exp.minGuests > 1 ? `${exp.minGuests}–` : 'Up to '}
              {exp.maxGuests} guests
            </Badge>
            {exp.minAge && <Badge tone="neutral">Ages {exp.minAge}+</Badge>}
            {exp.requiresLicense && <Badge tone="sea">Licensed operator required</Badge>}
            <DemoTag />
          </div>

          {/* Stepper */}
          <ol className="mt-8 flex items-center gap-2">
            {STEPS.map((s, i) => (
              <li key={s} className="flex flex-1 items-center gap-2">
                <button
                  onClick={() => i < step && setStep(i)}
                  className={cn(
                    'flex items-center gap-2 text-[13px] font-semibold transition',
                    i === step ? 'text-ink' : i < step ? 'text-oasis-600 hover:text-oasis-700' : 'text-ink-4',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px]',
                      i === step ? 'bg-ink text-paper' : i < step ? 'bg-oasis-500 text-white' : 'bg-sand-200 text-ink-3',
                    )}
                  >
                    {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className="hidden sm:inline">{s}</span>
                </button>
                {i < STEPS.length - 1 && <span className={cn('h-px flex-1', i < step ? 'bg-oasis-400' : 'bg-line')} />}
              </li>
            ))}
          </ol>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8"
            >
              {step === 0 && (
                <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
                  <div className="rounded-[26px] border border-line bg-white p-5 md:p-6">
                    <div className="mb-4 flex items-center gap-2 text-[15px] font-semibold">
                      <CalendarDays className="h-4 w-4" /> {isStay ? 'Choose check-in and check-out' : 'Choose a date'}
                    </div>
                    <Calendar
                      todayISO={ctx.todayISO}
                      value={date}
                      rangeEnd={isStay ? end : null}
                      mode={isStay ? 'range' : 'single'}
                      maxRange={exp.stay?.maxNights ?? 1}
                      getStatus={getStatus}
                      onSelect={(d) => {
                        setDate(d);
                        if (isStay) setEnd(null);
                      }}
                      onSelectRange={(a, b) => {
                        setDate(a);
                        setEnd(b);
                      }}
                    />
                  </div>
                  <div className="space-y-3">
                    {date && (
                      <div className="rounded-[22px] bg-sand-100 p-4">
                        <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-3">{isStay ? 'Your stay' : 'Selected'}</div>
                        <div className="mt-1 font-display text-[20px] leading-tight">{fmtDateLong(date)}</div>
                        {isStay && end && (
                          <div className="mt-1 text-[13.5px] text-ink-2">
                            to {fmtDate(end, 'EEE d MMM')} · {nights} night{nights > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    )}
                    {!isStay && (
                      <div className="rounded-[22px] border border-line bg-white p-4">
                        <div className="mb-2 text-[13px] font-semibold">Times</div>
                        {slots.length === 0 && <div className="text-[13px] text-ink-3">No sessions on this day.</div>}
                        <div className="space-y-2">
                          {slots.map((s) => {
                            const ok = s.remaining >= need;
                            const on = chosenSlot?.key === s.key;
                            return (
                              <button
                                key={s.key}
                                disabled={!ok}
                                onClick={() => setTime(s.time)}
                                className={cn(
                                  'flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition',
                                  on ? 'border-ink bg-ink text-paper' : 'border-line hover:border-ink/40',
                                  !ok && 'cursor-not-allowed opacity-40',
                                )}
                              >
                                <span className="text-[15px] font-semibold">{fmtTime(s.time)}</span>
                                <span className={cn('text-[12px] font-semibold', on ? 'text-honey-300' : s.remaining <= 4 ? 'text-amber-700' : 'text-oasis-600')}>
                                  {ok ? `${s.remaining} of ${s.capacity} left` : 'Not enough space'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-2 rounded-2xl bg-oasis-50 p-3 text-[12.5px] text-oasis-700">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" /> Availability is live. Spots are held for 10 minutes once you continue to checkout.
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-6">
                  <div className="rounded-[26px] border border-line bg-white px-5 py-2 md:px-6">
                    <Counter label="Adults" hint="Ages 13+" value={adults} min={1} max={exp.maxGuests - children} onChange={setAdults} />
                    <div className="h-px bg-line" />
                    <Counter
                      label="Children"
                      hint={exp.childPrice !== undefined && exp.childPrice !== exp.price ? `Ages ${exp.minAge ?? 3}–12 · ${aed(exp.childPrice)} each` : `Ages ${exp.minAge ?? 3}–12`}
                      value={children}
                      min={0}
                      max={exp.familyFriendly ? exp.maxGuests - adults : 0}
                      onChange={setChildren}
                    />
                    {exp.priceUnit === 'per_booking' && (
                      <div className="pb-3 text-[12.5px] text-ink-3">
                        Package price covers {exp.includedGuests} guests; extra guests {aed(exp.extraGuestPrice ?? 0)} each.
                      </div>
                    )}
                    {!exp.familyFriendly && <div className="pb-3 text-[12.5px] text-amber-800">This experience isn’t suitable for children.</div>}
                  </div>

                  {exp.addOns.length > 0 && (
                    <div>
                      <div className="mb-3 text-[15px] font-semibold">Make it yours</div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {exp.addOns.map((a) => {
                          const on = addOns.includes(a.id);
                          return (
                            <button
                              key={a.id}
                              onClick={() => setAddOns(on ? addOns.filter((x) => x !== a.id) : [...addOns, a.id])}
                              className={cn('flex items-start gap-3 rounded-2xl border p-4 text-left transition', on ? 'border-ink bg-ink/[0.03] shadow-ring' : 'border-line bg-white hover:border-ink/30')}
                            >
                              <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', on ? 'border-ink bg-ink text-white' : 'border-ink/25')}>
                                {on && <Check className="h-3.5 w-3.5" />}
                              </span>
                              <span>
                                <span className="block text-[14.5px] font-semibold">{a.name}</span>
                                <span className="text-[13px] text-ink-3">
                                  +{aed(a.price)} {a.unit === 'per_guest' ? 'per guest' : ''}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(voucher || rewards.length > 0) && (
                    <div className="space-y-3">
                      <div className="text-[15px] font-semibold">Apply what you’ve earned</div>
                      {voucher && (
                        <ToggleCard
                          on={useVoucher}
                          onToggle={() => setUseVoucher(!useVoucher)}
                          icon={<Ticket className="h-4 w-4" />}
                          title="Use your prepaid experience"
                          body={`Bought ${fmtDate(voucher.purchasedAt)} for ${aed(voucher.pricePaid)} · valid until ${fmtDate(voucher.expiresAt, 'd MMM yyyy')}`}
                        />
                      )}
                      {rewards.map((r) => (
                        <ToggleCard
                          key={r.id}
                          on={rewardId === r.id}
                          onToggle={() => setRewardId(rewardId === r.id ? null : r.id)}
                          icon={<Gift className="h-4 w-4" />}
                          title={r.title}
                          body={`Passport reward · funded by ${r.fundedBy.name}`}
                        />
                      ))}
                    </div>
                  )}

                  {(exp.dietary || exp.kind === 'dining' || exp.kind === 'package') && (
                    <div>
                      <label className="label" htmlFor="notes">
                        Dietary needs or requests for {provider.hostName}
                      </label>
                      <textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        className="input resize-none"
                        placeholder="e.g. one vegetarian, a nut allergy, celebrating a birthday"
                      />
                      {exp.dietary && <div className="mt-2 text-[12.5px] text-ink-3">{exp.dietary.join(' · ')}</div>}
                    </div>
                  )}
                </div>
              )}

              {step === 2 && date && (
                <div className="space-y-5">
                  <div className="rounded-[26px] border border-line bg-white p-5 md:p-6">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Info2 label={isStay ? 'Check-in' : 'Date'} value={fmtDate(date, 'EEE d MMM yyyy')} />
                      <Info2 label={isStay ? 'Nights' : 'Time'} value={isStay ? `${nights} · out ${end ? fmtDate(end, 'EEE d MMM') : ''}` : fmtTime(chosenSlot?.time)} />
                      <Info2 label="Guests" value={`${adults} adult${adults > 1 ? 's' : ''}${children ? `, ${children} child${children > 1 ? 'ren' : ''}` : ''}`} />
                    </div>
                    <div className="mt-5 border-t border-line pt-5">
                      <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-ink-3">Included</div>
                      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                        {exp.includes.map((i) => (
                          <li key={i} className="flex items-start gap-2 text-[14px] text-ink-2">
                            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-oasis-500" /> {i}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {exp.menu && (
                    <div className="rounded-[26px] border border-line bg-white p-5 md:p-6">
                      <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-ink-3">Seasonal menu · may change with the harvest</div>
                      <div className="mt-3 grid gap-4 sm:grid-cols-3">
                        {exp.menu.map((c) => (
                          <div key={c.course}>
                            <div className="font-display text-[17px]">{c.course}</div>
                            <ul className="mt-1 space-y-1 text-[13.5px] text-ink-2">
                              {c.items.map((x) => (
                                <li key={x}>{x}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="rounded-[26px] border border-line bg-white p-5 md:p-6">
                    <div className="flex items-center gap-2 text-[15px] font-semibold">
                      <ShieldCheck className="h-4 w-4 text-oasis-500" /> {provider.cancellation.summary}
                    </div>
                    <ul className="mt-2 space-y-1 text-[13.5px] text-ink-2">
                      {provider.cancellation.rules.map((r) => (
                        <li key={r}>· {r}</li>
                      ))}
                    </ul>
                  </div>
                  {needsAck(exp.kind, exp.safety) && (
                    <label className="flex cursor-pointer items-start gap-3 rounded-[22px] border border-sea-200 bg-sea-100/50 p-4">
                      <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-4 w-4 accent-sea-600" />
                      <span className="text-[13.5px] text-sea-800">
                        <span className="block font-semibold">I’ve read the safety notes</span>
                        {exp.safety?.join(' · ')}
                        {exp.kind === 'boat' && ' · Catches are never guaranteed and UAE fishing rules apply.'}
                      </span>
                    </label>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 hidden items-center justify-between md:flex">
            <Button variant="ghost" onClick={() => (step ? setStep(step - 1) : nav(-1))} icon={<ArrowLeft className="h-4 w-4" />}>
              Back
            </Button>
            {step < 2 ? (
              <Button size="lg" variant="dark" disabled={!canNext} onClick={() => setStep(step + 1)} iconRight={<ArrowRight className="h-4 w-4" />}>
                Continue
              </Button>
            ) : (
              <Button size="lg" disabled={!canNext} onClick={finish} iconRight={<ArrowRight className="h-4 w-4" />}>
                Hold spots & check out
              </Button>
            )}
          </div>
        </div>

        {/* Summary */}
        <aside>
          <div className="sticky top-[96px] overflow-hidden rounded-[28px] border border-line bg-white shadow-lift">
            <div className="relative">
              <SmartImage img={exp.image} aspect={16 / 9} width={900} className="aspect-[16/9]" category={exp.categoryId} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4 text-white">
                <div className="text-[12px] font-semibold text-white/75">{provider.name}</div>
                <div className="font-display text-[20px] leading-tight">{exp.title}</div>
              </div>
            </div>
            <div className="p-5">
              {date && (
                <div className="mb-4 flex items-center gap-2 rounded-2xl bg-sand-50 px-3 py-2.5 text-[13px] font-semibold">
                  <CalendarDays className="h-4 w-4 text-ink-3" />
                  {fmtDate(date, 'EEE d MMM')}
                  {isStay ? ` → ${end ? fmtDate(end, 'EEE d MMM') : '…'}` : chosenSlot?.time ? ` · ${fmtTime(chosenSlot.time)}` : ''}
                  <span className="ml-auto text-ink-3">{guests} guest{guests > 1 ? 's' : ''}</span>
                </div>
              )}
              <div className="space-y-2">
                {price.lines.map((l, i) => (
                  <div key={i} className={cn('flex justify-between gap-4 text-[14px]', l.amount < 0 ? 'text-oasis-600' : 'text-ink-2')}>
                    <span>{l.label}</span>
                    <span className="tabular shrink-0">{aed(l.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
                <span className="text-[15px] font-semibold">Total</span>
                <span className="tabular font-display text-[28px]">{aed(price.total)}</span>
              </div>
              <div className="mt-1 text-[12px] text-ink-3">Includes VAT {aed(price.vatIncluded, { decimals: true })} · no booking fees</div>
              <div className="mt-4 rounded-2xl p-3 text-[12.5px]" style={{ background: cat.theme.accentSoft, color: cat.theme.deep }}>
                <span className="font-semibold">After your visit:</span> {cat.commerce.headline}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-3">
          <button aria-label="Back" onClick={() => (step ? setStep(step - 1) : nav(-1))} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink/15 bg-white">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-ink-3">Step {step + 1} of 3</div>
            <div className="tabular text-[16px] font-semibold">{aed(price.total)}</div>
          </div>
          {step < 2 ? (
            <Button variant="dark" disabled={!canNext} onClick={() => setStep(step + 1)}>
              Continue
            </Button>
          ) : (
            <Button disabled={!canNext} onClick={finish}>
              Hold & checkout
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function needsAck(kind: string, safety?: string[]) {
  return (kind === 'boat' || (safety?.length ?? 0) > 0) && kind !== 'dining';
}

function Info2({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-3">{label}</div>
      <div className="mt-1 text-[15px] font-semibold">{value}</div>
    </div>
  );
}

function ToggleCard({ on, onToggle, icon, title, body }: { on: boolean; onToggle: () => void; icon: React.ReactNode; title: string; body: string }) {
  return (
    <button onClick={onToggle} className={cn('flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition', on ? 'border-oasis-400 bg-oasis-50' : 'border-line bg-white hover:border-ink/30')}>
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', on ? 'bg-oasis-500 text-white' : 'bg-sand-100 text-ink-2')}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold">{title}</span>
        <span className="block text-[12.5px] text-ink-3">{body}</span>
      </span>
      <span className={cn('flex h-6 w-6 items-center justify-center rounded-full border', on ? 'border-oasis-500 bg-oasis-500 text-white' : 'border-ink/20')}>{on && <Check className="h-3.5 w-3.5" />}</span>
    </button>
  );
}
