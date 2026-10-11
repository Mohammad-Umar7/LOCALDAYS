import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, BrainCircuit, CalendarRange, ChevronDown, Crown, Layers, LayoutDashboard, Store, Ticket, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Avatar, DemoTag } from '@/components/ui/primitives';
import { CategoryIcon } from '@/components/brand/CategoryIcon';
import { CATEGORY_BY_ID } from '@/data/categories';
import { PROVIDERS } from '@/data/catalog';
import { useApp } from '@/store/app';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useHost } from './useHost';
import HostOverview from './HostOverview';
import HostBookings from './HostBookings';
import HostCommerce from './HostCommerce';
import HostIntelligence from './HostIntelligence';
import HostPresales from './HostPresales';
import HostEarnings from './HostEarnings';
import HostStudio from './HostStudio';
import HostPlan from './HostPlan';

const STUDIO_LABEL: Record<string, string> = {
  farm: 'Crops & harvest log',
  honey: 'Harvest batches',
  pottery: 'Studio pipeline',
  coastal: 'Operations & safety',
  fragrance: 'Formulas & blends',
};

export default function Host() {
  const { section = 'overview' } = useParams();
  const { provider } = useHost();
  const setProvider = useApp((s) => s.setActiveProvider);
  const today = useApp((s) => s.todayISO)();
  const nav = useNavigate();
  const [switcher, setSwitcher] = useState(false);
  const cat = CATEGORY_BY_ID[provider.categoryId];

  const NAV = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'bookings', label: 'Bookings & stays', icon: CalendarRange },
    { id: 'commerce', label: 'Orders & subscribers', icon: Store },
    { id: 'intelligence', label: provider.id === 'ghaf-grove' ? 'Harvest & Demand AI' : 'Demand intelligence', icon: BrainCircuit },
    { id: 'studio', label: STUDIO_LABEL[provider.categoryId], icon: Layers },
    { id: 'presales', label: 'Prepaid experiences', icon: Ticket },
    { id: 'earnings', label: 'Earnings & payouts', icon: Wallet },
    { id: 'plan', label: 'Pro plan', icon: Crown },
  ];

  return (
    <AppShell footer={false}>
      <div className="min-h-[calc(100vh-72px)] bg-[#F1ECE3]">
        <div className="mx-auto grid max-w-[1500px] grid-cols-[minmax(0,1fr)] lg:grid-cols-[272px_minmax(0,1fr)]">
          {/* Sidebar */}
          <aside className="border-b border-line bg-paper lg:sticky lg:top-[72px] lg:h-[calc(100vh-72px)] lg:border-b-0 lg:border-r">
            <div className="p-4 lg:p-5">
              <div className="relative">
                <button onClick={() => setSwitcher((v) => !v)} className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-ring transition hover:shadow-soft">
                  <Avatar initials={provider.hostInitials} size={40} color={cat.theme.accent} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{provider.name}</span>
                    <span className="block truncate text-[12px] text-ink-3">
                      {provider.hostName} · {cat.shortName}
                    </span>
                  </span>
                  <ChevronDown className={cn('h-4 w-4 text-ink-3 transition', switcher && 'rotate-180')} />
                </button>
                <AnimatePresence>
                  {switcher && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="thin-scrollbar absolute left-0 right-0 top-[68px] z-30 max-h-[60vh] overflow-y-auto rounded-2xl bg-white p-1.5 shadow-float"
                    >
                      <div className="px-2.5 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-3">Switch demo host</div>
                      {PROVIDERS.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setProvider(p.id);
                            setSwitcher(false);
                          }}
                          className={cn('flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-sand-50', p.id === provider.id && 'bg-sand-50')}
                        >
                          <span style={{ color: CATEGORY_BY_ID[p.categoryId].theme.accent }}>
                            <CategoryIcon id={p.categoryId} className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{p.name}</span>
                          {p.flagship && <span className="text-[10px] font-bold uppercase text-clay-600">Flagship</span>}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <nav className="no-scrollbar mt-4 flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
                {NAV.map((n) => {
                  const on = section === n.id;
                  return (
                    <button
                      key={n.id}
                      onClick={() => nav(n.id === 'overview' ? '/host' : `/host/${n.id}`)}
                      className={cn(
                        'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13.5px] font-semibold transition',
                        on ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-white hover:text-ink',
                      )}
                    >
                      <n.icon className="h-4 w-4" />
                      {n.label}
                      {n.id === 'intelligence' && provider.id === 'ghaf-grove' && <span className={cn('ml-auto hidden rounded-full px-1.5 text-[9.5px] font-bold lg:inline', on ? 'bg-white/20' : 'bg-clay-500 text-white')}>AI</span>}
                    </button>
                  );
                })}
              </nav>
              <div className="mt-6 hidden rounded-2xl border border-dashed border-ink/20 p-4 text-[12px] text-ink-3 lg:block">
                <div className="mb-1 font-semibold text-ink-2">Demo host dashboard</div>
                Fictional 12-week history, with everything you do as a customer in this demo flowing in live.
                <Link to={`/p/${provider.slug}`} className="mt-2 block font-semibold text-clay-600">
                  View public page →
                </Link>
              </div>
            </div>
          </aside>

          {/* Main */}
          <main className="min-w-0 p-4 pb-28 md:p-8">
            <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-3">
                  <BarChart3 className="h-4 w-4" /> {fmtDate(today, 'EEEE d MMMM')} <DemoTag />
                </div>
                <h1 className="mt-1 font-display text-[32px] leading-tight tracking-tight md:text-[38px]">{NAV.find((n) => n.id === section)?.label ?? 'Overview'}</h1>
              </div>
              <div className="text-[13px] text-ink-3">
                {provider.name} · {provider.locationLabel}
              </div>
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={`${provider.id}-${section}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                {section === 'overview' && <HostOverview />}
                {section === 'bookings' && <HostBookings />}
                {section === 'commerce' && <HostCommerce />}
                {section === 'intelligence' && <HostIntelligence />}
                {section === 'studio' && <HostStudio />}
                {section === 'presales' && <HostPresales />}
                {section === 'earnings' && <HostEarnings />}
                {section === 'plan' && <HostPlan />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </AppShell>
  );
}
