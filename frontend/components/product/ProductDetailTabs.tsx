'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ChevronDown, Star, ThumbsUp, Send, Tag, MessageCircleQuestion,
  Filter, SortAsc, ImagePlus, X,
} from 'lucide-react';
import Image from 'next/image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProductDetail, ProductReviewItem } from '@/types';
import ProductStarRating from './ProductStarRating';
import { reviewsApi, qaApi, uploadApi } from '@/lib/api';
import { getMediaUrl } from '@/lib/mediaUrl';
import { cn } from '@/lib/utils';
import { connectSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';

type Tab = 'description' | 'specs' | 'attributes' | 'tags' | 'reviews' | 'qa';

interface Props {
  product: ProductDetail;
  tab: Tab;
  onTab: (t: Tab) => void;
  reviews: ProductReviewItem[];
}

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

function SpecTable({
  entries,
  emptyLabel,
}: {
  entries: [string, string][];
  emptyLabel: string;
}) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <tbody>
          {entries.map(([k, v], i) => (
            <tr key={`${i}-${k}`} className="border-b border-border last:border-0">
              <th className="w-2/5 bg-muted/50 px-4 py-3 text-left font-medium text-foreground">{k}</th>
              <td className="px-4 py-3 text-muted-foreground">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PhotoPicker({
  urls,
  onChange,
  max = 5,
}: {
  urls: string[];
  onChange: (next: string[]) => void;
  max?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = max - urls.length;
    const toUpload = files.slice(0, remaining);
    setUploading(true);
    setErr('');
    const next = [...urls];
    for (const file of toUpload) {
      try {
        const res = await uploadApi.image(file, 'reviews');
        const data = res.data as { url?: string; secureUrl?: string; secure_url?: string };
        const url = data?.secureUrl || data?.url || data?.secure_url || '';
        if (url) next.push(url);
      } catch {
        setErr('Photo upload failed. Please try again.');
      }
    }
    onChange(next);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {urls.map((url) => (
          <div key={url} className="relative h-16 w-16 overflow-hidden rounded-lg border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(urls.filter((u) => u !== url))}
              className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
              aria-label="Remove photo"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {urls.length < max && (
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-primary disabled:opacity-50"
          >
            <ImagePlus className="h-4 w-4" />
            <span className="text-[10px] font-semibold">{uploading ? '…' : 'Add'}</span>
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}

type QaItem = {
  id: string;
  question: string;
  answer?: string;
  asker_name?: string;
  askerName?: string;
  askerAvatar?: string | null;
  asked_at?: string;
  askedAt?: string;
  answered_at?: string;
  answeredByName?: string | null;
  imageUrls?: string[];
  answerImageUrls?: string[];
  pending?: boolean;
  status?: string;
};

function DescriptionPanel({
  product,
  brandLogoSrc,
  brandLabel,
  noDescription,
}: {
  product: ProductDetail;
  brandLogoSrc: string | null;
  brandLabel: string;
  noDescription: string;
}) {
  return (
    <div className="space-y-4">
      {(product.brand || brandLogoSrc) && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
          {brandLogoSrc && (
            <Image
              src={brandLogoSrc}
              alt={product.brand ?? ''}
              width={48}
              height={48}
              className="rounded-lg object-contain"
              unoptimized
            />
          )}
          {product.brand && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{brandLabel}</p>
              <p className="text-sm font-semibold text-foreground">{product.brand}</p>
            </div>
          )}
        </div>
      )}
      <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-3 [&_a]:text-primary [&_a]:underline">
        {product.description ? (
          <div dangerouslySetInnerHTML={{ __html: product.description }} />
        ) : (
          <p className="text-muted-foreground">{noDescription}</p>
        )}
      </div>
    </div>
  );
}

export default function ProductDetailTabs({ product, tab, onTab, reviews }: Props) {
  const t = useTranslations('productDetail');
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const orderId = (searchParams.get('orderId') || '').trim() || undefined;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [openPanels, setOpenPanels] = useState<Set<Tab>>(new Set(['description']));

  const [rating, setRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewBody, setReviewBody] = useState('');
  const [reviewLang, setReviewLang] = useState<'en' | 'bn'>('en');
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitErr, setSubmitErr] = useState('');
  const [bonusMsg, setBonusMsg] = useState('');
  const [prefilledMine, setPrefilledMine] = useState(false);

  const [reviewSort, setReviewSort] = useState<'newest' | 'helpful' | 'highest' | 'lowest'>('newest');
  const [reviewRating, setReviewRating] = useState(0);

  const [qaQuestion, setQaQuestion] = useState('');
  const [qaName, setQaName] = useState('');
  const [qaEmail, setQaEmail] = useState('');
  const [qaImages, setQaImages] = useState<string[]>([]);
  const [qaSubmitted, setQaSubmitted] = useState(false);
  const [qaErr, setQaErr] = useState('');

  const submitMutation = useMutation({
    mutationFn: () =>
      reviewsApi.submit({
        productId: product.id,
        rating,
        title: reviewTitle,
        body: reviewBody,
        lang: reviewLang,
        orderId,
        imageUrls: reviewImages.length ? reviewImages : undefined,
      }),
    onSuccess: (res) => {
      const payload = res?.data as {
        review?: { edited?: boolean };
        obPointsBonus?: { awarded?: boolean; points?: number };
      };
      // #region agent log
      fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '1eb282' },
        body: JSON.stringify({
          sessionId: '1eb282',
          runId: 'review-edit',
          hypothesisId: 'H-PDP-EDIT',
          location: 'ProductDetailTabs.tsx:onSuccess',
          message: 'pdp review submit ok',
          data: {
            edited: Boolean(payload?.review?.edited),
            hasOrderId: Boolean(orderId),
            bonusAwarded: Boolean(payload?.obPointsBonus?.awarded),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      setSubmitted(true);
      setSubmitErr('');
      if (payload?.obPointsBonus?.awarded) {
        setBonusMsg(`+${payload.obPointsBonus.points || 5} OB Points awarded for your review.`);
      }
      qc.invalidateQueries({ queryKey: ['reviews', product.id] });
    },
    onError: (err: any) =>
      setSubmitErr(err?.response?.data?.error || err?.response?.data?.message || t('reviewSubmitError')),
  });

  const { data: filteredReviewsData, refetch: refetchReviews } = useQuery({
    queryKey: ['reviews', product.id, reviewSort, reviewRating],
    queryFn: () =>
      reviewsApi.product(product.id, { sort: reviewSort, rating: reviewRating || undefined }).then((r) => r.data),
    enabled: tab === 'reviews' || openPanels.has('reviews'),
    staleTime: 30_000,
    refetchInterval: tab === 'reviews' || openPanels.has('reviews') ? 45_000 : false,
  });
  const displayReviews: ProductReviewItem[] = filteredReviewsData?.reviews ?? reviews;
  const myReview = (filteredReviewsData as { myReview?: ProductReviewItem | null } | undefined)?.myReview ?? null;

  useEffect(() => {
    if (!myReview || prefilledMine) return;
    setRating(myReview.rating || 0);
    setReviewTitle(myReview.title || '');
    setReviewBody(myReview.body || '');
    setReviewImages(Array.isArray(myReview.imageUrls) ? myReview.imageUrls : []);
    setPrefilledMine(true);
  }, [myReview, prefilledMine]);

  const { data: qaData, refetch: refetchQa } = useQuery({
    queryKey: ['qa', product.id],
    queryFn: () => qaApi.list(product.id).then((r) => r.data),
    enabled: tab === 'qa' || openPanels.has('qa'),
    staleTime: 30_000,
    refetchInterval: tab === 'qa' || openPanels.has('qa') ? 45_000 : false,
  });
  const qaItems: QaItem[] = qaData?.qa ?? [];

  const qaSubmitMutation = useMutation({
    mutationFn: () =>
      qaApi.ask(product.id, {
        question: qaQuestion,
        askerName: qaName || undefined,
        askerEmail: qaEmail || undefined,
        imageUrls: qaImages.length ? qaImages : undefined,
      }),
    onSuccess: () => {
      setQaSubmitted(true);
      setQaErr('');
      setQaQuestion('');
      setQaName('');
      setQaEmail('');
      setQaImages([]);
      refetchQa();
    },
    onError: (err: any) =>
      setQaErr(err?.response?.data?.error || err?.response?.data?.detail || 'Failed to submit question'),
  });

  useEffect(() => {
    const socket = connectSocket();
    const onReviews = (payload: { productId?: string }) => {
      if (payload?.productId === product.id) {
        refetchReviews();
        qc.invalidateQueries({ queryKey: ['reviews', product.id] });
      }
    };
    const onQa = (payload: { productId?: string }) => {
      if (payload?.productId === product.id) refetchQa();
    };
    socket.on('storefront:reviews:updated', onReviews);
    socket.on('storefront:qa:updated', onQa);
    return () => {
      socket.off('storefront:reviews:updated', onReviews);
      socket.off('storefront:qa:updated', onQa);
    };
  }, [product.id, refetchReviews, refetchQa, qc]);

  const togglePanel = (id: Tab) => {
    setOpenPanels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    onTab(id);
  };

  const specEntries: [string, string][] = Array.isArray((product as any).specificationsEntries)
    ? (product as any).specificationsEntries.map((e: { key: string; value: string }) => [e.key, String(e.value)])
    : Object.entries(product.specifications ?? {}).map(([k, v]) => [k, String(v)]);
  const attrEntries: [string, string][] = Array.isArray((product as any).attributesEntries)
    ? (product as any).attributesEntries.map((e: { key: string; value: string }) => [e.key, String(e.value)])
    : Object.entries(product.attributes ?? {}).map(([k, v]) => [k, String(v)]);
  const brandLogoSrc = product.brandLogoUrl ? getMediaUrl(product.brandLogoUrl) : null;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'description', label: t('tabDescription') },
    { id: 'specs', label: t('tabSpecs'), count: specEntries.length || undefined },
    { id: 'attributes', label: t('tabAttributes'), count: attrEntries.length || undefined },
    { id: 'tags', label: t('tabTags'), count: product.tags?.length || undefined },
    { id: 'reviews', label: t('tabReviews'), count: (product.ratingCount ?? product.reviewCount ?? 0) || undefined },
    { id: 'qa', label: 'Q&A' },
  ];

  const dist = (filteredReviewsData as { ratingDistribution?: Record<number, number>; averageRating?: number; totalReviews?: number } | undefined);
  const ratingDist = dist?.ratingDistribution ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const distTotal = Object.values(ratingDist).reduce((a, b) => a + Number(b || 0), 0)
    || (product.ratingCount ?? product.reviewCount ?? 0);
  const avgShown = dist?.averageRating ?? product.ratingAvg ?? 0;

  const reviewsPanel = (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-xl border border-border bg-muted/30 p-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex flex-col items-start gap-1 sm:items-center">
          <ProductStarRating value={avgShown} size="md" />
          <span className="text-2xl font-bold text-foreground">{Number(avgShown).toFixed(1)}</span>
          <span className="text-xs text-muted-foreground">
            {distTotal} {t('reviewCountLabel')}
          </span>
        </div>
        <div className="w-full space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = Number(ratingDist[star] || 0);
            const pct = distTotal > 0 ? Math.round((count / distTotal) * 100) : 0;
            return (
              <button
                key={star}
                type="button"
                onClick={() => setReviewRating(star)}
                className="flex w-full items-center gap-2 text-left text-xs text-muted-foreground hover:text-foreground"
              >
                <span className="w-10 shrink-0 font-medium">{star}★</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                </span>
                <span className="w-8 shrink-0 text-right">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <SortAsc className="h-3.5 w-3.5" /> Sort:
        </div>
        {(['newest', 'helpful', 'highest', 'lowest'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setReviewSort(s)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
              reviewSort === s
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:bg-muted'
            )}
          >
            {s === 'newest' ? 'Newest' : s === 'helpful' ? 'Most Helpful' : s === 'highest' ? 'Highest' : 'Lowest'}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Rating:
        </div>
        {[0, 5, 4, 3, 2, 1].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReviewRating(r)}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors',
              reviewRating === r
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:bg-muted'
            )}
          >
            {r === 0 ? 'All' : `${r}★`}
          </button>
        ))}
      </div>

      {displayReviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noReviews')}</p>
      ) : (
        <ul className="space-y-3">
          {displayReviews.map((r, idx) => {
            const reviewId = (r as ProductReviewItem & { id?: string }).id;
            const imageUrls = (r as ProductReviewItem & { imageUrls?: string[] }).imageUrls ?? [];
            return (
            <li key={reviewId || `${r.authorName}-${r.createdAt}-${idx}`} className="rounded-xl border border-border p-4">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {r.authorAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.authorAvatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {r.authorName?.[0]?.toUpperCase() ?? '?'}
                    </span>
                  )}
                  <div>
                    <span className="text-sm font-semibold text-foreground">{r.authorName}</span>
                    {r.pending && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Pending approval</span>
                    )}
                  </div>
                </div>
                <ProductStarRating value={r.rating} size="sm" />
              </div>
              {r.title && <p className="mb-1 text-sm font-medium text-foreground">{r.title}</p>}
              {r.body && <p className="text-sm leading-relaxed text-muted-foreground">{r.body}</p>}
              {imageUrls.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {imageUrls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="block h-16 w-16 overflow-hidden rounded-lg border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</p>
                {reviewId && (
                  <button
                    type="button"
                    onClick={() => reviewsApi.voteHelpful(reviewId).catch(() => {})}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    {t('helpful')}
                  </button>
                )}
              </div>
            </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-xl border border-border bg-muted/20 p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground">
          {myReview ? 'Edit your review' : t('writeReview')}
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          One review per product. You can update it after another purchase. Edits go back to moderation.
          {orderId ? ' Completing the post-delivery survey + review earns 5 OB Points once per order.' : ''}
        </p>
        {bonusMsg && <p className="mb-3 text-sm font-medium text-emerald-700">{bonusMsg}</p>}
        {submitted ? (
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{t('reviewSubmitted')}</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (rating > 0) submitMutation.mutate();
            }}
            className="space-y-3"
          >
            <StarPicker value={rating} onChange={setRating} />
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Write in:</span>
              {(['en', 'bn'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setReviewLang(lang)}
                  className={cn(
                    'rounded-lg px-3 py-1 text-xs font-semibold transition-colors',
                    reviewLang === lang
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border bg-background text-muted-foreground hover:bg-muted'
                  )}
                >
                  {lang === 'en' ? 'English' : 'বাংলা'}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder={reviewLang === 'bn' ? 'শিরোনাম (ঐচ্ছিক)' : t('reviewTitlePlaceholder')}
              value={reviewTitle}
              onChange={(e) => setReviewTitle(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <textarea
              rows={3}
              placeholder={reviewLang === 'bn' ? 'আপনার মতামত লিখুন...' : t('reviewBodyPlaceholder')}
              value={reviewBody}
              onChange={(e) => setReviewBody(e.target.value)}
              required
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {isAuthenticated ? (
              <PhotoPicker urls={reviewImages} onChange={setReviewImages} />
            ) : (
              <p className="text-xs text-muted-foreground">Log in to attach photos with your review.</p>
            )}
            {submitErr && <p className="text-xs text-destructive">{submitErr}</p>}
            <button
              type="submit"
              disabled={rating === 0 || submitMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {submitMutation.isPending
                ? t('submitting')
                : myReview
                  ? 'Save updated review'
                  : t('submitReview')}
            </button>
          </form>
        )}
      </div>
    </div>
  );

  const qaPanel = (
    <div className="space-y-5">
      <div className="mb-2 flex items-center gap-2">
        <MessageCircleQuestion className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">Customer Questions &amp; Answers</h3>
      </div>
      {qaItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">No questions yet. Be the first to ask!</p>
      ) : (
        <ul className="space-y-3">
          {qaItems.map((q) => {
            const askerName = q.askerName || q.asker_name || 'Customer';
            const askerAvatar = (q as { askerAvatar?: string | null }).askerAvatar;
            const answeredBy = (q as { answeredByName?: string | null }).answeredByName || 'OceanBazar Customer Support';
            const pending = Boolean((q as { pending?: boolean }).pending);
            const answerImages = (q as { answerImageUrls?: string[] }).answerImageUrls ?? [];
            return (
            <li key={q.id} className="rounded-xl border border-border p-4">
              <div className="mb-2 flex items-center gap-2">
                {askerAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={askerAvatar} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {askerName[0]?.toUpperCase() ?? '?'}
                  </span>
                )}
                <span className="text-xs font-semibold text-foreground">{askerName}</span>
                {pending && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Pending</span>
                )}
              </div>
              <p className="mb-1 text-sm font-semibold text-foreground">Q: {q.question}</p>
              {Array.isArray(q.imageUrls) && q.imageUrls.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {q.imageUrls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="block h-14 w-14 overflow-hidden rounded-lg border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
              {q.answer ? (
                <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs font-semibold text-primary">Reply from {answeredBy}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{q.answer}</p>
                  {answerImages.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {answerImages.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer" className="block h-14 w-14 overflow-hidden rounded-lg border border-border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs italic text-muted-foreground">Awaiting answer from OceanBazar Customer Support</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(q.asked_at || q.askedAt || Date.now()).toLocaleDateString()}
              </p>
            </li>
            );
          })}
        </ul>
      )}
      {!qaSubmitted ? (
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <h4 className="mb-3 text-sm font-semibold text-foreground">Ask a Question</h4>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Your name (optional)"
              value={qaName}
              onChange={(e) => setQaName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <input
              type="email"
              placeholder="Your email (optional)"
              value={qaEmail}
              onChange={(e) => setQaEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <textarea
              rows={2}
              placeholder="What would you like to know about this product?"
              value={qaQuestion}
              onChange={(e) => setQaQuestion(e.target.value)}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {isAuthenticated ? (
              <PhotoPicker urls={qaImages} onChange={setQaImages} max={3} />
            ) : (
              <p className="text-xs text-muted-foreground">Log in to attach photos with your question.</p>
            )}
            {qaErr && <p className="text-xs text-destructive">{qaErr}</p>}
            <button
              type="button"
              disabled={qaQuestion.trim().length < 5 || qaSubmitMutation.isPending}
              onClick={() => qaSubmitMutation.mutate()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {qaSubmitMutation.isPending ? 'Submitting…' : 'Submit Question'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
          Question submitted! We&apos;ll answer it soon.
        </p>
      )}
    </div>
  );

  function renderPanel(id: Tab) {
    if (id === 'description') {
      return (
        <DescriptionPanel
          product={product}
          brandLogoSrc={brandLogoSrc}
          brandLabel={t('brand')}
          noDescription={t('noDescription')}
        />
      );
    }
    if (id === 'specs') return <SpecTable entries={specEntries} emptyLabel={t('noSpecs')} />;
    if (id === 'attributes') return <SpecTable entries={attrEntries} emptyLabel={t('noAttributes')} />;
    if (id === 'tags') {
      const tags = product.tags ?? [];
      if (tags.length === 0) return <p className="text-sm text-muted-foreground">{t('noTags')}</p>;
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
    if (id === 'qa') return qaPanel;
    return reviewsPanel;
  }

  return (
    <div className="mt-8 border-t border-border pt-6 sm:mt-12 sm:pt-8">
      <div className="hidden sm:block">
        <div className="flex flex-wrap gap-1 border-b border-border">
          {tabs.map(({ id, label, count }) => (
            <button
              key={id}
              type="button"
              onClick={() => onTab(id)}
              className={cn(
                '-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                tab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
              {count != null && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                    tab === id ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="py-6">{renderPanel(tab)}</div>
      </div>

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
                <span className={cn('flex items-center gap-2 text-sm font-semibold', isOpen ? 'text-primary' : 'text-foreground')}>
                  {label}
                  {count != null && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{count}</span>
                  )}
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                    isOpen && 'rotate-180'
                  )}
                />
              </button>
              {isOpen && <div className="border-t border-border/60 px-4 pb-5 pt-4">{renderPanel(id)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
