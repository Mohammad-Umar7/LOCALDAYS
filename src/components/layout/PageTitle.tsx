import { useEffect } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { BRAND } from '@/config/brand';
import { CATEGORY_BY_ID } from '@/data/categories';
import { EXPERIENCE_BY_ID, PROVIDER_BY_SLUG } from '@/data/catalog';

const STATIC: [string, string][] = [
  ['/experiences', 'All experiences'],
  ['/checkout', 'Checkout'],
  ['/me/*', 'My LocalDays'],
  ['/me', 'My LocalDays'],
  ['/passport', `${BRAND.name} Passport`],
  ['/compose', 'Day Composer'],
  ['/host/*', 'Host dashboard'],
  ['/host', 'Host dashboard'],
  ['/impact', 'Business model & impact'],
  ['/how-it-works', `How ${BRAND.name} works`],
  ['/hosts', `Host on ${BRAND.name}`],
];

function titleFor(pathname: string): string {
  if (pathname === '/') return `${BRAND.name} — ${BRAND.tagline}`;
  const cat = matchPath('/c/:categoryId', pathname);
  if (cat) return CATEGORY_BY_ID[cat.params.categoryId as keyof typeof CATEGORY_BY_ID]?.name ?? 'Experiences';
  const shop = matchPath('/p/:slug/shop', pathname);
  if (shop) return `${PROVIDER_BY_SLUG[shop.params.slug!]?.name ?? 'Host'} shop`;
  const prov = matchPath('/p/:slug', pathname);
  if (prov) return PROVIDER_BY_SLUG[prov.params.slug!]?.name ?? 'Host';
  const book = matchPath('/book/:experienceId', pathname);
  if (book) return `Book · ${EXPERIENCE_BY_ID[book.params.experienceId!]?.title ?? 'Experience'}`;
  if (matchPath('/confirmation/:ref', pathname)) return 'Confirmed';
  for (const [pattern, t] of STATIC) if (matchPath(pattern, pathname)) return t;
  return 'Page not found';
}

/** Keeps the browser tab title in step with the route. */
export function PageTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const t = titleFor(pathname);
    document.title = pathname === '/' ? t : `${t} · ${BRAND.name}`;
  }, [pathname]);
  return null;
}
