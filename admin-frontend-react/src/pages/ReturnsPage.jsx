import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { 
  FiSearch, FiFilter, FiCornerUpLeft, FiTruck, FiCheckCircle, 
  FiXCircle, FiMoreVertical, FiDownload, FiDollarSign, FiClock,
  FiArrowRight, FiInfo
} from "react-icons/fi";
import { hasPermission } from "../auth/permissionMatrix";
import { getAdminUser } from "../lib/auth";
import { returnService } from "../services/returnService";
import { useToast } from "../components/ToastProvider";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_MAP = {
  pending: { label: "Pending", class: "crm-badge-warning" },
  approved: { label: "Approved", class: "bg-crm-primary-dim text-crm-primary border-crm-primary/30" },
  rejected: { label: "Rejected", class: "crm-badge-danger" },
  shipped_back: { label: "Shipped Back", class: "bg-crm-purple-dim text-crm-purple border-crm-purple/30" },
  received: { label: "Received", class: "bg-crm-cyan-dim text-crm-cyan border-crm-cyan/30" },
  refunded: { label: "Refunded", class: "crm-badge-success" },
  closed: { label: "Closed", class: "text-crm-text-dim border-crm-border" },
};

export default function ReturnsPage({ returnsInboundRef, returnLiveTick = 0, wsConnected = false }) {
  const toast = useToast();
  const adminRole = useMemo(() => String(getAdminUser()?.role || "STAFF").toUpperCase(), []);
  const canRefund = hasPermission(adminRole, "returns", "refund");

  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const data = await returnService.list(statusFilter || undefined);
      setReturns(Array.isArray(data) ? data : data?.returns || data?.items || []);
    } catch (err) {
      toast.error("Failed to fetch returns");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns, returnLiveTick]);

  const filteredReturns = useMemo(() => {
    if (!search) return returns;
    const q = search.toLowerCase();
    return returns.filter(r => 
      r.id?.toLowerCase().includes(q) ||
      r.orderId?.toLowerCase().includes(q) ||
      r.reason?.toLowerCase().includes(q)
    );
  }, [returns, search]);

  const getStatusBadge = (status) => {
    const s = (status || "pending").toLowerCase();
    const config = STATUS_MAP[s] || STATUS_MAP.closed;
    return <span className={`crm-badge border ${config.class}`}>{config.label}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Returns & RMA</h2>
          <p className="text-crm-text-dim text-sm">Manage product returns and refund processing</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="crm-btn">
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
                <th>Order ID</th>
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
                  <tr key={ret.id} className="group">
                    <td>
                      <span className="font-mono text-xs font-bold text-crm-text-dim bg-crm-bg-hover px-2 py-1 rounded">
                        #{ret.id?.slice(-8).toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <p className="font-medium text-crm-primary text-sm">#{ret.orderId?.slice(-8).toUpperCase() || "N/A"}</p>
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
                    <td>
                      <button 
                        onClick={() => { setDetail(ret); setDetailId(ret.id); }}
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
              className="fixed top-0 right-0 h-full w-full max-w-lg bg-crm-bg-alt border-l border-crm-border z-50 overflow-y-auto custom-scrollbar"
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
                    <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest border-b border-crm-border pb-2">Information</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-crm-text-dim">Order ID</span>
                        <span className="text-crm-primary font-bold">#{detail.orderId?.slice(-8).toUpperCase()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-crm-text-dim">Reason Category</span>
                        <span className="text-crm-text-bright font-medium">{detail.reasonCategory || "N/A"}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-crm-text-dim uppercase font-bold tracking-wider">Description</span>
                        <div className="p-3 rounded-lg bg-crm-bg border border-crm-border text-sm text-crm-text-bright italic">
                          "{detail.description || "No description provided"}"
                        </div>
                      </div>
                    </div>
                  </div>

                  {detail.timeline && detail.timeline.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest border-b border-crm-border pb-2">Activity Timeline</h4>
                      <div className="relative pl-6 space-y-6 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[2px] before:bg-crm-border">
                        {detail.timeline.map((h, i) => (
                          <div key={i} className="relative">
                            <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-crm-primary border-4 border-crm-bg-alt" />
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-bold text-crm-text-bright">{h.status.toUpperCase()}</p>
                                <p className="text-xs text-crm-text-dim">{h.note || "No note added"}</p>
                              </div>
                              <p className="text-[10px] text-crm-text-muted">{h.at ? format(new Date(h.at), "HH:mm") : ""}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-8 border-t border-crm-border space-y-4">
                    <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest">Administrative Actions</h4>
                    {detail.status === "pending" ? (
                      <div className="flex flex-wrap gap-2">
                        <button className="crm-btn crm-btn-primary flex-1 py-2">Approve Return</button>
                        <button className="crm-btn border-crm-danger/30 text-crm-danger hover:bg-crm-danger-dim flex-1 py-2">Reject Request</button>
                      </div>
                    ) : detail.status === "approved" && canRefund ? (
                      <button className="crm-btn crm-btn-primary w-full py-2"><FiDollarSign /> Process Refund</button>
                    ) : (
                      <div className="p-4 rounded-lg bg-crm-bg flex items-center gap-3 text-crm-text-dim border border-crm-border">
                        <FiInfo />
                        <span className="text-xs">This return request has been processed and is now {detail.status}.</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
