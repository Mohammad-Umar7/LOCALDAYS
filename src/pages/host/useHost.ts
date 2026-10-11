import { useMemo } from 'react';
import { PROVIDER_BY_ID } from '@/data/catalog';
import { useApp, useAvailabilityCtx } from '@/store/app';
import { hostHistory } from '@/services/hostData';

/** Everything a host dashboard section needs, reactive to demo activity. */
export function useHost() {
  const providerId = useApp((s) => s.host.activeProviderId);
  const provider = PROVIDER_BY_ID[providerId];
  const ctx = useAvailabilityCtx();
  const bookings = useApp((s) => s.bookings);
  const orders = useApp((s) => s.orders);
  const subscriptions = useApp((s) => s.subscriptions);
  const vouchers = useApp((s) => s.vouchers);
  const presaleSold = useApp((s) => s.presaleSold);
  const store = useMemo(() => ({ bookings, orders, subscriptions, vouchers }), [bookings, orders, subscriptions, vouchers]);
  const weeks = useMemo(() => hostHistory(providerId, ctx.todayISO, store), [providerId, ctx.todayISO, store]);
  return { providerId, provider, ctx, store, weeks, presaleSold };
}
