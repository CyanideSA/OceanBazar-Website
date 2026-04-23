import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { reviewAPI, productAPI } from "@/api/service";
import { useToast } from "@/hooks/use-toast";
import AccountLayout from "@/components/AccountLayout";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function ReviewsPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderIdFromUrl = (searchParams.get("order") || "").trim();
  const { toast } = useToast();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!productId) return;
    setLoadError(null);
    setLoading(true);
    try {
      const [prodRes, revRes] = await Promise.all([
        productAPI.getById(productId),
        reviewAPI.getByProduct(productId),
      ]);
      setProduct(prodRes.data);
      setReviews(Array.isArray(revRes.data) ? revRes.data : []);
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.response?.data?.message || "Could not load this product or its reviews.";
      setLoadError(msg);
      setProduct(null);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const c = comment.trim();
    if (c.length < 3) {
      toast({ title: "A bit more detail?", description: "Please write at least 3 characters in your review.", variant: "destructive" });
      return;
    }
    const user = JSON.parse(localStorage.getItem("oceanBazarUser") || "{}");
    setSubmitting(true);
    try {
      const payload = {
        productId,
        userName: user.name,
        rating,
        comment: c,
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(orderIdFromUrl ? { orderId: orderIdFromUrl } : {}),
      };
      await reviewAPI.submit(payload);
      toast({
        title: "Review submitted",
        description: orderIdFromUrl
          ? "Thanks — your verified-purchase review is pending moderation."
          : "Thanks — your review is pending moderation and will appear after approval.",
      });
      setTitle("");
      setComment("");
      setRating(5);
      const revRes = await reviewAPI.getByProduct(productId);
      setReviews(Array.isArray(revRes.data) ? revRes.data : []);
    } catch (e) {
      toast({
        title: "Could not submit",
        description: e?.response?.data?.detail || e?.response?.data?.message || "Try again later.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const stars = (n) => "★".repeat(n || 0) + "☆".repeat(5 - (n || 0));
  const avgRating =
    reviews.length > 0 ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1) : "—";

  if (loading) {
    return (
      <AccountLayout>
        <div className="flex items-center justify-center gap-2 py-24 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin" />
          Loading…
        </div>
      </AccountLayout>
    );
  }

  if (loadError || !product) {
    return (
      <AccountLayout>
        <div className="max-w-lg mx-auto rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200 p-6">
          <p className="font-medium mb-2">We couldn’t open reviews</p>
          <p className="text-sm mb-4">{loadError || "Product not found."}</p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Go back
          </Button>
        </div>
      </AccountLayout>
    );
  }

  return (
    <AccountLayout>
      <div className="max-w-3xl mx-auto space-y-6 pb-10">
        <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/80 p-6 shadow-sm">
          <div className="flex items-center gap-4">
            {product.image ? (
              <img src={product.image} alt="" className="w-20 h-20 object-cover rounded-xl border border-gray-100 dark:border-gray-600" />
            ) : null}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{product.name}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {product.category} — {avgRating} avg · {reviews.length} published review{reviews.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/80 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Write a review</h2>
          {orderIdFromUrl ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-300/90 mb-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 border border-emerald-100 dark:border-emerald-900/50">
              Linked to your order — we’ll mark this as a verified purchase after a quick check.
            </p>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Share an honest opinion to help other buyers on OceanBazar.
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Rating</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n} stars`}
                    onClick={() => setRating(n)}
                    className={`text-3xl transition ${n <= rating ? "text-amber-400" : "text-gray-300 dark:text-gray-600"} hover:text-amber-400`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Title (optional)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="Short headline"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Your review</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                required
                minLength={3}
                maxLength={2000}
                rows={4}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="Quality, packaging, delivery — what stood out?"
              />
            </div>
            <Button type="submit" disabled={submitting} className="bg-[#5BA3D0] hover:bg-[#4A90B8] text-white">
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                  Submitting…
                </>
              ) : (
                "Submit review"
              )}
            </Button>
          </form>
        </div>

        <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/80 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Customer reviews ({reviews.length})</h2>
          {reviews.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-10">No published reviews yet. Be the first.</p>
          ) : (
            <ul className="space-y-5">
              {reviews.map((r) => (
                <li key={r.id} className="border-b border-gray-100 dark:border-gray-700 pb-5 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-amber-400 tracking-tight">{stars(r.rating)}</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{r.userName || "Customer"}</span>
                    {r.verified ? (
                      <span className="text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-full">
                        Verified purchase
                      </span>
                    ) : null}
                    <span className="text-gray-400 text-sm ml-auto">
                      {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ""}
                    </span>
                  </div>
                  {r.title ? <h3 className="font-medium text-gray-800 dark:text-gray-200">{r.title}</h3> : null}
                  <p className="text-gray-600 dark:text-gray-300 text-sm mt-1 whitespace-pre-wrap">{r.comment}</p>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await reviewAPI.markHelpful(r.id);
                        toast({ title: "Thanks for the vote" });
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="text-sm text-[#5BA3D0] hover:underline mt-2"
                  >
                    Helpful ({r.helpfulCount || 0})
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AccountLayout>
  );
}
