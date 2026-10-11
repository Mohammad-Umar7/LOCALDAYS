import { Html } from '@react-three/drei';
import { cn } from '@/lib/utils';
import type { Vec3 } from './types';

interface HotspotProps {
  id: string;
  position: Vec3;
  label: string;
  kicker?: string;
  index: number;
  active: boolean;
  dimmed: boolean;
  accent: string;
  onSelect: (id: string) => void;
  /** Small viewers: numbered dot only (the chip row names them); label shows when active */
  compact?: boolean;
  /** Medium viewers: drop the kicker to keep labels short */
  hideKicker?: boolean;
}

/** A pin floating over an area of the venue. Rendered as real DOM so it stays crisp and accessible. */
export function Hotspot({ id, position, label, kicker, index, active, dimmed, accent, onSelect, compact, hideKicker }: HotspotProps) {
  const showLabel = !compact || active;
  return (
    <Html position={position} center zIndexRange={[40, 0]} className="hotspot-html" style={{ pointerEvents: 'none' }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(id);
        }}
        aria-label={`${label}${kicker ? ` — ${kicker}` : ''}`}
        aria-pressed={active}
        className={cn(
          'group pointer-events-auto relative flex select-none items-center gap-2 whitespace-nowrap transition-all duration-500 ease-out-expo',
          dimmed && !active ? 'opacity-40 hover:opacity-100' : 'opacity-100',
        )}
        style={{ animation: `hotspotIn 0.8s ${0.4 + index * 0.08}s both cubic-bezier(0.16,1,0.3,1)` }}
      >
        <span className="relative flex h-8 w-8 items-center justify-center">
          {!active && <span className="absolute inset-0 rounded-full animate-pulse-ring" style={{ background: `${accent}55` }} />}
          <span
            className={cn(
              'relative flex items-center justify-center rounded-full border-2 border-white text-[10px] font-bold shadow-[0_6px_16px_rgba(0,0,0,0.35)] transition-all duration-300',
              active ? 'h-8 w-8 text-white' : 'h-6 w-6 bg-white/95 text-ink group-hover:h-7 group-hover:w-7',
            )}
            style={active ? { background: accent } : undefined}
          >
            {index + 1}
          </span>
        </span>
        {showLabel && (
          <span
            className={cn(
              'rounded-full px-3 py-1.5 text-[12px] font-semibold tracking-tight shadow-[0_8px_24px_rgba(0,0,0,0.28)] backdrop-blur-md transition-all duration-300',
              active ? 'bg-ink text-white' : 'bg-white/90 text-ink group-hover:bg-white',
            )}
          >
            {kicker && !hideKicker && !compact && <span className="mr-1.5 text-[10px] font-bold uppercase tracking-[0.14em] opacity-60">{kicker}</span>}
            {label}
          </span>
        )}
      </button>
    </Html>
  );
}
