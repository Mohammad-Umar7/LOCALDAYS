import { scaleBand, scaleLinear } from 'd3-scale';
import { area as d3area, curveMonotoneX, line as d3line } from 'd3-shape';
import { motion } from 'framer-motion';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Charts built to the LocalDays data-viz spec: categorical hues in a  */
/*  fixed, validated order; thin marks; 4px rounded data-ends; 2px      */
/*  surface gaps; hairline grid; legend for ≥2 series; text in ink.     */
/*  Palette validated (light, white surface): all checks pass; slot 4   */
/*  is below 3:1 contrast so every chart ships a legend + table view.  */
/* ------------------------------------------------------------------ */

export const SERIES = ['#C0532B', '#2A78D6', '#1A9E6E', '#D19400'] as const;
const GRID = '#ECE6DC';
const AXIS_TEXT = '#857A6C';

export interface SeriesDef {
  key: string;
  label: string;
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(640);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(Math.max(260, el.getBoundingClientRect().width));
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, w };
}

const fmtShort = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${Math.round(n)}`);

export function Legend({ series, className }: { series: SeriesDef[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {series.map((s, i) => (
        <span key={s.key} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: SERIES[i % SERIES.length] }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function Tooltip({ x, y, children, width }: { x: number; y: number; children: ReactNode; width: number }) {
  const left = Math.min(Math.max(x, 90), width - 90);
  return (
    <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl bg-ink px-3 py-2 text-[12px] text-paper shadow-float" style={{ left, top: y - 10 }}>
      {children}
    </div>
  );
}

/* -------------------------------- Stacked columns -------------------------------- */

export function StackedColumns({
  data,
  series,
  height = 240,
  format = (n: number) => `AED ${Math.round(n).toLocaleString()}`,
  highlightLast = true,
}: {
  data: { label: string; values: Record<string, number> }[];
  series: SeriesDef[];
  height?: number;
  format?: (n: number) => string;
  highlightLast?: boolean;
}) {
  const { ref, w } = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const m = { t: 12, r: 8, b: 26, l: 44 };
  const iw = w - m.l - m.r;
  const ih = height - m.t - m.b;
  const totals = data.map((d) => series.reduce((s, x) => s + (d.values[x.key] ?? 0), 0));
  const y = scaleLinear().domain([0, Math.max(1, ...totals) * 1.08]).nice(4).range([ih, 0]);
  const x = scaleBand<number>().domain(data.map((_, i) => i)).range([0, iw]).paddingInner(0.35).paddingOuter(0.15);
  const bw = Math.min(24, x.bandwidth());
  const ticks = y.ticks(4);

  return (
    <div ref={ref} className="relative w-full">
      <svg width={w} height={height} role="img" aria-label="Stacked revenue by week">
        <g transform={`translate(${m.l},${m.t})`}>
          {ticks.map((t) => (
            <g key={t} transform={`translate(0,${y(t)})`}>
              <line x2={iw} stroke={GRID} strokeWidth={1} />
              <text x={-8} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS_TEXT} className="tabular">
                {fmtShort(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            let acc = 0;
            const cx = (x(i) ?? 0) + x.bandwidth() / 2;
            const segs = series.map((s, si) => {
              const v = d.values[s.key] ?? 0;
              const y0 = y(acc);
              acc += v;
              const y1 = y(acc);
              return { si, v, y0, y1 };
            });
            const topIdx = [...segs].reverse().find((s) => s.v > 0)?.si;
            const dim = hover !== null && hover !== i;
            return (
              <g key={i} opacity={dim ? 0.45 : highlightLast && hover === null && i !== data.length - 1 ? 0.85 : 1}>
                {segs.map(({ si, v, y0, y1 }) => {
                  if (v <= 0) return null;
                  const hgt = Math.max(0, y0 - y1 - 2); // 2px surface gap between segments
                  const isTop = si === topIdx;
                  const r = isTop ? Math.min(4, hgt / 2, bw / 2) : 0;
                  const x0 = cx - bw / 2;
                  const top = y1;
                  const path = isTop
                    ? `M${x0},${top + hgt} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + bw - r} Q${x0 + bw},${top} ${x0 + bw},${top + r} V${top + hgt} Z`
                    : `M${x0},${top} H${x0 + bw} V${top + hgt} H${x0} Z`;
                  return (
                    <motion.path
                      key={si}
                      d={path}
                      fill={SERIES[si % SERIES.length]}
                      initial={{ opacity: 0, scaleY: 0.2 }}
                      animate={{ opacity: 1, scaleY: 1 }}
                      transition={{ duration: 0.6, delay: i * 0.025 }}
                      style={{ transformOrigin: `${cx}px ${ih}px` }}
                    />
                  );
                })}
                <rect x={x(i)} y={0} width={x.bandwidth()} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
                {(i % Math.ceil(data.length / 7) === 0 || i === data.length - 1) && (
                  <text x={cx} y={ih + 18} textAnchor="middle" fontSize={11} fill={AXIS_TEXT}>
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      {hover !== null && (
        <Tooltip x={m.l + (x(hover) ?? 0) + x.bandwidth() / 2} y={m.t + y(totals[hover])} width={w}>
          <div className="font-semibold">{data[hover].label}</div>
          {series.map((s, si) => (
            <div key={s.key} className="mt-0.5 flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 text-paper/75">
                <span className="h-2 w-2 rounded-[2px]" style={{ background: SERIES[si] }} />
                {s.label}
              </span>
              <span className="tabular">{format(data[hover].values[s.key] ?? 0)}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between gap-4 border-t border-white/15 pt-1 font-semibold">
            <span>Total</span>
            <span className="tabular">{format(totals[hover])}</span>
          </div>
        </Tooltip>
      )}
    </div>
  );
}

/* -------------------------------- Line / area -------------------------------- */

export function LineArea({
  data,
  height = 200,
  color = SERIES[0],
  format = (n: number) => `${Math.round(n)}`,
  label,
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  format?: (n: number) => string;
  label: string;
}) {
  const { ref, w } = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const m = { t: 14, r: 40, b: 26, l: 36 };
  const iw = w - m.l - m.r;
  const ih = height - m.t - m.b;
  const x = scaleLinear().domain([0, Math.max(1, data.length - 1)]).range([0, iw]);
  const y = scaleLinear().domain([0, Math.max(1, ...data.map((d) => d.value)) * 1.15]).nice(4).range([ih, 0]);
  const lineD = d3line<{ value: number }>().x((_, i) => x(i)).y((d) => y(d.value)).curve(curveMonotoneX)(data) ?? '';
  const areaD = d3area<{ value: number }>().x((_, i) => x(i)).y0(ih).y1((d) => y(d.value)).curve(curveMonotoneX)(data) ?? '';
  const last = data[data.length - 1];
  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setHover(null)}>
      <svg
        width={w}
        height={height}
        role="img"
        aria-label={label}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const i = Math.round(x.invert(e.clientX - r.left - m.l));
          setHover(Math.max(0, Math.min(data.length - 1, i)));
        }}
      >
        <g transform={`translate(${m.l},${m.t})`}>
          {y.ticks(4).map((t) => (
            <g key={t} transform={`translate(0,${y(t)})`}>
              <line x2={iw} stroke={GRID} />
              <text x={-8} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS_TEXT}>
                {fmtShort(t)}
              </text>
            </g>
          ))}
          <path d={areaD} fill={color} opacity={0.1} />
          <motion.path d={lineD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1 }} />
          {last && (
            <>
              <circle cx={x(data.length - 1)} cy={y(last.value)} r={4.5} fill={color} stroke="#fff" strokeWidth={2} />
              <text x={x(data.length - 1) + 8} y={y(last.value)} dy="0.32em" fontSize={12} fontWeight={600} fill="#1A1612">
                {format(last.value)}
              </text>
            </>
          )}
          {data.map((d, i) =>
            i % Math.ceil(data.length / 6) === 0 || i === data.length - 1 ? (
              <text key={i} x={x(i)} y={ih + 18} textAnchor="middle" fontSize={11} fill={AXIS_TEXT}>
                {d.label}
              </text>
            ) : null,
          )}
          {hover !== null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={0} y2={ih} stroke="#1A1612" strokeOpacity={0.25} />
              <circle cx={x(hover)} cy={y(data[hover].value)} r={5} fill={color} stroke="#fff" strokeWidth={2} />
            </>
          )}
        </g>
      </svg>
      {hover !== null && (
        <Tooltip x={m.l + x(hover)} y={m.t + y(data[hover].value)} width={w}>
          <span className="font-semibold">{data[hover].label}</span> · <span className="tabular">{format(data[hover].value)}</span>
        </Tooltip>
      )}
    </div>
  );
}

/* -------------------------------- Horizontal bars -------------------------------- */

export function BarList({ items, format = (n: number) => `${Math.round(n)}`, max }: { items: { label: string; value: number; sub?: string; color?: string }[]; format?: (n: number) => string; max?: number }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={it.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="font-medium text-ink-2">{it.label}</span>
            <span className="tabular font-semibold text-ink">
              {format(it.value)}
              {it.sub && <span className="ml-1.5 font-normal text-ink-3">{it.sub}</span>}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-sand-100">
            <motion.div
              className="h-full rounded-full"
              style={{ background: it.color ?? SERIES[0] }}
              initial={{ width: 0 }}
              whileInView={{ width: `${(it.value / top) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- Sparkline -------------------------------- */

export function Sparkline({ values, color = SERIES[0], width = 120, height = 34 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const x = scaleLinear().domain([0, values.length - 1]).range([2, width - 4]);
  const y = scaleLinear().domain([Math.min(...values) * 0.95, Math.max(...values) * 1.05]).range([height - 3, 3]);
  const d = d3line<number>().x((_, i) => x(i)).y((v) => y(v)).curve(curveMonotoneX)(values) ?? '';
  return (
    <svg width={width} height={height} aria-hidden>
      <path d={d} fill="none" stroke="#B3A897" strokeWidth={1.5} />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={3} fill={color} stroke="#fff" strokeWidth={1.5} />
    </svg>
  );
}

/* -------------------------------- Meter -------------------------------- */

export function Meter({ value, max, tone = 'accent', label, sub }: { value: number; max: number; tone?: 'accent' | 'warning' | 'danger' | 'good'; label: string; sub?: string }) {
  const pct = Math.max(0, Math.min(1, value / Math.max(1, max)));
  const fill = tone === 'danger' ? '#D03B3B' : tone === 'warning' ? '#E29400' : tone === 'good' ? '#1A9E6E' : SERIES[0];
  const track = tone === 'danger' ? '#F7D9D9' : tone === 'warning' ? '#FBEACB' : tone === 'good' ? '#D3EFE4' : '#F5D9CB';
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
        <span className="font-medium text-ink-2">{label}</span>
        <span className="tabular font-semibold text-ink">{sub ?? `${Math.round(pct * 100)}%`}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full" style={{ background: track }}>
        <motion.div className="h-full rounded-full" style={{ background: fill }} initial={{ width: 0 }} animate={{ width: `${pct * 100}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
      </div>
    </div>
  );
}

/* -------------------------------- Table view -------------------------------- */

export function DataTable({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[420px] text-left text-[13px]">
        <thead className="bg-sand-50 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">
          <tr>
            {columns.map((c, i) => (
              <th key={c} className={cn('px-4 py-2.5', i > 0 && 'text-right')}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((cell, ci) => (
                <td key={ci} className={cn('px-4 py-2', ci > 0 && 'tabular text-right')}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
