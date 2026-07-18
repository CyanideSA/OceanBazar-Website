import { useEffect, useRef, useState, useCallback } from "react";
import {
  FiX, FiSave, FiImage, FiDollarSign, FiPackage, FiInfo,
  FiFlag, FiTag, FiUpload, FiTrash2, FiStar, FiTrendingUp,
  FiAlertCircle, FiExternalLink, FiRefreshCw, FiCheck, FiFilm,
} from "react-icons/fi";
import { adminApi } from "../../lib/api";
import { useToast } from "../ToastProvider";
import { normalizeProductImageUrl } from "../../utils/mediaUrl";
import RichTextEditor from "./RichTextEditor";
import MultiMediaUploader from "./MultiMediaUploader";

/* ── Tiny section header ─────────────────────────────────────────────── */
function SectionHeader({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-crm-border mb-4">
      <div className="p-1.5 rounded-lg bg-crm-primary-dim text-crm-primary">
        <Icon size={14} />
      </div>
      <span className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">{label}</span>
    </div>
  );
}

/* ── Image grid with upload / remove / set-primary ──────────────────── */
function AssetGrid({ productId, assets, onReload }) {
  const toast = useToast();
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);

  const upload = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        await adminApi.uploadProductAsset(productId, file, "image", assets.length === 0);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
    onReload();
  };

  const setPrimary = async (assetId) => {
    try {
      await adminApi.updateProductAsset(productId, assetId, { isPrimary: true });
      onReload();
    } catch { toast.error("Failed to set primary"); }
  };

  const remove = async (assetId) => {
    if (!window.confirm("Remove this image?")) return;
    try {
      await adminApi.deleteProductAsset(productId, assetId);
      onReload();
    } catch { toast.error("Failed to remove image"); }
  };

  return (
    <div className="space-y-3">
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); upload(e.dataTransfer.files); }}
        className="border-2 border-dashed border-crm-border rounded-xl p-5 text-center cursor-pointer hover:border-crm-primary hover:bg-crm-primary-dim/30 transition-all"
      >
        <FiUpload size={22} className="mx-auto mb-1 text-crm-text-muted" />
        <p className="text-xs text-crm-text-dim">Drop images or click to upload</p>
        {uploading && <p className="text-xs text-crm-primary mt-1 animate-pulse">Uploading…</p>}
        <input ref={fileRef} type="file" multiple accept="image/*" className="hidden"
          onChange={e => upload(e.target.files)} />
      </div>
      {assets.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {assets.map(a => (
            <div key={a.id} className="relative group rounded-lg overflow-hidden border-2 border-crm-border aspect-square">
              <img src={normalizeProductImageUrl(a.url)} alt="" className="w-full h-full object-cover" />
              {a.isPrimary && (
                <span className="absolute top-1 left-1 bg-crm-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded">PRIMARY</span>
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col gap-1 items-center justify-center transition-opacity">
                {!a.isPrimary && (
                  <button onClick={() => setPrimary(a.id)} className="text-[10px] bg-crm-primary text-white px-2 py-0.5 rounded font-semibold">
                    Set Primary
                  </button>
                )}
                <button onClick={() => remove(a.id)} className="text-[10px] bg-crm-danger text-white px-2 py-0.5 rounded font-semibold">
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

/* ── Video asset upload/remove ──────────────────────────────────────── */
function VideoAssetSection({ productId, assets, onReload }) {
  const toast = useToast();
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);

  const upload = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        await adminApi.uploadProductAsset(productId, file, "video", false);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
    onReload();
  };

  const remove = async (assetId) => {
    if (!window.confirm("Remove this video?")) return;
    try {
      await adminApi.deleteProductAsset(productId, assetId);
      onReload();
    } catch { toast.error("Failed to remove video"); }
  };

  return (
    <div className="space-y-3">
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); upload(e.dataTransfer.files); }}
        className="border-2 border-dashed border-crm-border rounded-xl p-5 text-center cursor-pointer hover:border-crm-purple hover:bg-crm-purple/10 transition-all"
      >
        <FiFilm size={22} className="mx-auto mb-1 text-crm-text-muted" />
        <p className="text-xs text-crm-text-dim">Drop videos or click to upload (max 5)</p>
        {uploading && <p className="text-xs text-crm-purple mt-1 animate-pulse">Uploading...</p>}
        <input ref={fileRef} type="file" multiple accept="video/*" className="hidden"
          onChange={e => upload(e.target.files)} />
      </div>
      {assets.length > 0 && (
        <div className="space-y-2">
          {assets.map(a => (
            <div key={a.id} className="flex items-center gap-3 p-2 bg-crm-bg-hover rounded-lg border border-crm-border">
              <FiFilm size={18} className="text-crm-purple flex-shrink-0" />
              <p className="text-xs text-crm-text-dim truncate flex-1">{a.url?.split("/").pop() || "Video"}</p>
              <button onClick={() => remove(a.id)} className="text-crm-text-muted hover:text-crm-danger p-1">
                <FiTrash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Banner management ─────────────────────────────────────────────── */
function BannerSection({ productId, banners, productTitle, onReload }) {
  const toast = useToast();
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);

  const upload = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        const r = await adminApi.uploadMedia(file, "banners");
        await adminApi.createBanner({
          productId,
          imageUrl: r.secureUrl || r.url,
          title: productTitle || null,
          placement: "product",
          sortOrder: banners.length,
          enabled: true,
        });
      } catch {
        toast.error(`Failed to upload banner ${file.name}`);
      }
    }
    setUploading(false);
    onReload();
  };

  const remove = async (bannerId) => {
    if (!window.confirm("Remove this banner?")) return;
    try {
      await adminApi.deleteBanner(bannerId);
      onReload();
    } catch { toast.error("Failed to remove banner"); }
  };

  return (
    <div className="space-y-3">
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); upload(e.dataTransfer.files); }}
        className="border-2 border-dashed border-crm-border rounded-xl p-5 text-center cursor-pointer hover:border-crm-primary hover:bg-crm-primary/10 transition-all"
      >
        <FiImage size={22} className="mx-auto mb-1 text-crm-text-muted" />
        <p className="text-xs text-crm-text-dim">Drop banner images or click to upload (max 5, 1200x400px recommended)</p>
        {uploading && <p className="text-xs text-crm-primary mt-1 animate-pulse">Uploading...</p>}
        <input ref={fileRef} type="file" multiple accept="image/*" className="hidden"
          onChange={e => upload(e.target.files)} />
      </div>
      {banners.length > 0 && (
        <div className="space-y-2">
          {banners.map(b => (
            <div key={b.id} className="flex items-center gap-3 p-2 bg-crm-bg-hover rounded-lg border border-crm-border">
              <img src={normalizeProductImageUrl(b.imageUrl)} alt="" className="w-24 h-14 object-cover rounded bg-crm-bg-card flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-crm-text-dim truncate">{b.title || "Banner"}</p>
                <p className="text-[10px] text-crm-text-muted">Order: {b.sortOrder}</p>
              </div>
              <button onClick={() => remove(b.id)} className="text-crm-text-muted hover:text-crm-danger p-1 flex-shrink-0">
                <FiTrash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── KV Table for attributes/specs ──────────────────────────────────── */
function KVTable({ rows, onChange }) {
  const update = (i, field, val) => {
    const next = [...rows];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };
  return (
    <div className="space-y-1">
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input value={r.key} onChange={e => update(i, "key", e.target.value)}
            placeholder="Attribute" className="crm-input flex-1 text-xs py-1.5" />
          <input value={r.value} onChange={e => update(i, "value", e.target.value)}
            placeholder="Value" className="crm-input flex-1 text-xs py-1.5" />
          <button onClick={() => onChange(rows.filter((_, j) => j !== i))}
            className="text-crm-text-muted hover:text-crm-danger p-1"><FiTrash2 size={12} /></button>
        </div>
      ))}
      <button onClick={() => onChange([...rows, { key: "", value: "" }])}
        className="text-xs text-crm-primary hover:underline mt-1">+ Add row</button>
    </div>
  );
}

const INITIAL_BAND = { minQty: "", maxQty: "", discount: "" };

function parseBandsFromTierBands(tierBands) {
  if (!Array.isArray(tierBands) || !tierBands.length) return [{ ...INITIAL_BAND }];
  return tierBands.map((b) => ({
    minQty: b?.minQty ?? "",
    maxQty: b?.maxQty ?? "",
    discount: b?.discountPct ?? "",
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
    if (!minS || !maxS || !dS) return { error: `Retail tier row ${out.length + 1}: min, max, discount required` };
    const minQty = Math.floor(Number(minS));
    const maxQty = Math.floor(Number(maxS));
    const discountPct = Number(dS);
    if (!Number.isFinite(minQty) || minQty < 1) return { error: "Retail tier min qty is invalid" };
    if (!Number.isFinite(maxQty) || maxQty < minQty) return { error: "Retail tier max qty must be >= min qty" };
    if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 100) return { error: "Retail tier discount must be 0-100" };
    out.push({ minQty, maxQty, discountPct });
  }
  if (!out.length) return { error: "Add at least one complete retail tier" };
  if (out[0].minQty !== 1) return { error: "First retail tier must start from min qty 1" };
  for (let i = 1; i < out.length; i++) {
    if (out[i].minQty !== out[i - 1].maxQty + 1) return { error: `Retail tier ${i + 1}: min must be previous max + 1` };
  }
  return { bands: out, lastRetailMax: out[out.length - 1].maxQty };
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
  if (!entries.length) return { error: "Add at least one wholesale tier" };
  const out = [];
  for (let i = 0; i < entries.length; i++) {
    const { minS, maxS, dS } = entries[i];
    const isLast = i === entries.length - 1;
    if (!minS || !dS) return { error: `Wholesale tier row ${i + 1}: min and discount are required` };
    const minQty = Math.floor(Number(minS));
    const discountPct = Number(dS);
    let maxQty = null;
    if (!maxS && isLast) maxQty = null;
    else {
      const m = Math.floor(Number(maxS));
      if (!Number.isFinite(m)) return { error: `Wholesale tier row ${i + 1}: invalid max qty` };
      maxQty = m;
    }
    if (!Number.isFinite(minQty) || minQty < 1) return { error: `Wholesale tier row ${i + 1}: invalid min qty` };
    if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 100) return { error: `Wholesale tier row ${i + 1}: discount must be 0-100` };
    if (maxQty !== null && maxQty < minQty) return { error: `Wholesale tier row ${i + 1}: max qty must be >= min qty` };
    out.push({ minQty, maxQty, discountPct });
  }
  if (out[0].minQty !== lastRetailMax + 1) return { error: `Wholesale first min qty must be ${lastRetailMax + 1}` };
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1];
    if (prev.maxQty == null) return { error: "Only the last wholesale tier may have empty max qty" };
    if (out[i].minQty !== prev.maxQty + 1) return { error: `Wholesale tier ${i + 1}: min must be ${prev.maxQty + 1}` };
  }
  return { bands: out };
}

function BandTierEditor({ bands, onChange, basePrice, wholesaleMode }) {
  const bp = Number(basePrice) || 0;
  const update = (i, field, val) => {
    const next = [...(bands || [])];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };
  const add = () => onChange([...(bands || []), { ...INITIAL_BAND }]);
  const remove = (i) => {
    if ((bands || []).length <= 1) return;
    onChange((bands || []).filter((_, j) => j !== i));
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-crm-text-dim font-semibold uppercase tracking-wider">
          {wholesaleMode ? "Wholesale tiers" : "Retail tiers"}
        </p>
        <button type="button" onClick={add} className="text-xs text-crm-primary hover:underline">+ Add tier</button>
      </div>
      {(bands || []).map((tier, i) => {
        const isLast = i === (bands || []).length - 1;
        const discount = tier.discount === "" ? 0 : Number(tier.discount);
        const unit = bp && tier.discount !== "" ? (bp * (1 - discount / 100)).toFixed(2) : "—";
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-crm-text-muted w-10">T{i + 1}</span>
            <input type="number" min="1" placeholder="Min" className="crm-input w-20 text-xs"
              value={tier.minQty} onChange={(e) => update(i, "minQty", e.target.value)} />
            <input type="number" min="1" placeholder={wholesaleMode && isLast ? "Max (opt)" : "Max"} className="crm-input w-24 text-xs"
              value={tier.maxQty} onChange={(e) => update(i, "maxQty", e.target.value)} />
            <input type="number" min="0" max="100" placeholder="Disc%" className="crm-input w-20 text-xs"
              value={tier.discount} onChange={(e) => update(i, "discount", e.target.value)} />
            <span className="text-xs text-crm-success font-mono w-20">৳{unit}</span>
            <button type="button" onClick={() => remove(i)} disabled={(bands || []).length <= 1}
              className="text-crm-text-muted hover:text-crm-danger disabled:opacity-30">
              <FiTrash2 size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN DRAWER
═══════════════════════════════════════════════════════════════════════ */
export default function EditProductDrawer({ productId, onClose, onSaved }) {
  const toast = useToast();
  const [detail, setDetail] = useState(null);
  const [assets, setAssets] = useState([]);
  const [banners, setBanners] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");

  // form state
  const [form, setForm] = useState({});
  const set = useCallback((k, v) => setForm(f => ({ ...f, [k]: v })), []);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const [d, a, tags, bannersRes] = await Promise.all([
        adminApi.productDetail(productId),
        adminApi.productAssets(productId),
        adminApi.tagGroups().catch(() => []),
        adminApi.banners({ productId }).catch(() => ({ banners: [] })),
      ]);
      const data = d?.product || d;
      setDetail(data);
      setAssets(Array.isArray(a) ? a : a?.assets || []);
      setBanners(bannersRes?.banners || (Array.isArray(bannersRes) ? bannersRes : []));

      // tagGroups() returns { groups: [{ id, nameEn, tags: [{id, nameEn}] }] }
      const tagList = Array.isArray(tags) 
        ? tags.flatMap(g => g.tags || []) 
        : Array.isArray(tags?.groups)
          ? tags.groups.flatMap(g => g.tags || [])
          : [];
      setAllTags(tagList);

      const pricing = data?.pricing || data?.productPricing || [];
      const retail = pricing.find(p => p.customerType === "retail") || pricing[0] || {};
      const wholesale = pricing.find(p => p.customerType === "wholesale") || {};

      const currentTagIds = (data?.productTags || data?.tags || []).map(t => t.tagId ?? t.id ?? t);

      const hasWholesale = !!wholesale?.price;
      const pricingMode = data?.pricingMode || (hasWholesale ? "tiered" : "non_tiered");
      const retailBands = parseBandsFromTierBands(retail?.tierBands);
      const wholesaleBands = parseBandsFromTierBands(wholesale?.tierBands);

      setForm({
        titleEn: data?.titleEn || "",
        titleBn: data?.titleBn || "",
        status: data?.status || "active",
        brand: data?.brand || "",
        sku: data?.sku || "",
        moq: data?.moq || 1,
        stock: data?.stock ?? 0,
        pricingMode,
        retailPrice: retail?.price ? Number(retail.price) : (data?.price ? Number(data.price) : ""),
        compareAt: retail?.compareAt ? Number(retail.compareAt) : "",
        retailBands,
        wholesalePrice: wholesale?.price ? Number(wholesale.price) : "",
        wholesaleCompareAt: wholesale?.compareAt ? Number(wholesale.compareAt) : "",
        wholesaleBands,
        descriptionEn: data?.descriptionEn || "",
        isFeatured: !!data?.isFeatured,
        isBestRated: !!data?.isBestRated,
        isTopTrending: !!(data?.tags || []).some(t => t?.tag?.slug === "ob_top_trending"),
        keyAttributes: (() => {
          try { return JSON.parse(data?.attributesExtra || "[]"); } catch { return []; }
        })(),
        specifications: (() => {
          try { return JSON.parse(data?.specifications || "[]"); } catch { return []; }
        })(),
        selectedTagIds: currentTagIds,
      });
    } catch (err) {
      toast.error("Failed to load product details");
    } finally {
      setLoading(false);
    }
  }, [productId, toast]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const save = async () => {
    setSaving(true);
    try {
      const attrsFilled = (form.keyAttributes || []).filter(r => r.key?.trim() && r.value?.trim());
      const specsFilled = (form.specifications || []).filter(r => r.key?.trim() && r.value?.trim());

      const isTiered = form.pricingMode === "tiered";
      let retailTierBandsPayload = null;
      let wholesaleTierBandsPayload = null;
      if (isTiered) {
        const rParse = parseRetailBandsFromForm(form.retailBands || []);
        if (rParse.error) throw new Error(rParse.error);
        retailTierBandsPayload = rParse.bands;
        if (form.wholesalePrice && Number(form.wholesalePrice) > 0) {
          const wParse = parseWholesaleBandsFromForm(form.wholesaleBands || [], rParse.lastRetailMax);
          if (wParse.error) throw new Error(wParse.error);
          wholesaleTierBandsPayload = wParse.bands;
        }
      }
      await adminApi.updateProduct(productId, {
        titleEn: form.titleEn,
        titleBn: form.titleBn || form.titleEn,
        status: form.status,
        brand: form.brand || null,
        sku: form.sku || null,
        moq: Number(form.moq) || 1,
        stock: Number(form.stock) || 0,
        isFeatured: form.isFeatured,
        isBestRated: form.isBestRated,
        pricingMode: form.pricingMode,
        descriptionEn: form.descriptionEn || null,
        attributesExtra: attrsFilled.length ? JSON.stringify(attrsFilled) : null,
        specifications: specsFilled.length ? JSON.stringify(specsFilled) : null,
        ...(form.retailPrice && {
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
          }
        }),
        ...(isTiered && form.wholesalePrice ? {
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
      });

      if (form.selectedTagIds?.length >= 0) {
        await adminApi.setProductTags(productId, form.selectedTagIds).catch(() => {});
      }

      toast.success("Product updated successfully!");
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const TABS = [
    { id: "basic", label: "Basic Info", icon: FiInfo },
    { id: "media", label: "Media", icon: FiImage },
    { id: "pricing", label: "Pricing", icon: FiDollarSign },
    { id: "inventory", label: "Inventory", icon: FiPackage },
    { id: "content", label: "Description", icon: FiTag },
    { id: "flags", label: "Flags & Tags", icon: FiFlag },
  ];

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/50 backdrop-blur-sm" />

      {/* Drawer panel */}
      <div
        className="w-full max-w-2xl bg-crm-bg-card border-l border-crm-border flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-crm-border shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-crm-text-bright truncate">
              {loading ? "Loading…" : (form.titleEn || "Edit Product")}
            </h2>
            {detail?.sku && (
              <p className="text-[11px] text-crm-text-muted font-mono">SKU: {detail.sku}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={loadDetail} className="p-2 text-crm-text-dim hover:text-crm-primary rounded-lg hover:bg-crm-bg-hover" title="Reload">
              <FiRefreshCw size={15} />
            </button>
            {detail?.id && (
              <a href={`${(import.meta.env.VITE_STOREFRONT_URL || "http://localhost:3000").replace(/\/$/, "")}/en/product/${detail.id}`} target="_blank" rel="noreferrer"
                className="p-2 text-crm-text-dim hover:text-crm-primary rounded-lg hover:bg-crm-bg-hover" title="View on storefront">
                <FiExternalLink size={15} />
              </a>
            )}
            <button onClick={onClose} className="p-2 text-crm-text-dim hover:text-crm-text-bright rounded-lg hover:bg-crm-bg-hover">
              <FiX size={18} />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-crm-border shrink-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                activeTab === t.id
                  ? "border-crm-primary text-crm-primary bg-crm-primary-dim"
                  : "border-transparent text-crm-text-dim hover:text-crm-text-bright hover:bg-crm-bg-hover"
              }`}>
              <t.icon size={13} />{t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary" />
            </div>
          ) : (
            <>
              {/* ── BASIC INFO ── */}
              {activeTab === "basic" && (
                <div className="space-y-5">
                  <SectionHeader icon={FiInfo} label="Basic Information" />
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-crm-text-dim uppercase">Product Name (English) *</label>
                      <input className="crm-input" value={form.titleEn || ""} onChange={e => set("titleEn", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-crm-text-dim uppercase">Product Name (বাংলা)</label>
                      <input className="crm-input" value={form.titleBn || ""} onChange={e => set("titleBn", e.target.value)} placeholder="পণ্যের নাম বাংলায়" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-crm-text-dim uppercase">Status</label>
                      <select className="crm-input" value={form.status || "active"} onChange={e => set("status", e.target.value)}>
                        <option value="active">Active</option>
                        <option value="draft">Draft</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-crm-text-dim uppercase">Brand</label>
                      <input className="crm-input" value={form.brand || ""} onChange={e => set("brand", e.target.value)} placeholder="e.g. Samsung" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-crm-text-dim uppercase">SKU</label>
                      <input className="crm-input font-mono text-sm" value={form.sku || ""} onChange={e => set("sku", e.target.value)} placeholder="OB-XXXX-XXXX" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-crm-text-dim uppercase">Min. Order Qty (MOQ)</label>
                      <input type="number" min="1" className="crm-input" value={form.moq ?? 1} onChange={e => set("moq", e.target.value)} />
                    </div>
                  </div>

                  {/* Key Attributes */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-crm-text-dim uppercase">Key Attributes</label>
                    <KVTable rows={form.keyAttributes || []} onChange={v => set("keyAttributes", v)} />
                  </div>

                  {/* Specifications */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-crm-text-dim uppercase">Specifications</label>
                    <KVTable rows={form.specifications || []} onChange={v => set("specifications", v)} />
                  </div>
                </div>
              )}

              {/* ── MEDIA ── */}
              {activeTab === "media" && (
                <div className="space-y-6">
                  <SectionHeader icon={FiImage} label="Product Images" />
                  <p className="text-xs text-crm-text-dim">Upload images — first or marked image is the primary thumbnail shown to customers.</p>
                  <AssetGrid
                    productId={productId}
                    assets={assets.filter(a => a.assetType !== "video")}
                    onReload={() => adminApi.productAssets(productId).then(a => setAssets(Array.isArray(a) ? a : a?.assets || []))}
                  />

                  <SectionHeader icon={FiFilm} label="Product Videos" />
                  <VideoAssetSection
                    productId={productId}
                    assets={assets.filter(a => a.assetType === "video")}
                    onReload={() => adminApi.productAssets(productId).then(a => setAssets(Array.isArray(a) ? a : a?.assets || []))}
                  />

                  <SectionHeader icon={FiImage} label="Product Banners" />
                  <BannerSection
                    productId={productId}
                    banners={banners}
                    productTitle={form.titleEn}
                    onReload={() => adminApi.banners({ productId }).then(r => setBanners(r?.banners || (Array.isArray(r) ? r : [])))}
                  />
                </div>
              )}

              {/* ── PRICING ── */}
              {activeTab === "pricing" && (
                <div className="space-y-5">
                  <SectionHeader icon={FiDollarSign} label="Pricing" />

                  {/* Pricing Mode Toggle */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-crm-bg-hover border border-crm-border">
                    <span className="text-xs font-bold text-crm-text-dim uppercase">Model:</span>
                    <div className="flex rounded-lg overflow-hidden border border-crm-border">
                      <button type="button"
                        onClick={() => set("pricingMode", "non_tiered")}
                        className={`px-3 py-1.5 text-xs font-semibold transition-all ${
                          form.pricingMode === "non_tiered" ? "bg-crm-primary text-white" : "bg-crm-bg-card text-crm-text-dim hover:text-crm-text-bright"
                        }`}>Non-Tiered</button>
                      <button type="button"
                        onClick={() => set("pricingMode", "tiered")}
                        className={`px-3 py-1.5 text-xs font-semibold transition-all ${
                          form.pricingMode === "tiered" ? "bg-crm-primary text-white" : "bg-crm-bg-card text-crm-text-dim hover:text-crm-text-bright"
                        }`}>Tiered</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-crm-text-dim uppercase">
                        {form.pricingMode === "non_tiered" ? "Current Price (৳) *" : "Retail Price (৳) *"}
                      </label>
                      <input type="number" min="0" className="crm-input" value={form.retailPrice ?? ""} onChange={e => set("retailPrice", e.target.value)} placeholder="0" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-crm-text-dim uppercase">Previous / Compare-at (৳)</label>
                      <input type="number" min="0" className="crm-input" value={form.compareAt ?? ""} onChange={e => set("compareAt", e.target.value)} placeholder="Original price" />
                    </div>
                  </div>
                  {form.compareAt && form.retailPrice && Number(form.compareAt) > Number(form.retailPrice) && (
                    <div className="flex items-center gap-2 p-3 bg-crm-success/10 border border-crm-success/30 rounded-xl">
                      <FiCheck className="text-crm-success" size={14} />
                      <span className="text-xs text-crm-success font-semibold">
                        {Math.round((1 - Number(form.retailPrice) / Number(form.compareAt)) * 100)}% discount will be shown
                      </span>
                    </div>
                  )}

                  {/* Retail Tiers */}
                  {form.pricingMode === "tiered" && (
                    <div className="p-4 bg-crm-bg-hover rounded-xl border border-crm-border space-y-3">
                      <BandTierEditor
                        bands={form.retailBands || [{ ...INITIAL_BAND }]}
                        onChange={(rows) => set("retailBands", rows)}
                        basePrice={form.retailPrice}
                        wholesaleMode={false}
                      />
                      <p className="text-[10px] text-crm-text-muted">T3 max qty = retail order limit. Beyond that, wholesale only.</p>
                    </div>
                  )}

                  {/* Wholesale */}
                  {form.pricingMode === "tiered" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-crm-purple uppercase">Wholesale Price (৳)</label>
                          <input type="number" min="0" className="crm-input" value={form.wholesalePrice ?? ""}
                            onChange={e => set("wholesalePrice", e.target.value)} placeholder="0" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-crm-text-dim uppercase">Previous / Compare-at (৳)</label>
                          <input type="number" min="0" className="crm-input" value={form.wholesaleCompareAt ?? ""}
                            onChange={e => set("wholesaleCompareAt", e.target.value)} placeholder="0" />
                        </div>
                      </div>
                      {form.wholesalePrice && (
                        <div className="p-4 bg-crm-bg-hover rounded-xl border border-crm-purple/40 space-y-3">
                          <BandTierEditor
                            bands={form.wholesaleBands || [{ ...INITIAL_BAND }]}
                            onChange={(rows) => set("wholesaleBands", rows)}
                            basePrice={form.wholesalePrice}
                            wholesaleMode
                          />
                          <p className="text-[10px] text-crm-text-muted">Q1 &lt; Q2 &lt; Q3 &lt; Q4 &lt; Q5. Discounts must increase monotonically.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── INVENTORY ── */}
              {activeTab === "inventory" && (
                <div className="space-y-5">
                  <SectionHeader icon={FiPackage} label="Inventory & Stock" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-crm-text-dim uppercase">Stock Quantity</label>
                      <input type="number" min="0" className="crm-input text-lg font-bold" value={form.stock ?? 0} onChange={e => set("stock", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-crm-text-dim uppercase">Min. Order Qty</label>
                      <input type="number" min="1" className="crm-input" value={form.moq ?? 1} onChange={e => set("moq", e.target.value)} />
                    </div>
                  </div>
                  <div className={`p-4 rounded-xl flex items-center gap-3 ${Number(form.stock) < 10 ? "bg-crm-danger/10 border border-crm-danger/30" : "bg-crm-success/10 border border-crm-success/30"}`}>
                    <FiAlertCircle size={16} className={Number(form.stock) < 10 ? "text-crm-danger" : "text-crm-success"} />
                    <div>
                      <p className={`text-xs font-bold ${Number(form.stock) < 10 ? "text-crm-danger" : "text-crm-success"}`}>
                        {Number(form.stock) === 0 ? "Out of Stock" : Number(form.stock) < 10 ? "Low Stock Warning" : "In Stock"}
                      </p>
                      <p className="text-xs text-crm-text-dim">{Number(form.stock)} units available</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── DESCRIPTION ── */}
              {activeTab === "content" && (
                <div className="space-y-5">
                  <SectionHeader icon={FiTag} label="Content & Description" />
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-crm-text-dim uppercase">Product Description (English)</label>
                    <RichTextEditor
                      value={form.descriptionEn || ""}
                      onChange={v => set("descriptionEn", v)}
                    />
                  </div>
                </div>
              )}

              {/* ── FLAGS & TAGS ── */}
              {activeTab === "flags" && (
                <div className="space-y-5">
                  <SectionHeader icon={FiFlag} label="Flags & Collection Tags" />

                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { key: "isFeatured", label: "Featured Product", desc: "Shown in featured sections on homepage", icon: FiStar },
                      { key: "isBestRated", label: "Best Rated", desc: "Shown in best rated collection", icon: FiStar },
                      { key: "isTopTrending", label: "Top Trending", desc: "Shown in trending products widget", icon: FiTrendingUp },
                    ].map(f => (
                      <label key={f.key} className="flex items-start gap-3 p-3 rounded-xl border border-crm-border hover:border-crm-primary/50 cursor-pointer transition-all group">
                        <input type="checkbox" checked={!!form[f.key]} onChange={e => set(f.key, e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded accent-crm-primary shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-crm-text-bright group-hover:text-crm-primary transition-colors">{f.label}</p>
                          <p className="text-xs text-crm-text-dim">{f.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-crm-text-dim uppercase">Product Tags</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-crm-bg-hover rounded-xl max-h-48 overflow-y-auto">
                      {allTags.map(tag => {
                        const selected = (form.selectedTagIds || []).includes(tag.id);
                        return (
                          <button key={tag.id} type="button"
                            onClick={() => {
                              const ids = form.selectedTagIds || [];
                              set("selectedTagIds", selected ? ids.filter(i => i !== tag.id) : [...ids, tag.id]);
                            }}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                              selected ? "bg-crm-primary border-crm-primary text-white" : "border-crm-border text-crm-text-dim hover:border-crm-primary/50"
                            }`}>
                            {tag.nameEn}
                          </button>
                        );
                      })}
                      {allTags.length === 0 && <p className="text-xs text-crm-text-muted">No tags available</p>}
                    </div>
                    <p className="text-xs text-crm-text-muted">{(form.selectedTagIds || []).length} tag(s) selected</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-crm-border flex items-center justify-between shrink-0 bg-crm-bg-card">
          <button onClick={onClose} className="crm-btn px-5">Cancel</button>
          <button onClick={save} disabled={saving || loading}
            className="crm-btn crm-btn-primary px-8 gap-2 disabled:opacity-50">
            <FiSave size={14} />
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
