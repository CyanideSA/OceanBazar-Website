import React, { useState } from "react";
import { adminApi } from "../../lib/api";
import { useCatalogStore } from "../../stores/catalogStore";
import {
  IconClose, IconFolder, IconPackage, IconTrash, IconMove,
  IconEdit, IconBulkUpload, IconCheck, IconBanner, IconImage, IconPlus
} from "./ExplorerIcons";

function ModalWrapper({ title, icon, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{icon}{title}</h3>
          <button className="modal-close" onClick={onClose}>
            <IconClose size={13} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ─── Create Category ─────────────────────────────────────────
export function CreateCategoryModal({ data, onClose, onSuccess }) {
  const [nameEn, setNameEn] = useState("");
  const [nameBn, setNameBn] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nameEn.trim()) { setError("Name is required"); return; }
    setLoading(true); setError("");
    try {
      await adminApi.createCategory({ name: nameEn.trim(), nameBn: nameBn.trim() || nameEn.trim(), parentId: data?.parentId || null });
      onSuccess(); onClose();
    } catch (err) { setError(err?.response?.data?.message || "Failed to create category"); }
    finally { setLoading(false); }
  };

  return (
    <ModalWrapper title="New Folder" icon={<IconFolder size={14} color="#e3b341" />} onClose={onClose}>
      <form onSubmit={handleSubmit} className="modal-form">
        {error && <div className="form-error">{error}</div>}
        <div className="form-group">
          <span className="form-label">Name (English)</span>
          <input className="form-input" value={nameEn} onChange={(e) => setNameEn(e.target.value)} autoFocus placeholder="e.g. Electronics" />
        </div>
        <div className="form-group">
          <span className="form-label">Name (বাংলা)</span>
          <input className="form-input" value={nameBn} onChange={(e) => setNameBn(e.target.value)} placeholder="e.g. ইলেকট্রনিক্স" />
        </div>
        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            <IconCheck size={12} />{loading ? "Creating…" : "Create Folder"}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

// ─── Rename Category ──────────────────────────────────────────
export function RenameCategoryModal({ data, onClose, onSuccess }) {
  const [nameEn, setNameEn] = useState(data?.node?.nameEn || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nameEn.trim()) { setError("Name is required"); return; }
    setLoading(true); setError("");
    try {
      await adminApi.updateCategory(data.node.id, { name: nameEn.trim() });
      onSuccess(); onClose();
    } catch (err) { setError(err?.response?.data?.message || "Failed to rename"); }
    finally { setLoading(false); }
  };

  return (
    <ModalWrapper title="Rename Folder" icon={<IconEdit size={14} />} onClose={onClose}>
      <form onSubmit={handleSubmit} className="modal-form">
        {error && <div className="form-error">{error}</div>}
        <div className="form-group">
          <span className="form-label">New Name</span>
          <input className="form-input" value={nameEn} onChange={(e) => setNameEn(e.target.value)} autoFocus />
        </div>
        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            <IconCheck size={12} />{loading ? "Saving…" : "Rename"}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────
export function DeleteConfirmModal({ data, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [force, setForce] = useState(false);
  const [error, setError] = useState("");
  const isCategory = data?.type === "category";
  const name = data?.node?.nameEn || data?.node?.titleEn || "this item";

  const handleDelete = async () => {
    setLoading(true); setError("");
    try {
      if (isCategory) { await adminApi.deleteCategory(data.node.id, force); }
      else { await adminApi.deleteProduct(data.node.id); }
      onSuccess(); onClose();
    } catch (err) { setError(err?.response?.data?.message || "Delete failed"); setLoading(false); }
  };

  return (
    <ModalWrapper title={`Delete ${isCategory ? "Folder" : "Product"}`} icon={<IconTrash size={14} color="#f85149" />} onClose={onClose}>
      <div className="modal-form">
        {error && <div className="form-error">{error}</div>}
        <p style={{ color: "#c9d1d9", fontSize: 13, marginBottom: 14 }}>
          Are you sure you want to delete <strong style={{ color: "#e6edf3" }}>{name}</strong>?
          {isCategory && " This may contain sub-folders and products."}
        </p>
        {isCategory && (
          <label className="form-checkbox-group" style={{ marginBottom: 14 }}>
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
            <span className="form-checkbox-label">Force delete (including all sub-folders and products)</span>
          </label>
        )}
        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button className="btn-danger" onClick={handleDelete} disabled={loading}>
            <IconTrash size={12} />{loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

// ─── Move To Modal ────────────────────────────────────────────
export function MoveToModal({ data, onClose, onSuccess }) {
  const [targetCategoryId, setTargetCategoryId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { tree } = useCatalogStore();

  const flattenTree = (nodes, depth = 0) => {
    const result = [];
    for (const n of nodes) {
      result.push({ ...n, _depth: depth });
      if (n.children) result.push(...flattenTree(n.children, depth + 1));
    }
    return result;
  };
  const flatList = flattenTree(tree);

  const handleMove = async () => {
    if (!targetCategoryId) { setError("Select a target folder"); return; }
    setLoading(true); setError("");
    try {
      if (data?.type === "category") { await adminApi.moveCategory(data.node.id, { newParentId: targetCategoryId }); }
      else { await adminApi.moveProduct(data.node.id, targetCategoryId); }
      onSuccess(); onClose();
    } catch (err) { setError(err?.response?.data?.message || "Move failed"); setLoading(false); }
  };

  return (
    <ModalWrapper title="Move To…" icon={<IconMove size={14} />} onClose={onClose}>
      <div className="modal-form">
        {error && <div className="form-error">{error}</div>}
        <div className="form-group">
          <span className="form-label">Target Folder</span>
          <select
            className="form-select"
            value={targetCategoryId}
            onChange={(e) => setTargetCategoryId(e.target.value)}
            size={8}
            style={{ height: "180px" }}
          >
            <option value="">— Root —</option>
            {flatList.map((c) => (
              <option key={c.id} value={c.id} disabled={c.id === data?.node?.id}>
                {"  ".repeat(c._depth)}{c.nameEn}
              </option>
            ))}
          </select>
        </div>
        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button className="btn-primary" onClick={handleMove} disabled={loading}>
            <IconCheck size={12} />{loading ? "Moving…" : "Move Here"}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

// ─── Create Product Modal ─────────────────────────────────────
export function CreateProductModal({ data, onClose, onSuccess }) {
  const [form, setForm] = useState({ titleEn: "", titleBn: "", sku: "", stock: 0, moq: 1, status: "draft" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.titleEn.trim()) { setError("Product name is required"); return; }
    setLoading(true); setError("");
    try {
      await adminApi.createProduct({
        ...form,
        titleBn: form.titleBn || form.titleEn,
        categoryId: data?.categoryId,
        stock: Number(form.stock),
        moq: Number(form.moq),
      });
      onSuccess(); onClose();
    } catch (err) { setError(err?.response?.data?.message || "Failed to create product"); }
    finally { setLoading(false); }
  };

  return (
    <ModalWrapper title="New Product" icon={<IconPackage size={14} color="#79c0ff" />} onClose={onClose}>
      <form onSubmit={handleSubmit} className="modal-form">
        {error && <div className="form-error">{error}</div>}
        <div className="form-group">
          <span className="form-label">Name (English)</span>
          <input className="form-input" value={form.titleEn} onChange={(e) => set("titleEn", e.target.value)} autoFocus placeholder="Product name" />
        </div>
        <div className="form-group">
          <span className="form-label">Name (বাংলা)</span>
          <input className="form-input" value={form.titleBn} onChange={(e) => set("titleBn", e.target.value)} />
        </div>
        <div className="form-group">
          <span className="form-label">SKU</span>
          <input className="form-input" value={form.sku} onChange={(e) => set("sku", e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <span className="form-label">Stock</span>
            <input className="form-input" type="number" min="0" value={form.stock} onChange={(e) => set("stock", e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <span className="form-label">MOQ</span>
            <input className="form-input" type="number" min="1" value={form.moq} onChange={(e) => set("moq", e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <span className="form-label">Status</span>
          <select className="form-select" value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
          </select>
        </div>
        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            <IconCheck size={12} />{loading ? "Creating…" : "Create Product"}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

// ─── Bulk Upload Modal ────────────────────────────────────────
export function BulkUploadModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) { setFile(f); setResult(null); setError(""); }
  };

  const handleUpload = async () => {
    if (!file) { setError("Select a CSV or JSON file"); return; }
    setLoading(true); setError("");
    try {
      const res = await adminApi.bulkUpload(file);
      setResult(res);
      onSuccess?.();
    } catch (err) { setError(err?.response?.data?.message || "Upload failed"); }
    finally { setLoading(false); }
  };

  return (
    <ModalWrapper title="Bulk Upload" icon={<IconBulkUpload size={14} color="#79c0ff" />} onClose={onClose}>
      <div className="modal-form">
        {error && <div className="form-error">{error}</div>}
        {result ? (
          <div style={{ background: "#1a3a1a", border: "1px solid #2ea04326", borderRadius: 6, padding: 12, color: "#56d364", fontSize: 13 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>✓ {result.status}</div>
            <div>{result.message}</div>
            <div style={{ marginTop: 6, fontSize: 11, color: "#8b949e" }}>{result.fileName} — {result.sizeBytes} bytes</div>
          </div>
        ) : (
          <>
            <p style={{ color: "#8b949e", fontSize: 12, marginBottom: 14 }}>
              Upload a <strong style={{ color: "#c9d1d9" }}>.csv</strong> or <strong style={{ color: "#c9d1d9" }}>.json</strong> file to bulk-import products. The file will be queued for processing.
            </p>
            <div className="form-group">
              <span className="form-label">File</span>
              <input
                className="form-input"
                type="file"
                accept=".csv,.json"
                onChange={handleFileChange}
                style={{ cursor: "pointer" }}
              />
            </div>
            {file && (
              <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 10 }}>
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </div>
            )}
          </>
        )}
        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn-ghost">{result ? "Close" : "Cancel"}</button>
          {!result && (
            <button className="btn-primary" onClick={handleUpload} disabled={loading || !file}>
              <IconBulkUpload size={12} />{loading ? "Uploading…" : "Upload"}
            </button>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
}

// ─── Banner Manager Modal ─────────────────────────────────────
export function BannerManagerModal({ data, onClose, onSuccess }) {
  const [activeTab, setActiveTab] = useState("current");
  const [loading, setLoading] = useState(false);
  const [banners, setBanners] = useState([
    { id: 1, imageUrl: "https://via.placeholder.com/800x200", type: "Hero", active: true },
    { id: 2, imageUrl: "https://via.placeholder.com/400x150", type: "Sidebar", active: false },
  ]);
  const [newBanner, setNewBanner] = useState({ file: null, type: "hero", weight: 5 });
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!newBanner.file) { setError("Select an image first"); return; }
    setLoading(true); setError("");
    try {
      // Mock upload
      setTimeout(() => {
        setBanners(prev => [...prev, { 
          id: Date.now(), 
          imageUrl: URL.createObjectURL(newBanner.file), 
          type: newBanner.type, 
          active: true 
        }]);
        setNewBanner({ file: null, type: "hero", weight: 5 });
        setActiveTab("current");
        setLoading(false);
        onSuccess?.();
      }, 1000);
    } catch (err) { setError("Upload failed"); setLoading(false); }
  };

  const deleteBanner = (id) => {
    setBanners(prev => prev.filter(b => b.id !== id));
  };

  return (
    <ModalWrapper title={`Manage Banners — ${data?.node?.nameEn || data?.node?.titleEn}`} icon={<IconBanner size={14} color="#39c5cf" />} onClose={onClose}>
      <div className="banner-manager">
        <div className="tab-nav" style={{ display: "flex", gap: 10, marginBottom: 16, borderBottom: "1px solid var(--crm-border)" }}>
          <button onClick={() => setActiveTab("current")} className={`tab-btn ${activeTab === "current" ? "active" : ""}`} style={{ padding: "8px 12px", background: "none", border: "none", borderBottom: activeTab === "current" ? "2px solid var(--crm-primary)" : "none", color: activeTab === "current" ? "var(--crm-text-bright)" : "var(--crm-text-dim)", cursor: "pointer" }}>Current Banners</button>
          <button onClick={() => setActiveTab("upload")} className={`tab-btn ${activeTab === "upload" ? "active" : ""}`} style={{ padding: "8px 12px", background: "none", border: "none", borderBottom: activeTab === "upload" ? "2px solid var(--crm-primary)" : "none", color: activeTab === "upload" ? "var(--crm-text-bright)" : "var(--crm-text-dim)", cursor: "pointer" }}>Upload New</button>
        </div>

        {activeTab === "current" ? (
          <div className="banners-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, maxHeight: 400, overflowY: "auto", paddingRight: 4 }}>
            {banners.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--crm-text-dim)" }}>No banners assigned yet</div>
            ) : (
              banners.map(b => (
                <div key={b.id} className="banner-card" style={{ border: "1px solid var(--crm-border)", borderRadius: 8, overflow: "hidden", position: "relative" }}>
                  <img src={b.imageUrl} alt="Banner" style={{ width: "100%", height: 100, objectFit: "cover" }} />
                  <div style={{ padding: 8, display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--crm-bg-alt)" }}>
                    <div className="flex items-center gap-2">
                      <span className="crm-badge">{b.type}</span>
                      {b.active && <span className="crm-badge crm-badge-success">Active</span>}
                    </div>
                    <button onClick={() => deleteBanner(b.id)} className="text-crm-danger hover:underline text-xs">Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="modal-form">
            {error && <div className="form-error">{error}</div>}
            <div className="form-group">
              <span className="form-label">Banner Image</span>
              <input type="file" className="form-input" accept="image/*" onChange={(e) => setNewBanner(prev => ({ ...prev, file: e.target.files[0] }))} />
            </div>
            <div className="form-group">
              <span className="form-label">Display Slot</span>
              <select className="form-select" value={newBanner.type} onChange={(e) => setNewBanner(prev => ({ ...prev, type: e.target.value }))}>
                <option value="hero">Hero Banner (Full Width)</option>
                <option value="sidebar">Sidebar (Vertical)</option>
                <option value="grid">Grid In-fill (Square)</option>
              </select>
            </div>
            <div className="form-group">
              <span className="form-label">Random Weight (1-10)</span>
              <input type="number" className="form-input" min="1" max="10" value={newBanner.weight} onChange={(e) => setNewBanner(prev => ({ ...prev, weight: e.target.value }))} />
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => setActiveTab("current")} className="btn-ghost">Cancel</button>
              <button onClick={handleUpload} className="btn-primary" disabled={loading || !newBanner.file}>
                <IconImage size={12} />{loading ? "Uploading…" : "Upload & Assign"}
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalWrapper>
  );
}
