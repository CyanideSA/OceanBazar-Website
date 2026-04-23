import React, { useEffect, useMemo, useState, useCallback } from "react";
import { 
  FiSearch, FiFilter, FiPlus, FiBox, FiTrendingUp, FiCheckCircle, 
  FiXCircle, FiMoreVertical, FiEye, FiEdit2, FiTrash2,
  FiDollarSign, FiArchive, FiImage, FiRefreshCw, FiChevronRight,
  FiChevronLeft, FiCamera, FiVideo, FiTag, FiHash, FiTruck, FiActivity,
  FiExternalLink, FiLayers, FiInfo
} from "react-icons/fi";
import { adminApi } from "../lib/api";
import { getAdminUser } from "../lib/auth";
import { useToast } from "../components/ToastProvider";
import { normalizeProductImageUrl } from "../utils/mediaUrl";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORY_OPTIONS = ["Electronics", "Fashion", "Beauty", "Home & Kitchen", "Sports", "Toys", "Health"];
const BRAND_OPTIONS = ["OceanBazar", "Apple", "Samsung", "Sony", "Nike", "Adidas", "Logitech"];

export default function ProductsPage({ initialSearch = "" }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch);
  const [activeTab, setActiveTab] = useState("all");
  const [showForm, setShowCreateForm] = useState(false);
  const [formStep, setFormStep] = useState(1);
  const [formData, setForm] = useState({
    name: "", category: "", brand: "", tags: [],
    images: [], video: null, banner: null,
    price: "", previousPrice: "", retailTiers: ["", "", ""], wholesaleTiers: ["", "", ""],
    stock: "", sku: "", 
    attributes: { application: "", feature: "", ingredients: "" },
    specs: { productCode: "", category: "", shipping: "", dispatch: "" },
    flags: { featured: false, bestSeller: false, reviewConfirmed: false }
  });

  const adminRole = useMemo(() => String(getAdminUser()?.role || "STAFF").toUpperCase(), []);
  const canEdit = adminRole === "SUPER_ADMIN" || adminRole === "ADMIN";

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.products();
      setItems(Array.isArray(res) ? res : []);
    } catch (err) {
      toast.error("Failed to fetch products");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = useMemo(() => {
    return items.filter(p => {
      const matchesTab = activeTab === "all" || (p.status || "draft").toLowerCase() === activeTab;
      const q = search.toLowerCase();
      const matchesSearch = !search || 
        `${p.titleEn} ${p.sku} ${p.id}`.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  }, [items, activeTab, search]);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this product permanently?")) return;
    try {
      await adminApi.deleteProduct(id);
      setItems(prev => prev.filter(p => p.id !== id));
      toast.success("Product deleted successfully");
    } catch (err) {
      toast.error("Failed to delete product");
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    toast.success("Product submitted for validation");
    setShowCreateForm(false);
    fetchProducts();
  };

  const renderFormStep = () => {
    switch(formStep) {
      case 1:
        return (
          <div className="space-y-6 animate-fade-in">
            <h3 className="text-lg font-bold text-crm-text-bright border-b border-crm-border pb-2 flex items-center gap-2"><FiInfo /> Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-crm-text-dim uppercase">Product Name</label>
                <input className="crm-input" placeholder="e.g. Pro Wireless Gaming Mouse" value={formData.name} onChange={e => setForm({...formData, name: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-crm-text-dim uppercase">Category</label>
                <select className="crm-input" value={formData.category} onChange={e => setForm({...formData, category: e.target.value})}>
                  <option value="">Select Category</option>
                  {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-crm-text-dim uppercase">Brand</label>
                <select className="crm-input" value={formData.brand} onChange={e => setForm({...formData, brand: e.target.value})}>
                  <option value="">Select or Create Brand</option>
                  {BRAND_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-crm-text-dim uppercase">Tags</label>
                <input className="crm-input" placeholder="New, Hot, Wired (comma separated)" value={formData.tags.join(", ")} onChange={e => setForm({...formData, tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean)})} />
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6 animate-fade-in">
            <h3 className="text-lg font-bold text-crm-text-bright border-b border-crm-border pb-2 flex items-center gap-2"><FiImage /> Media Assets</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-3">
                <div className="border-2 border-dashed border-crm-border rounded-xl p-12 text-center hover:border-crm-primary transition-colors cursor-pointer group">
                  <FiCamera size={40} className="mx-auto mb-4 text-crm-text-muted group-hover:text-crm-primary" />
                  <p className="text-crm-text-bright font-bold">Drop main product images here</p>
                  <p className="text-xs text-crm-text-dim mt-1">Unlimited uploads via Cloudinary integration</p>
                </div>
              </div>
              <div className="crm-card bg-crm-bg border-none flex flex-col items-center justify-center p-6 gap-3">
                <FiVideo size={30} className="text-crm-purple" />
                <span className="text-xs font-bold text-crm-text-dim uppercase">Product Video</span>
                <button className="crm-btn w-full text-xs">Upload MP4</button>
              </div>
              <div className="crm-card bg-crm-bg border-none flex flex-col items-center justify-center p-6 gap-3">
                <FiImage size={30} className="text-crm-cyan" />
                <span className="text-xs font-bold text-crm-text-dim uppercase">Landing Banner</span>
                <button className="crm-btn w-full text-xs">Upload Banner</button>
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6 animate-fade-in">
            <h3 className="text-lg font-bold text-crm-text-bright border-b border-crm-border pb-2 flex items-center gap-2"><FiDollarSign /> Pricing Structure</h3>
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-crm-primary uppercase tracking-widest">Basic Pricing</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-crm-text-dim uppercase">Current Price</label>
                    <input className="crm-input font-bold" type="number" placeholder="৳ 0.00" value={formData.price} onChange={e => setForm({...formData, price: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-crm-text-dim uppercase">Previous Price</label>
                    <input className="crm-input text-crm-text-muted line-through" type="number" placeholder="৳ 0.00" value={formData.previousPrice} onChange={e => setForm({...formData, previousPrice: e.target.value})} />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-crm-success uppercase tracking-widest">Retail Tiers (3 Levels)</h4>
                <div className="grid grid-cols-3 gap-2">
                  <input className="crm-input text-xs" placeholder="Tier 1" value={formData.retailTiers[0]} onChange={e => { const t = [...formData.retailTiers]; t[0] = e.target.value; setForm({...formData, retailTiers: t}); }} />
                  <input className="crm-input text-xs" placeholder="Tier 2" value={formData.retailTiers[1]} onChange={e => { const t = [...formData.retailTiers]; t[1] = e.target.value; setForm({...formData, retailTiers: t}); }} />
                  <input className="crm-input text-xs" placeholder="Tier 3" value={formData.retailTiers[2]} onChange={e => { const t = [...formData.retailTiers]; t[2] = e.target.value; setForm({...formData, retailTiers: t}); }} />
                </div>
              </div>
              <div className="col-span-2 space-y-4">
                <h4 className="text-xs font-bold text-crm-purple uppercase tracking-widest">Wholesale Tiers (3 Levels)</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-crm-bg border border-crm-border space-y-2">
                    <span className="text-[10px] font-bold text-crm-text-dim uppercase">Wholesale Level 1</span>
                    <input className="crm-input" placeholder="Price per unit" value={formData.wholesaleTiers[0]} onChange={e => { const t = [...formData.wholesaleTiers]; t[0] = e.target.value; setForm({...formData, wholesaleTiers: t}); }} />
                  </div>
                  <div className="p-4 rounded-xl bg-crm-bg border border-crm-border space-y-2">
                    <span className="text-[10px] font-bold text-crm-text-dim uppercase">Wholesale Level 2</span>
                    <input className="crm-input" placeholder="Price per unit" value={formData.wholesaleTiers[1]} onChange={e => { const t = [...formData.wholesaleTiers]; t[1] = e.target.value; setForm({...formData, wholesaleTiers: t}); }} />
                  </div>
                  <div className="p-4 rounded-xl bg-crm-bg border border-crm-border space-y-2">
                    <span className="text-[10px] font-bold text-crm-text-dim uppercase">Wholesale Level 3</span>
                    <input className="crm-input" placeholder="Price per unit" value={formData.wholesaleTiers[2]} onChange={e => { const t = [...formData.wholesaleTiers]; t[2] = e.target.value; setForm({...formData, wholesaleTiers: t}); }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-6 animate-fade-in">
            <h3 className="text-lg font-bold text-crm-text-bright border-b border-crm-border pb-2 flex items-center gap-2"><FiHash /> Inventory & SKU</h3>
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-crm-text-dim uppercase">Stock Count</label>
                <input className="crm-input text-lg font-bold" type="number" placeholder="0" value={formData.stock} onChange={e => setForm({...formData, stock: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-crm-text-dim uppercase">Product SKU</label>
                <div className="flex gap-2">
                  <input className="crm-input font-mono bg-crm-bg-hover" readOnly value={formData.sku || "OB-MOUSE-7A8B2C"} />
                  <button className="crm-btn text-xs">Regenerate</button>
                </div>
              </div>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-6 animate-fade-in">
            <h3 className="text-lg font-bold text-crm-text-bright border-b border-crm-border pb-2 flex items-center gap-2"><FiLayers /> Attributes & Specifications</h3>
            <div className="grid grid-cols-2 gap-x-12 gap-y-6">
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest border-b border-crm-border/30 pb-1">Detailed Attributes</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-xs text-crm-text-dim whitespace-nowrap">Application</span>
                    <input className="crm-input h-8 text-xs flex-1" value={formData.attributes.application} onChange={e => setForm({...formData, attributes: {...formData.attributes, application: e.target.value}})} />
                  </div>
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-xs text-crm-text-dim whitespace-nowrap">Ingredients</span>
                    <input className="crm-input h-8 text-xs flex-1" value={formData.attributes.ingredients} onChange={e => setForm({...formData, attributes: {...formData.attributes, ingredients: e.target.value}})} />
                  </div>
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-xs text-crm-text-dim whitespace-nowrap">Feature</span>
                    <input className="crm-input h-8 text-xs flex-1" value={formData.attributes.feature} onChange={e => setForm({...formData, attributes: {...formData.attributes, feature: e.target.value}})} />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest border-b border-crm-border/30 pb-1">Specifications</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-xs text-crm-text-dim whitespace-nowrap">Product Code</span>
                    <input className="crm-input h-8 text-xs flex-1" value={formData.specs.productCode} onChange={e => setForm({...formData, specs: {...formData.specs, productCode: e.target.value}})} />
                  </div>
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-xs text-crm-text-dim whitespace-nowrap">Shipping Weight</span>
                    <input className="crm-input h-8 text-xs flex-1" value={formData.specs.shipping} onChange={e => setForm({...formData, specs: {...formData.specs, shipping: e.target.value}})} />
                  </div>
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-xs text-crm-text-dim whitespace-nowrap">Dispatch Time</span>
                    <input className="crm-input h-8 text-xs flex-1" value={formData.specs.dispatch} onChange={e => setForm({...formData, specs: {...formData.specs, dispatch: e.target.value}})} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 6:
        return (
          <div className="space-y-6 animate-fade-in">
            <h3 className="text-lg font-bold text-crm-text-bright border-b border-crm-border pb-2 flex items-center gap-2"><FiCheckCircle /> Final Flags & Review</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="flex items-center gap-4 p-4 rounded-xl bg-crm-bg-hover cursor-pointer border border-transparent hover:border-crm-primary transition-all">
                  <input type="checkbox" className="w-5 h-5 rounded border-crm-border bg-crm-bg text-crm-primary" checked={formData.flags.featured} onChange={e => setForm({...formData, flags: {...formData.flags, featured: e.target.checked}})} />
                  <div>
                    <p className="text-sm font-bold text-crm-text-bright">Promote as Featured</p>
                    <p className="text-xs text-crm-text-dim">Displays on homepage featured sections</p>
                  </div>
                </label>
                <label className="flex items-center gap-4 p-4 rounded-xl bg-crm-bg-hover cursor-pointer border border-transparent hover:border-crm-primary transition-all">
                  <input type="checkbox" className="w-5 h-5 rounded border-crm-border bg-crm-bg text-crm-primary" checked={formData.flags.bestSeller} onChange={e => setForm({...formData, flags: {...formData.flags, bestSeller: e.target.checked}})} />
                  <div>
                    <p className="text-sm font-bold text-crm-text-bright">Mark as Best Seller</p>
                    <p className="text-xs text-crm-text-dim">Adds hot item badge on storefront</p>
                  </div>
                </label>
                <label className="flex items-center gap-4 p-4 rounded-xl bg-crm-bg-hover cursor-pointer border border-crm-warning/30 hover:border-crm-warning transition-all">
                  <input type="checkbox" className="w-5 h-5 rounded border-crm-border bg-crm-bg text-crm-warning" checked={formData.flags.reviewConfirmed} onChange={e => setForm({...formData, flags: {...formData.flags, reviewConfirmed: e.target.checked}})} />
                  <div>
                    <p className="text-sm font-bold text-crm-warning">Compliance Confirmation</p>
                    <p className="text-xs text-crm-text-dim">I confirm all product details are accurate</p>
                  </div>
                </label>
              </div>
              <div className="crm-card bg-crm-bg border-none flex flex-col items-center justify-center p-8 text-center space-y-4">
                <FiExternalLink size={40} className="text-crm-primary" />
                <h4 className="font-bold text-crm-text-bright">Live Storefront Preview</h4>
                <p className="text-xs text-crm-text-dim">See how this product will appear to your customers before publishing.</p>
                <button className="crm-btn crm-btn-primary w-full">Launch Preview Frame</button>
              </div>
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {!showForm ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
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
                  <button onClick={() => { setShowCreateForm(true); setFormStep(1); }} className="crm-btn crm-btn-primary">
                    <FiPlus /> New Product
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Total Products", count: items.length, icon: FiBox, color: "text-crm-primary" },
                { label: "Published", count: items.filter(p => p.status === 'active').length, icon: FiCheckCircle, color: "text-crm-success" },
                { label: "Low Stock", count: items.filter(p => (p.stock || 0) < 10).length, icon: FiTrendingUp, color: "text-crm-warning" },
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
              {["all", "active", "draft", "archived"].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 border-b-2 transition-all font-medium text-sm capitalize ${
                    activeTab === tab 
                      ? "border-crm-primary text-crm-primary bg-crm-primary-dim" 
                      : "border-transparent text-crm-text-dim hover:text-crm-text-bright hover:bg-crm-bg-hover"
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
                  placeholder="Search products by name, SKU, or ID..." 
                  className="crm-input pl-10" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button className="crm-btn" onClick={fetchProducts}>
                <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
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
                      <tr>
                        <td colSpan="6" className="text-center py-12 text-crm-text-dim">No products found</td>
                      </tr>
                    ) : (
                      filteredProducts.map((p) => (
                        <tr key={p.id} className="group">
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
                            <span className={`crm-badge border ${p.status === 'active' ? 'crm-badge-success' : 'text-crm-text-dim border-crm-border'}`}>
                              {p.status || 'draft'}
                            </span>
                          </td>
                          <td>
                            <p className="font-bold text-crm-text-bright tabular-nums">৳{Number(p.price || 0).toLocaleString()}</p>
                          </td>
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
                              <button className="p-1.5 rounded hover:bg-crm-bg-hover text-crm-text-dim hover:text-crm-primary transition-colors" title="Edit">
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
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="form"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            className="max-w-4xl mx-auto space-y-8 pb-20"
          >
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setShowCreateForm(false)}
                className="flex items-center gap-2 text-crm-text-dim hover:text-crm-primary transition-colors font-bold uppercase tracking-widest text-xs"
              >
                <FiChevronLeft size={20} /> Back to Catalog
              </button>
              <div className="flex gap-2">
                {[1,2,3,4,5,6].map(s => (
                  <div key={s} className={`h-1.5 w-8 rounded-full transition-all ${formStep >= s ? "bg-crm-primary shadow-lg shadow-crm-primary/30" : "bg-crm-bg-hover"}`} />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold text-crm-text-bright tracking-tight">Add New Product</h2>
                <p className="text-crm-text-dim">Step {formStep} of 6 — {
                  formStep === 1 ? "Identity" : 
                  formStep === 2 ? "Media" : 
                  formStep === 3 ? "Pricing" : 
                  formStep === 4 ? "Inventory" : 
                  formStep === 5 ? "Specs" : "Review"
                }</p>
              </div>
              <div className="flex items-center gap-3">
                {formStep > 1 && (
                  <button onClick={() => setFormStep(formStep - 1)} className="crm-btn px-6">
                    Previous
                  </button>
                )}
                {formStep < 6 ? (
                  <button onClick={() => setFormStep(formStep + 1)} className="crm-btn crm-btn-primary px-10">
                    Next Step <FiChevronRight />
                  </button>
                ) : (
                  <button onClick={handleCreateSubmit} className="crm-btn crm-btn-primary px-12 bg-crm-success border-crm-success hover:bg-crm-success-hover">
                    Publish Product <FiCheckCircle />
                  </button>
                )}
              </div>
            </div>

            <div className="crm-card p-10 bg-crm-bg-alt shadow-2xl ring-1 ring-crm-border">
              {renderFormStep()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
