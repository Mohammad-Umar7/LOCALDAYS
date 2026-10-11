import { BRAND } from '@/config/brand';
import { cn } from '@/lib/utils';
import logoInk from '@/assets/brand/fadhal-logo.png';
import logoLight from '@/assets/brand/fadhal-logo-light.png';
import markInk from '@/assets/brand/fadhal-mark.png';
import markLight from '@/assets/brand/fadhal-mark-light.png';
import markFoil from '@/assets/brand/fadhal-mark-foil.png';
import icon from '@/assets/brand/fadhal-icon.png';

/*
 * Cut-outs of the master artwork in src/assets/brand/source — regenerate with `python scripts/brand-assets.py`.
 * width/height are the files' pixel sizes so the space is reserved before load; size each one by its height.
 * `dark` = sitting on a dark background: the olive ink turns paper, terracotta and sand keep their colour.
 */

/** The logo: the arch emblem beside the bilingual فضل / FADHAL wordmark. */
export function Logo({ className, dark }: { className?: string; dark?: boolean }) {
  return (
    <img
      src={dark ? logoLight : logoInk}
      width={524}
      height={256}
      alt={BRAND.name}
      draggable={false}
      className={cn('h-11 w-auto select-none md:h-[56px]', className)}
    />
  );
}

const MARKS = { ink: markInk, light: markLight, foil: markFoil };

/** The emblem on its own. `foil` is a single-colour brass stamp. */
export function LogoMark({ className, tone = 'ink' }: { className?: string; tone?: keyof typeof MARKS }) {
  return <img src={MARKS[tone]} width={133} height={192} alt="" draggable={false} className={cn('h-9 w-auto select-none', className)} />;
}

/** The app icon (emblem on a paper tile, as in the favicon) for avatar-sized spots. */
export function LogoIcon({ className }: { className?: string }) {
  return <img src={icon} width={192} height={192} alt="" draggable={false} className={cn('h-9 w-9 select-none', className)} />;
}
