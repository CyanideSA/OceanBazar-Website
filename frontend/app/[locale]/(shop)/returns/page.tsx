'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  RefreshCcw, ShoppingBag, Package, Camera, CheckCircle2,
  Clock, XCircle, AlertCircle, ChevronRight, ArrowRight,
  Truck, CreditCard,
} from 'lucide-react';
import { ticketsApi, ordersApi } from '@/lib/api';
import { cn } from '@/lib/utils';

type OrderRow = {
  id: string;
  status: string;
  createdAt: string;
  items: Array<{ productId: string; title: string; quantity: number; unitPrice: number }>;
};

type ReturnRequest = {
  id: string;
  subject: string;
  status: string;
  updatedAt: string;
  orderId?: string | null;
  productId?: string | null;
  messages?: Array<{ message: string; createdAt: string; senderRole?: string }>;
};

const RETURN_REASONS = [
  'Wrong item received',
  'Item damaged or defective',
  'Item not as described',
  'Changed my mind',
  'Duplicate order',
  'Other',
];

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; cls: string; desc: string }> = {
  open:        { label: 'Under Review',  icon: AlertCircle,  cls: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',     desc: 'Our team is reviewing your request.' },
  in_progress: { label: 'In Progress',   icon: Clock,        cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',  desc: 'Pickup or action is being arranged.' },
  resolved:    { label: 'Approved',      icon: CheckCircle2, cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', desc: 'Return approved. Refund will be processed.' },
  closed:      { label: 'Closed',        icon: XCircle,      cls: 'bg-muted text-muted-foreground',                      desc: 'This return request has been closed.' },
};

function ReturnStatusCard({ req }: { req: ReturnRequest }) {
  const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.open;
  const Icon = cfg.icon;
  const steps = ['Submitted', 'Under Review', 'Pickup', 'Inspection', 'Refund'];
  const stepIdx = req.status === 'open' ? 1 : req.status === 'in_progress' ? 2 : req.status === 'resolved' ? 4 : 5;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
      <div className="flex items-start justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{req.subject}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {req.orderId && (
              <span className="flex items-center gap-1">
                <ShoppingBag className="h-3 w-3" />
                {req.orderId}
              </span>
            )}
            {req.productId && (
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                {req.productId}
              </span>
            )}
            <span>{new Date(req.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>
        <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', cfg.cls)}>
          <Icon className="h-3 w-3" />
          {cfg.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="border-t border-border bg-muted/20 px-5 py-4">
        <div className="flex items-center justify-between">
          {steps.map((s, i) => (
            <div key={s} className="flex flex-1 flex-col items-center gap-1">
              <div className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                i < stepIdx ? 'bg-emerald-500 text-white' : i === stepIdx ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              )}>
                {i < stepIdx ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={cn('hidden text-center text-xs sm:block', i <= stepIdx ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                {s}
              </span>
              {i < steps.length - 1 && (
                <div className={cn('absolute top-3 h-0.5 w-full', i < stepIdx ? 'bg-emerald-500' : 'bg-border')} />
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">{cfg.desc}</p>
      </div>
    </div>
  );
}

export default function ReturnsPage() {
  const locale = useLocale();
  const tc = useTranslations('common');

  const [step, setStep] = useState<'start' | 'form' | 'submitted'>('start');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [reason, setReason] = useState(RETURN_REASONS[0]);
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');

  const { data: ordersData } = useQuery({
    queryKey: ['orders-for-return'],
    queryFn: () => ordersApi.list().then((r) => r.data as { orders: OrderRow[] }),
  });

  const { data: ticketsData, refetch } = useQuery({
    queryKey: ['return-tickets'],
    queryFn: () => ticketsApi.list().then((r) => r.data as { tickets: ReturnRequest[] }),
  });

  const returnMutation = useMutation({
    mutationFn: () => ticketsApi.create({
      subject: `Return Request: ${reason}`,
      message: [
        `Return Reason: ${reason}`,
        '',
        details.trim() ? `Additional details:\n${details.trim()}` : '',
      ].filter(Boolean).join('\n'),
      category: 'other',
      priority: 'medium',
      orderId: selectedOrderId || undefined,
      productId: selectedProductId || undefined,
    }),
    onSuccess: async () => {
      setStep('submitted');
      await refetch();
    },
    onError: (e: unknown) => {
      setError((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to submit return request.');
    },
  });

  const orders = ordersData?.orders ?? [];
  const returnTickets = (ticketsData?.tickets ?? []).filter(
    (t) => t.subject?.toLowerCase().includes('return') || (t as ReturnRequest).orderId
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <RefreshCcw className="h-6 w-6 text-primary" />
          Returns & Refunds
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Initiate a return, track status, or check our return policy. Items must be returned within 7 days of delivery.
        </p>
      </div>

      {/* Policy quick-ref */}
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {[
          { icon: Clock,        color: 'text-primary',                            bg: 'bg-primary/10',       label: '7-day window',     sub: 'From confirmed delivery date' },
          { icon: Package,      color: 'text-amber-600 dark:text-amber-400',      bg: 'bg-amber-500/10',    label: 'Unused & packaged', sub: 'Original condition required' },
          { icon: CreditCard,   color: 'text-emerald-600 dark:text-emerald-400',  bg: 'bg-emerald-500/10',  label: 'Refund in 3–5 days', sub: 'After inspection passes' },
        ].map((c) => (
          <div key={c.label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-soft">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${c.bg}`}>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{c.label}</p>
              <p className="text-xs text-muted-foreground">{c.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main content */}
      {step === 'submitted' ? (
        <div className="mb-8 flex flex-col items-center gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-6 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
            <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Return Request Submitted</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Our team will review your request within 1–2 business days and contact you with next steps.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href={`/${locale}/tickets`} className="rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground">
              View Tickets
            </Link>
            <button
              type="button"
              onClick={() => { setStep('start'); setSelectedOrderId(''); setSelectedProductId(''); setReason(RETURN_REASONS[0]); setDetails(''); }}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
            >
              New Return
            </button>
          </div>
        </div>
      ) : step === 'form' ? (
        <div className="mb-8 rounded-2xl border border-primary/20 bg-card p-6 shadow-soft">
          <h2 className="mb-5 text-lg font-semibold text-foreground">Return Request Details</h2>

          {error && (
            <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
          )}

          <div className="space-y-4">
            {/* Order select */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Select Order *</label>
              <div className="relative mt-1">
                <ShoppingBag className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                {orders.length > 0 ? (
                  <select
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-8 pr-4 text-sm"
                  >
                    <option value="">Select an order...</option>
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.id} — {new Date(o.createdAt).toLocaleDateString()} ({o.status})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    placeholder="Enter your Order ID (e.g. ORD-1234)"
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-8 pr-4 text-sm"
                  />
                )}
              </div>
            </div>

            {/* Product ID */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Product ID (optional)</label>
              <div className="relative mt-1">
                <Package className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  placeholder="If returning a specific item from the order"
                  className="w-full rounded-xl border border-border bg-background py-2.5 pl-8 pr-4 text-sm"
                />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Return Reason *</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
              >
                {RETURN_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Additional details */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Additional Details</label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                placeholder="Describe the issue in more detail. Mention if the item arrived damaged."
                className="mt-1 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm"
              />
            </div>

            {/* Photo note */}
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3">
              <Camera className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                If the item is damaged or defective, mention it in the details above. Our team may follow up to request photos via ticket reply.
              </p>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                disabled={!selectedOrderId || returnMutation.isPending}
                onClick={() => returnMutation.mutate()}
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {returnMutation.isPending ? tc('loading') : 'Submit Return Request'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('start'); setError(''); }}
                className="rounded-xl border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Start screen */
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setStep('form')}
            className="flex flex-col items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-left shadow-soft transition-all hover:border-primary/40 hover:shadow-soft-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <RefreshCcw className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-foreground">Initiate a Return</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start a new return or exchange request for a delivered order.
              </p>
            </div>
            <span className="mt-auto flex items-center gap-1 text-sm font-semibold text-primary">
              Start return <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>

          <Link
            href={`/${locale}/tickets`}
            className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-6 shadow-soft transition-all hover:border-primary/20 hover:shadow-soft-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
              <Truck className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-bold text-foreground">Track Existing Return</p>
              <p className="mt-1 text-sm text-muted-foreground">
                View the status of a previously submitted return request.
              </p>
            </div>
            <span className="mt-auto flex items-center gap-1 text-sm font-semibold text-primary">
              View tickets <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        </div>
      )}

      {/* Active return tickets */}
      {returnTickets.length > 0 && (
        <section>
          <h2 className="mb-4 font-bold text-foreground">Your Return Requests</h2>
          <div className="space-y-4">
            {returnTickets.map((req) => (
              <ReturnStatusCard key={req.id} req={req} />
            ))}
          </div>
        </section>
      )}

      {/* Policy links */}
      <div className="mt-10 flex flex-wrap gap-3 border-t border-border pt-6 text-sm text-muted-foreground">
        <span>Policy reference:</span>
        <Link href={`/${locale}/policies/returns`} className="font-semibold text-primary hover:underline">Return Policy</Link>
        <Link href={`/${locale}/policies/refunds`} className="font-semibold text-primary hover:underline">Refund Policy</Link>
        <Link href={`/${locale}/support`} className="font-semibold text-primary hover:underline">Support Center</Link>
      </div>
    </div>
  );
}
