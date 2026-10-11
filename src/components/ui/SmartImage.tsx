import { useState, type CSSProperties } from 'react';
import type { CategoryId, ImageRef } from '@/data/types';
import { imageSrcSet, imageUrl } from '@/data/images';
import { CATEGORY_BY_ID } from '@/data/categories';
import { cn } from '@/lib/utils';

interface Props {
  img?: Pick<ImageRef, 'key' | 'i' | 'alt'> | null;
  /** Aspect ratio used for crop requests, e.g. 4/5 */
  aspect?: number;
  width?: number;
  sizes?: string;
  className?: string;
  imgClassName?: string;
  category?: CategoryId;
  priority?: boolean;
  style?: CSSProperties;
  zoom?: boolean;
}

/**
 * Lazy, responsive photo with a warm placeholder and an intentional
 * branded fallback if the CDN is unreachable (offline demos).
 */
export function SmartImage({ img, aspect, width = 1200, sizes = '100vw', className, imgClassName, category, priority, style, zoom }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const src = imageUrl(img, width, aspect ? Math.round(width / aspect) : undefined);
  const srcSet = imageSrcSet(img, [400, 700, 1000, 1400, 1900].filter((w) => w <= width * 1.6), aspect);
  const theme = category ? CATEGORY_BY_ID[category].theme : null;

  return (
    <div className={cn('relative overflow-hidden bg-sand-200', className)} style={style}>
      {(!loaded || failed || !src) && (
        <div
          aria-hidden
          className={cn('absolute inset-0', !failed && src && 'animate-pulse')}
          style={{ background: theme ? theme.gradient : 'linear-gradient(160deg,#E9DDC8,#D9C6A5)' }}
        >
          <div className="pattern-girih-light absolute inset-0 opacity-60" />
          {(failed || !src) && category && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-arabic text-5xl text-white/30">{CATEGORY_BY_ID[category].arabic}</span>
            </div>
          )}
        </div>
      )}
      {src && !failed && (
        <img
          src={src}
          srcSet={srcSet || undefined}
          sizes={sizes}
          alt={img?.alt ?? ''}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          // @ts-expect-error fetchpriority is valid HTML
          fetchpriority={priority ? 'high' : undefined}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-[1200ms] ease-out-expo',
            loaded ? 'opacity-100' : 'opacity-0',
            zoom && 'group-hover:scale-[1.045]',
            imgClassName,
          )}
        />
      )}
    </div>
  );
}
