import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, CheckCircle2, ChevronRight, Play, RotateCcw, Stamp as StampIcon, UserRound, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp, useTodayISO } from '@/store/app';
import { useUI } from '@/store/ui';
import { EXPERIENCE_BY_ID } from '@/data/catalog';
import { aed, fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export const PITCH_STEPS = [
  { to: '/', title: 'Discover', body: 'Five traditions, one promise: Live it.' },
  { to: '/c/farm', title: 'Explore farms', body: 'Live availability and filters.' },
  { to: '/p/ghaf-grove-farmstay', title: 'Step inside Ghaf Grove', body: 'Interactive 3D preview with real hotspots.' },
  { to: '/book/ghaf-family', title: 'Book the Family Farm Day', body: 'AED 450 · hold, price, pay.' },
  { to: '/me', title: 'Complete the visit', body: 'Host check-in → Farm Explorer stamp.' },
  { to: '/p/ghaf-grove-farmstay/shop', title: 'Subscribe to the farm', body: 'Weekly AED 120 produce box.' },
  { to: '/host', title: 'The farmer’s view', body: 'Bookings, subscribers, net earnings.' },
  { to: '/host/intelligence', title: 'Harvest Intelligence', body: '30 kg forecast vs 35 kg demand.' },
  { to: '/impact', title: 'Business model', body: 'Visit → Purchase → Subscribe → Repeat.' },
];

export function DemoConsole() {
  const open = useUI((s) => s.demoOpen);
  const setOpen = useUI((s) => s.setDemoOpen);
  const toast = useUI((s) => s.toast);
  const today = useTodayISO();
  const offset = useApp((s) => s.dayOffset);
  const user = useApp((s) => s.user);
  const signIn = useApp((s) => s.signIn);
  const signOut = useApp((s) => s.signOut);
  const advance = useApp((s) => s.advanceDays);
  const reset = useApp((s) => s.resetDemo);
  const bookings = useApp((s) => s.bookings);
  const complete = useApp((s) => s.completeBooking);
  const subs = useApp((s) => s.subscriptions.filter((x) => x.status === 'active').length);

  const confirmed = [...bookings].filter((b) => b.status === 'confirmed').sort((a, b) => a.date.localeCompare(b.date));
  const mine = user ? confirmed.filter((b) => b.customer.email.toLowerCase() === user.email.toLowerCase()) : [];
  // Only the signed-in customer's own visits — other (seeded) guests are checked in from the host dashboard
  const next = mine[0];

  const travel = (n: number) => {
    const r = advance(n);
    toast({
      title: `Jumped ${n === 1 ? 'a day' : n === 7 ? 'a week' : `${n / 7} weeks`} ahead`,
      body: r.deliveries ? `${r.deliveries} subscription deliver${r.deliveries > 1 ? 'ies' : 'y'} fulfilled · ${aed(r.revenue)} recurring sales` : 'No subscription deliveries were due.',
      tone: r.deliveries ? 'success' : 'default',
      action: r.deliveries ? { label: 'See it in the host dashboard', to: '/host' } : undefined,
    });
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed left-4 right-4 top-[72px] z-[60] max-h-[75vh] overflow-y-auto rounded-3xl border border-white/10 bg-ink p-5 text-paper shadow-float sm:left-auto sm:w-[380px] md:right-6 md:top-[80px]"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="eyebrow text-paper/45">Pitch controls</div>
                <div className="mt-1 font-display text-[22px] leading-tight">Demo console</div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1.5 text-paper/60 hover:bg-white/10 hover:text-paper">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-white/5 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-paper/45">
                  <CalendarClock className="h-3.5 w-3.5" /> Demo date
                </div>
                <div className="mt-1 text-[15px] font-semibold">{fmtDate(today, 'EEE d MMM')}</div>
                <div className="text-[11px] text-paper/45">{offset ? `+${offset} days` : 'Real today'}</div>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-paper/45">
                  <UserRound className="h-3.5 w-3.5" /> Persona
                </div>
                <div className="mt-1 text-[15px] font-semibold">{user ? user.name : 'Guest'}</div>
                <button onClick={() => (user ? signOut() : signIn())} className="text-[11px] font-semibold text-honey-300">
                  {user ? 'Switch to guest checkout' : 'Sign in as demo customer'}
                </button>
              </div>
            </div>

            <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-paper/45">Time travel</div>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {[1, 7, 28].map((n) => (
                <button key={n} onClick={() => travel(n)} className="rounded-xl bg-white/10 py-2 text-[13px] font-semibold hover:bg-white/15">
                  +{n === 1 ? '1 day' : n === 7 ? '1 week' : '4 weeks'}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11.5px] text-paper/45">{subs} active subscription{subs === 1 ? '' : 's'} — deliveries and revenue process as time passes.</p>

            <button
              disabled={!next}
              onClick={() => {
                if (!next) return;
                const st = complete(next.ref);
                toast({
                  title: st ? 'Experience verified by host' : 'Experience completed',
                  body: `${EXPERIENCE_BY_ID[next.experienceId].title}`,
                  tone: 'success',
                  action: { label: 'Open your Passport', to: '/passport' },
                });
              }}
              className={cn('mt-3 flex w-full items-center gap-3 rounded-2xl p-3 text-left transition', next ? 'bg-clay-500 hover:bg-clay-600' : 'bg-white/5 opacity-50')}
            >
              <StampIcon className="h-5 w-5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold">Host check-in: complete next experience</span>
                <span className="block truncate text-[11.5px] text-white/70">
                  {next ? `${EXPERIENCE_BY_ID[next.experienceId].title} · ${fmtDate(next.date)}` : user ? 'Book something first' : 'Sign in, then book something'}
                </span>
              </span>
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            </button>

            <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-paper/45">
              <Play className="h-3.5 w-3.5" /> Guided pitch route
            </div>
            <ol className="mt-2 space-y-1">
              {PITCH_STEPS.map((s, i) => (
                <li key={s.to + i}>
                  <Link to={s.to} onClick={() => setOpen(false)} className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold">{s.title}</span>
                      <span className="block truncate text-[11.5px] text-paper/45">{s.body}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-paper/30 transition group-hover:translate-x-0.5 group-hover:text-paper/70" />
                  </Link>
                </li>
              ))}
            </ol>

            <button
              onClick={() => {
                reset();
                toast({ title: 'Demo data reset', body: 'Back to a fresh start for the pitch.', tone: 'default' });
              }}
              className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-paper/50 hover:text-paper"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset demo data
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
