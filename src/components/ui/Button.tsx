import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'dark' | 'outline' | 'ghost' | 'light' | 'soft' | 'glass';
type Size = 'sm' | 'md' | 'lg' | 'xl';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-clay-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_20px_-8px_rgba(181,80,43,0.65)] hover:bg-clay-600 active:bg-clay-700',
  dark: 'bg-ink text-paper shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_24px_-12px_rgba(26,22,18,0.6)] hover:bg-ink/90',
  outline: 'border border-ink/15 bg-white/60 text-ink hover:border-ink/40 hover:bg-white',
  ghost: 'text-ink hover:bg-ink/5',
  light: 'bg-white text-ink shadow-soft hover:bg-sand-50',
  soft: 'bg-sand-100 text-ink hover:bg-sand-200',
  glass: 'border border-white/25 bg-white/10 text-white backdrop-blur-md hover:bg-white/20',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[13px] gap-1.5',
  md: 'h-11 px-5 text-[14px] gap-2',
  lg: 'h-12 px-6 text-[15px] gap-2',
  xl: 'h-14 px-7 text-[16px] gap-2.5',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  to?: string;
  href?: string;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', to, href, loading, icon, iconRight, block, className, children, disabled, ...rest },
  ref,
) {
  const cls = cn(
    'inline-flex select-none items-center justify-center whitespace-nowrap rounded-full font-semibold tracking-[-0.01em] transition-all duration-300 ease-out-expo active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45',
    VARIANTS[variant],
    SIZES[size],
    block && 'w-full',
    className,
  );
  const content = (
    <>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
      {iconRight}
    </>
  );
  if (to)
    return (
      <Link to={to} className={cls}>
        {content}
      </Link>
    );
  if (href)
    return (
      <a href={href} className={cls}>
        {content}
      </a>
    );
  return (
    <button ref={ref} className={cls} disabled={disabled || loading} {...rest}>
      {content}
    </button>
  );
});

export function IconButton({
  label,
  className,
  children,
  variant = 'outline',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; variant?: 'outline' | 'ghost' | 'glass' | 'light' | 'dark' }) {
  const v: Record<string, string> = {
    outline: 'border border-ink/10 bg-white/70 text-ink hover:bg-white hover:border-ink/25',
    ghost: 'text-ink hover:bg-ink/5',
    glass: 'border border-white/25 bg-black/20 text-white backdrop-blur-md hover:bg-black/35',
    light: 'bg-white text-ink shadow-soft hover:bg-sand-50',
    dark: 'bg-ink text-white hover:bg-ink/85',
  };
  return (
    <button
      aria-label={label}
      title={label}
      className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-300 active:scale-95', v[variant], className)}
      {...rest}
    >
      {children}
    </button>
  );
}
