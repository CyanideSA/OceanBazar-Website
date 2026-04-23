import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiSearch, FiFilter, FiEye, FiTruck, FiCheckCircle, FiXCircle,
  FiMoreVertical, FiDownload, FiRefreshCw, FiPackage, FiDollarSign,
  FiClock, FiX, FiChevronRight, FiMapPin, FiUser, FiPhone, FiMail
} from "react-icons/fi";
import { adminApi } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_CONFIG = {
  PENDING:    { label: "Pending",    cls: "text-crm-warning bg-crm-warning-dim border-crm-warning/20" },
  PROCESSING: { label: "Processing", cls: "text-crm-primary bg-crm-primary-dim border-crm-primary/20" },
  SHIPPED:    { label: "Shipped",    cls: "text-crm-purple bg-crm-purple-dim border-crm-purple/20" },
  DELIVERED:  { label: "Delivered",  cls: "text-crm-success bg-crm-success-dim border-crm-success/20" },
  CANCELLED:  { label: "Cancelled",  cls: "text-crm-danger bg-crm-danger-dim border-crm-danger/20" },
};

const ORDER_STATUSES = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

export default function OrdersPage({ initialSearch = "", liveTick = 0 }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

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

  const stats = useMemo(() => ({
    total: rows.length,
    pending: rows.filter(o => o.status === "PENDING").length,
    processing: rows.filter(o => o.status === "PROCESSING" || o.status === "SHIPPED").length,
    delivered: rows.filter(o => o.status === "DELIVERED").length,
    revenue: rows.reduce((s, o) => s + (Number(o.total) || 0), 0),
  }), [rows]);

  const filteredOrders = useMemo(() => {
    if (!searchTerm) return rows;
    const q = searchTerm.toLowerCase();
    return rows.filter(o =>
      o.id?.toLowerCase().includes(q) ||
      o.customer?.name?.toLowerCase().includes(q) ||
      o.customer?.email?.toLowerCase().includes(q) ||
      o.trackingNumber?.toLowerCase().includes(q)
    );
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
          <button className="crm-btn"><FiDownload /> Export</button>
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
                        #{order.id.slice(-8).toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <p className="font-medium text-crm-text-bright text-sm">{order.customer?.name || "Guest"}</p>
                      <p className="text-[10px] text-crm-text-dim">{order.customer?.email || ""}</p>
                    </td>
                    <td><span className={`crm-badge border ${cfg.cls}`}>{cfg.label || order.status}</span></td>
                    <td>
                      <span className={`text-[10px] font-bold uppercase ${order.paymentStatus === "PAID" ? "text-crm-success" : "text-crm-warning"}`}>
                        {order.paymentStatus || "UNPAID"}
                      </span>
                    </td>
                    <td className="font-bold tabular-nums text-crm-text-bright">৳{Number(order.total).toLocaleString()}</td>
                    <td className="text-xs text-crm-text-dim">{format(new Date(order.createdAt), "MMM dd, HH:mm")}</td>
                    <td className="text-right" onClick={e => e.stopPropagation()}>
                      <select
                        className="crm-input w-auto text-xs py-1 px-2 h-7"
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
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-crm-bg-card border-l border-crm-border z-50 flex flex-col overflow-hidden shadow-2xl"
            >
              {detailLoading ? (
                <div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary" /></div>
              ) : detailOrder ? (
                <>
                  <div className="p-5 border-b border-crm-border flex items-center justify-between bg-crm-bg-alt/50">
                    <div>
                      <h3 className="font-bold text-crm-text-bright">Order #{(detailOrder.order?.id || "").slice(-8).toUpperCase()}</h3>
                      <p className="text-xs text-crm-text-dim">{detailOrder.order?.createdAt ? format(new Date(detailOrder.order.createdAt), "MMMM dd, yyyy HH:mm") : ""}</p>
                    </div>
                    <button onClick={() => setDetailOrder(null)} className="p-2 hover:bg-crm-bg-hover rounded-lg text-crm-text-dim"><FiX size={20} /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                    {/* Status & Payment */}
                    <div className="flex flex-wrap gap-3">
                      {detailOrder.order?.status && (
                        <span className={`crm-badge border ${STATUS_CONFIG[detailOrder.order.status]?.cls || ""}`}>
                          {STATUS_CONFIG[detailOrder.order.status]?.label || detailOrder.order.status}
                        </span>
                      )}
                      <span className={`crm-badge ${detailOrder.order?.paymentStatus === "PAID" ? "text-crm-success bg-crm-success-dim" : "text-crm-warning bg-crm-warning-dim"}`}>
                        {detailOrder.order?.paymentStatus || "UNPAID"}
                      </span>
                    </div>

                    {/* Customer */}
                    <div className="crm-card bg-crm-bg/50 space-y-3">
                      <h4 className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Customer</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-crm-text-bright"><FiUser size={14} className="text-crm-text-muted" />{detailOrder.order?.customer?.name || "Guest"}</div>
                        {detailOrder.order?.customer?.email && <div className="flex items-center gap-2 text-crm-text-dim"><FiMail size={14} className="text-crm-text-muted" />{detailOrder.order.customer.email}</div>}
                        {detailOrder.order?.customer?.phone && <div className="flex items-center gap-2 text-crm-text-dim"><FiPhone size={14} className="text-crm-text-muted" />{detailOrder.order.customer.phone}</div>}
                      </div>
                    </div>

                    {/* Shipping Address */}
                    {detailOrder.order?.shippingAddress && (
                      <div className="crm-card bg-crm-bg/50 space-y-2">
                        <h4 className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Shipping Address</h4>
                        <div className="flex items-start gap-2 text-sm text-crm-text-bright">
                          <FiMapPin size={14} className="text-crm-text-muted mt-0.5 shrink-0" />
                          <span>{typeof detailOrder.order.shippingAddress === "string" ? detailOrder.order.shippingAddress : JSON.stringify(detailOrder.order.shippingAddress)}</span>
                        </div>
                      </div>
                    )}

                    {/* Items */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Items ({detailOrder.items?.length || 0})</h4>
                      {(detailOrder.items || []).map((item, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-crm-bg/50 border border-crm-border/50">
                          {item.image && <img src={item.image} alt="" className="w-10 h-10 rounded object-cover bg-crm-bg-hover" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-crm-text-bright truncate">{item.title || item.productId}</p>
                            <p className="text-[10px] text-crm-text-dim">Qty: {item.quantity} × ৳{Number(item.price).toLocaleString()}</p>
                          </div>
                          <p className="font-bold text-sm text-crm-text-bright tabular-nums">৳{(Number(item.price) * Number(item.quantity)).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>

                    {/* Totals */}
                    <div className="crm-card bg-crm-bg/50 space-y-2">
                      <div className="flex justify-between text-sm"><span className="text-crm-text-dim">Subtotal</span><span className="text-crm-text-bright tabular-nums">৳{Number(detailOrder.order?.subtotal || detailOrder.order?.total || 0).toLocaleString()}</span></div>
                      {detailOrder.order?.shippingCost != null && <div className="flex justify-between text-sm"><span className="text-crm-text-dim">Shipping</span><span className="text-crm-text-bright tabular-nums">৳{Number(detailOrder.order.shippingCost).toLocaleString()}</span></div>}
                      {detailOrder.order?.discount != null && Number(detailOrder.order.discount) > 0 && <div className="flex justify-between text-sm"><span className="text-crm-text-dim">Discount</span><span className="text-crm-success tabular-nums">-৳{Number(detailOrder.order.discount).toLocaleString()}</span></div>}
                      <div className="flex justify-between text-base font-bold pt-2 border-t border-crm-border/50"><span className="text-crm-text-bright">Total</span><span className="text-crm-text-bright tabular-nums">৳{Number(detailOrder.order?.total || 0).toLocaleString()}</span></div>
                    </div>

                    {/* Tracking */}
                    {detailOrder.order?.trackingNumber && (
                      <div className="crm-card bg-crm-bg/50 space-y-2">
                        <h4 className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Tracking</h4>
                        <p className="font-mono text-sm text-crm-primary">{detailOrder.order.trackingNumber}</p>
                      </div>
                    )}

                    {/* Notes */}
                    {detailOrder.order?.notes && (
                      <div className="crm-card bg-crm-bg/50 space-y-2">
                        <h4 className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Notes</h4>
                        <p className="text-sm text-crm-text-bright whitespace-pre-wrap">{detailOrder.order.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="p-4 border-t border-crm-border flex items-center gap-3 bg-crm-bg-alt/50">
                    <select
                      className="crm-input flex-1"
                      value={detailOrder.order?.status || "PENDING"}
                      onChange={e => handleStatusChange(detailOrder.order.id, e.target.value)}
                    >
                      {ORDER_STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label}</option>)}
                    </select>
                    <button onClick={() => setDetailOrder(null)} className="crm-btn">Close</button>
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
