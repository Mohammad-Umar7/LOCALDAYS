import { BRAND } from '@/config/brand';
import { cn } from '@/lib/utils';

/** Arch + rising sun: a doorway into a local day. */
export function LogoMark({ className, tone = 'clay' }: { className?: string; tone?: 'clay' | 'light' | 'dark' }) {
  const bg = tone === 'clay' ? '#B5502B' : tone === 'light' ? '#F6F1E8' : '#1A1612';
  const fg = tone === 'light' ? '#1A1612' : '#F6F1E8';
  return (
    <svg viewBox="0 0 64 64" className={cn('h-9 w-9', className)} aria-hidden>
      <rect width="64" height="64" rx="18" fill={bg} />
      <path d="M19 49V30.5C19 23.04 24.82 17 32 17s13 6.04 13 13.5V49" fill="none" stroke={fg} strokeWidth="4.2" strokeLinecap="round" />
      <path d="M24.5 42.5a7.5 7.5 0 0 1 15 0z" fill="#F2C46D" />
      <path d="M14 49h36" stroke={fg} strokeWidth="4.2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, dark, compact }: { className?: string; dark?: boolean; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className="h-8 w-8 md:h-9 md:w-9" tone={dark ? 'light' : 'clay'} />
      {!compact && (
        <span className={cn('font-display text-[22px] font-medium leading-none tracking-[-0.035em]', dark ? 'text-white' : 'text-ink')} style={{ fontVariationSettings: '"SOFT" 100, "WONK" 0' }}>
          {BRAND.name}
        </span>
      )}
    </span>
  );
}
