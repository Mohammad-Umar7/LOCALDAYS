import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Deterministic 32-bit hash for strings (FNV-1a). */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 seeded PRNG. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seeded(key: string) {
  return mulberry32(hashString(key));
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

export function round(n: number, dp = 0) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeRef(prefix: string) {
  let s = '';
  for (let i = 0; i < 5; i++) s += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
  return `${prefix}-${s}`;
}

export function makeCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function pluralize(n: number, one: string, many?: string) {
  return `${n} ${n === 1 ? one : many ?? `${one}s`}`;
}

export function initials(name: string) {
  return name
    .split(/\s+|&/)
    .filter(Boolean)
    .map((p) => p[0]?.toUpperCase())
    .slice(0, 2)
    .join('');
}

const GENERIC_TAIL = new Set(['farmstay', 'farm', 'apiary', 'studio', 'works', 'atelier', 'perfumery', 'heritage', 'estate', 'garden', 'life', 'line', 'house', 'clay', 'coastal']);

/** "Wadi Hives Apiary" → "Wadi Hives", "Saffron & Smoke Perfumery" → "Saffron & Smoke", "Mabkhara House" → "Mabkhara House". */
const SHORT_NAME_OVERRIDES: Record<string, string> = {
  'Rimal Date Estate': 'Rimal Estate',
  'Dhaid Bee Garden': 'Dhaid Bee Garden',
  'Dibba Sea Line': 'Dibba Sea Line',
};

export function shortProviderName(name: string) {
  if (SHORT_NAME_OVERRIDES[name]) return SHORT_NAME_OVERRIDES[name];
  const words = name.split(' ');
  if (words.length <= 2) return name;
  let out = words.slice(0, 3);
  while (out.length > 2 && GENERIC_TAIL.has(out[out.length - 1].toLowerCase())) out = out.slice(0, -1);
  if (out.length === 3 && !out.includes('&')) out = out.slice(0, 2);
  return out.join(' ');
}
