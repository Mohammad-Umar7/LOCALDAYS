import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarCheck2,
  CheckCircle2,
  Clock,
  FlaskConical,
  Gift,
  Heart,
  KeyRound,
  MapPin,
  Package,
  Pause,
  Play,
  Printer,
  Receipt,
  Repeat,
  RotateCcw,
  SkipForward,
  Ticket,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/overlays';
import { SmartImage } from '@/components/ui/SmartImage';
import { Badge, EmptyState, Stat } from '@/components/ui/primitives';
import { BlendCard } from '@/components/account/BlendCard';
import { ExperienceCard, ProviderCard } from '@/components/cards/Cards';
import { Stamp } from '@/components/passport/Stamp';
import { EXPERIENCE_BY_ID, PRESALE_BY_ID, PRODUCT_BY_ID, PROVIDER_BY_ID } from '@/data/catalog';
import { CATEGORY_BY_ID } from '@/data/categories';
import { REGION_BY_ID } from '@/data/regions';
import type { Booking, Frequency, Order, Subscription } from '@/data/types';
import { useApp, useTodayISO, type PipelineStage, useMyBlends, useMyStamps, useMySaved, useMyBookings, useMyUsedRewards, useMyVouchers } from '@/store/app';
import { useUI } from '@/store/ui';
import { unlockedRewards, liveBudget } from '@/services/passport';
import { daysBetween, relativeDayLabel } from '@/lib/dates';
import { aed, fmtDate, fmtTime } from '@/lib/format';
import { cn, shortProviderName } from '@/lib/utils';

type Tab = 'trips' | 'orders' | 'subscriptions' | 'blends' | 'rewards' | 'saved' | 'receipts';

export const KILN_STAGES = ['Commissioned', 'Thrown', 'Drying', 'Bisque fired', 'Glazed', 'Glaze fired', 'Ready to ship'];

export default function Account() {
  const { tab: tabParam } = useParams();
  const nav = useNavigate();
  const user = useApp((s) => s.user);
  const setAuth = useUI((s) => s.setAuthOpen);
  const tab = (tabParam as Tab) || 'trips';
  const all = useApp((s) => s);
  const email = user?.email;
  const bookings = all.bookings.filter((b) => b.customer.email === email);
  const orders = all.orders.filter((o) => o.customer.email === email);
  const subs = all.subscriptions.filter((s) => s.customer.email === email && s.status !== 'cancelled');
  const blends = useMyBlends();
  const myStamps = useMyStamps();
  const savedIds = useMySaved();
  const rewards = unlockedRewards(myStamps, bookings);

  if (!user) {
    return (
      <AppShell>
        <div className="shell py-20">
          <EmptyState
            icon={<Ticket className="h-6 w-6" />}
            title="Sign in to see your LocalDays"
            body="Your trips, orders, subscriptions, Signature Blends and Passport live here."
            action={<Button onClick={() => setAuth(true)}>Sign in</Button>}
          />
        </div>
      </AppShell>
    );
  }

  const upcoming = bookings.filter((b) => b.status === 'confirmed').sort((a, b) => a.date.localeCompare(b.date));
  const spent = bookings.filter((b) => b.status !== 'cancelled').reduce((s, b) => s + b.price.total, 0) + orders.reduce((s, o) => s + o.total, 0);

  return (
    <AppShell>
      <section className="border-b border-line bg-sand-100">
        <div className="shell flex flex-col gap-6 py-10 md:flex-row md:items-end md:justify-between md:py-14">
          <div>
            <div className="eyebrow">My LocalDays</div>
            <h1 className="mt-3 font-display text-[40px] leading-tight tracking-tight md:text-[52px]">Marhaba, {user.firstName}.</h1>
            <p className="mt-2 text-[15px] text-ink-2">
              {upcoming.length ? `Next up: ${EXPERIENCE_BY_ID[upcoming[0].experienceId].title}, ${relativeDayLabel(all.todayISO(), upcoming[0].date).toLowerCase()}.` : 'No trips booked — your next local day is waiting.'}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-6 md:gap-10">
            <Stat label="Stamps" value={myStamps.length} />
            <Stat label="Hosts supported" value={new Set([...bookings.map((b) => b.providerId), ...orders.flatMap((o) => o.providerIds)]).size} />
            <Stat label="Spent locally" value={aed(spent)} />
          </div>
        </div>
        <div className="shell pb-4">
          <Tabs
            value={tab}
            onChange={(t) => nav(t === 'trips' ? '/me' : `/me/${t}`)}
            items={[
              { id: 'trips', label: 'Trips', count: upcoming.length },
              { id: 'orders', label: 'Orders', count: orders.length },
              { id: 'subscriptions', label: 'Subscriptions', count: subs.length },
              { id: 'blends', label: 'Signature Blends', count: blends.length },
              { id: 'rewards', label: 'Rewards', count: rewards.length },
              { id: 'saved', label: 'Saved', count: savedIds.length },
              { id: 'receipts', label: 'Receipts' },
            ]}
          />
        </div>
      </section>

      <section className="shell py-10 pb-28">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
            {tab === 'trips' && <Trips bookings={bookings} />}
            {tab === 'orders' && <Orders orders={orders} />}
            {tab === 'subscriptions' && <Subscriptions subs={subs} />}
            {tab === 'blends' && (
              <div className="space-y-5">
                {blends.length ? (
                  blends.map((b) => <BlendCard key={b.id} blend={b} />)
                ) : (
                  <EmptyState icon={<FlaskConical className="h-6 w-6" />} title="No blends yet" body="Create one at a fragrance workshop — the maker saves the approved formula here." action={<Button to="/c/fragrance">Find a workshop</Button>} />
                )}
                <Vouchers />
              </div>
            )}
            {tab === 'rewards' && <Rewards />}
            {tab === 'saved' && <Saved />}
            {tab === 'receipts' && <Receipts bookings={bookings} orders={orders} />}
          </motion.div>
        </AnimatePresence>
      </section>
    </AppShell>
  );
}

/* --------------------------------- Trips --------------------------------- */

function Trips({ bookings }: { bookings: Booking[] }) {
  const today = useTodayISO();
  const upcoming = bookings.filter((b) => b.status === 'confirmed').sort((a, b) => a.date.localeCompare(b.date));
  const past = bookings.filter((b) => b.status === 'completed').sort((a, b) => b.date.localeCompare(a.date));
  const cancelled = bookings.filter((b) => b.status === 'cancelled');
  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-display text-[26px] tracking-tight">Upcoming</h2>
        <div className="mt-5 space-y-4">
          {upcoming.length ? (
            upcoming.map((b) => <TripCard key={b.ref} b={b} today={today} />)
          ) : (
            <EmptyState icon={<CalendarCheck2 className="h-6 w-6" />} title="No upcoming trips" body="Let the Day Composer build one, or browse the five traditions." action={<Button to="/compose" variant="dark">Compose a day</Button>} />
          )}
        </div>
      </div>
      {past.length > 0 && (
        <div>
          <h2 className="font-display text-[26px] tracking-tight">Completed</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {past.map((b) => {
              const e = EXPERIENCE_BY_ID[b.experienceId];
              const p = PROVIDER_BY_ID[b.providerId];
              return (
                <div key={b.ref} className="flex items-center gap-4 rounded-[24px] border border-line bg-white p-4">
                  <Stamp id={b.categoryId} size={86} rotate={-6} region={REGION_BY_ID[p.regionId].name} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold text-ink-3">
                      {p.name} · {fmtDate(b.date, 'd MMM yyyy')}
                    </div>
                    <div className="line-clamp-2 text-[15px] font-semibold">{e.title}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link to={`/p/${p.slug}/shop`} className="rounded-full bg-ink px-3 py-1.5 text-[12px] font-semibold text-paper">
                        Shop from {shortProviderName(p.name)}
                      </Link>
                      <Link to={`/book/${e.id}`} className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold">
                        Book again
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {cancelled.length > 0 && <div className="text-[13px] text-ink-3">{cancelled.length} cancelled booking{cancelled.length > 1 ? 's' : ''} — refunds follow each host’s policy.</div>}
    </div>
  );
}

function TripCard({ b, today }: { b: Booking; today: string }) {
  const e = EXPERIENCE_BY_ID[b.experienceId];
  const p = PROVIDER_BY_ID[b.providerId];
  const cat = CATEGORY_BY_ID[b.categoryId];
  const [checkIn, setCheckIn] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [code, setCode] = useState('');
  const complete = useApp((s) => s.completeBooking);
  const cancelBooking = useApp((s) => s.cancelBooking);
  const toast = useUI((s) => s.toast);
  const days = daysBetween(today, b.date);
  return (
    <div className="overflow-hidden rounded-[28px] border border-line bg-white">
      <div className="grid md:grid-cols-[260px_1fr]">
        <div className="relative">
          <SmartImage img={e.image} aspect={4 / 3} width={600} className="aspect-[16/9] h-full md:aspect-auto" category={e.categoryId} />
          <div className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-[12px] font-bold">
            {days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`}
          </div>
        </div>
        <div className="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: cat.theme.accent }}>
                {p.name} · <MapPin className="h-3.5 w-3.5" /> {REGION_BY_ID[p.regionId].name}
              </div>
              <h3 className="mt-1 font-display text-[24px] leading-tight tracking-tight">{e.title}</h3>
            </div>
            <span className="rounded-full bg-sand-100 px-2.5 py-1 font-mono text-[12px] font-semibold">{b.ref}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-ink-2">
            <span className="inline-flex items-center gap-1.5">
              <CalendarCheck2 className="h-4 w-4 text-ink-3" /> {fmtDate(b.date, 'EEEE d MMMM')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-ink-3" /> {b.time ? fmtTime(b.time) : `${b.nights} night${(b.nights ?? 1) > 1 ? 's' : ''}`}
            </span>
            <span>
              {b.guests.adults + b.guests.children} guest{b.guests.adults + b.guests.children > 1 ? 's' : ''} · {aed(b.price.total)}
            </span>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setCheckIn(true)} icon={<KeyRound className="h-4 w-4" />}>
              Check in at the venue
            </Button>
            <Button size="sm" variant="outline" to={`/p/${p.slug}`}>
              Venue details
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCancel(true)}>
              Cancel
            </Button>
          </div>
        </div>
      </div>

      <Modal open={checkIn} onClose={() => setCheckIn(false)} className="sm:max-w-md">
        <div className="p-7">
          <div className="eyebrow">Host verification</div>
          <h3 className="mt-2 font-display text-[28px] leading-tight">Arrived at {p.name}?</h3>
          <p className="mt-2 text-[14px] text-ink-2">
            {p.hostName} confirms your visit by entering your check-in code (or you enter theirs). Verified visits earn your Passport stamp.
          </p>
          <div className="mt-5 rounded-2xl bg-sand-100 p-4 text-[13px] text-ink-2">
            <span className="font-semibold text-ink">Demo:</span> your code is <span className="font-mono text-[15px] font-bold tracking-widest text-ink">{b.checkInCode}</span>
          </div>
          <input
            inputMode="numeric"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="• • • •"
            className="input mt-4 text-center font-mono text-[26px] tracking-[0.6em]"
            aria-label="Check-in code"
          />
          <Button
            className="mt-4"
            block
            size="lg"
            disabled={code !== b.checkInCode}
            onClick={() => {
              setCheckIn(false);
              complete(b.ref);
            }}
          >
            Verify & complete visit
          </Button>
          <button className="mt-3 w-full text-center text-[12.5px] font-semibold text-ink-3 underline-offset-4 hover:underline" onClick={() => setCode(b.checkInCode)}>
            Fill demo code
          </button>
        </div>
      </Modal>

      <Modal open={cancel} onClose={() => setCancel(false)} className="sm:max-w-md">
        <div className="p-7">
          <h3 className="font-display text-[26px] leading-tight">Cancel this booking?</h3>
          <p className="mt-2 text-[14px] text-ink-2">{p.cancellation.summary}</p>
          <ul className="mt-2 space-y-1 text-[13px] text-ink-3">
            {p.cancellation.rules.map((r) => (
              <li key={r}>· {r}</li>
            ))}
          </ul>
          <div className="mt-6 flex gap-2">
            <Button variant="outline" onClick={() => setCancel(false)} block>
              Keep booking
            </Button>
            <Button
              variant="dark"
              block
              onClick={() => {
                cancelBooking(b.ref);
                setCancel(false);
                toast({ title: 'Booking cancelled', body: 'Spots released back to the host. Refund simulated.', tone: 'default' });
              }}
            >
              Cancel booking
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* --------------------------------- Orders --------------------------------- */

const ORDER_STEPS: Order['status'][] = ['placed', 'preparing', 'out_for_delivery', 'delivered'];

function Orders({ orders }: { orders: Order[] }) {
  const reorder = useApp((s) => s.reorder);
  const setCart = useUI((s) => s.setCartOpen);
  const pipeline = useApp((s) => s.host.pipeline);
  if (!orders.length) return <EmptyState icon={<Package className="h-6 w-6" />} title="No orders yet" body="Products from hosts you visit show up here — and can be reordered in one tap." />;
  return (
    <div className="space-y-4">
      {[...orders].reverse().map((o) => {
        const commission = o.lines.find((l) => PRODUCT_BY_ID[l.productId]?.kind === 'commission');
        const stage = (pipeline[o.ref] ?? (o.source === 'seed' ? 4 : 0)) as PipelineStage;
        return (
          <div key={o.ref} className="rounded-[26px] border border-line bg-white p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[12.5px] font-semibold text-ink-3">
                  {o.providerIds.map((id) => PROVIDER_BY_ID[id].name).join(', ')} · {fmtDate(o.createdAt.slice(0, 10), 'd MMM yyyy')}
                </div>
                <div className="mt-0.5 text-[16px] font-semibold">
                  {o.source === 'subscription' ? 'Subscription delivery' : 'Order'} <span className="font-mono text-[13px] text-ink-3">{o.ref}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {o.isReorder && <Badge tone="honey">Repeat purchase</Badge>}
                <span className="tabular text-[16px] font-semibold">{aed(o.total)}</span>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {o.lines.map((l) => {
                const p = PRODUCT_BY_ID[l.productId];
                return (
                  <div key={l.productId + (l.variantId ?? '')} className="flex items-center gap-3 rounded-2xl bg-sand-50 p-2 pr-4">
                    <SmartImage img={p.image} aspect={1} width={140} className="h-12 w-12 rounded-xl" category={p.categoryId} />
                    <div className="text-[13.5px]">
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-ink-3">
                        {l.qty} × {aed(l.unitPrice)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {commission ? (
              <div className="mt-5">
                <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-3">Studio progress</div>
                <div className="mt-2 flex items-center gap-1">
                  {KILN_STAGES.map((s, i) => (
                    <div key={s} className="flex-1">
                      <div className={cn('h-1.5 rounded-full', i <= stage ? 'bg-clay-500' : 'bg-sand-200')} />
                      <div className={cn('mt-1.5 hidden text-[11px] font-semibold sm:block', i === stage ? 'text-ink' : 'text-ink-4')}>{s}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[13px] text-ink-2 sm:hidden">Now: {KILN_STAGES[stage]}</div>
              </div>
            ) : (
              <div className="mt-5 flex items-center gap-1">
                {ORDER_STEPS.map((s, i) => {
                  const idx = ORDER_STEPS.indexOf(o.status);
                  return (
                    <div key={s} className="flex-1">
                      <div className={cn('h-1.5 rounded-full', i <= idx ? 'bg-oasis-500' : 'bg-sand-200')} />
                      <div className={cn('mt-1.5 text-[11px] font-semibold capitalize', i === idx ? 'text-ink' : 'text-ink-4')}>{s.replace(/_/g, ' ')}</div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={() => {
                  reorder(o.ref);
                  setCart(true);
                }}
              >
                Reorder
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------- Subscriptions ----------------------------- */

function Subscriptions({ subs }: { subs: Subscription[] }) {
  const setStatus = useApp((s) => s.setSubscriptionStatus);
  const setFreq = useApp((s) => s.setSubscriptionFrequency);
  const skip = useApp((s) => s.skipNextDelivery);
  const toast = useUI((s) => s.toast);
  if (!subs.length)
    return (
      <EmptyState
        icon={<Repeat className="h-6 w-6" />}
        title="No subscriptions yet"
        body="After a farm or apiary visit, subscribe to the produce or honey you loved — straight from the host’s shop."
        action={<Button to="/p/ghaf-grove-farmstay/shop">Visit Ghaf Grove’s shop</Button>}
      />
    );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {subs.map((s) => {
        const p = PRODUCT_BY_ID[s.productId];
        const prov = PROVIDER_BY_ID[s.providerId];
        return (
          <div key={s.id} className="rounded-[26px] border border-line bg-white p-5">
            <div className="flex items-center gap-4">
              <SmartImage img={p.image} aspect={1} width={200} className="h-20 w-20 shrink-0 rounded-2xl" category={p.categoryId} />
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold text-ink-3">{prov.name}</div>
                <div className="text-[17px] font-semibold">{p.name}</div>
                <div className="mt-1 flex items-center gap-2">
                  <Badge tone={s.status === 'active' ? 'success' : 'warning'}>{s.status === 'active' ? 'Active' : 'Paused'}</Badge>
                  <span className="text-[13px] text-ink-3">
                    {aed(s.price)} / {s.frequency === 'monthly' ? 'month' : s.frequency === 'weekly' ? 'week' : '2 weeks'}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-sand-50 p-3 text-center">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Next</div>
                <div className="text-[14px] font-semibold">{s.status === 'active' ? fmtDate(s.nextDelivery, 'EEE d MMM') : '—'}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Delivered</div>
                <div className="text-[14px] font-semibold">{s.deliveries}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-ink-3">To the host</div>
                <div className="text-[14px] font-semibold">{aed(s.deliveries * s.price)}</div>
              </div>
            </div>
            {p.subscription && p.subscription.frequencies.length > 1 && (
              <div className="mt-4 flex gap-1.5">
                {p.subscription.frequencies.map((f: Frequency) => (
                  <button key={f} onClick={() => setFreq(s.id, f)} className={cn('chip capitalize', s.frequency === f && 'chip-active')}>
                    {f}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                icon={<SkipForward className="h-4 w-4" />}
                onClick={() => {
                  skip(s.id);
                  toast({ title: 'Next delivery skipped', body: `${prov.hostName} has been told — nothing will be packed for you this cycle.` });
                }}
              >
                Skip next
              </Button>
              <Button
                size="sm"
                variant="outline"
                icon={s.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                onClick={() => setStatus(s.id, s.status === 'active' ? 'paused' : 'active')}
              >
                {s.status === 'active' ? 'Pause' : 'Resume'}
              </Button>
              <Button size="sm" variant="ghost" icon={<XCircle className="h-4 w-4" />} onClick={() => setStatus(s.id, 'cancelled')}>
                Cancel
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------- Vouchers -------------------------------- */

function Vouchers() {
  const vouchers = useMyVouchers();
  if (!vouchers.length) return null;
  return (
    <div className="pt-6">
      <h2 className="font-display text-[24px] tracking-tight">Prepaid experiences</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {vouchers.map((v) => {
          const o = PRESALE_BY_ID[v.offerId];
          return (
            <div key={v.id} className="flex items-center gap-4 rounded-[22px] border border-line bg-white p-4">
              <Ticket className="h-6 w-6 text-clay-500" />
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-semibold">{o.title}</div>
                <div className="text-[12.5px] text-ink-3">
                  Paid {aed(v.pricePaid)} · worth {aed(v.regularPrice)} · expires {fmtDate(v.expiresAt, 'd MMM yyyy')}
                </div>
              </div>
              {v.status === 'active' ? (
                <Button size="sm" to={`/book/${v.experienceId}`}>
                  Book
                </Button>
              ) : (
                <Badge tone="neutral">{v.status}</Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------- Rewards --------------------------------- */

function Rewards() {
  const stamps = useMyStamps();
  const bookings = useMyBookings();
  const used = useMyUsedRewards();
  const ledger = useApp((s) => s.usedRewards);
  const rewards = useMemo(() => unlockedRewards(stamps, bookings), [stamps, bookings]);
  if (!rewards.length) return <EmptyState icon={<Gift className="h-6 w-6" />} title="No rewards yet" body="Complete experiences to earn stamps and unlock host-funded rewards." action={<Button to="/passport">See challenges</Button>} />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rewards.map((r) => (
        <div key={r.id} className="rounded-[26px] border border-line bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="text-[16.5px] font-semibold">{r.title}</div>
            {used.includes(r.id) ? <Badge tone="neutral">Used</Badge> : <Badge tone="success">Available</Badge>}
          </div>
          <p className="mt-1.5 text-[14px] text-ink-2">{r.description}</p>
          <div className="mt-4 rounded-2xl bg-sand-50 p-3 text-[12.5px] text-ink-2">
            <div>
              <span className="font-semibold text-ink">Funded by:</span> {r.fundedBy.name} ({r.fundedBy.type === 'host' ? 'host-funded' : 'LocalDays-funded'})
            </div>
            <div className="mt-1">
              <span className="font-semibold text-ink">Budget:</span> {liveBudget(r, ledger).used.toLocaleString()} / {r.budget.cap.toLocaleString()} {r.budget.unit === 'AED' ? 'AED' : 'redemptions'} used
            </div>
            <ul className="mt-1.5 space-y-0.5">
              {r.rules.map((x) => (
                <li key={x}>· {x}</li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------- Saved --------------------------------- */

function Saved() {
  const saved = useMySaved();
  const providers = saved.map((id) => PROVIDER_BY_ID[id]).filter(Boolean);
  const exps = saved.map((id) => EXPERIENCE_BY_ID[id]).filter(Boolean);
  if (!providers.length && !exps.length) return <EmptyState icon={<Heart className="h-6 w-6" />} title="Nothing saved" body="Tap the heart on any host or experience to keep it here." />;
  return (
    <div className="space-y-10">
      {providers.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((p) => (
            <ProviderCard key={p.id} p={p} />
          ))}
        </div>
      )}
      {exps.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
          {exps.map((e) => (
            <ExperienceCard key={e.id} e={e} />
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Receipts --------------------------------- */

function Receipts({ bookings, orders }: { bookings: Booking[]; orders: Order[] }) {
  const rows = [
    ...bookings.map((b) => ({ ref: b.ref, date: b.createdAt.slice(0, 10), what: EXPERIENCE_BY_ID[b.experienceId].title, who: PROVIDER_BY_ID[b.providerId].name, total: b.price.total, vat: b.price.vatIncluded, status: b.status })),
    ...orders.map((o) => ({
      ref: o.ref,
      date: o.createdAt.slice(0, 10),
      what: o.lines.map((l) => PRODUCT_BY_ID[l.productId].name).join(', '),
      who: o.providerIds.map((id) => PROVIDER_BY_ID[id].name).join(', '),
      total: o.total,
      vat: o.total - o.total / 1.05,
      status: o.status,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="overflow-hidden rounded-[26px] border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line p-5">
        <div className="flex items-center gap-2 text-[16px] font-semibold">
          <Receipt className="h-4 w-4" /> Digital receipts
        </div>
        <Button size="sm" variant="outline" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
          Print
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[13.5px]">
          <thead className="bg-sand-50 text-[11.5px] font-bold uppercase tracking-[0.1em] text-ink-3">
            <tr>
              <th className="px-5 py-3">Reference</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Item</th>
              <th className="px-5 py-3">Host</th>
              <th className="px-5 py-3 text-right">VAT incl.</th>
              <th className="px-5 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.ref}>
                <td className="px-5 py-3 font-mono text-[12.5px]">{r.ref}</td>
                <td className="px-5 py-3">{fmtDate(r.date, 'd MMM yyyy')}</td>
                <td className="max-w-[260px] truncate px-5 py-3">{r.what}</td>
                <td className="px-5 py-3 text-ink-2">{r.who}</td>
                <td className="tabular px-5 py-3 text-right text-ink-3">{aed(r.vat, { decimals: true })}</td>
                <td className="tabular px-5 py-3 text-right font-semibold">
                  {aed(r.total)} {r.status === 'cancelled' && <span className="text-[11px] text-ink-3">(cancelled)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 border-t border-line p-4 text-[12.5px] text-ink-3">
        <CheckCircle2 className="h-4 w-4" /> Prices include 5% UAE VAT. Demo receipts — no real transactions.
      </div>
    </div>
  );
}
