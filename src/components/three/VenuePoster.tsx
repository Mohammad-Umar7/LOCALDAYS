import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** Mirrors FRAMING_SPLIT in three/core/SceneCanvas — duplicated so this file never pulls in three.js. */
const FRAMING_SPLIT = 1.2;

export type PosterFraming = 'wide' | 'tall';
export const posterSrc = (providerId: string, framing: PosterFraming) => `/posters/${providerId}-${framing}.webp`;

/**
 * A still of the venue, rendered at the exact camera pose the live scene opens on, shown
 * instantly while the 3D builds behind it. Posters are wider than any box they fill, and with
 * a fixed vertical field of view `object-fit: cover` is then an exact centre crop of the live
 * view — so fading the poster out reveals the same picture, now interactive.
 */
export function VenuePoster({
  providerId,
  hidden = false,
  lazy = false,
  className,
  onError,
}: {
  providerId: string;
  hidden?: boolean;
  /** Below-the-fold posters load when they near the viewport */
  lazy?: boolean;
  className?: string;
  onError?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Measured before first paint, so a phone never downloads the wide poster first
  const [framing, setFraming] = useState<PosterFraming | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setFraming(r.width / r.height >= FRAMING_SPLIT ? 'wide' : 'tall');
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 transition-opacity duration-700 ease-out', hidden ? 'opacity-0' : 'opacity-100', className)}
    >
      {framing && (
        <img
          src={posterSrc(providerId, framing)}
          alt=""
          draggable={false}
          decoding="async"
          loading={lazy ? 'lazy' : 'eager'}
          // @ts-expect-error fetchpriority is valid HTML
          fetchpriority={lazy ? 'auto' : 'high'}
          onError={onError}
          className="h-full w-full select-none object-cover"
        />
      )}
    </div>
  );
}
