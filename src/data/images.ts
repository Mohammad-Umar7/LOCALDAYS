import type { ImageRef } from './types';
import { PHOTOS } from './photos';

export function photoFor(ref?: Pick<ImageRef, 'key' | 'i'> | null) {
  if (!ref) return null;
  const list = PHOTOS[ref.key];
  if (!list?.length) return null;
  return list[(ref.i ?? 0) % list.length];
}

/** Widths saved in public/photos by scripts/download-photos.mjs, so photos load without internet. */
const LOCAL_WIDTHS = [800, 1600] as const;
const localUrl = (id: string, w: (typeof LOCAL_WIDTHS)[number]) => `/photos/${id}-${w}.avif`;

/**
 * The local copy of a photo that best covers the requested width. Copies are uncropped:
 * images render with object-fit: cover, so the crop happens in CSS.
 */
export function imageUrl(ref: Pick<ImageRef, 'key' | 'i'> | null | undefined, w = 1200) {
  const p = photoFor(ref);
  if (!p) return null;
  return localUrl(p.id, LOCAL_WIDTHS.find((lw) => lw >= w) ?? LOCAL_WIDTHS[LOCAL_WIDTHS.length - 1]);
}

export function imageSrcSet(ref: Pick<ImageRef, 'key' | 'i'> | null | undefined) {
  const p = photoFor(ref);
  if (!p) return '';
  return LOCAL_WIDTHS.map((w) => `${localUrl(p.id, w)} ${w}w`).join(', ');
}
