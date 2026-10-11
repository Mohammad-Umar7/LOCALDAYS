import { FlaskConical, Gift, ShieldCheck } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import type { SignatureBlend } from '@/data/types';
import { FORMULA_BY_ID, NOTE_BY_ID } from '@/data/catalog/fragrance';
import { PRODUCT_BY_ID, PROVIDER_BY_ID } from '@/data/catalog';
import { useApp } from '@/store/app';
import { useUI } from '@/store/ui';
import { aed, fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '../ui/Button';

const BlendBottle = lazy(() => import('@/three/scenes/atelier/BlendBottle'));

/** "Your Signature Blend" — a saved, maker-approved formula that can be reordered. */
export function BlendCard({ blend, compact, bottle = 'side' }: { blend: SignatureBlend; compact?: boolean; bottle?: 'side' | 'top' | 'none' }) {
  const formula = FORMULA_BY_ID[blend.formulaId];
  const provider = PROVIDER_BY_ID[blend.providerId];
  const refill = Object.values(PRODUCT_BY_ID).find(
    (p) => p.providerId === blend.providerId && p.kind === 'formula_refill' && (formula.type === 'bukhoor' ? p.id.includes('bukhoor') : !p.id.includes('bukhoor')),
  );
  const [variant, setVariant] = useState(refill?.variants?.[1]?.id ?? refill?.variants?.[0]?.id);
  const add = useApp((s) => s.addProductToCart);
  const setCart = useUI((s) => s.setCartOpen);
  const tiers = { top: [] as typeof blend.accords, heart: [] as typeof blend.accords, base: [] as typeof blend.accords };
  blend.accords.forEach((a) => tiers[NOTE_BY_ID[a.noteId].tier].push(a));
  const price = refill?.variants?.find((v) => v.id === variant)?.price ?? refill?.price ?? 0;
  // Liquid colours run top notes → base notes, weighted by share
  const colors = useMemo(() => {
    const order = { top: 0, heart: 1, base: 2 } as const;
    return [...blend.accords]
      .sort((a, b) => order[NOTE_BY_ID[a.noteId].tier] - order[NOTE_BY_ID[b.noteId].tier])
      .flatMap((a) => Array.from({ length: Math.max(1, Math.round(a.share / 10)) }, () => NOTE_BY_ID[a.noteId].color));
  }, [blend.accords]);

  return (
    <div className={cn('relative overflow-hidden rounded-[28px] bg-[#1F0E15] text-paper', !compact && bottle === 'side' && 'lg:grid lg:grid-cols-[minmax(0,1fr)_300px]')}>
      <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-oud-400/30 blur-3xl" />
      {!compact && bottle !== 'none' && (
        <div className={cn('relative h-[240px]', bottle === 'side' && 'lg:order-2 lg:h-auto lg:min-h-[100%]')}>
          <Suspense fallback={<div className="absolute inset-0 bg-[#140D09]" />}>
            <div className="absolute inset-0">
              <BlendBottle colors={colors} fill={0.86} className="h-full w-full" />
            </div>
          </Suspense>
          <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/40 px-3 py-1 text-[11px] font-semibold text-paper/80 backdrop-blur-md">
            Your blend · illustrative bottle
          </span>
        </div>
      )}
      <div className="relative p-6 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-brass-300">Your Signature Blend</div>
            <div className="mt-2 font-display text-[30px] leading-tight">{blend.name}</div>
            <div className="mt-1 text-[13px] text-paper/55">
              Based on {formula.name} ({formula.type === 'bukhoor' ? 'bukhoor' : 'perfume oil'}) · {provider.name}
            </div>
          </div>
          <div className="shrink-0 rounded-xl border border-brass-400/30 px-3 py-2 text-right">
            <div className="text-[10px] uppercase tracking-[0.14em] text-paper/45">Formula ref</div>
            <div className="font-mono text-[14px] font-semibold text-brass-300">{blend.reference}</div>
          </div>
        </div>

        {/* Accord bar */}
        <div className="mt-6 flex h-3 overflow-hidden rounded-full ring-1 ring-white/10">
          {blend.accords.map((a) => (
            <div key={a.noteId} style={{ width: `${a.share}%`, background: NOTE_BY_ID[a.noteId].color }} title={`${NOTE_BY_ID[a.noteId].name} ${a.share}%`} />
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(['top', 'heart', 'base'] as const).map((t) => (
            <div key={t}>
              <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-paper/40">{t} notes</div>
              <ul className="mt-1.5 space-y-1">
                {tiers[t].map((a) => (
                  <li key={a.noteId} className="flex items-center justify-between gap-2 text-[13.5px]">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: NOTE_BY_ID[a.noteId].color }} />
                      {NOTE_BY_ID[a.noteId].name}
                    </span>
                    <span className="tabular text-paper/55">{a.share}%</span>
                  </li>
                ))}
                {tiers[t].length === 0 && <li className="text-[13px] text-paper/35">—</li>}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-start gap-2 rounded-2xl bg-white/[0.06] p-3 text-[12.5px] text-paper/70">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brass-300" />
          Approved by {blend.approvedBy} on {fmtDate(blend.createdAt, 'd MMM yyyy')}. Saved with your consent; refills are re-blended only from the maker’s approved formulation — never invented.
        </div>

        {!compact && refill && (
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-1.5">
              {refill.variants?.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVariant(v.id)}
                  className={cn('rounded-full px-3.5 py-2 text-[13px] font-semibold transition', variant === v.id ? 'bg-paper text-ink' : 'bg-white/10 text-paper hover:bg-white/15')}
                >
                  {v.name} · {aed(v.price)}
                </button>
              ))}
            </div>
            <div className="flex gap-2 sm:ml-auto">
              <Button
                variant="light"
                icon={<FlaskConical className="h-4 w-4" />}
                onClick={() => {
                  add(refill.id, { variantId: variant });
                  setCart(true);
                }}
              >
                Reorder {aed(price)}
              </Button>
              <Button
                variant="glass"
                icon={<Gift className="h-4 w-4" />}
                onClick={() => {
                  add(refill.id, { variantId: variant });
                  add('ol-giftwrap');
                  setCart(true);
                }}
              >
                Send as a gift
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
