import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  FiPackage, FiAlertCircle, FiSearch, FiRefreshCw,
  FiTrendingUp, FiArrowRight,
  FiPlusCircle, FiMinusCircle, FiArchive,
  FiMoreVertical, FiEdit2, FiChevronLeft, FiChevronRight,
} from "react-icons/fi";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { hasPermission } from "../auth/permissionMatrix";
import { getAdminUser } from "../lib/auth";
import { inventoryService } from "../services/inventoryService";
import { useToast } from "../components/ToastProvider";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = ["#1f6feb", "#238636", "#d29922", "#da3633", "#8957e5", "#39c5cf", "#f778ba", "#79c0ff"];
const PAGE_SIZE = 20;

const STATUS_MAP = {
  in_stock: { label: "In Stock", class: "crm-badge-success" },
  low_stock: { label: "Low Stock", class: "crm-badge-warning" },
  out_of_stock: { label: "Out of Stock", class: "crm-badge-danger" },
};

function money(n) {
  return "৳" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function InventoryPage() {
  const toast = useToast();
  const adminRole = useMemo(() => String(getAdminUser()?.role || "STAFF").toUpperCase(), []);
  const canEdit = hasPermission(adminRole, "inventory", "edit");

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const menuRef = useRef(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      const data = await inventoryService.analytics();
      setAnalytics(data);
    } catch {
      /* non-fatal */
    }
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: PAGE_SIZE };
      let data;
      if (filter === "low") data = await inventoryService.lowStock(params);
      else data = await inventoryService.list(params);
      setItems(data.items || []);
      setTotal(data.total ?? 0);
    } catch {
      toast.error("Failed to fetch inventory");
    } finally {
      setLoading(false);
    }
  }, [filter, page, toast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);
  useEffect(() => { setPage(1); }, [filter, search]);

  useEffect(() => {
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpenId(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filteredItems = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((i) =>
      (i.sku || "").toLowerCase().includes(q) ||
      (i.productId || "").toLowerCase().includes(q) ||
      (i.warehouseName || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const stockChartData = useMemo(() => {
    const byCat = analytics?.stockByCategory || [];
    if (byCat.length) {
      return byCat.map((r) => ({ name: r.category || "Uncategorized", units: Number(r.units ?? 0) }));
    }
    return (analytics?.stockByProduct || []).map((r) => ({
      name: (r.title || r.product_id || "").slice(0, 18),
      units: Number(r.units ?? 0),
    }));
  }, [analytics]);

  const movementData = useMemo(() =>
    (analytics?.movementTrend || []).map((r) => ({
      day: r.day ? format(new Date(r.day), "MMM d") : "",
      inbound: Number(r.inbound ?? 0),
      outbound: Number(r.outbound ?? 0),
    })),
  [analytics]);

  const openDetail = async (item, focusAdjust = false) => {
    setDetail(item);
    setDetailId(item.id);
    setAdjustQty("");
    setAdjustNote("");
    setMenuOpenId(null);
    setDetailLoading(true);
    try {
      const data = await inventoryService.detail(item.id);
      if (data?.item) setDetail(data.item);
      setTransactions(data?.transactions || []);
      if (focusAdjust) {
        setTimeout(() => document.getElementById("adjust-qty-input")?.focus(), 300);
      }
    } catch {
      setTransactions([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const adjustStock = async (type) => {
    const qty = Number(adjustQty);
    if (!detail?.id || !qty || qty <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    setAdjusting(true);
    try {
      const res = await inventoryService.adjustStock(detail.id, qty, type, adjustNote.trim() || undefined);
      if (res?.item) {
        setDetail(res.item);
        setItems((prev) => prev.map((i) => (i.id === res.item.id ? res.item : i)));
      }
      const refreshed = await inventoryService.detail(detail.id);
      setTransactions(refreshed?.transactions || []);
      setAdjustQty("");
      setAdjustNote("");
      toast.success(type === "add" ? "Stock increased" : "Stock deducted");
      fetchAnalytics();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Stock adjustment failed");
    } finally {
      setAdjusting(false);
    }
  };

  const getStatusBadge = (status) => {
    const config = STATUS_MAP[status] || { label: status, class: "text-crm-text-dim border-crm-border" };
    return <span className={`crm-badge border ${config.class}`}>{config.label}</span>;
  };

  const kpiStats = [
    { label: "Total SKUs", count: total, icon: FiPackage, color: "text-crm-primary" },
    { label: "Low Stock", count: analytics?.lowStockCount ?? items.filter((i) => i.status === "low_stock").length, icon: FiAlertCircle, color: "text-crm-warning" },
    { label: "Inventory Value", count: money(analytics?.totalValue ?? 0), icon: FiTrendingUp, color: "text-crm-success", isText: true },
    { label: "On This Page", count: items.reduce((s, i) => s + (i.quantityOnHand || 0), 0), icon: FiArchive, color: "text-crm-text-bright" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-primary-dim text-crm-primary">
            <FiArchive size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Inventory Control</h2>
            <p className="text-crm-text-dim text-sm">Monitor stock levels across all warehouses</p>
          </div>
        </div>
        <button onClick={() => { fetchItems(); fetchAnalytics(); }} className="crm-btn" disabled={loading}>
          <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {kpiStats.map((stat, i) => (
          <div key={i} className="crm-card flex items-center gap-4">
            <div className={`p-3 rounded-lg bg-crm-bg-hover ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider">{stat.label}</p>
              <p className="text-xl font-bold text-crm-text-bright">
                {stat.isText ? stat.count : stat.count.toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {stockChartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="crm-card">
            <h3 className="text-sm font-bold text-crm-text-bright mb-4">Stock by Category / Product</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stockChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--crm-border)" />
                <XAxis dataKey="name" tick={{ fill: "var(--crm-text-dim)", fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fill: "var(--crm-text-dim)", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "var(--crm-bg-alt)", border: "1px solid var(--crm-border)" }} />
                <Bar dataKey="units" fill="#1f6feb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="crm-card">
            <h3 className="text-sm font-bold text-crm-text-bright mb-4">Stock Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={stockChartData} dataKey="units" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {stockChartData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--crm-bg-alt)", border: "1px solid var(--crm-border)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {movementData.length > 0 && (
        <div className="crm-card">
          <h3 className="text-sm font-bold text-crm-text-bright mb-4">Movement Trend (14 days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={movementData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--crm-border)" />
              <XAxis dataKey="day" tick={{ fill: "var(--crm-text-dim)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--crm-text-dim)", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "var(--crm-bg-alt)", border: "1px solid var(--crm-border)" }} />
              <Legend />
              <Line type="monotone" dataKey="inbound" stroke="#238636" strokeWidth={2} dot={false} name="Inbound" />
              <Line type="monotone" dataKey="outbound" stroke="#da3633" strokeWidth={2} dot={false} name="Outbound" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="crm-card p-0 overflow-hidden border-b-0 rounded-b-none flex flex-wrap">
        {[
          { key: "all", label: "All Inventory" },
          { key: "low", label: "Low Stock Only" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-6 py-3 border-b-2 transition-all font-medium text-sm ${
              filter === tab.key
                ? "border-crm-primary text-crm-primary bg-crm-primary-dim"
                : "border-transparent text-crm-text-dim hover:text-crm-text-bright"
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
            placeholder="Search by SKU, Product ID, Warehouse..."
            className="crm-input pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="crm-table-container">
        {loading ? (
          <div className="p-20 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary" />
          </div>
        ) : filteredItems.length === 0 && !search ? (
          <div className="p-16 text-center space-y-3">
            <FiPackage size={48} className="mx-auto text-crm-text-muted" />
            <p className="text-crm-text-bright font-semibold">No inventory items yet</p>
            <p className="text-crm-text-dim text-sm max-w-md mx-auto">
              Stock records appear here when products are synced to warehouses. Check back after your next product import or order fulfillment.
            </p>
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>SKU / Product ID</th>
                <th>Warehouse</th>
                <th>On Hand</th>
                <th>Reserved</th>
                <th>Available</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-crm-text-dim">No items match your search</td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="group">
                    <td>
                      <div>
                        <p className="font-mono text-xs font-bold text-crm-primary uppercase">{item.sku || "NO-SKU"}</p>
                        <p className="text-[10px] text-crm-text-dim font-mono">{item.productId}</p>
                      </div>
                    </td>
                    <td><p className="text-sm text-crm-text-bright">{item.warehouseName || "Default Warehouse"}</p></td>
                    <td><span className="font-bold tabular-nums text-crm-text-bright">{item.quantityOnHand}</span></td>
                    <td><span className="text-xs text-crm-text-dim tabular-nums">{item.quantityReserved}</span></td>
                    <td><span className="font-bold tabular-nums text-crm-success">{item.quantityAvailable}</span></td>
                    <td>{getStatusBadge(item.status)}</td>
                    <td>
                      <div className="flex items-center gap-2 relative" ref={menuOpenId === item.id ? menuRef : null}>
                        <button
                          onClick={() => openDetail(item)}
                          className="p-1.5 rounded hover:bg-crm-bg-hover text-crm-text-dim hover:text-crm-primary transition-colors"
                          title="View Details"
                        >
                          <FiArrowRight size={16} />
                        </button>
                        <button
                          onClick={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)}
                          className="p-1.5 rounded hover:bg-crm-bg-hover text-crm-text-dim hover:text-crm-text-bright transition-colors"
                        >
                          <FiMoreVertical size={16} />
                        </button>
                        {menuOpenId === item.id && (
                          <div className="absolute right-0 top-full mt-1 z-20 min-w-[160px] rounded-lg border border-crm-border bg-crm-bg-alt shadow-xl py-1">
                            <button
                              type="button"
                              onClick={() => openDetail(item)}
                              className="w-full text-left px-3 py-2 text-sm text-crm-text-bright hover:bg-crm-bg-hover flex items-center gap-2"
                            >
                              <FiArrowRight size={14} /> View detail
                            </button>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => openDetail(item, true)}
                                className="w-full text-left px-3 py-2 text-sm text-crm-text-bright hover:bg-crm-bg-hover flex items-center gap-2"
                              >
                                <FiEdit2 size={14} /> Adjust stock
                              </button>
                            )}
                          </div>
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

      {!loading && total > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-4 crm-card py-3 px-4">
          <p className="text-sm text-crm-text-dim">
            Page {page} of {totalPages} · {total.toLocaleString()} SKUs total
          </p>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="crm-btn text-sm">
              <FiChevronLeft /> Prev
            </button>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="crm-btn text-sm">
              Next <FiChevronRight />
            </button>
          </div>
        </div>
      )}

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
                      <FiPackage size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-crm-text-bright">Stock Details</h3>
                      <p className="text-[10px] text-crm-text-dim font-mono uppercase tracking-wider">SKU: {detail.sku}</p>
                    </div>
                  </div>
                  <button onClick={() => setDetailId(null)} className="p-2 hover:bg-crm-bg-hover rounded-full text-crm-text-dim">
                    <FiArrowRight className="rotate-180" size={24} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="crm-card bg-crm-bg border-none">
                    <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider mb-2">Available for Sale</p>
                    <span className="text-2xl font-bold text-crm-success">{detail.quantityAvailable}</span>
                  </div>
                  <div className="crm-card bg-crm-bg border-none">
                    <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider mb-2">Stock Status</p>
                    {getStatusBadge(detail.status)}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-black text-crm-text-bright uppercase tracking-widest border-b border-crm-border pb-2">Inventory Breakdown</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-crm-text-dim">Total On Hand</span>
                      <span className="text-crm-text-bright font-bold">{detail.quantityOnHand} units</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-crm-text-dim">Reserved / Pending</span>
                      <span className="text-crm-warning font-bold">{detail.quantityReserved} units</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-crm-text-dim">Warehouse</span>
                      <span className="text-crm-text-bright font-medium">{detail.warehouseName || "Main Distribution Center"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-crm-text-dim">Threshold Alert</span>
                      <span className="text-crm-danger font-medium">{detail.reorderPoint ?? 10} units</span>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-crm-border space-y-6">
                  <h4 className="text-xs font-black text-crm-text-bright uppercase tracking-widest">Adjust Stock Level</h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-crm-text-dim uppercase">Quantity</label>
                      <input
                        id="adjust-qty-input"
                        type="number"
                        min="1"
                        className="crm-input bg-crm-bg"
                        placeholder="Units to add or remove"
                        value={adjustQty}
                        onChange={(e) => setAdjustQty(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-crm-text-dim uppercase">Adjustment Note</label>
                      <textarea
                        className="crm-input min-h-[80px] bg-crm-bg"
                        placeholder="e.g. Damage report, restock from supplier..."
                        value={adjustNote}
                        onChange={(e) => setAdjustNote(e.target.value)}
                      />
                    </div>
                    {canEdit ? (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" disabled={adjusting} onClick={() => adjustStock("add")} className="crm-btn bg-crm-success/10 text-crm-success border-crm-success/30 flex-1 py-2.5">
                          <FiPlusCircle /> Increase Stock
                        </button>
                        <button type="button" disabled={adjusting} onClick={() => adjustStock("deduct")} className="crm-btn bg-crm-danger/10 text-crm-danger border-crm-danger/30 flex-1 py-2.5">
                          <FiMinusCircle /> Deduct Stock
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-crm-text-dim">You have view-only access to inventory adjustments.</p>
                    )}
                  </div>
                </div>

                <div className="pt-8 border-t border-crm-border space-y-4">
                  <h4 className="text-xs font-black text-crm-text-bright uppercase tracking-widest">Recent Transactions</h4>
                  <div className="p-4 rounded-lg bg-crm-bg border border-crm-border">
                    {detailLoading ? (
                      <p className="text-xs text-crm-text-dim text-center">Loading transactions…</p>
                    ) : transactions.length === 0 ? (
                      <p className="text-xs text-crm-text-dim italic text-center">No recent transactions recorded for this SKU.</p>
                    ) : (
                      <div className="space-y-3">
                        {transactions.slice(0, 8).map((tx) => (
                          <div key={tx.id} className="flex justify-between gap-3 text-xs border-b border-crm-border/50 pb-2 last:border-0">
                            <div>
                              <p className="font-bold text-crm-text-bright uppercase">{tx.type?.replace(/_/g, " ")}</p>
                              <p className="text-crm-text-dim">{tx.note || "No note"}</p>
                            </div>
                            <div className="text-right whitespace-nowrap">
                              <p className="font-bold text-crm-primary">{tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}</p>
                              <p className="text-crm-text-muted">{tx.createdAt ? format(new Date(tx.createdAt), "MMM dd, HH:mm") : ""}</p>
                            </div>
                          </div>
                        ))}
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
