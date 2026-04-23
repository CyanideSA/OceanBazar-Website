import React, { useEffect, useMemo, useState, useCallback } from "react";
import { 
  FiSearch, FiFilter, FiUser, FiMail, FiPhone, FiMapPin, 
  FiBriefcase, FiCalendar, FiShield, FiTrash2, FiEdit2, 
  FiMoreVertical, FiArrowRight, FiCheckCircle, FiClock 
} from "react-icons/fi";
import { adminApi } from "../lib/api";
import { getAdminUser } from "../lib/auth";
import { useToast } from "../components/ToastProvider";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "deactivated", label: "Deactivated" },
  { key: "banned", label: "Banned" },
];

export default function CustomersPage() {
  const adminRole = useMemo(() => String(getAdminUser()?.role || "STAFF").toUpperCase(), []);
  const canManageCustomers = adminRole === "SUPER_ADMIN" || adminRole === "ADMIN";
  const toast = useToast();

  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [orders, setOrders] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.customers();
      setItems(Array.isArray(res) ? res : res?.customers || res?.items || []);
    } catch (err) {
      toast.error("Failed to fetch customers");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const openDetail = async (id) => {
    setDetailId(id);
    setDetailLoading(true);
    try {
      const [u, ords] = await Promise.all([
        adminApi.customer(id),
        adminApi.customerOrders(id)
      ]);
      setDetail(u);
      setOrders(Array.isArray(ords) ? ords : []);
    } catch (err) {
      toast.error("Failed to load customer details");
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    return items.filter(u => {
      const matchesStatus = statusFilter === "all" || (u.accountStatus || "active").toLowerCase() === statusFilter;
      const matchesSearch = !search || 
        `${u.name} ${u.email} ${u.id}`.toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [items, statusFilter, search]);

  const getStatusBadge = (status) => {
    const s = (status || "active").toLowerCase();
    if (s === "banned") return <span className="crm-badge crm-badge-danger">Banned</span>;
    if (s === "deactivated") return <span className="crm-badge crm-badge-warning">Deactivated</span>;
    return <span className="crm-badge crm-badge-success">Active</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Customers</h2>
          <p className="text-crm-text-dim text-sm">Manage user accounts and business profiles</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-crm-text-dim uppercase tracking-wider bg-crm-bg-hover px-3 py-1.5 rounded-full border border-crm-border">
            {items.length} Total Users
          </span>
        </div>
      </div>

      <div className="crm-card p-0 overflow-hidden border-b-0 rounded-b-none flex flex-wrap">
        {STATUS_TABS.map(tab => (
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
            placeholder="Search by name, email, ID..." 
            className="crm-input pl-10" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="crm-btn" onClick={fetchCustomers}>
          <FiFilter /> Refresh List
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
                <th>Customer</th>
                <th>Status</th>
                <th>Type</th>
                <th>Phone</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-crm-text-dim">No customers found</td>
                </tr>
              ) : (
                filteredCustomers.map((u) => (
                  <tr key={u.id} className="group">
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-crm-bg-hover flex items-center justify-center text-crm-primary font-bold">
                          {u.name?.charAt(0) || "U"}
                        </div>
                        <div>
                          <p className="font-medium text-crm-text-bright">{u.name}</p>
                          <p className="text-[10px] text-crm-text-dim font-mono">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>{getStatusBadge(u.accountStatus)}</td>
                    <td>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        u.userType === "wholesale" ? "border-crm-purple text-crm-purple bg-crm-purple-dim" : "border-crm-border text-crm-text-dim"
                      }`}>
                        {u.userType || "Retail"}
                      </span>
                    </td>
                    <td className="text-sm text-crm-text-dim">{u.phone || "—"}</td>
                    <td className="text-xs text-crm-text-dim">
                      {u.createdAt ? format(new Date(u.createdAt), "MMM dd, yyyy") : "—"}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => openDetail(u.id)}
                          className="p-1.5 rounded hover:bg-crm-bg-hover text-crm-text-dim hover:text-crm-primary transition-colors"
                        >
                          <FiArrowRight size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Drawer - To be implemented with Framer Motion for side-slide */}
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
              {detailLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary"></div>
                </div>
              ) : detail ? (
                <div className="p-8 space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-crm-primary flex items-center justify-center text-white text-2xl font-bold">
                        {detail.name?.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-crm-text-bright">{detail.name}</h3>
                        <p className="text-crm-text-dim">{detail.email}</p>
                      </div>
                    </div>
                    <button onClick={() => setDetailId(null)} className="p-2 hover:bg-crm-bg-hover rounded-full text-crm-text-dim">
                      <FiArrowRight className="rotate-180" size={24} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="crm-card bg-crm-bg border-none">
                      <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider mb-2">Account Status</p>
                      {getStatusBadge(detail.accountStatus)}
                    </div>
                    <div className="crm-card bg-crm-bg border-none">
                      <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider mb-2">Member Type</p>
                      <span className="text-sm font-bold text-crm-text-bright capitalize">{detail.userType || "Retail"}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest border-b border-crm-border pb-2">Contact Information</h4>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="flex items-center gap-3 text-sm">
                        <FiPhone className="text-crm-primary" />
                        <span className="text-crm-text-bright">{detail.phone || "No phone number provided"}</span>
                      </div>
                      <div className="flex items-start gap-3 text-sm">
                        <FiMapPin className="text-crm-primary mt-1 shrink-0" />
                        <span className="text-crm-text-bright leading-relaxed">{detail.address || "No shipping address on file"}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <FiCalendar className="text-crm-primary" />
                        <span className="text-crm-text-bright">Joined {detail.createdAt ? format(new Date(detail.createdAt), "MMMM dd, yyyy") : "Unknown"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-crm-border pb-2">
                      <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest">Customer Flags</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {detail.flags && detail.flags.length > 0 ? (
                        detail.flags.map((flag, index) => (
                          <span key={index} className="crm-badge bg-crm-warning text-crm-warning-dark capitalize">{flag}</span>
                        ))
                      ) : (
                        <p className="text-sm text-crm-text-dim">No flags assigned</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-crm-border pb-2">
                      <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest">Order History</h4>
                      <span className="crm-badge">{orders.length} Orders</span>
                    </div>
                    {orders.length === 0 ? (
                      <p className="text-sm text-crm-text-dim text-center py-4 italic">No orders found for this customer</p>
                    ) : (
                      <div className="space-y-2">
                        {orders.slice(0, 5).map(o => (
                          <div key={o.id} className="flex items-center justify-between p-3 rounded-lg bg-crm-bg hover:bg-crm-bg-hover transition-colors cursor-pointer border border-transparent hover:border-crm-border">
                            <div>
                              <p className="text-sm font-bold text-crm-primary">#{o.id.slice(-8).toUpperCase()}</p>
                              <p className="text-[10px] text-crm-text-dim">{format(new Date(o.createdAt), "MMM dd, yyyy")}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-crm-text-bright">৳{Number(o.total).toLocaleString()}</p>
                              <span className="text-[10px] uppercase font-bold text-crm-success">{o.status}</span>
                            </div>
                          </div>
                        ))}
                        {orders.length > 5 && (
                          <button className="w-full py-2 text-xs font-bold text-crm-primary hover:underline">View all orders</button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-8 border-t border-crm-border flex flex-wrap gap-3">
                    <button className="crm-btn flex-1"><FiEdit2 /> Edit Profile</button>
                    <button className="crm-btn flex-1 border-crm-danger/30 text-crm-danger hover:bg-crm-danger-dim"><FiTrash2 /> Ban User</button>
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
