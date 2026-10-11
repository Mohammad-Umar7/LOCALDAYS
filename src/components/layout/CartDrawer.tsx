import { Clock3, Minus, Plus, Repeat, ShoppingBag, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/store/app';
import { useUI } from '@/store/ui';
import { cartTotals, describeCartItem, type CartLineView } from '@/services/cart';
import { aed } from '@/lib/format';
import type { CategoryId } from '@/data/types';
import { Sheet } from '../ui/overlays';
import { Button } from '../ui/Button';
import { SmartImage } from '../ui/SmartImage';
import { EmptyState } from '../ui/primitives';

export function useHoldCountdown(expiresAt?: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  if (!expiresAt) return null;
  const ms = Math.max(0, new Date(expiresAt).getTime() - now);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return { ms, label: `${m}:${String(s).padStart(2, '0')}` };
}

export function CartLine({ line, compact }: { line: CartLineView; compact?: boolean }) {
  const remove = useApp((s) => s.removeFromCart);
  const updateQty = useApp((s) => s.updateCartQty);
  const hold = useHoldCountdown(line.holdExpiresAt);
  return (
    <div className="flex gap-3.5 py-4">
      <SmartImage img={line.image} aspect={1} width={200} className="h-20 w-20 shrink-0 rounded-2xl" category={line.categoryId as CategoryId} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold text-ink-3">{line.provider}</div>
            <div className="line-clamp-2 text-[14.5px] font-semibold leading-snug text-ink">{line.title}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="tabular text-[14.5px] font-semibold text-ink">{aed(line.total)}</div>
            {line.recurring && <div className="text-[11px] text-ink-3">per {line.recurring === 'monthly' ? 'month' : line.recurring === 'weekly' ? 'week' : '2 weeks'}</div>}
          </div>
        </div>
        <div className="mt-1 text-[12.5px] text-ink-3">{line.detail}</div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {hold && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${hold.ms < 120000 ? 'bg-amber-50 text-amber-800' : 'bg-oasis-50 text-oasis-700'}`}>
                <Clock3 className="h-3 w-3" /> Held {hold.label}
              </span>
            )}
            {line.recurring && (
              <span className="inline-flex items-center gap-1 rounded-full bg-honey-100 px-2 py-0.5 text-[11px] font-semibold text-honey-700">
                <Repeat className="h-3 w-3" /> Subscription
              </span>
            )}
            {line.editableQty && !compact && (
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white">
                <button aria-label="Decrease" className="p-1.5" onClick={() => updateQty(line.id, (line.qty ?? 1) - 1)}>
                  <Minus className="h-3 w-3" />
                </button>
                <span className="tabular w-4 text-center text-[12px] font-semibold">{line.qty}</span>
                <button aria-label="Increase" className="p-1.5" onClick={() => updateQty(line.id, (line.qty ?? 1) + 1)}>
                  <Plus className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
          {!compact && (
            <button aria-label="Remove" onClick={() => remove(line.id)} className="rounded-full p-1.5 text-ink-3 transition hover:bg-ink/5 hover:text-ink">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function useCartLines() {
  const cart = useApp((s) => s.cart);
  const vouchers = useApp((s) => s.vouchers);
  return useMemo(() => cart.map((c) => describeCartItem(c, vouchers)).filter(Boolean) as CartLineView[], [cart, vouchers]);
}

export function CartDrawer() {
  const open = useUI((s) => s.cartOpen);
  const setOpen = useUI((s) => s.setCartOpen);
  const prune = useApp((s) => s.pruneExpiredHolds);
  const lines = useCartLines();
  const totals = cartTotals(lines);
  const nav = useNavigate();

  useEffect(() => {
    if (open) prune();
  }, [open, prune]);

  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      title="Your basket"
      footer={
        lines.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-[14px] text-ink-2">Total due today</span>
              <span className="tabular font-display text-[24px] text-ink">{aed(totals.total)}</span>
            </div>
            <div className="mt-0.5 text-[12px] text-ink-3">Includes VAT {aed(totals.vat, { decimals: true })} · no booking fees</div>
            <Button
              className="mt-4"
              block
              size="lg"
              onClick={() => {
                setOpen(false);
                nav('/checkout');
              }}
            >
              Checkout
            </Button>
          </div>
        )
      }
    >
      {lines.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-6 w-6" />}
          title="Your basket is empty"
          body="Book an experience or pick up something from a host you visited."
          action={
            <Button
              variant="dark"
              onClick={() => {
                setOpen(false);
                nav('/experiences');
              }}
            >
              Explore experiences
            </Button>
          }
        />
      ) : (
        <div className="divide-y divide-line">
          {lines.map((l) => (
            <CartLine key={l.id} line={l} />
          ))}
        </div>
      )}
    </Sheet>
  );
}
