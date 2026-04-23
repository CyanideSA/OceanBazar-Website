import React, { useEffect, useState, useCallback, useMemo } from "react";
import { 
  FiSearch, FiFilter, FiActivity, FiClock, FiUser, 
  FiPackage, FiRefreshCw, FiChevronDown, FiChevronUp, FiTarget,
  FiExternalLink
} from "react-icons/fi";
import { adminApi } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

const TARGET_TYPES = [
  { value: "", label: "All Types" },
  { value: "customer", label: "Customer" },
  { value: "order", label: "Order" },
  { value: "dispute", label: "Dispute" },
  { value: "notification", label: "Notification" },
  { value: "application", label: "Application" },
  { value: "product", label: "Product" },
  { value: "admin_member", label: "Admin Member" },
];

const ACTION_COLORS = {
  CREATE: "text-crm-success bg-crm-success-dim border-crm-success/20",
  UPDATE: "text-crm-primary bg-crm-primary-dim border-crm-primary/20",
  DELETE: "text-crm-danger bg-crm-danger-dim border-crm-danger/20",
  LOGIN: "text-crm-purple bg-crm-purple-dim border-crm-purple/20",
};

export default function AuditLogsPage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTargetType, setFilterTargetType] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterTargetType) params.targetType = filterTargetType;
      const data = await adminApi.auditLogs(params);
      setItems(Array.isArray(data) ? data : data?.logs || data?.items || []);
    } catch (err) {
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [filterTargetType, toast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(l => 
      l.action?.toLowerCase().includes(q) ||
      l.details?.toLowerCase().includes(q) ||
      l.targetId?.toLowerCase().includes(q) ||
      l.actorAdminId?.toLowerCase().includes(q)
    );
  }, [items, search]);

  const getActionClass = (action) => {
    const a = action?.toUpperCase() || "";
    if (a.includes("CREATE")) return ACTION_COLORS.CREATE;
    if (a.includes("UPDATE") || a.includes("PATCH")) return ACTION_COLORS.UPDATE;
    if (a.includes("DELETE") || a.includes("REMOVE")) return ACTION_COLORS.DELETE;
    if (a.includes("LOGIN")) return ACTION_COLORS.LOGIN;
    return "text-crm-text-dim bg-crm-bg-hover border-crm-border";
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-bg-hover text-crm-text-dim">
            <FiActivity size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">System Audit Logs</h2>
            <p className="text-crm-text-dim text-sm">Traceable record of all administrative actions</p>
          </div>
        </div>
        <button onClick={fetchLogs} className="crm-btn" disabled={loading}>
          <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="crm-card flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
          <input 
            type="text" 
            placeholder="Search logs by action, ID, admin..." 
            className="crm-input pl-10" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <select 
            className="crm-input min-w-[160px]"
            value={filterTargetType}
            onChange={(e) => setFilterTargetType(e.target.value)}
          >
            {TARGET_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <span className="text-xs font-bold text-crm-text-dim uppercase bg-crm-bg-hover px-3 py-2 rounded-lg border border-crm-border">
            {filteredLogs.length} Records
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
                <th>Action</th>
                <th>Target</th>
                <th>Details</th>
                <th>Actor</th>
                <th>Timestamp</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-crm-text-dim">No logs found</td>
                </tr>
              ) : (
                filteredLogs.map((l) => {
                  const isExpanded = expandedId === l.id;
                  return (
                    <React.Fragment key={l.id}>
                      <tr 
                        onClick={() => setExpandedId(isExpanded ? null : l.id)}
                        className={`group cursor-pointer hover:bg-crm-bg-card transition-colors ${isExpanded ? "bg-crm-bg-card" : ""}`}
                      >
                        <td>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border whitespace-nowrap ${getActionClass(l.action)}`}>
                            {l.action}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-crm-text-dim uppercase font-bold tracking-widest bg-crm-bg-hover px-1.5 py-0.5 rounded border border-crm-border">
                              {l.targetType}
                            </span>
                            <span className="font-mono text-[11px] text-crm-primary">#{l.targetId?.slice(-6)}</span>
                          </div>
                        </td>
                        <td className="max-w-[200px]">
                          <p className="text-sm text-crm-text-dim truncate">{l.details}</p>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <FiUser className="text-crm-text-muted" size={12} />
                            <span className="text-xs font-medium text-crm-text-bright">{l.actorRole}</span>
                          </div>
                        </td>
                        <td className="text-xs text-crm-text-dim whitespace-nowrap">
                          {l.createdAt ? format(new Date(l.createdAt), "MMM dd, HH:mm:ss") : "—"}
                        </td>
                        <td>
                          {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                        </td>
                      </tr>
                      <AnimatePresence>
                        {isExpanded && (
                          <tr>
                            <td colSpan="6" className="p-0 border-none">
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden bg-crm-bg/40"
                              >
                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                                  <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-xs font-bold text-crm-text-muted uppercase tracking-widest border-b border-crm-border pb-2">
                                      <FiTarget /> Target Reference
                                    </div>
                                    <div className="space-y-2">
                                      <div className="flex justify-between">
                                        <span className="text-crm-text-dim">Full Target ID</span>
                                        <span className="font-mono text-crm-text-bright">{l.targetId}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-crm-text-dim">Entity Type</span>
                                        <span className="text-crm-text-bright capitalize">{l.targetType}</span>
                                      </div>
                                    </div>
                                    <div className="p-4 rounded-lg bg-crm-bg border border-crm-border text-crm-text-bright italic">
                                      "{l.details || "No additional details recorded."}"
                                    </div>
                                  </div>
                                  <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-xs font-bold text-crm-text-muted uppercase tracking-widest border-b border-crm-border pb-2">
                                      <FiUser /> Actor Context
                                    </div>
                                    <div className="space-y-2">
                                      <div className="flex justify-between">
                                        <span className="text-crm-text-dim">Admin ID</span>
                                        <span className="font-mono text-crm-text-bright">{l.actorAdminId || "System"}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-crm-text-dim">Role at Event</span>
                                        <span className="text-crm-text-bright font-bold">{l.actorRole}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-crm-text-dim">IP Address</span>
                                        <span className="text-crm-text-muted">127.0.0.1 (Local)</span>
                                      </div>
                                    </div>
                                    <button className="crm-btn w-full text-xs py-2">
                                      <FiExternalLink /> View Related Entity
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
