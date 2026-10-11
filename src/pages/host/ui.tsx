import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Sparkline } from '@/components/charts/Charts';

export function Panel({ title, sub, action, children, className, pad = true }: { title?: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cn('rounded-[24px] border border-line/80 bg-white shadow-[0_1px_2px_rgba(26,22,18,0.04)]', pad && 'p-5 md:p-6', className)}>
      {(title || action) && (
        <div className={cn('mb-4 flex items-start justify-between gap-3', !pad && 'px-5 pt-5 md:px-6 md:pt-6')}>
          <div>
            {title && <h2 className="text-[16px] font-semibold tracking-tight text-ink">{title}</h2>}
            {sub && <p className="mt-0.5 text-[12.5px] text-ink-3">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, delta, sub, trend, tone }: { label: string; value: ReactNode; delta?: { v: string; good: boolean }; sub?: ReactNode; trend?: number[]; tone?: string }) {
  return (
    <div className="flex min-w-0 flex-col rounded-[22px] border border-line/80 bg-white p-4 md:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 text-[12.5px] font-semibold leading-snug text-ink-3">{label}</div>
        {trend && <Sparkline values={trend} color={tone} width={64} height={22} />}
      </div>
      <div className="mt-2 whitespace-nowrap text-[24px] font-semibold leading-none tracking-tight text-ink md:text-[27px]">{value}</div>
      <div className="mt-1.5 flex min-h-[18px] flex-wrap items-center gap-1.5 text-[12px]">
        {delta && <span className={cn('rounded-full px-1.5 py-0.5 font-semibold', delta.good ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>{delta.v}</span>}
        {sub && <span className="text-ink-3">{sub}</span>}
      </div>
    </div>
  );
}
