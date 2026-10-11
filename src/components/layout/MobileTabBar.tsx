import { BookOpen, Compass, House, Sparkles, Ticket } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useMyBookings } from '@/store/app';

const TABS = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/experiences', label: 'Explore', icon: Compass },
  { to: '/compose', label: 'Compose', icon: Sparkles },
  { to: '/passport', label: 'Passport', icon: BookOpen },
  { to: '/me', label: 'Trips', icon: Ticket },
];

/** App-like bottom navigation on phones. */
export function MobileTabBar() {
  const upcoming = useMyBookings().filter((b) => b.status === 'confirmed').length;
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-paper/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      aria-label="Primary"
    >
      <div className="grid grid-cols-5">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => cn('relative flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold', isActive ? 'text-clay-600' : 'text-ink-3')}
          >
            {({ isActive }) => (
              <>
                <span className={cn('relative flex h-7 w-12 items-center justify-center rounded-full transition', isActive && 'bg-clay-50')}>
                  <t.icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.2 : 1.8} />
                  {t.to === '/me' && upcoming > 0 && <span className="absolute right-2 top-0.5 h-2 w-2 rounded-full bg-clay-500 ring-2 ring-paper" />}
                </span>
                {t.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
