import { useEffect, useRef, useState, useCallback } from "react";
import {
  FiX, FiChevronLeft, FiChevronRight, FiCheck, FiInfo, FiImage,
  FiDollarSign, FiHash, FiLayers, FiFlag, FiEye, FiPlus, FiTrash2,
  FiUpload, FiStar, FiTrendingUp, FiPackage, FiRefreshCw, FiSearch,
  FiAlertCircle, FiFilm, FiDroplet,
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
  descriptionBn: "",
  keyAttributes: [{ key: "", value: "" }],
  specifications: [],
  isFeatured: false, isBestRated: false, isTopTrending: false,
  selectedTrustBadgeIds: [],
  complianceConfirmed: false,
  /** Multi-axis options: color + style + size (etc.) on the same product */
  hasOptions: false,
  optionGroups: [
    {
      axis: "color",
      customLabel: "",
      rows: [{ label: "", price: "", stock: "", sku: "", hex: "", mediaUrl: "" }],
    },
  ],
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

function axisKeyOf(group) {
  if (group.axis === "custom") {
    const custom = String(group.customLabel || "").trim().toLowerCase();
    return custom || "option";
  }
  return group.axis || "color";
}

function axisLabelOf(group) {
  if (group.axis === "custom") return String(group.customLabel || "").trim() || "Option";
  if (group.axis === "style") return "Style";
  if (group.axis === "size") return "Size";
  return "Color";
}

function slugOption(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "-");
}

function cartesianRows(groups) {
  const filled = groups
    .map((g) => ({
      group: g,
      key: axisKeyOf(g),
      label: axisLabelOf(g),
      values: (g.rows || []).filter((r) => String(r.label || "").trim()),
    }))
    .filter((g) => g.values.length);
  if (!filled.length) return [];
  let combos = [{ attrs: {}, price: "", stock: "", sku: "", parts: [] }];
  for (let gi = 0; gi < filled.length; gi++) {
    const g = filled[gi];
    const isLast = gi === filled.length - 1;
    const next = [];
    for (const c of combos) {
      for (const row of g.values) {
        const label = String(row.label).trim();
        const attrs = { ...c.attrs, [g.key]: label };
        if (g.key === "color" && row.hex) attrs._hex = String(row.hex).trim();
        if (row.mediaUrl) {
          attrs._mediaUrl = row.mediaUrl;
          if (!attrs._optionMediaKey) attrs._optionMediaKey = slugOption(label);
        }
        // Stock comes from the last option group only (avoids Color×Size inflation).
        // Price: last non-empty wins.
        const price = String(row.price ?? "").trim() !== "" ? row.price : c.price;
        const stock = isLast
          ? (row.stock !== "" && row.stock != null ? row.stock : "")
          : c.stock;
        next.push({
          attrs,
          price,
          stock,
          sku: [c.sku, row.sku].filter(Boolean).join("-") || "",
          parts: [...c.parts, label],
        });
      }
    }
    combos = next;
  }
  return combos;
}

/** Build / validate multi-axis variant rows for publish. */
function parseOptionRows(form, baseRetailPrice) {
  if (!form.hasOptions) return { variants: [], mediaKeyByUrl: {} };
  const groups = form.optionGroups?.length
    ? form.optionGroups
    : form.optionRows
      ? [{ axis: form.optionAxis || "color", customLabel: form.optionAxisCustom || "", rows: form.optionRows }]
      : [];
  for (const g of groups) {
    const filled = (g.rows || []).filter((r) => String(r.label || "").trim());
    if (!filled.length) {
      return { error: `Add at least one ${axisLabelOf(g).toLowerCase()} value, or remove that option group.` };
    }
    const seen = new Set();
    for (const r of filled) {
      const key = String(r.label).trim().toLowerCase();
      if (seen.has(key)) return { error: `Duplicate ${axisLabelOf(g).toLowerCase()} option: "${r.label}"` };
      seen.add(key);
    }
  }
  const combos = cartesianRows(groups);
  if (!combos.length) {
    return { error: "Add at least one option value, or turn options off." };
  }
  const variants = [];
  const mediaKeyByUrl = {};
  for (let i = 0; i < combos.length; i++) {
    const c = combos[i];
    const priceS = String(c.price ?? "").trim();
    let priceOverride = null;
    if (priceS !== "") {
      const p = Number(priceS);
      if (!Number.isFinite(p) || p <= 0) {
        return { error: `Option "${c.parts.join(" / ")}": enter a valid price greater than 0, or leave blank to use base price (৳${baseRetailPrice}).` };
      }
      priceOverride = p;
    }
    const stock = Math.max(0, Math.floor(Number(c.stock) || 0));
    const name = c.parts.join(" / ");
    if (c.attrs._mediaUrl && c.attrs._optionMediaKey) {
      mediaKeyByUrl[c.attrs._mediaUrl] = c.attrs._optionMediaKey;
    }
    // Also map from group rows directly (one media per option value)
    variants.push({
      nameEn: name,
      nameBn: name,
      sku: String(c.sku || "").trim() || null,
      stock,
      priceOverride,
      isActive: true,
      sortOrder: i,
      attributes: c.attrs,
    });
  }
  // Collect media keys from all group rows (not only cartesian leaf)
  for (const g of groups) {
    for (const r of g.rows || []) {
      if (r.mediaUrl && r.label) mediaKeyByUrl[r.mediaUrl] = slugOption(r.label);
    }
  }
  return { variants, mediaKeyByUrl };
}

async function pickColorWithEyeDropper() {
  if (typeof window === "undefined" || typeof window.EyeDropper !== "function") {
    return { error: "Eyedropper is not supported in this browser. Use Chrome/Edge, or enter a hex code." };
  }
  try {
    const dropper = new window.EyeDropper();
    const result = await dropper.open();
    return { hex: result.sRGBHex };
  } catch (err) {
    if (err?.name === "AbortError") return { cancelled: true };
    return { error: err?.message || "Could not pick color" };
  }
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
          className="flex items-center gap-2 px-3 py-2 hover:bg-crm-bg-hover cursor-pointer rounded transition-colors"
          style={{ paddingLeft: `${(depth * 16) + 12}px` }}
          onClick={() => onSelect(node.id, node.nameEn)}
        >
          {hasChildren ? (
            <button type="button" className="text-crm-text-dim hover:text-crm-text-bright"
              onClick={(e) => { e.stopPropagation(); toggle(node.id); }}>
              {isOpen ? "▾" : "▸"}
            </button>
          ) : <span className="w-4" />}
          <span className="text-sm text-crm-text">{node.nameEn}</span>
          {node.productCount > 0 && (
            <span className="text-xs text-crm-text-muted ml-auto">{node.productCount}</span>
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
      <div className="bg-crm-bg-alt border border-crm-border-strong rounded-2xl w-96 max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-crm-border">
          <h3 className="text-sm font-bold text-crm-text-bright">Select Category</h3>
          <button type="button" onClick={onClose} className="text-crm-text-dim hover:text-crm-text-bright"><FiX /></button>
        </div>
        <div className="px-3 py-2 border-b border-crm-border">
          <div className="relative">
            <FiSearch className="absolute left-2 top-2.5 text-crm-text-dim" size={13} />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories…"
              className="w-full bg-crm-bg-hover border border-crm-border-strong text-sm text-crm-text rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-crm-primary"
            />
          </div>
          <div className="mt-2 rounded-lg border border-crm-border bg-crm-bg-alt/60 p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCreateMode("root")}
                className={`px-2 py-1 rounded text-[10px] font-semibold ${createMode === "root" ? "bg-crm-primary text-white" : "bg-crm-bg-hover text-crm-text"}`}
              >
                New Category
              </button>
              <button
                type="button"
                onClick={() => setCreateMode("sub")}
                className={`px-2 py-1 rounded text-[10px] font-semibold ${createMode === "sub" ? "bg-crm-primary text-white" : "bg-crm-bg-hover text-crm-text"}`}
              >
                New Subcategory
              </button>
            </div>
            {createMode === "sub" && (
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full bg-crm-bg-hover border border-crm-border-strong text-xs text-crm-text rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-crm-primary"
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
                className="w-full bg-crm-bg-hover border border-crm-border-strong text-xs text-crm-text rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-crm-primary"
              />
              <input
                value={newNameBn}
                onChange={(e) => setNewNameBn(e.target.value)}
                placeholder="Name (Bangla, optional)"
                className="w-full bg-crm-bg-hover border border-crm-border-strong text-xs text-crm-text rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-crm-primary"
              />
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  value={newCatIcon}
                  onChange={(e) => setNewCatIcon(e.target.value)}
                  placeholder="Icon emoji (e.g. 📱)"
                  className="w-full bg-crm-bg-hover border border-crm-border-strong text-xs text-crm-text rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-crm-primary"
                />
                <label className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-crm-border-strong bg-crm-bg-hover/50 px-2 py-1.5 text-[10px] text-crm-text cursor-pointer hover:border-crm-primary">
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
                <p className="text-[10px] text-crm-success truncate">Label image set (emoji cleared if uploaded)</p>
              )}
            </div>
            <button
              type="button"
              disabled={creating || (createMode === "sub" && !parentId)}
              onClick={handleCreateCategory}
              className="w-full rounded-lg bg-crm-primary px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-crm-primary-hover disabled:opacity-50"
            >
              {creating ? "Creating…" : createMode === "sub" ? "Create subcategory" : "Create category"}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {loading ? (
            <div className="text-center text-crm-text-muted py-8 text-sm">Loading…</div>
          ) : error ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-xs text-crm-danger">{error}</p>
              <button type="button" className="text-xs text-crm-primary hover:underline"
                onClick={() => { setError(""); setLoading(true); loadCategoryTree().finally(() => setLoading(false)); }}>Retry</button>
            </div>
          ) : displayNodes.length === 0 ? (
            <div className="text-center text-crm-text-muted py-8 text-sm">No categories found</div>
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
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-crm-bg-alt border border-crm-border-strong rounded-xl shadow-xl max-h-48 overflow-y-auto">
          {filtered.map((b) => {
            const id = b?.id || "";
            const name = typeof b === "string" ? b : b.nameEn || b.name || "";
            return (
              <button key={id || name} type="button"
                onMouseDown={() => { onChange(id, name); setSearch(name); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm text-crm-text hover:bg-crm-bg-hover flex items-center gap-2">
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
          className="mt-1 w-full rounded-lg border border-crm-primary/40 bg-crm-primary/10 px-3 py-2 text-left text-xs text-crm-primary hover:bg-crm-primary/20 disabled:opacity-50"
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
        className="border-2 border-dashed border-crm-border-strong rounded-xl p-8 text-center cursor-pointer hover:border-crm-primary hover:bg-crm-primary/5 transition-all group"
      >
        <FiUpload size={32} className="mx-auto mb-2 text-crm-text-muted group-hover:text-crm-primary" />
        <p className="text-sm font-semibold text-crm-text">Drop images here or click to select</p>
        <p className="text-xs text-crm-text-muted mt-1">First image becomes primary · Supports JPG, PNG, WEBP · Multiple select</p>
        {uploading && <p className="text-xs text-crm-primary mt-2 animate-pulse">Uploading to Cloudinary…</p>}
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
                asset.isPrimary ? "border-crm-primary" : "border-crm-border-strong hover:border-crm-border-strong"
              }`}
            >
              <img
                src={normalizeProductImageUrl ? normalizeProductImageUrl(asset.url) : asset.url}
                alt=""
                className="w-full aspect-square object-cover bg-crm-bg-alt"
                onError={(e) => { e.target.src = ""; e.target.style.background = "var(--crm-bg-hover)"; }}
              />
              {asset.isPrimary && (
                <span className="absolute top-1 left-1 bg-crm-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                  PRIMARY
                </span>
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                {!asset.isPrimary && (
                  <button type="button" onClick={() => setPrimary(idx)}
                    className="text-xs bg-crm-primary text-white px-2 py-1 rounded font-semibold hover:bg-crm-primary-hover">
                    Set Primary
                  </button>
                )}
                <button type="button" onClick={() => remove(idx)}
                  className="text-xs bg-crm-danger text-white px-2 py-1 rounded font-semibold hover:bg-crm-danger-hover">
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
          <tr className="border-b border-crm-border">
            <th className="text-left py-1.5 px-2 text-crm-text-dim font-medium w-2/5">Attribute</th>
            <th className="text-left py-1.5 px-2 text-crm-text-dim font-medium">Value</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-crm-border/50">
              <td className="py-1 px-1">
                <input
                  value={row.key}
                  onChange={(e) => update(i, "key", e.target.value)}
                  placeholder="e.g. Material"
                  className="w-full bg-crm-bg-alt border border-crm-border-strong text-crm-text rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-crm-primary"
                />
              </td>
              <td className="py-1 px-1">
                <input
                  value={row.value}
                  onChange={(e) => update(i, "value", e.target.value)}
                  placeholder="e.g. Cotton"
                  className="w-full bg-crm-bg-alt border border-crm-border-strong text-crm-text rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-crm-primary"
                />
              </td>
              <td className="py-1 px-1 text-center">
                <button type="button" onClick={() => remove(i)} className="text-crm-text-muted hover:text-crm-danger p-1">
                  <FiTrash2 size={12} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={add}
        className="flex items-center gap-1.5 text-xs text-crm-primary hover:text-crm-primary font-medium mt-1">
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
        <p className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">{label}</p>
        <button type="button" onClick={add} className="text-xs flex items-center gap-1 text-crm-primary hover:text-crm-primary">
          <FiPlus size={12} /> Add tier
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[540px]">
          <thead>
            <tr className="border-b border-crm-border">
              <th className="text-left py-1.5 px-2 text-crm-text-muted">#</th>
              <th className="text-left py-1.5 px-2 text-crm-text-muted">Min qty</th>
              <th className="text-left py-1.5 px-2 text-crm-text-muted">Max qty</th>
              <th className="text-left py-1.5 px-2 text-crm-text-muted">Discount %</th>
              <th className="text-left py-1.5 px-2 text-crm-text-muted">Unit price</th>
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
                <tr key={i} className="border-b border-crm-border/50">
                  <td className="py-1 px-2 text-crm-text-muted">{i + 1}</td>
                  <td className="py-1 px-1">
                    <input type="number" min="1" value={tier.minQty}
                      onChange={(e) => update(i, "minQty", e.target.value)}
                      className="w-24 bg-crm-bg-alt border border-crm-border-strong text-crm-text rounded-lg px-2 py-1.5 text-xs" />
                  </td>
                  <td className="py-1 px-1">
                    <input type="number" min="1"
                      value={tier.maxQty}
                      onChange={(e) => update(i, "maxQty", e.target.value)}
                      placeholder={wholesaleMode && isLast ? "optional" : ""}
                      className="w-28 bg-crm-bg-alt border border-crm-border-strong text-crm-text rounded-lg px-2 py-1.5 text-xs placeholder:text-crm-text-muted" />
                    {wholesaleMode && isLast && (
                      <p className="text-[9px] text-crm-text-muted mt-0.5">empty = unlimited</p>
                    )}
                  </td>
                  <td className="py-1 px-1">
                    <input type="number" min="0" max="100" value={tier.discount}
                      onChange={(e) => update(i, "discount", e.target.value)}
                      className="w-20 bg-crm-bg-alt border border-crm-border-strong text-crm-text rounded-lg px-2 py-1.5 text-xs" />
                  </td>
                  <td className="py-1 px-2 text-crm-success font-mono">৳{unit}</td>
                  <td className="py-1 px-1 text-center">
                    <button type="button" onClick={() => removeRow(i)} className="text-crm-text-muted hover:text-crm-danger disabled:opacity-30" disabled={bands.length <= 1}>
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
    <div className="bg-crm-bg-alt border border-crm-border-strong rounded-2xl overflow-hidden w-72 shadow-xl">
      <div className="relative bg-crm-bg-hover h-56 flex items-center justify-center">
        {primaryAsset?.url ? (
          <img src={primaryAsset.url} alt={form.titleEn}
            className="w-full h-full object-cover" />
        ) : (
          <div className="text-crm-text-muted flex flex-col items-center gap-2">
            <FiImage size={40} />
            <span className="text-xs">No image</span>
          </div>
        )}
        {form.isFeatured && (
          <span className="absolute top-2 left-2 bg-crm-warning text-white text-[10px] font-bold px-2 py-0.5 rounded">Featured</span>
        )}
        {form.isBestRated && (
          <span className="absolute top-2 right-2 bg-crm-purple text-white text-[10px] font-bold px-2 py-0.5 rounded">Best Rated</span>
        )}
        {discount && (
          <span className="absolute bottom-2 right-2 bg-crm-danger text-white text-xs font-bold px-2 py-0.5 rounded">{discount}% OFF</span>
        )}
      </div>
      <div className="p-4">
        {form.categoryName && (
          <p className="text-[10px] text-crm-primary font-semibold uppercase tracking-wider mb-1">{form.categoryName}</p>
        )}
        <h3 className="text-sm font-bold text-crm-text-bright leading-snug line-clamp-2">
          {form.titleEn || "Product Name"}
        </h3>
        {form.brandName && (
          <p className="text-xs text-crm-text-dim mt-0.5">{form.brandName}</p>
        )}
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-lg font-bold text-crm-text-bright">{price}</span>
          {compareAt && <span className="text-xs text-crm-text-muted line-through">{compareAt}</span>}
        </div>
        {form.stock && (
          <p className={`text-xs mt-1 font-medium ${Number(form.stock) < 10 ? "text-crm-danger" : "text-crm-success"}`}>
            {Number(form.stock) < 10 ? `Only ${form.stock} left!` : `In stock · ${form.stock} units`}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-1">
          {form.selectedTagIds?.slice(0, 3).map((t, i) => (
            <span key={i} className="bg-crm-bg-hover text-crm-text text-[10px] px-2 py-0.5 rounded-full">{t.nameEn || t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN WIZARD
═══════════════════════════════════════════════════════════════════════ */
function parseKvField(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((r) => r && (r.key || r.attrKey))
        .map((r) => ({ key: String(r.key || r.attrKey || ""), value: String(r.value ?? "") }));
    }
    if (parsed && typeof parsed === "object") {
      return Object.entries(parsed).map(([k, v]) => ({ key: k, value: String(v ?? "") }));
    }
  } catch { /* ignore */ }
  return [];
}

function variantsToOptionGroups(variants) {
  const list = Array.isArray(variants) ? variants : [];
  if (!list.length) return [{ axis: "color", customLabel: "", rows: [{ label: "", price: "", stock: "", sku: "", hex: "", mediaUrl: "" }] }];

  const axisOrder = [];
  const axisValues = new Map(); // axisKey -> Map(labelLower -> row)

  for (const v of list) {
    const attrs = v.attributes && typeof v.attributes === "object" ? v.attributes : {};
    const metaHex = attrs._hex || attrs._colorHex || "";
    const metaMedia = attrs._mediaUrl || "";
    for (const [k, val] of Object.entries(attrs)) {
      if (String(k).startsWith("_")) continue;
      const axis = String(k).toLowerCase();
      if (!axisValues.has(axis)) {
        axisOrder.push(axis);
        axisValues.set(axis, new Map());
      }
      const label = String(val || "").trim();
      if (!label) continue;
      const key = label.toLowerCase();
      const bucket = axisValues.get(axis);
      if (!bucket.has(key)) {
        bucket.set(key, {
          label,
          price: v.priceOverride != null ? String(v.priceOverride) : "",
          stock: String(v.stock ?? ""),
          sku: v.sku || "",
          hex: axis === "color" ? metaHex : "",
          mediaUrl: metaMedia || "",
        });
      } else if (axis === "color" && metaHex && !bucket.get(key).hex) {
        bucket.get(key).hex = metaHex;
      }
    }
  }

  if (!axisOrder.length) {
    return [{
      axis: "custom",
      customLabel: "Option",
      rows: list.map((v) => ({
        label: v.nameEn || v.nameBn || v.sku || "Option",
        price: v.priceOverride != null ? String(v.priceOverride) : "",
        stock: String(v.stock ?? ""),
        sku: v.sku || "",
        hex: "",
        mediaUrl: "",
      })),
    }];
  }

  return axisOrder.map((axis) => {
    const known = ["color", "style", "size"].includes(axis);
    return {
      axis: known ? axis : "custom",
      customLabel: known ? "" : axis,
      rows: [...axisValues.get(axis).values()],
    };
  });
}

export default function AddProductWizard({ open, onClose, onSuccess, defaultCategoryId, editProductId = null }) {
  const toast = useToast();
  const isEdit = Boolean(editProductId);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ ...INITIAL_FORM, categoryId: defaultCategoryId || "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const publishInFlightRef = useRef(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [allTags, setAllTags] = useState([]);
  const [allTrustBadges, setAllTrustBadges] = useState([]);
  const [tagSearch, setTagSearch] = useState("");
  const [obTopTrendingTagId, setObTopTrendingTagId] = useState(null);
  const [existingVariantIds, setExistingVariantIds] = useState([]);

  const set = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }, []);

  // Fetch tags + trust badges on mount
  useEffect(() => {
    if (!open) return;
    adminApi.tagGroups().then((r) => {
      const groups = Array.isArray(r) ? r : r?.groups || [];
      const flat = groups.flatMap((g) => g.tags || []);
      setAllTags(flat);
      const trending = flat.find((t) => t.slug === "ob_top_trending");
      if (trending) setObTopTrendingTagId(trending.id);
    }).catch(() => {});
    adminApi.trustBadges().then((r) => {
      const list = Array.isArray(r?.badges) ? r.badges : Array.isArray(r) ? r : [];
      setAllTrustBadges(list.filter((b) => b.active !== false));
    }).catch(() => setAllTrustBadges([]));
  }, [open]);

  // Reset / load edit on open
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setErrors({});
    setExistingVariantIds([]);
    if (!editProductId) {
      setForm({ ...INITIAL_FORM, categoryId: defaultCategoryId || "" });
      return;
    }
    let cancelled = false;
    setLoadingEdit(true);
    (async () => {
      try {
        const [d, assetsRes, variantsRes, trustRes] = await Promise.all([
          adminApi.productDetail(editProductId),
          adminApi.productAssets(editProductId).catch(() => []),
          adminApi.productVariants(editProductId).catch(() => []),
          adminApi.productTrustBadges(editProductId).catch(() => ({ badgeIds: [] })),
        ]);
        if (cancelled) return;
        const data = d?.product || d;
        const assetsRaw = Array.isArray(assetsRes) ? assetsRes : assetsRes?.assets || [];
        const variants = Array.isArray(variantsRes) ? variantsRes : variantsRes?.variants || [];
        // #region agent log
        const _tagsRaw = data?.productTags ?? data?.tags;
        const _pricingRaw = data?.pricing ?? data?.productPricing;
        const _catsRaw = data?.productCategories;
        fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'edit-map-crash',hypothesisId:'H-load-shapes',location:'AddProductWizard.jsx:loadEdit',message:'edit payload shapes',data:{productId:editProductId,tagsType:Array.isArray(_tagsRaw)?'array':typeof _tagsRaw,tagsIsNull:_tagsRaw==null,pricingType:Array.isArray(_pricingRaw)?'array':typeof _pricingRaw,catsType:Array.isArray(_catsRaw)?'array':typeof _catsRaw,assetsRawIsArray:Array.isArray(assetsRaw),assetsRawType:typeof assetsRaw,assetsNestedIsArray:Array.isArray(assetsRes?.assets),variantsIsArray:Array.isArray(variants),variantsNestedIsArray:Array.isArray(variantsRes?.variants),trustBadgeIdsType:Array.isArray(trustRes?.badgeIds)?'array':typeof trustRes?.badgeIds,attrsType:typeof data?.attributesExtra,specsType:typeof data?.specifications},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        setExistingVariantIds(variants.map((v) => v.id).filter(Boolean));

        const pricing = data?.pricing || data?.productPricing || [];
        const retail = pricing.find((p) => p.customerType === "retail") || pricing[0] || {};
        const wholesale = pricing.find((p) => p.customerType === "wholesale") || {};
        const primaryCat = data?.productCategories?.find((m) => m.isPrimary) ?? data?.productCategories?.[0];
        const optionGroups = variantsToOptionGroups(variants);
        const hasOptions = variants.length > 0;

        const images = assetsRaw.filter((a) => (a.assetType || a.mediaType || "image") !== "video");
        const videos = assetsRaw.filter((a) => (a.assetType || a.mediaType) === "video");

        setForm({
          ...INITIAL_FORM,
          titleEn: data?.titleEn || "",
          titleBn: data?.titleBn || "",
          selectedTagIds: (data?.productTags || data?.tags || []).map((t) => t.tagId ?? t.id ?? t).filter(Boolean),
          assets: images.map((a, i) => ({
            url: a.url,
            publicId: a.publicId,
            assetType: a.assetType || "image",
            isPrimary: a.isPrimary ?? i === 0,
            colorKey: a.colorKey || null,
          })),
          videoAssets: videos.map((v) => ({
            url: v.url,
            publicId: v.publicId,
            assetType: "video",
            colorKey: v.colorKey || null,
          })),
          pricingMode: data?.pricingMode || (wholesale?.price ? "tiered" : "non_tiered"),
          retailPrice: retail?.price != null ? String(Number(retail.price)) : "",
          compareAt: retail?.compareAt != null ? String(Number(retail.compareAt)) : "",
          wholesalePrice: wholesale?.price != null ? String(Number(wholesale.price)) : "",
          wholesaleCompareAt: wholesale?.compareAt != null ? String(Number(wholesale.compareAt)) : "",
          stock: String(data?.stock ?? ""),
          sku: data?.sku || "",
          moq: String(data?.moq ?? 1),
          categoryId: primaryCat?.category?.id || data?.categoryId || "",
          categoryName: primaryCat?.category?.nameEn || "",
          brandId: data?.brandId || "",
          brandName: data?.brand || "",
          descriptionEn: data?.descriptionEn || "",
          descriptionBn: data?.descriptionBn || "",
          keyAttributes: parseKvField(data?.attributesExtra).length
            ? parseKvField(data?.attributesExtra)
            : [{ key: "", value: "" }],
          specifications: parseKvField(data?.specifications),
          isFeatured: !!data?.isFeatured,
          isBestRated: !!data?.isBestRated,
          selectedTrustBadgeIds: Array.isArray(trustRes?.badgeIds) ? trustRes.badgeIds : [],
          complianceConfirmed: true,
          hasOptions,
          optionGroups,
        });
        // #region agent log
        fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'edit-map-crash',hypothesisId:'H-load-ok',location:'AddProductWizard.jsx:loadEdit:setForm',message:'edit form set ok',data:{productId:editProductId,optionGroups:optionGroups.length,hasOptions},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      } catch (err) {
        // #region agent log
        fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'edit-map-crash',hypothesisId:'H-load-err',location:'AddProductWizard.jsx:loadEdit:catch',message:String(err?.message||err),data:{stack:String(err?.stack||'').slice(0,800)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (!cancelled) toast.error("Failed to load product for editing", err?.response?.data?.error || err?.message);
      } finally {
        if (!cancelled) setLoadingEdit(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, editProductId, defaultCategoryId, toast]);

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
    if (!form.categoryId) {
      toast.error("Category required", "Select a category/folder before publishing.");
      setStep(1);
      return;
    }
    if (!form.titleEn.trim()) { toast.error("Product name is required"); return; }
    if (!form.retailPrice || Number(form.retailPrice) <= 0) { toast.error("Retail price is required"); return; }

    const optionParse = parseOptionRows(form, Number(form.retailPrice));
    if (optionParse.error) {
      toast.error("Options error", optionParse.error);
      setStep(4);
      return;
    }
    const variantPayloads = optionParse.variants || [];
    const stockFromVariants = variantPayloads.length
      ? variantPayloads.reduce((s, v) => s + (v.stock || 0), 0)
      : Number(form.stock) || 0;

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

      let productId = editProductId || null;
      if (!isEdit) {
        const created = await adminApi.createProduct({
          titleEn: form.titleEn.trim(),
          titleBn: form.titleBn.trim() || form.titleEn.trim(),
          isFeatured: form.isFeatured,
          isBestRated: form.isBestRated,
          pricingMode: form.pricingMode,
          retailPrice: Number(form.retailPrice),
          compareAt: form.compareAt ? Number(form.compareAt) : undefined,
          ...(form.wholesalePrice && Number(form.wholesalePrice) > 0 ? { wholesalePrice: Number(form.wholesalePrice) } : {}),
          stock: stockFromVariants,
          sku: form.sku || undefined,
          moq: Number(form.moq) || 1,
          brand: form.brandName || undefined,
          brandId: form.brandId || undefined,
          status: "draft",
          categoryId: form.categoryId,
        });
        // #region agent log
        fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'product-publish',hypothesisId:'H-cat',location:'AddProductWizard.jsx:createProduct',message:'createProduct response',data:{productId:created?.product?.id||created?.id||null,categoryId:form.categoryId,assetCount:form.assets.length,variantCount:variantPayloads.length,isEdit:false},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        productId = created?.product?.id || created?.id;
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'product-publish',hypothesisId:'H-edit',location:'AddProductWizard.jsx:editProduct',message:'updating existing product',data:{productId,variantCount:variantPayloads.length,existingVariants:existingVariantIds.length},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      }
      if (!productId) throw new Error(isEdit ? "Missing product id for edit" : "Product creation failed — no ID returned");
      const mediaKeyByUrl = optionParse.mediaKeyByUrl || {};
      const assetPayload = [
        ...form.assets.map((a, i) => ({
          url: a.url,
          publicId: a.publicId,
          assetType: a.assetType || "image",
          isPrimary: a.isPrimary ?? i === 0,
          sortOrder: i,
          altEn: form.titleEn || null,
          colorKey: mediaKeyByUrl[a.url] || a.colorKey || null,
        })),
        ...form.videoAssets.map((v, i) => ({
          url: v.url,
          publicId: v.publicId,
          assetType: "video",
          isPrimary: false,
          sortOrder: form.assets.length + i,
          altEn: form.titleEn || null,
          colorKey: mediaKeyByUrl[v.url] || v.colorKey || null,
        })),
      ];
      // Step 2: Full update with description, assets, attributes, specs, pricing tiers
      const attrsFilled = form.keyAttributes.filter((r) => r.key.trim() && r.value.trim());
      const specsFilled = form.specifications.filter((r) => r.key.trim() && r.value.trim());

      // #region agent log
      fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'attrs-specs',hypothesisId:'A',location:'AddProductWizard.jsx:publish-attrs',message:'publishing attrs/specs as arrays',data:{attrCount:attrsFilled.length,specCount:specsFilled.length,variantCount:variantPayloads.length,mediaKeyed:Object.keys(mediaKeyByUrl).length,hasDescriptionBn:Boolean(form.descriptionBn),isEdit},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      await adminApi.updateProduct(productId, {
        titleEn: form.titleEn.trim(),
        titleBn: form.titleBn.trim() || form.titleEn.trim(),
        descriptionEn: form.descriptionEn || null,
        descriptionBn: form.descriptionBn || null,
        brand: form.brandName || null,
        brandId: form.brandId || null,
        sku: form.sku || null,
        moq: Number(form.moq) || 1,
        stock: stockFromVariants,
        isFeatured: form.isFeatured,
        isBestRated: form.isBestRated,
        pricingMode: form.pricingMode,
        attributesExtra: attrsFilled.length ? attrsFilled : null,
        specifications: specsFilled.length ? specsFilled : null,
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

      // Replace variants (edit) or create (new)
      if (isEdit && existingVariantIds.length) {
        for (const vid of existingVariantIds) {
          await adminApi.deleteProductVariant(productId, vid).catch(() => {});
        }
      }
      for (const v of variantPayloads) {
        await adminApi.createProductVariant(productId, {
          nameEn: v.nameEn,
          nameBn: v.nameBn,
          sku: v.sku,
          stock: v.stock,
          priceOverride: v.priceOverride,
          isActive: true,
          sortOrder: v.sortOrder,
          attributes: v.attributes,
        });
      }

      // Step 3: Set tags (selected tags + collection tags)
      const tagIds = [
        ...(form.selectedTagIds || []).map((t) => (typeof t === "object" ? t.id : t)),
        ...(form.isTopTrending && obTopTrendingTagId ? [obTopTrendingTagId] : []),
      ].filter(Boolean);

      if (tagIds.length) {
        await adminApi.setProductTags(productId, tagIds).catch(() => {});
      }

      const trustBadgeIds = (form.selectedTrustBadgeIds || []).map((id) => Number(id)).filter((n) => n > 0);
      if (trustBadgeIds.length) {
        await adminApi.setProductTrustBadges(productId, trustBadgeIds).catch(() => {});
      }

      // Landing banners → product_banners (shown on PDP carousel)
      let bannersCreated = 0;
      const bannerErrors = [];
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
          bannersCreated += 1;
        } catch (err) {
          bannerErrors.push(err?.response?.data?.error || err?.message || `banner ${i + 1}`);
        }
      }

      // #region agent log
      fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7c9155'},body:JSON.stringify({sessionId:'7c9155',runId:'media-e2e',hypothesisId:'H2-H5',location:'AddProductWizard.jsx:publish',message:'product media publish result',data:{productId,imageCount:form.assets.length,videoCount:form.videoAssets.length,bannerAttempted:form.bannerAssets.length,bannersCreated,bannerErrors,variantCount:variantPayloads.length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      if (bannerErrors.length) {
        toast.error("Some banners failed", bannerErrors.slice(0, 2).join("; "));
      }

      toast.success(
        isEdit
          ? (variantPayloads.length
            ? `Product updated (${variantPayloads.length} option(s))`
            : "Product updated successfully!")
          : (variantPayloads.length || bannersCreated || form.videoAssets.length
            ? `Product published (${form.videoAssets.length} video(s), ${bannersCreated} banner(s)${variantPayloads.length ? `, ${variantPayloads.length} option(s)` : ""})`
            : "Product published successfully!")
      );      onSuccess?.();
      onClose();
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'product-publish',hypothesisId:'H-cat',location:'AddProductWizard.jsx:publish:catch',message:'publish failed',data:{status:err?.response?.status||null,error:err?.response?.data?.error||err?.message||null,code:err?.response?.data?.code||null,categoryId:form.categoryId||null,isEdit},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      toast.error(isEdit ? "Update failed" : "Publish failed", err?.response?.data?.error || err?.message || "Failed to save product");
    } finally {
      publishInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  if (!open) return null;

  /* ── Step Renderer ──────────────────────────────────────────────────── */
  const renderStep = () => {
    // #region agent log
    const _safe = (v) => Array.isArray(v) ? `arr:${v.length}` : `${typeof v}`;
    fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'edit-map-crash',hypothesisId:'H-render-shapes',location:'AddProductWizard.jsx:renderStep',message:'render step form shapes',data:{step,isEdit,loadingEdit,selectedTagIds:_safe(form.selectedTagIds),assets:_safe(form.assets),videoAssets:_safe(form.videoAssets),bannerAssets:_safe(form.bannerAssets),retailBands:_safe(form.retailBands),wholesaleBands:_safe(form.wholesaleBands),keyAttributes:_safe(form.keyAttributes),specifications:_safe(form.specifications),optionGroups:_safe(form.optionGroups),allTags:_safe(allTags),allTrustBadges:_safe(allTrustBadges)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    switch (step) {
      /* STEP 1: Basic Information */
      case 1: return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Product Name (English) *</label>
              <input
                autoFocus
                value={form.titleEn}
                onChange={(e) => set("titleEn", e.target.value)}
                placeholder="e.g. Pro Wireless Gaming Mouse"
                className={`crm-input ${errors.titleEn ? "border-crm-danger ring-1 ring-crm-danger" : ""}`}
              />
              {errors.titleEn && <p className="text-xs text-crm-danger flex items-center gap-1"><FiAlertCircle size={11}/>{errors.titleEn}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Product Name (বাংলা)</label>
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
            <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Product Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              <input
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                placeholder="Search or type a new tag…"
                className="crm-input flex-1 min-w-[160px]"
              />
              <button
                type="button"
                className="crm-btn crm-btn-primary"
                onClick={async () => {
                  const name = tagSearch.trim();
                  if (!name) { toast.error("Enter a tag name first"); return; }
                  try {
                    const res = await adminApi.createTag({
                      nameEn: name,
                      nameBn: name,
                      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || `tag-${Date.now()}`,
                    });
                    const tag = res?.tag || res;
                    if (tag?.id) {
                      setAllTags((prev) => [...prev.filter((t) => t.id !== tag.id), tag]);
                      set("selectedTagIds", [...(form.selectedTagIds || []), tag]);
                      setTagSearch("");
                      toast.success("Tag created");
                    }
                  } catch (err) {
                    toast.error(err?.response?.data?.error || "Could not create tag");
                  }
                }}
              >
                <FiPlus /> Create tag
              </button>
            </div>
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
                          ? "bg-crm-primary border-crm-primary text-white"
                          : "bg-crm-bg-alt border-crm-border-strong text-crm-text hover:border-crm-primary hover:text-crm-primary"
                      }`}
                    >
                      {tag.nameEn}
                    </button>
                  );
                })}
              {allTags.length === 0 && (
                <p className="text-xs text-crm-text-muted">No tags yet — type a name and Create tag, or manage under Catalog → Tags.</p>
              )}
            </div>
            {form.selectedTagIds.length > 0 && (
              <p className="text-xs text-crm-primary">{form.selectedTagIds.length} tag(s) selected</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Trust badges</label>
            <p className="text-2xs text-crm-text-muted">Shown on homepage (with product counts) and this product’s page. Manage catalog in Settings.</p>
            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto py-1">
              {allTrustBadges.map((badge) => {
                const selected = (form.selectedTrustBadgeIds || []).includes(badge.id);
                return (
                  <button
                    key={badge.id}
                    type="button"
                    onClick={() => {
                      const ids = form.selectedTrustBadgeIds || [];
                      set("selectedTrustBadgeIds", selected ? ids.filter((i) => i !== badge.id) : [...ids, badge.id]);
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                      selected
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : "bg-crm-bg-alt border-crm-border-strong text-crm-text hover:border-emerald-500 hover:text-emerald-600"
                    }`}
                  >
                    {badge.nameEn}
                  </button>
                );
              })}
              {allTrustBadges.length === 0 && (
                <p className="text-xs text-crm-text-muted">No trust badges yet. Create them in Settings → Site Content → Trust badges.</p>
              )}
            </div>
            {(form.selectedTrustBadgeIds || []).length > 0 && (
              <p className="text-xs text-emerald-600">{form.selectedTrustBadgeIds.length} trust badge(s) selected</p>
            )}
          </div>
        </div>
      );

      /* STEP 2: Media Assets */
      case 2: return (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Product Images (max 20)</label>
            <p className="text-xs text-crm-text-muted">First image = primary · Drag to reorder · Hover to set primary or remove</p>
            <MediaUploader assets={form.assets} onChange={(a) => set("assets", a)} />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Product Videos (max 5)</label>
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
            <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Landing Banners (max 5)</label>
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
          <div className="flex items-center gap-4 p-3 rounded-xl bg-crm-bg-alt/50 border border-crm-border">
            <span className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Pricing Model:</span>
            <div className="flex rounded-lg overflow-hidden border border-crm-border-strong">
              <button type="button"
                onClick={() => set("pricingMode", "non_tiered")}
                className={`px-4 py-1.5 text-xs font-semibold transition-all ${
                  form.pricingMode === "non_tiered"
                    ? "bg-crm-primary text-white"
                    : "bg-crm-bg-alt text-crm-text-dim hover:text-crm-text-bright"
                }`}
              >
                Non-Tiered (Retail Only)
              </button>
              <button type="button"
                onClick={() => set("pricingMode", "tiered")}
                className={`px-4 py-1.5 text-xs font-semibold transition-all ${
                  form.pricingMode === "tiered"
                    ? "bg-crm-primary text-white"
                    : "bg-crm-bg-alt text-crm-text-dim hover:text-crm-text-bright"
                }`}
              >
                Tiered (Retail + Wholesale)
              </button>
            </div>
            <span className="text-[10px] text-crm-text-muted ml-auto">
              {form.pricingMode === "non_tiered"
                ? "Simple retail pricing with no tier discounts"
                : "3 retail tiers + 3 wholesale tiers with quantity-based discounts"}
            </span>
          </div>

          {/* Base Pricing */}
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-crm-primary uppercase tracking-wider">
                {form.pricingMode === "non_tiered" ? "Current Price (৳) *" : "Retail Price (৳) *"}
              </label>
              <input
                type="number" min="0" step="0.01"
                value={form.retailPrice}
                onChange={(e) => set("retailPrice", e.target.value)}
                placeholder="0.00"
                className={`crm-input font-bold text-lg ${errors.retailPrice ? "border-crm-danger" : ""}`}
              />
              {errors.retailPrice && <p className="text-xs text-crm-danger">{errors.retailPrice}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Previous / Compare Price (৳)</label>
              <input
                type="number" min="0" step="0.01"
                value={form.compareAt}
                onChange={(e) => set("compareAt", e.target.value)}
                placeholder="0.00"
                className="crm-input text-crm-text-dim"
              />
              {form.compareAt && Number(form.compareAt) > Number(form.retailPrice) && (
                <p className="text-xs text-crm-success">
                  {Math.round((1 - Number(form.retailPrice) / Number(form.compareAt)) * 100)}% discount badge will show
                </p>
              )}
            </div>
          </div>

          {/* Retail Tiers (only for tiered mode) */}
          {form.pricingMode === "tiered" && (
            <div className="p-4 rounded-xl bg-crm-bg-alt/50 border border-crm-border">
              <BandTierEditor
                bands={form.retailBands}
                onChange={(t) => set("retailBands", t)}
                label="Retail quantity tiers (each row: min → max qty, discount %, auto price)"
                basePrice={form.retailPrice}
                wholesaleMode={false}
              />
              <p className="text-[10px] text-crm-text-muted mt-2">
                Tier 3 max qty becomes the retail order limit. Beyond that, only wholesale customers can order.
              </p>
            </div>
          )}

          {/* Wholesale (only for tiered mode) */}
          {form.pricingMode === "tiered" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-crm-purple uppercase tracking-wider">
                  Wholesale Pricing
                </label>
                {form.wholesalePrice && (
                  <button type="button" onClick={() => { set("wholesalePrice", ""); set("wholesaleCompareAt", ""); }}
                    className="text-xs text-crm-text-muted hover:text-crm-danger">Clear wholesale</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-crm-purple uppercase tracking-wider">Wholesale Price (৳)</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={form.wholesalePrice}
                    onChange={(e) => set("wholesalePrice", e.target.value)}
                    placeholder="0.00"
                    className="crm-input font-bold text-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Previous / Compare Price (৳)</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={form.wholesaleCompareAt}
                    onChange={(e) => set("wholesaleCompareAt", e.target.value)}
                    placeholder="0.00"
                    className="crm-input text-crm-text-dim"
                  />
                  {form.wholesaleCompareAt && form.wholesalePrice && Number(form.wholesaleCompareAt) > Number(form.wholesalePrice) && (
                    <p className="text-xs text-crm-success">
                      {Math.round((1 - Number(form.wholesalePrice) / Number(form.wholesaleCompareAt)) * 100)}% wholesale discount badge
                    </p>
                  )}
                </div>
              </div>
              {form.wholesalePrice && (
                <div className="p-4 rounded-xl bg-crm-bg-alt/50 border border-crm-purple/40">
                  <BandTierEditor
                    bands={form.wholesaleBands}
                    onChange={(t) => set("wholesaleBands", t)}
                    label="Wholesale quantity tiers · first tier min must be (last retail max + 1) · leave last max empty for unlimited"
                    basePrice={form.wholesalePrice}
                    wholesaleMode
                  />
                  <p className="text-[10px] text-crm-text-muted mt-2">
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
              <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Stock Count</label>
              <input
                type="number" min="0"
                value={form.stock}
                onChange={(e) => set("stock", e.target.value)}
                placeholder="0"
                className="crm-input text-lg font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">MOQ (Min. Order Qty)</label>
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
            <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Product SKU</label>
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
              <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Category</label>
              <button
                type="button"
                onClick={() => setShowCategoryPicker(true)}
                className="crm-input text-left flex items-center justify-between w-full"
              >
                <span className={form.categoryName ? "text-crm-text-bright" : "text-crm-text-muted"}>
                  {form.categoryName || "Select from category explorer…"}
                </span>
                <FiSearch size={14} className="text-crm-text-dim" />
              </button>
              {form.categoryId && (
                <p className="text-xs text-crm-primary">
                  Selected: {form.categoryName} <button type="button" className="text-crm-text-muted hover:text-crm-danger ml-1"
                    onClick={() => { set("categoryId", ""); set("categoryName", ""); }}>× clear</button>
                </p>
              )}
            </div>

            {/* Brand Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Brand</label>
              <BrandPicker
                value={form.brandName}
                onChange={(id, name) => { set("brandId", id); set("brandName", name); }}
              />
            </div>
          </div>

          {/* Multi-axis color / style / size options */}
          <div className="rounded-xl border border-crm-border bg-crm-bg-alt/40 p-4 space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.hasOptions}
                onChange={(e) => {
                  const on = e.target.checked;
                  setForm((f) => ({
                    ...f,
                    hasOptions: on,
                    optionGroups: on && (!f.optionGroups?.length)
                      ? [{ axis: "color", customLabel: "", rows: [{ label: "", price: "", stock: "", sku: "", hex: "", mediaUrl: "" }] }]
                      : f.optionGroups,
                  }));
                }}
                className="mt-1 w-4 h-4 rounded accent-crm-primary"
              />
              <div>
                <p className="text-sm font-bold text-crm-text-bright">Color / style / size options</p>
                <p className="text-xs text-crm-text-muted mt-0.5">
                  Optional. Add multiple option groups on the same product (e.g. Color + Style + Size). Attach media from the Media step so the storefront gallery switches when a shopper picks an option. Color options can use the eyedropper.
                </p>
              </div>
            </label>

            {form.hasOptions && (
              <div className="space-y-5">
                <p className="text-[11px] text-crm-text-muted">
                  Base retail ৳{form.retailPrice || "—"} · blank option price = use base · combinations are generated automatically
                </p>
                {(form.optionGroups || []).map((group, gi) => {
                  const mediaChoices = [
                    ...form.assets.map((a) => ({ url: a.url, label: a.url.split("/").pop() || "image", type: "image" })),
                    ...form.videoAssets.map((v) => ({ url: v.url, label: v.url.split("/").pop() || "video", type: "video" })),
                  ];
                  return (
                    <div key={gi} className="rounded-lg border border-crm-border bg-crm-bg p-3 space-y-3">
                      <div className="flex flex-wrap gap-3 items-end justify-between">
                        <div className="flex flex-wrap gap-3 items-end">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-crm-text-dim uppercase tracking-wider">Option type</label>
                            <select
                              value={group.axis}
                              onChange={(e) => {
                                const next = [...form.optionGroups];
                                next[gi] = { ...next[gi], axis: e.target.value };
                                set("optionGroups", next);
                              }}
                              className="crm-input text-sm min-w-[140px]"
                            >
                              <option value="color">Color</option>
                              <option value="style">Style</option>
                              <option value="size">Size</option>
                              <option value="custom">Custom…</option>
                            </select>
                          </div>
                          {group.axis === "custom" && (
                            <div className="space-y-1.5 flex-1 min-w-[140px]">
                              <label className="text-[10px] font-bold text-crm-text-dim uppercase tracking-wider">Custom label</label>
                              <input
                                value={group.customLabel}
                                onChange={(e) => {
                                  const next = [...form.optionGroups];
                                  next[gi] = { ...next[gi], customLabel: e.target.value };
                                  set("optionGroups", next);
                                }}
                                placeholder="e.g. Finish, Shade"
                                className="crm-input text-sm"
                              />
                            </div>
                          )}
                          <p className="text-xs font-bold text-crm-text-bright pb-2">{axisLabelOf(group)} values</p>
                        </div>
                        <button
                          type="button"
                          disabled={(form.optionGroups || []).length <= 1}
                          onClick={() => set("optionGroups", form.optionGroups.filter((_, i) => i !== gi))}
                          className="text-xs text-crm-danger hover:underline disabled:opacity-30"
                        >
                          Remove group
                        </button>
                      </div>

                      <div className="overflow-x-auto rounded-lg border border-crm-border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-crm-bg-hover text-left text-[10px] uppercase tracking-wider text-crm-text-dim">
                              <th className="px-3 py-2 font-bold">{axisLabelOf(group)} *</th>
                              {group.axis === "color" && <th className="px-3 py-2 font-bold">Color</th>}
                              <th className="px-3 py-2 font-bold">Media</th>
                              <th className="px-3 py-2 font-bold">Price (৳)</th>
                              <th className="px-3 py-2 font-bold">Stock</th>
                              <th className="px-3 py-2 font-bold">SKU</th>
                              <th className="px-2 py-2 w-10" />
                            </tr>
                          </thead>
                          <tbody>
                            {(group.rows || []).map((row, idx) => (
                              <tr key={idx} className="border-t border-crm-border">
                                <td className="px-2 py-1.5">
                                  <input
                                    value={row.label}
                                    onChange={(e) => {
                                      const next = [...form.optionGroups];
                                      const rows = [...next[gi].rows];
                                      rows[idx] = { ...rows[idx], label: e.target.value };
                                      next[gi] = { ...next[gi], rows };
                                      set("optionGroups", next);
                                    }}
                                    placeholder={group.axis === "color" ? "e.g. Ruby Red" : group.axis === "size" ? "e.g. M" : "e.g. Matte"}
                                    className="crm-input text-sm"
                                  />
                                </td>
                                {group.axis === "color" && (
                                  <td className="px-2 py-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className="h-7 w-7 rounded-md border border-crm-border shrink-0"
                                        style={{ backgroundColor: row.hex || "#e2e8f0" }}
                                        title={row.hex || "No color"}
                                      />
                                      <input
                                        value={row.hex || ""}
                                        onChange={(e) => {
                                          const next = [...form.optionGroups];
                                          const rows = [...next[gi].rows];
                                          rows[idx] = { ...rows[idx], hex: e.target.value };
                                          next[gi] = { ...next[gi], rows };
                                          set("optionGroups", next);
                                        }}
                                        placeholder="#hex"
                                        className="crm-input text-sm font-mono w-24"
                                      />
                                      <button
                                        type="button"
                                        title="Pick color from screen / product image"
                                        className="p-1.5 rounded border border-crm-border hover:bg-crm-bg-hover text-crm-primary"
                                        onClick={async () => {
                                          const res = await pickColorWithEyeDropper();
                                          if (res.error) { toast.error("Eyedropper", res.error); return; }
                                          if (res.cancelled || !res.hex) return;
                                          const next = [...form.optionGroups];
                                          const rows = [...next[gi].rows];
                                          rows[idx] = { ...rows[idx], hex: res.hex };
                                          next[gi] = { ...next[gi], rows };
                                          set("optionGroups", next);
                                        }}
                                      >
                                        <FiDroplet size={14} />
                                      </button>
                                    </div>
                                  </td>
                                )}
                                <td className="px-2 py-1.5 min-w-[160px]">
                                  <select
                                    value={row.mediaUrl || ""}
                                    onChange={(e) => {
                                      const next = [...form.optionGroups];
                                      const rows = [...next[gi].rows];
                                      rows[idx] = { ...rows[idx], mediaUrl: e.target.value };
                                      next[gi] = { ...next[gi], rows };
                                      set("optionGroups", next);
                                    }}
                                    className="crm-input text-xs w-full"
                                  >
                                    <option value="">— from Media step —</option>
                                    {mediaChoices.map((m) => (
                                      <option key={m.url} value={m.url}>
                                        {m.type}: {m.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-2 py-1.5">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={row.price}
                                    onChange={(e) => {
                                      const next = [...form.optionGroups];
                                      const rows = [...next[gi].rows];
                                      rows[idx] = { ...rows[idx], price: e.target.value };
                                      next[gi] = { ...next[gi], rows };
                                      set("optionGroups", next);
                                    }}
                                    placeholder={form.retailPrice || "Base"}
                                    className="crm-input text-sm font-mono w-24"
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <input
                                    type="number"
                                    min="0"
                                    value={row.stock}
                                    onChange={(e) => {
                                      const next = [...form.optionGroups];
                                      const rows = [...next[gi].rows];
                                      rows[idx] = { ...rows[idx], stock: e.target.value };
                                      next[gi] = { ...next[gi], rows };
                                      set("optionGroups", next);
                                    }}
                                    placeholder="0"
                                    className="crm-input text-sm w-20"
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <input
                                    value={row.sku}
                                    onChange={(e) => {
                                      const next = [...form.optionGroups];
                                      const rows = [...next[gi].rows];
                                      rows[idx] = { ...rows[idx], sku: e.target.value };
                                      next[gi] = { ...next[gi], rows };
                                      set("optionGroups", next);
                                    }}
                                    placeholder="Optional"
                                    className="crm-input text-sm font-mono"
                                  />
                                </td>
                                <td className="px-1 py-1.5 text-center">
                                  <button
                                    type="button"
                                    disabled={(group.rows || []).length <= 1}
                                    onClick={() => {
                                      const next = [...form.optionGroups];
                                      next[gi] = { ...next[gi], rows: group.rows.filter((_, i) => i !== idx) };
                                      set("optionGroups", next);
                                    }}
                                    className="p-1.5 rounded text-crm-text-muted hover:text-crm-danger disabled:opacity-30"
                                    title="Remove value"
                                  >
                                    <FiTrash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const next = [...form.optionGroups];
                          next[gi] = {
                            ...next[gi],
                            rows: [...(group.rows || []), { label: "", price: "", stock: "", sku: "", hex: "", mediaUrl: "" }],
                          };
                          set("optionGroups", next);
                        }}
                        className="crm-btn flex items-center gap-1.5 text-xs"
                      >
                        <FiPlus size={12} /> Add {axisLabelOf(group).toLowerCase()} value
                      </button>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => set("optionGroups", [
                    ...(form.optionGroups || []),
                    { axis: "size", customLabel: "", rows: [{ label: "", price: "", stock: "", sku: "", hex: "", mediaUrl: "" }] },
                  ])}
                  className="crm-btn flex items-center gap-1.5 text-xs"
                >
                  <FiPlus size={12} /> Add another option group (e.g. Size)
                </button>

                {(() => {
                  const combos = cartesianRows(form.optionGroups || []);
                  if (combos.length <= 1) return null;
                  return (
                    <p className="text-xs text-crm-text-muted">
                      Will create <strong className="text-crm-text-bright">{combos.length}</strong> storefront variants
                      ({(form.optionGroups || []).map((g) => axisLabelOf(g)).join(" × ")}).
                    </p>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      );

      /* STEP 5: Description, Key Attributes, Specifications */
      case 5: return (
        <div className="space-y-6">
          <div>
            <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider mb-2 block">
              Product Description (English)
            </label>
            <RichTextEditor
              value={form.descriptionEn}
              onChange={(html) => set("descriptionEn", html)}
              placeholder="Write a rich product description using the toolbar above…"
              minHeight={220}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider mb-2 block">
              Product Description (Bangla) <span className="text-crm-text-muted font-medium normal-case">— same rich editor</span>
            </label>
            <RichTextEditor
              value={form.descriptionBn}
              onChange={(html) => set("descriptionBn", html)}
              placeholder="বাংলায় পণ্যের বিবরণ লিখুন…"
              minHeight={220}
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider mb-2 block">
                Key Attributes <span className="text-crm-primary">(shown on storefront)</span>
              </label>
              <KVTable
                rows={form.keyAttributes}
                onChange={(rows) => set("keyAttributes", rows)}
                addLabel="Add Attribute"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider mb-2 block">
                Specifications <span className="text-crm-primary">(shows on storefront)</span>
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
            <h4 className="text-xs font-bold text-crm-text-dim uppercase tracking-wider mb-2">Collection Flags</h4>

            {[
              { key: "isFeatured", label: "Promote as Featured", desc: "Appears on homepage featured section", icon: FiStar, color: "text-crm-warning" },
              { key: "isBestRated", label: "Mark as Best Rated", desc: "Eligible for homepage best-rated collections", icon: FiStar, color: "text-crm-purple" },
              { key: "isTopTrending", label: "Mark as Top Trending", desc: "Adds ob_top_trending tag automatically", icon: FiTrendingUp, color: "text-crm-primary" },
            ].map(({ key, label, desc, icon: Icon, color }) => (
              <label key={key}
                className={`flex items-start gap-3 p-3.5 rounded-xl bg-crm-bg-alt cursor-pointer border transition-all ${
                  form[key] ? "border-crm-primary/60 bg-crm-primary/5" : "border-crm-border hover:border-crm-border-strong"
                }`}>
                <input type="checkbox" checked={form[key]}
                  onChange={(e) => set(key, e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-crm-primary" />
                <div>
                  <p className={`text-sm font-bold ${color}`}><Icon className="inline mr-1" size={13}/>{label}</p>
                  <p className="text-xs text-crm-text-muted">{desc}</p>
                </div>
              </label>
            ))}

            <label className={`flex items-start gap-3 p-3.5 rounded-xl cursor-pointer border transition-all mt-2 ${
              form.complianceConfirmed ? "border-crm-success/60 bg-crm-success/5" : "border-crm-warning/40 bg-crm-warning/5 hover:border-crm-warning"
            }`}>
              <input type="checkbox" checked={form.complianceConfirmed}
                onChange={(e) => { set("complianceConfirmed", e.target.checked); if (e.target.checked) setErrors((er) => ({ ...er, complianceConfirmed: undefined })); }}
                className="mt-0.5 w-4 h-4 rounded accent-crm-success" />
              <div>
                <p className="text-sm font-bold text-crm-warning">✓ Compliance Confirmation *</p>
                <p className="text-xs text-crm-text-muted">I confirm all product information, pricing, and media are accurate and comply with platform policies.</p>
              </div>
            </label>
            {errors.complianceConfirmed && (
              <p className="text-xs text-crm-danger flex items-center gap-1"><FiAlertCircle size={11}/>{errors.complianceConfirmed}</p>
            )}
          </div>

          {/* Mini Preview */}
          <div className="flex flex-col items-center justify-start pt-2">
            <p className="text-xs font-bold text-crm-text-dim uppercase tracking-wider mb-3">Live Preview Snapshot</p>
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
              <p className="text-xs font-bold text-crm-text-dim uppercase tracking-wider mb-3">Storefront Preview</p>
              <ProductPreviewCard form={form} />
            </div>
            <div className="flex-1 space-y-4">
              <div className="bg-crm-bg-alt/60 rounded-xl border border-crm-border p-4 text-sm space-y-2">
                <p className="font-bold text-crm-text-bright text-base">{form.titleEn}</p>
                {form.titleBn && <p className="text-crm-text-dim">{form.titleBn}</p>}
                <div className="flex flex-wrap gap-3 text-xs text-crm-text-dim">
                  <span>SKU: <strong className="text-crm-text">{form.sku || "—"}</strong></span>
                  <span>Stock: <strong className="text-crm-text">
                    {form.hasOptions
                      ? cartesianRows(form.optionGroups || []).reduce((s, r) => s + (Math.floor(Number(r.stock) || 0)), 0)
                      : (form.stock || "0")}
                  </strong></span>
                  <span>Category: <strong className="text-crm-text">{form.categoryName || "—"}</strong></span>
                  <span>Brand: <strong className="text-crm-text">{form.brandName || "—"}</strong></span>
                </div>
                {form.hasOptions && (
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-crm-text-dim">
                      Options ({cartesianRows(form.optionGroups || []).length} variants)
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {(form.optionGroups || []).map((g, gi) => (
                        <span key={gi} className="bg-crm-bg-hover text-crm-text text-[10px] px-2 py-0.5 rounded-full border border-crm-border">
                          {axisLabelOf(g)}: {(g.rows || []).filter((r) => String(r.label || "").trim()).map((r) => r.label).join(", ") || "—"}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="bg-crm-primary/20 text-crm-primary px-2 py-0.5 rounded">Retail: ৳{form.retailPrice}</span>
                  {form.compareAt && <span className="bg-crm-danger/20 text-crm-danger px-2 py-0.5 rounded">Was: ৳{form.compareAt}</span>}
                  {form.wholesalePrice && <span className="bg-crm-purple/20 text-crm-purple px-2 py-0.5 rounded">Wholesale: ৳{form.wholesalePrice}</span>}
                </div>
                <div className="flex flex-wrap gap-2 text-xs mt-1">
                  {form.isFeatured && <span className="bg-crm-warning/20 text-crm-warning px-2 py-0.5 rounded">⭐ Featured</span>}
                  {form.isBestRated && <span className="bg-crm-purple/20 text-crm-purple px-2 py-0.5 rounded">⭐ Best Rated</span>}
                  {form.isTopTrending && <span className="bg-crm-primary/20 text-crm-primary px-2 py-0.5 rounded">📈 Top Trending</span>}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {form.selectedTagIds.map((t, i) => (
                    <span key={i} className="bg-crm-bg-hover text-crm-text text-[10px] px-2 py-0.5 rounded-full">
                      {typeof t === "object" ? t.nameEn : t}
                    </span>
                  ))}
                </div>
                {form.assets.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {form.assets.slice(0, 5).map((a, i) => (
                      <img key={i} src={a.url} alt="" className="w-10 h-10 rounded object-cover border border-crm-border-strong" />
                    ))}
                    {form.assets.length > 5 && <span className="text-xs text-crm-text-muted self-center">+{form.assets.length - 5} more</span>}
                  </div>
                )}
                {form.videoAssets.length > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <FiFilm size={12} className="text-crm-purple" />
                    <span className="text-xs text-crm-purple">{form.videoAssets.length} video(s)</span>
                  </div>
                )}
                {form.bannerAssets.length > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <FiImage size={12} className="text-crm-primary" />
                    <span className="text-xs text-crm-primary">{form.bannerAssets.length} banner(s)</span>
                  </div>
                )}
              </div>

              {!form.complianceConfirmed && (
                <div className="flex items-center gap-2 p-3 bg-crm-warning/30 border border-crm-warning/50 rounded-xl text-xs text-crm-warning">
                  <FiAlertCircle size={14}/>
                  <span>You must confirm compliance on Step 6 before publishing.</span>
                  <button type="button" onClick={() => setStep(6)} className="underline font-semibold">Go back</button>
                </div>
              )}

              <button
                type="button"
                disabled={submitting}
                onClick={handlePublish}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-crm-primary to-crm-primary hover:from-crm-primary-hover hover:to-crm-primary text-white font-bold text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
              >
                {submitting ? (
                  <><FiRefreshCw className="animate-spin" size={16}/> Publishing…</>
                ) : (
                  <><FiCheck size={16}/> {isEdit ? "Save Product" : "Publish Product"}</>
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
        <div className="relative w-full max-w-5xl mx-4 my-4 flex flex-col bg-crm-bg-card border border-crm-border-strong rounded-2xl shadow-2xl overflow-hidden text-crm-text">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-crm-border bg-crm-bg-alt flex-shrink-0">
            <div>
              <h2 className="text-lg font-bold text-crm-text-bright">{isEdit ? "Edit Product" : "Add New Product"}</h2>
              <p className="text-xs text-crm-text-dim">Step {step} of {STEPS.length} — {STEPS[step - 1].label}{loadingEdit ? " · Loading…" : ""}</p>
            </div>
            <button type="button" disabled={submitting} onClick={onClose}
              className="text-crm-text-dim hover:text-crm-text-bright p-2 rounded-lg hover:bg-crm-bg-hover transition-colors">
              <FiX size={20} />
            </button>
          </div>

          {/* Step Progress */}
          <div className="px-6 py-3 border-b border-crm-border bg-crm-bg-alt/60 flex-shrink-0">
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
                        isActive ? "bg-crm-primary text-white shadow" :
                        isDone ? "text-crm-success font-semibold hover:bg-crm-bg-hover" :
                        "text-crm-text-dim font-semibold hover:bg-crm-bg-hover hover:text-crm-text-bright"
                      }`}
                    >
                      {isDone ? <FiCheck size={11}/> : <Icon size={11}/>}
                      {s.label}
                    </button>
                    {i < STEPS.length - 1 && <FiChevronRight size={14} className="text-crm-text-muted mx-0.5 flex-shrink-0"/>}
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
          <div className="flex items-center justify-between px-6 py-4 border-t border-crm-border bg-crm-bg-alt flex-shrink-0">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 1 || submitting}
              className="crm-btn flex items-center gap-2 disabled:opacity-40"
            >
              <FiChevronLeft size={14}/> Back
            </button>

            <span className="text-xs text-crm-text-muted">{step} / {STEPS.length}</span>

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
                {submitting ? <><FiRefreshCw className="animate-spin" size={14}/> {isEdit ? "Saving…" : "Publishing…"}</> : <><FiCheck size={14}/> {isEdit ? "Save Product" : "Publish Product"}</>}
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
