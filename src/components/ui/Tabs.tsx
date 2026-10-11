import { motion } from 'framer-motion';
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  count?: number;
  icon?: ReactNode;
}

/** Pill tabs with a sliding active indicator. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  size = 'md',
  dark,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: 'sm' | 'md';
  dark?: boolean;
}) {
  const id = useId();
  return (
    <div
      role="tablist"
      className={cn(
        'no-scrollbar inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full p-1',
        dark ? 'bg-white/10' : 'bg-sand-100 ring-1 ring-inset ring-line',
        className,
      )}
    >
      {items.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              'relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-colors',
              size === 'sm' ? 'px-3 py-1.5 text-[12.5px]' : 'px-4 py-2 text-[13.5px]',
              active ? (dark ? 'text-ink' : 'text-paper') : dark ? 'text-white/70 hover:text-white' : 'text-ink-2 hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId={`tab-${id}`}
                className={cn('absolute inset-0 rounded-full', dark ? 'bg-white' : 'bg-ink')}
                transition={{ type: 'spring', damping: 30, stiffness: 380 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {t.icon}
              {t.label}
              {t.count !== undefined && (
                <span className={cn('rounded-full px-1.5 text-[10.5px] tabular', active ? 'bg-white/20' : 'bg-ink/8 text-ink-3')}>{t.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
