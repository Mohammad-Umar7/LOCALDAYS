import type { Region, RegionId } from './types';

export const REGIONS: Region[] = [
  {
    id: 'sharjah-city',
    name: 'Sharjah City',
    arabic: 'مدينة الشارقة',
    zone: 'West coast',
    blurb: 'Heritage quarters, souqs and studios in the heart of the emirate.',
    map: { x: 17, y: 44 },
  },
  {
    id: 'al-hamriyah',
    name: 'Al Hamriyah',
    arabic: 'الحمرية',
    zone: 'West coast',
    blurb: 'A quiet fishing town with a working harbour on the Arabian Gulf.',
    map: { x: 27, y: 22 },
  },
  {
    id: 'al-dhaid',
    name: 'Al Dhaid',
    arabic: 'الذيد',
    zone: 'Central',
    blurb: 'The agricultural heart of Sharjah — date groves and winter vegetables.',
    map: { x: 47, y: 40 },
  },
  {
    id: 'mleiha',
    name: 'Mleiha',
    arabic: 'مليحة',
    zone: 'Central',
    blurb: 'Desert plains, ancient history and farms at the edge of the dunes.',
    map: { x: 51, y: 62 },
  },
  {
    id: 'al-madam',
    name: 'Al Madam',
    arabic: 'المدام',
    zone: 'Central',
    blurb: 'Red dunes, date estates and wide desert skies.',
    map: { x: 40, y: 80 },
  },
  {
    id: 'wadi-al-helo',
    name: 'Wadi Al Helo',
    arabic: 'وادي الحلو',
    zone: 'East coast',
    blurb: 'Mountain wadis where Sidr and Samar trees feed the bees.',
    map: { x: 70, y: 56 },
  },
  {
    id: 'kalba',
    name: 'Kalba',
    arabic: 'كلباء',
    zone: 'East coast',
    blurb: 'Mangroves, mountains and fishing traditions on the Gulf of Oman.',
    map: { x: 86, y: 70 },
  },
  {
    id: 'khor-fakkan',
    name: 'Khor Fakkan',
    arabic: 'خورفكان',
    zone: 'East coast',
    blurb: 'A bay framed by the Hajar mountains with a proud maritime past.',
    map: { x: 89, y: 42 },
  },
  {
    id: 'dibba-al-hisn',
    name: 'Dibba Al Hisn',
    arabic: 'دبا الحصن',
    zone: 'East coast',
    blurb: 'The northern east coast, where boats leave at first light.',
    map: { x: 85, y: 14 },
  },
];

export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<RegionId, Region>;

/**
 * Approximate drive times in minutes between neighbouring regions.
 * Shortest paths between any two regions are derived from this graph.
 */
const EDGES: [RegionId, RegionId, number][] = [
  ['sharjah-city', 'al-hamriyah', 30],
  ['sharjah-city', 'al-dhaid', 45],
  ['sharjah-city', 'mleiha', 50],
  ['sharjah-city', 'al-madam', 55],
  ['al-hamriyah', 'al-dhaid', 45],
  ['al-dhaid', 'mleiha', 20],
  ['al-dhaid', 'al-madam', 35],
  ['mleiha', 'al-madam', 25],
  ['al-dhaid', 'khor-fakkan', 40],
  ['al-dhaid', 'wadi-al-helo', 35],
  ['mleiha', 'wadi-al-helo', 35],
  ['wadi-al-helo', 'kalba', 25],
  ['kalba', 'khor-fakkan', 25],
  ['khor-fakkan', 'dibba-al-hisn', 40],
  ['al-dhaid', 'dibba-al-hisn', 60],
];

const ids = REGIONS.map((r) => r.id);
const INF = 1e9;
const dist: Record<string, Record<string, number>> = {};
for (const a of ids) {
  dist[a] = {};
  for (const b of ids) dist[a][b] = a === b ? 0 : INF;
}
for (const [a, b, m] of EDGES) {
  dist[a][b] = Math.min(dist[a][b], m);
  dist[b][a] = Math.min(dist[b][a], m);
}
for (const k of ids) for (const i of ids) for (const j of ids) {
  if (dist[i][k] + dist[k][j] < dist[i][j]) dist[i][j] = dist[i][k] + dist[k][j];
}

export function driveMinutes(a: RegionId, b: RegionId): number {
  return dist[a]?.[b] ?? 60;
}
