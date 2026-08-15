'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, Star, Loader2, CheckCircle2 } from 'lucide-react';
import { ordersApi, reviewsApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Props {
  orderId: string;
  open: boolean;
  onClose: () => void;
}

interface SurveyProduct {
  productId: string;
  title: string | null;
}

interface SurveyState {
  orderId: string;
  orderNumber: string;
  status: string;
  delivered: boolean;
  submitted: boolean;
  canReview: boolean;
  feedback: { rating: number; comment: string | null } | null;
  products: SurveyProduct[];
}

function StarRating({
  value,
  onChange,
  size = 28,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label={label || 'Rating'}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange(n)}
          className="rounded p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Star
            width={size}
            height={size}
            className={cn(
              n <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40',
            )}
          />
        </button>
      ))}
    </div>
  );
}

export default function OrderReviewSurveyModal({ orderId, open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<SurveyState | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [surveyDone, setSurveyDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productRatings, setProductRatings] = useState<Record<string, number>>({});
  const [reviewedProducts, setReviewedProducts] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await ordersApi.survey(orderId);
      const s = data as SurveyState;
      setState(s);
      if (s.feedback) {
        setRating(s.feedback.rating);
        setComment(s.feedback.comment ?? '');
        setSurveyDone(Boolean(s.submitted));
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not load the survey. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function submitSurvey() {
    if (rating < 1) {
      setError('Please choose a rating from 1 to 5 stars.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await ordersApi.submitSurvey(orderId, { rating, comment: comment.trim() || undefined });
      setSurveyDone(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not submit your feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitProductReview(productId: string) {
    const r = productRatings[productId];
    if (!r) return;
    try {
      await reviewsApi.submit({ productId, rating: r, orderId });
      setReviewedProducts((prev) => ({ ...prev, [productId]: true }));
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not submit the product review.');
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Order experience survey"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card p-6 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Rate your order</h2>
            {state?.orderNumber && (
              <p className="mt-0.5 text-sm text-muted-foreground">Order #{state.orderNumber}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X width={20} height={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Order experience survey */}
            <section className="mb-6">
              <p className="mb-2 text-sm font-semibold text-foreground">How was your overall experience?</p>
              {surveyDone ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> Thanks for your feedback!
                </div>
              ) : (
                <>
                  <StarRating value={rating} onChange={setRating} label="Overall experience" />
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Tell us what went well or what we can improve (optional)"
                    rows={3}
                    maxLength={2000}
                    className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={submitSurvey}
                    disabled={submitting}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-60"
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Submit feedback
                  </button>
                </>
              )}
            </section>

            {/* Per-product reviews */}
            {state?.products?.length ? (
              <section className="border-t border-border pt-4">
                <p className="mb-3 text-sm font-semibold text-foreground">Review the products you received</p>
                <ul className="space-y-3">
                  {state.products.map((p) => (
                    <li key={p.productId} className="rounded-lg border border-border p-3">
                      <p className="mb-2 truncate text-sm font-medium text-foreground">
                        {p.title || 'Product'}
                      </p>
                      {reviewedProducts[p.productId] ? (
                        <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" /> Review submitted
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3">
                          <StarRating
                            size={22}
                            value={productRatings[p.productId] ?? 0}
                            onChange={(v) =>
                              setProductRatings((prev) => ({ ...prev, [p.productId]: v }))
                            }
                            label={`Rate ${p.title || 'product'}`}
                          />
                          <button
                            type="button"
                            onClick={() => submitProductReview(p.productId)}
                            disabled={!productRatings[p.productId]}
                            className="rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
                          >
                            Submit review
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
