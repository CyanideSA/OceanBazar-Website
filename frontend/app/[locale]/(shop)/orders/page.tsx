'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Package, AlertCircle, Clock, CheckCircle2, Truck, XCircle,
  RotateCcw, ShoppingBag, ChevronRight, MapPin, Eye,
} from 'lucide-react';
import { ordersApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { OrderRowSkeleton } from '@/components/shared/Skeleton';
import { cn } from '@/lib/utils';
import type { Order } from '@/types';

const STATUS_META: Record<string, { color: string; Icon: typeof Clock }> = {
  pending:    { color: 'bg-warning/10 text-warning-foreground dark:text-warning', Icon: Clock },
  confirmed:  { color: 'bg-primary/10 text-primary', Icon: CheckCircle2 },
  processing: { color: 'bg-violet-500/10 text-violet-700 dark:text-violet-400', Icon: Package },
  shipped:    { color: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400', Icon: Truck },
  delivered:  { color: 'bg-success/10 text-success', Icon: CheckCircle2 },
  cancelled:  { color: 'bg-destructive/10 text-destructive', Icon: XCircle },
  returned:   { color: 'bg-muted text-muted-foreground', Icon: RotateCcw },
};

export default function OrdersPage() {
  const t = useTranslations('orders');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { isAuthenticated } = useAuthStore();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersApi.list().then((r) => r.data),
    enabled: isAuthenticated,
  });

  const orders: Order[] = data?.orders ?? [];

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShoppingBag className="mb-4 h-16 w-16 text-muted-foreground/30" />
        <p className="text-lg font-semibold text-foreground">{tc('error')}</p>
        <Link href={`/${locale}/auth/login`} className="mt-4 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:brightness-110">
          {tc('back')}
        </Link>
      </div>
    );
  }

  return (
    <div className="container-tight py-4 max-w-4xl sm:py-8">
      <div className="mb-5 flex items-center gap-3 sm:mb-7">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Package className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground sm:text-2xl">{t('title')}</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">{orders.length} {orders.length === 1 ? 'order' : 'orders'}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <OrderRowSkeleton key={i} />)}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-destructive/30 bg-destructive/5 py-14 text-center">
          <AlertCircle className="h-10 w-10 text-destructive/50" />
          <p className="font-semibold text-foreground">{tc('error')}</p>
          <button type="button" onClick={() => refetch()} className="mt-1 text-sm font-semibold text-primary hover:underline">{tc('retry')}</button>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16">
          <Package className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-muted-foreground">{t('noOrders')}</p>
          <Link href={`/${locale}/products`} className="mt-4 inline-block text-primary hover:underline">{t('startShopping')}</Link>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {orders.map((order) => {
            const statusKey = order.status?.toLowerCase() ?? 'pending';
            const meta = STATUS_META[statusKey] ?? STATUS_META.pending;
            const StatusIcon = meta.Icon;
            const itemCount = (order as any).items?.length ?? (order as any).itemCount ?? null;
            return (
              <Link
                key={order.id}
                href={`/${locale}/orders/${order.id}`}
                className="group block rounded-xl border border-border bg-card p-4 shadow-soft transition-all hover:border-primary/20 hover:shadow-soft-md sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground sm:text-base">{order.orderNumber}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                      {new Date(order.createdAt).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      {itemCount != null && <span className="ml-2">· {itemCount} item{itemCount !== 1 ? 's' : ''}</span>}
                    </p>
                  </div>
                  <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:text-xs', meta.color)}>
                    <StatusIcon className="h-3 w-3" />
                    {t(statusKey as any)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between sm:mt-4">
                  <span className="text-sm font-bold text-primary sm:text-lg">৳{Number(order.total).toLocaleString()}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    {t('details')} <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
