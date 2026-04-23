import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FiTag, FiSearch, FiFilter, FiPlus, FiTrendingUp, FiCheckCircle, FiXCircle, FiMoreVertical, FiCalendar, FiArrowRight, FiX, FiTrash2 } from "react-icons/fi";
import { hasPermission } from "../auth/permissionMatrix";
import { getAdminUser } from "../lib/auth";
import { couponService } from "../services/couponService";
import { useToast } from "../components/ToastProvider";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

export default function CouponsPage() {
  const toast = useToast();
  const adminRole = useMemo(() => String(getAdminUser()?.role || "STAFF").toUpperCase(), []);
  const canEdit = hasPermission(adminRole, "coupons", "edit");
  
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ code: "", type: "percent", value: "", minOrder: "", maxUses: "", startsAt: new Date().toISOString().slice(0, 16), expiresAt: "" });
  const [creating, setCreating] = useState(false);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const res = await couponService.list();
      setCoupons(Array.isArray(res) ? res : res?.coupons || res?.items || []);
    } catch (err) {
      toast.error("Failed to fetch coupons");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  const filteredCoupons = useMemo(() => {
    return coupons.filter(c => {
      const matchesTab = activeTab === "all" || (activeTab === "active" ? c.active : !c.active);
      const matchesSearch = !search || 
        `${c.code} ${c.name}`.toLowerCase().includes(search.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [coupons, activeTab, search]);

  const toggleActive = async (id, currentStatus) => {
    if (!canEdit) return;
    try {
      await couponService.update(id, { active: !currentStatus });
      setCoupons(prev => prev.map(c => c.id === id ? { ...c, active: !currentStatus } : c));
      toast.success(currentStatus ? "Coupon deactivated" : "Coupon activated");
    } catch (err) {
      toast.error("Status update failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-primary-dim text-crm-primary">
            <FiTag size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Coupons & Promotions</h2>
            <p className="text-crm-text-dim text-sm">Manage discount codes and marketing offers</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button className="crm-btn crm-btn-primary" onClick={() => setShowCreate(true)}>
              <FiPlus /> New Coupon
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Active Coupons", count: coupons.filter(c => c.active).length, icon: FiCheckCircle, color: "text-crm-success" },
          { label: "Total Usage", count: coupons.reduce((s, c) => s + (c.usedCount || c.usageCount || 0), 0), icon: FiTrendingUp, color: "text-crm-primary" },
          { label: "Total Campaigns", count: coupons.length, icon: FiTag, color: "text-crm-purple" },
        ].map((stat, i) => (
          <div key={i} className="crm-card flex items-center gap-4">
            <div className={`p-3 rounded-lg bg-crm-bg-hover ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider">{stat.label}</p>
              <p className="text-2xl font-bold text-crm-text-bright">{stat.count}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="crm-card p-0 overflow-hidden border-b-0 rounded-b-none flex flex-wrap">
        {["all", "active", "inactive"].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 border-b-2 transition-all font-medium text-sm capitalize ${
              activeTab === tab 
                ? "border-crm-primary text-crm-primary bg-crm-primary-dim" 
                : "border-transparent text-crm-text-dim hover:text-crm-text-bright"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="crm-card flex flex-wrap items-center gap-4 rounded-t-none border-t-0">
        <div className="relative flex-1 min-w-[240px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
          <input 
            type="text" 
            placeholder="Search code or campaign name..." 
            className="crm-input pl-10" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="crm-btn" onClick={fetchCoupons}>
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
                <th>Code</th>
                <th>Campaign</th>
                <th>Discount</th>
                <th>Min. Order</th>
                <th>Usage</th>
                <th>Status</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredCoupons.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-crm-text-dim">No coupons found</td>
                </tr>
              ) : (
                filteredCoupons.map((c) => (
                  <tr key={c.id} className="group">
                    <td>
                      <span className="font-mono text-xs font-bold text-crm-primary bg-crm-primary-dim px-2 py-1 rounded border border-crm-primary/20 uppercase">
                        {c.code}
                      </span>
                    </td>
                    <td>
                      <p className="font-medium text-crm-text-bright">{c.name || "Untitled Campaign"}</p>
                    </td>
                    <td>
                      <span className="font-bold text-crm-success">
                        {(c.type === "percentage" || c.type === "percent") ? `${c.value}%` : c.type === "free_shipping" ? "Free Shipping" : `৳${c.value}`}
                      </span>
                      <span className="text-[10px] text-crm-text-dim ml-1 uppercase">OFF</span>
                    </td>
                    <td className="text-xs text-crm-text-dim">৳{c.minOrder || c.minimumOrderAmount || 0}</td>
                    <td>
                      <div className="flex flex-col gap-1">
                        <div className="text-xs text-crm-text-bright font-bold">{c.usedCount || c.usageCount || 0} <span className="text-crm-text-dim font-normal">uses</span></div>
                        {(c.maxUses || c.usageLimit) && (
                          <div className="w-24 h-1 bg-crm-bg-hover rounded-full overflow-hidden">
                            <div className="h-full bg-crm-primary" style={{ width: `${Math.min(100, ((c.usedCount || c.usageCount || 0) / (c.maxUses || c.usageLimit)) * 100)}%` }} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleActive(c.id, c.active); }}
                        className={`crm-badge border transition-colors ${
                          c.active ? "crm-badge-success" : "text-crm-text-dim border-crm-border"
                        }`}
                        disabled={!canEdit}
                      >
                        {c.active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="text-xs text-crm-text-dim whitespace-nowrap">
                      {(c.expiresAt || c.endDate) ? format(new Date(c.expiresAt || c.endDate), "MMM dd, yyyy") : "Never"}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        {canEdit && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                            className="p-1.5 rounded hover:bg-red-500/10 text-crm-text-dim hover:text-red-400 transition-colors"
                            title="Delete coupon"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
      {/* Create Coupon Modal */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="crm-card w-full max-w-lg mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-crm-text-bright">Create New Coupon</h3>
                <button onClick={() => setShowCreate(false)} className="p-1.5 rounded hover:bg-crm-bg-hover text-crm-text-dim"><FiX size={18} /></button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-crm-text-dim uppercase mb-1">Code *</label>
                    <input className="crm-input uppercase" placeholder="e.g. SUMMER25" value={createForm.code} onChange={(e) => setCreateForm(p => ({ ...p, code: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-crm-text-dim uppercase mb-1">Type *</label>
                    <select className="crm-input" value={createForm.type} onChange={(e) => setCreateForm(p => ({ ...p, type: e.target.value }))}>
                      <option value="percent">Percentage</option>
                      <option value="fixed">Fixed Amount (৳)</option>
                      <option value="free_shipping">Free Shipping</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-crm-text-dim uppercase mb-1">Value *</label>
                    <input type="number" className="crm-input" placeholder={createForm.type === 'percent' ? 'e.g. 15' : 'e.g. 200'} value={createForm.value} onChange={(e) => setCreateForm(p => ({ ...p, value: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-crm-text-dim uppercase mb-1">Min Order (৳)</label>
                    <input type="number" className="crm-input" placeholder="0" value={createForm.minOrder} onChange={(e) => setCreateForm(p => ({ ...p, minOrder: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-crm-text-dim uppercase mb-1">Max Uses</label>
                    <input type="number" className="crm-input" placeholder="Unlimited" value={createForm.maxUses} onChange={(e) => setCreateForm(p => ({ ...p, maxUses: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-crm-text-dim uppercase mb-1">Starts At *</label>
                    <input type="datetime-local" className="crm-input" value={createForm.startsAt} onChange={(e) => setCreateForm(p => ({ ...p, startsAt: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-crm-text-dim uppercase mb-1">Expires At</label>
                  <input type="datetime-local" className="crm-input" value={createForm.expiresAt} onChange={(e) => setCreateForm(p => ({ ...p, expiresAt: e.target.value }))} />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button className="crm-btn" onClick={() => setShowCreate(false)}>Cancel</button>
                  <button className="crm-btn crm-btn-primary" disabled={creating || !createForm.code || !createForm.value || !createForm.startsAt} onClick={handleCreate}>
                    {creating ? "Creating..." : "Create Coupon"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  async function handleCreate() {
    setCreating(true);
    try {
      const payload = {
        code: createForm.code.trim(),
        type: createForm.type,
        value: Number(createForm.value),
        startsAt: new Date(createForm.startsAt).toISOString(),
        ...(createForm.minOrder ? { minOrder: Number(createForm.minOrder) } : {}),
        ...(createForm.maxUses ? { maxUses: Number(createForm.maxUses) } : {}),
        ...(createForm.expiresAt ? { expiresAt: new Date(createForm.expiresAt).toISOString() } : {}),
      };
      await couponService.create(payload);
      toast.success("Coupon created!");
      setShowCreate(false);
      setCreateForm({ code: "", type: "percent", value: "", minOrder: "", maxUses: "", startsAt: new Date().toISOString().slice(0, 16), expiresAt: "" });
      fetchCoupons();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to create coupon");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Deactivate this coupon?")) return;
    try {
      await couponService.update(id, { active: false });
      setCoupons(prev => prev.map(c => c.id === id ? { ...c, active: false } : c));
      toast.success("Coupon deactivated");
    } catch {
      toast.error("Failed to deactivate");
    }
  }
}
