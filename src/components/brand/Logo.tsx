import { BRAND } from '@/config/brand';
import { cn } from '@/lib/utils';
import logoInk from '@/assets/brand/localdays-logo.png';
import logoLight from '@/assets/brand/localdays-logo-light.png';
import markInk from '@/assets/brand/localdays-mark.png';
import markLight from '@/assets/brand/localdays-mark-light.png';
import markFoil from '@/assets/brand/localdays-mark-foil.png';
import icon from '@/assets/brand/localdays-icon.png';

/*
 * Cut-outs of the master artwork in src/assets/brand/source — regenerate with `python scripts/brand-assets.py`.
 * width/height are the files' pixel sizes so the space is reserved before load; size each one by its height.
 * `dark` = sitting on a dark background: the green ink turns paper, sun and sands keep their colour.
 */

/** The logo: leaf, dunes and sun over the LocalDays wordmark. */
export function Logo({ className, dark }: { className?: string; dark?: boolean }) {
  return (
    <img
      src={dark ? logoLight : logoInk}
      width={411}
      height={256}
      alt={BRAND.name}
      draggable={false}
      className={cn('h-11 w-auto select-none md:h-[52px]', className)}
    />
  );
}

const MARKS = { ink: markInk, light: markLight, foil: markFoil };

/** The emblem on its own. `foil` is a single-colour brass stamp. */
export function LogoMark({ className, tone = 'ink' }: { className?: string; tone?: keyof typeof MARKS }) {
  return <img src={MARKS[tone]} width={403} height={192} alt="" draggable={false} className={cn('h-9 w-auto select-none', className)} />;
}

/** The app icon (emblem on a paper tile, as in the favicon) for avatar-sized spots. */
export function LogoIcon({ className }: { className?: string }) {
  return <img src={icon} width={192} height={192} alt="" draggable={false} className={cn('h-9 w-9 select-none', className)} />;
}
