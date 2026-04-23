'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Clock, Copy, CreditCard, Package, Truck } from 'lucide-react';
import { ordersApi } from '@/lib/api';
import type { OrderDetail, OrderShipment, PaymentMethod, SavedAddress, ShipmentStatus } from '@/types';
import { cn } from '@/lib/utils';
import { OrderTrackingTimeline, getFulfillmentTimelineIndex, type TrackingData } from '@/components/orders/OrderTrackingTimeline';

const CARRIER_LABELS: Record<string, string> = {
  pathao: 'Pathao Courier',
  steadfast: 'Steadfast Courier',
  redx: 'RedX',
  sundarban: 'Sundarban Courier',
};

function carrierDisplay(raw: string) {
  const k = raw.trim().toLowerCase().replace(/\s+/g, '_');
  return CARRIER_LABELS[k] ?? raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

function parseOrder(raw: unknown): OrderDetail {
  const o = raw as Record<string, unknown>;
  const items = (Array.isArray(o.items) ? o.items : []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: Number(r.id),
      productId: String(r.productId),
      variantId: r.variantId != null ? String(r.variantId) : null,
      productTitle: String(r.productTitle ?? ''),
      unitPrice: num(r.unitPrice),
      quantity: Number(r.quantity ?? 1),
      lineTotal: num(r.lineTotal),
      discountPct: num(r.discountPct),
    };
  });
  const timeline = (Array.isArray(o.timeline) ? o.timeline : []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: Number(r.id),
      orderId: String(r.orderId),
      status: String(r.status ?? ''),
      note: r.note != null ? String(r.note) : null,
      actorType: String(r.actorType ?? ''),
      actorId: r.actorId != null ? String(r.actorId) : null,
      createdAt: String(r.createdAt ?? ''),
    };
  });
  const shipments = (Array.isArray(o.shipments) ? o.shipments : []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      orderId: String(r.orderId),
      carrier: String(r.carrier ?? ''),
      trackingNumber: String(r.trackingNumber ?? ''),
      status: r.status as ShipmentStatus,
      estimatedDelivery: r.estimatedDelivery != null ? String(r.estimatedDelivery) : null,
      events: r.events ?? null,
      createdAt: String(r.createdAt ?? ''),
      updatedAt: String(r.updatedAt ?? ''),
    };
  });

  const addrRaw = o.shippingAddress;
  const shippingAddress: SavedAddress | null =
    addrRaw && typeof addrRaw === 'object' && !Array.isArray(addrRaw)
      ? (addrRaw as SavedAddress)
      : null;

  return {
    id: String(o.id),
    orderNumber: String(o.orderNumber ?? ''),
    userId: String(o.userId ?? ''),
    status: o.status as OrderDetail['status'],
    customerType: o.customerType as OrderDetail['customerType'],
    subtotal: num(o.subtotal),
    discount: num(o.discount),
    gst: num(o.gst),
    shippingFee: num(o.shippingFee),
    serviceFee: num(o.serviceFee),
    obPointsUsed: Number(o.obPointsUsed ?? 0),
    obDiscount: num(o.obDiscount),
    total: num(o.total),
    paymentMethod: o.paymentMethod as PaymentMethod,
    paymentStatus: o.paymentStatus as OrderDetail['paymentStatus'],
    trackingNumber: o.trackingNumber != null ? String(o.trackingNumber) : null,
    createdAt: String(o.createdAt ?? ''),
    items,
    timeline,
    shipments,
    shippingAddress,
    notes: o.notes != null ? String(o.notes) : null,
    updatedAt: String(o.updatedAt ?? o.createdAt ?? ''),
  };
}

function paymentLabel(method: PaymentMethod, tCh: (key: string) => string) {
  return tCh(method);
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
  confirmed: 'bg-blue-100 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200',
  processing: 'bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200',
  shipped: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-200',
  delivered: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
  cancelled: 'bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200',
  returned: 'bg-muted text-muted-foreground',
};

const PAY_BADGE: Record<string, string> = {
  unpaid: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
  paid: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
  partial: 'bg-blue-100 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200',
  refunded: 'bg-muted text-muted-foreground',
};

export default function OrderDetailClient({ orderId }: { orderId: string }) {
  const t = useTranslations('orders');
  const tCh = useTranslations('checkout');
  const tc = useTranslations('common');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const trackingRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => ordersApi.get(orderId).then((r) => parseOrder((r.data as { order: unknown }).order)),
  });

  useEffect(() => {
    if (searchParams.get('tab') === 'tracking' && trackingRef.current && order) {
      const id = requestAnimationFrame(() => {
        trackingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return () => cancelAnimationFrame(id);
    }
  }, [searchParams, order]);

  const cancelMut = useMutation({
    mutationFn: () => ordersApi.cancel(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-8 sm:px-6 lg:px-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <p className="text-muted-foreground">{t('notFound')}</p>
        <Link href={`/${locale}/orders`} className="mt-4 inline-flex items-center gap-2 text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" />
          {t('backToOrders')}
        </Link>
      </div>
    );
  }

  const canCancel = order.status === 'pending' || order.status === 'confirmed';
  const dateLocale = locale === 'bn' ? 'bn-BD' : 'en-US';

  const latestShipment = order?.shipments?.[order.shipments.length - 1] ?? null;

  const trackingData: TrackingData | null = order ? (() => {
    const idx = getFulfillmentTimelineIndex(order.status);
    const cancelled = order.status === 'cancelled' || order.status === 'returned';
    const timelineMap: Record<string, string> = {};
    for (const ev of order.timeline) {
      if (!timelineMap[ev.status]) timelineMap[ev.status] = ev.createdAt;
    }
    const stepTimestamps = [
      timelineMap['pending'] ?? timelineMap['confirmed'] ?? order.createdAt,
      timelineMap['processing'] ?? timelineMap['confirmed'] ?? null,
      timelineMap['shipped'] ?? null,
      timelineMap['out_for_delivery'] ?? null,
      timelineMap['delivered'] ?? null,
    ];
    const steps = [
      { label: 'Order Placed',    completed: !cancelled || idx >= 0, current: !cancelled && idx === 0, occurredAt: stepTimestamps[0] },
      { label: 'Processing',      completed: !cancelled && idx >= 1, current: !cancelled && idx === 1, occurredAt: stepTimestamps[1] },
      { label: 'Shipped',         completed: !cancelled && idx >= 2, current: !cancelled && idx === 2, occurredAt: stepTimestamps[2] },
      { label: 'Out for Delivery',completed: !cancelled && idx >= 3, current: !cancelled && idx === 3, occurredAt: stepTimestamps[3] },
      { label: 'Delivered',       completed: !cancelled && idx >= 4, current: !cancelled && idx === 4, occurredAt: stepTimestamps[4] },
    ];
    const events = order.timeline.map((ev) => ({
      at: ev.createdAt,
      message: ev.note ?? ev.status.replace(/_/g, ' '),
      status: ev.status,
    }));
    return {
      cancelled,
      currentStepIndex: cancelled ? -1 : Math.max(0, idx),
      steps,
      events,
      estimatedDelivery: latestShipment?.estimatedDelivery ?? null,
    };
  })() : null;

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-8 lg:px-8">
      <div>
        <Link
          href={`/${locale}/orders`}
          className="mb-3 inline-flex min-h-[40px] items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToOrders')}
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div>
            <h1 className="text-base font-bold tracking-tight text-foreground sm:text-lg md:text-2xl">
              {t('orderNumber')} {order.orderNumber}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              {t('placedOn')}{' '}
              {new Date(order.createdAt).toLocaleString(dateLocale, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-semibold sm:px-3 sm:py-1',
                STATUS_BADGE[order.status] ?? 'bg-muted text-muted-foreground'
              )}
            >
              {t('fulfillment')}: {t(order.status)}
            </span>
            {canCancel ? (
              <button
                type="button"
                disabled={cancelMut.isPending}
                onClick={() => {
                  if (typeof window !== 'undefined' && window.confirm(t('cancelConfirm'))) cancelMut.mutate();
                }}
                className="inline-flex min-h-[36px] items-center rounded-lg border border-destructive/40 px-3 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                {cancelMut.isPending ? t('cancelling') : t('cancel')}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
        <section className="space-y-4 lg:col-span-3">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground sm:mb-4 sm:text-lg">
              <Package className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
              {t('orderDetails')}
            </h2>
            <ul className="divide-y divide-border">
              {order.items.map((line) => (
                <li key={line.id} className="flex flex-wrap gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/${locale}/products/${line.productId}`}
                      className="font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {line.productTitle}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t('quantity')}: {line.quantity}
                    </p>
                  </div>
                  <div className="text-right text-sm font-semibold text-foreground">
                    {tc('taka')}
                    {line.lineTotal.toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {order.shippingAddress ? (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <h2 className="mb-2 text-base font-semibold text-foreground sm:text-lg">{t('shipTo')}</h2>
              <p className="font-medium text-foreground">{order.shippingAddress.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {order.shippingAddress.line1}
                {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}
              </p>
              <p className="text-sm text-muted-foreground">
                {order.shippingAddress.city}, {order.shippingAddress.district}
                {order.shippingAddress.postalCode ? ` — ${order.shippingAddress.postalCode}` : ''}
              </p>
            </div>
          ) : null}

          {order.notes ? (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <h2 className="mb-2 text-base font-semibold text-foreground sm:text-lg">{t('notes')}</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
            </div>
          ) : null}
        </section>

        <aside className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground sm:mb-4 sm:text-lg">
              <CreditCard className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
              {t('paymentHeading')}
            </h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t('paymentMethod')}</dt>
                <dd className="font-medium text-foreground text-right">
              {paymentLabel(order.paymentMethod, tCh as (key: string) => string)}
            </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t('paymentStatus')}</dt>
                <dd>
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
                      PAY_BADGE[order.paymentStatus] ?? 'bg-muted'
                    )}
                  >
                    {t(
                      (
                        {
                          unpaid: 'payment_unpaid',
                          paid: 'payment_paid',
                          partial: 'payment_partial',
                          refunded: 'payment_refunded',
                        } as const
                      )[order.paymentStatus]
                    )}
                  </span>
                </dd>
              </div>
            </dl>
            <div className="mt-4 border-t border-border pt-4">
              <h3 className="mb-2 text-sm font-semibold text-foreground">{t('orderSummary')}</h3>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t('subtotal')}</dt>
                  <dd>
                    {tc('taka')}
                    {order.subtotal.toLocaleString()}
                  </dd>
                </div>
                {order.discount > 0 ? (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                    <dt>{t('discount')}</dt>
                    <dd>
                      −{tc('taka')}
                      {order.discount.toLocaleString()}
                    </dd>
                  </div>
                ) : null}
                {order.gst > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('gst')}</dt>
                    <dd>
                      {tc('taka')}
                      {order.gst.toLocaleString()}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t('shipping')}</dt>
                  <dd>
                    {tc('taka')}
                    {order.shippingFee.toLocaleString()}
                  </dd>
                </div>
                {order.serviceFee > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('serviceFee')}</dt>
                    <dd>
                      {tc('taka')}
                      {order.serviceFee.toLocaleString()}
                    </dd>
                  </div>
                ) : null}
                {order.obDiscount > 0 ? (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                    <dt>{t('obPointsLine')}</dt>
                    <dd>
                      −{tc('taka')}
                      {order.obDiscount.toLocaleString()}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-border pt-2 text-base font-bold text-foreground">
                  <dt>{t('total')}</dt>
                  <dd>
                    {tc('taka')}
                    {order.total.toLocaleString()}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div ref={trackingRef} className="rounded-2xl border border-border bg-card p-4 shadow-sm scroll-mt-24 sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground sm:mb-4 sm:text-lg">
              <Truck className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
              {t('trackingHeading')}
            </h2>

            {order.shipments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noShipmentYet')}</p>
            ) : (
              <ul className="space-y-4">
                {order.shipments.map((s) => (
                  <ShipmentCard key={s.id} s={s} t={t} copied={copied} onCopy={copyText} dateLocale={dateLocale} />
                ))}
              </ul>
            )}

            {order.trackingNumber && order.shipments.every((s) => s.trackingNumber !== order.trackingNumber) ? (
              <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-3 text-sm">
                <p className="font-medium text-foreground">{t('orderLevelTracking')}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <code className="rounded bg-background px-2 py-1 font-mono text-xs">{order.trackingNumber}</code>
                  <button
                    type="button"
                    onClick={() => copyText(order.trackingNumber!)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    {copied === order.trackingNumber ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied === order.trackingNumber ? t('copied') : t('copyTracking')}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      <section>
        <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-foreground sm:mb-3 sm:text-lg">
          <Truck className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
          {t('timeline')}
        </h2>
        <OrderTrackingTimeline
          status={order.status}
          tracking={trackingData}
          estimatedDelivery={latestShipment?.estimatedDelivery ?? null}
        />
      </section>
    </div>
  );
}

function ShipmentCard({
  s,
  t,
  copied,
  onCopy,
  dateLocale,
}: {
  s: OrderShipment;
  t: ReturnType<typeof useTranslations<'orders'>>;
  copied: string | null;
  onCopy: (v: string) => void;
  dateLocale: string;
}) {
  const shipLabelKey =
    (
      {
        pending: 'shipment_pending',
        picked_up: 'shipment_picked_up',
        in_transit: 'shipment_in_transit',
        out_for_delivery: 'shipment_out_for_delivery',
        delivered: 'shipment_delivered',
        returned: 'shipment_returned',
      } as const
    )[s.status] ?? 'shipment_pending';

  let est: string | null = null;
  if (s.estimatedDelivery) {
    const d = new Date(s.estimatedDelivery);
    if (!Number.isNaN(d.getTime())) {
      est = d.toLocaleDateString(dateLocale, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    }
  }

  return (
    <li className="rounded-xl border border-border bg-muted/20 p-4">
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('deliveryCompany')}</dt>
          <dd className="font-medium text-right text-foreground">{carrierDisplay(s.carrier)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('shipmentStatus')}</dt>
          <dd>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {t(shipLabelKey)}
            </span>
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('trackingNumber')}</dt>
          <dd className="flex flex-wrap items-center justify-end gap-2">
            <code className="rounded bg-background px-2 py-0.5 font-mono text-xs">{s.trackingNumber}</code>
            <button
              type="button"
              onClick={() => onCopy(s.trackingNumber)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              {copied === s.trackingNumber ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === s.trackingNumber ? t('copied') : t('copyTracking')}
            </button>
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('estimatedDelivery')}</dt>
          <dd className="text-right font-medium text-foreground">{est ?? t('estimatePending')}</dd>
        </div>
      </dl>
    </li>
  );
}
