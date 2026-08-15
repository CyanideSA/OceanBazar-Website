import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  FiMessageCircle,
  FiCheck,
  FiX,
  FiSearch,
  FiBox,
  FiRefreshCw,
  FiImage,
  FiUser,
  FiUpload,
} from "react-icons/fi";
import { adminApi } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import { format } from "date-fns";

function mediaUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return url;
}

function extractUploadUrl(res) {
  return res?.secureUrl || res?.url || res?.secure_url || res?.data?.url || res?.path || null;
}

export default function QaPage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [answerDraft, setAnswerDraft] = useState("");
  const [answerImageUrls, setAnswerImageUrls] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [moderating, setModerating] = useState(false);
  const fileInputRef = useRef(null);

  const fetchQa = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.qaList(filter);
      const list = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
      setPendingCount(Number(res?.pendingCount ?? list.filter((q) => q.status === "pending").length));
      setItems(
        list.map((q) => ({
          id: q.id,
          productId: q.productId,
          userId: q.userId,
          question: q.question || "",
          answer: q.answer || "",
          askedAt: q.askedAt,
          answeredAt: q.answeredAt,
          askerName: q.askerName || q.customer?.name || "Anonymous",
          askerEmail: q.askerEmail || q.customer?.email || null,
          imageUrls: Array.isArray(q.imageUrls) ? q.imageUrls : [],
          answerImageUrls: Array.isArray(q.answerImageUrls) ? q.answerImageUrls : [],
          answeredByName: q.answeredByName || null,
          status: q.status || "pending",
          productTitle: q.productTitle || q.productTitleBn || "Unknown product",
          productSku: q.productSku || null,
          productImage: q.productImage || null,
          customer: {
            id: q.customer?.id || q.userId || null,
            name: q.customer?.name || q.askerName || "Anonymous",
            email: q.customer?.email || q.askerEmail || null,
            phone: q.customer?.phone || null,
            avatar: q.customer?.avatar || null,
          },
        }))
      );
    } catch {
      toast.error("Failed to fetch Q&A");
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    fetchQa();
  }, [fetchQa]);

  useEffect(() => {
    const t = window.setInterval(() => {
      fetchQa();
    }, 30_000);
    const onFocus = () => fetchQa();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchQa]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return items.filter((item) => {
      if (filter !== "all" && item.status !== filter) return false;
      if (!q) return true;
      return (
        item.productTitle.toLowerCase().includes(q) ||
        (item.productSku || "").toLowerCase().includes(q) ||
        item.customer.name.toLowerCase().includes(q) ||
        (item.customer.email || "").toLowerCase().includes(q) ||
        (item.question || "").toLowerCase().includes(q)
      );
    });
  }, [items, filter, searchTerm]);

  const selected = filteredItems.find((r) => r.id === selectedId) || filteredItems[0] || null;

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  useEffect(() => {
    if (!selected) {
      setAnswerDraft("");
      setAnswerImageUrls([]);
      return;
    }
    setAnswerDraft(selected.answer || "");
    setAnswerImageUrls(Array.isArray(selected.answerImageUrls) ? [...selected.answerImageUrls] : []);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusBadge = (status) => {
    if (status === "pending") return "bg-crm-warning-dim text-crm-warning";
    if (status === "approved") return "bg-crm-success-dim text-crm-success";
    return "bg-crm-danger-dim text-crm-danger";
  };

  async function handleUploadAnswerImages(files) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const res = await adminApi.uploadMedia(file, "qa/answers");
        const url = extractUploadUrl(res);
        if (url) uploaded.push(url);
      }
      if (uploaded.length) {
        setAnswerImageUrls((prev) => [...prev, ...uploaded]);
        toast.success(`${uploaded.length} image${uploaded.length > 1 ? "s" : ""} uploaded`);
      } else {
        toast.error("Upload succeeded but no URL returned");
      }
    } catch {
      toast.error("Failed to upload answer image");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeAnswerImage(url) {
    setAnswerImageUrls((prev) => prev.filter((u) => u !== url));
  }

  async function handleModerate(approved) {
    if (!selected) return;
    setModerating(true);
    try {
      const payload = { approved };
      if (approved) {
        payload.answer = answerDraft.trim() || null;
        payload.answerImageUrls = answerImageUrls;
      }
      await adminApi.moderateQa(selected.id, payload);
      const newStatus = approved ? "approved" : "rejected";
      setItems((prev) => prev.map((q) => (q.id === selected.id ? { ...q, status: newStatus, answer: payload.answer || q.answer, answerImageUrls } : q)));
      if (filter === "pending") {
        setItems((prev) => prev.filter((q) => q.id !== selected.id));
      }
      setPendingCount((c) => Math.max(0, c - (selected.status === "pending" ? 1 : 0)));
      toast.success(approved ? "Question approved" : "Question rejected");
    } catch {
      toast.error("Failed to update Q&A item");
    } finally {
      setModerating(false);
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-primary-dim text-crm-primary">
            <FiMessageCircle size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Product Q&A</h2>
            <p className="text-crm-text-dim text-sm">
              Moderate customer questions · {pendingCount} awaiting approval
            </p>
          </div>
        </div>
        <button type="button" className="crm-btn" onClick={() => fetchQa()}>
          <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="crm-card flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
          <input
            type="text"
            placeholder="Search product, SKU, customer, or question…"
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
            Questions ({filteredItems.length})
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[70vh]">
            {loading ? (
              <div className="p-16 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-12 text-center text-crm-text-dim text-sm">No questions in this view</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-crm-bg-alt border-b border-crm-border text-[11px] uppercase tracking-wider text-crm-text-dim">
                  <tr>
                    <th className="text-left px-3 py-2 font-bold">Product / Customer</th>
                    <th className="text-left px-3 py-2 font-bold">Question</th>
                    <th className="text-left px-3 py-2 font-bold">Status</th>
                    <th className="text-left px-3 py-2 font-bold">Asked</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((q) => (
                    <tr
                      key={q.id}
                      onClick={() => setSelectedId(q.id)}
                      className={`border-b border-crm-border/60 cursor-pointer transition-colors ${
                        selected?.id === q.id ? "bg-crm-primary-dim/40" : "hover:bg-crm-bg-hover"
                      }`}
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-10 w-10 rounded-lg bg-crm-bg-hover overflow-hidden shrink-0 flex items-center justify-center">
                            {q.productImage ? (
                              <img src={mediaUrl(q.productImage)} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <FiBox className="text-crm-text-muted" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-crm-text-bright truncate">{q.productTitle}</p>
                            <p className="text-xs text-crm-text-dim truncate flex items-center gap-1">
                              <FiUser size={11} /> {q.customer.name}
                              {q.imageUrls.length > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-crm-primary ml-1">
                                  <FiImage size={11} />
                                  {q.imageUrls.length}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 max-w-[220px]">
                        <p className="text-crm-text truncate">{q.question}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`crm-badge text-[10px] capitalize ${statusBadge(q.status)}`}>{q.status}</span>
                      </td>
                      <td className="px-3 py-3 text-xs text-crm-text-dim whitespace-nowrap">
                        {q.askedAt ? format(new Date(q.askedAt), "MMM dd, HH:mm") : "—"}
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
            <div className="flex-1 flex items-center justify-center text-crm-text-dim text-sm">Select a question</div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-crm-border pb-3 mb-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-crm-primary mb-1">Q&A snapshot</p>
                  <h3 className="text-lg font-bold text-crm-text-bright truncate">{selected.productTitle}</h3>
                  {selected.productSku && (
                    <p className="text-xs text-crm-text-dim mt-0.5">SKU: {selected.productSku}</p>
                  )}
                </div>
                <span className={`crm-badge capitalize shrink-0 ${statusBadge(selected.status)}`}>{selected.status}</span>
              </div>

              <div className="flex items-center gap-3 mb-4">
                {selected.productImage && (
                  <img
                    src={mediaUrl(selected.productImage)}
                    alt=""
                    className="h-16 w-16 rounded-xl object-cover border border-crm-border"
                  />
                )}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-11 w-11 rounded-full bg-crm-bg-hover overflow-hidden shrink-0 flex items-center justify-center border border-crm-border">
                    {selected.customer.avatar ? (
                      <img src={mediaUrl(selected.customer.avatar)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <FiUser className="text-crm-text-muted" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-crm-text-bright truncate">{selected.customer.name}</p>
                    {selected.customer.email && (
                      <p className="text-xs text-crm-text-dim truncate">{selected.customer.email}</p>
                    )}
                    {selected.customer.phone && (
                      <p className="text-xs text-crm-text-dim">{selected.customer.phone}</p>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-xs font-bold uppercase tracking-wider text-crm-text-dim mb-1">Question</p>
              <p className="text-sm text-crm-text leading-relaxed bg-crm-bg rounded-lg border border-crm-border p-3 mb-3">
                {selected.question || "—"}
              </p>

              {selected.imageUrls.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {selected.imageUrls.map((url) => (
                    <a
                      key={url}
                      href={mediaUrl(url)}
                      target="_blank"
                      rel="noreferrer"
                      className="h-16 w-16 rounded-lg overflow-hidden border border-crm-border"
                    >
                      <img src={mediaUrl(url)} alt="" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}

              <p className="text-xs text-crm-text-muted mb-3">
                Asked {selected.askedAt ? format(new Date(selected.askedAt), "PPpp") : "—"}
                {selected.answeredByName ? ` · Answered by ${selected.answeredByName}` : ""}
              </p>

              {(selected.status === "pending" || selected.answer) && (
                <>
                  <p className="text-xs font-bold uppercase tracking-wider text-crm-text-dim mb-1">Answer</p>
                  <textarea
                    className="crm-input min-h-[90px] w-full mb-3"
                    value={answerDraft}
                    onChange={(e) => setAnswerDraft(e.target.value)}
                    placeholder="Write the answer shown on the product page…"
                    disabled={selected.status !== "pending"}
                  />

                  <div className="mb-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-crm-text-dim">Answer images</p>
                      {selected.status === "pending" && (
                        <>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => handleUploadAnswerImages(Array.from(e.target.files || []))}
                          />
                          <button
                            type="button"
                            className="crm-btn text-xs"
                            disabled={uploading}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <FiUpload className={uploading ? "animate-pulse" : ""} />
                            {uploading ? "Uploading…" : "Upload"}
                          </button>
                        </>
                      )}
                    </div>
                    {answerImageUrls.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {answerImageUrls.map((url) => (
                          <div key={url} className="relative h-16 w-16 rounded-lg overflow-hidden border border-crm-border">
                            <a href={mediaUrl(url)} target="_blank" rel="noreferrer">
                              <img src={mediaUrl(url)} alt="" className="h-full w-full object-cover" />
                            </a>
                            {selected.status === "pending" && (
                              <button
                                type="button"
                                className="absolute top-0.5 right-0.5 h-5 w-5 rounded bg-black/60 text-white flex items-center justify-center"
                                onClick={() => removeAnswerImage(url)}
                                aria-label="Remove image"
                              >
                                <FiX size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-crm-text-muted">No answer images</p>
                    )}
                  </div>
                </>
              )}

              {selected.status === "pending" && (
                <div className="mt-auto flex gap-2">
                  <button
                    type="button"
                    className="crm-btn crm-btn-primary flex-1"
                    disabled={moderating || uploading}
                    onClick={() => handleModerate(true)}
                  >
                    <FiCheck /> Approve with answer
                  </button>
                  <button
                    type="button"
                    className="crm-btn flex-1 text-crm-danger"
                    disabled={moderating || uploading}
                    onClick={() => handleModerate(false)}
                  >
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
