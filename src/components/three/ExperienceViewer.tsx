import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Box, ChevronLeft, ChevronRight, Expand, Hand, Loader2, Minimize2, Minus, MousePointer2, Plus, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { HotspotRecord, Provider } from '@/data/types';
import { CATEGORY_BY_ID } from '@/data/categories';
import { EXPERIENCE_BY_ID, PRODUCT_BY_ID } from '@/data/catalog';
import { SceneCanvas, type ViewerApi } from '@/three/core/SceneCanvas';
import type { Variant } from '@/three/core/types';
import { aed, fmtDate } from '@/lib/format';
import { useAvailabilityCtx } from '@/store/app';
import { upcomingOpenDates } from '@/services/availability';
import { SmartImage } from '@/components/ui/SmartImage';
import { VenuePoster } from './VenuePoster';
import { cn } from '@/lib/utils';

function useIsTouch() {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    setTouch(window.matchMedia('(pointer: coarse)').matches);
  }, []);
  return touch;
}

export interface ExperienceViewerProps {
  provider: Provider;
  className?: string;
  active?: string | null;
  onSelect?: (id: string | null) => void;
  variant?: Variant;
  /** Render the built-in hotspot info card */
  panel?: boolean;
  chips?: boolean;
  intro?: boolean;
  dark?: boolean;
}

const LOADING_LINES: Record<string, string[]> = {
  farm: ['Planting the date palms…', 'Raising the barjeel…', 'Filling the falaj…'],
  apiary: ['Waking the colonies…', 'Planting the wildflowers…', 'Warming the honey…'],
  pottery: ['Wedging the clay…', 'Firing the kiln…', 'Glazing the shelves…'],
  harbour: ['Raising the tide…', 'Mooring the dhow…', 'Drying the nets…'],
  atelier: ['Lighting the mabkhara…', 'Polishing the brass…', 'Blending the oud…'],
};

export function ExperienceViewer({ provider, className, active: activeProp, onSelect, variant, panel = true, chips = true, intro = true, dark = true }: ExperienceViewerProps) {
  const [internal, setInternal] = useState<string | null>(null);
  const active = activeProp !== undefined ? activeProp : internal;
  const select = (id: string | null) => (onSelect ? onSelect(id) : setInternal(id));
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [line, setLine] = useState(0);
  const touch = useIsTouch();
  const api = useRef<ViewerApi | null>(null);
  const cat = CATEGORY_BY_ID[provider.categoryId];
  const hotspots = provider.scene.hotspots;
  const record = hotspots.find((h) => h.id === active) ?? null;
  const lines = LOADING_LINES[provider.scene.id] ?? ['Loading…'];
  // A still of the venue covers the canvas until the live scene is ready (no loading screen)
  const [posterFailed, setPosterFailed] = useState(false);
  const [posterGone, setPosterGone] = useState(false);
  const hasPoster = !posterFailed;

  useEffect(() => {
    if (ready || hasPoster) return;
    const t = setInterval(() => setLine((v) => (v + 1) % lines.length), 1400);
    return () => clearInterval(t);
  }, [ready, hasPoster, lines.length]);

  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => setPosterGone(true), 900);
    return () => window.clearTimeout(t);
  }, [ready]);

  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setExpanded(false);
    window.addEventListener('keydown', esc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', esc);
    };
  }, [expanded]);

  const interactive = !touch || engaged || expanded;

  return (
    <div
      data-viewer
      className={cn(
        'relative overflow-hidden',
        // `isolate` keeps the overlay layers (z-45 chips and controls) inside the viewer so fixed page bars stay on top
        expanded ? 'fixed inset-0 z-[75] rounded-none' : 'isolate rounded-[28px]',
        dark ? 'bg-[#1b140e]' : 'bg-sand-200',
        !expanded && className,
      )}
    >
      <SceneCanvas
        sceneId={provider.scene.id}
        variant={variant ?? provider.scene.variant}
        features={provider.scene.features}
        // No pins in the scene: places are picked from the list and the chip row
        hotspots={[]}
        active={active}
        onSelect={select}
        accent={cat.theme.accent}
        interactive={interactive}
        wheel={expanded}
        // The poster shows the opening pose, so the camera must start there (no dolly-in)
        intro={intro && !hasPoster}
        apiRef={api}
        onReady={() => setReady(true)}
        className="absolute inset-0"
      />

      {hasPoster && !posterGone && (
        <VenuePoster providerId={provider.id} hidden={ready} className="z-[5]" onError={() => setPosterFailed(true)} />
      )}

      {/* Fallback veil, only if a venue has no poster */}
      <AnimatePresence>
        {!ready && !hasPoster && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center text-white"
            style={{ background: cat.theme.gradient }}
          >
            <div className="pattern-girih-light absolute inset-0 opacity-70" />
            <div className="relative flex flex-col items-center">
              <Loader2 className="h-6 w-6 animate-spin text-white/80" />
              <AnimatePresence mode="wait">
                <motion.div
                  key={line}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mt-4 font-display text-[20px] tracking-tight"
                >
                  {lines[line]}
                </motion.div>
              </AnimatePresence>
              <div className="mt-1.5 text-[12px] text-white/60">Building an interactive 3D preview of {provider.name}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[45] flex items-start justify-between gap-3 p-3 md:p-4">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-[11.5px] font-semibold text-white backdrop-blur-md">
            <Box className="h-3.5 w-3.5" /> Illustrative 3D preview
          </span>
          {ready && !touch && !active && (
            <span className="hidden items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5 text-[11.5px] font-medium text-white/80 backdrop-blur-md md:inline-flex">
              <MousePointer2 className="h-3.5 w-3.5" /> Drag to orbit · pick a place below
            </span>
          )}
        </div>
        <div className="pointer-events-auto flex items-center gap-1.5">
          <ViewerButton label="Zoom in" onClick={() => api.current?.zoom(4)}>
            <Plus className="h-4 w-4" />
          </ViewerButton>
          <ViewerButton label="Zoom out" onClick={() => api.current?.zoom(-4)}>
            <Minus className="h-4 w-4" />
          </ViewerButton>
          <ViewerButton
            label="Reset view"
            onClick={() => {
              select(null);
              api.current?.reset();
            }}
          >
            <RotateCcw className="h-4 w-4" />
          </ViewerButton>
          <ViewerButton label={expanded ? 'Exit full screen' : 'Full screen'} onClick={() => setExpanded((v) => !v)}>
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
          </ViewerButton>
        </div>
      </div>

      {/* Touch engagement gate (so the page still scrolls on phones) */}
      {touch && !engaged && !expanded && ready && (
        <button
          onClick={() => setEngaged(true)}
          className="absolute bottom-[72px] left-1/2 z-[45] inline-flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white/95 px-4 py-2.5 text-[13px] font-semibold text-ink shadow-float backdrop-blur"
        >
          <Hand className="h-4 w-4" /> Tap to explore in 3D
        </button>
      )}
      {touch && engaged && !expanded && (
        <button onClick={() => setEngaged(false)} className="absolute right-3 top-14 z-[45] rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-ink shadow-soft">
          Done
        </button>
      )}

      {/* Hotspot chips */}
      {chips && <HotspotChips hotspots={hotspots} active={active} accent={cat.theme.accent} onSelect={select} />}

      {/* Info panel */}
      {panel && (
        <AnimatePresence>
          {record && (
            <motion.div
              key={record.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className={cn(
                'absolute z-[46] overflow-y-auto rounded-3xl bg-paper/95 p-5 text-ink shadow-float backdrop-blur-xl',
                'bottom-16 left-3 right-3 max-h-[58%] md:bottom-auto md:left-auto md:right-4 md:top-16 md:max-h-[calc(100%-140px)] md:w-[360px]',
              )}
            >
              <HotspotDetails record={record} accent={cat.theme.accent} onClose={() => select(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

function HotspotChips({ hotspots, active, accent, onSelect }: { hotspots: HotspotRecord[]; active: string | null; accent: string; onSelect: (id: string | null) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => setEdges({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
    // Map vertical mouse-wheel to horizontal scroll so desktop users can reach every chip
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    el.addEventListener('wheel', wheel, { passive: false });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      el.removeEventListener('wheel', wheel);
      ro.disconnect();
    };
  }, [hotspots.length]);

  // Keep the active chip in view (e.g. when a place is picked from the list beside the viewer)
  useEffect(() => {
    const el = scroller.current;
    const chip = active ? el?.querySelector<HTMLElement>(`[data-hotspot-chip="${active}"]`) : null;
    if (!el || !chip) return;
    el.scrollTo({ left: chip.offsetLeft - (el.clientWidth - chip.offsetWidth) / 2, behavior: 'smooth' });
  }, [active]);

  const page = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.7, behavior: 'smooth' });
  const fade = `linear-gradient(to right, ${edges.left ? 'transparent, #000 40px' : '#000'}, ${edges.right ? '#000 calc(100% - 40px), transparent' : '#000'})`;

  return (
    <div className="absolute inset-x-0 bottom-0 z-[45] p-3 md:p-4">
      <div className="relative">
        <div ref={scroller} className="no-scrollbar relative flex gap-1.5 overflow-x-auto overscroll-x-contain" style={{ maskImage: fade, WebkitMaskImage: fade }}>
          {hotspots.map((h, i) => (
            <button
              key={h.id}
              data-hotspot-chip={h.id}
              onClick={() => onSelect(active === h.id ? null : h.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-[12.5px] font-semibold backdrop-blur-md transition',
                active === h.id ? 'bg-white text-ink shadow-soft' : 'bg-black/40 text-white hover:bg-black/55',
              )}
            >
              <span className={cn('flex h-4 w-4 items-center justify-center rounded-full text-[9px]', active === h.id ? 'text-white' : 'bg-white/90 text-ink')} style={active === h.id ? { background: accent } : undefined}>
                {i + 1}
              </span>
              {h.title}
            </button>
          ))}
        </div>
        {edges.left && (
          <button onClick={() => page(-1)} aria-label="Scroll left" className="absolute left-0 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-ink shadow-soft transition hover:bg-white">
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {edges.right && (
          <button onClick={() => page(1)} aria-label="Scroll right" className="absolute right-0 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-ink shadow-soft transition hover:bg-white">
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function ViewerButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition hover:bg-black/60"
    >
      {children}
    </button>
  );
}

export function HotspotDetails({ record, accent, onClose }: { record: HotspotRecord; accent: string; onClose?: () => void }) {
  const ctx = useAvailabilityCtx();
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: accent }}>
            {record.kicker}
          </div>
          <h3 className="mt-1 font-display text-[24px] leading-tight tracking-tight">{record.title}</h3>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close" className="rounded-full bg-ink/5 p-1.5 text-ink hover:bg-ink/10">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{record.summary}</p>
      {!!record.photos?.length && (
        <div className="mt-3">
          <div className={cn('grid gap-1.5', record.photos.length === 1 ? 'grid-cols-1' : 'grid-cols-3')}>
            {record.photos.map((ph, i) => (
              <SmartImage key={`${ph.key}-${i}`} img={ph} aspect={record.photos!.length === 1 ? 16 / 7 : 1} width={320} className={cn('overflow-hidden rounded-xl', record.photos!.length === 1 ? 'aspect-[16/7]' : 'aspect-square')} />
            ))}
          </div>
          <div className="mt-1 text-[10.5px] text-ink-4">Illustrative photos — not the demo host’s property</div>
        </div>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-2">
        {record.facts.map((f) => (
          <div key={f.label} className="rounded-2xl bg-white px-3 py-2.5 shadow-ring">
            <dt className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-3">{f.label}</dt>
            <dd className="mt-0.5 text-[13px] font-semibold leading-snug">{f.value}</dd>
          </div>
        ))}
      </dl>
      {record.bullets && (
        <ul className="mt-3 space-y-1.5">
          {record.bullets.map((b) => (
            <li key={b} className="flex gap-2 text-[13px] text-ink-2">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
              {b}
            </li>
          ))}
        </ul>
      )}
      {!!record.experienceIds?.length && (
        <div className="mt-4 space-y-2">
          {record.experienceIds.map((id) => {
            const e = EXPERIENCE_BY_ID[id];
            if (!e) return null;
            const open = upcomingOpenDates(e, Math.min(2, e.maxGuests), ctx, 3, 30);
            return (
              <Link key={id} to={`/book/${id}`} className="group flex items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-paper transition hover:bg-ink/90">
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold">{e.title}</span>
                  <span className="block text-[12px] text-paper/60">
                    {aed(e.price)} {e.priceUnit === 'per_guest' ? '/ guest' : e.priceUnit === 'per_night' ? '/ night' : '/ booking'}
                  </span>
                  <span className="mt-1 flex items-center gap-1 text-[11px] text-paper/70">
                    <span className="h-1.5 w-1.5 rounded-full bg-oasis-400" />
                    {open.length ? `Open ${open.map((d) => fmtDate(d.date, 'EEE d')).join(' · ')}` : 'Fully booked for 30 days'}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-honey-300">
                  Book <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      )}
      {!!record.productIds?.length && (
        <div className="mt-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">Take it home</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {record.productIds.map((id) => {
              const p = PRODUCT_BY_ID[id];
              if (!p) return null;
              return (
                <span key={id} className="rounded-full bg-white px-2.5 py-1 text-[12px] font-medium shadow-ring">
                  {p.name} · {aed(p.subscription?.price ?? p.price)}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
