import { motion } from 'framer-motion';
import type { RegionId } from '@/data/types';
import { REGIONS, REGION_BY_ID } from '@/data/regions';
import { cn } from '@/lib/utils';

export interface MapPin {
  regionId: RegionId;
  count?: number;
  /** 0..1 — scales the halo (bubble map) */
  size?: number;
  /** Second, smaller line under the label (e.g. a value) */
  sub?: string;
  label?: string;
  color?: string;
}

/**
 * Schematic map of the emirate: the west coast on the Arabian Gulf, the
 * central desert plains, the Hajar mountains and the east-coast towns on
 * the Gulf of Oman. Positions are schematic, not survey-accurate.
 */
export function SharjahMap({
  pins = [],
  selected,
  onSelect,
  route,
  className,
  dark,
}: {
  pins?: MapPin[];
  selected?: RegionId | null;
  onSelect?: (id: RegionId | null) => void;
  route?: RegionId[];
  className?: string;
  dark?: boolean;
}) {
  const pinMap = new Map(pins.map((p) => [p.regionId, p]));
  const pt = (id: RegionId) => REGION_BY_ID[id].map;
  const routePath = route && route.length > 1 ? route.map((r, i) => `${i ? 'L' : 'M'}${pt(r).x} ${pt(r).y}`).join(' ') : null;

  return (
    <div className={cn('relative w-full', className)}>
      <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label="Schematic map of Sharjah's regions">
        <defs>
          <linearGradient id="sea-w" x1="0" x2="1">
            <stop offset="0" stopColor={dark ? '#0F3A44' : '#BFDCE0'} />
            <stop offset="1" stopColor={dark ? '#165563' : '#D8ECEE'} />
          </linearGradient>
          <linearGradient id="sea-e" x1="1" x2="0">
            <stop offset="0" stopColor={dark ? '#0F3A44' : '#BFDCE0'} />
            <stop offset="1" stopColor={dark ? '#165563' : '#D8ECEE'} />
          </linearGradient>
          <pattern id="dunes" width="6" height="4" patternUnits="userSpaceOnUse">
            <path d="M0 3 Q1.5 1.6 3 3 T6 3" fill="none" stroke={dark ? 'rgba(255,255,255,0.07)' : 'rgba(140,110,68,0.18)'} strokeWidth="0.35" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill={dark ? '#1E1813' : '#EFE3CD'} />
        <rect width="100" height="100" fill="url(#dunes)" />
        {/* Arabian Gulf (west) */}
        <path d="M0 0 H22 C17 12 21 22 13 34 C8 42 11 52 4 62 C1 68 2 80 0 86 Z" fill="url(#sea-w)" />
        {/* Gulf of Oman (east) */}
        <path d="M100 0 H95 C91 10 94 18 92 28 C90 40 95 50 92 60 C90 70 95 80 93 92 L94 100 H100 Z" fill="url(#sea-e)" />
        {/* Hajar mountains */}
        {[
          'M66 6 L70 14 L73 9 L77 18 L80 12 L84 22 L86 18',
          'M68 30 L72 38 L75 32 L79 42 L82 36 L86 46',
          'M64 50 L68 58 L71 52 L75 62 L78 56 L83 66',
          'M70 72 L74 80 L77 74 L81 84',
        ].map((d) => (
          <path key={d} d={d} fill="none" stroke={dark ? 'rgba(255,255,255,0.18)' : 'rgba(110,84,52,0.35)'} strokeWidth="0.7" strokeLinejoin="round" />
        ))}
        <text x="5" y="94" fontSize="2.6" fill={dark ? 'rgba(255,255,255,0.35)' : 'rgba(29,90,102,0.6)'} fontStyle="italic" style={{ fontFamily: '"Fraunces Variable", serif' }}>
          Arabian Gulf
        </text>
        <text x="96.5" y="96" fontSize="2.6" fill={dark ? 'rgba(255,255,255,0.35)' : 'rgba(29,90,102,0.6)'} fontStyle="italic" textAnchor="end" style={{ fontFamily: '"Fraunces Variable", serif' }}>
          Gulf of Oman
        </text>
        <text x="75" y="4.5" fontSize="2.2" fill={dark ? 'rgba(255,255,255,0.3)' : 'rgba(110,84,52,0.55)'} textAnchor="middle" letterSpacing="0.4">
          HAJAR MOUNTAINS
        </text>

        {routePath && (
          <motion.path
            d={routePath}
            fill="none"
            stroke="#B5502B"
            strokeWidth="0.8"
            strokeDasharray="1.6 1.4"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.6, ease: 'easeInOut' }}
          />
        )}

        {REGIONS.map((r) => {
          const pin = pinMap.get(r.id);
          const active = selected === r.id;
          const muted = !pin && pins.length > 0;
          return (
            <g
              key={r.id}
              transform={`translate(${r.map.x} ${r.map.y})`}
              className={cn(onSelect && pin && 'cursor-pointer')}
              onClick={() => pin && onSelect?.(active ? null : r.id)}
              opacity={muted ? 0.45 : 1}
            >
              {pin && !muted && <circle r={active ? 4.2 : pin.size !== undefined ? 2.2 + pin.size * 4.6 : 3.2} fill={pin.color ?? '#B5502B'} opacity={pin.size !== undefined ? 0.24 : 0.18} />}
              <circle r={active ? 2.1 : 1.6} fill={pin ? pin.color ?? '#B5502B' : dark ? '#8A7C6C' : '#A8977F'} stroke={dark ? '#1E1813' : '#FFF'} strokeWidth="0.6" />
              {pin?.count !== undefined && (
                <text y="0.75" fontSize="2" fontWeight="700" textAnchor="middle" fill="#fff">
                  {pin.count}
                </text>
              )}
              <text
                x={r.map.x > 80 ? -3.2 : 3.2}
                y="0.9"
                fontSize="2.55"
                fontWeight={active ? 700 : 600}
                textAnchor={r.map.x > 80 ? 'end' : 'start'}
                fill={dark ? (active ? '#fff' : 'rgba(255,255,255,0.75)') : active ? '#1A1612' : '#4A433A'}
                style={{ fontFamily: '"Plus Jakarta Sans Variable", sans-serif' }}
              >
                {pin?.label ?? r.name}
              </text>
              {pin?.sub && (
                <text
                  x={r.map.x > 80 ? -3.2 : 3.2}
                  y="3.7"
                  fontSize="2.2"
                  fontWeight={700}
                  textAnchor={r.map.x > 80 ? 'end' : 'start'}
                  fill={dark ? 'rgba(255,255,255,0.9)' : '#B5502B'}
                  style={{ fontFamily: '"Plus Jakarta Sans Variable", sans-serif' }}
                >
                  {pin.sub}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
