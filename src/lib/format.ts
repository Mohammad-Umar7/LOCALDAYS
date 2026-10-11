import { format, parseISO } from 'date-fns';
import { BRAND } from '@/config/brand';

const aed0 = new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 });
const aed2 = new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

/** "AED 1,500" */
export function aed(n: number, opts: { decimals?: boolean; sign?: boolean } = {}) {
  const v = opts.decimals ? aed2.format(Math.abs(n)) : aed0.format(Math.round(Math.abs(n)));
  const sign = n < 0 ? '−' : opts.sign && n > 0 ? '+' : '';
  return `${sign}${BRAND.currency} ${v}`;
}

export function num(n: number, dp = 0) {
  return new Intl.NumberFormat('en-AE', { maximumFractionDigits: dp, minimumFractionDigits: dp }).format(n);
}

export function compactNum(n: number) {
  return compact.format(n);
}

export function pct(n: number, dp = 0) {
  return `${(n * 100).toFixed(dp)}%`;
}

export function fmtDate(iso: string, pattern = 'EEE d MMM') {
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return iso;
  }
}

export function fmtDateLong(iso: string) {
  return fmtDate(iso, 'EEEE, d MMMM yyyy');
}

/** "18:30" → "6:30 pm" */
export function fmtTime(t?: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function fmtDuration(mins: number) {
  if (!mins) return 'Overnight';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} hour${h > 1 ? 's' : ''}`;
}
