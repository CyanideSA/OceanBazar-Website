import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  FiPackage, FiAlertCircle, FiSearch, FiFilter, FiRefreshCw, 
  FiCheckCircle, FiXCircle, FiTrendingUp, FiArrowRight, FiInfo,
  FiEdit2, FiClock, FiPlusCircle, FiMinusCircle, FiArchive
} from "react-icons/fi";
import { hasPermission } from "../auth/permissionMatrix";
import { getAdminUser } from "../lib/auth";
import { inventoryService } from "../services/inventoryService";
import { useToast } from "../components/ToastProvider";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_MAP = {
  in_stock: { label: "In Stock", class: "crm-badge-success" },
  low_stock: { label: "Low Stock", class: "crm-badge-warning" },
  out_of_stock: { label: "Out of Stock", class: "crm-badge-danger" },
};

export default function InventoryPage() {
  const toast = useToast();
  const adminRole = useMemo(() => String(getAdminUser()?.role || "STAFF").toUpperCase(), []);
  const canEdit = hasPermission(adminRole, "inventory", "edit");
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      let data;
      if (filter === "low") data = await inventoryService.lowStock();
      else data = await inventoryService.list();
      setItems(Array.isArray(data) ? data : data?.items || []);
    } catch (err) {
      toast.error("Failed to fetch inventory");
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const filteredItems = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(i => 
      (i.sku || "").toLowerCase().includes(q) || 
      (i.productId || "").toLowerCase().includes(q) ||
      (i.warehouseName || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const getStatusBadge = (status) => {
    const config = STATUS_MAP[status] || { label: status, class: "text-crm-text-dim border-crm-border" };
    return <span className={`crm-badge border ${config.class}`}>{config.label}</span>;
  };

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
        <div className="flex items-center gap-2">
          <button onClick={fetchItems} className="crm-btn" disabled={loading}>
            <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: "Total SKUs", count: items.length, icon: FiPackage, color: "text-crm-primary" },
          { label: "Low Stock", count: items.filter(i => i.status === "low_stock").length, icon: FiAlertCircle, color: "text-crm-warning" },
          { label: "Out of Stock", count: items.filter(i => i.status === "out_of_stock").length, icon: FiXCircle, color: "text-crm-danger" },
          { label: "Total Units", count: items.reduce((s, i) => s + (i.quantityOnHand || 0), 0), icon: FiTrendingUp, color: "text-crm-success" },
        ].map((stat, i) => (
          <div key={i} className="crm-card flex items-center gap-4">
            <div className={`p-3 rounded-lg bg-crm-bg-hover ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider">{stat.label}</p>
              <p className="text-xl font-bold text-crm-text-bright">{stat.count.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="crm-card p-0 overflow-hidden border-b-0 rounded-b-none flex flex-wrap">
        {[
          { key: "all", label: "All Inventory" },
          { key: "low", label: "Low Stock Only" },
        ].map(tab => (
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary"></div>
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
                  <td colSpan="7" className="text-center py-12 text-crm-text-dim">No items found</td>
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
                    <td>
                      <p className="text-sm text-crm-text-bright">{item.warehouseName || "Default Warehouse"}</p>
                    </td>
                    <td>
                      <span className="font-bold tabular-nums text-crm-text-bright">{item.quantityOnHand}</span>
                    </td>
                    <td>
                      <span className="text-xs text-crm-text-dim tabular-nums">{item.quantityReserved}</span>
                    </td>
                    <td>
                      <span className="font-bold tabular-nums text-crm-success">{item.quantityAvailable}</span>
                    </td>
                    <td>{getStatusBadge(item.status)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => { setDetail(item); setDetailId(item.id); }}
                          className="p-1.5 rounded hover:bg-crm-bg-hover text-crm-text-dim hover:text-crm-primary transition-colors"
                          title="View Details"
                        >
                          <FiArrowRight size={16} />
                        </button>
                        <button className="p-1.5 rounded hover:bg-crm-bg-hover text-crm-text-dim hover:text-crm-text-bright transition-colors">
                          <FiMoreVertical size={16} />
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
                  <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest border-b border-crm-border pb-2">Inventory Breakdown</h4>
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
                      <span className="text-crm-danger font-medium">10 units</span>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-crm-border space-y-6">
                  <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest">Adjust Stock Level</h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-crm-text-dim uppercase">Adjustment Note</label>
                      <textarea className="crm-input min-h-[80px] bg-crm-bg" placeholder="e.g. Damage report, restock from supplier..." />
                    </div>
                    {canEdit && (
                      <div className="flex flex-wrap gap-2">
                        <button className="crm-btn bg-crm-success/10 text-crm-success border-crm-success/30 flex-1 py-2.5">
                          <FiPlusCircle /> Increase Stock
                        </button>
                        <button className="crm-btn bg-crm-danger/10 text-crm-danger border-crm-danger/30 flex-1 py-2.5">
                          <FiMinusCircle /> Deduct Stock
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-8 border-t border-crm-border space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest">Recent Transactions</h4>
                    <FiClock className="text-crm-text-muted" />
                  </div>
                  <div className="p-4 rounded-lg bg-crm-bg border border-crm-border text-center">
                    <p className="text-xs text-crm-text-dim italic">No recent transactions recorded for this SKU.</p>
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
