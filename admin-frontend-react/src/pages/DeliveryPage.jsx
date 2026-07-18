import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FiTruck, FiPlus, FiSearch, FiPackage, FiCheckCircle, FiAlertCircle, FiRefreshCw, FiX, FiExternalLink } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import OrderSnapshot from "../components/OrderSnapshot";
import CourierBookingModal from "../components/CourierBookingModal";
import { format } from "date-fns";

/** courier_shipments.internal_status values (snake_case, from the courier module). */
const STATUS_CONFIG = {
  pending: { label: "Pending", cls: "text-crm-text-dim bg-crm-bg-hover" },
  pending_pickup: { label: "Pending Pickup", cls: "text-crm-text-dim bg-crm-bg-hover" },
  picked_up: { label: "Picked Up", cls: "text-crm-primary bg-crm-primary-dim" },
  in_transit: { label: "In Transit", cls: "text-crm-warning bg-crm-warning-dim" },
  out_for_delivery: { label: "Out for Delivery", cls: "text-crm-primary bg-crm-primary-dim" },
  delivered: { label: "Delivered", cls: "text-crm-success bg-crm-success-dim" },
  returned: { label: "Returned", cls: "text-crm-danger bg-crm-danger-dim" },
  cancelled: { label: "Cancelled", cls: "text-crm-danger bg-crm-danger-dim" },
};

const CARRIER_COLORS = {
  redx: "#e53935",
  pathao: "#00B853",
  steadfast: "#2f6fed",
  paperfly: "#f5a623",
  manual: "var(--crm-text-muted)",
};

const ALL_STATUSES = ["pending_pickup", "picked_up", "in_transit", "out_for_delivery", "delivered", "returned", "cancelled"];

export default function DeliveryPage({ onOpenOrder, onOpenCustomer }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [carrierFilter, setCarrierFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadShipments = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (carrierFilter) params.courier = carrierFilter;
      if (search.trim()) params.search = search.trim();
      const data = await adminApi.deliveries(params);
      setShipments(Array.isArray(data) ? data : data?.shipments || []);
    } catch (err) {
      toast.error("Failed to load shipments");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, carrierFilter, search, toast]);

  useEffect(() => { loadShipments(); }, [loadShipments]);

  const filtered = shipments;

  const stats = useMemo(() => {
    const total = shipments.length;
    const inTransit = shipments.filter(s => s.internal_status === "in_transit" || s.internal_status === "out_for_delivery" || s.internal_status === "picked_up").length;
    const delivered = shipments.filter(s => s.internal_status === "delivered").length;
    const returned = shipments.filter(s => s.internal_status === "returned").length;
    return { total, inTransit, delivered, returned };
  }, [shipments]);

  const openDetail = async (id) => {
    setDetailId(id);
    setDetailLoading(true);
    try {
      const res = await adminApi.deliveryDetail(id);
      setDetail(res);
    } catch {
      toast.error("Failed to load shipment details");
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshTracking = async (orderId) => {
    setBusy(true);
    try {
      await adminApi.trackDelivery(orderId);
      toast.success("Tracking refreshed");
      loadShipments();
      if (detailId) openDetail(detailId);
    } catch {
      toast.error("Failed to refresh tracking");
    } finally {
      setBusy(false);
    }
  };

  const cancelShipment = async (orderId) => {
    if (!window.confirm("Cancel this courier shipment?")) return;
    setBusy(true);
    try {
      await adminApi.cancelDelivery(orderId);
      toast.success("Shipment cancelled");
      loadShipments();
      if (detailId) openDetail(detailId);
    } catch {
      toast.error("Cancel failed");
    } finally {
      setBusy(false);
    }
  };

  const getStatusBadge = (status) => {
    const cfg = STATUS_CONFIG[status] || { label: status || "—", cls: "" };
    return <span className={`crm-badge ${cfg.cls}`}>{cfg.label}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-primary-dim text-crm-primary"><FiTruck size={24} /></div>
          <div>
            <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Delivery & Fulfillment</h2>
            <p className="text-crm-text-dim text-sm">Track courier shipments — Pathao, Steadfast, Paperfly, RedX, Manual</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="crm-btn" onClick={loadShipments}><FiRefreshCw /> Refresh</button>
          <button className="crm-btn crm-btn-primary" onClick={() => setShowCreate(true)}><FiPlus /> Book Courier</button>
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
          <input type="text" placeholder="Search tracking, order ID, recipient..." className="crm-input pl-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="crm-input w-auto min-w-[130px]" value={carrierFilter} onChange={e => setCarrierFilter(e.target.value)}>
          <option value="">All Couriers</option>
          <option value="pathao">Pathao</option>
          <option value="steadfast">Steadfast</option>
          <option value="paperfly">Paperfly</option>
          <option value="redx">RedX</option>
          <option value="manual">Manual</option>
        </select>
        <select className="crm-input w-auto min-w-[150px]" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
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
                <th>Recipient</th>
                <th>Courier</th>
                <th>Status</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="cursor-pointer" onClick={() => openDetail(s.id)}>
                  <td className="font-mono text-xs text-crm-primary">{s.tracking_code || s.consignment_id || "—"}</td>
                  <td>
                    <button
                      type="button"
                      className="font-bold text-crm-primary hover:underline"
                      onClick={(e) => { e.stopPropagation(); onOpenOrder?.(s.order_id); }}
                    >
                      #{(s.order_id || "").slice(-8).toUpperCase()}
                    </button>
                  </td>
                  <td className="text-xs text-crm-text-dim">{s.recipient_name || "—"}</td>
                  <td>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold capitalize">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CARRIER_COLORS[s.courier_provider?.toLowerCase()] || "var(--crm-text-muted)" }} />
                      {s.courier_provider}
                    </span>
                  </td>
                  <td>{getStatusBadge(s.internal_status)}</td>
                  <td className="text-crm-text-dim text-xs">{s.created_at ? format(new Date(s.created_at), "MMM dd, HH:mm") : "—"}</td>
                  <td className="text-right" onClick={e => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => refreshTracking(s.order_id)} disabled={busy} className="p-1.5 text-crm-text-muted hover:text-crm-primary rounded transition-colors" title="Refresh tracking"><FiRefreshCw size={14} /></button>
                      <button onClick={() => cancelShipment(s.order_id)} disabled={busy} className="p-1.5 text-crm-text-muted hover:text-crm-danger rounded transition-colors" title="Cancel"><FiX size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Book Courier Modal */}
      <AnimatePresence>
        {showCreate && (
          <CourierBookingModal
            onClose={() => setShowCreate(false)}
            onBooked={loadShipments}
          />
        )}
      </AnimatePresence>

      {/* Shipment Detail Drawer */}
      <AnimatePresence>
        {detailId && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50" onClick={() => setDetailId(null)} />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-crm-bg-card border-l border-crm-border z-50 flex flex-col overflow-hidden shadow-2xl"
            >
              {detailLoading ? (
                <div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary" /></div>
              ) : detail ? (
                <>
                  <div className="p-5 border-b border-crm-border flex items-center justify-between bg-crm-bg-alt/50">
                    <div>
                      <h3 className="font-bold text-crm-text-bright">Shipment Detail</h3>
                      <p className="text-xs text-crm-text-dim font-mono">{detail.shipment?.tracking_code || detail.shipment?.consignment_id || detail.shipment?.id}</p>
                    </div>
                    <button onClick={() => setDetailId(null)} className="p-2 hover:bg-crm-bg-hover rounded-lg text-crm-text-dim"><FiX size={20} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                    <div className="crm-card space-y-2">
                      <div className="flex justify-between text-sm"><span className="text-crm-text-dim">Courier</span><span className="font-bold capitalize text-crm-text-bright">{detail.shipment?.courier_provider}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-crm-text-dim">Status</span>{getStatusBadge(detail.shipment?.internal_status)}</div>
                      {detail.shipment?.recipient_name && <div className="flex justify-between text-sm"><span className="text-crm-text-dim">Recipient</span><span className="text-crm-text-bright">{detail.shipment.recipient_name}</span></div>}
                      {detail.shipment?.recipient_phone && <div className="flex justify-between text-sm"><span className="text-crm-text-dim">Phone</span><span className="text-crm-text-bright">{detail.shipment.recipient_phone}</span></div>}
                      {detail.shipment?.delivery_fee != null && <div className="flex justify-between text-sm"><span className="text-crm-text-dim">Delivery Fee</span><span className="text-crm-text-bright">৳{Number(detail.shipment.delivery_fee).toLocaleString()}</span></div>}
                    </div>

                    {detail.order && (
                      <button
                        type="button"
                        className="crm-btn w-full"
                        onClick={() => onOpenOrder?.(detail.order.id)}
                      >
                        <FiExternalLink /> Open full order
                      </button>
                    )}

                    {detail.order && (
                      <OrderSnapshot
                        order={detail.order}
                        onOpenCustomer={onOpenCustomer}
                        onOpenOrder={onOpenOrder}
                        showPayments={false}
                        compact
                      />
                    )}
                  </div>
                  <div className="p-4 border-t border-crm-border flex items-center gap-2 bg-crm-bg-alt/50">
                    <button className="crm-btn flex-1" disabled={busy} onClick={() => refreshTracking(detail.shipment?.order_id)}><FiRefreshCw /> Refresh</button>
                    <button className="crm-btn border-crm-danger/30 text-crm-danger hover:bg-crm-danger-dim flex-1" disabled={busy} onClick={() => cancelShipment(detail.shipment?.order_id)}><FiX /> Cancel</button>
                  </div>
                </>
              ) : null}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
