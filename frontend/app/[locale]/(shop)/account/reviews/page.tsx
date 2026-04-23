'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Star, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reviewsApi } from '@/lib/api';
import { cn } from '@/lib/utils';

type MyReview = {
  id: string;
  productId: string;
  productTitleEn: string;
  productTitleBn: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
};

const STATUS_CFG = {
  pending:  { label: 'Pending moderation', Icon: Clock,         cls: 'text-amber-600 dark:text-amber-400 bg-amber-500/10' },
  approved: { label: 'Published',          Icon: CheckCircle2,  cls: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
  rejected: { label: 'Not approved',       Icon: AlertCircle,   cls: 'text-destructive bg-destructive/10' },
};

export default function AccountReviewsPage() {
  const t = useTranslations('account');
  const tc = useTranslations('common');
  const locale = useLocale();
  const qc = useQueryClient();

  const [productId, setProductId] = useState('');
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitOk, setSubmitOk] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['my-reviews'],
    queryFn: () => reviewsApi.me().then((r) => (r.data as { reviews: MyReview[] }).reviews),
  });

  const submitMutation = useMutation({
    mutationFn: () => reviewsApi.submit({
      productId: productId.trim(),
      rating,
      title: title.trim() || undefined,
      body: body.trim() || undefined,
    }),
    onSuccess: () => {
      setSubmitOk(true);
      setSubmitError('');
      setProductId(''); setTitle(''); setBody(''); setRating(5);
      qc.invalidateQueries({ queryKey: ['my-reviews'] });
      setTimeout(() => setSubmitOk(false), 4000);
    },
    onError: (e: unknown) => {
      setSubmitError(
        (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? tc('error')
      );
    },
  });

  const reviews = data ?? [];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">{t('reviewsTitle')}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
          Reviews are submitted to moderation and published once approved.
        </p>
      </div>

      {/* Submit form */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <h2 className="mb-3 text-base font-semibold text-foreground sm:mb-4 sm:text-lg">{t('writeReview')}</h2>

        {submitOk && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Review submitted — pending moderation.
          </div>
        )}
        {submitError && (
          <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{submitError}</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">{t('productId')} *</span>
            <input
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              placeholder="Product ID (from order or product page)"
            />
          </label>
          <label>
            <span className="text-xs font-medium text-muted-foreground">{t('rating')} *</span>
            <div className="mt-1 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className="p-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label={`${n} stars`}
                >
                  <Star className={cn('h-6 w-6 transition-colors', n <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />
                </button>
              ))}
              <span className="ml-1 text-sm text-muted-foreground">{rating}/5</span>
            </div>
          </label>
          <label>
            <span className="text-xs font-medium text-muted-foreground">Title (optional)</span>
            <input
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short summary…"
            />
          </label>
          <label className="sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">{t('reviewBody')}</span>
            <textarea
              className="mt-1 min-h-[90px] w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share your experience with this product…"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={!productId.trim() || submitMutation.isPending}
          onClick={() => submitMutation.mutate()}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {submitMutation.isPending ? tc('loading') : t('submitReview')}
        </button>
      </div>

      {/* Review list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : reviews.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          {t('reviewsEmpty')}
        </p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => {
            const cfg = STATUS_CFG[r.status] ?? STATUS_CFG.pending;
            return (
              <li key={r.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/${locale}/products/${r.productId}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {locale === 'bn' ? r.productTitleBn : r.productTitleEn}
                    </Link>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="flex items-center gap-0.5 text-sm text-amber-500">
                        {Array.from({ length: r.rating }).map((_, i) => (
                          <Star key={i} className="h-3.5 w-3.5 fill-current" />
                        ))}
                      </span>
                      <span className="text-xs text-muted-foreground">{r.rating}/5</span>
                    </div>
                    {r.title && <p className="mt-1 text-sm font-medium text-foreground">{r.title}</p>}
                    {r.body && <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{r.body}</p>}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', cfg.cls)}>
                    <cfg.Icon className="h-3 w-3" />
                    {cfg.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
