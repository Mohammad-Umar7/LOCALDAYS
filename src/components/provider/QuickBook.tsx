import { CalendarDays, ChevronRight, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Experience, Provider } from '@/data/types';
import { experiencesForProvider } from '@/data/catalog';
import { useAvailabilityCtx } from '@/store/app';
import { upcomingOpenDates } from '@/services/availability';
import { priceExperience } from '@/services/pricing';
import { aed, fmtDate, fmtTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Counter, Stars } from '../ui/primitives';
import { Button } from '../ui/Button';

/** Sticky booking card: pick experience, date, slot and party, then continue to the full flow. */
export function QuickBook({ provider, initialExperience }: { provider: Provider; initialExperience?: string }) {
  const exps = experiencesForProvider(provider.id);
  const [expId, setExpId] = useState(initialExperience ?? exps[0]?.id);
  const exp = exps.find((e) => e.id === expId) ?? exps[0];
  const ctx = useAvailabilityCtx();
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(exp?.familyFriendly ? 1 : 0);
  const guests = adults + children;
  const dates = useMemo(() => (exp ? upcomingOpenDates(exp, Math.min(guests, exp.maxGuests), ctx, 6) : []), [exp, guests, ctx]);
  const [date, setDate] = useState<string | null>(null);
  const day = dates.find((d) => d.date === date) ?? dates[0];
  const [time, setTime] = useState<string | undefined>();
  const slot = day?.slots.find((s) => s.time === time && s.remaining >= guests) ?? day?.slots.find((s) => s.remaining >= (exp?.priceUnit === 'per_night' ? 1 : guests));
  const nav = useNavigate();
  if (!exp) return null;
  const price = priceExperience(exp, { guests: { adults, children }, nights: 1 });

  const go = () => {
    const q = new URLSearchParams();
    if (day) q.set('date', day.date);
    if (slot?.time) q.set('time', slot.time);
    q.set('adults', String(adults));
    q.set('children', String(children));
    nav(`/book/${exp.id}?${q}`);
  };

  return (
    <div className="rounded-[28px] border border-line bg-white p-5 shadow-lift md:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <span className="tabular font-display text-[28px] leading-none">{aed(exp.price)}</span>
          <span className="ml-1.5 text-[13.5px] text-ink-3">
            {exp.priceUnit === 'per_guest' ? '/ guest' : exp.priceUnit === 'per_night' ? '/ night' : `/ up to ${exp.includedGuests} guests`}
          </span>
        </div>
        <Stars value={provider.rating} />
      </div>

      <label className="label mt-5">Experience</label>
      <select
        value={exp.id}
        onChange={(e) => {
          setExpId(e.target.value);
          setDate(null);
          setTime(undefined);
        }}
        className="input cursor-pointer font-semibold"
      >
        {exps.map((e) => (
          <option key={e.id} value={e.id}>
            {e.title}
          </option>
        ))}
      </select>

      <div className="mt-4 rounded-2xl border border-line">
        <div className="border-b border-line px-4 py-1">
          <Counter label="Adults" value={adults} min={exp.minGuests > 1 ? 1 : 1} max={exp.maxGuests} onChange={setAdults} />
        </div>
        <div className="px-4 py-1">
          <Counter label="Children" hint={exp.minAge ? `Ages ${exp.minAge}+` : 'Under 12'} value={children} min={0} max={Math.max(0, exp.maxGuests - adults)} onChange={setChildren} />
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="label mb-0">{exp.priceUnit === 'per_night' ? 'Check-in' : 'Next available'}</span>
          <span className="inline-flex items-center gap-1 text-[12px] text-ink-3">
            <CalendarDays className="h-3.5 w-3.5" /> live
          </span>
        </div>
        {dates.length === 0 ? (
          <div className="rounded-2xl bg-sand-50 p-4 text-[13.5px] text-ink-3">No availability for {guests} guests in the next 6 weeks. Try fewer guests.</div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {dates.map((d) => {
              const on = (day?.date ?? '') === d.date;
              return (
                <button
                  key={d.date}
                  onClick={() => {
                    setDate(d.date);
                    setTime(undefined);
                  }}
                  className={cn(
                    'rounded-2xl border px-2 py-2.5 text-center transition',
                    on ? 'border-ink bg-ink text-paper' : 'border-line bg-white hover:border-ink/40',
                  )}
                >
                  <div className={cn('text-[11px] font-semibold uppercase tracking-wider', on ? 'text-paper/60' : 'text-ink-3')}>{fmtDate(d.date, 'EEE')}</div>
                  <div className="text-[15px] font-semibold">{fmtDate(d.date, 'd MMM')}</div>
                  <div className={cn('text-[10.5px] font-semibold', on ? 'text-honey-300' : d.status === 'limited' ? 'text-amber-700' : 'text-oasis-600')}>
                    {d.status === 'limited' ? 'Few left' : 'Open'}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {day && exp.priceUnit !== 'per_night' && day.slots.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {day.slots.map((s) => {
              const ok = s.remaining >= guests;
              const on = slot?.key === s.key;
              return (
                <button
                  key={s.key}
                  disabled={!ok}
                  onClick={() => setTime(s.time)}
                  className={cn('chip', on && 'chip-active', !ok && 'opacity-40')}
                >
                  {fmtTime(s.time)} <span className="opacity-60">· {s.remaining} left</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Button block size="lg" className="mt-5" onClick={go} disabled={!day} iconRight={<ChevronRight className="h-4 w-4" />}>
        Reserve
      </Button>
      <div className="mt-3 flex items-center justify-between text-[13px] text-ink-2">
        <span>
          {guests} guest{guests > 1 ? 's' : ''}
          {exp.priceUnit === 'per_night' ? ' · 1 night' : ''}
        </span>
        <span className="tabular font-semibold text-ink">{aed(price.total)}</span>
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-2xl bg-oasis-50 p-3 text-[12.5px] text-oasis-700">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{provider.cancellation.summary} No booking fees — prices include VAT.</span>
      </div>
    </div>
  );
}

export function nextDatesLabel(e: Experience, dates: { date: string }[]) {
  return dates
    .slice(0, 3)
    .map((d) => fmtDate(d.date, 'EEE d'))
    .join(' · ');
}
