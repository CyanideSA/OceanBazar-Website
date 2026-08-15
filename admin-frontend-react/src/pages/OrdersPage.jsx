import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiSearch, FiTruck, FiDownload, FiRefreshCw, FiPackage, FiDollarSign,
  FiClock, FiX, FiBox, FiCheckSquare
} from "react-icons/fi";
import { adminApi } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import OrderSnapshot from "../components/OrderSnapshot";
import CourierBookingModal from "../components/CourierBookingModal";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

/** Lowercase — matches BFF / Prisma order.status */
const STATUS_CONFIG = {
  pending:    { label: "Pending",    cls: "text-crm-warning bg-crm-warning-dim border-crm-warning/20" },
  confirmed:  { label: "Confirmed",  cls: "text-crm-primary bg-crm-primary-dim border-crm-primary/20" },
  processing: { label: "Processing", cls: "text-crm-primary bg-crm-primary-dim border-crm-primary/20" },
  shipped:    { label: "Shipped",    cls: "text-crm-purple bg-crm-purple-dim border-crm-purple/20" },
  delivered:  { label: "Delivered",  cls: "text-crm-success bg-crm-success-dim border-crm-success/20" },
  cancelled:  { label: "Cancelled",  cls: "text-crm-danger bg-crm-danger-dim border-crm-danger/20" },
  returned:   { label: "Returned",   cls: "text-crm-danger bg-crm-danger-dim border-crm-danger/20" },
};

const ORDER_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "returned"];

/** Align CRM display with BFF/Prisma enums (lowercase snake_case). */
function normalizePaymentStatus(raw) {
  const s = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if (!s) return "unpaid";
  return s;
}

function paymentIsPaid(raw) {
  const n = normalizePaymentStatus(raw);
  return n === "paid" || n === "completed" || n === "captured";
}

function paymentStatusLabel(raw, order) {
  const n = normalizePaymentStatus(raw);
  const delivery = String(order?.deliveryPaymentStatus || order?.delivery_payment_status || "").toLowerCase();
  const method = String(order?.paymentMethod || order?.payment_method || "").toLowerCase();
  if ((method === "cod" || n === "unpaid") && delivery === "under_verification") {
    return "Unpaid · Delivery under verification";
  }
  if ((method === "cod" || n === "unpaid") && delivery === "paid") {
    return "Unpaid · Delivery paid";
  }
  const labels = {
    unpaid: "Unpaid",
    paid: "Paid",
    pending: "Pending",
    under_verification: "Paid · Under Verification",
    pending_verification: "Paid · Under Verification",
    failed: "Failed",
    refunded: "Refunded",
    partially_refunded: "Partially refunded",
    authorized: "Authorized",
    processing: "Processing",
  };
  return labels[n] || (raw ? String(raw) : "Unpaid");
}

export default function OrdersPage({ initialSearch = "", liveTick = 0, onOpenCustomer, onOpenProduct }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showCourierModal, setShowCourierModal] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.orders({ status: statusFilter === "ALL" ? undefined : statusFilter });
      setRows(res?.orders || []);
    } catch (err) {
      toast.error("Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => { fetchOrders(); }, [fetchOrders, liveTick]);

  useEffect(() => {
    if (initialSearch) setSearchTerm(initialSearch);
  }, [initialSearch]);

  const stats = useMemo(() => ({
    total: rows.length,
    pending: rows.filter(o => o.status === "pending").length,
    processing: rows.filter(o => o.status === "processing" || o.status === "shipped").length,
    delivered: rows.filter(o => o.status === "delivered").length,
    revenue: rows.reduce((s, o) => s + (Number(o.total) || 0), 0),
  }), [rows]);

  const filteredOrders = useMemo(() => {
    if (!searchTerm) return rows;
    const q = searchTerm.toLowerCase();
    return rows.filter((o) => {
      const custName = o.customer?.name || o.user?.name;
      const custEmail = o.customer?.email || o.user?.email;
      return (
        o.id?.toLowerCase().includes(q) ||
        o.orderNumber?.toLowerCase().includes(q) ||
        custName?.toLowerCase().includes(q) ||
        custEmail?.toLowerCase().includes(q) ||
        o.trackingNumber?.toLowerCase().includes(q)
      );
    });
  }, [rows, searchTerm]);

  const openDetail = async (orderId) => {
    setDetailLoading(true);
    try {
      const res = await adminApi.orderDetail(orderId);
      setDetailOrder(res);
    } catch {
      toast.error("Failed to load order details");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    let id = initialSearch;
    try {
      const fromSs = sessionStorage.getItem("oceanbazar_order_detail");
      if (fromSs) {
        sessionStorage.removeItem("oceanbazar_order_detail");
        id = fromSs;
        setSearchTerm(fromSs);
      }
    } catch { /* ignore */ }
    if (id && String(id).length >= 6) {
      openDetail(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSearch]);

  const downloadCSV = (filename, headers, rows) => {
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  /* CSV includes customer PII — only export from trusted machines; downloads are client-side blobs (no extra BFF endpoint). */
  const exportOrders = () => {
    downloadCSV('orders', ['Order ID', 'Customer', 'Email', 'Status', 'Payment', 'Total (BDT)', 'Date'],
      filteredOrders.map(o => [
        o.orderNumber || o.id,
        o.user?.name || o.customer?.name || 'Guest',
        o.user?.email || o.customer?.email || '',
        o.status,
        paymentStatusLabel(o.paymentStatus, o),
        Number(o.total || 0).toFixed(2),
        o.createdAt ? format(new Date(o.createdAt), 'yyyy-MM-dd HH:mm') : '',
      ])
    );
    toast.success(`Exported ${filteredOrders.length} orders`);
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await adminApi.updateOrderStatus(orderId, { status: newStatus });
      toast.success(`Order updated to ${newStatus}`);
      fetchOrders();
      if (detailOrder?.order?.id === orderId) openDetail(orderId);
    } catch {
      toast.error("Status update failed");
    }
  };

  const currentOrder = detailOrder?.order || null;

  const handlePrepare = async () => {
    if (!currentOrder) return;
    setActionBusy(true);
    try {
      await adminApi.updateOrderStatus(currentOrder.id, { status: "processing", note: "Order is being prepared" });
      toast.success("Marked as preparing");
      openDetail(currentOrder.id);
      fetchOrders();
    } catch {
      toast.error("Failed to update order");
    } finally {
      setActionBusy(false);
    }
  };

  const handlePacked = async () => {
    if (!currentOrder) return;
    setActionBusy(true);
    try {
      await adminApi.updateOrderStatus(currentOrder.id, { status: "processing", note: "Packed — ready for courier pickup" });
      toast.success("Marked as packed");
      openDetail(currentOrder.id);
      fetchOrders();
    } catch {
      toast.error("Failed to update order");
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-primary-dim text-crm-primary"><FiPackage size={24} /></div>
          <div>
            <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Orders</h2>
            <p className="text-crm-text-dim text-sm">Manage orders, fulfillment & payments</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="crm-btn" onClick={fetchOrders}><FiRefreshCw /> Refresh</button>
          <button
            type="button"
            className="crm-btn"
            onClick={exportOrders}
            aria-label="Export orders as CSV"
          >
            <FiDownload /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Orders", value: stats.total, icon: FiPackage, color: "text-crm-primary" },
          { label: "Pending", value: stats.pending, icon: FiClock, color: "text-crm-warning" },
          { label: "In Progress", value: stats.processing, icon: FiTruck, color: "text-crm-purple" },
          { label: "Revenue", value: `৳${stats.revenue.toLocaleString()}`, icon: FiDollarSign, color: "text-crm-success" },
        ].map((s, i) => (
          <div key={i} className="crm-card flex items-center gap-3">
            <div className={`p-2.5 rounded-lg bg-crm-bg-hover ${s.color}`}><s.icon size={18} /></div>
            <div>
              <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider">{s.label}</p>
              <p className="text-lg font-bold text-crm-text-bright tabular-nums">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="crm-card flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
          <input type="text" placeholder="Search order ID, customer, tracking..." className="crm-input pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <select className="crm-input w-auto min-w-[140px]" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="ALL">All Status</option>
          {ORDER_STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="crm-table-container overflow-x-auto">
        {loading ? (
          <div className="p-20 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary" /></div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-crm-text-dim"><FiPackage size={40} className="mx-auto mb-4 opacity-20" /><p>No orders found</p></div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Total</th>
                <th>Date</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => {
                const cfg = STATUS_CONFIG[order.status] || {};
                return (
                  <tr key={order.id} className="group cursor-pointer" onClick={() => openDetail(order.id)}>
                    <td>
                      <span className="font-mono text-xs font-bold text-crm-primary bg-crm-primary-dim px-2 py-1 rounded">
                        #{(order.orderNumber || order.id.slice(-8)).toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <p className="font-medium text-crm-text-bright text-sm">{order.customer?.name || order.user?.name || "Guest"}</p>
                      <p className="text-[10px] text-crm-text-dim">{order.customer?.email || order.user?.email || ""}</p>
                    </td>
                    <td><span className={`crm-badge border ${cfg.cls}`}>{cfg.label || order.status}</span></td>
                    <td>
                      <span className={`text-[10px] font-bold uppercase ${paymentIsPaid(order.paymentStatus) ? "text-crm-success" : "text-crm-warning"}`}>
                        {paymentStatusLabel(order.paymentStatus, order)}
                      </span>
                    </td>
                    <td className="font-bold tabular-nums text-crm-text-bright">৳{Number(order.total).toLocaleString()}</td>
                    <td className="text-xs text-crm-text-dim">{format(new Date(order.createdAt), "MMM dd, HH:mm")}</td>
                    <td className="text-right" onClick={e => e.stopPropagation()}>
                      <select
                        className="crm-input w-auto text-xs py-1 px-2 h-7"
                        aria-label={`Order status for ${order.orderNumber || order.id}`}
                        value={order.status}
                        onChange={e => handleStatusChange(order.id, e.target.value)}
                      >
                        {ORDER_STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Order Detail Slide-out */}
      <AnimatePresence>
        {(detailOrder || detailLoading) && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50" onClick={() => { setDetailOrder(null); }} />
            <motion.div
              data-section="order-detail"
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="order-detail fixed right-0 top-0 bottom-0 w-full max-w-lg bg-crm-bg-card border-l border-crm-border z-50 flex flex-col overflow-hidden shadow-2xl"
            >
              {detailLoading ? (
                <div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary" /></div>
              ) : currentOrder ? (
                <>
                  <div className="p-5 border-b border-crm-border flex items-center justify-between bg-crm-bg-alt/50">
                    <div>
                      <h3 className="font-bold text-crm-text-bright">Order #{(currentOrder.orderNumber || currentOrder.id).toUpperCase()}</h3>
                      <p className="text-xs text-crm-text-dim">{currentOrder.createdAt ? format(new Date(currentOrder.createdAt), "MMMM dd, yyyy HH:mm") : ""}</p>
                    </div>
                    <button onClick={() => setDetailOrder(null)} className="p-2 hover:bg-crm-bg-hover rounded-lg text-crm-text-dim"><FiX size={20} /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                    <OrderSnapshot
                      order={currentOrder}
                      onOpenCustomer={onOpenCustomer}
                      onOpenProduct={onOpenProduct}
                    />
                  </div>

                  {/* Actions Footer */}
                  <div className="p-4 border-t border-crm-border flex flex-col gap-2 bg-crm-bg-alt/50">
                    <div className="flex flex-wrap gap-2">
                      <button className="crm-btn flex-1" disabled={actionBusy} onClick={handlePrepare}>
                        <FiBox /> Prepare
                      </button>
                      <button className="crm-btn flex-1" disabled={actionBusy} onClick={handlePacked}>
                        <FiCheckSquare /> Packed
                      </button>
                      <button className="crm-btn crm-btn-primary flex-1" disabled={actionBusy} onClick={() => setShowCourierModal(true)}>
                        <FiTruck /> Book Courier
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <select
                        className="crm-input flex-1"
                        aria-label="Order status in detail panel"
                        data-testid="order-detail-status-select"
                        value={currentOrder.status || "pending"}
                        onChange={e => handleStatusChange(currentOrder.id, e.target.value)}
                      >
                        {ORDER_STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label}</option>)}
                      </select>
                      <button onClick={() => setDetailOrder(null)} className="crm-btn">Close</button>
                    </div>
                  </div>
                </>
              ) : null}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {showCourierModal && currentOrder && (
        <CourierBookingModal
          order={currentOrder}
          onClose={() => setShowCourierModal(false)}
          onBooked={() => { openDetail(currentOrder.id); fetchOrders(); }}
        />
      )}
    </div>
  );
}
