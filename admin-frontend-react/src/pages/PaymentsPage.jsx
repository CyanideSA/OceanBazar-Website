import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiSearch, FiFilter, FiDollarSign, FiCreditCard,
  FiDownload, FiArrowRight, FiCheckCircle
} from "react-icons/fi";
import { adminApi } from "../lib/api";
import { getAdminUser } from "../lib/auth";
import { hasPermission } from "../auth/permissionMatrix";
import { useToast } from "../components/ToastProvider";
import OrderSnapshot from "../components/OrderSnapshot";
import useStepUpReauth from "../hooks/useStepUpReauth";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "under_verification", label: "Under verification" },
  { key: "success", label: "Paid" },
  { key: "failed", label: "Failed" },
  { key: "refunded", label: "Refunded" },
  { key: "mismatch", label: "State mismatch" },
];

function statusLabel(raw) {
  const s = String(raw || "pending").toLowerCase();
  const labels = { success: "Paid", pending: "Pending", failed: "Failed", refunded: "Refunded" };
  return labels[s] || s;
}

export default function PaymentsPage({ liveTick = 0, initialPaymentId = null, onOpenOrder, onOpenCustomer, onOpenProduct }) {
  const toast = useToast();
  const { requestToken, modal: reauthModal } = useStepUpReauth();
  const role = String(getAdminUser()?.role || "STAFF").toUpperCase();
  const canEditPayments = hasPermission(role, "payments", "edit");

  const [statusFilter, setStatusFilter] = useState("all");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState(initialPaymentId);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundForm, setRefundForm] = useState({ amount: "", method: "original_payment", note: "" });

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res =
        statusFilter === "mismatch"
          ? await adminApi.paymentReconciliationMismatches()
          : await adminApi.payments({
              status: statusFilter === "all" ? undefined : statusFilter,
            });
      setItems(Array.isArray(res) ? res : res?.transactions || res?.payments || res?.items || []);
    } catch (err) {
      toast.error("Failed to fetch payments");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments, liveTick]);

  const openDetail = async (id) => {
    setDetailId(id);
    setDetailLoading(true);
    try {
      const res = await adminApi.paymentDetail(id);
      setDetail(res);
    } catch (err) {
      toast.error("Failed to load payment details");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (initialPaymentId) openDetail(initialPaymentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredPayments = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(p =>
      (p.id || p.transactionId)?.toLowerCase().includes(q) ||
      (p.order?.orderNumber || p.orderNumber)?.toLowerCase().includes(q) ||
      (p.method || p.paymentMethod)?.toLowerCase().includes(q)
    );
  }, [items, search]);

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

  const exportLedger = () => {
    downloadCSV('payments-ledger',
      ['Transaction ID', 'Status', 'Method', 'Amount (BDT)', 'Order #', 'Customer', 'Date'],
      filteredPayments.map(p => [
        p.id || p.transactionId || '',
        p.status || '',
        p.method || 'Manual',
        Number(p.amount || 0).toFixed(2),
        p.order?.orderNumber || p.orderNumber || 'N/A',
        p.user?.name || p.userName || '',
        p.createdAt ? format(new Date(p.createdAt), 'yyyy-MM-dd HH:mm') : '',
      ])
    );
    toast.success(`Exported ${filteredPayments.length} transactions`);
  };

  const getStatusBadge = (status, orderPaymentStatus) => {
    const s = (status || "pending").toLowerCase();
    if (s === "success" && String(orderPaymentStatus || "").toLowerCase() === "under_verification") {
      return <span className="crm-badge crm-badge-warning">Under verification</span>;
    }
    if (s === "success") return <span className="crm-badge crm-badge-success">Paid</span>;
    if (s === "failed") return <span className="crm-badge crm-badge-danger">Failed</span>;
    if (s === "refunded") return <span className="crm-badge bg-crm-purple-dim text-crm-purple border-crm-purple/30">Refunded</span>;
    return <span className="crm-badge crm-badge-warning">Pending</span>;
  };

  const tx = detail?.transaction || null;

  const handleMarkPaid = async () => {
    if (!tx?.id) return;
    setBusy(true);
    try {
      await adminApi.markPaymentPaid(tx.id);
      toast.success("Payment marked as received");
      openDetail(tx.id);
      fetchPayments();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to mark as paid");
    } finally {
      setBusy(false);
    }
  };

  const openRefundForm = () => {
    setRefundForm({ amount: String(Number(tx?.amount || 0)), method: "original_payment", note: "" });
    setShowRefundForm(true);
  };

  const submitRefund = async () => {
    if (!tx?.id) return;
    setBusy(true);
    try {
      const reauthToken = await requestToken();
      await adminApi.refundPayment(tx.id, {
        amount: Number(refundForm.amount) || Number(tx.amount),
        method: refundForm.method,
        note: refundForm.note || undefined,
      }, reauthToken);
      toast.success("Refund processed");
      setShowRefundForm(false);
      openDetail(tx.id);
      fetchPayments();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Refund failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Payment Transactions</h2>
          <p className="text-crm-text-dim text-sm">Monitor and reconcile all incoming payments</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="crm-btn" onClick={exportLedger}>
            <FiDownload /> Export Ledger
          </button>
        </div>
      </div>

      <div className="crm-card p-0 overflow-hidden border-b-0 rounded-b-none flex flex-wrap">
        {FILTERS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-6 py-3 border-b-2 transition-all font-medium text-sm ${
              statusFilter === tab.key 
                ? "border-crm-primary text-crm-primary bg-crm-primary-dim" 
                : "border-transparent text-crm-text-dim hover:text-crm-text-bright hover:bg-crm-bg-hover"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="crm-card flex flex-wrap items-center gap-4 rounded-t-none border-t-0">
        <div className="relative flex-1 min-w-[240px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
          <input 
            type="text" 
            placeholder="Search by ID, order #, method..." 
            className="crm-input pl-10" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="crm-btn" onClick={fetchPayments}>
          <FiFilter /> Refresh
        </button>
      </div>

      <div className="crm-table-container overflow-x-auto">
        {loading ? (
          <div className="p-20 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary"></div>
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Status</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Order</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-crm-text-dim">No transactions found</td>
                </tr>
              ) : (
                filteredPayments.map((p) => (
                  <tr key={p.id || p.transactionId} className="group cursor-pointer" onClick={() => openDetail(p.id || p.transactionId)}>
                    <td>
                      <span className="font-mono text-[11px] font-bold text-crm-text-dim bg-crm-bg-hover px-2 py-1 rounded">
                        {(p.id || p.transactionId || '').slice(0, 16)}...
                      </span>
                    </td>
                    <td>{getStatusBadge(p.status, p.order?.paymentStatus)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <FiCreditCard className="text-crm-text-muted" />
                        <span className="text-sm">{p.method || "Manual"}</span>
                      </div>
                    </td>
                    <td>
                      <span className="font-bold tabular-nums text-crm-text-bright">
                        ৳{Number(p.amount || 0).toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <p className="font-medium text-crm-primary">#{p.order?.orderNumber || p.orderNumber || "N/A"}</p>
                      {statusFilter === "mismatch" && p.order && (
                        <p className="text-[10px] text-crm-warning mt-1">
                          Tx: {(p.status || "").toString()} · Order pay: {(p.order.paymentStatus || "").toString()}
                        </p>
                      )}
                    </td>
                    <td className="text-xs text-crm-text-dim">
                      {p.createdAt ? format(new Date(p.createdAt), "MMM dd, HH:mm") : "—"}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openDetail(p.id || p.transactionId)}
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

      {/* Detail Drawer */}
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
              className="fixed top-0 right-0 h-full w-full max-w-lg bg-crm-bg-alt border-l border-crm-border z-50 overflow-y-auto custom-scrollbar"
            >
              {detailLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary"></div>
                </div>
              ) : tx ? (
                <div className="p-8 space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-crm-bg-hover text-crm-success">
                        <FiDollarSign size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-crm-text-bright">Payment Detail</h3>
                        <p className="text-[10px] text-crm-text-dim font-mono uppercase tracking-wider">{tx.id}</p>
                      </div>
                    </div>
                    <button onClick={() => setDetailId(null)} className="p-2 hover:bg-crm-bg-hover rounded-full text-crm-text-dim">
                      <FiArrowRight className="rotate-180" size={24} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="crm-card bg-crm-bg border-none">
                      <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider mb-2">Status</p>
                      {getStatusBadge(tx.status, tx.order?.paymentStatus)}
                    </div>
                    <div className="crm-card bg-crm-bg border-none">
                      <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider mb-2">Amount</p>
                      <span className="text-xl font-bold text-crm-text-bright">৳{Number(tx.amount).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-crm-text-bright uppercase tracking-widest border-b border-crm-border pb-2">Transaction Info</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-crm-text-dim">Method</span>
                        <span className="text-crm-text-bright font-medium">{tx.method || "Manual"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-crm-text-dim">Order #</span>
                        <button className="text-crm-primary font-bold hover:underline" onClick={() => onOpenOrder?.(tx.orderId)}>
                          {tx.order?.orderNumber || "N/A"}
                        </button>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-crm-text-dim">Customer</span>
                        <button className="text-crm-text-bright font-medium hover:underline" onClick={() => onOpenCustomer?.(tx.userId)}>
                          {tx.user?.name || tx.userId}
                        </button>
                      </div>
                      {tx.providerTxId && (
                        <div className="flex justify-between text-sm">
                          <span className="text-crm-text-dim">Provider Tx ID</span>
                          <span className="text-crm-text-bright font-mono text-xs">{tx.providerTxId}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-crm-text-dim">Timestamp</span>
                        <span className="text-crm-text-bright">{tx.createdAt ? format(new Date(tx.createdAt), "MMMM dd, yyyy HH:mm") : "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  {tx.order && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-crm-text-bright uppercase tracking-widest border-b border-crm-border pb-2">Order Snapshot</h4>
                      <OrderSnapshot
                        order={tx.order}
                        onOpenCustomer={onOpenCustomer}
                        onOpenProduct={onOpenProduct}
                        onOpenOrder={onOpenOrder}
                        showShipments={false}
                        showPayments={false}
                        compact
                      />
                    </div>
                  )}

                  {canEditPayments && (
                    <div className="pt-8 border-t border-crm-border space-y-4">
                      <h4 className="text-xs font-black text-crm-text-bright uppercase tracking-widest">Adjust Payment Status</h4>
                      {showRefundForm ? (
                        <div className="crm-card bg-crm-bg space-y-3">
                          <div className="field">
                            <label className="field-label">Refund Amount (৳)</label>
                            <input className="crm-input" type="number" value={refundForm.amount} onChange={(e) => setRefundForm(f => ({ ...f, amount: e.target.value }))} />
                          </div>
                          <div className="field">
                            <label className="field-label">Method</label>
                            <select className="crm-input" value={refundForm.method} onChange={(e) => setRefundForm(f => ({ ...f, method: e.target.value }))}>
                              <option value="original_payment">Original payment method</option>
                              <option value="bank_transfer">Bank transfer</option>
                              <option value="mobile_wallet">Mobile wallet</option>
                              <option value="store_credit">Store credit</option>
                            </select>
                          </div>
                          <div className="field">
                            <label className="field-label">Note</label>
                            <textarea className="crm-input min-h-[60px]" value={refundForm.note} onChange={(e) => setRefundForm(f => ({ ...f, note: e.target.value }))} />
                          </div>
                          <div className="flex gap-2">
                            <button className="crm-btn flex-1" onClick={() => setShowRefundForm(false)}>Cancel</button>
                            <button className="crm-btn border-crm-danger/30 text-crm-danger hover:bg-crm-danger-dim flex-1" disabled={busy} onClick={submitRefund}>
                              {busy ? "Processing…" : "Confirm Refund"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {tx.status === "success" && String(tx.order?.paymentStatus || "").toLowerCase() === "under_verification" && (
                            <button className="crm-btn crm-btn-primary flex-1 py-2" disabled={busy} onClick={handleMarkPaid}>
                              <FiCheckCircle /> Verify Payment
                            </button>
                          )}
                          {tx.status !== "success" && (
                            <button className="crm-btn crm-btn-primary flex-1 py-2" disabled={busy} onClick={handleMarkPaid}>
                              <FiCheckCircle /> Mark as Paid
                            </button>
                          )}
                          {tx.status !== "refunded" && (
                            <button className="crm-btn border-crm-danger/30 text-crm-danger hover:bg-crm-danger-dim flex-1 py-2" disabled={busy} onClick={openRefundForm}>
                              Refund
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
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
