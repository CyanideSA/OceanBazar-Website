import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  FiSearch, FiFilter, FiPhone, FiMapPin,
  FiCalendar, FiTrash2, FiEdit2, FiArrowRight,
  FiX, FiCheck, FiRefreshCw, FiAlertCircle, FiShoppingBag,
  FiBriefcase, FiUserCheck, FiUserX, FiSave,
} from "react-icons/fi";
import { adminApi } from "../lib/api";
import { getAdminUser } from "../lib/auth";
import { useToast } from "../components/ToastProvider";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import useStepUpReauth from "../hooks/useStepUpReauth";

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "suspended", label: "Suspended" },
];

const TYPE_TABS = [
  { key: "all", label: "All Types" },
  { key: "retail", label: "Retail" },
  { key: "wholesale", label: "Wholesale" },
];

function StatusBadge({ status }) {
  const s = (status || "active").toLowerCase();
  if (s === "banned" || s === "suspended") return <span className="crm-badge crm-badge-danger">Suspended</span>;
  if (s === "deactivated") return <span className="crm-badge crm-badge-warning">Deactivated</span>;
  return <span className="crm-badge crm-badge-success">Active</span>;
}

function TypeBadge({ type }) {
  const isWholesale = (type || "retail").toLowerCase() === "wholesale";
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
      isWholesale
        ? "border-purple-500/50 text-purple-400 bg-purple-500/10"
        : "border-crm-border text-crm-text-dim"
    }`}>
      {isWholesale ? "Wholesale" : "Retail"}
    </span>
  );
}

export default function CustomersPage({ onOpenTimeline }) {
  const { requestToken, modal: reauthModal } = useStepUpReauth();
  const adminRole = useMemo(() => String(getAdminUser()?.role || "STAFF").toUpperCase(), []);
  const canManage = adminRole === "SUPER_ADMIN" || adminRole === "ADMIN";
  const toast = useToast();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [orders, setOrders] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [migrateConfirm, setMigrateConfirm] = useState(null);

  /* ── Fetch list ── */
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.customers();
      const list = Array.isArray(res) ? res : (res?.users || res?.customers || []);
      setItems(list);
      setTotal(res?.total ?? list.length);
    } catch {
      toast.error("Failed to fetch customers");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  /* ── Open detail ── */
  const openDetail = useCallback(async (id) => {
    setSelectedId(id);
    setEditMode(false);
    setDeleteConfirm(false);
    setMigrateConfirm(null);
    setDetailLoading(true);
    try {
      const [uRes, ordsRes] = await Promise.all([
        adminApi.customer(id),
        adminApi.customerOrders(id),
      ]);
      const user = uRes?.user || uRes;
      const orderList = ordsRes?.orders || (Array.isArray(ordsRes) ? ordsRes : []);
      setDetail(user);
      setOrders(orderList);
      setEditForm({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        preferredLang: user.preferredLang || "en",
        accountStatus: user.accountStatus || "active",
        userType: user.userType || "retail",
      });
    } catch {
      toast.error("Failed to load customer details");
    } finally {
      setDetailLoading(false);
    }
  }, [toast]);

  /* ── Save edit ── */
  const handleSaveEdit = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const res = await adminApi.updateCustomer(selectedId, {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone || null,
        preferredLang: editForm.preferredLang,
        accountStatus: editForm.accountStatus,
      });
      const updated = res?.user || res;
      setDetail(prev => ({ ...prev, ...updated }));
      setItems(prev => prev.map(u => u.id === selectedId ? { ...u, ...updated } : u));
      setEditMode(false);
      toast.success("Customer updated");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to update customer");
    } finally {
      setSaving(false);
    }
  };

  /* ── Wholesale / Retail migration ── */
  const handleMigrate = async (newType) => {
    if (!selectedId) return;
    setSaving(true);
    try {
      if (newType === "wholesale") {
        await adminApi.approveWholesale(selectedId);
      } else {
        await adminApi.revokeWholesale(selectedId);
      }
      setDetail(prev => ({ ...prev, userType: newType }));
      setItems(prev => prev.map(u => u.id === selectedId ? { ...u, userType: newType } : u));
      setMigrateConfirm(null);
      toast.success(`Customer migrated to ${newType}`);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Migration failed");
    } finally {
      setSaving(false);
    }
  };

  /* ── Change account status ── */
  const handleChangeStatus = async (newStatus) => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await adminApi.patchCustomerAccountStatus(selectedId, { accountStatus: newStatus });
      setDetail(prev => ({ ...prev, accountStatus: newStatus }));
      setItems(prev => prev.map(u => u.id === selectedId ? { ...u, accountStatus: newStatus } : u));
      toast.success(`Status changed to ${newStatus}`);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to change status");
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete (soft suspend) ── */
  const handleDelete = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const reauthToken = await requestToken();
      await adminApi.deleteCustomer(selectedId, reauthToken);
      setItems(prev => prev.filter(u => u.id !== selectedId));
      setSelectedId(null);
      setDetail(null);
      setDeleteConfirm(false);
      toast.success("Customer suspended");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to suspend customer");
    } finally {
      setSaving(false);
    }
  };

  /* ── Filter ── */
  const filtered = useMemo(() => items.filter(u => {
    const status = (u.accountStatus || "active").toLowerCase();
    const type = (u.userType || "retail").toLowerCase();
    const matchStatus = statusFilter === "all" || (statusFilter === "suspended" ? (status === "suspended" || status === "banned") : status === statusFilter);
    const matchType = typeFilter === "all" || type === typeFilter;
    const matchSearch = !search || `${u.name || ""} ${u.email || ""} ${u.id}`.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchType && matchSearch;
  }), [items, statusFilter, typeFilter, search]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Customers</h2>
          <p className="text-crm-text-dim text-sm">{total} registered users · {items.filter(u => (u.userType || "retail") === "wholesale").length} wholesale</p>
        </div>
        <button onClick={fetchCustomers} className="crm-btn flex items-center gap-2 self-start sm:self-auto">
          <FiRefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="crm-card flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" size={14} />
          <input
            type="text" placeholder="Search name, email, ID…"
            className="crm-input pl-9" value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 bg-crm-bg rounded-lg p-1 border border-crm-border">
          {STATUS_TABS.map(t => (
            <button key={t.key} onClick={() => setStatusFilter(t.key)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${statusFilter === t.key ? "bg-crm-primary text-white" : "text-crm-text-dim hover:text-crm-text-bright"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-crm-bg rounded-lg p-1 border border-crm-border">
          {TYPE_TABS.map(t => (
            <button key={t.key} onClick={() => setTypeFilter(t.key)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${typeFilter === t.key ? "bg-crm-primary text-white" : "text-crm-text-dim hover:text-crm-text-bright"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="crm-table-container overflow-x-auto">
        {loading ? (
          <div className="p-20 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary" /></div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr><th>Customer</th><th>Status</th><th>Type</th><th>Phone</th><th>Joined</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-12 text-crm-text-dim">No customers found</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id} className={`group cursor-pointer ${selectedId === u.id ? "bg-crm-primary-dim/30" : ""}`} onClick={() => openDetail(u.id)}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-crm-primary to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {(u.name || u.email || "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-crm-text-bright">{u.name || "—"}</p>
                        <p className="text-[10px] text-crm-text-dim font-mono">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td><StatusBadge status={u.accountStatus} /></td>
                  <td><TypeBadge type={u.userType} /></td>
                  <td className="text-sm text-crm-text-dim">{u.phone || "—"}</td>
                  <td className="text-xs text-crm-text-dim">{u.createdAt ? format(new Date(u.createdAt), "MMM dd, yyyy") : "—"}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <button onClick={() => openDetail(u.id)} className="p-1.5 rounded hover:bg-crm-bg-hover text-crm-text-dim hover:text-crm-primary transition-colors">
                      <FiArrowRight size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Drawer */}
      <AnimatePresence>
        {selectedId && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={() => { setSelectedId(null); setDetail(null); }} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed top-0 right-0 h-full w-full max-w-[520px] bg-crm-bg-alt border-l border-crm-border z-50 flex flex-col overflow-hidden">

              {/* Drawer Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-crm-border bg-crm-bg shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-crm-primary to-purple-500 flex items-center justify-center text-white text-lg font-bold shrink-0">
                    {(detail?.name || detail?.email || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-crm-text-bright">{detail?.name || "Loading…"}</p>
                    <p className="text-xs text-crm-text-dim">{detail?.email}</p>
                  </div>
                </div>
                <button onClick={() => { setSelectedId(null); setDetail(null); }} className="p-2 rounded-lg hover:bg-crm-bg-hover text-crm-text-dim">
                  <FiX size={18} />
                </button>
              </div>

              {detailLoading ? (
                <div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary" /></div>
              ) : detail ? (
                <div className="flex-1 overflow-y-auto custom-scrollbar">

                  {/* Status + Type badges */}
                  <div className="grid grid-cols-2 gap-3 px-6 py-4 border-b border-crm-border">
                    <div className="crm-card bg-crm-bg border-crm-border/50 p-3">
                      <p className="text-[10px] text-crm-text-muted uppercase font-bold tracking-wider mb-1.5">Account Status</p>
                      <StatusBadge status={detail.accountStatus} />
                    </div>
                    <div className="crm-card bg-crm-bg border-crm-border/50 p-3">
                      <p className="text-[10px] text-crm-text-muted uppercase font-bold tracking-wider mb-1.5">Customer Type</p>
                      <TypeBadge type={detail.userType} />
                    </div>
                  </div>

                  {/* Edit form or contact info */}
                  {editMode ? (
                    <div className="px-6 py-5 space-y-4 border-b border-crm-border">
                      <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest">Edit Customer</h4>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-crm-text-dim uppercase">Full Name</label>
                          <input className="crm-input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-crm-text-dim uppercase">Email</label>
                          <input className="crm-input" type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-crm-text-dim uppercase">Phone</label>
                          <input className="crm-input" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="Optional" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-crm-text-dim uppercase">Preferred Language</label>
                            <select className="crm-input" value={editForm.preferredLang} onChange={e => setEditForm(f => ({ ...f, preferredLang: e.target.value }))}>
                              <option value="en">English</option>
                              <option value="bn">Bengali</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-crm-text-dim uppercase">Account Status</label>
                            <select className="crm-input" value={editForm.accountStatus} onChange={e => setEditForm(f => ({ ...f, accountStatus: e.target.value }))}>
                              <option value="active">Active</option>
                              <option value="deactivated">Deactivated</option>
                              <option value="suspended">Suspended</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => setEditMode(false)} className="crm-btn flex-1 text-sm"><FiX size={13} /> Cancel</button>
                        <button onClick={handleSaveEdit} disabled={saving} className="crm-btn crm-btn-primary flex-1 text-sm flex items-center justify-center gap-1.5">
                          {saving ? <><span className="animate-spin border-2 border-white/40 border-t-white rounded-full w-3 h-3" /></> : <FiSave size={13} />}
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="px-6 py-5 space-y-3 border-b border-crm-border">
                      <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest">Contact Info</h4>
                      <div className="space-y-2.5 text-sm">
                        <div className="flex items-center gap-2.5"><FiPhone className="text-crm-primary shrink-0" size={14} /><span className="text-crm-text-bright">{detail.phone || "—"}</span></div>
                        <div className="flex items-center gap-2.5"><FiMapPin className="text-crm-primary shrink-0" size={14} /><span className="text-crm-text-dim text-xs">{detail.savedAddresses?.[0] ? `${detail.savedAddresses[0].city || ""} ${detail.savedAddresses[0].country || ""}`.trim() : "No address on file"}</span></div>
                        <div className="flex items-center gap-2.5"><FiCalendar className="text-crm-primary shrink-0" size={14} /><span className="text-crm-text-dim text-xs">Joined {detail.createdAt ? format(new Date(detail.createdAt), "MMMM dd, yyyy") : "—"}</span></div>
                      </div>
                      {onOpenTimeline && detail?.id && (
                        <button type="button" className="crm-btn crm-btn-secondary w-full mt-3 text-xs h-9" onClick={() => onOpenTimeline(detail.id)}>
                          <FiArrowRight className="inline" /> View communications timeline
                        </button>
                      )}
                    </div>
                  )}

                  {/* Wholesale / Retail migration */}
                  {canManage && !editMode && (
                    <div className="px-6 py-5 border-b border-crm-border">
                      <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest mb-3">Customer Type Migration</h4>
                      {migrateConfirm ? (
                        <div className="bg-crm-bg p-3 rounded-xl border border-crm-border space-y-3">
                          <p className="text-sm text-crm-text-bright">
                            Migrate to <strong>{migrateConfirm === "wholesale" ? "Wholesale" : "Retail"}</strong>? This changes their pricing tier across the platform.
                          </p>
                          <div className="flex gap-2">
                            <button onClick={() => setMigrateConfirm(null)} className="crm-btn flex-1 text-xs">Cancel</button>
                            <button onClick={() => handleMigrate(migrateConfirm)} disabled={saving}
                              className={`crm-btn flex-1 text-xs ${migrateConfirm === "wholesale" ? "crm-btn-primary" : "border-crm-danger/40 text-crm-danger hover:bg-crm-danger-dim"}`}>
                              Confirm Migration
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          {detail.userType !== "wholesale" && (
                            <button onClick={() => setMigrateConfirm("wholesale")}
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-purple-500/40 text-purple-400 hover:bg-purple-500/10 transition-colors">
                              <FiBriefcase size={13} /> Upgrade to Wholesale
                            </button>
                          )}
                          {detail.userType === "wholesale" && (
                            <button onClick={() => setMigrateConfirm("retail")}
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-crm-border text-crm-text-dim hover:bg-crm-bg-hover transition-colors">
                              <FiUserX size={13} /> Move to Retail
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Status actions */}
                  {canManage && !editMode && (
                    <div className="px-6 py-4 border-b border-crm-border">
                      <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest mb-3">Account Actions</h4>
                      <div className="flex flex-wrap gap-2">
                        {detail.accountStatus !== "active" && (
                          <button onClick={() => handleChangeStatus("active")} disabled={saving}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-crm-success/40 text-crm-success hover:bg-crm-success/10 transition-colors">
                            <FiUserCheck size={12} /> Activate
                          </button>
                        )}
                        {detail.accountStatus === "active" && (
                          <button onClick={() => handleChangeStatus("deactivated")} disabled={saving}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-crm-warning/40 text-crm-warning hover:bg-crm-warning/10 transition-colors">
                            <FiUserX size={12} /> Deactivate
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Order history */}
                  <div className="px-6 py-5 border-b border-crm-border">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest">Order History</h4>
                      <span className="crm-badge">{orders.length} orders</span>
                    </div>
                    {orders.length === 0 ? (
                      <div className="flex items-center gap-2 py-4 text-sm text-crm-text-dim">
                        <FiShoppingBag size={16} className="shrink-0" />No orders yet
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {orders.slice(0, 6).map(o => (
                          <div key={o.id} className="flex items-center justify-between p-2.5 rounded-lg bg-crm-bg border border-crm-border/50 hover:border-crm-border transition-colors">
                            <div>
                              <p className="text-xs font-bold text-crm-primary">#{(o.id || "").slice(-8).toUpperCase()}</p>
                              <p className="text-[10px] text-crm-text-dim">{o.createdAt ? format(new Date(o.createdAt), "MMM dd, yyyy") : "—"}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-crm-text-bright">৳{Number(o.total || 0).toLocaleString()}</p>
                              <span className="text-[10px] uppercase font-bold text-crm-success">{o.status}</span>
                            </div>
                          </div>
                        ))}
                        {orders.length > 6 && <p className="text-xs text-crm-text-dim text-center pt-1">+{orders.length - 6} more orders</p>}
                      </div>
                    )}
                  </div>

                  {/* Bottom actions */}
                  {canManage && (
                    <div className="px-6 py-5 space-y-3">
                      {!editMode && !deleteConfirm && (
                        <div className="flex gap-2">
                          <button onClick={() => setEditMode(true)} className="crm-btn flex-1 flex items-center justify-center gap-2 text-sm">
                            <FiEdit2 size={14} /> Edit Profile
                          </button>
                          <button onClick={() => setDeleteConfirm(true)} className="crm-btn flex items-center justify-center gap-2 text-sm border-crm-danger/30 text-crm-danger hover:bg-crm-danger-dim px-4">
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      )}
                      {deleteConfirm && (
                        <div className="bg-crm-danger-dim border border-crm-danger/30 rounded-xl p-4 space-y-3">
                          <div className="flex items-start gap-2">
                            <FiAlertCircle className="text-crm-danger shrink-0 mt-0.5" size={16} />
                            <p className="text-sm text-crm-text-bright">This will suspend the customer's account. They won't be able to log in or place orders.</p>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setDeleteConfirm(false)} className="crm-btn flex-1 text-sm">Cancel</button>
                            <button onClick={handleDelete} disabled={saving} className="crm-btn flex-1 text-sm border-crm-danger/40 text-crm-danger hover:bg-crm-danger-dim flex items-center justify-center gap-1.5">
                              <FiTrash2 size={13} /> Suspend Account
                            </button>
                          </div>
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
