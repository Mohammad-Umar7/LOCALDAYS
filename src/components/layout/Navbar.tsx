import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, BookOpen, ChevronDown, FlaskConical, LayoutDashboard, LogOut, Menu, ShoppingBag, Sparkles, Ticket, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { CATEGORIES } from '@/data/categories';
import { providersByCategory, startingPrice } from '@/data/catalog';
import { useApp } from '@/store/app';
import { useUI } from '@/store/ui';
import { cn } from '@/lib/utils';
import { aed } from '@/lib/format';
import { Logo } from '../brand/Logo';
import { CategoryIcon } from '../brand/CategoryIcon';
import { SmartImage } from '../ui/SmartImage';
import { Avatar } from '../ui/primitives';
import { Sheet } from '../ui/overlays';

const LINKS = [
  { to: '/compose', label: 'Day Composer', ai: true },
  { to: '/passport', label: 'Passport' },
  { to: '/hosts', label: 'For hosts' },
  { to: '/impact', label: 'Impact' },
];

export function Navbar({ overlay = false }: { overlay?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [mega, setMega] = useState(false);
  const [menu, setMenu] = useState(false);
  const [account, setAccount] = useState(false);
  const loc = useLocation();
  const cartCount = useApp((s) => s.cart.length);
  const user = useApp((s) => s.user);
  const signOut = useApp((s) => s.signOut);
  const setCartOpen = useUI((s) => s.setCartOpen);
  const setAuthOpen = useUI((s) => s.setAuthOpen);
  const demoOpen = useUI((s) => s.demoOpen);
  const setDemo = useUI((s) => s.setDemoOpen);
  const closeTimer = useRef<number>();

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  useEffect(() => {
    setMega(false);
    setMenu(false);
    setAccount(false);
  }, [loc.pathname]);

  const light = overlay && !scrolled && !mega;

  const openMega = () => {
    window.clearTimeout(closeTimer.current);
    setMega(true);
  };
  const closeMega = () => {
    closeTimer.current = window.setTimeout(() => setMega(false), 160);
  };

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-[background,box-shadow,color] duration-500',
          light ? 'bg-transparent' : 'border-b border-line/70 bg-paper/85 shadow-[0_1px_0_rgba(26,22,18,0.02)] backdrop-blur-xl',
        )}
      >
        <div className="shell flex h-[64px] items-center justify-between gap-4 md:h-[72px]">
          <div className="flex min-w-0 items-center gap-4 xl:gap-8">
            <Link to="/" aria-label="LocalDays home" className="shrink-0">
              <Logo dark={light} />
            </Link>
            <nav className="hidden items-center gap-0.5 lg:flex xl:gap-1">
              <button
                onMouseEnter={openMega}
                onMouseLeave={closeMega}
                onClick={() => setMega((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-2 text-[13.5px] font-semibold transition-colors xl:px-3.5 xl:text-[14px]',
                  light ? 'text-white/90 hover:bg-white/10' : 'text-ink-2 hover:bg-ink/5 hover:text-ink',
                )}
                aria-expanded={mega}
              >
                Experiences <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', mega && 'rotate-180')} />
              </button>
              {LINKS.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) =>
                    cn(
                      'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-2 text-[13.5px] font-semibold transition-colors xl:px-3.5 xl:text-[14px]',
                      light ? 'text-white/90 hover:bg-white/10' : isActive ? 'bg-ink/5 text-ink' : 'text-ink-2 hover:bg-ink/5 hover:text-ink',
                    )
                  }
                >
                  {l.ai && <Sparkles className={cn('h-3.5 w-3.5', light ? 'text-honey-300' : 'text-clay-500')} />}
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDemo(!demoOpen)}
              aria-expanded={demoOpen}
              className={cn(
                'hidden items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] transition md:inline-flex',
                light ? 'border-white/40 text-white/75 hover:border-white/70 hover:text-white' : 'border-ink/25 text-ink-3 hover:border-ink/50 hover:text-ink',
                demoOpen && (light ? 'border-white/70 bg-white/10 text-white' : 'border-ink/50 bg-ink/5 text-ink'),
              )}
              title="Demo build — all data is fictional. Open the demo console."
            >
              <FlaskConical className="h-3 w-3" /> <span className="lg:hidden xl:inline">Demo</span>
            </button>
            <button
              onClick={() => setCartOpen(true)}
              aria-label={`Basket, ${cartCount} items`}
              className={cn(
                'relative flex h-10 w-10 items-center justify-center rounded-full transition',
                light ? 'text-white hover:bg-white/10' : 'text-ink hover:bg-ink/5',
              )}
            >
              <ShoppingBag className="h-[19px] w-[19px]" />
              {cartCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-clay-500 px-1 text-[10px] font-bold text-white ring-2 ring-paper">
                  {cartCount}
                </span>
              )}
            </button>
            {user ? (
              <div className="relative hidden md:block">
                <button
                  onClick={() => setAccount((v) => !v)}
                  className={cn(
                    'flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition',
                    light ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white text-ink shadow-ring hover:shadow-soft',
                  )}
                >
                  <Avatar initials={user.name.split(' ').map((p) => p[0]).join('').slice(0, 2)} size={30} color="#365E47" />
                  <span className="text-[13px] font-semibold">{user.firstName}</span>
                </button>
                <AnimatePresence>
                  {account && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.98 }}
                      transition={{ duration: 0.18 }}
                      className="absolute right-0 top-12 w-60 overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-lift"
                    >
                      <MenuLink to="/me" icon={<Ticket className="h-4 w-4" />} label="My LocalDays" />
                      <MenuLink to="/passport" icon={<BookOpen className="h-4 w-4" />} label="Passport" />
                      <MenuLink to="/host" icon={<LayoutDashboard className="h-4 w-4" />} label="Host dashboard (demo)" />
                      <div className="my-1 h-px bg-line" />
                      <button
                        onClick={() => {
                          signOut();
                          setAccount(false);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[14px] font-medium text-ink-2 hover:bg-sand-50"
                      >
                        <LogOut className="h-4 w-4" /> Sign out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className={cn(
                  'hidden items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition md:inline-flex',
                  light ? 'bg-white text-ink hover:bg-white/90' : 'bg-ink text-paper hover:bg-ink/90',
                )}
              >
                <UserRound className="h-4 w-4" /> Sign in
              </button>
            )}
            <button
              onClick={() => setDemo(!demoOpen)}
              aria-label="Demo console"
              className={cn('flex h-10 w-10 items-center justify-center rounded-full md:hidden', light ? 'text-honey-300' : 'text-clay-600')}
            >
              <FlaskConical className="h-[18px] w-[18px]" />
            </button>
            <button
              onClick={() => setMenu(true)}
              aria-label="Open menu"
              className={cn('flex h-10 w-10 items-center justify-center rounded-full lg:hidden', light ? 'text-white' : 'text-ink')}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Mega menu */}
        <AnimatePresence>
          {mega && (
            <motion.div
              onMouseEnter={openMega}
              onMouseLeave={closeMega}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-x-0 top-full hidden border-b border-line bg-paper/95 shadow-lift backdrop-blur-xl lg:block"
            >
              <div className="shell grid grid-cols-6 gap-4 py-6">
                {CATEGORIES.map((c) => {
                  const hosts = providersByCategory(c.id);
                  const from = Math.min(...hosts.map((h) => startingPrice(h.id)));
                  return (
                    <Link key={c.id} to={`/c/${c.id}`} className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-ring transition hover:shadow-soft">
                      <SmartImage img={c.image} aspect={4 / 3} width={420} className="aspect-[4/3]" category={c.id} zoom />
                      <div className="p-3.5">
                        <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                          <span style={{ color: c.theme.accent }}>
                            <CategoryIcon id={c.id} className="h-4 w-4" />
                          </span>
                          {c.shortName}
                        </div>
                        <div className="mt-0.5 text-[12px] text-ink-3">
                          {hosts.length} hosts · from {aed(from)}
                        </div>
                      </div>
                    </Link>
                  );
                })}
                <Link to="/experiences" className="group flex flex-col justify-between rounded-2xl bg-ink p-5 text-paper">
                  <div>
                    <div className="eyebrow text-paper/50">All of Sharjah</div>
                    <div className="mt-2 font-display text-[22px] leading-tight">Browse every experience</div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-honey-300">
                    Explore <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <Sheet open={menu} onClose={() => setMenu(false)} title="Menu" side="right" width={380}>
        <div className="space-y-1">
          {CATEGORIES.map((c) => (
            <Link key={c.id} to={`/c/${c.id}`} className="flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-white">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: c.theme.accentSoft, color: c.theme.accent }}>
                <CategoryIcon id={c.id} />
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-ink">{c.name}</span>
                <span className="block text-[12.5px] text-ink-3">{c.tagline}</span>
              </span>
            </Link>
          ))}
        </div>
        <div className="my-4 h-px bg-line" />
        <div className="grid grid-cols-2 gap-2">
          {[
            { to: '/experiences', label: 'All experiences' },
            { to: '/compose', label: 'Day Composer' },
            { to: '/passport', label: 'Passport' },
            { to: '/me', label: 'My LocalDays' },
            { to: '/hosts', label: 'For hosts' },
            { to: '/host', label: 'Host dashboard' },
            { to: '/impact', label: 'Impact' },
            { to: '/how-it-works', label: 'How it works' },
          ].map((l) => (
            <Link key={l.to} to={l.to} className="rounded-xl bg-white px-3 py-3 text-[14px] font-semibold text-ink shadow-ring">
              {l.label}
            </Link>
          ))}
        </div>
        {!user && (
          <button onClick={() => setAuthOpen(true)} className="mt-4 w-full rounded-full bg-ink py-3 text-[14px] font-semibold text-paper">
            Sign in
          </button>
        )}
      </Sheet>
    </>
  );
}

function MenuLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] font-medium text-ink hover:bg-sand-50">
      <span className="text-ink-3">{icon}</span>
      {label}
    </Link>
  );
}
