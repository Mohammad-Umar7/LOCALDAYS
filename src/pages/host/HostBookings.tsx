import { BedDouble, CalendarDays, KeyRound, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { EXPERIENCE_BY_ID } from '@/data/catalog';
import { useApp } from '@/store/app';
import { useUI } from '@/store/ui';
import { CATEGORY_BY_ID } from '@/data/categories';
import { upcomingSlots } from '@/services/hostData';
import { aed, fmtDate, fmtTime } from '@/lib/format';
import { relativeDayLabel } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { useHost } from './useHost';
import { Panel } from './ui';

export default function HostBookings() {
  const { provider, ctx } = useHost();
  const bookings = useApp((s) => s.bookings.filter((b) => b.providerId === provider.id));
  const complete = useApp((s) => s.completeBooking);
  const toast = useUI((s) => s.toast);
  const [view, setView] = useState<'sessions' | 'guests'>('sessions');
  const [code, setCode] = useState('');
  const slots = useMemo(() => upcomingSlots(provider.id, ctx, 21), [provider.id, ctx]);
  const byDay = useMemo(() => {
    const m = new Map<string, typeof slots>();
    slots.forEach((s) => m.set(s.date, [...(m.get(s.date) ?? []), s]));
    return [...m.entries()];
  }, [slots]);
  const confirmed = bookings.filter((b) => b.status === 'confirmed').sort((a, b) => a.date.localeCompare(b.date));
  const match = confirmed.find((b) => b.checkInCode === code);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Panel
          title="Calendar · next 3 weeks"
          sub="Includes fictional baseline demand plus every booking made in this demo"
          action={<Tabs size="sm" value={view} onChange={setView} items={[{ id: 'sessions', label: 'Sessions' }, { id: 'guests', label: 'LocalDays guests', count: confirmed.length }]} />}
        >
          {view === 'sessions' ? (
            <div className="space-y-4">
              {byDay.slice(0, 10).map(([date, list]) => (
                <div key={date}>
                  <div className="mb-1.5 flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-[0.1em] text-ink-3">
                    <CalendarDays className="h-3.5 w-3.5" /> {relativeDayLabel(ctx.todayISO, date)} · {fmtDate(date, 'd MMM')}
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {list.map((s) => {
                      const e = EXPERIENCE_BY_ID[s.experienceId];
                      const fill = s.booked / s.capacity;
                      return (
                        <div key={s.key} className="rounded-2xl border border-line p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[13.5px] font-semibold">{e.title}</span>
                            {e.priceUnit === 'per_night' ? <BedDouble className="h-4 w-4 shrink-0 text-ink-3" /> : <span className="shrink-0 text-[12px] font-semibold text-ink-3">{fmtTime(s.time)}</span>}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand-100">
                              <div className={cn('h-full rounded-full', fill > 0.9 ? 'bg-clay-500' : 'bg-oasis-400')} style={{ width: `${fill * 100}%` }} />
                            </div>
                            <span className="tabular text-[12px] font-semibold">
                              {s.booked}/{s.capacity}
                            </span>
                            {s.demo > 0 && <Badge tone="clay">+{s.demo} via demo</Badge>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : confirmed.length ? (
            <div className="divide-y divide-line">
              {confirmed.map((b) => (
                <div key={b.ref} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold">{b.customer.name}</div>
                    <div className="text-[12.5px] text-ink-3">
                      {EXPERIENCE_BY_ID[b.experienceId].title} · {fmtDate(b.date)} {b.time ? fmtTime(b.time) : ''} · {b.guests.adults + b.guests.children} guests
                    </div>
                  </div>
                  <span className="font-mono text-[12px] text-ink-3">{b.ref}</span>
                  <span className="tabular text-[13.5px] font-semibold">{aed(b.price.total)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Users className="h-6 w-6" />} title="No LocalDays bookings yet" body="Book something as a customer — it appears here instantly." />
          )}
        </Panel>

        <Panel title="Guest check-in" sub="Enter the 4-digit code a guest shows on arrival to verify the visit and issue their Passport stamp">
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="• • • •" className="input text-center font-mono text-[26px] tracking-[0.6em]" inputMode="numeric" aria-label="Guest check-in code" />
          {match ? (
            <div className="mt-4 rounded-2xl bg-emerald-50 p-4">
              <div className="text-[14px] font-semibold text-emerald-900">{match.customer.name}</div>
              <div className="text-[12.5px] text-emerald-800">
                {EXPERIENCE_BY_ID[match.experienceId].title} · {match.guests.adults + match.guests.children} guests
              </div>
              <Button
                className="mt-3"
                block
                icon={<KeyRound className="h-4 w-4" />}
                onClick={() => {
                  const st = complete(match.ref);
                  toast({
                    title: 'Visit verified',
                    body: st
                      ? `${match.customer.name} just earned the ${CATEGORY_BY_ID[match.categoryId].stamp.title} stamp.`
                      : `${EXPERIENCE_BY_ID[match.experienceId].title} marked as completed.`,
                    tone: 'success',
                  });
                  setCode('');
                }}
              >
                Verify visit & issue stamp
              </Button>
            </div>
          ) : (
            <div className="mt-3 text-[12.5px] text-ink-3">
              {confirmed.length ? (
                <>
                  Demo codes:{' '}
                  {confirmed.slice(0, 3).map((b) => (
                    <button key={b.ref} onClick={() => setCode(b.checkInCode)} className="mr-1.5 rounded-md bg-sand-100 px-1.5 py-0.5 font-mono font-semibold text-ink">
                      {b.checkInCode}
                    </button>
                  ))}
                </>
              ) : (
                'No upcoming LocalDays guests to check in.'
              )}
            </div>
          )}
          <div className="mt-5 rounded-2xl border border-dashed border-line p-4 text-[12.5px] text-ink-3">Stamps are only issued through this verification — it’s what makes the Passport meaningful.</div>
        </Panel>
      </div>
    </div>
  );
}
