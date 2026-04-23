'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { adminStudio } from '@/lib/adminApi';

export default function AdminDashboardPage() {
  const locale = useLocale();
  const base = `/${locale}/admin`;
  const { data } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => adminStudio.overview().then((r) => r.data),
  });

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      {data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Orders', data.totalOrders],
            ['Revenue (paid)', data.totalRevenue],
            ['Users', data.totalUsers],
            ['Open tickets', data.pendingTickets],
          ].map(([k, v]) => (
            <div key={String(k)} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium uppercase text-muted-foreground">{k}</p>
              <p className="mt-1 text-2xl font-bold">{String(v)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">Loading…</p>
      )}
      <div className="flex flex-wrap gap-3">
        <Link href={`${base}/catalog`} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Open Catalog Studio
        </Link>
        <Link href={`${base}/delivery`} className="rounded-lg border border-border px-4 py-2 text-sm font-medium">
          Delivery
        </Link>
        <Link href={`${base}/tickets`} className="rounded-lg border border-border px-4 py-2 text-sm font-medium">
          Tickets
        </Link>
      </div>
    </div>
  );
}
