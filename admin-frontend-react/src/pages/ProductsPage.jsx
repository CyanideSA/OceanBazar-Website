import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { 
  FiSearch, FiPlus, FiBox, FiTrendingUp, FiCheckCircle, 
  FiMoreVertical, FiEdit2, FiTrash2,
  FiImage, FiRefreshCw, FiChevronRight,
  FiChevronLeft, FiDownload, FiSquare, FiCheckSquare,
} from "react-icons/fi";
import { adminApi } from "../lib/api";
import { getAdminUser } from "../lib/auth";
import { useToast } from "../components/ToastProvider";
import { normalizeProductImageUrl } from "../utils/mediaUrl";
import { format } from "date-fns";
import AddProductWizard from "../components/products/AddProductWizard";
import EditProductDrawer from "../components/products/EditProductDrawer";


const PAGE_LIMIT = 50;

export default function ProductsPage({ initialSearch = "" }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch);
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const searchTimerRef = useRef(null);
  const [showForm, setShowCreateForm] = useState(false);
  const [editProductId, setEditProductId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const adminRole = useMemo(() => String(getAdminUser()?.role || "STAFF").toUpperCase(), []);
  const canEdit = adminRole === "SUPER_ADMIN" || adminRole === "ADMIN";
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_LIMIT));

  const fetchProducts = useCallback(async (pg = 1, tab = "all", q = "") => {
    setLoading(true);
    try {
      const params = { page: pg, limit: PAGE_LIMIT };
      if (tab && tab !== "all") {
        params.status = tab === "published" ? "active" : tab;
      }
      if (q) params.search = q;
      const res = await adminApi.products(params);
      const raw = Array.isArray(res) ? res : Array.isArray(res?.products) ? res.products : [];
      const normalized = raw.map(p => ({
        ...p,
        price: p.price ?? p.pricing?.find(pr => (pr.customerType || "").toLowerCase() === "retail")?.price ?? p.pricing?.[0]?.price ?? 0,
        mainImage: p.mainImage ?? p.productAssets?.[0]?.url ?? null,
        categoryName: p.categoryName ?? p.productCategories?.[0]?.category?.nameEn ?? null,
      }));
      setItems(normalized);
      setTotalCount(Number(res?.total ?? raw.length));
      setActiveCount(Number(res?.activeCount ?? 0));
      setLowStockCount(Number(res?.lowStockCount ?? 0));    } catch (err) {      toast.error("Failed to fetch products");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProducts(1, activeTab, search);
    setPage(1);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchProducts(1, activeTab, initialSearch);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setPage(1);
      fetchProducts(1, activeTab, val);
    }, 400);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchProducts(newPage, activeTab, search);
  };

  const filteredProducts = items; // server already filtered

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this product permanently?")) return;
    try {
      await adminApi.deleteProduct(id);
      fetchProducts(page, activeTab, search);
      toast.success("Product deleted successfully");
    } catch (err) {
      toast.error("Failed to delete product");
    }
  };

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const allSelected = filteredProducts.length > 0 && filteredProducts.every(p => selectedIds.has(p.id));

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredProducts.map(p => p.id)));
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedIds.size === 0) return;
    if (bulkAction === 'delete' && !window.confirm(`Delete ${selectedIds.size} products permanently?`)) return;
    setBulkSaving(true);
    try {
      const ids = [...selectedIds];
      if (bulkAction === 'delete') {
        await Promise.all(ids.map(id => adminApi.deleteProduct(id)));
        toast.success(`${ids.length} products deleted`);
      } else {
        await Promise.all(ids.map(id => adminApi.updateProduct(id, { status: bulkAction })));
        toast.success(`${ids.length} products set to ${bulkAction}`);
      }
      setSelectedIds(new Set());
      setBulkAction("");
      fetchProducts(page, activeTab, search);
    } catch { toast.error("Bulk action failed"); }
    finally { setBulkSaving(false); }
  };

  /* CSV may include SKUs and titles — treat as internal data; download is client-side only. */
  const exportCsv = () => {
    const src = selectedIds.size > 0 ? filteredProducts.filter(p => selectedIds.has(p.id)) : filteredProducts;
    const headers = ['ID', 'Title', 'SKU', 'Status', 'Stock', 'Price (BDT)', 'Brand', 'Created'];
    const rows = src.map(p => [
      p.id, p.titleEn, p.sku || '', p.status || 'draft', p.stock || 0,
      p.price || 0, p.brand || '', p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `products_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };





  return (
    <div className="space-y-6">
      <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-crm-primary-dim text-crm-primary">
                  <FiBox size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Product Catalog</h2>
                  <p className="text-crm-text-dim text-sm">Manage your store's items, pricing, and media</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && (
                  <button onClick={() => setShowCreateForm(true)} className="crm-btn crm-btn-primary">
                    <FiPlus /> New Product
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Total Products", count: totalCount, icon: FiBox, color: "text-crm-primary" },
                { label: "Published", count: activeCount, icon: FiCheckCircle, color: "text-crm-success" },
                { label: "Low Stock", count: lowStockCount, icon: FiTrendingUp, color: "text-crm-warning" },
              ].map((stat, i) => (
                <div key={i} className="crm-card flex items-center gap-4">
                  <div className={`p-3 rounded-lg bg-crm-bg-hover ${stat.color}`}>
                    <stat.icon size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider">{stat.label}</p>
                    <p className="text-xl font-bold text-crm-text-bright">{stat.count}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="crm-card p-0 overflow-hidden border-b-0 rounded-b-none flex flex-wrap">
              {["all", "draft", "published", "suspended"].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 border-b-2 transition-all font-medium text-sm capitalize ${
                    activeTab === tab 
                      ? "border-crm-primary text-crm-primary bg-crm-primary-dim" 
                      : "border-transparent text-crm-text-dim hover:text-crm-text-bright hover:bg-crm-bg-hover"
                  }`}
                >
                  {tab === "published" ? "Published" : tab}
                </button>
              ))}
            </div>

            <div className="crm-card flex flex-wrap items-center gap-4 rounded-t-none border-t-0">
              <div className="relative flex-1 min-w-[240px]">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
                <input 
                  type="text" 
                  placeholder="Search products by name, SKU, or ID..." 
                  className="crm-input pl-10" 
                  value={search}
                  onChange={handleSearchChange}
                />
              </div>
              <button className="crm-btn" onClick={() => fetchProducts(page, activeTab, search)}>
                <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
              </button>
              <button
                type="button"
                className="crm-btn"
                onClick={exportCsv}
                title="Export product list as CSV"
                aria-label="Export product list as CSV"
              >
                <FiDownload size={14} /> {selectedIds.size > 0 ? `Export CSV (${selectedIds.size})` : 'Export CSV'}
              </button>
            </div>

            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-crm-primary-dim border border-crm-primary/30 rounded-xl text-sm">
                <span className="text-crm-primary font-semibold">{selectedIds.size} selected</span>
                <select value={bulkAction} onChange={e => setBulkAction(e.target.value)} className="crm-input py-1 text-xs h-7">
                  <option value="">Choose action…</option>
                  <option value="active">Publish</option>
                  <option value="draft">Set Draft</option>
                  <option value="suspended">Suspend</option>
                  <option value="delete">Delete</option>
                </select>
                <button onClick={handleBulkAction} disabled={!bulkAction || bulkSaving} className="crm-btn crm-btn-primary py-1 text-xs h-7 disabled:opacity-50">
                  {bulkSaving ? 'Working…' : 'Apply'}
                </button>
                <button onClick={() => setSelectedIds(new Set())} className="text-crm-text-dim hover:text-crm-text-bright text-xs">✕ Deselect all</button>
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-crm-text-dim">Showing {((page - 1) * PAGE_LIMIT) + 1}–{Math.min(page * PAGE_LIMIT, totalCount)} of {totalCount.toLocaleString()} products</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => handlePageChange(page - 1)} disabled={page <= 1} className="crm-btn px-3 py-1.5 text-xs disabled:opacity-40"><FiChevronLeft size={14} /></button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
                    return <button key={p} onClick={() => handlePageChange(p)} className={`h-7 w-7 rounded text-xs font-bold transition-colors ${p === page ? 'bg-crm-primary text-white' : 'hover:bg-crm-bg-hover text-crm-text-dim'}`}>{p}</button>;
                  })}
                  <button onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages} className="crm-btn px-3 py-1.5 text-xs disabled:opacity-40"><FiChevronRight size={14} /></button>
                </div>
              </div>
            )}

            <div className="crm-table-container">
              {loading ? (
                <div className="p-20 flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary"></div>
                </div>
              ) : (
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th style={{width:36}}>
                        <button type="button" onClick={toggleSelectAll} className="text-crm-text-dim hover:text-crm-primary">
                          {allSelected ? <FiCheckSquare size={16} /> : <FiSquare size={16} />}
                        </button>
                      </th>
                      <th>Product</th>
                      <th>Status</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.length === 0 ? (
                      <tr><td colSpan="7" className="text-center py-12 text-crm-text-dim">No products found</td></tr>
                    ) : filteredProducts.map((p) => (
                      <tr key={p.id} className={`group ${selectedIds.has(p.id) ? 'bg-crm-primary-dim/20' : ''}`}>
                        <td onClick={() => toggleSelect(p.id)} style={{cursor:'pointer', width:36}}>
                          <button type="button" className="text-crm-text-dim hover:text-crm-primary">
                            {selectedIds.has(p.id) ? <FiCheckSquare size={15} className="text-crm-primary" /> : <FiSquare size={15} />}
                          </button>
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-crm-bg-hover overflow-hidden border border-crm-border shrink-0">
                              {p.mainImage ? (
                                <img src={normalizeProductImageUrl(p.mainImage)} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-crm-text-muted"><FiImage size={20} /></div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-crm-text-bright truncate">{p.titleEn}</p>
                              <p className="text-[10px] text-crm-text-dim font-mono uppercase tracking-widest">SKU: {p.sku || "N/A"}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`crm-badge border ${p.status === 'active' ? 'crm-badge-success' : p.status === 'suspended' ? 'crm-badge-warning' : 'text-crm-text-dim border-crm-border'}`}>
                            {p.status === 'active' ? 'published' : (p.status || 'draft')}
                          </span>
                        </td>
                        <td><p className="font-bold text-crm-text-bright tabular-nums">৳{Number(p.price || 0).toLocaleString()}</p></td>
                        <td>
                          <div className="flex flex-col gap-1">
                            <span className={`text-xs font-bold ${p.stock < 10 ? 'text-crm-danger' : 'text-crm-text-dim'}`}>
                              {p.stock || 0} <span className="text-[10px] font-normal uppercase ml-1">In Stock</span>
                            </span>
                            <div className="w-20 h-1 bg-crm-bg-hover rounded-full overflow-hidden">
                              <div className={`h-full ${p.stock < 10 ? 'bg-crm-danger' : 'bg-crm-success'}`} style={{ width: `${Math.min(100, (p.stock || 0))}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="text-[11px] text-crm-text-dim whitespace-nowrap">
                          {p.createdAt ? format(new Date(p.createdAt), "MMM dd, yyyy") : "—"}
                        </td>
                        <td>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); setEditProductId(p.id); }}
                              className="p-1.5 rounded hover:bg-crm-bg-hover text-crm-text-dim hover:text-crm-primary transition-colors" title="Edit">
                              <FiEdit2 size={16} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} className="p-1.5 rounded hover:bg-crm-bg-hover text-crm-text-dim hover:text-crm-danger transition-colors" title="Delete">
                              <FiTrash2 size={16} />
                            </button>
                            <button className="p-1.5 rounded hover:bg-crm-bg-hover text-crm-text-dim hover:text-crm-text-bright">
                              <FiMoreVertical size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
      </div>

      {/* ── Add Product Wizard ───────────────────────────────────────────── */}
      <AddProductWizard
        open={showForm}
        onClose={() => setShowCreateForm(false)}
        onSuccess={() => fetchProducts(1, activeTab, search)}
      />

      {/* ── Full Edit Product Drawer ─────────────────────────────────────── */}
      {editProductId && (
        <EditProductDrawer
          productId={editProductId}
          onClose={() => setEditProductId(null)}
          onSaved={() => fetchProducts(page, activeTab, search)}
        />
      )}
    </div>
  );
}
