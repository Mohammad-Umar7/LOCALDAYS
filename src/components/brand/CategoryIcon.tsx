import type { CategoryId } from '@/data/types';
import { cn } from '@/lib/utils';

/** Custom line icons for the five traditions (drawn for Fadhal, not stock). */
export function CategoryIcon({ id, className, strokeWidth = 1.6 }: { id: CategoryId; className?: string; strokeWidth?: number }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <svg viewBox="0 0 24 24" className={cn('h-5 w-5', className)} aria-hidden>
      {id === 'farm' && (
        <g {...common}>
          <path d="M12.2 21c-.1-4.6.4-8 1.4-11" />
          <path d="M13.6 10C11.8 7 8.4 6.4 5.6 8" />
          <path d="M13.6 10c1-2.9 4-4.4 7-3.4" />
          <path d="M13.6 10c-1.6-.9-4.6-.4-6.2 2.1" />
          <path d="M13.6 10c2.1-.4 5 .6 6 3.1" />
          <path d="M13.6 10c.1-2.6-.9-4.6-3-6.1" />
          <path d="M7.5 21h9.5" />
        </g>
      )}
      {id === 'honey' && (
        <g {...common}>
          <path d="M8 3.4l3 1.75v3.5L8 10.4 5 8.65v-3.5z" />
          <path d="M14 6.9l3 1.75v3.5l-3 1.75-3-1.75v-3.5z" />
          <path d="M8 10.4l3 1.75v3.5L8 17.4l-3-1.75v-3.5z" />
          <path d="M18.6 17c0 1.6-1.1 2.9-2.5 2.9s-2.5-1.3-2.5-2.9 2.5-3.9 2.5-3.9 2.5 2.3 2.5 3.9z" />
        </g>
      )}
      {id === 'pottery' && (
        <g {...common}>
          <path d="M9 3h6" />
          <path d="M10 3v2c0 1.1-3.2 2.6-3.2 7.1 0 4 2.2 7.1 5.2 7.1s5.2-3.1 5.2-7.1C17.2 7.6 14 6.1 14 5V3" />
          <path d="M7.4 10.6h9.2" />
          <path d="M8 21.5h8" />
        </g>
      )}
      {id === 'coastal' && (
        <g {...common}>
          <path d="M3.5 14.5h17l-2.4 3.8H5.9z" />
          <path d="M12 14.5V3.8" />
          <path d="M12 4c-3.1 2.9-5.2 6.3-6.2 9.6H12" />
          <path d="M2.5 21c1.5 0 1.5-.9 3-.9s1.5.9 3 .9 1.5-.9 3-.9 1.5.9 3 .9 1.5-.9 3-.9 1.5.9 3 .9" />
        </g>
      )}
      {id === 'fragrance' && (
        <g {...common}>
          <path d="M6.5 12.5h11l-1.7 4.2H8.2z" />
          <path d="M10 16.7v2.1h4v-2.1" />
          <path d="M7.8 21h8.4" />
          <path d="M10.4 9.8c-1.1-1.5 1.1-2.6 0-4.6" />
          <path d="M13.6 9.8c-1.1-1.5 1.1-2.6 0-4.6" />
        </g>
      )}
    </svg>
  );
}
