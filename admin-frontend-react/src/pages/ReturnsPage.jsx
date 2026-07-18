import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  FiSearch, FiFilter, FiCornerUpLeft, FiTruck, FiCheckCircle,
  FiDownload, FiClock, FiArrowRight, FiInfo, FiImage, FiEdit3
} from "react-icons/fi";
import { hasPermission } from "../auth/permissionMatrix";
import { getAdminUser } from "../lib/auth";
import { returnService } from "../services/returnService";
import { useToast } from "../components/ToastProvider";
import OrderSnapshot from "../components/OrderSnapshot";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import useStepUpReauth from "../hooks/useStepUpReauth";

const STATUS_MAP = {
  pending: { label: "Pending Review", class: "crm-badge-warning" },
  approved: { label: "Approved", class: "bg-crm-primary-dim text-crm-primary border-crm-primary/30" },
  rejected: { label: "Rejected", class: "crm-badge-danger" },
  courier_booked: { label: "Courier Booked", class: "bg-crm-purple-dim text-crm-purple border-crm-purple/30" },
  received: { label: "Received at Warehouse", class: "bg-crm-cyan-dim text-crm-cyan border-crm-cyan/30" },
  under_review: { label: "Under Review", class: "bg-crm-warning-dim text-crm-warning border-crm-warning/30" },
  refund_eligible: { label: "Refund Eligible", class: "bg-crm-primary-dim text-crm-primary border-crm-primary/30" },
  refunded: { label: "Refunded", class: "crm-badge-success" },
  closed: { label: "Closed", class: "text-crm-text-dim border-crm-border" },
};

const CARRIERS = ["steadfast", "pathao", "paperfly", "redx"];

export default function ReturnsPage({
  returnsInboundRef,
  returnLiveTick = 0,
  wsConnected,
  initialReturnId = null,
  onOpenOrder,
  onOpenCustomer,
  onOpenProduct,
}) {
  const { requestToken, modal: reauthModal } = useStepUpReauth();
  const toast = useToast();
  const adminRole = useMemo(() => String(getAdminUser()?.role || "STAFF").toUpperCase(), []);
  const canRefund = hasPermission(adminRole, "returns", "refund");

  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detailId, setDetailId] = useState(initialReturnId);
  const [detail, setDetail] = useState(null);
  const [actionNote, setActionNote] = useState("");
  const [acting, setActing] = useState(false);

  const [courierMode, setCourierMode] = useState(null); // null | 'assign' | 'manual'
  const [courierForm, setCourierForm] = useState({ courier: "steadfast", trackingNumber: "", carrier: "", note: "" });
  const [refundEligibleAmount, setRefundEligibleAmount] = useState("");
  const [showRefundConfirm, setShowRefundConfirm] = useState(false);
  const [refundConfirmForm, setRefundConfirmForm] = useState({ amount: "", method: "bank_transfer", reference: "", notes: "" });

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const data = await returnService.list(statusFilter || undefined);
      setReturns(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error("Failed to fetch returns");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns, returnLiveTick]);

  useEffect(() => {
    if (!returnsInboundRef) return undefined;
    returnsInboundRef.current = () => { fetchReturns(); };
    return () => { returnsInboundRef.current = null; };
  }, [returnsInboundRef, fetchReturns]);

  const openDetail = useCallback(async (id) => {
    setDetailId(id);
    setActionNote("");
    setCourierMode(null);
    setShowRefundConfirm(false);
    try {
      const full = await returnService.getById(id);
      setDetail(full);
      setRefundEligibleAmount(String(full?.refundAmount || ""));
    } catch {
      toast.error("Failed to load return detail");
    }
  }, [toast]);

  useEffect(() => {
    if (initialReturnId) openDetail(initialReturnId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredReturns = useMemo(() => {
    if (!search) return returns;
    const q = search.toLowerCase();
    return returns.filter(r =>
      r.id?.toLowerCase().includes(q) ||
      r.orderId?.toLowerCase().includes(q) ||
      r.order?.orderNumber?.toLowerCase().includes(q) ||
      r.reason?.toLowerCase().includes(q)
    );
  }, [returns, search]);

  const downloadCSV = (filename, headers, rows) => {
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const exportLogs = () => {
    downloadCSV('returns-log',
      ['Return ID', 'Order ID', 'Status', 'Reason', 'Refund Amount (BDT)', 'Created'],
      filteredReturns.map(r => [
        r.id,
        r.order?.orderNumber || r.orderId || 'N/A',
        r.status,
        r.reasonCategory || r.reason || '',
        Number(r.refundAmount || 0).toFixed(2),
        r.createdAt ? format(new Date(r.createdAt), 'yyyy-MM-dd') : '',
      ])
    );
    toast.success(`Exported ${filteredReturns.length} return logs`);
  };

  const runAction = async (fn, successMsg) => {
    setActing(true);
    try {
      const updated = await fn();
      toast.success(successMsg);
      setDetail(updated);
      fetchReturns();
      return updated;
    } catch (err) {
      toast.error(err?.response?.data?.error || "Action failed");
      return null;
    } finally {
      setActing(false);
    }
  };

  const handleApprove = () => runAction(() => returnService.approve(detail.id, actionNote.trim() || undefined), "Return approved");
  const handleReject = () => runAction(() => returnService.reject(detail.id, actionNote.trim() || undefined), "Return rejected");
  const handleMarkReceived = () => runAction(() => returnService.markReceived(detail.id, actionNote.trim() || undefined), "Marked received at warehouse");
  const handleUnderReview = () => runAction(() => returnService.markUnderReview(detail.id, actionNote.trim() || undefined), "Marked under review");
  const handleClose = () => runAction(() => returnService.close(detail.id, actionNote.trim() || undefined), "Return closed");

  const handleRefundEligible = () => runAction(
    () => returnService.markRefundEligible(detail.id, Number(refundEligibleAmount) || 0, actionNote.trim() || undefined),
    "Marked refund-eligible — customer notified to submit payment details"
  );

  const submitCourier = async () => {
    setActing(true);
    try {
      const updated = courierMode === "assign"
        ? await returnService.bookCourierAssign(detail.id, { courier: courierForm.courier, note: courierForm.note || undefined })
        : await returnService.bookCourierManual(detail.id, { trackingNumber: courierForm.trackingNumber, carrier: courierForm.carrier || "manual", note: courierForm.note || undefined });
      toast.success("Return courier booked");
      setDetail(updated);
      setCourierMode(null);
      fetchReturns();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Booking failed");
    } finally {
      setActing(false);
    }
  };

  const submitRefundConfirm = async () => {
    setActing(true);
    try {
      const reauthToken = await requestToken();
      const updated = await returnService.confirmRefund(detail.id, {
        amount: Number(refundConfirmForm.amount) || Number(detail.refundAmount) || 0,
        method: refundConfirmForm.method,
        reference: refundConfirmForm.reference || undefined,
        notes: refundConfirmForm.notes || undefined,
      }, reauthToken);
      toast.success("Refund confirmed and recorded");
      setDetail(updated);
      setShowRefundConfirm(false);
      fetchReturns();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Refund confirmation failed");
    } finally {
      setActing(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || "pending").toLowerCase();
    const config = STATUS_MAP[s] || STATUS_MAP.closed;
    return <span className={`crm-badge border ${config.class}`}>{config.label}</span>;
  };

  const latestRefundRecord = detail?.refundRecords?.[0] || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Returns & RMA</h2>
          <p className="text-crm-text-dim text-sm">Manage product returns and refund processing</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="crm-btn" onClick={exportLogs}>
            <FiDownload /> Export Logs
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="crm-card flex items-center gap-4">
          <div className="p-3 rounded-xl bg-crm-bg-hover text-crm-text-dim">
            <FiCornerUpLeft size={24} />
          </div>
          <div>
            <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider">Total Requests</p>
            <p className="text-2xl font-bold text-crm-text-bright">{returns.length}</p>
          </div>
        </div>
        <div className="crm-card flex items-center gap-4 border-l-4 border-l-crm-warning">
          <div className="p-3 rounded-xl bg-crm-warning-dim text-crm-warning">
            <FiClock size={24} />
          </div>
          <div>
            <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider">Pending Review</p>
            <p className="text-2xl font-bold text-crm-text-bright">{returns.filter(r => r.status === "pending").length}</p>
          </div>
        </div>
        <div className="crm-card flex items-center gap-4 border-l-4 border-l-crm-success">
          <div className="p-3 rounded-xl bg-crm-success-dim text-crm-success">
            <FiCheckCircle size={24} />
          </div>
          <div>
            <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider">Refunded</p>
            <p className="text-2xl font-bold text-crm-text-bright">{returns.filter(r => r.status === "refunded").length}</p>
          </div>
        </div>
      </div>

      <div className="crm-card flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
          <input
            type="text"
            placeholder="Search by Return ID, Order ID, Reason..."
            className="crm-input pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            className="crm-input min-w-[160px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_MAP).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          <button className="crm-btn" onClick={fetchReturns}>
            <FiFilter /> Refresh
          </button>
        </div>
      </div>

      <div className="crm-table-container">
        {loading ? (
          <div className="p-20 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary"></div>
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Return ID</th>
                <th>Order</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Amount</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-crm-text-dim">No return requests found</td>
                </tr>
              ) : (
                filteredReturns.map((ret) => (
                  <tr key={ret.id} className="group cursor-pointer" onClick={() => openDetail(ret.id)}>
                    <td>
                      <span className="font-mono text-xs font-bold text-crm-text-dim bg-crm-bg-hover px-2 py-1 rounded">
                        #{ret.id?.slice(-8).toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <p className="font-medium text-crm-primary text-sm">#{ret.order?.orderNumber || ret.orderId?.slice(-8).toUpperCase() || "N/A"}</p>
                      {ret.order?.user?.name && <p className="text-[10px] text-crm-text-dim">{ret.order.user.name}</p>}
                    </td>
                    <td>{getStatusBadge(ret.status)}</td>
                    <td className="max-w-[200px]">
                      <p className="text-sm text-crm-text-bright truncate">{ret.reasonCategory || ret.reason}</p>
                    </td>
                    <td>
                      <span className="font-bold tabular-nums text-crm-text-bright">
                        ৳{Number(ret.refundAmount || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="text-xs text-crm-text-dim">
                      {ret.createdAt ? format(new Date(ret.createdAt), "MMM dd, yyyy") : "—"}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openDetail(ret.id)}
                        className="p-1.5 rounded hover:bg-crm-bg-hover text-crm-text-dim hover:text-crm-primary transition-colors"
                      >
                        <FiArrowRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Side Panel */}
      <AnimatePresence>
        {detailId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
              onClick={() => setDetailId(null)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 h-full w-full max-w-xl bg-crm-bg-alt border-l border-crm-border z-50 overflow-y-auto custom-scrollbar"
            >
              {detail ? (
                <div className="p-8 space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-crm-bg-hover text-crm-primary">
                        <FiCornerUpLeft size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-crm-text-bright">Return Details</h3>
                        <p className="text-[10px] text-crm-text-dim font-mono uppercase tracking-wider">{detail.id}</p>
                      </div>
                    </div>
                    <button onClick={() => setDetailId(null)} className="p-2 hover:bg-crm-bg-hover rounded-full text-crm-text-dim">
                      <FiArrowRight className="rotate-180" size={24} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="crm-card bg-crm-bg border-none">
                      <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider mb-2">Current Status</p>
                      {getStatusBadge(detail.status)}
                    </div>
                    <div className="crm-card bg-crm-bg border-none">
                      <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider mb-2">Refund Total</p>
                      <span className="text-xl font-bold text-crm-text-bright">৳{Number(detail.refundAmount || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-crm-text-bright uppercase tracking-widest border-b border-crm-border pb-2">Information</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-crm-text-dim">Reason Category</span>
                        <span className="text-crm-text-bright font-medium">{detail.reasonCategory || "N/A"}</span>
                      </div>
                      {detail.trackingNumber && (
                        <div className="flex justify-between text-sm">
                          <span className="text-crm-text-dim">Return Tracking</span>
                          <span className="text-crm-text-bright font-mono text-xs">{detail.trackingNumber} {detail.shippingCarrier ? `(${detail.shippingCarrier})` : ""}</span>
                        </div>
                      )}
                      <div className="space-y-1">
                        <span className="text-xs text-crm-text-dim uppercase font-bold tracking-wider">Description</span>
                        <div className="p-3 rounded-lg bg-crm-bg border border-crm-border text-sm text-crm-text-bright italic">
                          "{detail.description || "No description provided"}"
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Items being returned */}
                  {detail.items?.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-crm-text-bright uppercase tracking-widest border-b border-crm-border pb-2">Items Returned</h4>
                      {detail.items.map((it, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-crm-bg border border-crm-border">
                          <div className="flex-1 min-w-0">
                            <button
                              type="button"
                              className="text-sm font-medium text-crm-primary hover:underline truncate block text-left"
                              onClick={() => it.productId && onOpenProduct?.(it.productId)}
                            >
                              {it.title || it.productId}
                            </button>
                            <p className="text-[10px] text-crm-text-dim">Qty: {it.quantity} × ৳{Number(it.unitPrice || 0).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Customer photos */}
                  {detail.images?.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-crm-text-bright uppercase tracking-widest border-b border-crm-border pb-2 flex items-center gap-1.5">
                        <FiImage size={12} /> Customer Photos
                      </h4>
                      <div className="grid grid-cols-3 gap-2">
                        {detail.images.map((img, i) => (
                          <a key={i} href={img} target="_blank" rel="noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-crm-border">
                            <img src={img} alt={`Return evidence ${i + 1}`} className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Order snapshot */}
                  {detail.order && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-crm-text-bright uppercase tracking-widest border-b border-crm-border pb-2">Order Snapshot</h4>
                      <OrderSnapshot
                        order={detail.order}
                        onOpenCustomer={onOpenCustomer}
                        onOpenProduct={onOpenProduct}
                        onOpenOrder={onOpenOrder}
                        compact
                      />
                    </div>
                  )}

                  {/* Customer refund payment info (submitted via storefront) */}
                  {latestRefundRecord?.customerAccount && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-crm-text-bright uppercase tracking-widest border-b border-crm-border pb-2">Customer Refund Account</h4>
                      <div className="crm-card bg-crm-bg space-y-1 text-sm">
                        <div className="flex justify-between"><span className="text-crm-text-dim">Method</span><span className="text-crm-text-bright font-medium">{latestRefundRecord.customerAccount.method}</span></div>
                        <div className="flex justify-between"><span className="text-crm-text-dim">Account #</span><span className="text-crm-text-bright font-mono">{latestRefundRecord.customerAccount.accountNumber}</span></div>
                        {latestRefundRecord.customerAccount.accountName && <div className="flex justify-between"><span className="text-crm-text-dim">Account Name</span><span className="text-crm-text-bright">{latestRefundRecord.customerAccount.accountName}</span></div>}
                        {latestRefundRecord.customerAccount.bankName && <div className="flex justify-between"><span className="text-crm-text-dim">Bank</span><span className="text-crm-text-bright">{latestRefundRecord.customerAccount.bankName}</span></div>}
                      </div>
                    </div>
                  )}

                  {detail.timeline && detail.timeline.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-crm-text-bright uppercase tracking-widest border-b border-crm-border pb-2">Activity Timeline</h4>
                      <div className="relative pl-6 space-y-6 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[2px] before:bg-crm-border">
                        {detail.timeline.map((h, i) => (
                          <div key={i} className="relative">
                            <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-crm-primary border-4 border-crm-bg-alt" />
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-bold text-crm-text-bright">{(h.status || "").toUpperCase()}</p>
                                <p className="text-xs text-crm-text-dim">{h.note || "No note added"}</p>
                              </div>
                              <p className="text-[10px] text-crm-text-muted">{h.at ? format(new Date(h.at), "MMM dd, HH:mm") : ""}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Administrative actions — status machine */}
                  <div className="pt-8 border-t border-crm-border space-y-4">
                    <h4 className="text-xs font-black text-crm-text-bright uppercase tracking-widest">Administrative Actions</h4>

                    {detail.status === "pending" && (
                      <>
                        <textarea
                          className="crm-input min-h-[70px] bg-crm-bg"
                          placeholder="Optional note for this decision…"
                          value={actionNote}
                          onChange={(e) => setActionNote(e.target.value)}
                        />
                        <div className="flex flex-wrap gap-2">
                          <button type="button" disabled={acting} onClick={handleApprove} className="crm-btn crm-btn-primary flex-1 py-2">Approve Return</button>
                          <button type="button" disabled={acting} onClick={handleReject} className="crm-btn border-crm-danger/30 text-crm-danger hover:bg-crm-danger-dim flex-1 py-2">Reject Request</button>
                        </div>
                      </>
                    )}

                    {detail.status === "approved" && (
                      courierMode ? (
                        <div className="crm-card bg-crm-bg space-y-3">
                          {courierMode === "assign" ? (
                            <div className="field">
                              <label className="field-label">Courier</label>
                              <select className="crm-input" value={courierForm.courier} onChange={(e) => setCourierForm(f => ({ ...f, courier: e.target.value }))}>
                                {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                          ) : (
                            <>
                              <div className="field">
                                <label className="field-label">Tracking Number</label>
                                <input className="crm-input" value={courierForm.trackingNumber} onChange={(e) => setCourierForm(f => ({ ...f, trackingNumber: e.target.value }))} />
                              </div>
                              <div className="field">
                                <label className="field-label">Carrier name</label>
                                <input className="crm-input" value={courierForm.carrier} onChange={(e) => setCourierForm(f => ({ ...f, carrier: e.target.value }))} placeholder="e.g. Sundarban Courier" />
                              </div>
                            </>
                          )}
                          <div className="field">
                            <label className="field-label">Note</label>
                            <input className="crm-input" value={courierForm.note} onChange={(e) => setCourierForm(f => ({ ...f, note: e.target.value }))} />
                          </div>
                          <div className="flex gap-2">
                            <button className="crm-btn flex-1" onClick={() => setCourierMode(null)}>Cancel</button>
                            <button className="crm-btn crm-btn-primary flex-1" disabled={acting} onClick={submitCourier}>Confirm Booking</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="crm-btn crm-btn-primary flex-1 py-2" onClick={() => setCourierMode("assign")}><FiTruck /> Book Live Courier</button>
                          <button type="button" className="crm-btn flex-1 py-2" onClick={() => setCourierMode("manual")}><FiEdit3 /> Manual Tracking</button>
                        </div>
                      )
                    )}

                    {detail.status === "courier_booked" && (
                      <button type="button" disabled={acting} onClick={handleMarkReceived} className="crm-btn crm-btn-primary w-full py-2">
                        <FiCheckCircle /> Mark Received at Warehouse
                      </button>
                    )}

                    {detail.status === "received" && (
                      <button type="button" disabled={acting} onClick={handleUnderReview} className="crm-btn crm-btn-primary w-full py-2">
                        Start Inspection (Under Review)
                      </button>
                    )}

                    {detail.status === "under_review" && (
                      <div className="crm-card bg-crm-bg space-y-3">
                        <div className="field">
                          <label className="field-label">Refund Amount (৳)</label>
                          <input className="crm-input" type="number" value={refundEligibleAmount} onChange={(e) => setRefundEligibleAmount(e.target.value)} />
                        </div>
                        <button type="button" disabled={acting} onClick={handleRefundEligible} className="crm-btn crm-btn-primary w-full py-2">
                          Mark Refund Eligible
                        </button>
                      </div>
                    )}

                    {detail.status === "refund_eligible" && canRefund && (
                      showRefundConfirm ? (
                        <div className="crm-card bg-crm-bg space-y-3">
                          <div className="field">
                            <label className="field-label">Amount Paid Out (৳)</label>
                            <input className="crm-input" type="number" value={refundConfirmForm.amount || detail.refundAmount} onChange={(e) => setRefundConfirmForm(f => ({ ...f, amount: e.target.value }))} />
                          </div>
                          <div className="field">
                            <label className="field-label">Method</label>
                            <select className="crm-input" value={refundConfirmForm.method} onChange={(e) => setRefundConfirmForm(f => ({ ...f, method: e.target.value }))}>
                              <option value="bank_transfer">Bank transfer</option>
                              <option value="mobile_wallet">Mobile wallet</option>
                              <option value="original_payment">Original payment method</option>
                              <option value="store_credit">Store credit</option>
                            </select>
                          </div>
                          <div className="field">
                            <label className="field-label">Reference (Tx ID / slip #)</label>
                            <input className="crm-input" value={refundConfirmForm.reference} onChange={(e) => setRefundConfirmForm(f => ({ ...f, reference: e.target.value }))} />
                          </div>
                          <div className="field">
                            <label className="field-label">Notes</label>
                            <textarea className="crm-input min-h-[60px]" value={refundConfirmForm.notes} onChange={(e) => setRefundConfirmForm(f => ({ ...f, notes: e.target.value }))} />
                          </div>
                          <div className="flex gap-2">
                            <button className="crm-btn flex-1" onClick={() => setShowRefundConfirm(false)}>Cancel</button>
                            <button className="crm-btn crm-btn-primary flex-1" disabled={acting} onClick={submitRefundConfirm}>Confirm Refund Sent</button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {!latestRefundRecord?.customerAccount && (
                            <div className="p-3 rounded-lg bg-crm-warning-dim text-crm-warning text-xs flex items-center gap-2">
                              <FiInfo /> Waiting on customer to submit refund payment details.
                            </div>
                          )}
                          <button type="button" className="crm-btn crm-btn-primary w-full py-2" onClick={() => setShowRefundConfirm(true)}>
                            <FiCheckCircle /> Confirm Refund Payout
                          </button>
                        </div>
                      )
                    )}

                    {(detail.status === "rejected" || detail.status === "refunded") && (
                      <button type="button" disabled={acting} onClick={handleClose} className="crm-btn w-full py-2">Close Ticket</button>
                    )}

                    {detail.status === "closed" && (
                      <div className="p-4 rounded-lg bg-crm-bg flex items-center gap-3 text-crm-text-dim border border-crm-border">
                        <FiInfo />
                        <span className="text-xs">This return request has been closed.</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {reauthModal}
    </div>
  );
}
