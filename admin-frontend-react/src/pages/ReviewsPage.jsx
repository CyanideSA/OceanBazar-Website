import React, { useState, useEffect, useCallback } from "react";
import { FiStar, FiCheck, FiX, FiFlag, FiSearch, FiFilter, FiUser, FiBox, FiMessageSquare, FiRefreshCw } from "react-icons/fi";
import { reviewService } from "../services/reviewService";
import { useToast } from "../components/ToastProvider";
import { format } from "date-fns";

export default function ReviewsPage() {
  const toast = useToast();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = filter === "all" ? await reviewService.list() : await reviewService.list(filter);
      // The BFF returns { reviews } or an array
      const list = Array.isArray(res) ? res : res?.reviews || [];
      // Normalize field names from DB shape
      setReviews(list.map(r => ({
        id: r.id,
        productId: r.productId,
        productName: r.product?.titleEn || r.productName || "Unknown",
        customerName: r.user?.name || r.customerName || "Anonymous",
        rating: r.rating,
        comment: r.comment || r.review || "",
        status: r.status,
        date: r.createdAt || r.date,
      })));
    } catch (err) {
      toast.error("Failed to fetch reviews");
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await reviewService.moderate(id, newStatus);
      setReviews(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
      toast.success(`Review ${newStatus}`);
    } catch {
      toast.error("Failed to update review status");
    }
  };

  const renderStars = (rating) => (
    <div className="flex gap-0.5 text-crm-warning">
      {[...Array(5)].map((_, i) => (
        <FiStar key={i} size={14} fill={i < rating ? "currentColor" : "none"} />
      ))}
    </div>
  );

  const filteredReviews = reviews.filter(r => {
    const matchesFilter = filter === "all" || r.status === filter;
    const matchesSearch = r.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-warning-dim text-crm-warning">
            <FiStar size={24} className="fill-current" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Customer Reviews</h2>
            <p className="text-crm-text-dim text-sm">Moderate and respond to product feedback</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="crm-btn" onClick={() => fetchReviews()}>
            <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      <div className="crm-card flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
          <input 
            type="text" 
            placeholder="Search product or customer..." 
            className="crm-input pl-10" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <select 
            className="crm-input min-w-[140px]"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button className="crm-btn">
            <FiFilter /> Filters
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid grid-cols-1 gap-4">
          {loading ? (
            <div className="p-20 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary"></div>
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="crm-card p-12 text-center text-crm-text-dim">
              No reviews found matching your criteria
            </div>
          ) : (
            filteredReviews.map((review) => (
              <div key={review.id} className="crm-card flex flex-col md:flex-row gap-6 hover:border-crm-border-strong transition-all">
                <div className="flex-1 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-crm-bg-hover flex items-center justify-center text-crm-primary font-bold">
                        {review.customerName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-crm-text-bright flex items-center gap-2">
                          {review.customerName}
                          {review.status === "pending" && <span className="crm-badge bg-crm-warning-dim text-crm-warning text-[10px]">NEW</span>}
                        </p>
                        <p className="text-xs text-crm-text-dim">{format(new Date(review.date), "MMM dd, yyyy HH:mm")}</p>
                      </div>
                    </div>
                    {renderStars(review.rating)}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-crm-primary uppercase tracking-wider">
                      <FiBox size={12} /> {review.productName}
                    </div>
                    <p className="text-crm-text-bright italic bg-crm-bg p-3 rounded-lg border border-crm-border/50">
                      "{review.comment}"
                    </p>
                  </div>
                </div>

                <div className="flex md:flex-col justify-end gap-2 shrink-0 md:border-l md:border-crm-border md:pl-6">
                  {review.status === "pending" ? (
                    <div>
                      <button 
                        onClick={() => handleStatusUpdate(review.id, "approved")}
                        className="crm-btn crm-btn-primary flex-1 md:flex-none py-2"
                      >
                        <FiCheck /> Approve
                      </button>
                      <button 
                        onClick={() => handleStatusUpdate(review.id, "rejected")}
                        className="crm-btn border-crm-danger/30 text-crm-danger hover:bg-crm-danger-dim flex-1 md:flex-none py-2"
                      >
                        <FiX /> Reject
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full">
                      <span className={`crm-badge ${review.status === "approved" ? "crm-badge-success" : "crm-badge-danger"}`}>
                        {review.status.toUpperCase()}
                      </span>
                      <button 
                        onClick={() => handleStatusUpdate(review.id, "pending")}
                        className="text-[10px] text-crm-text-dim hover:text-crm-primary mt-2 uppercase font-bold tracking-widest"
                      >
                        Reset to Pending
                      </button>
                    </div>
                  )}
                  <button className="crm-btn p-2 md:mt-2 text-crm-text-dim hover:text-crm-text-bright">
                    <FiFlag />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
