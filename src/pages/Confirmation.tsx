import { motion } from 'framer-motion';
import { shortProviderName } from '@/lib/utils';
import { ArrowRight, CalendarPlus, CheckCircle2, Copy, KeyRound, Mail, MapPin, Printer, Repeat, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { SmartImage } from '@/components/ui/SmartImage';
import { Modal } from '@/components/ui/overlays';
import { ProductCard } from '@/components/cards/Cards';
import { Stamp } from '@/components/passport/Stamp';
import { LogoMark } from '@/components/brand/Logo';
import { CATEGORY_BY_ID } from '@/data/categories';
import { EXPERIENCE_BY_ID, PRESALE_BY_ID, PRODUCT_BY_ID, PROVIDER_BY_ID, productsForProvider } from '@/data/catalog';
import type { Booking, Order } from '@/data/types';
import { useApp } from '@/store/app';
import type { CheckoutResult } from '@/store/app';
import { useUI } from '@/store/ui';
import { aed, fmtDate, fmtDateLong, fmtTime } from '@/lib/format';
import { BRAND } from '@/config/brand';

function icsFor(b: Booking) {
  const e = EXPERIENCE_BY_ID[b.experienceId];
  const p = PROVIDER_BY_ID[b.providerId];
  const d = b.date.replace(/-/g, '');
  const [h, m] = (b.time ?? e.stay?.checkIn ?? '09:00').split(':');
  const start = `${d}T${h}${m}00`;
  const endMins = Number(h) * 60 + Number(m) + (e.durationMins || 120);
  const end = `${d}T${String(Math.floor(endMins / 60) % 24).padStart(2, '0')}${String(endMins % 60).padStart(2, '0')}00`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LocalDays//Demo//EN',
    'BEGIN:VEVENT',
    `UID:${b.ref}@localdays.demo`,
    `DTSTART;TZID=Asia/Dubai:${start}`,
    `DTEND;TZID=Asia/Dubai:${end}`,
    `SUMMARY:${e.title} — ${p.name}`,
    `LOCATION:${p.locationLabel}`,
    `DESCRIPTION:Booking ${b.ref}. Check-in code ${b.checkInCode}. Demo booking via ${BRAND.name}.`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function Confirmation() {
  const { ref = '' } = useParams();
  const loc = useLocation();
  const state = loc.state as { result?: CheckoutResult } | null;
  const bookingsAll = useApp((s) => s.bookings);
  const ordersAll = useApp((s) => s.orders);
  const subsAll = useApp((s) => s.subscriptions);
  const vouchersAll = useApp((s) => s.vouchers);
  const toast = useUI((s) => s.toast);
  const user = useApp((s) => s.user);
  const setAuth = useUI((s) => s.setAuthOpen);
  const [emailOpen, setEmailOpen] = useState(false);

  const data = useMemo(() => {
    const r = state?.result;
    if (r) {
      return {
        bookings: r.bookings.map((b) => bookingsAll.find((x) => x.ref === b.ref) ?? b),
        order: r.order,
        subscriptions: r.subscriptions,
        vouchers: r.vouchers,
        total: r.total,
      };
    }
    const b = bookingsAll.find((x) => x.ref === ref);
    const o = ordersAll.find((x) => x.ref === ref);
    return {
      bookings: b ? [b] : [],
      order: o as Order | undefined,
      subscriptions: subsAll.filter((s) => s.id === ref),
      vouchers: vouchersAll.filter((v) => v.id === ref),
      total: (b?.price.total ?? 0) + (o?.total ?? 0),
    };
  }, [state, ref, bookingsAll, ordersAll, subsAll, vouchersAll]);

  const first = data.bookings[0];
  const firstExp = first ? EXPERIENCE_BY_ID[first.experienceId] : null;
  const firstProvider = first ? PROVIDER_BY_ID[first.providerId] : data.order ? PROVIDER_BY_ID[data.order.providerIds[0]] : null;
  const cat = firstProvider ? CATEGORY_BY_ID[firstProvider.categoryId] : null;
  const visited = !!first && first.status === 'completed';
  const headline = first ? (visited ? `Your visit to ${firstProvider!.name}.` : `You’re going to ${firstProvider!.name}.`) : data.subscriptions.length ? 'Your subscription is live.' : data.vouchers.length ? 'Your prepaid experience is ready.' : 'Order confirmed.';

  return (
    <AppShell>
      <section className="relative overflow-hidden border-b border-line bg-sand-100">
        <div className="pattern-girih absolute inset-0 opacity-60" />
        <div className="shell relative py-14 md:py-20">
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 12, stiffness: 180 }} className="flex h-16 w-16 items-center justify-center rounded-full bg-oasis-500 text-white shadow-lift">
            <CheckCircle2 className="h-8 w-8" />
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.7 }} className="display-lg mt-6 max-w-3xl text-balance">
            {headline}
          </motion.h1>
          <p className="mt-4 max-w-xl text-[16px] text-ink-2">
            Confirmation sent to <span className="font-semibold text-ink">{first?.customer.email ?? data.order?.customer.email ?? data.subscriptions[0]?.customer.email}</span> (simulated). Total paid{' '}
            <span className="font-semibold text-ink">{aed(data.total)}</span>.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="dark" icon={<Mail className="h-4 w-4" />} onClick={() => setEmailOpen(true)}>
              View confirmation email
            </Button>
            <Button variant="outline" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
              Print receipt
            </Button>
            <Button to="/me" variant="outline">
              My LocalDays
            </Button>
          </div>
        </div>
      </section>

      <section className="shell grid gap-8 py-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          {data.bookings.map((b) => {
            const e = EXPERIENCE_BY_ID[b.experienceId];
            const p = PROVIDER_BY_ID[b.providerId];
            return (
              <div key={b.ref} className="overflow-hidden rounded-[28px] border border-line bg-white">
                <div className="grid sm:grid-cols-[220px_1fr]">
                  <SmartImage img={e.image} aspect={4 / 3} width={600} className="aspect-[4/3] sm:aspect-auto sm:h-full" category={e.categoryId} />
                  <div className="p-5 md:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[12.5px] font-semibold text-ink-3">{p.name}</div>
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(b.ref);
                          toast({ title: 'Reference copied', body: b.ref });
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-sand-100 px-2.5 py-1 font-mono text-[12px] font-semibold"
                      >
                        {b.ref} <Copy className="h-3 w-3" />
                      </button>
                    </div>
                    <h2 className="mt-1 font-display text-[24px] leading-tight tracking-tight">{e.title}</h2>
                    <div className="mt-3 grid gap-3 text-[14px] sm:grid-cols-3">
                      <div>
                        <div className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-ink-3">When</div>
                        <div className="mt-0.5 font-semibold">{fmtDateLong(b.date)}</div>
                        <div className="text-ink-2">{b.time ? fmtTime(b.time) : `${b.nights} night${(b.nights ?? 1) > 1 ? 's' : ''} · check-in ${e.stay?.checkIn}`}</div>
                      </div>
                      <div>
                        <div className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-ink-3">Guests</div>
                        <div className="mt-0.5 font-semibold">
                          {b.guests.adults} adult{b.guests.adults > 1 ? 's' : ''}
                          {b.guests.children ? `, ${b.guests.children} child${b.guests.children > 1 ? 'ren' : ''}` : ''}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-ink-3">Paid</div>
                        <div className="mt-0.5 font-semibold">{aed(b.price.total)}</div>
                        <div className="text-ink-2">{b.payment.label}</div>
                      </div>
                    </div>
                    {b.status === 'completed' ? (
                      <div className="mt-5 flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-900">
                        <KeyRound className="h-5 w-5 text-emerald-600" />
                        <div className="text-[13.5px]">
                          <span className="font-semibold">Checked in</span> — verified by {p.hostName}
                          {b.completedAt ? ` on ${fmtDate(b.completedAt, 'd MMM yyyy')}` : ''}.
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-ink p-4 text-paper sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <KeyRound className="h-5 w-5 text-honey-300" />
                          <div>
                            <div className="text-[12px] text-paper/60">Check-in code — show it to {p.hostName} on arrival</div>
                            <div className="font-mono text-[22px] font-bold tracking-[0.3em]">{b.checkInCode}</div>
                          </div>
                        </div>
                        <Button variant="glass" size="sm" icon={<CalendarPlus className="h-4 w-4" />} onClick={() => download(`${b.ref}.ics`, icsFor(b))}>
                          Add to calendar
                        </Button>
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-2 text-[13px] text-ink-3">
                      <MapPin className="h-4 w-4" /> {p.locationLabel}
                      {b.status !== 'completed' && ' · exact directions are sent 24 hours before (simulated)'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {data.subscriptions.map((s) => {
            const p = PRODUCT_BY_ID[s.productId];
            return (
              <div key={s.id} className="flex items-center gap-4 rounded-[24px] border border-honey-200 bg-honey-100/40 p-4">
                <SmartImage img={p.image} aspect={1} width={200} className="h-16 w-16 shrink-0 rounded-2xl" category={p.categoryId} />
                <div className="min-w-0 flex-1">
                  <div className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-honey-700">
                    <Repeat className="h-3.5 w-3.5" /> {s.frequency} subscription
                  </div>
                  <div className="text-[15px] font-semibold">{p.name}</div>
                  <div className="text-[13px] text-ink-2">
                    {aed(s.price)} per delivery · next {fmtDate(s.nextDelivery)} · manage in My LocalDays
                  </div>
                </div>
              </div>
            );
          })}

          {data.order && (
            <div className="rounded-[24px] border border-line bg-white p-5">
              <div className="flex items-center justify-between">
                <div className="text-[15px] font-semibold">Order {data.order.ref}</div>
                <div className="text-[13px] text-ink-3">Delivery {fmtDate(data.order.deliveryDate)}</div>
              </div>
              <ul className="mt-3 space-y-1.5 text-[14px] text-ink-2">
                {data.order.lines.map((l) => (
                  <li key={l.productId + (l.variantId ?? '')} className="flex justify-between">
                    <span>
                      {l.qty} × {PRODUCT_BY_ID[l.productId].name}
                    </span>
                    <span className="tabular">{aed(l.unitPrice * l.qty)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.vouchers.length > 0 && (
            <div className="rounded-[24px] border border-line bg-white p-5">
              <div className="text-[15px] font-semibold">Prepaid experience{data.vouchers.length > 1 ? 's' : ''}</div>
              {data.vouchers.map((v) => (
                <div key={v.id} className="mt-2 text-[14px] text-ink-2">
                  {PRESALE_BY_ID[v.offerId].title} · valid until {fmtDate(v.expiresAt, 'd MMM yyyy')} · book any open slot from the host page.
                </div>
              ))}
            </div>
          )}

          {firstProvider && productsForProvider(firstProvider.id).length > 0 && (
            <div className="rounded-[28px] bg-white p-5 md:p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="eyebrow">After your visit</div>
                  <h3 className="mt-2 font-display text-[26px] tracking-tight">{cat?.commerce.headline}</h3>
                </div>
                <Link to={`/p/${firstProvider.slug}/shop`} className="hidden shrink-0 items-center gap-1 text-[14px] font-semibold sm:inline-flex">
                  Shop <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3">
                {productsForProvider(firstProvider.id)
                  .slice(0, 3)
                  .map((p) => (
                    <ProductCard key={p.id} prod={p} compact />
                  ))}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-5">
          {firstExp && (
            <div className="rounded-[28px] border border-line bg-white p-6 text-center">
              <div className="flex justify-center">
                <Stamp id={firstExp.categoryId} earned={visited} size={150} />
              </div>
              <div className="mt-4 font-display text-[20px]">{visited ? `${CATEGORY_BY_ID[firstExp.categoryId].stamp.title} stamp earned` : 'A stamp is waiting'}</div>
              {visited ? (
                <>
                  <p className="mt-1 text-[13.5px] text-ink-2">
                    Verified by {firstProvider?.hostName}
                    {first?.completedAt ? ` on ${fmtDate(first.completedAt, 'd MMM yyyy')}` : ''}. It’s in your Passport.
                  </p>
                  <Button to={`/p/${firstProvider?.slug}/shop`} variant="outline" size="sm" className="mt-4">
                    Shop from {firstProvider ? shortProviderName(firstProvider.name) : 'the host'}
                  </Button>
                </>
              ) : user ? (
                <>
                  <p className="mt-1 text-[13.5px] text-ink-2">
                    When {firstProvider?.hostName} checks you in, the <strong>{CATEGORY_BY_ID[firstExp.categoryId].stamp.title}</strong> stamp lands in your Passport.
                  </p>
                  <Button to="/passport" variant="outline" size="sm" className="mt-4">
                    Open Passport
                  </Button>
                </>
              ) : (
                <>
                  <p className="mt-1 text-[13.5px] text-ink-2">
                    You booked as a guest. Create a free account before your visit and the <strong>{CATEGORY_BY_ID[firstExp.categoryId].stamp.title}</strong> stamp is yours when{' '}
                    {firstProvider?.hostName} checks you in.
                  </p>
                  <Button
                    variant="dark"
                    size="sm"
                    className="mt-4"
                    onClick={() => setAuth(true, first ? { name: first.customer.name, email: first.customer.email } : undefined)}
                  >
                    Create my Passport
                  </Button>
                </>
              )}
            </div>
          )}
          <Link to="/compose" className="flex items-center gap-3 rounded-[24px] bg-ink p-5 text-paper">
            <Sparkles className="h-5 w-5 text-honey-300" />
            <span className="flex-1">
              <span className="block text-[15px] font-semibold">Make a day of it</span>
              <span className="block text-[13px] text-paper/60">Compose the rest of your day around this booking.</span>
            </span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </aside>
      </section>

      <Modal open={emailOpen} onClose={() => setEmailOpen(false)} className="sm:max-w-xl">
        <div className="bg-[#F3EFE7] p-4 sm:p-6">
          <div className="text-[12px] text-ink-3">Preview · simulated email · not sent</div>
          <div className="mt-3 overflow-hidden rounded-2xl bg-white shadow-soft">
            <div className="flex items-center gap-3 border-b border-line p-5">
              <LogoMark className="h-9 w-9" />
              <div>
                <div className="text-[13px] font-semibold">LocalDays</div>
                <div className="text-[12px] text-ink-3">to {first?.customer.email ?? data.order?.customer.email}</div>
              </div>
            </div>
            <div className="p-6">
              <div className="font-display text-[26px] leading-tight">{headline}</div>
              {first && firstExp && (
                <>
                  <SmartImage img={firstExp.image} aspect={16 / 7} width={800} className="mt-4 aspect-[16/7] rounded-xl" category={firstExp.categoryId} />
                  <p className="mt-4 text-[14.5px] leading-relaxed text-ink-2">
                    Hi {first.customer.name.split(' ')[0]}, {firstProvider?.hostName} is looking forward to welcoming you on <strong>{fmtDateLong(first.date)}</strong>
                    {first.time ? ` at ${fmtTime(first.time)}` : ''}. Your booking reference is <strong>{first.ref}</strong> and your check-in code is <strong>{first.checkInCode}</strong>.
                  </p>
                </>
              )}
              <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2">
                After your visit, your host’s shop will remember what you loved — so you can reorder it from anywhere.
              </p>
              <div className="mt-5 inline-flex rounded-full bg-clay-500 px-5 py-2.5 text-[14px] font-semibold text-white">Manage booking</div>
            </div>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
