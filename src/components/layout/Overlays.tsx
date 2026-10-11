import { motion } from 'framer-motion';
import { shortProviderName } from '@/lib/utils';
import { liveBudget } from '@/services/passport';
import { Mail, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/store/app';
import { useUI } from '@/store/ui';
import { CATEGORY_BY_ID } from '@/data/categories';
import { EXPERIENCE_BY_ID, PROVIDER_BY_ID } from '@/data/catalog';
import { REGION_BY_ID } from '@/data/regions';
import { REWARDS } from '@/data/passport';
import { fmtDate } from '@/lib/format';
import { Modal } from '../ui/overlays';
import { Button } from '../ui/Button';
import { Stamp } from '../passport/Stamp';
import { LogoMark } from '../brand/Logo';
import { DEMO_USER } from '@/store/seed';

/** Simulated sign-in: no passwords — demo account or magic-link style email. */
export function AuthModal() {
  const open = useUI((s) => s.authOpen);
  const setOpen = useUI((s) => s.setAuthOpen);
  const signIn = useApp((s) => s.signIn);
  const signInAs = useApp((s) => s.signInAs);
  const toast = useUI((s) => s.toast);
  const prefill = useUI((s) => s.authPrefill);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (open && prefill) {
      setName(prefill.name);
      setEmail(prefill.email);
    }
  }, [open, prefill]);

  const close = () => {
    setOpen(false);
    setSent(false);
  };

  return (
    <Modal open={open} onClose={close}>
      <div className="p-7 sm:p-9">
        <LogoMark className="h-12" />
        <h2 className="mt-5 font-display text-[30px] leading-tight tracking-tight">Welcome to Fadhal</h2>
        <p className="mt-2 text-[14.5px] text-ink-2">Save experiences, collect Passport stamps and reorder from the hosts you visit.</p>
        {!sent ? (
          <>
            <button
              onClick={() => {
                signIn();
                close();
                toast({ title: `Welcome back, ${DEMO_USER.firstName}`, body: 'Signed in with the demo customer account.', tone: 'success' });
              }}
              className="mt-6 flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-4 text-left shadow-ring transition hover:shadow-soft"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-oasis-500 font-display text-white">LH</span>
              <span className="flex-1">
                <span className="block text-[15px] font-semibold">Continue as {DEMO_USER.name}</span>
                <span className="block text-[12.5px] text-ink-3">Demo customer · Sharjah resident · 2 stamps</span>
              </span>
              <Sparkles className="h-4 w-4 text-clay-500" />
            </button>
            <div className="my-5 flex items-center gap-3 text-[12px] font-semibold uppercase tracking-wider text-ink-4">
              <span className="h-px flex-1 bg-line" /> or create an account <span className="h-px flex-1 bg-line" />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim() || !email.includes('@')) return;
                setSent(true);
              }}
              className="space-y-3"
            >
              <input className="input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              <input className="input" placeholder="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              <Button type="submit" block size="lg" variant="dark" icon={<Mail className="h-4 w-4" />}>
                Email me a sign-in link
              </Button>
              <p className="text-center text-[12px] text-ink-3">No passwords. In this demo, nothing is sent — the link is simulated.</p>
            </form>
          </>
        ) : (
          <div className="mt-6 rounded-2xl bg-white p-5 shadow-ring">
            <div className="text-[15px] font-semibold">Check your inbox (simulated)</div>
            <p className="mt-1 text-[13.5px] text-ink-2">We “sent” a sign-in link to {email}.</p>
            <Button
              className="mt-4"
              block
              onClick={() => {
                signInAs({ name: name.trim(), email: email.trim() });
                close();
                toast({ title: `Welcome, ${name.split(' ')[0]}`, body: 'Your Fadhal account is ready.', tone: 'success' });
              }}
            >
              Open the magic link
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Celebrates a newly earned, host-verified Passport stamp. */
export function StampCelebration() {
  const stamp = useApp((s) => s.lastStamp);
  const clear = useApp((s) => s.clearLastStamp);
  const ledger = useApp((s) => s.usedRewards);
  const owner = useApp((s) => (s.lastStamp ? s.bookings.find((b) => b.ref === s.lastStamp!.bookingRef)?.customer.email.toLowerCase() : undefined));
  const email = useApp((s) => s.user?.email.toLowerCase());
  const nav = useNavigate();
  // A host checking in someone else's booking shouldn't pop a celebration on this screen
  if (!stamp || !email || owner !== email) return null;
  const cat = CATEGORY_BY_ID[stamp.categoryId];
  const provider = PROVIDER_BY_ID[stamp.providerId];
  const exp = EXPERIENCE_BY_ID[stamp.experienceId];
  const reward = REWARDS.find((r) => r.unlock.type === 'stamp' && r.unlock.categoryId === stamp.categoryId);

  return (
    <Modal open onClose={clear} className="sm:max-w-md">
      <div className="relative overflow-hidden px-7 pb-8 pt-10 text-center">
        <div className="absolute inset-x-0 top-0 h-56" style={{ background: `radial-gradient(60% 70% at 50% 30%, ${cat.theme.accentSoft}, transparent 70%)` }} />
        <motion.div
          initial={{ scale: 2.4, rotate: -30, opacity: 0 }}
          animate={{ scale: 1, rotate: -8, opacity: 1 }}
          transition={{ type: 'spring', damping: 11, stiffness: 160, delay: 0.15 }}
          className="relative mx-auto flex w-fit justify-center"
        >
          <motion.div
            className="absolute inset-0 rounded-full"
            initial={{ scale: 0.6, opacity: 0.5 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.9, delay: 0.35 }}
            style={{ background: cat.theme.accent }}
          />
          <Stamp id={stamp.categoryId} size={190} date={fmtDate(stamp.earnedAt, 'd MMM yyyy')} region={REGION_BY_ID[stamp.regionId].name} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.6 }} className="relative">
          <div className="eyebrow mt-6" style={{ color: cat.theme.accent }}>
            Verified by {provider.hostName} · {provider.name}
          </div>
          <h3 className="mt-2 font-display text-[32px] leading-tight tracking-tight">You’re a {cat.stamp.title}</h3>
          <p className="mx-auto mt-2 max-w-xs text-[14.5px] text-ink-2">
            “{exp.title}” is now in your Fadhal Passport. {reward ? 'It also unlocked a reward:' : ''}
          </p>
          {reward && (
            <div className="mx-auto mt-4 max-w-sm rounded-2xl border border-line bg-white p-4 text-left shadow-ring">
              <div className="text-[14px] font-semibold">{reward.title}</div>
              <div className="mt-1 text-[12px] text-ink-3">
                Funded by {reward.fundedBy.name} · {liveBudget(reward, ledger).left} of {reward.budget.cap} {reward.budget.unit === 'AED' ? 'AED budget' : 'left this season'}
              </div>
            </div>
          )}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              variant="dark"
              onClick={() => {
                clear();
                nav('/passport');
              }}
            >
              Open my Passport
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                clear();
                nav(`/p/${provider.slug}/shop`);
              }}
            >
              Shop from {shortProviderName(provider.name)}
            </Button>
          </div>
        </motion.div>
      </div>
    </Modal>
  );
}
