import { addDays, differenceInCalendarDays, format, getDay, parseISO, startOfDay } from 'date-fns';

export const ISO = 'yyyy-MM-dd';

export function toISO(d: Date) {
  return format(d, ISO);
}

export function fromISO(s: string) {
  return parseISO(s);
}

/** Real today shifted by the demo clock offset. */
export function demoToday(offsetDays: number) {
  return addDays(startOfDay(new Date()), offsetDays);
}

export function demoTodayISO(offsetDays: number) {
  return toISO(demoToday(offsetDays));
}

export function addDaysISO(iso: string, n: number) {
  return toISO(addDays(parseISO(iso), n));
}

export function weekdayOf(iso: string) {
  return getDay(parseISO(iso));
}

export function daysBetween(aISO: string, bISO: string) {
  return differenceInCalendarDays(parseISO(bISO), parseISO(aISO));
}

export function rangeISO(startISO: string, days: number) {
  return Array.from({ length: days }, (_, i) => addDaysISO(startISO, i));
}

/** Next Friday→Sunday window relative to today (Sharjah weekend). */
export function upcomingWeekend(todayISO: string) {
  const dow = weekdayOf(todayISO);
  // Friday or Saturday: the rest of this weekend. Sunday: plan the next one.
  if (dow === 5 || dow === 6) {
    const fri = dow === 5 ? todayISO : addDaysISO(todayISO, -1);
    return { start: todayISO, end: addDaysISO(fri, 2) };
  }
  const toFri = (5 - dow + 7) % 7;
  const fri = addDaysISO(todayISO, toFri);
  return { start: fri, end: addDaysISO(fri, 2) };
}

export function relativeDayLabel(todayISO: string, iso: string) {
  const d = daysBetween(todayISO, iso);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return 'Yesterday';
  if (d > 1 && d < 7) return format(parseISO(iso), 'EEEE');
  return format(parseISO(iso), 'EEE d MMM');
}
