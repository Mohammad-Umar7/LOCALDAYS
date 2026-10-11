import { useId } from 'react';
import type { CategoryId } from '@/data/types';
import { CATEGORY_BY_ID } from '@/data/categories';
import { cn } from '@/lib/utils';

/** Inner illustration for each tradition, drawn on a 200×200 canvas centred at 100,100. */
function Art({ id }: { id: CategoryId }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (id) {
    case 'farm':
      return (
        <g {...s}>
          <circle cx="122" cy="84" r="16" strokeWidth="2" opacity="0.55" />
          <path d="M98 142c-1-20 1-34 6-48" strokeWidth="3.4" />
          <path d="M100 136h6M99 126h7M100 116h6M101 106h6" strokeWidth="1.6" opacity="0.7" />
          <path d="M104 94c-8-12-22-15-34-8" />
          <path d="M104 94c4-12 17-18 30-14" />
          <path d="M104 94c-7-4-19-2-26 9" />
          <path d="M104 94c9-2 21 2 26 13" />
          <path d="M104 94c0-11-4-20-13-26" />
          <path d="M104 94c4-9 11-14 19-15" />
          <circle cx="96" cy="101" r="2.2" fill="currentColor" />
          <circle cx="100" cy="104" r="2.2" fill="currentColor" />
          <circle cx="93" cy="105" r="2.2" fill="currentColor" />
          <path d="M66 142h68" strokeWidth="2.2" />
          <path d="M72 148c6-3 10 3 16 0s10 3 16 0 10 3 16 0 9 3 14 0" strokeWidth="1.6" opacity="0.7" />
        </g>
      );
    case 'honey':
      return (
        <g {...s}>
          {[
            [86, 92],
            [114, 92],
            [100, 116],
            [72, 116],
            [128, 116],
            [86, 140],
            [114, 140],
          ].map(([x, y], i) => (
            <path key={i} d={`M${x} ${y - 13}l11.3 6.5v13l-11.3 6.5-11.3-6.5v-13z`} strokeWidth={i === 2 ? 3 : 2.2} />
          ))}
          <path d="M100 109v14" strokeWidth="1.4" opacity="0.6" />
          <g transform="translate(130 70) rotate(-25)">
            <ellipse cx="0" cy="0" rx="9" ry="6" fill="currentColor" stroke="none" />
            <path d="M-3 -6v12M2 -5.5v11" stroke="#fff" strokeWidth="1.6" />
            <ellipse cx="-2" cy="-10" rx="7" ry="4" strokeWidth="1.6" />
            <ellipse cx="5" cy="-9" rx="6" ry="3.5" strokeWidth="1.6" />
          </g>
          <path d="M60 72c10 2 18-4 26 0" strokeWidth="1.4" strokeDasharray="2 4" opacity="0.7" />
        </g>
      );
    case 'pottery':
      return (
        <g {...s}>
          <path d="M90 62h20" strokeWidth="3" />
          <path d="M92 62v8c0 5-16 12-16 34 0 20 10 34 24 34s24-14 24-34c0-22-16-29-16-34v-8" strokeWidth="3" />
          <path d="M78 98h44" strokeWidth="2" />
          <path d="M80 106l6-6 6 6 6-6 6 6 6-6 6 6 6-6" strokeWidth="1.6" />
          <path d="M77 114h46" strokeWidth="2" />
          <ellipse cx="100" cy="148" rx="34" ry="5" strokeWidth="2.2" />
          <path d="M66 156h68" strokeWidth="1.6" opacity="0.6" />
        </g>
      );
    case 'coastal':
      return (
        <g {...s}>
          <circle cx="76" cy="78" r="12" strokeWidth="2" opacity="0.55" />
          <path d="M100 124V62" strokeWidth="2.6" />
          <path d="M101 63c-19 17-31 37-37 58h37z" fill="currentColor" fillOpacity="0.12" />
          <path d="M101 70l26 50" strokeWidth="1.6" opacity="0.6" />
          <path d="M60 124h82l-12 16H72z" strokeWidth="3" />
          <path d="M142 124l8-10" strokeWidth="2.4" />
          <path d="M56 150c8 0 8-5 16-5s8 5 16 5 8-5 16-5 8 5 16 5 8-5 16-5 8 5 12 5" strokeWidth="2" />
          <path d="M64 160c8 0 8-4 16-4s8 4 16 4 8-4 16-4 8 4 16 4 8-4 16-4" strokeWidth="1.4" opacity="0.6" />
        </g>
      );
    case 'fragrance':
      return (
        <g {...s}>
          <path d="M70 116h60l-9 22H79z" strokeWidth="3" />
          <path d="M88 138v8h24v-8" strokeWidth="2.6" />
          <path d="M80 152h40" strokeWidth="2.6" />
          <path d="M74 116l26-10 26 10" strokeWidth="1.6" opacity="0.6" />
          <path d="M90 102c-7-9 7-14 0-24s4-14 2-22" strokeWidth="2" />
          <path d="M104 100c-6-9 7-13 0-22s5-12 3-19" strokeWidth="2" opacity="0.8" />
          <path d="M116 104c-5-7 5-11 0-18" strokeWidth="1.6" opacity="0.6" />
          <path d="M136 92h12v6c4 2 6 6 6 12v20h-24v-20c0-6 2-10 6-12z" strokeWidth="2" />
          <path d="M139 86h6v6h-6z" strokeWidth="2" />
        </g>
      );
  }
}

interface StampProps {
  id: CategoryId;
  earned?: boolean;
  date?: string;
  region?: string;
  size?: number;
  rotate?: number;
  className?: string;
  /** Stamp ink colour (defaults to the category accent) */
  ink?: string;
}

export function Stamp({ id, earned = true, date, region, size = 180, rotate = -8, className, ink }: StampProps) {
  const uid = useId().replace(/:/g, '');
  const cat = CATEGORY_BY_ID[id];
  const color = earned ? ink ?? cat.theme.accent : '#B9AE9E';
  const ring = `${cat.stamp.title.toUpperCase()} · ${region?.toUpperCase() ?? 'SHARJAH'} · LOCALDAYS PASSPORT · `;
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      style={{ transform: `rotate(${rotate}deg)`, color }}
      role="img"
      aria-label={`${cat.stamp.title} stamp${earned ? '' : ' (not yet earned)'}`}
    >
      <defs>
        <filter id={`ink-${uid}`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={id.length * 7} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={earned ? 2.2 : 0} xChannelSelector="R" yChannelSelector="G" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed={id.length * 3} result="blot" />
          <feColorMatrix in="blot" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.62" result="mask" />
          <feComposite in="d" in2="mask" operator="in" />
        </filter>
        <path id={`ring-${uid}`} d="M100,100 m-74,0 a74,74 0 1,1 148,0 a74,74 0 1,1 -148,0" />
      </defs>
      <g filter={`url(#ink-${uid})`} opacity={earned ? 1 : 0.5}>
        <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={earned ? undefined : '4 5'} />
        <circle cx="100" cy="100" r="88" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="100" cy="100" r="62" fill="none" stroke="currentColor" strokeWidth="1.8" />
        {Array.from({ length: 48 }).map((_, i) => {
          const a = (i / 48) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={100 + Math.cos(a) * 62}
              y1={100 + Math.sin(a) * 62}
              x2={100 + Math.cos(a) * 65.5}
              y2={100 + Math.sin(a) * 65.5}
              stroke="currentColor"
              strokeWidth="1.2"
            />
          );
        })}
        <text
          fill="currentColor"
          fontSize={Math.min(11.2, 455 / (ring.length * 0.8))}
          fontWeight="700"
          letterSpacing="1.6"
          style={{ fontFamily: '"Plus Jakarta Sans Variable", sans-serif' }}
        >
          <textPath href={`#ring-${uid}`} startOffset="0" textLength={455} lengthAdjust="spacing">
            {ring}
          </textPath>
        </text>
        <g transform="translate(15 4) scale(0.85)">
          <Art id={id} />
        </g>
        {date && (
          <text x="100" y="153" textAnchor="middle" fill="currentColor" fontSize="9.5" fontWeight="700" letterSpacing="1.6" style={{ fontFamily: '"Plus Jakarta Sans Variable", sans-serif' }}>
            {date.toUpperCase()}
          </text>
        )}
      </g>
    </svg>
  );
}
