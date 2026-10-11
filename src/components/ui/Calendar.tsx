import { addMonths, endOfMonth, format, getDay, isBefore, parseISO, startOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { addDaysISO, daysBetween, toISO } from '@/lib/dates';

export type DayStatus = 'closed' | 'soldout' | 'limited' | 'available';

interface Props {
  todayISO: string;
  value?: string | null;
  rangeEnd?: string | null;
  mode?: 'single' | 'range';
  getStatus: (iso: string) => DayStatus;
  onSelect: (iso: string) => void;
  onSelectRange?: (start: string, end: string) => void;
  maxRange?: number;
  months?: 1 | 2;
}

const WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function Calendar({ todayISO, value, rangeEnd, mode = 'single', getStatus, onSelect, onSelectRange, maxRange = 7, months = 1 }: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(parseISO(value ?? todayISO)));
  const [pendingStart, setPendingStart] = useState<string | null>(null);

  const monthList = useMemo(() => Array.from({ length: months }, (_, i) => addMonths(cursor, i)), [cursor, months]);
  const canPrev = !isBefore(addMonths(cursor, -1), startOfMonth(parseISO(todayISO)));

  const handle = (iso: string) => {
    if (mode === 'single') return onSelect(iso);
    if (!pendingStart) {
      setPendingStart(iso);
      onSelect(iso);
      return;
    }
    const d = daysBetween(pendingStart, iso);
    if (d <= 0 || d > maxRange) {
      setPendingStart(iso);
      onSelect(iso);
      return;
    }
    // every night in the range must be bookable
    for (let i = 0; i < d; i++) {
      const s = getStatus(addDaysISO(pendingStart, i));
      if (s === 'closed' || s === 'soldout') {
        setPendingStart(iso);
        onSelect(iso);
        return;
      }
    }
    onSelectRange?.(pendingStart, iso);
    setPendingStart(null);
  };

  return (
    <div className="select-none">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          disabled={!canPrev}
          onClick={() => setCursor(addMonths(cursor, -1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/10 text-ink transition hover:border-ink/40 disabled:opacity-25"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-1 justify-around">
          {monthList.map((m) => (
            <div key={m.toISOString()} className="font-display text-[17px] tracking-tight text-ink">
              {format(m, 'MMMM yyyy')}
            </div>
          ))}
        </div>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setCursor(addMonths(cursor, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/10 text-ink transition hover:border-ink/40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className={cn('grid gap-6', months === 2 && 'md:grid-cols-2')}>
        {monthList.map((m) => {
          const start = startOfMonth(m);
          const end = endOfMonth(m);
          const lead = getDay(start);
          const days = Array.from({ length: end.getDate() }, (_, i) => toISO(new Date(m.getFullYear(), m.getMonth(), i + 1)));
          return (
            <div key={m.toISOString()}>
              <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                {WEEK.map((d) => (
                  <div key={d} className="py-1.5">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-1">
                {Array.from({ length: lead }).map((_, i) => (
                  <div key={`l${i}`} />
                ))}
                {days.map((iso) => {
                  const past = daysBetween(todayISO, iso) < 0;
                  const status: DayStatus = past ? 'closed' : getStatus(iso);
                  const selectable = status === 'available' || status === 'limited';
                  const start = pendingStart ?? value;
                  const isStart = iso === value || iso === pendingStart;
                  const isEnd = iso === rangeEnd;
                  const inRange = mode === 'range' && value && rangeEnd && daysBetween(value, iso) > 0 && daysBetween(iso, rangeEnd) > 0;
                  void start;
                  return (
                    <div key={iso} className={cn('relative flex justify-center', inRange && 'bg-sand-100', isStart && rangeEnd && 'rounded-l-full bg-sand-100', isEnd && 'rounded-r-full bg-sand-100')}>
                      <button
                        type="button"
                        disabled={!selectable}
                        onClick={() => handle(iso)}
                        aria-label={`${format(parseISO(iso), 'EEEE d MMMM')} — ${status}`}
                        className={cn(
                          'relative flex h-11 w-11 flex-col items-center justify-center rounded-full text-[14px] font-semibold transition-all',
                          isStart || isEnd
                            ? 'bg-ink text-paper shadow-soft'
                            : selectable
                              ? 'text-ink hover:bg-white hover:shadow-ring'
                              : 'cursor-not-allowed text-ink/25',
                          status === 'soldout' && !past && 'line-through decoration-ink/30',
                        )}
                      >
                        {parseISO(iso).getDate()}
                        {selectable && !(isStart || isEnd) && (
                          <span className={cn('absolute bottom-1.5 h-1 w-1 rounded-full', status === 'limited' ? 'bg-honey-500' : 'bg-oasis-400')} />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4 text-[12px] text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-oasis-400" /> Available
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-honey-500" /> Few spots left
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-ink/30 line-through">12</span> Sold out
        </span>
      </div>
    </div>
  );
}
