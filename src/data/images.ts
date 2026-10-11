import type { ImageRef } from './types';
import { PHOTOS } from './photos';

export function photoFor(ref?: Pick<ImageRef, 'key' | 'i'> | null) {
  if (!ref) return null;
  const list = PHOTOS[ref.key];
  if (!list?.length) return null;
  return list[(ref.i ?? 0) % list.length];
}

/** Builds an Unsplash CDN URL at the requested size. */
export function imageUrl(ref: Pick<ImageRef, 'key' | 'i'> | null | undefined, w = 1200, h?: number, q = 72) {
  const p = photoFor(ref);
  if (!p) return null;
  return `https://images.unsplash.com/${p.id}?auto=format&fit=crop&crop=entropy&w=${w}${h ? `&h=${h}` : ''}&q=${q}`;
}

export function imageSrcSet(ref: Pick<ImageRef, 'key' | 'i'> | null | undefined, widths: number[], aspect?: number) {
  return widths
    .map((w) => {
      const u = imageUrl(ref, w, aspect ? Math.round(w / aspect) : undefined);
      return u ? `${u} ${w}w` : '';
    })
    .filter(Boolean)
    .join(', ');
}
