import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FiTruck, FiPlus, FiFilter, FiSearch, FiPackage, FiCheckCircle, FiClock, FiAlertCircle, FiRefreshCw, FiX, FiChevronDown, FiTrash2, FiEdit } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import { format } from "date-fns";

const STATUS_CONFIG = {
  pending: { label: "Pending", cls: "text-crm-text-dim bg-crm-bg-hover" },
  picked_up: { label: "Picked Up", cls: "text-crm-primary bg-crm-primary-dim" },
  in_transit: { label: "In Transit", cls: "text-crm-warning bg-crm-warning-dim" },
  out_for_delivery: { label: "Out for Delivery", cls: "text-crm-primary bg-crm-primary-dim" },
  delivered: { label: "Delivered", cls: "text-crm-success bg-crm-success-dim" },
  returned: { label: "Returned", cls: "text-crm-danger bg-crm-danger-dim" },
};

const CARRIER_COLORS = {
  redx: "#e53935",
  pathao: "#00B853",
  manual: "var(--crm-text-muted)",
};

const ALL_STATUSES = ["pending", "picked_up", "in_transit", "out_for_delivery", "delivered", "returned"];

export default function DeliveryPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [carrierFilter, setCarrierFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ orderId: "", carrier: "redx", trackingNumber: "" });
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);

  const loadShipments = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const data = await adminApi.shipments(params);
      setShipments(Array.isArray(data) ? data : data?.shipments || []);
    } catch (err) {
      toast.error("Failed to load shipments");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => { loadShipments(); }, [loadShipments]);

  const filtered = useMemo(() => {
    let list = shipments;
    if (carrierFilter) list = list.filter(s => s.carrier?.toLowerCase() === carrierFilter.toLowerCase());
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.trackingNumber?.toLowerCase().includes(q) ||
        s.orderId?.toLowerCase().includes(q) ||
        s.carrier?.toLowerCase().includes(q) ||
        s.id?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [shipments, carrierFilter, search]);

  const stats = useMemo(() => {
    const total = shipments.length;
    const inTransit = shipments.filter(s => s.status === "in_transit" || s.status === "out_for_delivery").length;
    const delivered = shipments.filter(s => s.status === "delivered").length;
    const returned = shipments.filter(s => s.status === "returned").length;
    return { total, inTransit, delivered, returned };
  }, [shipments]);

  const handleCreate = async () => {
    if (!form.orderId.trim() || !form.trackingNumber.trim()) {
      toast.error("Order ID and tracking number required");
      return;
    }
    setCreating(true);
    try {
      await adminApi.createShipment({
        orderId: form.orderId.trim(),
        carrier: form.carrier,
        trackingNumber: form.trackingNumber.trim(),
        status: "pending",
      });
      toast.success("Shipment created");
      setShowCreate(false);
      setForm({ orderId: "", carrier: "redx", trackingNumber: "" });
      loadShipments();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await adminApi.updateShipmentStatus(id, { status: newStatus });
      toast.success("Status updated");
      loadShipments();
    } catch {
      toast.error("Status update failed");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this shipment?")) return;
    try {
      await adminApi.deleteShipment(id);
      toast.success("Shipment deleted");
      loadShipments();
    } catch {
      toast.error("Delete failed");
    }
  };

  const getStatusBadge = (status) => {
    const cfg = STATUS_CONFIG[status] || { label: status, cls: "" };
    return <span className={`crm-badge ${cfg.cls}`}>{cfg.label}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-primary-dim text-crm-primary"><FiTruck size={24} /></div>
          <div>
            <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Delivery & Fulfillment</h2>
            <p className="text-crm-text-dim text-sm">Track shipments — RedX, Pathao, Manual</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="crm-btn" onClick={loadShipments}><FiRefreshCw /> Refresh</button>
          <button className="crm-btn crm-btn-primary" onClick={() => setShowCreate(true)}><FiPlus /> New Shipment</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total, icon: FiPackage, color: "text-crm-primary" },
          { label: "In Transit", value: stats.inTransit, icon: FiTruck, color: "text-crm-warning" },
          { label: "Delivered", value: stats.delivered, icon: FiCheckCircle, color: "text-crm-success" },
          { label: "Returned", value: stats.returned, icon: FiAlertCircle, color: "text-crm-danger" },
        ].map((stat, i) => (
          <div key={i} className="crm-card flex items-center gap-4">
            <div className={`p-2.5 rounded-lg bg-crm-bg-hover ${stat.color}`}><stat.icon size={20} /></div>
            <div>
              <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider">{stat.label}</p>
              <p className="text-xl font-bold text-crm-text-bright tabular-nums">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="crm-card flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
          <input type="text" placeholder="Search tracking, order ID..." className="crm-input pl-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="crm-input w-auto min-w-[130px]" value={carrierFilter} onChange={e => setCarrierFilter(e.target.value)}>
          <option value="">All Couriers</option>
          <option value="pathao">Pathao</option>
          <option value="redx">RedX</option>
          <option value="manual">Manual</option>
        </select>
        <select className="crm-input w-auto min-w-[130px]" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="crm-table-container">
        {loading ? (
          <div className="p-20 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-crm-text-dim"><FiPackage size={40} className="mx-auto mb-4 opacity-20" /><p>No shipments found</p></div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Tracking #</th>
                <th>Order</th>
                <th>Courier</th>
                <th>Status</th>
                <th>ETA</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td className="font-mono text-xs text-crm-primary">{s.trackingNumber || "—"}</td>
                  <td className="font-bold text-crm-text-bright">#{(s.orderId || "").slice(-8).toUpperCase()}</td>
                  <td>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CARRIER_COLORS[s.carrier?.toLowerCase()] || "var(--crm-text-muted)" }} />
                      {s.carrier}
                    </span>
                  </td>
                  <td>{getStatusBadge(s.status)}</td>
                  <td className="text-crm-text-dim text-xs">{s.estimatedDelivery || "—"}</td>
                  <td className="text-crm-text-dim text-xs">{s.createdAt ? format(new Date(s.createdAt), "MMM dd, HH:mm") : "—"}</td>
                  <td className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <select
                        className="crm-input w-auto text-xs py-1 px-2 h-7"
                        value={s.status}
                        onChange={e => handleStatusChange(s.id, e.target.value)}
                      >
                        {ALL_STATUSES.map(st => <option key={st} value={st}>{STATUS_CONFIG[st]?.label}</option>)}
                      </select>
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 text-crm-text-muted hover:text-crm-danger rounded transition-colors" title="Delete"><FiTrash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Shipment Modal */}
      <AnimatePresence>
        {showCreate && (
          <div className="modal-overlay" onClick={() => setShowCreate(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="modal-card" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header"><h3>Create Shipment</h3><button onClick={() => setShowCreate(false)} className="text-crm-text-dim hover:text-crm-text-bright"><FiX /></button></div>
              <div className="modal-body space-y-4">
                <div className="field"><label className="field-label">Order ID</label><input className="crm-input" placeholder="e.g. abc12345" value={form.orderId} onChange={e => setForm(f => ({ ...f, orderId: e.target.value }))} /></div>
                <div className="field"><label className="field-label">Courier</label>
                  <select className="crm-input" value={form.carrier} onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))}>
                    <option value="redx">RedX</option>
                    <option value="pathao">Pathao</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
                <div className="field"><label className="field-label">Tracking Number</label><input className="crm-input" placeholder="Courier tracking #" value={form.trackingNumber} onChange={e => setForm(f => ({ ...f, trackingNumber: e.target.value }))} /></div>
              </div>
              <div className="modal-footer">
                <button className="crm-btn" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="crm-btn crm-btn-primary" onClick={handleCreate} disabled={creating}>{creating ? "Creating…" : "Create"}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
