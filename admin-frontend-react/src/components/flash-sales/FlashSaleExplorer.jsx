import React, { useState, useEffect, useCallback, useRef } from "react";
import { FiZap, FiTrash2, FiCheck, FiClock, FiSave, FiSearch } from "react-icons/fi";
import { api } from "../../lib/api";
import { useToast } from "../ToastProvider";
import DateTimeField from "../common/DateTimeField";

const BASE = "/api";
const MAX_UNITS = 15;
const MAX_PER_CUSTOMER = 15;
const AUTOSAVE_MS = 1500;

function toIsoDatetime(v) {
  if (!v) return null;
  const trimmed = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const emptyForm = () => ({
  name: "",
  starts_at: "",
  ends_at: "",
  banner_text: "",
  banner_color: "#ef4444",
  items: [],
});

function retailPricing(product) {
  return product.pricing?.find((p) => p.customerType === "retail") || product.pricing?.[0];
}

function TierBandEditor({ bands, onChange, disabled }) {
  if (!bands?.length) return null;
  const update = (idx, field, val) => {
    const next = bands.map((b, i) => (i === idx ? { ...b, [field]: val } : b));
    onChange(next);
  };
  return (
    <div className="mt-2 rounded-lg border border-crm-border/60 p-2 space-y-2 bg-crm-surface/50">
      <p className="text-[10px] font-black text-crm-text-bright uppercase">Flash tier bands</p>
      {bands.map((b, idx) => (
        <div key={idx} className="grid grid-cols-4 gap-1 text-xs">
          <input disabled={disabled} className="crm-input text-xs" placeholder="Min qty" type="number"
            value={b.minQty ?? ""} onChange={(e) => update(idx, "minQty", Number(e.target.value))} />
          <input disabled={disabled} className="crm-input text-xs" placeholder="Max qty" type="number"
            value={b.maxQty ?? ""} onChange={(e) => update(idx, "maxQty", e.target.value === "" ? null : Number(e.target.value))} />
          <input disabled={disabled} className="crm-input text-xs" placeholder="Discount %" type="number"
            value={b.discountPercent ?? ""} onChange={(e) => update(idx, "discountPercent", Number(e.target.value))} />
          <input disabled={disabled} className="crm-input text-xs" placeholder="Unit ৳" type="number"
            value={b.unitPrice ?? ""} onChange={(e) => update(idx, "unitPrice", Number(e.target.value))} />
        </div>
      ))}
    </div>
  );
}

export default function FlashSaleExplorer({ saleId, onSaved, onDeleted }) {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [campaignStatus, setCampaignStatus] = useState("draft");
  const [pendingApproval, setPendingApproval] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [productSearch, setProductSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [scheduling, setScheduling] = useState(false);
  const formRef = useRef(form);
  const saleIdRef = useRef(saleId);
  const timerRef = useRef(null);
  const skipNextSave = useRef(false);

  formRef.current = form;
  saleIdRef.current = saleId;

  const loadSale = useCallback(async () => {
    if (!saleId) return;
    setLoading(true);
    try {
      const res = await api.get(`${BASE}/flash-sales/${saleId}/admin`);
      const sale = res.data?.sale;
      if (!sale) {
        toast.error("Campaign not found");
        return;
      }
      const items = (res.data?.items || []).map((it) => {
        const flash = it.flash_pricing_snapshot || {};
        return {
          product_id: it.product_id,
          product_title: it.product_title || it.product_id,
          original_price: it.original_price,
          original_compare_at: it.original_compare_at,
          flash_price: it.flash_price,
          flash_compare_at: it.flash_compare_at,
          pricing_mode: it.pricing_mode || flash.pricingMode || "non_tiered",
          flash_tier_bands: flash.tierBands || flash.tier_bands || null,
          max_units: Math.min(MAX_UNITS, it.max_units),
          per_customer_limit: Math.min(MAX_PER_CUSTOMER, it.per_customer_limit ?? MAX_PER_CUSTOMER),
          include_delivery: it.include_delivery !== false,
          discount_percent: it.original_price
            ? Math.round((1 - Number(it.flash_price) / Number(it.original_price)) * 100)
            : 0,
        };
      });
      skipNextSave.current = true;
      setForm({
        name: sale.name || "",
        starts_at: sale.starts_at ? sale.starts_at.slice(0, 16) : "",
        ends_at: sale.ends_at ? sale.ends_at.slice(0, 16) : "",
        banner_text: sale.banner_text || "",
        banner_color: sale.banner_color || "#ef4444",
        items,
      });
      setCampaignStatus(sale.computed_status || sale.campaign_status || "draft");
      setPendingApproval(Boolean(sale.pending_approval));
    } catch {
      toast.error("Failed to load campaign");
    } finally {
      setLoading(false);
    }
  }, [saleId, toast]);

  useEffect(() => {
    loadSale();
  }, [loadSale]);

  const payloadItems = useCallback(() => {
    return formRef.current.items.map((i) => ({
      product_id: i.product_id,
      flash_price: Number(i.flash_price),
      flash_compare_at: i.flash_compare_at != null && i.flash_compare_at !== "" ? Number(i.flash_compare_at) : null,
      max_units: Math.min(MAX_UNITS, Number(i.max_units) || 1),
      per_customer_limit: Math.min(MAX_PER_CUSTOMER, Number(i.per_customer_limit) || MAX_PER_CUSTOMER),
      include_delivery: i.include_delivery !== false,
      pricing_mode: i.pricing_mode,
      flash_tier_bands: i.pricing_mode === "tiered" ? i.flash_tier_bands : null,
    }));
  }, []);

  const persist = useCallback(async (asDraft = true) => {
    const id = saleIdRef.current;
    const f = formRef.current;
    if (!id) return;
    setSaveState("saving");
    try {
      const body = {
        name: f.name || "Untitled campaign",
        starts_at: toIsoDatetime(f.starts_at) || new Date().toISOString(),
        ends_at: toIsoDatetime(f.ends_at) || new Date(Date.now() + 86400000 * 7).toISOString(),
        banner_text: f.banner_text,
        banner_color: f.banner_color,
        items: payloadItems(),
        save_as_draft: asDraft,
      };
      const res = await api.put(`${BASE}/flash-sales/${id}`, body);
      if (res.status === 202 || res.data?.pending) {
        setSaveState("pending");
        toast.info(res.data?.message || "Submitted for Super Admin verification");
      } else {
        setSaveState("saved");
        if (res.data?.campaign_status) {
          setCampaignStatus(res.data.campaign_status);
        }
        onSaved?.();
      }
    } catch (e) {
      setSaveState("error");
      toast.error(e?.response?.data?.error || "Auto-save failed");
    }
  }, [onSaved, payloadItems, toast]);

  useEffect(() => {
    if (loading || !saleId) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => persist(campaignStatus === "draft"), AUTOSAVE_MS);
    setSaveState("idle");
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [form, loading, saleId, campaignStatus, persist]);

  const handleSearch = useCallback(async (q) => {
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await api.get(`${BASE}/admin/products`, { params: { search: q, limit: 8, status: "active" } });
      setSearchResults(res.data?.products || []);
    } catch {
      setSearchResults([]);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => handleSearch(productSearch), 300);
    return () => clearTimeout(t);
  }, [productSearch, handleSearch]);

  function addItem(product) {
    const retail = retailPricing(product);
    const price = retail?.price ?? 0;
    const compareAt = retail?.compareAt ?? price;
    const pricingMode = product.pricingMode === "tiered" ? "tiered" : "non_tiered";
    setForm((f) => ({
      ...f,
      items: f.items.some((item) => item.product_id === product.id)
        ? f.items
        : [...f.items, {
          product_id: product.id,
          product_title: product.titleEn,
          original_price: price,
          original_compare_at: compareAt,
          flash_price: Math.round(price * 0.8),
          flash_compare_at: compareAt > price ? compareAt : price,
          pricing_mode: pricingMode,
          flash_tier_bands: retail?.tierBands || null,
          discount_percent: 20,
          max_units: MAX_UNITS,
          per_customer_limit: MAX_PER_CUSTOMER,
          include_delivery: true,
        }],
    }));
    setProductSearch("");
    setSearchResults([]);
  }

  function updateItem(idx, patch) {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, ...patch };
        if (patch.discount_percent != null && it.original_price) {
          const pct = Number(patch.discount_percent);
          next.flash_price = Math.max(1, Math.round(Number(it.original_price) * (1 - pct / 100)));
        }
        if (patch.flash_price != null && it.original_price) {
          const orig = Number(it.original_price);
          next.discount_percent = orig > 0 ? Math.round((1 - Number(patch.flash_price) / orig) * 100) : 0;
        }
        if (patch.max_units != null) next.max_units = Math.min(MAX_UNITS, Math.max(1, Number(patch.max_units)));
        if (patch.per_customer_limit != null) {
          next.per_customer_limit = Math.min(MAX_PER_CUSTOMER, Math.max(1, Number(patch.per_customer_limit)));
        }
        return next;
      }),
    }));
  }

  async function scheduleCampaign() {
    if (!form.name || !form.starts_at || !form.ends_at) {
      toast.error("Name and dates are required");
      return;
    }
    if (!form.items.length) {
      toast.error("Add at least one product");
      return;
    }
    setScheduling(true);
    // Cancel any pending auto-save so it can't flip the campaign back to draft after scheduling.
    if (timerRef.current) clearTimeout(timerRef.current);
    try {
      await persist(true);
      const res = await api.post(`${BASE}/flash-sales/${saleId}/schedule`);
      if (res.status === 202 || res.data?.pending) {
        setPendingApproval(true);
        toast.info(res.data?.message || "Submitted for Super Admin verification before going live");
        return;
      }
      toast.success("Campaign scheduled");
      loadSale();
      onSaved?.();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Schedule failed");
    } finally {
      setScheduling(false);
    }
  }

  async function deleteCampaign() {
    if (!window.confirm("Delete this draft campaign permanently?")) return;
    try {
      await api.delete(`${BASE}/flash-sales/${saleId}`);
      toast.success("Campaign deleted");
      onDeleted?.(saleId);
    } catch {
      toast.error("Delete failed");
    }
  }

  const readOnly = campaignStatus === "completed";
  const normalizedItemSearch = itemSearch.trim().toLowerCase();
  const visibleItems = form.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) =>
      !normalizedItemSearch ||
      String(item.product_title || "").toLowerCase().includes(normalizedItemSearch) ||
      String(item.product_id || "").toLowerCase().includes(normalizedItemSearch)
    );
  const saveLabel =
    saveState === "saving" ? "Saving…" :
    saveState === "saved" ? "Saved" :
    saveState === "pending" ? "Pending approval" :
    saveState === "error" ? "Save failed" :
    "Auto-save on";

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin h-10 w-10 border-b-2 border-crm-warning rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-crm-bg">
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-crm-border bg-crm-surface shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <FiZap className="text-crm-warning shrink-0" size={22} />
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-crm-text-bright truncate">{form.name || "Untitled campaign"}</h2>
            <p className="text-xs text-crm-text-dim capitalize">{campaignStatus} · changes save automatically</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-semibold flex items-center gap-1 px-2 py-1 rounded-lg ${
            saveState === "error" ? "text-crm-danger bg-crm-danger-dim" :
            saveState === "saved" ? "text-crm-success bg-green-500/10" :
            "text-crm-text-dim bg-crm-bg"
          }`}>
            <FiSave size={12} /> {saveLabel}
          </span>
          {campaignStatus === "draft" && pendingApproval && (
            <span className="text-xs font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-crm-warning bg-crm-warning-dim">
              <FiClock size={13} /> Awaiting Super Admin approval
            </span>
          )}
          {campaignStatus === "draft" && !pendingApproval && (
            <>
              <button type="button" onClick={deleteCampaign} className="p-2 rounded-lg text-crm-danger hover:bg-crm-danger-dim">
                <FiTrash2 size={16} />
              </button>
              <button type="button" disabled={scheduling} onClick={scheduleCampaign} className="crm-btn-primary flex items-center gap-2">
                {scheduling ? <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" /> : <FiCheck />}
                Schedule
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <p className="text-xs text-crm-text-dim rounded-lg bg-crm-surface border border-crm-border px-3 py-2">
          Retail-only flash pricing · Max {MAX_UNITS} units & {MAX_PER_CUSTOMER} per customer · Full pricing restore when campaign ends.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-crm-text-dim mb-1">Campaign name</label>
            <input
              value={form.name}
              disabled={readOnly}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="crm-input w-full"
              placeholder="Summer flash deal"
            />
          </div>
          <DateTimeField label="Start" value={form.starts_at} disabled={readOnly}
            onChange={(v) => setForm((f) => ({ ...f, starts_at: v }))} />
          <DateTimeField label="End" value={form.ends_at} disabled={readOnly}
            onChange={(v) => setForm((f) => ({ ...f, ends_at: v }))} />
          <div>
            <label className="block text-xs font-semibold text-crm-text-dim mb-1">Banner text</label>
            <input value={form.banner_text} disabled={readOnly}
              onChange={(e) => setForm((f) => ({ ...f, banner_text: e.target.value }))}
              className="crm-input w-full" placeholder="Flash deal · Up to 40% off" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-crm-text-dim mb-1">Campaign color</label>
            <div className="flex gap-2 items-center">
              <input type="color" disabled={readOnly} value={form.banner_color}
                onChange={(e) => setForm((f) => ({ ...f, banner_color: e.target.value }))}
                className="h-10 w-14 rounded cursor-pointer border border-crm-border bg-transparent" />
              <input value={form.banner_color} disabled={readOnly}
                onChange={(e) => setForm((f) => ({ ...f, banner_color: e.target.value }))}
                className="crm-input flex-1 font-mono text-sm" />
            </div>
          </div>
        </div>

        {!readOnly && (
          <div>
            <label className="block text-xs font-semibold text-crm-text-dim mb-2">Add products</label>
            <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
              className="crm-input w-full" placeholder="Search published products…" />
            {searchResults.length > 0 && (
              <div className="mt-1 border border-crm-border rounded-xl max-h-40 overflow-y-auto bg-crm-surface">
                {searchResults.map((p) => {
                  const alreadyAdded = form.items.some((item) => item.product_id === p.id);
                  return (
                    <button key={p.id} type="button" onClick={() => addItem(p)} disabled={alreadyAdded}
                      className="w-full text-left px-4 py-2 hover:bg-crm-border/30 text-sm disabled:opacity-55 disabled:cursor-not-allowed">
                      {p.titleEn}{" "}
                      <span className="text-crm-text-muted text-xs">
                        {alreadyAdded ? "Already added" : `(${p.pricingMode === "tiered" ? "tiered" : "flat"} retail)`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-bold text-crm-text-bright flex items-center gap-2">
              <FiClock size={14} /> Products ({form.items.length})
            </h3>
            {form.items.length > 0 && (
              <label className="relative block w-full sm:max-w-xs">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" size={14} />
                <input
                  type="search"
                  value={itemSearch}
                  onChange={(event) => setItemSearch(event.target.value)}
                  className="crm-input w-full pl-9 text-sm"
                  placeholder="Find a product in this campaign…"
                  aria-label="Search campaign products"
                />
              </label>
            )}
          </div>
          {form.items.length === 0 && (
            <p className="text-sm text-crm-text-dim py-8 text-center border border-dashed border-crm-border rounded-xl">
              Search and add products above. Pricing criteria appear per product.
            </p>
          )}
          {form.items.length > 0 && visibleItems.length === 0 && (
            <p className="text-sm text-crm-text-dim py-6 text-center border border-dashed border-crm-border rounded-xl">
              No campaign products match “{itemSearch}”.
            </p>
          )}
          {visibleItems.map(({ item, index: idx }) => (
            <div key={item.product_id} className="rounded-xl border border-crm-border bg-crm-surface p-4 space-y-3">
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-medium text-crm-text-bright">{item.product_title}</p>
                  <p className="text-xs text-crm-text-muted">
                    {item.pricing_mode === "tiered" ? "Tiered retail flash" : "Flat retail flash"} · Was ৳
                    {Number(item.original_price || 0).toLocaleString()}
                  </p>
                </div>
                {!readOnly && (
                  <button type="button"
                    onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}
                    className="text-crm-danger p-1">
                    <FiTrash2 size={16} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-crm-text-muted">Discount %</label>
                  <input type="number" disabled={readOnly || item.pricing_mode === "tiered"}
                    value={item.discount_percent ?? 0}
                    onChange={(e) => updateItem(idx, { discount_percent: e.target.value })}
                    className="crm-input w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs text-crm-text-muted">Flash ৳</label>
                  <input type="number" disabled={readOnly || item.pricing_mode === "tiered"}
                    value={item.flash_price}
                    onChange={(e) => updateItem(idx, { flash_price: e.target.value })}
                    className="crm-input w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs text-crm-text-muted">Compare ৳</label>
                  <input type="number" disabled={readOnly}
                    value={item.flash_compare_at ?? ""}
                    onChange={(e) => updateItem(idx, { flash_compare_at: e.target.value })}
                    className="crm-input w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs text-crm-text-muted">Max units</label>
                  <input type="number" min={1} max={MAX_UNITS} disabled={readOnly}
                    value={item.max_units}
                    onChange={(e) => updateItem(idx, { max_units: e.target.value })}
                    className="crm-input w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs text-crm-text-muted">Per customer</label>
                  <input type="number" min={1} max={MAX_PER_CUSTOMER} disabled={readOnly}
                    value={item.per_customer_limit}
                    onChange={(e) => updateItem(idx, { per_customer_limit: e.target.value })}
                    className="crm-input w-full text-sm" />
                </div>
              </div>
              {item.pricing_mode === "tiered" && (
                <TierBandEditor
                  bands={item.flash_tier_bands || []}
                  disabled={readOnly}
                  onChange={(bands) => updateItem(idx, { flash_tier_bands: bands })}
                />
              )}
              {!readOnly && (
                <button type="button"
                  onClick={() => updateItem(idx, { include_delivery: !item.include_delivery })}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                    item.include_delivery !== false
                      ? "border-crm-border text-crm-text-dim"
                      : "border-green-500/40 text-crm-success bg-green-500/10"
                  }`}>
                  {item.include_delivery !== false ? "Delivery: customer pays" : "Delivery: FREE for customer"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
