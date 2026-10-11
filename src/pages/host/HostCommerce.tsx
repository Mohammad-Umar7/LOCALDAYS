import { Package, Repeat, Search, Truck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/Tabs';
import { PRODUCT_BY_ID, productsForProvider } from '@/data/catalog';
import { useApp } from '@/store/app';
import { hostCustomers } from '@/services/hostData';
import { aed, fmtDate, pct } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useHost } from './useHost';
import { Kpi, Panel } from './ui';

export default function HostCommerce() {
  const { provider, ctx, weeks } = useHost();
  const orders = useApp((s) => s.orders.filter((o) => o.providerIds.includes(provider.id)));
  const subs = useApp((s) => s.subscriptions.filter((x) => x.providerId === provider.id));
  const followUps = useApp((s) => s.host.followUps);
  const stockDelta = useApp((s) => s.stockDelta);
  const [tab, setTab] = useState<'orders' | 'subscribers' | 'customers' | 'inventory'>('orders');
  const [q, setQ] = useState('');
  const customers = useMemo(() => hostCustomers(provider.id, ctx.todayISO, followUps), [provider.id, ctx.todayISO, followUps]);
  const products = productsForProvider(provider.id);
  const last = weeks[weeks.length - 1];
  const subPlan = products.find((p) => p.subscription);
  const repeat = customers.filter((c) => c.boughtAfterVisit).length / customers.length;
  const ltv = customers.reduce((s, c) => s + c.spentExperiences + c.spentProducts, 0) / customers.length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label="Product sales · this week" value={aed(last.products)} />
        <Kpi label="Subscription revenue · this week" value={aed(last.subscriptions)} sub={subPlan ? `${last.subscribers} active` : 'not offered'} />
        <Kpi label="Visitors who bought again" value={pct(repeat)} sub="within 30 days" />
        <Kpi label="Avg. relationship value" value={aed(ltv)} sub="experiences + products per guest" />
      </div>
      <Panel
        title="Commerce"
        action={
          <Tabs
            size="sm"
            value={tab}
            onChange={setTab}
            items={[
              { id: 'orders', label: 'Orders', count: orders.length },
              { id: 'subscribers', label: 'Subscribers', count: last.subscribers },
              { id: 'customers', label: 'Customers', count: customers.length },
              { id: 'inventory', label: 'Inventory', count: products.length },
            ]}
          />
        }
      >
        {tab === 'orders' &&
          (orders.length ? (
            <div className="divide-y divide-line">
              {[...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((o) => (
                <div key={o.ref} className="flex flex-wrap items-center gap-3 py-3">
                  <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', o.source === 'subscription' ? 'bg-honey-100 text-honey-700' : 'bg-sand-100 text-ink-2')}>
                    {o.source === 'subscription' ? <Repeat className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold">
                      {o.customer.name} {o.isReorder && <Badge tone="honey" className="ml-1">Repeat</Badge>}
                    </div>
                    <div className="truncate text-[12.5px] text-ink-3">
                      {o.lines.filter((l) => PRODUCT_BY_ID[l.productId]?.providerId === provider.id).map((l) => `${l.qty}× ${PRODUCT_BY_ID[l.productId].name}`).join(', ')}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[12.5px] text-ink-3">
                    <Truck className="h-3.5 w-3.5" /> {fmtDate(o.deliveryDate)}
                  </span>
                  <Badge tone={o.status === 'delivered' ? 'success' : 'neutral'}>{o.status.replace(/_/g, ' ')}</Badge>
                  <span className="tabular w-20 text-right text-[13.5px] font-semibold">{aed(o.total)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Package className="h-6 w-6" />} title="No Fadhal orders yet" body="Buy from this host’s shop as a customer and it lands here instantly." />
          ))}

        {tab === 'subscribers' && (
          <div>
            {subPlan ? (
              <>
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-sand-50 p-4">
                    <div className="text-[12px] font-semibold text-ink-3">Capacity used</div>
                    <div className="mt-1 text-[22px] font-semibold">
                      {last.subscribers}/{subPlan.subscription!.capacity}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-sand-50 p-4">
                    <div className="text-[12px] font-semibold text-ink-3">Recurring revenue / month</div>
                    <div className="mt-1 text-[22px] font-semibold">{aed(last.subscriptions * 4.3)}</div>
                  </div>
                  <div className="rounded-2xl bg-sand-50 p-4">
                    <div className="text-[12px] font-semibold text-ink-3">Came from a visit</div>
                    <div className="mt-1 text-[22px] font-semibold">{pct(0.82)}</div>
                  </div>
                </div>
                <div className="divide-y divide-line">
                  {subs.map((s) => (
                    <div key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                      <Badge tone="clay">New · demo</Badge>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold">{s.customer.name}</div>
                        <div className="text-[12.5px] text-ink-3">
                          {PRODUCT_BY_ID[s.productId].name} · {s.frequency} · {s.deliveries} deliveries · next {fmtDate(s.nextDelivery)}
                        </div>
                      </div>
                      <Badge tone={s.status === 'active' ? 'success' : 'warning'}>{s.status}</Badge>
                      <span className="tabular text-[13.5px] font-semibold">{aed(s.price)}</span>
                    </div>
                  ))}
                  {customers
                    .filter((c) => c.subscriber)
                    .map((c) => (
                      <div key={c.name + c.firstVisit} className="flex flex-wrap items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] font-semibold">{c.name}</div>
                          <div className="text-[12.5px] text-ink-3">
                            {c.origin} · first visit {fmtDate(c.firstVisit)} · {subPlan.name}
                          </div>
                        </div>
                        <Badge tone="success">active</Badge>
                        <span className="tabular text-[13.5px] font-semibold">{aed(subPlan.subscription!.price)}</span>
                      </div>
                    ))}
                </div>
              </>
            ) : (
              <EmptyState icon={<Repeat className="h-6 w-6" />} title="No subscription product" body="For this category, repeat revenue comes from season passes, group days and reorders — subscriptions aren’t forced." />
            )}
          </div>
        )}

        {tab === 'customers' && (
          <div>
            <div className="relative mb-3 max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guests" className="h-10 w-full rounded-full border border-line pl-9 pr-3 text-[13.5px] outline-none focus:border-ink/30" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <thead className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">
                  <tr className="border-b border-line">
                    <th className="py-2.5 pr-3">Guest</th>
                    <th className="py-2.5 pr-3">First visit</th>
                    <th className="py-2.5 pr-3 text-right">Visits</th>
                    <th className="py-2.5 pr-3 text-right">Experiences</th>
                    <th className="py-2.5 pr-3 text-right">Products</th>
                    <th className="py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {customers
                    .filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
                    .map((c) => (
                      <tr key={c.name + c.firstVisit}>
                        <td className="py-2.5 pr-3">
                          <div className="font-semibold">{c.name}</div>
                          <div className="text-[12px] text-ink-3">{c.origin}</div>
                        </td>
                        <td className="py-2.5 pr-3">{fmtDate(c.firstVisit)}</td>
                        <td className="tabular py-2.5 pr-3 text-right">{c.visits}</td>
                        <td className="tabular py-2.5 pr-3 text-right">{aed(c.spentExperiences)}</td>
                        <td className="tabular py-2.5 pr-3 text-right">{c.spentProducts ? aed(c.spentProducts) : '—'}</td>
                        <td className="py-2.5">
                          {c.subscriber ? <Badge tone="success">Subscriber</Badge> : c.boughtAfterVisit ? <Badge tone="honey">Repeat buyer</Badge> : c.offerSent ? <Badge tone="neutral">Offer sent</Badge> : <Badge tone="warning">Not offered</Badge>}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-[12px] text-ink-3">Fictional guest records for the demo. Customer data is only shared with hosts the guest booked with.</div>
          </div>
        )}

        {tab === 'inventory' && (
          <div className="divide-y divide-line">
            {products.map((p) => {
              const stock = p.stock !== undefined ? p.stock + (stockDelta[p.id] ?? 0) : undefined;
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold">{p.name}</div>
                    <div className="text-[12.5px] text-ink-3">
                      {p.kind.replace(/_/g, ' ')} · {p.unit}
                      {p.origin.type === 'partner' ? ` · from ${p.origin.partnerName}` : ''}
                      {p.leadTimeDays ? ` · ${p.leadTimeDays}-day lead time` : ''}
                    </div>
                  </div>
                  {stock !== undefined ? (
                    <Badge tone={stock < 10 ? 'warning' : 'neutral'}>{stock} in stock</Badge>
                  ) : (
                    <Badge tone="neutral">{p.kind === 'commission' ? 'Made to commission' : p.kind === 'formula_refill' ? 'Blended to order' : 'Made to order'}</Badge>
                  )}
                  <span className="tabular w-24 text-right text-[13.5px] font-semibold">{aed(p.price)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
