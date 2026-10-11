import { motion, useInView, type HTMLMotionProps } from 'framer-motion';
import { Minus, Plus, Star } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { aed } from '@/lib/format';

/* ---------------------------------- Badge ---------------------------------- */

type Tone = 'neutral' | 'clay' | 'oasis' | 'honey' | 'sea' | 'oud' | 'success' | 'warning' | 'dark' | 'glass';
const TONES: Record<Tone, string> = {
  neutral: 'bg-sand-100 text-ink-2 ring-1 ring-inset ring-line',
  clay: 'bg-clay-50 text-clay-700 ring-1 ring-inset ring-clay-100',
  oasis: 'bg-oasis-50 text-oasis-700 ring-1 ring-inset ring-oasis-100',
  honey: 'bg-honey-100 text-honey-700 ring-1 ring-inset ring-honey-200',
  sea: 'bg-sea-100 text-sea-700 ring-1 ring-inset ring-sea-200',
  oud: 'bg-oud-100 text-oud-700 ring-1 ring-inset ring-oud-200',
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100',
  warning: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-100',
  dark: 'bg-ink text-paper',
  glass: 'bg-black/30 text-white ring-1 ring-inset ring-white/20 backdrop-blur-md',
};

export function Badge({ tone = 'neutral', className, children, icon }: { tone?: Tone; className?: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-tight', TONES[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

export function DemoTag({ className, children = 'Fictional demo host' }: { className?: string; children?: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border border-dashed border-ink/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3', className)}>
      {children}
    </span>
  );
}

/* ---------------------------------- Rating ---------------------------------- */

export function Stars({ value, count, simulated = true, className }: { value: number; count?: number; simulated?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-[13px] font-semibold text-ink', className)} title={simulated ? 'Simulated rating — demo data' : undefined}>
      <Star className="h-3.5 w-3.5 fill-honey-400 text-honey-400" />
      {value.toFixed(1)}
      {count !== undefined && <span className="font-medium text-ink-3">({count}{simulated ? ' · demo' : ''})</span>}
    </span>
  );
}

/* ---------------------------------- Avatar ---------------------------------- */

export function Avatar({ initials, color = '#B5502B', size = 44, className }: { initials: string; color?: string; size?: number; className?: string }) {
  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-display font-medium text-white', className)}
      style={{ width: size, height: size, background: `linear-gradient(140deg, ${color}, ${color}CC)`, fontSize: size * 0.38 }}
      aria-hidden
    >
      <span className="pattern-girih-light absolute inset-0 opacity-80" />
      <span className="relative">{initials}</span>
    </span>
  );
}

/* ---------------------------------- Counter ---------------------------------- */

export function Counter({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
  hint,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <div className="text-[15px] font-semibold text-ink">{label}</div>
        {hint && <div className="text-[13px] text-ink-3">{hint}</div>}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 text-ink transition hover:border-ink disabled:opacity-30"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="tabular w-5 text-center text-[16px] font-semibold">{value}</span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 text-ink transition hover:border-ink disabled:opacity-30"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------- Price ---------------------------------- */

export function Price({ value, unit, className, strike }: { value: number; unit?: string; className?: string; strike?: number }) {
  return (
    <span className={cn('inline-flex items-baseline gap-1.5', className)}>
      {strike !== undefined && <span className="text-[13px] text-ink-3 line-through">{aed(strike)}</span>}
      <span className="tabular font-semibold text-ink">{aed(value)}</span>
      {unit && <span className="text-[13px] text-ink-3">{unit}</span>}
    </span>
  );
}

/* ------------------------------ Section header ------------------------------ */

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  className,
  align = 'left',
  dark,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  align?: 'left' | 'center';
  dark?: boolean;
}) {
  return (
    <div className={cn('flex flex-col gap-5 md:flex-row md:items-end md:justify-between', align === 'center' && 'items-center text-center md:flex-col md:items-center', className)}>
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto')}>
        {eyebrow && <div className={cn('eyebrow mb-4', dark && 'text-white/60')}>{eyebrow}</div>}
        <h2 className={cn('display-lg text-balance', dark ? 'text-white' : 'text-ink')}>{title}</h2>
        {description && <p className={cn('mt-4 max-w-xl text-pretty text-[16px] leading-relaxed md:text-[17px]', dark ? 'text-white/70' : 'text-ink-2', align === 'center' && 'mx-auto')}>{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ---------------------------------- Reveal ---------------------------------- */

export function Reveal({ children, delay = 0, y = 24, className, ...rest }: { children: ReactNode; delay?: number; y?: number; className?: string } & HTMLMotionProps<'div'>) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/* ---------------------------------- Empty ---------------------------------- */

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-ink/15 bg-white/50 px-6 py-14 text-center">
      {icon && <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sand-100 text-ink-2">{icon}</div>}
      <div className="font-display text-xl text-ink">{title}</div>
      {body && <p className="mt-2 max-w-sm text-[14px] text-ink-3">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* ---------------------------------- Stat ---------------------------------- */

export function Stat({ label, value, sub, className, dark }: { label: string; value: ReactNode; sub?: ReactNode; className?: string; dark?: boolean }) {
  return (
    <div className={className}>
      <div className={cn('text-[12px] font-semibold uppercase tracking-[0.14em]', dark ? 'text-white/55' : 'text-ink-3')}>{label}</div>
      <div className={cn('mt-1.5 font-display text-[28px] leading-none tracking-tight tabular', dark ? 'text-white' : 'text-ink')}>{value}</div>
      {sub && <div className={cn('mt-1.5 text-[13px]', dark ? 'text-white/60' : 'text-ink-3')}>{sub}</div>}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-line', className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-2xl', className)} />;
}
