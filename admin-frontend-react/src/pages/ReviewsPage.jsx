import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FiStar, FiCheck, FiX, FiSearch, FiBox, FiRefreshCw, FiImage, FiUser } from "react-icons/fi";
import { reviewService } from "../services/reviewService";
import { useToast } from "../components/ToastProvider";
import { format } from "date-fns";
function mediaUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return url;
}

export default function ReviewsPage() {
  const toast = useToast();
  const [reviews, setReviews] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reviewService.list(filter === "all" ? undefined : filter);
      const list = Array.isArray(res) ? res : res?.reviews || [];
      setPendingCount(Number(res?.pendingCount ?? list.filter((r) => r.status === "pending").length));
      setReviews(list.map((r) => ({
        id: r.id,
        productId: r.productId || r.product?.id,
        productName: r.product?.titleEn || r.productName || "Unknown product",
        productImage: r.productImage || r.product?.productAssets?.[0]?.url || null,
        productRatingAvg: r.product?.ratingAvg != null ? Number(r.product.ratingAvg) : null,
        productReviewCount: r.product?.reviewCount ?? null,
        customerName: r.user?.name || r.customerName || "Anonymous",
        customerEmail: r.user?.email || null,
        rating: r.rating,
        comment: r.body || r.comment || "",
        title: r.title || "",
        status: r.status,
        imageUrls: Array.isArray(r.imageUrls) ? r.imageUrls : [],
        verifiedPurchase: Boolean(r.verifiedPurchase),
        date: r.createdAt || r.date,
      })));
    } catch {
      toast.error("Failed to fetch reviews");
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  useEffect(() => {
    const t = window.setInterval(() => { fetchReviews(); }, 30_000);
    const onFocus = () => fetchReviews();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchReviews]);

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await reviewService.moderate(id, newStatus);
      setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
      if (filter === "pending" && newStatus !== "pending") {
        setReviews((prev) => prev.filter((r) => r.id !== id));
      }
      setPendingCount((c) => Math.max(0, c - (newStatus === "pending" ? 0 : 1)));
      toast.success(`Review ${newStatus}`);
    } catch {
      toast.error("Failed to update review status");
    }
  };

  const filteredReviews = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return reviews.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return (
        r.productName.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        (r.title || "").toLowerCase().includes(q) ||
        (r.comment || "").toLowerCase().includes(q)
      );
    });
  }, [reviews, filter, searchTerm]);

  const selected = filteredReviews.find((r) => r.id === selectedId) || filteredReviews[0] || null;

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  const statusBadge = (status) => {
    if (status === "pending") return "bg-crm-warning-dim text-crm-warning";
    if (status === "approved") return "bg-crm-success-dim text-crm-success";
    return "bg-crm-danger-dim text-crm-danger";
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-warning-dim text-crm-warning">
            <FiStar size={24} className="fill-current" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Product Reviews</h2>
            <p className="text-crm-text-dim text-sm">
              List view of every product review · {pendingCount} awaiting approval
            </p>
          </div>
        </div>
        <button type="button" className="crm-btn" onClick={() => fetchReviews()}>
          <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="crm-card flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
          <input
            type="text"
            placeholder="Search product, customer, or review…"
            className="crm-input pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {[
            { key: "pending", label: `Needs approval (${pendingCount})` },
            { key: "approved", label: "Approved" },
            { key: "rejected", label: "Rejected" },
            { key: "all", label: "All" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                filter === tab.key
                  ? "bg-crm-primary text-white"
                  : "bg-crm-bg-hover text-crm-text-dim hover:text-crm-text-bright"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-4 min-h-[60vh]">
        <div className="crm-card p-0 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-crm-border text-xs font-bold uppercase tracking-wider text-crm-text-dim">
            Reviews ({filteredReviews.length})
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[70vh]">
            {loading ? (
              <div className="p-16 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary" />
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="p-12 text-center text-crm-text-dim text-sm">No reviews in this view</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-crm-bg-alt border-b border-crm-border text-[11px] uppercase tracking-wider text-crm-text-dim">
                  <tr>
                    <th className="text-left px-3 py-2 font-bold">Product / Customer</th>
                    <th className="text-left px-3 py-2 font-bold">Rating</th>
                    <th className="text-left px-3 py-2 font-bold">Status</th>
                    <th className="text-left px-3 py-2 font-bold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReviews.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={`border-b border-crm-border/60 cursor-pointer transition-colors ${
                        selected?.id === r.id ? "bg-crm-primary-dim/40" : "hover:bg-crm-bg-hover"
                      }`}
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-10 w-10 rounded-lg bg-crm-bg-hover overflow-hidden shrink-0 flex items-center justify-center">
                            {r.productImage ? (
                              <img src={mediaUrl(r.productImage)} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <FiBox className="text-crm-text-muted" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-crm-text-bright truncate">{r.productName}</p>
                            <p className="text-xs text-crm-text-dim truncate flex items-center gap-1">
                              <FiUser size={11} /> {r.customerName}
                              {r.imageUrls.length > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-crm-primary ml-1">
                                  <FiImage size={11} />{r.imageUrls.length}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-0.5 text-crm-warning">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <FiStar key={n} size={12} fill={n <= r.rating ? "currentColor" : "none"} />
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`crm-badge text-[10px] capitalize ${statusBadge(r.status)}`}>{r.status}</span>
                      </td>
                      <td className="px-3 py-3 text-xs text-crm-text-dim whitespace-nowrap">
                        {r.date ? format(new Date(r.date), "MMM dd, HH:mm") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="crm-card flex flex-col min-h-[320px]">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-crm-text-dim text-sm">Select a review</div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-crm-border pb-3 mb-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-crm-primary mb-1">Review snapshot</p>
                  <h3 className="text-lg font-bold text-crm-text-bright truncate">{selected.productName}</h3>
                  <p className="text-xs text-crm-text-dim mt-0.5">
                    Product score: {selected.productRatingAvg != null ? selected.productRatingAvg.toFixed(1) : "—"}
                    {selected.productReviewCount != null ? ` · ${selected.productReviewCount} approved` : ""}
                  </p>
                </div>
                <span className={`crm-badge capitalize shrink-0 ${statusBadge(selected.status)}`}>{selected.status}</span>
              </div>

              <div className="flex items-center gap-3 mb-4">
                {selected.productImage && (
                  <img src={mediaUrl(selected.productImage)} alt="" className="h-16 w-16 rounded-xl object-cover border border-crm-border" />
                )}
                <div>
                  <p className="font-semibold text-crm-text-bright">{selected.customerName}</p>
                  {selected.customerEmail && <p className="text-xs text-crm-text-dim">{selected.customerEmail}</p>}
                  <div className="flex items-center gap-0.5 text-crm-warning mt-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <FiStar key={n} size={14} fill={n <= selected.rating ? "currentColor" : "none"} />
                    ))}
                  </div>
                  {selected.verifiedPurchase && (
                    <p className="text-[10px] font-bold text-crm-success mt-1">Verified purchase</p>
                  )}
                </div>
              </div>

              {selected.title && <p className="font-semibold text-crm-text-bright mb-1">{selected.title}</p>}
              <p className="text-sm text-crm-text leading-relaxed bg-crm-bg rounded-lg border border-crm-border p-3 mb-3">
                {selected.comment || "—"}
              </p>

              {selected.imageUrls.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {selected.imageUrls.map((url) => (
                    <a key={url} href={mediaUrl(url)} target="_blank" rel="noreferrer" className="h-16 w-16 rounded-lg overflow-hidden border border-crm-border">
                      <img src={mediaUrl(url)} alt="" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}

              <p className="text-xs text-crm-text-muted mb-4">
                Submitted {selected.date ? format(new Date(selected.date), "PPpp") : "—"}
              </p>

              {selected.status === "pending" && (
                <div className="mt-auto flex gap-2">
                  <button type="button" className="crm-btn crm-btn-primary flex-1" onClick={() => handleStatusUpdate(selected.id, "approved")}>
                    <FiCheck /> Approve & publish
                  </button>
                  <button type="button" className="crm-btn flex-1 text-crm-danger" onClick={() => handleStatusUpdate(selected.id, "rejected")}>
                    <FiX /> Reject
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
