import { AnimatePresence, motion } from 'framer-motion';
import { Check, CreditCard, Loader2, Lock, Repeat, ShoppingBag, Smartphone, Store, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { CartLine, useCartLines } from '@/components/layout/CartDrawer';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/overlays';
import { useApp } from '@/store/app';
import { useUI } from '@/store/ui';
import { cartTotals } from '@/services/cart';
import { aed } from '@/lib/format';
import { cn } from '@/lib/utils';

const METHODS = [
  { id: 'card', label: 'Visa •••• 4242', sub: 'Demo card on file', icon: CreditCard },
  { id: 'wallet', label: 'Mobile wallet', sub: 'Demo wallet', icon: Smartphone },
  { id: 'venue', label: 'Pay at the venue', sub: 'Experiences only · host collects', icon: Store },
] as const;

const STAGES = ['Re-checking live availability', 'Securing your payment', 'Notifying your hosts'];

export default function Checkout() {
  const lines = useCartLines();
  const totals = cartTotals(lines);
  const user = useApp((s) => s.user);
  const signOut = useApp((s) => s.signOut);
  const checkout = useApp((s) => s.checkout);
  const prune = useApp((s) => s.pruneExpiredHolds);
  const setAuth = useUI((s) => s.setAuthOpen);
  const toast = useUI((s) => s.toast);
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]['id']>('card');
  const [stage, setStage] = useState(-1);
  const onlyExperiences = lines.every((l) => l.type === 'experience');

  useEffect(() => {
    prune();
    const t = setInterval(prune, 5000);
    return () => clearInterval(t);
  }, [prune]);

  const customer = user
    ? { name: user.name, email: user.email, phone: user.phone, userId: user.id }
    : { name: name.trim(), email: email.trim(), phone: phone.trim() };
  const valid = !!customer.name && /.+@.+\..+/.test(customer.email) && lines.length > 0 && (method !== 'venue' || onlyExperiences);

  const place = async () => {
    if (!valid) return;
    for (let i = 0; i < STAGES.length; i++) {
      setStage(i);
      await new Promise((r) => setTimeout(r, 650));
    }
    const m = METHODS.find((x) => x.id === method)!;
    const label = method === 'card' && !user ? 'Card (demo)' : `${m.label} (demo)`;
    const result = checkout(customer, { method, label });
    setStage(STAGES.length);
    await new Promise((r) => setTimeout(r, 450));
    const ref = result.bookings[0]?.ref ?? result.order?.ref ?? result.vouchers[0]?.id ?? result.subscriptions[0]?.id;
    setStage(-1);
    if (!ref) {
      toast({ title: 'Nothing to confirm', tone: 'warning' });
      return;
    }
    nav(`/confirmation/${ref}`, { state: { result } });
  };

  if (lines.length === 0 && stage < 0) {
    return (
      <AppShell>
        <div className="shell py-20">
          <EmptyState
            icon={<ShoppingBag className="h-6 w-6" />}
            title="Your basket is empty"
            body="Held spots are released after 10 minutes. Pick an experience to start again."
            action={<Button to="/experiences" variant="dark">Explore experiences</Button>}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell footer={false} tabBar={false}>
      <div className="shell grid gap-10 py-8 pb-32 md:py-12 lg:grid-cols-[1fr_440px] lg:gap-14">
        <div>
          <div className="eyebrow">Checkout</div>
          <h1 className="mt-3 font-display text-[40px] leading-tight tracking-tight">Almost there.</h1>

          {/* Contact */}
          <section className="mt-8 rounded-[26px] border border-line bg-white p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[17px] font-semibold">Your details</h2>
              {user ? (
                <button onClick={signOut} className="text-[13px] font-semibold text-ink-3 underline-offset-4 hover:text-ink hover:underline">
                  Not you? Check out as a guest
                </button>
              ) : (
                <button onClick={() => setAuth(true)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-clay-600">
                  <UserRound className="h-4 w-4" /> Sign in for faster checkout
                </button>
              )}
            </div>
            {user ? (
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-sand-50 p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-oasis-500 font-display text-white">
                  {user.name
                    .split(' ')
                    .map((p) => p[0])
                    .join('')}
                </span>
                <div>
                  <div className="text-[15px] font-semibold">{user.name}</div>
                  <div className="text-[13px] text-ink-3">
                    {user.email} · stamps and receipts go to My LocalDays
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input className="input sm:col-span-2" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                <input className="input" placeholder="Email for your confirmation" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                <input className="input" placeholder="Mobile (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
                <p className="text-[12.5px] text-ink-3 sm:col-span-2">Guest checkout — no account needed. Passport stamps need an account, which you can create after booking.</p>
              </div>
            )}
          </section>

          {/* Payment */}
          <section className="mt-5 rounded-[26px] border border-line bg-white p-5 md:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold">Payment</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11.5px] font-semibold text-amber-800 ring-1 ring-amber-100">
                Simulated — no real charge
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {METHODS.map((m0) => {
                // Guests have no saved card — show a plain simulated card option instead
                const m = m0.id === 'card' && !user ? { ...m0, label: 'Card', sub: 'Simulated card payment' } : m0;
                const disabled = m.id === 'venue' && !onlyExperiences;
                return (
                  <button
                    key={m.id}
                    disabled={disabled}
                    onClick={() => setMethod(m.id)}
                    className={cn(
                      'relative flex flex-col items-start gap-3 rounded-2xl border p-4 text-left transition',
                      method === m.id ? 'border-ink shadow-ring' : 'border-line hover:border-ink/30',
                      disabled && 'opacity-40',
                    )}
                  >
                    <m.icon className="h-5 w-5" />
                    <span>
                      <span className="block text-[14.5px] font-semibold">{m.label}</span>
                      <span className="block text-[12px] text-ink-3">{m.sub}</span>
                    </span>
                    {method === m.id && (
                      <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-white">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex items-center gap-2 text-[12.5px] text-ink-3">
              <Lock className="h-3.5 w-3.5" /> In production, payments are processed by a licensed UAE payment provider; LocalDays never stores card numbers.
            </div>
          </section>

          {totals.recurring.length > 0 && (
            <section className="mt-5 flex gap-3 rounded-[26px] border border-honey-200 bg-honey-100/50 p-5">
              <Repeat className="mt-0.5 h-5 w-5 shrink-0 text-honey-700" />
              <div className="text-[14px] text-honey-700">
                <div className="font-semibold">Subscription terms</div>
                Your first delivery is charged today. After that you’re charged each{' '}
                {totals.recurring.map((r) => r.recurring).join(' / ')} cycle before packing. Skip, pause or cancel anytime from My LocalDays — the host is told immediately.
              </div>
            </section>
          )}
        </div>

        {/* Summary */}
        <aside>
          <div className="sticky top-[96px] rounded-[28px] border border-line bg-white p-5 shadow-lift md:p-6">
            <h2 className="font-display text-[22px] tracking-tight">Summary</h2>
            <div className="mt-2 divide-y divide-line">
              {lines.map((l) => (
                <CartLine key={l.id} line={l} compact />
              ))}
            </div>
            <div className="mt-2 space-y-1.5 border-t border-line pt-4 text-[14px]">
              {totals.savings > 0 && (
                <div className="flex justify-between text-oasis-600">
                  <span>You save</span>
                  <span className="tabular">{aed(totals.savings)}</span>
                </div>
              )}
              <div className="flex justify-between text-ink-2">
                <span>Booking fees</span>
                <span>None</span>
              </div>
              <div className="flex justify-between text-ink-2">
                <span>VAT included</span>
                <span className="tabular">{aed(totals.vat, { decimals: true })}</span>
              </div>
            </div>
            <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
              <span className="text-[15px] font-semibold">Pay today</span>
              <span className="tabular font-display text-[32px]">{aed(totals.total)}</span>
            </div>
            <Button className="mt-5" block size="xl" disabled={!valid || stage >= 0} onClick={place} icon={<Lock className="h-4 w-4" />}>
              {method === 'venue' ? 'Confirm booking' : `Pay ${aed(totals.total)}`}
            </Button>
            {!valid && lines.length > 0 && <p className="mt-2 text-center text-[12.5px] text-ink-3">Add your name and email to continue.</p>}
          </div>
        </aside>
      </div>

      {/* Mobile pay bar — the summary sits far below the form on phones */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-ink-3">{lines.length} item{lines.length === 1 ? '' : 's'} · VAT incl.</div>
            <div className="tabular text-[17px] font-semibold">{aed(totals.total)}</div>
          </div>
          <Button disabled={!valid || stage >= 0} onClick={place} icon={<Lock className="h-4 w-4" />}>
            {method === 'venue' ? 'Confirm' : `Pay ${aed(totals.total)}`}
          </Button>
        </div>
        {!valid && lines.length > 0 && <p className="mt-1.5 text-[11.5px] text-ink-3">Add your name and email above to continue.</p>}
      </div>

      <Modal open={stage >= 0} onClose={() => {}} dismissable={false} className="sm:max-w-sm">
        <div className="p-8">
          <div className="font-display text-[24px]">Confirming your day</div>
          <ul className="mt-6 space-y-4">
            {STAGES.map((s, i) => (
              <li key={s} className="flex items-center gap-3 text-[15px]">
                <span className={cn('flex h-7 w-7 items-center justify-center rounded-full', i < stage ? 'bg-oasis-500 text-white' : i === stage ? 'bg-ink text-white' : 'bg-sand-100 text-ink-4')}>
                  {i < stage ? <Check className="h-4 w-4" /> : i === stage ? <Loader2 className="h-4 w-4 animate-spin" /> : i + 1}
                </span>
                <span className={i <= stage ? 'text-ink' : 'text-ink-4'}>{s}</span>
              </li>
            ))}
          </ul>
          <AnimatePresence>
            {stage >= STAGES.length && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-2xl bg-oasis-50 p-3 text-center text-[14px] font-semibold text-oasis-700">
                Confirmed
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Modal>
    </AppShell>
  );
}
