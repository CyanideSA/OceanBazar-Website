import React, { useEffect, useMemo, useState, useCallback } from "react";
import { 
  FiSearch, FiFilter, FiAlertCircle, FiClock, FiCheckCircle, 
  FiXCircle, FiMoreVertical, FiDownload, FiPlus, FiArrowRight,
  FiMessageSquare, FiActivity
} from "react-icons/fi";
import { adminApi } from "../lib/api";
import { getAdminUser } from "../lib/auth";
import { useToast } from "../components/ToastProvider";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_MAP = {
  open: { label: "Open", class: "crm-badge-warning" },
  investigating: { label: "Investigating", class: "bg-crm-primary-dim text-crm-primary border-crm-primary/30" },
  resolved: { label: "Resolved", class: "crm-badge-success" },
  rejected: { label: "Rejected", class: "crm-badge-danger" },
};

const PRIORITY_MAP = {
  high: "text-crm-danger bg-crm-danger-dim border-crm-danger/20",
  medium: "text-crm-warning bg-crm-warning-dim border-crm-warning/20",
  low: "text-crm-success bg-crm-success-dim border-crm-success/20",
};

export default function DisputesPage() {
  const toast = useToast();
  const adminRole = useMemo(() => String(getAdminUser()?.role || "STAFF").toUpperCase(), []);
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.disputes();
      setItems(Array.isArray(res) ? res : res?.disputes || res?.items || []);
    } catch (err) {
      toast.error("Failed to fetch disputes");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  const openDetail = async (id) => {
    setDetailId(id);
    const found = items.find(d => d.id === id);
    setDetail(found);
  };

  const filteredDisputes = useMemo(() => {
    return items.filter(d => {
      const matchesStatus = statusFilter === "all" || (d.status || "open").toLowerCase() === statusFilter;
      const matchesSearch = !search || 
        `${d.title} ${d.id} ${d.orderId}`.toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [items, statusFilter, search]);

  const getStatusBadge = (status) => {
    const s = (status || "open").toLowerCase();
    const config = STATUS_MAP[s] || STATUS_MAP.open;
    return <span className={`crm-badge border ${config.class}`}>{config.label}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Dispute Management</h2>
          <p className="text-crm-text-dim text-sm">Handle customer complaints and order disputes</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="crm-btn crm-btn-primary">
            <FiPlus /> Internal Report
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: "Open Issues", count: items.filter(d => d.status === "open").length, color: "text-crm-warning" },
          { label: "Investigating", count: items.filter(d => d.status === "investigating").length, color: "text-crm-primary" },
          { label: "Resolved", count: items.filter(d => d.status === "resolved").length, color: "text-crm-success" },
          { label: "Total", count: items.length, color: "text-crm-text-dim" },
        ].map((stat, i) => (
          <div key={i} className="crm-card">
            <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.count}</p>
          </div>
        ))}
      </div>

      <div className="crm-card p-0 overflow-hidden border-b-0 rounded-b-none flex flex-wrap">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-6 py-3 border-b-2 transition-all font-medium text-sm ${statusFilter === "all" ? "border-crm-primary text-crm-primary bg-crm-primary-dim" : "border-transparent text-crm-text-dim hover:text-crm-text-bright"}`}
        >
          All Disputes
        </button>
        {Object.entries(STATUS_MAP).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-6 py-3 border-b-2 transition-all font-medium text-sm ${
              statusFilter === key 
                ? "border-crm-primary text-crm-primary bg-crm-primary-dim" 
                : "border-transparent text-crm-text-dim hover:text-crm-text-bright hover:bg-crm-bg-hover"
            }`}
          >
            {config.label}
          </button>
        ))}
      </div>

      <div className="crm-card flex flex-wrap items-center gap-4 rounded-t-none border-t-0">
        <div className="relative flex-1 min-w-[240px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
          <input 
            type="text" 
            placeholder="Search title, ID, order..." 
            className="crm-input pl-10" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="crm-btn" onClick={fetchDisputes}>
          <FiFilter /> Refresh
        </button>
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
                <th>Dispute ID</th>
                <th>Order</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Title</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDisputes.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-crm-text-dim">No disputes found</td>
                </tr>
              ) : (
                filteredDisputes.map((d) => (
                  <tr key={d.id} className="group">
                    <td>
                      <span className="font-mono text-xs font-bold text-crm-text-dim bg-crm-bg-hover px-2 py-1 rounded">
                        #{d.id?.slice(-8).toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <p className="font-medium text-crm-primary text-sm">#{d.orderId?.slice(-8).toUpperCase() || "N/A"}</p>
                    </td>
                    <td>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${PRIORITY_MAP[d.priority?.toLowerCase()] || PRIORITY_MAP.medium}`}>
                        {d.priority || "Medium"}
                      </span>
                    </td>
                    <td>{getStatusBadge(d.status)}</td>
                    <td className="max-w-[250px]">
                      <p className="text-sm text-crm-text-bright truncate font-medium">{d.title}</p>
                    </td>
                    <td className="text-xs text-crm-text-dim">
                      {d.createdAt ? format(new Date(d.createdAt), "MMM dd, yyyy") : "—"}
                    </td>
                    <td>
                      <button 
                        onClick={() => openDetail(d.id)}
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

      {/* Detail Panel */}
      <AnimatePresence>
        {detailId && detail && (
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
              <div className="p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-crm-bg-hover text-crm-danger">
                      <FiAlertCircle size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-crm-text-bright">Dispute Review</h3>
                      <p className="text-[10px] text-crm-text-dim font-mono uppercase tracking-wider">{detail.id}</p>
                    </div>
                  </div>
                  <button onClick={() => setDetailId(null)} className="p-2 hover:bg-crm-bg-hover rounded-full text-crm-text-dim">
                    <FiArrowRight className="rotate-180" size={24} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="crm-card bg-crm-bg border-none">
                    <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider mb-2">Priority</p>
                    <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded border ${PRIORITY_MAP[detail.priority?.toLowerCase()] || PRIORITY_MAP.medium}`}>
                      {detail.priority}
                    </span>
                  </div>
                  <div className="crm-card bg-crm-bg border-none">
                    <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider mb-2">Status</p>
                    {getStatusBadge(detail.status)}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest border-b border-crm-border pb-2">Dispute Information</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-crm-text-dim">Title</span>
                      <span className="text-crm-text-bright font-bold">{detail.title}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-crm-text-dim">Order ID</span>
                      <span className="text-crm-primary font-bold">#{detail.orderId?.slice(-8).toUpperCase()}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-crm-text-dim uppercase font-bold tracking-wider">Description</span>
                      <div className="p-4 rounded-lg bg-crm-bg border border-crm-border text-sm text-crm-text-bright leading-relaxed">
                        {detail.description || "No description provided"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-crm-border space-y-6">
                  <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest">Resolution Center</h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-crm-text-dim uppercase">Internal / Resolution Note</label>
                      <textarea 
                        className="crm-input min-h-[120px] bg-crm-bg" 
                        placeholder="Detail the steps taken to investigate or the terms of resolution..."
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="crm-btn crm-btn-primary flex-1 py-2">Update Investigation</button>
                      <button className="crm-btn border-crm-success/30 text-crm-success hover:bg-crm-success-dim flex-1 py-2">Mark Resolved</button>
                    </div>
                    <button className="crm-btn w-full border-crm-danger/30 text-crm-danger hover:bg-crm-danger-dim py-2">Reject Dispute</button>
                  </div>
                </div>

                <div className="pt-8 border-t border-crm-border space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest">Activity History</h4>
                    <FiActivity className="text-crm-text-muted" />
                  </div>
                  <div className="p-4 rounded-lg bg-crm-bg border border-crm-border text-center">
                    <p className="text-xs text-crm-text-dim italic">WebSocket connected. Live monitoring active.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
