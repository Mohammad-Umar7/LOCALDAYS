import { motion } from 'framer-motion';
import { ArrowRight, BadgeCheck, Check, Gift, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Stamp } from '@/components/passport/Stamp';
import { LogoMark } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { Badge, SectionHeader } from '@/components/ui/primitives';
import { BRAND } from '@/config/brand';
import { CATEGORIES } from '@/data/categories';
import { PROVIDER_BY_ID } from '@/data/catalog';
import { REGION_BY_ID } from '@/data/regions';
import { REWARDS, REWARD_BY_ID } from '@/data/passport';
import { useApp, useMyStamps, useMyBookings } from '@/store/app';
import { useUI } from '@/store/ui';
import { evaluateChallenges, unlockedRewards, liveBudget } from '@/services/passport';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function Passport() {
  const user = useApp((s) => s.user);
  const stamps = useMyStamps();
  const ledger = useApp((s) => s.usedRewards);
  const bookings = useMyBookings();
  const setAuth = useUI((s) => s.setAuthOpen);
  const [open, setOpen] = useState(false);
  const challenges = useMemo(() => evaluateChallenges(stamps, bookings), [stamps, bookings]);
  const unlocked = useMemo(() => new Set(unlockedRewards(stamps, bookings).map((r) => r.id)), [stamps, bookings]);
  const regions = new Set(stamps.map((s) => s.regionId));
  const byCat = new Map(stamps.map((s) => [s.categoryId, s]));

  return (
    <AppShell>
      <section className="relative overflow-hidden bg-oasis-950 text-paper">
        <div className="pattern-girih-light absolute inset-0 opacity-60" />
        <div className="absolute left-1/2 top-0 h-[480px] w-[780px] -translate-x-1/2 rounded-full bg-honey-400/10 blur-[120px]" />
        <div className="shell relative py-14 md:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <div className="eyebrow text-honey-300/80">{BRAND.passportName}</div>
            <h1 className="display-lg mt-4 text-balance">
              A journal of <span className="serif-italic text-honey-300">things you actually did</span>.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-[16px] text-paper/65">
              Stamps are issued only when a host verifies your visit. No points for scrolling, no streaks — just the traditions you’ve lived.
            </p>
          </div>

          {/* The book */}
          <div className="mx-auto mt-12 max-w-[980px]" style={{ perspective: 2200 }}>
            <div className="relative mx-auto grid md:grid-cols-2">
              {/* Left page: identity */}
              <div className="relative overflow-hidden rounded-t-[22px] bg-[#F3EAD8] p-7 text-ink shadow-lift md:rounded-l-[22px] md:rounded-tr-none">
                <div className="pattern-girih absolute inset-0 opacity-50" />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink-3">Identity page</div>
                    <LogoMark className="h-7 w-7" />
                  </div>
                  {user ? (
                    <>
                      <div className="mt-6 flex items-center gap-4">
                        <div className="flex h-24 w-20 items-center justify-center rounded-xl bg-oasis-600 font-display text-[30px] text-paper shadow-inner">
                          {user.name
                            .split(' ')
                            .map((p) => p[0])
                            .join('')}
                        </div>
                        <div className="font-mono text-[12px] leading-relaxed text-ink-2">
                          <div>
                            <span className="text-ink-3">HOLDER</span> {user.name.toUpperCase()}
                          </div>
                          <div>
                            <span className="text-ink-3">STATUS</span> {user.kind === 'resident' ? 'RESIDENT' : 'VISITOR'} · {user.city.toUpperCase()}
                          </div>
                          <div>
                            <span className="text-ink-3">SINCE</span> {user.since}
                          </div>
                          <div>
                            <span className="text-ink-3">NO.</span> LD-{user.id.slice(-4).toUpperCase()}-SHJ
                          </div>
                        </div>
                      </div>
                      <div className="mt-8 grid grid-cols-3 gap-3 text-center">
                        {[
                          { l: 'Stamps', v: `${stamps.length}/5` },
                          { l: regions.size === 1 ? 'Region' : 'Regions', v: regions.size },
                          { l: 'Challenges done', v: challenges.filter((c) => c.complete).length },
                        ].map((x) => (
                          <div key={x.l} className="rounded-xl bg-white/60 py-3">
                            <div className="font-display text-[26px] leading-none">{x.v}</div>
                            <div className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-3">{x.l}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-6 font-mono text-[10px] leading-tight tracking-[0.1em] text-ink-3/80">
                        P&lt;SHJ{user.name.toUpperCase().replace(/\s+/g, '<')}&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;
                        <br />
                        LD{stamps.length}SHJ{new Date().getFullYear()}&lt;&lt;LIVEIT&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;
                      </div>
                    </>
                  ) : (
                    <div className="mt-10 text-center">
                      <p className="text-[14.5px] text-ink-2">Sign in to open your Passport.</p>
                      <Button className="mt-4" onClick={() => setAuth(true)}>
                        Sign in
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right page: stamps (with an opening cover on desktop) */}
              <div className="relative overflow-hidden rounded-b-[22px] bg-[#F6EEDD] p-6 text-ink shadow-lift md:rounded-r-[22px] md:rounded-bl-none md:border-l md:border-dashed md:border-[#D8C6A4]">
                <div className="pattern-girih absolute inset-0 opacity-50" />
                <div className="relative grid grid-cols-2 place-items-center gap-y-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3">
                  {CATEGORIES.map((c, i) => {
                    const st = byCat.get(c.id);
                    return (
                      <motion.div
                        key={c.id}
                        initial={{ opacity: 0, scale: 1.4, rotate: -20 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        transition={{ delay: 0.6 + i * 0.12, type: 'spring', damping: 14 }}
                        className="flex flex-col items-center"
                      >
                        <Stamp
                          id={c.id}
                          earned={!!st}
                          size={st ? 128 : 112}
                          rotate={[-8, 6, -4, 9, -11][i]}
                          date={st ? fmtDate(st.earnedAt, 'd MMM yy') : undefined}
                          region={st ? REGION_BY_ID[st.regionId].name : undefined}
                        />
                        <div className="mt-1 text-center">
                          <div className={cn('text-[12.5px] font-semibold', st ? 'text-ink' : 'text-ink-4')}>{c.stamp.title}</div>
                          <div className="text-[11px] text-ink-3">{st ? PROVIDER_BY_ID[st.providerId].name : <Link to={`/c/${c.id}`} className="underline-offset-2 hover:underline">How to earn →</Link>}</div>
                        </div>
                      </motion.div>
                    );
                  })}
                  <div className="flex h-full flex-col items-center justify-center p-3 text-center">
                    <Sparkles className="h-5 w-5 text-ink-3" />
                    <div className="mt-2 text-[12px] text-ink-3">More traditions coming: heritage sites, nature reserves, cultural centres.</div>
                  </div>
                </div>
              </div>

              {/* Cover */}
              <motion.button
                aria-label={open ? 'Close passport cover' : 'Open passport'}
                onClick={() => setOpen(true)}
                initial={false}
                animate={{ rotateY: open ? -178 : 0 }}
                transition={{ duration: 1.3, ease: [0.65, 0, 0.35, 1] }}
                style={{ transformOrigin: 'left center', transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
                className={cn(
                  'absolute inset-y-0 right-0 hidden w-1/2 overflow-hidden rounded-r-[22px] bg-[#1F3A2C] text-left shadow-float md:block',
                  open && 'pointer-events-none',
                )}
              >
                <div className="pattern-girih-light absolute inset-0 opacity-70" />
                <div className="absolute inset-3 rounded-[16px] border border-brass-400/40" />
                <div className="relative flex h-full flex-col items-center justify-center text-center">
                  <div className="font-arabic text-[30px] text-brass-300/90">{BRAND.nameArabic}</div>
                  <div className="mt-6 flex h-20 w-20 items-center justify-center rounded-full border border-brass-400/60">
                    <svg viewBox="0 0 64 64" className="h-12 w-12" aria-hidden>
                      <path d="M19 49V30.5C19 23.04 24.82 17 32 17s13 6.04 13 13.5V49" fill="none" stroke="#E2C893" strokeWidth="3" strokeLinecap="round" />
                      <path d="M24.5 42.5a7.5 7.5 0 0 1 15 0z" fill="#E2C893" />
                      <path d="M14 49h36" stroke="#E2C893" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="mt-6 text-[13px] font-bold uppercase tracking-[0.4em] text-brass-300">Passport</div>
                  <div className="mt-1 font-display text-[22px] text-paper">{BRAND.name}</div>
                  <div className="mt-8 rounded-full border border-brass-400/50 px-4 py-2 text-[12px] font-semibold text-brass-300">Tap to open</div>
                </div>
              </motion.button>
            </div>
          </div>
        </div>
      </section>

      {/* Challenges */}
      <section className="shell py-16 md:py-20">
        <SectionHeader eyebrow="Optional challenges" title="Explore more of Sharjah, unlock real value." description="Every reward names who funds it and how many are left — so no small host is ever surprised by a cost." />
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {challenges.map(({ challenge, progress, target, complete }) => {
            const reward = REWARD_BY_ID[challenge.rewardId];
            return (
              <div key={challenge.id} className={cn('rounded-[26px] border bg-white p-6', complete ? 'border-oasis-300' : 'border-line')}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-display text-[22px] tracking-tight">{challenge.title}</div>
                    <div className="mt-1 text-[14px] text-ink-2">{challenge.description}</div>
                  </div>
                  {complete ? (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-oasis-500 text-white">
                      <Check className="h-4 w-4" />
                    </span>
                  ) : (
                    <span className="tabular rounded-full bg-sand-100 px-3 py-1 text-[13px] font-semibold">
                      {progress}/{target}
                    </span>
                  )}
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-sand-100">
                  <motion.div initial={{ width: 0 }} whileInView={{ width: `${(progress / target) * 100}%` }} viewport={{ once: true }} transition={{ duration: 1, ease: 'easeOut' }} className={cn('h-full rounded-full', complete ? 'bg-oasis-500' : 'bg-clay-500')} />
                </div>
                <div className="mt-4 flex items-start gap-3 rounded-2xl bg-sand-50 p-3.5">
                  <Gift className="mt-0.5 h-4 w-4 shrink-0 text-clay-600" />
                  <div className="text-[13px]">
                    <div className="font-semibold">{reward.title}</div>
                    <div className="text-ink-3">
                      Funded by {reward.fundedBy.name} · {reward.budget.unit === 'AED' ? `AED ${liveBudget(reward, ledger).left.toLocaleString()} budget left` : `${liveBudget(reward, ledger).left} left this season`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Stamp rewards */}
      <section className="bg-sand-100 py-16 md:py-20">
        <div className="shell">
          <SectionHeader eyebrow="Stamp rewards" title="Each stamp unlocks something from the host who earned it." />
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {REWARDS.filter((r) => r.unlock.type === 'stamp').map((r) => {
              const has = unlocked.has(r.id);
              return (
                <div key={r.id} className={cn('relative rounded-[24px] border bg-white p-5', has ? 'border-oasis-300' : 'border-line')}>
                  <div className="flex items-center justify-between">
                    <Badge tone={has ? 'success' : 'neutral'} icon={has ? <BadgeCheck className="h-3 w-3" /> : <Lock className="h-3 w-3" />}>
                      {has ? 'Unlocked' : 'Locked'}
                    </Badge>
                    <span className="text-[12px] text-ink-3">{r.fundedBy.type === 'host' ? 'Host-funded' : 'LocalDays-funded'}</span>
                  </div>
                  <div className="mt-3 text-[16px] font-semibold">{r.title}</div>
                  <p className="mt-1 text-[13.5px] text-ink-2">{r.description}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sand-100">
                    <div className="h-full rounded-full bg-honey-400" style={{ width: `${(liveBudget(r, ledger).used / r.budget.cap) * 100}%` }} />
                  </div>
                  <div className="mt-1 text-[11.5px] text-ink-3">
                    {liveBudget(r, ledger).used.toLocaleString()}/{r.budget.cap.toLocaleString()} {r.budget.unit === 'AED' ? 'AED' : 'redeemed'} · cap set by {r.fundedBy.name}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { t: 'Verified, not clicked', d: 'Stamps are issued only after host check-in with your booking code.' },
              { t: 'Funded and capped', d: 'Every reward lists its funder and a hard budget. Platform rewards never come out of a host’s pocket.' },
              { t: 'No public leaderboard', d: 'Your Passport is personal. It encourages exploring new traditions, not competing.' },
            ].map((x) => (
              <div key={x.t} className="flex gap-3 rounded-2xl bg-white p-5 shadow-ring">
                <ShieldCheck className="h-5 w-5 shrink-0 text-oasis-500" />
                <div>
                  <div className="text-[14.5px] font-semibold">{x.t}</div>
                  <div className="mt-1 text-[13.5px] text-ink-2">{x.d}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 flex justify-center">
            <Button to="/experiences" variant="dark" iconRight={<ArrowRight className="h-4 w-4" />}>
              Find your next stamp
            </Button>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
