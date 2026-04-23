'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { adminStudio } from '@/lib/adminApi';

export default function AdminOrdersPage() {
  const locale = useLocale();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => adminStudio.orders(1).then((r) => r.data),
  });

  const orders = data?.orders ?? [];

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-bold">Orders</h1>
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="p-3">Order</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Status</th>
                <th className="p-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o: { id: string; orderNumber: string; status: string; total: unknown; user?: { name?: string } }) => (
                <tr key={o.id} className="border-b border-border">
                  <td className="p-3 font-mono text-xs">{o.orderNumber}</td>
                  <td className="p-3">{o.user?.name ?? '—'}</td>
                  <td className="p-3">{o.status}</td>
                  <td className="p-3">৳{Number(o.total).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Customer order detail:{' '}
        <Link href={`/${locale}/orders`} className="text-primary underline">
          storefront orders
        </Link>
      </p>
    </div>
  );
}
