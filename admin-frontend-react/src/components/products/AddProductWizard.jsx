import { useEffect, useRef, useState, useCallback } from "react";
import {
  FiX, FiChevronLeft, FiChevronRight, FiCheck, FiInfo, FiImage,
  FiDollarSign, FiHash, FiLayers, FiFlag, FiEye, FiPlus, FiTrash2,
  FiUpload, FiStar, FiTrendingUp, FiPackage, FiRefreshCw, FiSearch,
  FiAlertCircle, FiFilm,
} from "react-icons/fi";
import { adminApi } from "../../lib/api";
import { useToast } from "../ToastProvider";
import RichTextEditor from "./RichTextEditor";
import MultiMediaUploader from "./MultiMediaUploader";
import { normalizeProductImageUrl } from "../../utils/mediaUrl";

const STEPS = [
  { id: 1, label: "Basic Info",     icon: FiInfo },
  { id: 2, label: "Media",          icon: FiImage },
  { id: 3, label: "Pricing",        icon: FiDollarSign },
  { id: 4, label: "Inventory",      icon: FiHash },
  { id: 5, label: "Description",    icon: FiLayers },
  { id: 6, label: "Final Flags",    icon: FiFlag },
  { id: 7, label: "Preview",        icon: FiEye },
];

const INITIAL_BAND = { minQty: "", maxQty: "", discount: "" };
const INITIAL_FORM = {
  titleEn: "", titleBn: "",
  selectedTagIds: [],
  assets: [],
  videoAssets: [],
  bannerAssets: [],
  pricingMode: "non_tiered",
  retailPrice: "", compareAt: "",
  retailBands: [{ ...INITIAL_BAND }],
  wholesalePrice: "", wholesaleCompareAt: "",
  wholesaleBands: [{ ...INITIAL_BAND }],
  stock: "", sku: "", moq: "1",
  categoryId: "", categoryName: "",
  brandId: "", brandName: "",
  descriptionEn: "",
  keyAttributes: [{ key: "", value: "" }],
  specifications: [],
  isFeatured: false, isBestRated: false, isTopTrending: false,
  complianceConfirmed: false,
};

function stripRetailBandsForApi(normalized) {
  return normalized.map(({ minQty, maxQty, discountPct }) => ({
    minQty,
    maxQty,
    discountPct,
  }));
}

function parseRetailBandsFromForm(rows) {
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const minS = String(r.minQty ?? "").trim();
    const maxS = String(r.maxQty ?? "").trim();
    const dS = String(r.discount ?? "").trim();
    if (!minS && !maxS && !dS) continue;
    if (!minS || !maxS || !dS) {
      return { error: `Retail tier row ${out.length + 1}: fill min qty, max qty, and discount %.` };
    }
    const minQty = Math.floor(Number(minS));
    const maxQty = Math.floor(Number(maxS));
    const discountPct = Number(dS);
    if (!Number.isFinite(minQty) || minQty < 1) return { error: `Retail tier: invalid min qty` };
    if (!Number.isFinite(maxQty) || maxQty < minQty) return { error: `Retail tier: max qty must be ≥ min qty` };
    if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 100) return { error: `Retail tier: discount must be 0–100` };
    out.push({ minQty, maxQty, discountPct });
  }
  if (!out.length) return { bands: null, lastRetailMax: null };
  const chainErr = validateRetailBandChain(out);
  if (chainErr) return { error: chainErr };
  return { bands: stripRetailBandsForApi(out), lastRetailMax: out[out.length - 1].maxQty };
}

function parseWholesaleBandsFromForm(rows, lastRetailMax) {
  const entries = [];
  for (const r of rows) {
    const minS = String(r.minQty ?? "").trim();
    const maxS = String(r.maxQty ?? "").trim();
    const dS = String(r.discount ?? "").trim();
    if (!minS && !maxS && !dS) continue;
    entries.push({ minS, maxS, dS });
  }
  if (!entries.length) return { bands: null };
  const out = [];
  for (let i = 0; i < entries.length; i++) {
    const { minS, maxS, dS } = entries[i];
    const isLast = i === entries.length - 1;
    if (!minS || !dS) {
      return { error: `Wholesale tier row ${out.length + 1}: fill min qty and discount % (${isLast ? "max optional on last tier" : "max required" }).` };
    }
    const minQty = Math.floor(Number(minS));
    const discountPct = Number(dS);
    let maxQty = null;
    if (maxS === "" && isLast) maxQty = null;
    else {
      if (!maxS && !isLast) return { error: "Wholesale tiers (except last) need max qty" };
      const m = Math.floor(Number(maxS));
      if (!Number.isFinite(m)) return { error: "Invalid wholesale max qty" };
      maxQty = m;
    }
    if (!Number.isFinite(minQty) || minQty < 1) return { error: "Invalid wholesale min qty" };
    if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 100) return { error: `Wholesale discount must be 0–100` };
    if (maxQty !== null && maxQty < minQty) return { error: "Wholesale max qty must be ≥ min qty" };
    out.push({ minQty, maxQty, discountPct });
  }
  const chainErr = validateWholesaleBandChain(out, lastRetailMax);
  if (chainErr) return { error: chainErr };
  return { bands: out.map(({ minQty, maxQty, discountPct }) => ({ minQty, maxQty, discountPct })) };
}

function validateRetailBandChain(normalized) {
  if (!normalized.length) return "Add at least one complete retail tier (min qty, max qty, discount %)";
  if (normalized[0].minQty !== 1) return "First retail tier must start at min qty 1";
  for (let i = 0; i < normalized.length; i++) {
    const b = normalized[i];
    if (!Number.isFinite(b.maxQty)) return "Each retail tier must have a max qty";
    if (i > 0 && b.minQty !== normalized[i - 1].maxQty + 1)
      return `Retail tier ${i + 1}: min qty must equal previous max + 1 (${normalized[i - 1].maxQty + 1})`;
  }
  return null;
}

function validateWholesaleBandChain(ws, retailLastMax) {
  if (!ws.length) return null;
  if (retailLastMax != null && ws[0].minQty !== retailLastMax + 1)
    return `First wholesale tier min qty must be ${retailLastMax + 1} (last retail max + 1)`;
  for (let i = 1; i < ws.length; i++) {
    const prev = ws[i - 1];
    if (prev.maxQty == null) return "Only the last wholesale tier may leave max qty empty (unlimited)";
    if (ws[i].minQty !== prev.maxQty + 1)
      return `Wholesale tier ${i + 1}: min qty must be ${prev.maxQty + 1}`;
  }
  return null;
}

/* ─── Category Tree Picker ──────────────────────────────────────────────── */
function CategoryPickerModal({ onSelect, onClose }) {
  const toast = useToast();
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState({});
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNameBn, setNewNameBn] = useState("");
  const [parentId, setParentId] = useState("");
  const [createMode, setCreateMode] = useState("root");
  const [newCatIcon, setNewCatIcon] = useState("");
  const [newCatImageUrl, setNewCatImageUrl] = useState("");
  const [newCatImageUploading, setNewCatImageUploading] = useState(false);

  const buildTreeFromFlat = useCallback((flat) => {
    const map = new Map(flat.map((c) => [c.id, { ...c, children: [] }]));
    const roots = [];
    for (const c of map.values()) {
      if (c.parentId && map.has(c.parentId)) map.get(c.parentId).children.push(c);
      else roots.push(c);
    }
    roots.forEach((r) => r.children.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
    return roots.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, []);

  const applyTreeNodes = useCallback((nodes) => {
    setTree(nodes);
    const initExpanded = {};
    nodes.forEach((n) => { if (n.children?.length) initExpanded[n.id] = true; });
    setExpanded(initExpanded);
    setError("");
  }, []);

  const loadCategoryTree = useCallback(async () => {
    setError("");
    let lastErr = null;
    const loaders = [
      { name: "categories/tree", fn: () => adminApi.categoryTree() },
      { name: "catalog-tree", fn: () => adminApi.catalogTree() },
      { name: "categories", fn: () => adminApi.categories() },
    ];

    for (const { name, fn } of loaders) {
      try {
        const r = await fn();
        if (typeof r === "string" || (r && typeof r === "object" && r.html)) {
          throw new Error("API returned HTML instead of JSON — check BFF URL (should be port 4000)");
        }
        const nested = Array.isArray(r) ? r : r?.tree;
        if (Array.isArray(nested) && nested.length > 0) {          applyTreeNodes(nested);
          return;
        }
        const flat = Array.isArray(r) ? r : r?.categories;
        if (Array.isArray(flat) && flat.length > 0) {          applyTreeNodes(buildTreeFromFlat(flat));
          return;
        }
      } catch (err) {
        lastErr = err;      }
    }

    if (lastErr?.response?.status === 401) {
      setError("Session expired. Please log out and sign in again, then retry.");
      return;
    }
    setError(
      lastErr?.response?.data?.error
        || lastErr?.message
        || "Failed to load categories. Ensure the API is running on port 4000."
    );
  }, [applyTreeNodes, buildTreeFromFlat]);

  useEffect(() => {
    loadCategoryTree().finally(() => setLoading(false));
  }, [loadCategoryTree]);

  const toggle = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const flattenNodes = useCallback((nodes) => {
    let out = [];
    for (const n of nodes) {
      out.push(n);
      if (n.children?.length) out = out.concat(flattenNodes(n.children));
    }
    return out;
  }, []);

  const flattenSearch = useCallback((nodes, q) => {
    let acc = [];
    for (const n of nodes) {
      if ((n.nameEn || "").toLowerCase().includes(q.toLowerCase())) acc.push(n);
      if (n.children?.length) acc = acc.concat(flattenSearch(n.children, q));
    }
    return acc;
  }, []);

  const renderNode = (node, depth = 0) => {
    const hasChildren = node.children?.length > 0;
    const isOpen = expanded[node.id];
    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-2 px-3 py-2 hover:bg-gray-700 cursor-pointer rounded transition-colors"
          style={{ paddingLeft: `${(depth * 16) + 12}px` }}
          onClick={() => onSelect(node.id, node.nameEn)}
        >
          {hasChildren ? (
            <button type="button" className="text-gray-400 hover:text-white"
              onClick={(e) => { e.stopPropagation(); toggle(node.id); }}>
              {isOpen ? "▾" : "▸"}
            </button>
          ) : <span className="w-4" />}
          <span className="text-sm text-gray-200">{node.nameEn}</span>
          {node.productCount > 0 && (
            <span className="text-xs text-gray-500 ml-auto">{node.productCount}</span>
          )}
        </div>
        {hasChildren && isOpen &&
          node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  const displayNodes = search.trim()
    ? flattenSearch(tree, search)
    : tree;
  const allNodes = flattenNodes(tree);

  const handleCreateCategory = async () => {
    const nameEn = String(newName || "").trim();
    if (!nameEn) {
      toast.error("Category name is required");
      return;
    }
    setCreating(true);
    try {
      await adminApi.createCategory({
        nameEn,
        nameBn: String(newNameBn || "").trim() || nameEn,
        parentId: createMode === "sub" ? (parentId || null) : null,
        icon: newCatIcon.trim() || null,
        imageUrl: newCatImageUrl.trim() || null,
      });
      setNewName("");
      setNewNameBn("");
      setParentId("");
      setNewCatIcon("");
      setNewCatImageUrl("");
      await loadCategoryTree();
      toast.success(createMode === "sub" ? "Subcategory created" : "Category created");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to create category");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-600 rounded-2xl w-96 max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h3 className="text-sm font-bold text-white">Select Category</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white"><FiX /></button>
        </div>
        <div className="px-3 py-2 border-b border-gray-700">
          <div className="relative">
            <FiSearch className="absolute left-2 top-2.5 text-gray-400" size={13} />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories…"
              className="w-full bg-gray-700 border border-gray-600 text-sm text-gray-200 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="mt-2 rounded-lg border border-gray-700 bg-gray-800/60 p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCreateMode("root")}
                className={`px-2 py-1 rounded text-[10px] font-semibold ${createMode === "root" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300"}`}
              >
                New Category
              </button>
              <button
                type="button"
                onClick={() => setCreateMode("sub")}
                className={`px-2 py-1 rounded text-[10px] font-semibold ${createMode === "sub" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300"}`}
              >
                New Subcategory
              </button>
            </div>
            {createMode === "sub" && (
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 text-xs text-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select parent category…</option>
                {allNodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.nameEn}</option>
                ))}
              </select>
            )}
            <div className="grid grid-cols-1 gap-1.5">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name (English) *"
                className="w-full bg-gray-700 border border-gray-600 text-xs text-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <input
                value={newNameBn}
                onChange={(e) => setNewNameBn(e.target.value)}
                placeholder="Name (Bangla, optional)"
                className="w-full bg-gray-700 border border-gray-600 text-xs text-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  value={newCatIcon}
                  onChange={(e) => setNewCatIcon(e.target.value)}
                  placeholder="Icon emoji (e.g. 📱)"
                  className="w-full bg-gray-700 border border-gray-600 text-xs text-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <label className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-gray-600 bg-gray-700/50 px-2 py-1.5 text-[10px] text-gray-300 cursor-pointer hover:border-blue-500">
                  <FiImage size={12}/>
                  {newCatImageUploading ? "…" : newCatImageUrl ? "Image ✓" : "Upload image"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={newCatImageUploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setNewCatImageUploading(true);
                      try {
                        const r = await adminApi.uploadMedia(file, "categories/labels");
                        setNewCatImageUrl(r.secureUrl || r.url || "");
                        setNewCatIcon("");
                      } catch {
                        toast.error("Image upload failed");
                      } finally {
                        setNewCatImageUploading(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
              </div>
              {newCatImageUrl && (
                <p className="text-[10px] text-green-400 truncate">Label image set (emoji cleared if uploaded)</p>
              )}
            </div>
            <button
              type="button"
              disabled={creating || (createMode === "sub" && !parentId)}
              onClick={handleCreateCategory}
              className="w-full rounded-lg bg-blue-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? "Creating…" : createMode === "sub" ? "Create subcategory" : "Create category"}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {loading ? (
            <div className="text-center text-gray-500 py-8 text-sm">Loading…</div>
          ) : error ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-xs text-red-400">{error}</p>
              <button type="button" className="text-xs text-blue-400 hover:underline"
                onClick={() => { setError(""); setLoading(true); loadCategoryTree().finally(() => setLoading(false)); }}>Retry</button>
            </div>
          ) : displayNodes.length === 0 ? (
            <div className="text-center text-gray-500 py-8 text-sm">No categories found</div>
          ) : displayNodes.map((n) => renderNode(n))}
        </div>
      </div>
    </div>
  );
}

/* ─── Brand Picker ─────────────────────────────────────────────────────── */
function BrandPicker({ value, onChange }) {
  const [brands, setBrands] = useState([]);
  const [search, setSearch] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const logoInputRef = useRef(null);

  useEffect(() => {
    adminApi.brands().then((r) => {
      const list = Array.isArray(r) ? r : r?.brands || [];
      setBrands(list);
    }).catch(() => {});
  }, []);

  const filtered = brands.filter((b) => {
    const n = typeof b === "string" ? b : b.nameEn || b.name || "";
    return n.toLowerCase().includes(search.toLowerCase());
  });
  const normalizedSearch = String(search || "").trim();
  const exactExists = filtered.some((b) => {
    const n = (typeof b === "string" ? b : b.nameEn || b.name || "").trim().toLowerCase();
    return n === normalizedSearch.toLowerCase();
  });
  const slugify = (v) => String(v || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);

  const handleCreateBrandWithLogo = async (file) => {
    if (!normalizedSearch || !file) return;
    setCreating(true);
    try {
      const up = await adminApi.uploadMedia(file, "brands/logos");
      const logoUrl = up.secureUrl || up.url;
      const created = await adminApi.createBrand({
        nameEn: normalizedSearch,
        nameBn: normalizedSearch,
        slug: slugify(normalizedSearch) || `brand-${Date.now()}`,
        active: true,
        logoUrl,
      });
      const brand = created?.brand || created;
      if (brand?.id) {
        setBrands((prev) => [brand, ...prev]);
        onChange(brand.id, brand.nameEn || normalizedSearch);
        setSearch(brand.nameEn || normalizedSearch);
        setOpen(false);
      }
    } catch {
      // silent
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative">
      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) handleCreateBrandWithLogo(file);
        }}
      />
      <input
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); onChange("", e.target.value); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search or type brand name…"
        className="crm-input w-full"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-xl shadow-xl max-h-48 overflow-y-auto">
          {filtered.map((b) => {
            const id = b?.id || "";
            const name = typeof b === "string" ? b : b.nameEn || b.name || "";
            return (
              <button key={id || name} type="button"
                onMouseDown={() => { onChange(id, name); setSearch(name); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2">
                {b.logoUrl && <img src={b.logoUrl} alt="" className="w-5 h-5 object-contain rounded" />}
                {name}
              </button>
            );
          })}
        </div>
      )}
      {open && normalizedSearch && !exactExists && (
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); logoInputRef.current?.click(); }}
          disabled={creating}
          className="mt-1 w-full rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-left text-xs text-blue-300 hover:bg-blue-500/20 disabled:opacity-50"
        >
          {creating ? "Creating brand…" : `+ Create "${normalizedSearch}" (logo required — pick image)`}
        </button>
      )}
    </div>
  );
}

/* ─── Media Uploader ───────────────────────────────────────────────────── */
function MediaUploader({ assets, onChange }) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const dragIdx = useRef(null);

  const uploadFile = async (file) => {
    return await adminApi.uploadProductMedia(file);
  };

  const handleFiles = async (files) => {
    if (!files.length) return;
    setUploading(true);
    const newAssets = [...assets];
    for (const file of Array.from(files)) {
      try {
        const result = await uploadFile(file);
        newAssets.push({
          url: result.secureUrl || result.url,
          publicId: result.publicId,
          assetType: "image",
          isPrimary: newAssets.length === 0,
          sortOrder: newAssets.length,
          _localName: file.name,
        });
      } catch {
        toast.error(`Failed to upload ${file.name}. Check file size and try again.`);
      }
    }
    onChange(newAssets);
    // #region agent log
    fetch('http://127.0.0.1:7768/ingest/4878ed05-f1ac-4ebb-915b-84a7969025f6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f9670f'},body:JSON.stringify({sessionId:'f9670f',location:'AddProductWizard:MediaUploader',message:'assets after upload batch',data:{count:newAssets.length,added:batch.length},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    setUploading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const setPrimary = (idx) => {
    onChange(assets.map((a, i) => ({ ...a, isPrimary: i === idx })));
  };

  const remove = (idx) => {
    const next = assets.filter((_, i) => i !== idx).map((a, i) => ({ ...a, sortOrder: i, isPrimary: i === 0 }));
    onChange(next);
  };

  const onDragStart = (idx) => { dragIdx.current = idx; };
  const onDragOver = (e, idx) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    const next = [...assets];
    const [moved] = next.splice(dragIdx.current, 1);
    next.splice(idx, 0, moved);
    dragIdx.current = idx;
    onChange(next.map((a, i) => ({ ...a, sortOrder: i, isPrimary: i === 0 })));
  };

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-500/5 transition-all group"
      >
        <FiUpload size={32} className="mx-auto mb-2 text-gray-500 group-hover:text-blue-400" />
        <p className="text-sm font-semibold text-gray-300">Drop images here or click to select</p>
        <p className="text-xs text-gray-500 mt-1">First image becomes primary · Supports JPG, PNG, WEBP · Multiple select</p>
        {uploading && <p className="text-xs text-blue-400 mt-2 animate-pulse">Uploading to Cloudinary…</p>}
        <input ref={fileRef} type="file" multiple accept="image/*" className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {/* Thumbnails */}
      {assets.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {assets.map((asset, idx) => (
            <div
              key={idx}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragOver={(e) => onDragOver(e, idx)}
              className={`relative group rounded-xl overflow-hidden border-2 cursor-grab transition-all ${
                asset.isPrimary ? "border-blue-500" : "border-gray-600 hover:border-gray-400"
              }`}
            >
              <img
                src={normalizeProductImageUrl ? normalizeProductImageUrl(asset.url) : asset.url}
                alt=""
                className="w-full aspect-square object-cover bg-gray-800"
                onError={(e) => { e.target.src = ""; e.target.style.background = "#374151"; }}
              />
              {asset.isPrimary && (
                <span className="absolute top-1 left-1 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                  PRIMARY
                </span>
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                {!asset.isPrimary && (
                  <button type="button" onClick={() => setPrimary(idx)}
                    className="text-xs bg-blue-600 text-white px-2 py-1 rounded font-semibold hover:bg-blue-700">
                    Set Primary
                  </button>
                )}
                <button type="button" onClick={() => remove(idx)}
                  className="text-xs bg-red-600 text-white px-2 py-1 rounded font-semibold hover:bg-red-700">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Unlimited key-value rows ─────────────────────────────────────────── */
function KVTable({ rows, onChange, addLabel = "Add Row" }) {
  const add = () => onChange([...rows, { key: "", value: "" }]);
  const remove = (i) => onChange(rows.filter((_, j) => j !== i));
  const update = (i, field, val) => {
    const next = [...rows];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-1.5 px-2 text-gray-400 font-medium w-2/5">Attribute</th>
            <th className="text-left py-1.5 px-2 text-gray-400 font-medium">Value</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-700/50">
              <td className="py-1 px-1">
                <input
                  value={row.key}
                  onChange={(e) => update(i, "key", e.target.value)}
                  placeholder="e.g. Material"
                  className="w-full bg-gray-800 border border-gray-600 text-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </td>
              <td className="py-1 px-1">
                <input
                  value={row.value}
                  onChange={(e) => update(i, "value", e.target.value)}
                  placeholder="e.g. Cotton"
                  className="w-full bg-gray-800 border border-gray-600 text-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </td>
              <td className="py-1 px-1 text-center">
                <button type="button" onClick={() => remove(i)} className="text-gray-500 hover:text-red-400 p-1">
                  <FiTrash2 size={12} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={add}
        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium mt-1">
        <FiPlus size={12} /> {addLabel}
      </button>
    </div>
  );
}

/* ─── Tier bands (retail caps + wholesale) ───────────────────────────────── */
function BandTierEditor({ bands, onChange, label, basePrice, wholesaleMode }) {
  const bp = Number(basePrice) || 0;
  const update = (i, field, val) => {
    const next = [...bands];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };
  const add = () => onChange([...bands, { ...INITIAL_BAND }]);
  const removeRow = (i) => {
    if (bands.length <= 1) return;
    onChange(bands.filter((_, j) => j !== i));
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <button type="button" onClick={add} className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300">
          <FiPlus size={12} /> Add tier
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[540px]">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-1.5 px-2 text-gray-500">#</th>
              <th className="text-left py-1.5 px-2 text-gray-500">Min qty</th>
              <th className="text-left py-1.5 px-2 text-gray-500">Max qty</th>
              <th className="text-left py-1.5 px-2 text-gray-500">Discount %</th>
              <th className="text-left py-1.5 px-2 text-gray-500">Unit price</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {bands.map((tier, i) => {
              const isLast = i === bands.length - 1;
              const disc = tier.discount === "" ? 0 : Number(tier.discount);
              const unit = bp && tier.discount !== ""
                ? (bp * (1 - disc / 100)).toFixed(2)
                : "—";
              return (
                <tr key={i} className="border-b border-gray-700/50">
                  <td className="py-1 px-2 text-gray-500">{i + 1}</td>
                  <td className="py-1 px-1">
                    <input type="number" min="1" value={tier.minQty}
                      onChange={(e) => update(i, "minQty", e.target.value)}
                      className="w-24 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                  </td>
                  <td className="py-1 px-1">
                    <input type="number" min="1"
                      value={tier.maxQty}
                      onChange={(e) => update(i, "maxQty", e.target.value)}
                      placeholder={wholesaleMode && isLast ? "optional" : ""}
                      className="w-28 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg px-2 py-1.5 text-xs placeholder:text-gray-600" />
                    {wholesaleMode && isLast && (
                      <p className="text-[9px] text-gray-600 mt-0.5">empty = unlimited</p>
                    )}
                  </td>
                  <td className="py-1 px-1">
                    <input type="number" min="0" max="100" value={tier.discount}
                      onChange={(e) => update(i, "discount", e.target.value)}
                      className="w-20 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                  </td>
                  <td className="py-1 px-2 text-green-400 font-mono">৳{unit}</td>
                  <td className="py-1 px-1 text-center">
                    <button type="button" onClick={() => removeRow(i)} className="text-gray-500 hover:text-red-400 disabled:opacity-30" disabled={bands.length <= 1}>
                      <FiTrash2 size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── SKU Generator ────────────────────────────────────────────────────── */
function generateSKU(title) {
  const prefix = (title || "PRD").replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase() || "PRD";
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const num = Date.now().toString(36).slice(-4).toUpperCase();
  return `OB-${prefix}-${rand}${num}`;
}

/* ─── Preview Card ─────────────────────────────────────────────────────── */
function ProductPreviewCard({ form }) {
  const primaryAsset = form.assets.find((a) => a.isPrimary) || form.assets[0];
  const price = form.retailPrice ? `৳${Number(form.retailPrice).toLocaleString()}` : "N/A";
  const compareAt = form.compareAt && Number(form.compareAt) > Number(form.retailPrice)
    ? `৳${Number(form.compareAt).toLocaleString()}` : null;
  const discount = compareAt
    ? Math.round((1 - Number(form.retailPrice) / Number(form.compareAt)) * 100) : null;

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-2xl overflow-hidden w-72 shadow-xl">
      <div className="relative bg-gray-700 h-56 flex items-center justify-center">
        {primaryAsset?.url ? (
          <img src={primaryAsset.url} alt={form.titleEn}
            className="w-full h-full object-cover" />
        ) : (
          <div className="text-gray-500 flex flex-col items-center gap-2">
            <FiImage size={40} />
            <span className="text-xs">No image</span>
          </div>
        )}
        {form.isFeatured && (
          <span className="absolute top-2 left-2 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded">Featured</span>
        )}
        {form.isBestRated && (
          <span className="absolute top-2 right-2 bg-violet-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">Best Rated</span>
        )}
        {discount && (
          <span className="absolute bottom-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">{discount}% OFF</span>
        )}
      </div>
      <div className="p-4">
        {form.categoryName && (
          <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider mb-1">{form.categoryName}</p>
        )}
        <h3 className="text-sm font-bold text-white leading-snug line-clamp-2">
          {form.titleEn || "Product Name"}
        </h3>
        {form.brandName && (
          <p className="text-xs text-gray-400 mt-0.5">{form.brandName}</p>
        )}
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-lg font-bold text-white">{price}</span>
          {compareAt && <span className="text-xs text-gray-500 line-through">{compareAt}</span>}
        </div>
        {form.stock && (
          <p className={`text-xs mt-1 font-medium ${Number(form.stock) < 10 ? "text-red-400" : "text-green-400"}`}>
            {Number(form.stock) < 10 ? `Only ${form.stock} left!` : `In stock · ${form.stock} units`}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-1">
          {form.selectedTagIds?.slice(0, 3).map((t, i) => (
            <span key={i} className="bg-gray-700 text-gray-300 text-[10px] px-2 py-0.5 rounded-full">{t.nameEn || t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN WIZARD
═══════════════════════════════════════════════════════════════════════ */
export default function AddProductWizard({ open, onClose, onSuccess, defaultCategoryId }) {
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ ...INITIAL_FORM, categoryId: defaultCategoryId || "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const publishInFlightRef = useRef(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [allTags, setAllTags] = useState([]);
  const [tagSearch, setTagSearch] = useState("");
  const [obTopTrendingTagId, setObTopTrendingTagId] = useState(null);

  const set = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }, []);

  // Fetch tags on mount
  useEffect(() => {
    if (!open) return;
    adminApi.tagGroups().then((r) => {
      const groups = Array.isArray(r) ? r : r?.groups || [];
      const flat = groups.flatMap((g) => g.tags || []);
      setAllTags(flat);
      const trending = flat.find((t) => t.slug === "ob_top_trending");
      if (trending) setObTopTrendingTagId(trending.id);
    }).catch(() => {});
  }, [open]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(1);
      setForm({ ...INITIAL_FORM, categoryId: defaultCategoryId || "" });
      setErrors({});
    }
  }, [open, defaultCategoryId]);

  const validate = () => {
    const e = {};
    if (!form.titleEn.trim()) e.titleEn = "Product name is required";
    if (step >= 3 && (!form.retailPrice || Number(form.retailPrice) <= 0))
      e.retailPrice = "Retail price is required";
    if (step >= 6 && !form.complianceConfirmed)
      e.complianceConfirmed = "Please confirm compliance before publishing";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goNext = () => {
    if (step === 1 && !form.titleEn.trim()) {
      setErrors({ titleEn: "Product name is required" });
      return;
    }
    if (step === 3 && (!form.retailPrice || Number(form.retailPrice) <= 0)) {
      setErrors({ retailPrice: "Retail price is required" });
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const handlePublish = async () => {    if (publishInFlightRef.current || submitting) return;
    if (!form.complianceConfirmed) {
      setErrors({ complianceConfirmed: "You must confirm compliance before publishing" });
      toast.error("Compliance required", "Check the compliance box on Step 6 (Final Flags) before publishing.");
      setStep(6);
      return;
    }
    if (!form.titleEn.trim()) { toast.error("Product name is required"); return; }
    if (!form.retailPrice || Number(form.retailPrice) <= 0) { toast.error("Retail price is required"); return; }
    publishInFlightRef.current = true;
    setSubmitting(true);

    try {
      const isTiered = form.pricingMode === "tiered";
      let retailTierBandsPayload = null;
      let wholesaleTierBandsPayload = null;
      let lastRetailMax = null;
      if (isTiered) {
        const rParse = parseRetailBandsFromForm(form.retailBands);
        if (rParse.error) {          toast.error("Retail tier error", rParse.error);
          setStep(3);
          publishInFlightRef.current = false;
          setSubmitting(false);
          return;
        }
        retailTierBandsPayload = rParse.bands;
        lastRetailMax = rParse.lastRetailMax;
        if (form.wholesalePrice && Number(form.wholesalePrice) > 0) {
          const wParse = parseWholesaleBandsFromForm(form.wholesaleBands, lastRetailMax);
          if (wParse.error) {            toast.error("Wholesale tier error", wParse.error);
            setStep(3);
            publishInFlightRef.current = false;
            setSubmitting(false);
            return;
          }
          wholesaleTierBandsPayload = wParse.bands;
        }
      }

      const created = await adminApi.createProduct({
        titleEn: form.titleEn.trim(),
        titleBn: form.titleBn.trim() || form.titleEn.trim(),
        isFeatured: form.isFeatured,
        isBestRated: form.isBestRated,
        pricingMode: form.pricingMode,
        retailPrice: Number(form.retailPrice),
        compareAt: form.compareAt ? Number(form.compareAt) : undefined,
        ...(form.wholesalePrice && Number(form.wholesalePrice) > 0 ? { wholesalePrice: Number(form.wholesalePrice) } : {}),
        stock: Number(form.stock) || 0,
        sku: form.sku || undefined,
        moq: Number(form.moq) || 1,
        brand: form.brandName || undefined,
        brandId: form.brandId || undefined,
        status: "draft",
        categoryId: form.categoryId || undefined,
      });

      const productId = created?.product?.id || created?.id;
      if (!productId) throw new Error("Product creation failed — no ID returned");
      const assetPayload = [
        ...form.assets.map((a, i) => ({
          url: a.url,
          publicId: a.publicId,
          assetType: a.assetType || "image",
          isPrimary: a.isPrimary ?? i === 0,
          sortOrder: i,
          altEn: form.titleEn || null,
        })),
        ...form.videoAssets.map((v, i) => ({
          url: v.url,
          publicId: v.publicId,
          assetType: "video",
          isPrimary: false,
          sortOrder: form.assets.length + i,
          altEn: form.titleEn || null,
        })),
      ];
      // #region agent log
      fetch('http://127.0.0.1:7768/ingest/4878ed05-f1ac-4ebb-915b-84a7969025f6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f9670f'},body:JSON.stringify({sessionId:'f9670f',location:'AddProductWizard:publish',message:'publish asset payload',data:{productId,images:form.assets.length,videos:form.videoAssets.length,banners:form.bannerAssets.length,totalAssets:assetPayload.length},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      // Step 2: Full update with description, assets, attributes, specs, pricing tiers
      const attrsFilled = form.keyAttributes.filter((r) => r.key.trim() && r.value.trim());
      const specsFilled = form.specifications.filter((r) => r.key.trim() && r.value.trim());

      await adminApi.updateProduct(productId, {
        titleEn: form.titleEn.trim(),
        titleBn: form.titleBn.trim() || form.titleEn.trim(),
        descriptionEn: form.descriptionEn || null,
        brand: form.brandName || null,
        brandId: form.brandId || null,
        sku: form.sku || null,
        moq: Number(form.moq) || 1,
        stock: Number(form.stock) || 0,
        isFeatured: form.isFeatured,
        isBestRated: form.isBestRated,
        pricingMode: form.pricingMode,
        attributesExtra: attrsFilled.length ? JSON.stringify(attrsFilled) : null,
        specifications: specsFilled.length ? JSON.stringify(specsFilled) : null,
        categoryId: form.categoryId || undefined,
        status: "active",
        retail: {
          price: Number(form.retailPrice),
          compareAt: form.compareAt ? Number(form.compareAt) : null,
          ...(isTiered && retailTierBandsPayload?.length ? {
            tierBands: retailTierBandsPayload,
            tier1MinQty: null, tier1Discount: null,
            tier2MinQty: null, tier2Discount: null,
            tier3MinQty: null, tier3Discount: null,
          } : {
            tier1MinQty: null, tier1Discount: null,
            tier2MinQty: null, tier2Discount: null,
            tier3MinQty: null, tier3Discount: null,
          }),
        },
        ...(isTiered && form.wholesalePrice && Number(form.wholesalePrice) > 0 ? {
          wholesale: {
            price: Number(form.wholesalePrice),
            compareAt: form.wholesaleCompareAt ? Number(form.wholesaleCompareAt) : null,
            ...(wholesaleTierBandsPayload?.length ? {
              tierBands: wholesaleTierBandsPayload,
              tier1MinQty: null, tier1Discount: null,
              tier2MinQty: null, tier2Discount: null,
              tier3MinQty: null, tier3Discount: null,
            } : {
              tier1MinQty: null, tier1Discount: null,
              tier2MinQty: null, tier2Discount: null,
              tier3MinQty: null, tier3Discount: null,
            }),
          },
        } : {}),
        productAssets: assetPayload,
      });

      // Step 3: Set tags (selected tags + collection tags)
      const tagIds = [
        ...(form.selectedTagIds || []).map((t) => (typeof t === "object" ? t.id : t)),
        ...(form.isTopTrending && obTopTrendingTagId ? [obTopTrendingTagId] : []),
      ].filter(Boolean);

      if (tagIds.length) {
        await adminApi.setProductTags(productId, tagIds).catch(() => {});
      }

      // Step 4: Create banners
      for (let i = 0; i < form.bannerAssets.length; i++) {
        const b = form.bannerAssets[i];
        try {
          await adminApi.createBanner({
            productId,
            imageUrl: b.url,
            title: form.titleEn,
            placement: "product",
            sortOrder: i,
            enabled: true,
          });
        } catch { /* non-fatal */ }
      }

      toast.success("Product published successfully!");      onSuccess?.();
      onClose();
    } catch (err) {      toast.error("Publish failed", err?.response?.data?.error || err?.message || "Failed to create product");
    } finally {
      publishInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  if (!open) return null;

  /* ── Step Renderer ──────────────────────────────────────────────────── */
  const renderStep = () => {
    switch (step) {
      /* STEP 1: Basic Information */
      case 1: return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Product Name (English) *</label>
              <input
                autoFocus
                value={form.titleEn}
                onChange={(e) => set("titleEn", e.target.value)}
                placeholder="e.g. Pro Wireless Gaming Mouse"
                className={`crm-input ${errors.titleEn ? "border-red-500 ring-1 ring-red-500" : ""}`}
              />
              {errors.titleEn && <p className="text-xs text-red-400 flex items-center gap-1"><FiAlertCircle size={11}/>{errors.titleEn}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Product Name (বাংলা)</label>
              <input
                value={form.titleBn}
                onChange={(e) => set("titleBn", e.target.value)}
                placeholder="পণ্যের নাম বাংলায়"
                className="crm-input"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Product Tags</label>
            <input
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              placeholder="Search tags…"
              className="crm-input mb-2"
            />
            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto py-1">
              {allTags
                .filter((t) => (t.nameEn || "").toLowerCase().includes(tagSearch.toLowerCase()))
                .map((tag) => {
                  const selected = form.selectedTagIds.some((s) => (s.id || s) === tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => {
                        const next = selected
                          ? form.selectedTagIds.filter((s) => (s.id || s) !== tag.id)
                          : [...form.selectedTagIds, tag];
                        set("selectedTagIds", next);
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                        selected
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "bg-gray-800 border-gray-600 text-gray-300 hover:border-blue-500 hover:text-blue-300"
                      }`}
                    >
                      {tag.nameEn}
                    </button>
                  );
                })}
              {allTags.length === 0 && (
                <p className="text-xs text-gray-500">No tags available. Create tags in the Tags section first.</p>
              )}
            </div>
            {form.selectedTagIds.length > 0 && (
              <p className="text-xs text-blue-400">{form.selectedTagIds.length} tag(s) selected</p>
            )}
          </div>
        </div>
      );

      /* STEP 2: Media Assets */
      case 2: return (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Product Images (max 20)</label>
            <p className="text-xs text-gray-500">First image = primary · Drag to reorder · Hover to set primary or remove</p>
            <MediaUploader assets={form.assets} onChange={(a) => set("assets", a)} />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Product Videos (max 5)</label>
            <MultiMediaUploader
              assets={form.videoAssets}
              onChange={(a) => set("videoAssets", a)}
              accept="video/*"
              folder="products/videos"
              maxCount={5}
              preview="video"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Landing Banners (max 5)</label>
            <MultiMediaUploader
              assets={form.bannerAssets}
              onChange={(a) => set("bannerAssets", a)}
              accept="image/*"
              folder="banners"
              maxCount={5}
              preview="banner"
              hint="Recommended: 1200x400px"
            />
          </div>
        </div>
      );

      /* STEP 3: Pricing Structure */
      case 3: return (
        <div className="space-y-6">
          {/* Pricing Mode Toggle */}
          <div className="flex items-center gap-4 p-3 rounded-xl bg-gray-800/50 border border-gray-700">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pricing Model:</span>
            <div className="flex rounded-lg overflow-hidden border border-gray-600">
              <button type="button"
                onClick={() => set("pricingMode", "non_tiered")}
                className={`px-4 py-1.5 text-xs font-semibold transition-all ${
                  form.pricingMode === "non_tiered"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                Non-Tiered (Retail Only)
              </button>
              <button type="button"
                onClick={() => set("pricingMode", "tiered")}
                className={`px-4 py-1.5 text-xs font-semibold transition-all ${
                  form.pricingMode === "tiered"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                Tiered (Retail + Wholesale)
              </button>
            </div>
            <span className="text-[10px] text-gray-500 ml-auto">
              {form.pricingMode === "non_tiered"
                ? "Simple retail pricing with no tier discounts"
                : "3 retail tiers + 3 wholesale tiers with quantity-based discounts"}
            </span>
          </div>

          {/* Base Pricing */}
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                {form.pricingMode === "non_tiered" ? "Current Price (৳) *" : "Retail Price (৳) *"}
              </label>
              <input
                type="number" min="0" step="0.01"
                value={form.retailPrice}
                onChange={(e) => set("retailPrice", e.target.value)}
                placeholder="0.00"
                className={`crm-input font-bold text-lg ${errors.retailPrice ? "border-red-500" : ""}`}
              />
              {errors.retailPrice && <p className="text-xs text-red-400">{errors.retailPrice}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Previous / Compare Price (৳)</label>
              <input
                type="number" min="0" step="0.01"
                value={form.compareAt}
                onChange={(e) => set("compareAt", e.target.value)}
                placeholder="0.00"
                className="crm-input text-gray-400"
              />
              {form.compareAt && Number(form.compareAt) > Number(form.retailPrice) && (
                <p className="text-xs text-green-400">
                  {Math.round((1 - Number(form.retailPrice) / Number(form.compareAt)) * 100)}% discount badge will show
                </p>
              )}
            </div>
          </div>

          {/* Retail Tiers (only for tiered mode) */}
          {form.pricingMode === "tiered" && (
            <div className="p-4 rounded-xl bg-gray-800/50 border border-gray-700">
              <BandTierEditor
                bands={form.retailBands}
                onChange={(t) => set("retailBands", t)}
                label="Retail quantity tiers (each row: min → max qty, discount %, auto price)"
                basePrice={form.retailPrice}
                wholesaleMode={false}
              />
              <p className="text-[10px] text-gray-500 mt-2">
                Tier 3 max qty becomes the retail order limit. Beyond that, only wholesale customers can order.
              </p>
            </div>
          )}

          {/* Wholesale (only for tiered mode) */}
          {form.pricingMode === "tiered" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                  Wholesale Pricing
                </label>
                {form.wholesalePrice && (
                  <button type="button" onClick={() => { set("wholesalePrice", ""); set("wholesaleCompareAt", ""); }}
                    className="text-xs text-gray-500 hover:text-red-400">Clear wholesale</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-purple-400 uppercase tracking-wider">Wholesale Price (৳)</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={form.wholesalePrice}
                    onChange={(e) => set("wholesalePrice", e.target.value)}
                    placeholder="0.00"
                    className="crm-input font-bold text-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Previous / Compare Price (৳)</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={form.wholesaleCompareAt}
                    onChange={(e) => set("wholesaleCompareAt", e.target.value)}
                    placeholder="0.00"
                    className="crm-input text-gray-400"
                  />
                  {form.wholesaleCompareAt && form.wholesalePrice && Number(form.wholesaleCompareAt) > Number(form.wholesalePrice) && (
                    <p className="text-xs text-green-400">
                      {Math.round((1 - Number(form.wholesalePrice) / Number(form.wholesaleCompareAt)) * 100)}% wholesale discount badge
                    </p>
                  )}
                </div>
              </div>
              {form.wholesalePrice && (
                <div className="p-4 rounded-xl bg-gray-800/50 border border-purple-800/40">
                  <BandTierEditor
                    bands={form.wholesaleBands}
                    onChange={(t) => set("wholesaleBands", t)}
                    label="Wholesale quantity tiers · first tier min must be (last retail max + 1) · leave last max empty for unlimited"
                    basePrice={form.wholesalePrice}
                    wholesaleMode
                  />
                  <p className="text-[10px] text-gray-500 mt-2">
                    Quantity gates must follow: Q1 &lt; Q2 &lt; Q3 &lt; Q4 &lt; Q5. Discounts must increase monotonically.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      );

      /* STEP 4: Inventory & SKU */
      case 4: return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Stock Count</label>
              <input
                type="number" min="0"
                value={form.stock}
                onChange={(e) => set("stock", e.target.value)}
                placeholder="0"
                className="crm-input text-lg font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">MOQ (Min. Order Qty)</label>
              <input
                type="number" min="1"
                value={form.moq}
                onChange={(e) => set("moq", e.target.value)}
                placeholder="1"
                className="crm-input"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Product SKU</label>
            <div className="flex gap-2">
              <input
                value={form.sku}
                onChange={(e) => set("sku", e.target.value)}
                placeholder="e.g. OB-MOUSE-X7A"
                className="crm-input font-mono flex-1"
              />
              <button
                type="button"
                onClick={() => set("sku", generateSKU(form.titleEn))}
                className="crm-btn flex items-center gap-1.5 text-xs whitespace-nowrap"
              >
                <FiRefreshCw size={12} /> Auto-generate
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* Category Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Category</label>
              <button
                type="button"
                onClick={() => setShowCategoryPicker(true)}
                className="crm-input text-left flex items-center justify-between w-full"
              >
                <span className={form.categoryName ? "text-gray-100" : "text-gray-500"}>
                  {form.categoryName || "Select from category explorer…"}
                </span>
                <FiSearch size={14} className="text-gray-400" />
              </button>
              {form.categoryId && (
                <p className="text-xs text-blue-400">
                  Selected: {form.categoryName} <button type="button" className="text-gray-500 hover:text-red-400 ml-1"
                    onClick={() => { set("categoryId", ""); set("categoryName", ""); }}>× clear</button>
                </p>
              )}
            </div>

            {/* Brand Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Brand</label>
              <BrandPicker
                value={form.brandName}
                onChange={(id, name) => { set("brandId", id); set("brandName", name); }}
              />
            </div>
          </div>
        </div>
      );

      /* STEP 5: Description, Key Attributes, Specifications */
      case 5: return (
        <div className="space-y-6">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
              Product Description
            </label>
            <RichTextEditor
              value={form.descriptionEn}
              onChange={(html) => set("descriptionEn", html)}
              placeholder="Write a rich product description using the toolbar above…"
              minHeight={220}
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
                Key Attributes <span className="text-blue-400">(shown on storefront)</span>
              </label>
              <KVTable
                rows={form.keyAttributes}
                onChange={(rows) => set("keyAttributes", rows)}
                addLabel="Add Attribute"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
                Specifications <span className="text-blue-400">(shows on storefront)</span>
              </label>
              <KVTable
                rows={form.specifications.length ? form.specifications : [{ key: "", value: "" }]}
                onChange={(rows) => set("specifications", rows)}
                addLabel="Add Specification"
              />
            </div>
          </div>
        </div>
      );

      /* STEP 6: Final Flags */
      case 6: return (
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Collection Flags</h4>

            {[
              { key: "isFeatured", label: "Promote as Featured", desc: "Appears on homepage featured section", icon: FiStar, color: "text-yellow-400" },
              { key: "isBestRated", label: "Mark as Best Rated", desc: "Eligible for homepage best-rated collections", icon: FiStar, color: "text-violet-400" },
              { key: "isTopTrending", label: "Mark as Top Trending", desc: "Adds ob_top_trending tag automatically", icon: FiTrendingUp, color: "text-blue-400" },
            ].map(({ key, label, desc, icon: Icon, color }) => (
              <label key={key}
                className={`flex items-start gap-3 p-3.5 rounded-xl bg-gray-800 cursor-pointer border transition-all ${
                  form[key] ? "border-blue-600/60 bg-blue-600/5" : "border-gray-700 hover:border-gray-500"
                }`}>
                <input type="checkbox" checked={form[key]}
                  onChange={(e) => set(key, e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-blue-600" />
                <div>
                  <p className={`text-sm font-bold ${color}`}><Icon className="inline mr-1" size={13}/>{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </label>
            ))}

            <label className={`flex items-start gap-3 p-3.5 rounded-xl cursor-pointer border transition-all mt-2 ${
              form.complianceConfirmed ? "border-green-600/60 bg-green-600/5" : "border-yellow-600/40 bg-yellow-600/5 hover:border-yellow-500"
            }`}>
              <input type="checkbox" checked={form.complianceConfirmed}
                onChange={(e) => { set("complianceConfirmed", e.target.checked); if (e.target.checked) setErrors((er) => ({ ...er, complianceConfirmed: undefined })); }}
                className="mt-0.5 w-4 h-4 rounded accent-green-600" />
              <div>
                <p className="text-sm font-bold text-yellow-400">✓ Compliance Confirmation *</p>
                <p className="text-xs text-gray-500">I confirm all product information, pricing, and media are accurate and comply with platform policies.</p>
              </div>
            </label>
            {errors.complianceConfirmed && (
              <p className="text-xs text-red-400 flex items-center gap-1"><FiAlertCircle size={11}/>{errors.complianceConfirmed}</p>
            )}
          </div>

          {/* Mini Preview */}
          <div className="flex flex-col items-center justify-start pt-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Live Preview Snapshot</p>
            <ProductPreviewCard form={form} />
            <button type="button"
              onClick={() => setStep(7)}
              className="mt-4 crm-btn crm-btn-primary flex items-center gap-2 text-sm px-6 py-2">
              <FiEye size={14}/> Full Preview →
            </button>
          </div>
        </div>
      );

      /* STEP 7: Full Preview + Publish */
      case 7: return (
        <div className="space-y-6">
          <div className="flex gap-8">
            <div className="flex-shrink-0">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Storefront Preview</p>
              <ProductPreviewCard form={form} />
            </div>
            <div className="flex-1 space-y-4">
              <div className="bg-gray-800/60 rounded-xl border border-gray-700 p-4 text-sm space-y-2">
                <p className="font-bold text-white text-base">{form.titleEn}</p>
                {form.titleBn && <p className="text-gray-400">{form.titleBn}</p>}
                <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                  <span>SKU: <strong className="text-gray-200">{form.sku || "—"}</strong></span>
                  <span>Stock: <strong className="text-gray-200">{form.stock || "0"}</strong></span>
                  <span>Category: <strong className="text-gray-200">{form.categoryName || "—"}</strong></span>
                  <span>Brand: <strong className="text-gray-200">{form.brandName || "—"}</strong></span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="bg-blue-600/20 text-blue-300 px-2 py-0.5 rounded">Retail: ৳{form.retailPrice}</span>
                  {form.compareAt && <span className="bg-red-600/20 text-red-300 px-2 py-0.5 rounded">Was: ৳{form.compareAt}</span>}
                  {form.wholesalePrice && <span className="bg-purple-600/20 text-purple-300 px-2 py-0.5 rounded">Wholesale: ৳{form.wholesalePrice}</span>}
                </div>
                <div className="flex flex-wrap gap-2 text-xs mt-1">
                  {form.isFeatured && <span className="bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded">⭐ Featured</span>}
                  {form.isBestRated && <span className="bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded">⭐ Best Rated</span>}
                  {form.isTopTrending && <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">📈 Top Trending</span>}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {form.selectedTagIds.map((t, i) => (
                    <span key={i} className="bg-gray-700 text-gray-300 text-[10px] px-2 py-0.5 rounded-full">
                      {typeof t === "object" ? t.nameEn : t}
                    </span>
                  ))}
                </div>
                {form.assets.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {form.assets.slice(0, 5).map((a, i) => (
                      <img key={i} src={a.url} alt="" className="w-10 h-10 rounded object-cover border border-gray-600" />
                    ))}
                    {form.assets.length > 5 && <span className="text-xs text-gray-500 self-center">+{form.assets.length - 5} more</span>}
                  </div>
                )}
                {form.videoAssets.length > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <FiFilm size={12} className="text-purple-400" />
                    <span className="text-xs text-purple-300">{form.videoAssets.length} video(s)</span>
                  </div>
                )}
                {form.bannerAssets.length > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <FiImage size={12} className="text-blue-400" />
                    <span className="text-xs text-blue-300">{form.bannerAssets.length} banner(s)</span>
                  </div>
                )}
              </div>

              {!form.complianceConfirmed && (
                <div className="flex items-center gap-2 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-xl text-xs text-yellow-300">
                  <FiAlertCircle size={14}/>
                  <span>You must confirm compliance on Step 6 before publishing.</span>
                  <button type="button" onClick={() => setStep(6)} className="underline font-semibold">Go back</button>
                </div>
              )}

              <button
                type="button"
                disabled={submitting}
                onClick={handlePublish}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
              >
                {submitting ? (
                  <><FiRefreshCw className="animate-spin" size={16}/> Publishing…</>
                ) : (
                  <><FiCheck size={16}/> Publish Product</>
                )}
              </button>
            </div>
          </div>
        </div>
      );

      default: return null;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={!submitting ? onClose : undefined} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-stretch justify-center overflow-hidden">
        <div className="relative w-full max-w-5xl mx-4 my-4 flex flex-col bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800 flex-shrink-0">
            <div>
              <h2 className="text-lg font-bold text-white">Add New Product</h2>
              <p className="text-xs text-gray-400">Step {step} of {STEPS.length} — {STEPS[step - 1].label}</p>
            </div>
            <button type="button" disabled={submitting} onClick={onClose}
              className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-700 transition-colors">
              <FiX size={20} />
            </button>
          </div>

          {/* Step Progress */}
          <div className="px-6 py-3 border-b border-gray-700 bg-gray-800/60 flex-shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const isActive = s.id === step;
                const isDone = s.id < step;
                return (
                  <div key={s.id} className="flex items-center">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => !submitting && setStep(s.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                        isActive ? "bg-blue-600 text-white shadow" :
                        isDone ? "text-green-400 hover:bg-gray-700" :
                        "text-gray-500 hover:bg-gray-700 hover:text-gray-300"
                      }`}
                    >
                      {isDone ? <FiCheck size={11}/> : <Icon size={11}/>}
                      {s.label}
                    </button>
                    {i < STEPS.length - 1 && <FiChevronRight size={14} className="text-gray-700 mx-0.5 flex-shrink-0"/>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {renderStep()}
          </div>

          {/* Footer Navigation */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700 bg-gray-800 flex-shrink-0">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 1 || submitting}
              className="crm-btn flex items-center gap-2 disabled:opacity-40"
            >
              <FiChevronLeft size={14}/> Back
            </button>

            <span className="text-xs text-gray-500">{step} / {STEPS.length}</span>

            {step < STEPS.length ? (
              <button type="button" onClick={goNext} disabled={submitting}
                className="crm-btn crm-btn-primary flex items-center gap-2">
                Next <FiChevronRight size={14}/>
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={handlePublish}
                className="crm-btn crm-btn-primary flex items-center gap-2 disabled:opacity-40"
              >
                {submitting ? <><FiRefreshCw className="animate-spin" size={14}/> Publishing…</> : <><FiCheck size={14}/> Publish Product</>}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category Picker Modal */}
      {showCategoryPicker && (
        <CategoryPickerModal
          onSelect={(id, name) => {
            set("categoryId", id);
            set("categoryName", name);
            setShowCategoryPicker(false);
          }}
          onClose={() => setShowCategoryPicker(false)}
        />
      )}
    </>
  );
}
