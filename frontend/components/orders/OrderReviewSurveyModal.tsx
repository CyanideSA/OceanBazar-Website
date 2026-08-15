'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Star, X } from 'lucide-react';
import { ordersApi, reviewsApi, uploadApi } from '@/lib/api';
import { cn } from '@/lib/utils';

type SurveyState = {
  orderId: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  isDelivered: boolean;
  surveyCompleted: boolean;
  reviewBonusAwarded: boolean;
  pendingReviewCount: number;
  items: Array<{
    productId: string;
    productTitle: string;
    quantity: number;
    reviewed: boolean;
    updatedForThisOrder?: boolean;
    canEdit?: boolean;
    reviewStatus: string | null;
    existingReview?: {
      id: string;
      rating: number;
      title: string | null;
      body: string | null;
      imageUrls: string[];
      status: string;
    } | null;
  }>;
};

function ScorePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)} className="p-0.5" aria-label={`${n} stars`}>
            <Star
              className={cn(
                'h-6 w-6',
                n <= value ? 'fill-amber-400 stroke-amber-400' : 'fill-transparent stroke-muted-foreground',
              )}
            />
          </button>
        ))}
      </div>
    </label>
  );
}

export default function OrderReviewSurveyModal({
  orderId,
  open,
  onClose,
}: {
  orderId: string;
  open: boolean;
  onClose: () => void;
}) {
  const locale = useLocale();
  const qc = useQueryClient();
  const [step, setStep] = useState<'survey' | 'reviews' | 'done'>('survey');
  const [productSatisfaction, setProductSatisfaction] = useState(0);
  const [serviceSatisfaction, setServiceSatisfaction] = useState(0);
  const [paymentConvenience, setPaymentConvenience] = useState(0);
  const [codExperience, setCodExperience] = useState(0);
  const [deliveryExperience, setDeliveryExperience] = useState(0);
  const [comments, setComments] = useState('');
  const [error, setError] = useState('');
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [bonusMsg, setBonusMsg] = useState('');

  const { data, refetch } = useQuery({
    queryKey: ['order-survey', orderId],
    queryFn: () => ordersApi.surveyState(orderId).then((r) => r.data as SurveyState),
    enabled: open,
  });

  const isCod = String(data?.paymentMethod || '').toLowerCase() === 'cod';

  useEffect(() => {
    if (!data) return;
    if (data.surveyCompleted) setStep(data.pendingReviewCount > 0 ? 'reviews' : 'done');
    else setStep('survey');
  }, [data]);

  const pendingItems = useMemo(
    () => (data?.items || []).filter((i) => !i.updatedForThisOrder),
    [data],
  );

  function openReviewEditor(item: SurveyState['items'][number]) {
    const existing = item.existingReview;
    setActiveProductId(item.productId);
    setRating(existing?.rating || 5);
    setTitle(existing?.title || '');
    setBody(existing?.body || '');
    setImages(Array.isArray(existing?.imageUrls) ? existing!.imageUrls : []);
    setError('');
  }

  const surveyMutation = useMutation({
    mutationFn: () =>
      ordersApi.submitSurvey(orderId, {
        productSatisfaction,
        serviceSatisfaction,
        paymentConvenience,
        codExperience: isCod ? codExperience : null,
        deliveryExperience,
        comments,
      }),
    onSuccess: async () => {
      setError('');
      await refetch();
      setStep('reviews');
      qc.invalidateQueries({ queryKey: ['order', orderId] });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error
        || (e as { message?: string }).message
        || 'Could not submit survey';
      setError(msg);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!activeProductId) throw new Error('Select a product');
      const res = await reviewsApi.submit({
        productId: activeProductId,
        orderId,
        rating,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
        imageUrls: images,
      });
      return res.data as {
        review?: { edited?: boolean };
        obPointsBonus?: { awarded?: boolean; points?: number };
      };
    },
    onSuccess: async (payload) => {
      // #region agent log
      fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '1eb282' },
        body: JSON.stringify({
          sessionId: '1eb282',
          runId: 'review-edit',
          hypothesisId: 'H-UI-EDIT-BONUS',
          location: 'OrderReviewSurveyModal.tsx:onSuccess',
          message: 'survey review submit ok',
          data: {
            edited: Boolean(payload?.review?.edited),
            bonusAwarded: Boolean(payload?.obPointsBonus?.awarded),
            points: payload?.obPointsBonus?.points || 0,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      if (payload?.obPointsBonus?.awarded) {
        setBonusMsg(`+${payload.obPointsBonus.points || 5} OB Points awarded for your review.`);
      }
      setActiveProductId(null);
      setRating(5);
      setTitle('');
      setBody('');
      setImages([]);
      await refetch();
      qc.invalidateQueries({ queryKey: ['order-survey', orderId] });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error
        || (e as { message?: string }).message
        || 'Could not submit review';
      setError(msg);
    },
  });

  async function onPickImages(files: FileList | null) {
    if (!files?.length) return;
    const next = [...images];
    for (const file of Array.from(files).slice(0, 5 - next.length)) {
      try {
        const res = await uploadApi.image(file, 'reviews');
        const url = (res.data as { url?: string; secureUrl?: string })?.url
          || (res.data as { secureUrl?: string })?.secureUrl;
        if (url) next.push(url);
      } catch { /* ignore single file */ }
    }
    setImages(next);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-background shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-background px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">OceanBazar</p>
            <h2 className="text-base font-bold text-foreground">Order experience</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground">
            Complete a short survey, then review products from this order. Finish a product review after the survey to earn <strong className="text-foreground">5 OB Points</strong>.
          </p>

          {step === 'survey' && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                surveyMutation.mutate();
              }}
            >
              <ScorePicker label="Product satisfaction" value={productSatisfaction} onChange={setProductSatisfaction} />
              <ScorePicker label="OceanBazar service" value={serviceSatisfaction} onChange={setServiceSatisfaction} />
              <ScorePicker label="Payment convenience" value={paymentConvenience} onChange={setPaymentConvenience} />
              {isCod && (
                <ScorePicker label="Cash on delivery experience" value={codExperience} onChange={setCodExperience} />
              )}
              <ScorePicker label="Delivery experience" value={deliveryExperience} onChange={setDeliveryExperience} />
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-foreground">Anything to say? (optional)</span>
                <textarea
                  rows={3}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={
                  surveyMutation.isPending
                  || !productSatisfaction
                  || !serviceSatisfaction
                  || !paymentConvenience
                  || !deliveryExperience
                  || (isCod && !codExperience)
                }
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {surveyMutation.isPending ? 'Saving…' : 'Continue to product reviews'}
              </button>
            </form>
          )}

          {step === 'reviews' && (
            <div className="space-y-3">
              {bonusMsg && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{bonusMsg}</p>}
              <p className="text-sm font-medium text-foreground">Review products from order #{data?.orderNumber}</p>
              <ul className="space-y-2">
                {(data?.items || []).map((item) => {
                  const isEdit = Boolean(item.reviewed);
                  return (
                  <li key={item.productId} className="rounded-xl border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.productTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.updatedForThisOrder
                            ? `Updated for this order (${item.reviewStatus || 'pending'})`
                            : item.reviewed
                              ? `Earlier review (${item.reviewStatus || 'submitted'}) — you can edit`
                              : 'Not reviewed yet'}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-lg border border-primary px-2.5 py-1 text-xs font-semibold text-primary"
                        onClick={() => openReviewEditor(item)}
                      >
                        {isEdit ? 'Edit review' : 'Write review'}
                      </button>
                    </div>
                    {activeProductId === item.productId && (
                      <div className="mt-3 space-y-2 border-t border-border pt-3">
                        <ScorePicker label="Your rating" value={rating} onChange={setRating} />
                        <input
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Title (optional)"
                          className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                        />
                        <textarea
                          value={body}
                          onChange={(e) => setBody(e.target.value)}
                          rows={3}
                          placeholder="Your review"
                          className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                        />
                        <input type="file" accept="image/*" multiple onChange={(e) => onPickImages(e.target.files)} />
                        {images.length > 0 && (
                          <p className="text-xs text-muted-foreground">{images.length} photo(s) attached</p>
                        )}
                        {error && <p className="text-xs text-destructive">{error}</p>}
                        <button
                          type="button"
                          disabled={reviewMutation.isPending || body.trim().length < 5}
                          onClick={() => reviewMutation.mutate()}
                          className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                        >
                          {reviewMutation.isPending
                            ? 'Saving…'
                            : isEdit
                              ? 'Save updated review'
                              : 'Submit review'}
                        </button>
                      </div>
                    )}
                    <Link
                      href={`/${locale}/product/${item.productId}?tab=reviews&orderId=${orderId}`}
                      className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                    >
                      Open product reviews
                    </Link>
                  </li>
                  );
                })}
              </ul>
              {pendingItems.length === 0 && (
                <button type="button" onClick={() => setStep('done')} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
                  Finish
                </button>
              )}
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-3 text-center">
              <p className="text-sm font-semibold text-foreground">Thank you for your feedback.</p>
              {data?.reviewBonusAwarded && (
                <p className="text-sm text-emerald-700">5 OB Points were added for your product review.</p>
              )}
              <button type="button" onClick={onClose} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
