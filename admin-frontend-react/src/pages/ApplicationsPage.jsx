import React, { useEffect, useMemo, useState, useCallback } from "react";
import { 
  FiBriefcase, FiUsers, FiSearch, FiFilter, FiRefreshCw, 
  FiCheckCircle, FiXCircle, FiClock, FiArrowRight, FiMail, 
  FiPhone, FiMapPin, FiBarChart2, FiMessageSquare, FiInfo, FiTruck
} from "react-icons/fi";
import { adminApi } from "../lib/api";
import { getAdminUser } from "../lib/auth";
import { useToast } from "../components/ToastProvider";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_MAP = {
  pending: { label: "Pending", class: "crm-badge-warning" },
  approved: { label: "Approved", class: "crm-badge-success" },
  rejected: { label: "Rejected", class: "crm-badge-danger" },
};

export default function ApplicationsPage() {
  const toast = useToast();
  const [wholesale, setWholesale] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("wholesale");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const [w, i] = await Promise.all([
        adminApi.wholesaleApplications(),
        adminApi.businessInquiries()
      ]);
      setWholesale(Array.isArray(w) ? w : w?.applications || w?.items || []);
      setInquiries(Array.isArray(i) ? i : i?.inquiries || i?.items || []);
    } catch (err) {
      toast.error("Failed to load applications");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  const currentList = activeTab === "wholesale" ? wholesale : inquiries;

  const filteredList = useMemo(() => {
    return currentList.filter(item => {
      const matchesStatus = statusFilter === "all" || (item.status || "pending").toLowerCase() === statusFilter;
      const q = search.toLowerCase();
      const matchesSearch = !search || 
        `${item.businessName} ${item.email} ${item.contactPerson || item.fullName}`.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [currentList, statusFilter, search]);

  const openDetail = (item) => {
    setDetail(item);
    setDetailId(item.id);
  };

  const getStatusBadge = (status) => {
    const s = (status || "pending").toLowerCase();
    const config = STATUS_MAP[s] || STATUS_MAP.pending;
    return <span className={`crm-badge border ${config.class}`}>{config.label}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-bg-hover text-crm-text-dim">
            <FiBriefcase size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Business Applications</h2>
            <p className="text-crm-text-dim text-sm">Review wholesale and partnership inquiries</p>
          </div>
        </div>
        <button onClick={fetchApplications} className="crm-btn" disabled={loading}>
          <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="crm-card p-0 overflow-hidden border-b-0 rounded-b-none flex flex-wrap">
        <button
          onClick={() => setActiveTab("wholesale")}
          className={`px-6 py-3 border-b-2 transition-all font-medium text-sm flex items-center gap-2 ${
            activeTab === "wholesale" 
              ? "border-crm-primary text-crm-primary bg-crm-primary-dim" 
              : "border-transparent text-crm-text-dim hover:text-crm-text-bright hover:bg-crm-bg-hover"
          }`}
        >
          <FiUsers /> Wholesale ({wholesale.length})
        </button>
        <button
          onClick={() => setActiveTab("partner")}
          className={`px-6 py-3 border-b-2 transition-all font-medium text-sm flex items-center gap-2 ${
            activeTab === "partner" 
              ? "border-crm-primary text-crm-primary bg-crm-primary-dim" 
              : "border-transparent text-crm-text-dim hover:text-crm-text-bright hover:bg-crm-bg-hover"
          }`}
        >
          <FiBriefcase /> Partner Requests ({inquiries.length})
        </button>
      </div>

      <div className="crm-card flex flex-wrap items-center gap-4 rounded-t-none border-t-0">
        <div className="relative flex-1 min-w-[240px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
          <input 
            type="text" 
            placeholder="Search by business, name or email..." 
            className="crm-input pl-10" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <select 
            className="crm-input min-w-[140px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <span className="text-xs font-bold text-crm-text-dim uppercase bg-crm-bg-hover px-3 py-2 rounded-lg border border-crm-border">
            {filteredList.length} Entries
          </span>
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
                <th>Business Name</th>
                <th>Contact Person</th>
                <th>Status</th>
                <th>Email</th>
                <th>Volume/Type</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-crm-text-dim">No applications found</td>
                </tr>
              ) : (
                filteredList.map((row) => (
                  <tr key={row.id} className="group">
                    <td>
                      <p className="font-bold text-crm-text-bright">{row.businessName || "—"}</p>
                    </td>
                    <td>
                      <p className="text-sm text-crm-text-dim">{row.contactPerson || row.fullName || "—"}</p>
                    </td>
                    <td>{getStatusBadge(row.status)}</td>
                    <td>
                      <div className="flex items-center gap-2 text-xs text-crm-text-dim">
                        <FiMail size={12} />
                        <span>{row.email}</span>
                      </div>
                    </td>
                    <td>
                      <span className="text-xs font-medium text-crm-text-bright">
                        {activeTab === "wholesale" ? row.expectedVolume : row.businessType || "—"}
                      </span>
                    </td>
                    <td className="text-[11px] text-crm-text-dim whitespace-nowrap">
                      {row.createdAt ? format(new Date(row.createdAt), "MMM dd, yyyy") : "—"}
                    </td>
                    <td>
                      <button 
                        onClick={() => openDetail(row)}
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
                    <div className="p-3 rounded-xl bg-crm-bg-hover text-crm-primary">
                      {activeTab === "wholesale" ? <FiUsers size={24} /> : <FiBriefcase size={24} />}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-crm-text-bright">Application Review</h3>
                      <p className="text-[10px] text-crm-text-dim font-mono uppercase tracking-wider">{activeTab.toUpperCase()} ID: {detail.id}</p>
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
                    <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider mb-2">Submission Date</p>
                    <span className="text-sm font-bold text-crm-text-bright">
                      {detail.createdAt ? format(new Date(detail.createdAt), "MMMM dd, yyyy") : "N/A"}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest border-b border-crm-border pb-2">Business Information</h4>
                  <div className="grid grid-cols-1 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-crm-text-dim">Company Name</span>
                      <span className="text-crm-text-bright font-bold">{detail.businessName || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-crm-text-dim">Primary Contact</span>
                      <span className="text-crm-text-bright font-medium">{detail.contactPerson || detail.fullName || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-crm-text-dim">Email Address</span>
                      <span className="text-crm-primary font-medium underline">{detail.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-crm-text-dim">Phone Number</span>
                      <span className="text-crm-text-bright font-medium">{detail.phone || "—"}</span>
                    </div>
                    {activeTab === "wholesale" ? (
                      <div className="flex justify-between">
                        <span className="text-crm-text-dim">Expected Volume</span>
                        <span className="text-crm-text-bright font-bold">{detail.expectedVolume || "—"}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between">
                        <span className="text-crm-text-dim">Partner Type</span>
                        <span className="text-crm-text-bright font-bold">{detail.businessType || "—"}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest">Introduction / Message</h4>
                  <div className="p-4 rounded-lg bg-crm-bg border border-crm-border text-sm text-crm-text-bright leading-relaxed italic">
                    "{detail.message || "No introduction message provided."}"
                  </div>
                </div>

                <div className="pt-8 border-t border-crm-border space-y-6">
                  <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest">Decision Center</h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-crm-text-dim uppercase">Internal Review Notes</label>
                      <textarea 
                        className="crm-input min-h-[120px] bg-crm-bg" 
                        placeholder="Add notes about your review or decision..."
                        defaultValue={detail.adminNotes}
                      />
                    </div>
                    {detail.status === "pending" ? (
                      <div className="flex flex-wrap gap-2">
                        <button className="crm-btn crm-btn-primary flex-1 py-2.5">
                          <FiCheckCircle /> Approve Account
                        </button>
                        <button className="crm-btn border-crm-danger/30 text-crm-danger hover:bg-crm-danger-dim flex-1 py-2.5">
                          <FiXCircle /> Reject
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 rounded-lg bg-crm-bg flex items-center gap-3 text-crm-text-dim border border-crm-border">
                        <FiInfo />
                        <span className="text-xs font-medium">This application was {detail.status} on {detail.reviewedAt ? format(new Date(detail.reviewedAt), "MMM dd") : "a prior date"}.</span>
                      </div>
                    )}
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
