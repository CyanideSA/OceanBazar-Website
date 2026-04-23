'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Star, ThumbsUp, Send, Tag } from 'lucide-react';
import Image from 'next/image';
import { useMutation } from '@tanstack/react-query';
import type { ProductDetail, ProductReviewItem } from '@/types';
import ProductStarRating from './ProductStarRating';
import { reviewsApi } from '@/lib/api';
import { getMediaUrl } from '@/lib/mediaUrl';
import { cn } from '@/lib/utils';

type Tab = 'description' | 'specs' | 'attributes' | 'tags' | 'reviews';

interface Props {
  product: ProductDetail;
  tab: Tab;
  onTab: (t: Tab) => void;
  reviews: ProductReviewItem[];
}

/* ── Star picker for review form ── */
function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="p-0.5"
        >
          <Star
            className={cn(
              'h-6 w-6 transition-colors',
              n <= (hover || value)
                ? 'fill-amber-400 stroke-amber-400'
                : 'fill-transparent stroke-muted-foreground'
            )}
          />
        </button>
      ))}
    </div>
  );
}

export default function ProductDetailTabs({ product, tab, onTab, reviews }: Props) {
  const t = useTranslations('productDetail');
  const [openPanels, setOpenPanels] = useState<Set<Tab>>(new Set(['description']));
  /* Review form state */
  const [rating, setRating]     = useState(0);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewBody, setReviewBody]   = useState('');
  const [submitted, setSubmitted]     = useState(false);
  const [submitErr, setSubmitErr]     = useState('');

  const submitMutation = useMutation({
    mutationFn: () =>
      reviewsApi.submit({ productId: product.id, rating, title: reviewTitle, body: reviewBody }),
    onSuccess: () => { setSubmitted(true); setSubmitErr(''); },
    onError: (err: any) => setSubmitErr(err?.response?.data?.message ?? t('reviewSubmitError')),
  });

  const togglePanel = (id: Tab) => {
    setOpenPanels((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    onTab(id);
  };

  /* Spec entries from real backend data */
  const specEntries: [string, string][] = Object.entries(product.specifications ?? {}).map(
    ([k, v]) => [k, String(v)]
  );

  /* Attribute entries */
  const attrEntries: [string, string][] = Object.entries(product.attributes ?? {}).map(
    ([k, v]) => [k, String(v)]
  );

  const brandLogoSrc = product.brandLogoUrl ? getMediaUrl(product.brandLogoUrl) : null;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'description', label: t('tabDescription') },
    { id: 'specs',       label: t('tabSpecs'),      count: specEntries.length || undefined },
    { id: 'attributes',  label: t('tabAttributes'), count: attrEntries.length || undefined },
    { id: 'tags',        label: t('tabTags'),       count: (product.tags?.length) || undefined },
    { id: 'reviews',     label: t('tabReviews'),    count: (product.ratingCount ?? product.reviewCount ?? 0) || undefined },
  ];

  function SpecTable({ entries, emptyKey }: { entries: [string,string][]; emptyKey: string }) {
    if (entries.length === 0) return <p className="text-sm text-muted-foreground">{t(emptyKey as any)}</p>;
    return (
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <tbody>
            {entries.map(([k, v]) => (
              <tr key={k} className="border-b border-border last:border-0">
                <th className="w-2/5 bg-muted/50 px-4 py-3 text-left font-medium text-foreground">{k}</th>
                <td className="px-4 py-3 text-muted-foreground">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function TabContent({ id }: { id: Tab }) {
    if (id === 'description') {
      return (
        <div className="space-y-4">
          {/* Brand block */}
          {(product.brand || brandLogoSrc) && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
              {brandLogoSrc && (
                <Image src={brandLogoSrc} alt={product.brand ?? ''} width={48} height={48}
                  className="rounded-lg object-contain" unoptimized />
              )}
              {product.brand && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('brand')}</p>
                  <p className="text-sm font-semibold text-foreground">{product.brand}</p>
                </div>
              )}
            </div>
          )}
          <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
            {product.description ? (
              <p className="whitespace-pre-wrap leading-relaxed">{product.description}</p>
            ) : (
              <p className="text-muted-foreground">{t('noDescription')}</p>
            )}
          </div>
        </div>
      );
    }

    if (id === 'specs') return <SpecTable entries={specEntries} emptyKey="noSpecs" />;

    if (id === 'attributes') return <SpecTable entries={attrEntries} emptyKey="noAttributes" />;

    if (id === 'tags') {
      const tags = product.tags ?? [];
      if (tags.length === 0)
        return <p className="text-sm text-muted-foreground">{t('noTags')}</p>;
      return (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/8 px-3 py-1.5 text-sm font-medium text-primary"
            >
              <Tag className="h-3.5 w-3.5" />
              {tag}
            </span>
          ))}
        </div>
      );
    }

    /* Reviews tab */
    return (
      <div className="space-y-6">
        {/* Rating summary */}
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-muted/30 p-4">
          <ProductStarRating value={product.ratingAvg ?? 0} size="md" />
          <span className="text-lg font-semibold text-foreground">
            {(product.ratingAvg ?? 0).toFixed(1)} / 5
          </span>
          <span className="text-sm text-muted-foreground">
            {product.ratingCount ?? product.reviewCount ?? 0} {t('reviewCountLabel')}
          </span>
        </div>

        {/* Review list */}
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noReviews')}</p>
        ) : (
          <ul className="space-y-3">
            {reviews.map((r, i) => (
              <li key={i} className="rounded-xl border border-border p-4">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {r.authorName?.[0]?.toUpperCase() ?? '?'}
                    </span>
                    <span className="text-sm font-semibold text-foreground">{r.authorName}</span>
                  </div>
                  <ProductStarRating value={r.rating} size="sm" />
                </div>
                {r.title && <p className="mb-1 text-sm font-medium text-foreground">{r.title}</p>}
                {r.body && <p className="text-sm leading-relaxed text-muted-foreground">{r.body}</p>}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    {t('helpful')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Submit review form */}
        <div className="rounded-xl border border-border bg-muted/20 p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">{t('writeReview')}</h3>
          {submitted ? (
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{t('reviewSubmitted')}</p>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); if (rating > 0) submitMutation.mutate(); }}
              className="space-y-3"
            >
              <StarPicker value={rating} onChange={setRating} />
              <input
                type="text"
                placeholder={t('reviewTitlePlaceholder')}
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <textarea
                rows={3}
                placeholder={t('reviewBodyPlaceholder')}
                value={reviewBody}
                onChange={(e) => setReviewBody(e.target.value)}
                required
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              {submitErr && <p className="text-xs text-destructive">{submitErr}</p>}
              <button
                type="submit"
                disabled={rating === 0 || submitMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {submitMutation.isPending ? t('submitting') : t('submitReview')}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 border-t border-border pt-6 sm:mt-12 sm:pt-8">

      {/* ── Desktop tab bar ── */}
      <div className="hidden sm:block">
        <div className="flex flex-wrap gap-1 border-b border-border">
          {tabs.map(({ id, label, count }) => (
            <button
              key={id}
              type="button"
              onClick={() => onTab(id)}
              className={cn(
                '-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                tab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
              {count != null && (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                  tab === id ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                )}>{count}</span>
              )}
            </button>
          ))}
        </div>
        <div className="py-6">
          <TabContent id={tab} />
        </div>
      </div>

      {/* ── Mobile accordion ── */}
      <div className="divide-y divide-border rounded-xl border border-border sm:hidden">
        {tabs.map(({ id, label, count }) => {
          const isOpen = openPanels.has(id);
          return (
            <div key={id}>
              <button
                type="button"
                onClick={() => togglePanel(id)}
                className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
              >
                <span className={cn('flex items-center gap-2 text-sm font-semibold',
                  isOpen ? 'text-primary' : 'text-foreground')}>
                  {label}
                  {count != null && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{count}</span>
                  )}
                </span>
                <ChevronDown className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                  isOpen && 'rotate-180'
                )} />
              </button>
              {isOpen && (
                <div className="border-t border-border/60 px-4 pb-5 pt-4">
                  <TabContent id={id} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
