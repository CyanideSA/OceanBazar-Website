import React, { useCallback, useEffect, useMemo, useState } from "react";
import { 
  FiSearch, FiFilter, FiDollarSign, FiCreditCard, FiClock, 
  FiDownload, FiArrowRight, FiCheckCircle, FiXCircle, FiAlertCircle 
} from "react-icons/fi";
import { adminApi } from "../lib/api";
import { getAdminUser } from "../lib/auth";
import { hasPermission } from "../auth/permissionMatrix";
import { useToast } from "../components/ToastProvider";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "processing", label: "Processing" },
  { key: "paid", label: "Paid" },
  { key: "failed", label: "Failed" },
  { key: "refunded", label: "Refunded" },
];

export default function PaymentsPage({ liveTick = 0 }) {
  const toast = useToast();
  const role = String(getAdminUser()?.role || "STAFF").toUpperCase();
  const canEditPayments = hasPermission(role, "payments", "edit");

  const [statusFilter, setStatusFilter] = useState("all");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.payments({ status: statusFilter === "all" ? undefined : statusFilter });
      setItems(Array.isArray(res) ? res : res?.payments || res?.items || []);
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

  const filteredPayments = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(p => 
      p.transactionId?.toLowerCase().includes(q) ||
      p.orderNumber?.toLowerCase().includes(q) ||
      p.paymentMethod?.toLowerCase().includes(q)
    );
  }, [items, search]);

  const getStatusBadge = (status) => {
    const s = (status || "pending").toLowerCase();
    if (s === "paid") return <span className="crm-badge crm-badge-success">Paid</span>;
    if (s === "failed") return <span className="crm-badge crm-badge-danger">Failed</span>;
    if (s === "refunded") return <span className="crm-badge bg-crm-purple-dim text-crm-purple border-crm-purple/30">Refunded</span>;
    if (s === "processing") return <span className="crm-badge bg-crm-primary-dim text-crm-primary border-crm-primary/30">Processing</span>;
    return <span className="crm-badge crm-badge-warning">Pending</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Payment Transactions</h2>
          <p className="text-crm-text-dim text-sm">Monitor and reconcile all incoming payments</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="crm-btn">
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
                  <tr key={p.transactionId} className="group">
                    <td>
                      <span className="font-mono text-[11px] font-bold text-crm-text-dim bg-crm-bg-hover px-2 py-1 rounded">
                        {p.transactionId?.slice(0, 16)}...
                      </span>
                    </td>
                    <td>{getStatusBadge(p.paymentStatus)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <FiCreditCard className="text-crm-text-muted" />
                        <span className="text-sm">{p.paymentMethod || "Manual"}</span>
                      </div>
                    </td>
                    <td>
                      <span className="font-bold tabular-nums text-crm-text-bright">
                        ৳{Number(p.amount).toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <p className="font-medium text-crm-primary">#{p.orderNumber || "N/A"}</p>
                    </td>
                    <td className="text-xs text-crm-text-dim">
                      {p.createdAt ? format(new Date(p.createdAt), "MMM dd, HH:mm") : "—"}
                    </td>
                    <td>
                      <button 
                        onClick={() => openDetail(p.transactionId)}
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
              ) : detail ? (
                <div className="p-8 space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-crm-bg-hover text-crm-success">
                        <FiDollarSign size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-crm-text-bright">Payment Detail</h3>
                        <p className="text-[10px] text-crm-text-dim font-mono uppercase tracking-wider">{detailId}</p>
                      </div>
                    </div>
                    <button onClick={() => setDetailId(null)} className="p-2 hover:bg-crm-bg-hover rounded-full text-crm-text-dim">
                      <FiArrowRight className="rotate-180" size={24} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="crm-card bg-crm-bg border-none">
                      <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider mb-2">Status</p>
                      {getStatusBadge(detail.transaction?.paymentStatus)}
                    </div>
                    <div className="crm-card bg-crm-bg border-none">
                      <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider mb-2">Amount</p>
                      <span className="text-xl font-bold text-crm-text-bright">৳{Number(detail.transaction?.amount).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest border-b border-crm-border pb-2">Transaction Info</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-crm-text-dim">Method</span>
                        <span className="text-crm-text-bright font-medium">{detail.transaction?.paymentMethod || "Manual"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-crm-text-dim">Order #</span>
                        <span className="text-crm-primary font-bold">{detail.transaction?.orderNumber || "N/A"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-crm-text-dim">Customer ID</span>
                        <span className="text-crm-text-bright font-mono text-xs">{detail.transaction?.customerId}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-crm-text-dim">Timestamp</span>
                        <span className="text-crm-text-bright">{detail.transaction?.createdAt ? format(new Date(detail.transaction.createdAt), "MMMM dd, yyyy HH:mm") : "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  {detail.transaction?.statusHistory && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest border-b border-crm-border pb-2">Status History</h4>
                      <div className="relative pl-6 space-y-6 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[2px] before:bg-crm-border">
                        {detail.transaction.statusHistory.map((h, i) => (
                          <div key={i} className="relative">
                            <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-crm-primary border-4 border-crm-bg-alt" />
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-bold text-crm-text-bright">{h.toStatus}</p>
                                <p className="text-xs text-crm-text-dim">{h.note || "No note"}</p>
                              </div>
                              <p className="text-[10px] text-crm-text-muted">{format(new Date(h.at), "HH:mm")}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {canEditPayments && (
                    <div className="pt-8 border-t border-crm-border space-y-4">
                      <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest">Adjust Payment Status</h4>
                      <div className="flex flex-wrap gap-2">
                        <button className="crm-btn crm-btn-primary flex-1 py-2">Mark as Paid</button>
                        <button className="crm-btn border-crm-danger/30 text-crm-danger hover:bg-crm-danger-dim flex-1 py-2">Refund</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
