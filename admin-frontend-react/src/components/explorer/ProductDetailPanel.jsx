import React, { useState, useEffect, useCallback } from "react";
import { adminApi } from "../../lib/api";
import { useCatalogStore } from "../../stores/catalogStore";
import {
  IconClose, IconInfo, IconPricing, IconImage, IconTag, IconVariants,
  IconSettings, IconSpinner, IconPackage, IconStar, IconPlus, IconTrash,
  IconEdit, IconCheck, IconUpload,
} from "./ExplorerIcons";

const TABS = [
  { id: "Info",       icon: <IconInfo size={12} />,     label: "Info" },
  { id: "Pricing",    icon: <IconPricing size={12} />,  label: "Pricing" },
  { id: "Media",      icon: <IconImage size={12} />,    label: "Media" },
  { id: "Attributes", icon: <IconSettings size={12} />, label: "Attrs" },
  { id: "Tags",       icon: <IconTag size={12} />,      label: "Tags" },
  { id: "Variants",   icon: <IconVariants size={12} />, label: "Variants" },
];

export default function ProductDetailPanel({ onClose, onProductUpdated }) {
  const { openProductId, productDetail, setProductDetail, loadingDetail, setLoadingDetail } = useCatalogStore();
  const [activeTab, setActiveTab] = useState("Info");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);

  const loadDetail = useCallback(async () => {
    if (!openProductId) return;
    setLoadingDetail(true);
    try {
      const d = await adminApi.productDetail(openProductId);
      setProductDetail(d);
      setForm({
        titleEn: d.titleEn || "",
        titleBn: d.titleBn || "",
        descriptionEn: d.descriptionEn || "",
        sku: d.sku || "",
        status: d.status || "draft",
        stock: d.stock ?? 0,
        moq: d.moq ?? 1,
        weight: d.weight || "",
        seoTitle: d.seoTitle || "",
        seoDescription: d.seoDescription || "",
        isFeatured: d.isFeatured || false,
      });
    } catch { /* ignore */ }
    finally { setLoadingDetail(false); }
  }, [openProductId, setProductDetail, setLoadingDetail]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const setField = useCallback((f, v) => setForm((prev) => ({ ...prev, [f]: v })), []);

  const handleSave = async () => {
    if (!form || !openProductId) return;
    setSaving(true);
    try {
      await adminApi.updateProduct(openProductId, {
        ...productDetail,
        ...form,
        stock: Number(form.stock),
        moq: Number(form.moq),
        weight: form.weight ? Number(form.weight) : null,
      });
      await loadDetail();
      onProductUpdated?.();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  if (loadingDetail) {
    return (
      <div className="product-detail-panel">
        <div className="detail-loading">
          <IconSpinner size={16} color="#484f58" />
          Loading product…
        </div>
      </div>
    );
  }

  if (!productDetail || !form) return null;

  const thumbUrl = productDetail.assets?.find((a) => a.isPrimary)?.url
    || productDetail.assets?.[0]?.url;

  return (
    <div className="product-detail-panel animate-fade-in bg-crm-bg-alt border-l border-crm-border">
      {/* Header */}
      <div className="detail-header p-4 border-b border-crm-border flex items-center justify-between">
        <div className="detail-title flex items-center gap-3">
          {thumbUrl
            ? <img src={thumbUrl} className="w-12 h-12 rounded-lg object-cover border border-crm-border shadow-sm" alt="" />
            : <div className="w-12 h-12 rounded-lg bg-crm-bg-hover flex items-center justify-center text-crm-text-muted"><IconPackage size={22} /></div>}
          <div className="detail-title-text min-w-0">
            <h3 className="font-bold text-crm-text-bright truncate">{productDetail.titleEn}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`crm-badge border ${productDetail.status === 'active' ? 'crm-badge-success' : 'text-crm-text-dim border-crm-border'}`}>{productDetail.status}</span>
              {productDetail.sku && <span className="text-[10px] text-crm-text-dim font-mono uppercase tracking-widest">SKU: {productDetail.sku}</span>}
              {productDetail.isFeatured && <FiStar className="text-crm-warning fill-current" size={12} />}
            </div>
          </div>
        </div>
        <button className="p-2 hover:bg-crm-bg-hover rounded-full text-crm-text-dim transition-colors" onClick={onClose} title="Close (Esc)">
          <IconClose size={13} />
        </button>
      </div>

      {/* Tabs */}
      <div className="detail-tabs flex border-b border-crm-border bg-crm-bg/30 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`px-4 py-3 text-xs font-bold uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${
              activeTab === t.id 
                ? "border-crm-primary text-crm-primary bg-crm-primary-dim" 
                : "border-transparent text-crm-text-dim hover:text-crm-text-bright hover:bg-crm-bg-hover"
            }`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="detail-content flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="detail-content-inner animate-fade-in">
          {activeTab === "Info" && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-crm-text-dim uppercase">Product Name (EN)</label>
                  <input className="crm-input" value={form.titleEn} onChange={(e) => setField("titleEn", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-crm-text-dim uppercase">Product Name (BN)</label>
                  <input className="crm-input" value={form.titleBn} onChange={(e) => setField("titleBn", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-crm-text-dim uppercase">Description</label>
                  <textarea className="crm-input min-h-[100px]" rows={4} value={form.descriptionEn} onChange={(e) => setField("descriptionEn", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-crm-text-dim uppercase">Internal SKU</label>
                    <input className="crm-input font-mono" value={form.sku} onChange={(e) => setField("sku", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-crm-text-dim uppercase">Visibility Status</label>
                    <select className="crm-input" value={form.status} onChange={(e) => setField("status", e.target.value)}>
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-crm-text-dim uppercase">Available Stock</label>
                    <input className="crm-input tabular-nums" type="number" min="0" value={form.stock} onChange={(e) => setField("stock", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-crm-text-dim uppercase">Min. Order Qty</label>
                    <input className="crm-input tabular-nums" type="number" min="1" value={form.moq} onChange={(e) => setField("moq", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-crm-text-dim uppercase">Weight (kg)</label>
                    <input className="crm-input tabular-nums" type="number" step="0.001" value={form.weight} onChange={(e) => setField("weight", e.target.value)} />
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" className="w-4 h-4 rounded border-crm-border bg-crm-bg text-crm-primary focus:ring-crm-primary" checked={form.isFeatured} onChange={(e) => setField("isFeatured", e.target.checked)} />
                  <span className="text-sm font-medium text-crm-text-dim group-hover:text-crm-text-bright transition-colors">Promote as Featured Product</span>
                </label>
              </div>

              <div className="pt-6 border-t border-crm-border space-y-4">
                <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest flex items-center gap-2"><FiTarget /> SEO Optimization</h4>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-crm-text-dim uppercase">SEO Title</label>
                    <input className="crm-input" value={form.seoTitle} onChange={(e) => setField("seoTitle", e.target.value)} placeholder="Meta title for search engines" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-crm-text-dim uppercase">SEO Meta Description</label>
                    <textarea className="crm-input min-h-[60px]" rows={2} value={form.seoDescription} onChange={(e) => setField("seoDescription", e.target.value)} placeholder="Brief summary for SERP" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "Pricing" && (
            <PricingTab productId={openProductId} productDetail={productDetail} onRefresh={loadDetail} />
          )}

          {activeTab === "Media" && (
            <MediaTab productId={openProductId} onRefresh={loadDetail} />
          )}

          {activeTab === "Attributes" && (
            <AttributesTab productDetail={productDetail} />
          )}

          {activeTab === "Tags" && (
            <TagsTab productId={openProductId} currentTags={productDetail.tags || []} onRefresh={loadDetail} />
          )}

          {activeTab === "Variants" && (
            <VariantsTab productDetail={productDetail} />
          )}
        </div>
      </div>

      {/* Footer */}
      {activeTab === "Info" && (
        <div className="detail-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><IconSpinner size={13} />Saving…</> : <><IconCheck size={13} />Save Changes</>}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Pricing Tab ──────────────────────────────────────────── */
function PricingTab({ productId, productDetail, onRefresh }) {
  const pricing = productDetail.pricing || [];
  const [editingId, setEditingId] = useState(null);
  const [addingType, setAddingType] = useState(null);
  const [saving, setSaving] = useState(false);

  const TYPES = ["RETAIL", "WHOLESALE", "VIP", "RESELLER"];
  const existingTypes = pricing.map((p) => p.customerType);
  const unusedTypes = TYPES.filter((t) => !existingTypes.includes(t));

  const [editForm, setEditForm] = useState({});
  const startEdit = (p) => {
    setEditingId(p.id);
    setAddingType(null);
    setEditForm({
      price: p.price || "",
      compareAt: p.compareAt || "",
      tier1MinQty: p.tier1MinQty || "",
      tier1Discount: p.tier1Discount || "",
      tier2MinQty: p.tier2MinQty || "",
      tier2Discount: p.tier2Discount || "",
      tier3MinQty: p.tier3MinQty || "",
      tier3Discount: p.tier3Discount || "",
    });
  };

  const startAdd = (type) => {
    setAddingType(type);
    setEditingId(null);
    setEditForm({ price: "", compareAt: "", tier1MinQty: "", tier1Discount: "", tier2MinQty: "", tier2Discount: "", tier3MinQty: "", tier3Discount: "" });
  };

  const cancelEdit = () => { setEditingId(null); setAddingType(null); };

  const handleSaveEdit = async (existingPricingId) => {
    setSaving(true);
    try {
      const payload = {
        price: Number(editForm.price),
        compareAt: editForm.compareAt ? Number(editForm.compareAt) : null,
        tier1MinQty: editForm.tier1MinQty ? Number(editForm.tier1MinQty) : null,
        tier1Discount: editForm.tier1Discount ? Number(editForm.tier1Discount) : null,
        tier2MinQty: editForm.tier2MinQty ? Number(editForm.tier2MinQty) : null,
        tier2Discount: editForm.tier2Discount ? Number(editForm.tier2Discount) : null,
        tier3MinQty: editForm.tier3MinQty ? Number(editForm.tier3MinQty) : null,
        tier3Discount: editForm.tier3Discount ? Number(editForm.tier3Discount) : null,
      };
      if (existingPricingId) {
        await adminApi.updateProductPricing(productId, existingPricingId, payload);
      } else {
        await adminApi.upsertProductPricing(productId, { ...payload, customerType: addingType });
      }
      cancelEdit();
      onRefresh();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const handleDelete = async (pricingId) => {
    await adminApi.deleteProductPricing(productId, pricingId);
    onRefresh();
  };

  const ef = editForm;
  const setEf = (k, v) => setEditForm((prev) => ({ ...prev, [k]: v }));

  function EditForm({ onSave }) {
    return (
      <div className="pricing-edit-form">
        <div className="form-row" style={{ marginBottom: 8 }}>
          <div className="form-group">
            <span className="form-label">Base Price (৳)</span>
            <input className="form-input" type="number" step="0.01" value={ef.price} onChange={(e) => setEf("price", e.target.value)} autoFocus />
          </div>
          <div className="form-group">
            <span className="form-label">Compare At (৳)</span>
            <input className="form-input" type="number" step="0.01" value={ef.compareAt} onChange={(e) => setEf("compareAt", e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <div style={{ fontSize: 10, color: "#484f58", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>Bulk Tiers</div>
        {[1, 2, 3].map((n) => (
          <div key={n} className="form-row" style={{ marginBottom: 6 }}>
            <div className="form-group">
              <span className="form-label">Tier {n} Min Qty</span>
              <input className="form-input" type="number" min="1" value={ef[`tier${n}MinQty`]} onChange={(e) => setEf(`tier${n}MinQty`, e.target.value)} placeholder="—" />
            </div>
            <div className="form-group">
              <span className="form-label">Discount %</span>
              <input className="form-input" type="number" min="0" max="100" value={ef[`tier${n}Discount`]} onChange={(e) => setEf(`tier${n}Discount`, e.target.value)} placeholder="—" />
            </div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button className="btn-ghost" style={{ flex: 1 }} onClick={cancelEdit}>Cancel</button>
          <button className="btn-primary" style={{ flex: 1 }} onClick={onSave} disabled={saving}>
            {saving ? <IconSpinner size={12} /> : <IconCheck size={12} />}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {pricing.map((p) => (
        <div key={p.id}>
          <div className="pricing-type-header">
            <span className="pricing-type-label">
              <IconPricing size={12} color={p.customerType === "RETAIL" ? "#56d364" : "#79c0ff"} />
              {p.customerType}
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              <button className="btn-icon-sm" onClick={() => startEdit(p)} title="Edit"><IconEdit size={11} /></button>
              <button className="btn-icon-sm" style={{ color: "#f85149" }} onClick={() => handleDelete(p.id)} title="Delete"><IconTrash size={11} /></button>
            </div>
          </div>
          {editingId !== p.id && (
            <div className="pricing-card">
              <div className="pricing-base-row">
                <span className="pricing-amount">৳{p.price}</span>
                {p.compareAt && <span className="pricing-compare">৳{p.compareAt}</span>}
              </div>
              {(p.tier1MinQty || p.tier2MinQty || p.tier3MinQty) && (
                <div className="pricing-tiers">
                  {p.tier1MinQty && <span className="pricing-tier-badge">Qty {p.tier1MinQty}+: {p.tier1Discount}% off</span>}
                  {p.tier2MinQty && <span className="pricing-tier-badge">Qty {p.tier2MinQty}+: {p.tier2Discount}% off</span>}
                  {p.tier3MinQty && <span className="pricing-tier-badge">Qty {p.tier3MinQty}+: {p.tier3Discount}% off</span>}
                </div>
              )}
            </div>
          )}
          {editingId === p.id && <EditForm onSave={() => handleSaveEdit(p.id)} />}
        </div>
      ))}

      {addingType && (
        <div>
          <div className="pricing-type-header">
            <span className="pricing-type-label">
              <IconPlus size={12} color="#58a6ff" />
              New — {addingType}
            </span>
          </div>
          <EditForm onSave={() => handleSaveEdit(null)} />
        </div>
      )}

      {!addingType && unusedTypes.length > 0 && (
        <div style={{ marginTop: pricing.length > 0 ? 12 : 0 }}>
          <div style={{ fontSize: 10, color: "#484f58", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>Add Pricing</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {unusedTypes.map((t) => (
              <button key={t} className="btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => startAdd(t)}>
                <IconPlus size={10} />
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {pricing.length === 0 && !addingType && (
        <div className="pricing-empty-add" onClick={() => startAdd("RETAIL")}>
          <IconPlus size={14} />
          <div style={{ marginTop: 4 }}>Click to add pricing</div>
        </div>
      )}
    </div>
  );
}

/* ─── Media Tab ────────────────────────────────────────────── */
function MediaTab({ productId, onRefresh }) {
  const [assets, setAssets] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    adminApi.productAssets(productId).then(setAssets).catch(() => {});
  }, [productId]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      await adminApi.uploadProductAsset(productId, file, file.type.startsWith("video") ? "video" : "image");
      const updated = await adminApi.productAssets(productId);
      setAssets(updated);
      onRefresh();
    } catch { /* ignore */ }
    finally { setUploading(false); }
  };

  const handleDelete = async (assetId) => {
    await adminApi.deleteProductAsset(productId, assetId);
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
  };

  const handleSetPrimary = async (assetId) => {
    await adminApi.updateProductAsset(productId, assetId, { isPrimary: true });
    const updated = await adminApi.productAssets(productId);
    setAssets(updated);
    onRefresh();
  };

  return (
    <div>
      <div className="media-upload-bar">
        <label className={`btn-upload${uploading ? " disabled" : ""}`}>
          {uploading ? <><IconSpinner size={13} />Uploading…</> : <><IconUpload size={13} />Upload Image / Video</>}
          <input type="file" accept="image/*,video/*" onChange={handleUpload} disabled={uploading} hidden />
        </label>
        <span style={{ fontSize: 11, color: "#484f58" }}>{assets.length} file{assets.length !== 1 ? "s" : ""}</span>
      </div>
      {assets.length === 0 ? (
        <div className="tab-empty">No media yet. Upload images or videos above.</div>
      ) : (
        <div className="media-grid">
          {assets.map((a) => (
            <div key={a.id} className={`media-item${a.isPrimary ? " primary" : ""}`}>
              {a.assetType === "video"
                ? <video src={a.url} className="media-preview" muted />
                : <img src={a.url} className="media-preview" alt={a.altEn || ""} />}
              {a.isPrimary && <span className="primary-badge">Primary</span>}
              <div className="media-actions">
                {!a.isPrimary && (
                  <button onClick={() => handleSetPrimary(a.id)} title="Set as primary">
                    <IconStar size={11} />
                  </button>
                )}
                <button className="danger-sm" onClick={() => handleDelete(a.id)} title="Delete">
                  <IconTrash size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Attributes Tab ───────────────────────────────────────── */
function AttributesTab({ productDetail }) {
  const attrs = productDetail.attributes || [];
  if (attrs.length === 0) {
    return <div className="tab-empty">No attributes defined for this product.</div>;
  }
  return (
    <table className="attr-table">
      <thead>
        <tr><th>Attribute</th><th>Value</th></tr>
      </thead>
      <tbody>
        {attrs.map((a) => (
          <tr key={a.id}>
            <td style={{ color: "#8b949e" }}>{a.attrKey}</td>
            <td>{a.attrValue}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ─── Tags Tab ─────────────────────────────────────────────── */
function TagsTab({ productId, currentTags, onRefresh }) {
  const [allGroups, setAllGroups] = useState([]);
  const [selected, setSelected] = useState(new Set(currentTags.map((t) => t.id)));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.tagGroups().then(setAllGroups).catch(() => {});
  }, []);

  useEffect(() => {
    setSelected(new Set(currentTags.map((t) => t.id)));
  }, [currentTags]);

  const toggleTag = (id) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminApi.setProductTags(productId, [...selected]);
      onRefresh();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  if (allGroups.length === 0) {
    return <div className="tab-empty">No tag groups configured.</div>;
  }

  return (
    <div>
      {allGroups.map((group) => (
        <div key={group.id} className="tag-group">
          <div className="tag-group-label">
            <IconTag size={10} />
            {group.nameEn}
          </div>
          <div className="tag-chips">
            {(group.tags || []).map((tag) => (
              <button
                key={tag.id}
                className={`tag-chip${selected.has(tag.id) ? " selected" : ""}`}
                onClick={() => toggleTag(tag.id)}
              >
                {selected.has(tag.id) && <IconCheck size={10} />}
                {tag.nameEn}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div style={{ marginTop: 14 }}>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <><IconSpinner size={12} />Saving…</> : <><IconCheck size={12} />Save Tags</>}
        </button>
      </div>
    </div>
  );
}

/* ─── Variants Tab ─────────────────────────────────────────── */
const EMPTY_VARIANT = { nameEn: "", nameBn: "", sku: "", stock: 0, priceOverride: "", isActive: true, sortOrder: 0, attributes: "" };

function VariantsTab({ productDetail }) {
  const productId = productDetail.id;
  const [variants, setVariants] = useState(productDetail.variants || []);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_VARIANT);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    adminApi.productVariants(productId).then((d) => setVariants(Array.isArray(d) ? d : d.variants || [])).catch(() => {});
  }, [productId]);

  function parseAttrs(str) {
    if (!str) return "{}";
    try { JSON.parse(str); return str; } catch {}
    const obj = {};
    str.split(",").forEach((pair) => {
      const [k, v] = pair.split(":").map((s) => s.trim());
      if (k) obj[k] = v || "";
    });
    return JSON.stringify(obj);
  }

  function attrsToString(attrs) {
    if (!attrs) return "";
    try {
      const obj = typeof attrs === "string" ? JSON.parse(attrs) : attrs;
      return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join(", ");
    } catch { return String(attrs); }
  }

  async function handleSave() {
    if (!form.nameEn.trim()) { setErr("Name (EN) is required"); return; }
    setSaving(true); setErr("");
    try {
      const payload = {
        nameEn: form.nameEn.trim(),
        nameBn: form.nameBn.trim() || form.nameEn.trim(),
        sku: form.sku.trim() || null,
        stock: parseInt(form.stock, 10) || 0,
        priceOverride: form.priceOverride !== "" ? parseFloat(form.priceOverride) : null,
        isActive: form.isActive,
        sortOrder: parseInt(form.sortOrder, 10) || 0,
        attributes: parseAttrs(form.attributes),
      };
      let updated;
      if (editId) {
        updated = await adminApi.updateProductVariant(productId, editId, payload);
        setVariants((prev) => prev.map((v) => v.id === editId ? updated : v));
      } else {
        updated = await adminApi.createProductVariant(productId, payload);
        setVariants((prev) => [...prev, updated]);
      }
      setAdding(false); setEditId(null); setForm(EMPTY_VARIANT);
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || "Save failed");
    } finally { setSaving(false); }
  }

  async function handleDelete(variantId) {
    if (!window.confirm("Delete this variant?")) return;
    try {
      await adminApi.deleteProductVariant(productId, variantId);
      setVariants((prev) => prev.filter((v) => v.id !== variantId));
    } catch (e) { setErr(e?.response?.data?.detail || e.message || "Delete failed"); }
  }

  function startEdit(v) {
    setEditId(v.id);
    setForm({ nameEn: v.nameEn || "", nameBn: v.nameBn || "", sku: v.sku || "", stock: v.stock ?? 0, priceOverride: v.priceOverride ?? "", isActive: v.isActive !== false, sortOrder: v.sortOrder ?? 0, attributes: attrsToString(v.attributes) });
    setAdding(true);
  }

  function cancelForm() { setAdding(false); setEditId(null); setForm(EMPTY_VARIANT); setErr(""); }

  return (
    <div className="tab-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span className="section-label">Variants ({variants.length})</span>
        {!adding && (
          <button className="btn-xs btn-primary" onClick={() => { setAdding(true); setEditId(null); setForm(EMPTY_VARIANT); }}>
            <IconPlus size={11} /> Add Variant
          </button>
        )}
      </div>

      {adding && (
        <div className="form-group" style={{ background: "var(--bg-tertiary)", padding: 12, borderRadius: 6, marginBottom: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label className="form-label">Name EN *</label>
              <input className="form-input" value={form.nameEn} onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))} placeholder="e.g. Red / XL" />
            </div>
            <div>
              <label className="form-label">Name BN</label>
              <input className="form-input" value={form.nameBn} onChange={(e) => setForm((f) => ({ ...f, nameBn: e.target.value }))} placeholder="Bengali name" />
            </div>
            <div>
              <label className="form-label">SKU</label>
              <input className="form-input" value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} placeholder="SKU-001" />
            </div>
            <div>
              <label className="form-label">Stock</label>
              <input className="form-input" type="number" min="0" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Price Override (৳)</label>
              <input className="form-input" type="number" min="0" step="0.01" value={form.priceOverride} onChange={(e) => setForm((f) => ({ ...f, priceOverride: e.target.value }))} placeholder="Leave blank to use base price" />
            </div>
            <div>
              <label className="form-label">Sort Order</label>
              <input className="form-input" type="number" min="0" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <label className="form-label">Attributes (e.g. color: red, size: XL)</label>
            <input className="form-input" value={form.attributes} onChange={(e) => setForm((f) => ({ ...f, attributes: e.target.value }))} placeholder="color: red, size: XL, material: cotton" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
              Active
            </label>
          </div>
          {err && <div className="error-text" style={{ marginTop: 6 }}>{err}</div>}
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button className="btn-xs btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <IconSpinner size={11} /> : <IconCheck size={11} />} {editId ? "Update" : "Create"}
            </button>
            <button className="btn-xs btn-ghost" onClick={cancelForm}>Cancel</button>
          </div>
        </div>
      )}

      {variants.length === 0 && !adding && (
        <div className="tab-empty">No variants yet. Click "Add Variant" to create size, color, or other options.</div>
      )}

      {variants.map((v) => (
        <div key={v.id} className="variant-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div className="v-name">{v.nameEn || "Variant"}</div>
            <div className="v-meta">SKU: {v.sku || "—"} · Stock: {v.stock ?? 0} {v.priceOverride != null ? `· ৳${v.priceOverride}` : ""}</div>
            {v.attributes && v.attributes !== "{}" && (
              <div className="v-meta" style={{ color: "var(--accent)" }}>{attrsToString(v.attributes)}</div>
            )}
          </div>
          <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
            <span className={v.isActive !== false ? "badge-active" : "badge-inactive"} style={{ marginRight: 4 }}>
              {v.isActive !== false ? "Active" : "Inactive"}
            </span>
            <button className="icon-btn" title="Edit" onClick={() => startEdit(v)}><IconEdit size={12} /></button>
            <button className="icon-btn danger" title="Delete" onClick={() => handleDelete(v.id)}><IconTrash size={12} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}
