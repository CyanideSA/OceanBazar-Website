import React, { useState, useEffect, useCallback } from "react";
import { FiZap, FiX, FiCheck, FiTrash2 } from "react-icons/fi";
import { api } from "../../lib/api";
import { useToast } from "../ToastProvider";

const BASE = "/api";
const MAX_UNITS = 15;
const MAX_PER_CUSTOMER = 15;

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

export default function FlashSaleCampaignModal({ saleId, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = Boolean(saleId);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [campaignStatus, setCampaignStatus] = useState("draft");

  const loadSale = useCallback(async () => {
    if (!saleId) return;
    setLoading(true);
    try {
      const res = await api.get(`${BASE}/flash-sales/${saleId}/admin`);
      const sale = res.data?.sale;
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
          flash_tier_bands: flash.tierBands,
          max_units: Math.min(MAX_UNITS, it.max_units),
          per_customer_limit: Math.min(MAX_PER_CUSTOMER, it.per_customer_limit ?? MAX_PER_CUSTOMER),
          include_delivery: it.include_delivery !== false,
          discount_percent: it.original_price
            ? Math.round((1 - Number(it.flash_price) / Number(it.original_price)) * 100)
            : 0,
        };
      });
      setForm({
        name: sale.name,
        starts_at: sale.starts_at ? sale.starts_at.slice(0, 16) : "",
        ends_at: sale.ends_at ? sale.ends_at.slice(0, 16) : "",
        banner_text: sale.banner_text || "",
        banner_color: sale.banner_color || "#ef4444",
        items,
      });
      setCampaignStatus(sale.computed_status || sale.campaign_status || "draft");
    } catch {
      toast.error("Failed to load campaign");
      onClose();
    } finally {
      setLoading(false);
    }
  }, [saleId, toast, onClose]);

  useEffect(() => {
    loadSale();
  }, [loadSale]);

  const handleSearch = useCallback(async (q) => {
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await api.get(`${BASE}/admin/products`, { params: { search: q, limit: 8 } });
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
    if (form.items.find((i) => i.product_id === product.id)) return;
    const retail = retailPricing(product);
    const price = retail?.price ?? 0;
    const compareAt = retail?.compareAt ?? price;
    const pricingMode = product.pricingMode === "tiered" ? "tiered" : "non_tiered";
    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        {
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
        },
      ],
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

  function payloadItems() {
    return form.items.map((i) => ({
      product_id: i.product_id,
      flash_price: Number(i.flash_price),
      flash_compare_at: i.flash_compare_at != null && i.flash_compare_at !== "" ? Number(i.flash_compare_at) : null,
      max_units: Math.min(MAX_UNITS, Number(i.max_units) || 1),
      per_customer_limit: Math.min(MAX_PER_CUSTOMER, Number(i.per_customer_limit) || MAX_PER_CUSTOMER),
      include_delivery: i.include_delivery !== false,
      pricing_mode: i.pricing_mode,
      flash_tier_bands: i.pricing_mode === "tiered" ? i.flash_tier_bands : null,
    }));
  }

  async function save(saveAsDraft) {
    if (!form.name || !form.starts_at || !form.ends_at) {
      toast.error("Name and dates are required");
      return;
    }
    if (!form.items.length) {
      toast.error("Add at least one product");
      return;
    }
    setSaving(true);
    try {
      const body = { ...form, items: payloadItems(), save_as_draft: saveAsDraft };
      if (isEdit) {
        await api.put(`${BASE}/flash-sales/${saleId}`, body);
        toast.success(saveAsDraft ? "Draft saved" : "Campaign updated");
      } else {
        await api.post(`${BASE}/flash-sales`, body);
        toast.success(saveAsDraft ? "Draft created" : "Campaign scheduled");
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const readOnly = campaignStatus === "completed";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-crm-surface border border-crm-border rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-crm-border sticky top-0 bg-crm-surface z-10">
          <h2 className="text-xl font-bold text-crm-text-bright flex items-center gap-2">
            <FiZap className="text-crm-warning" />
            {isEdit ? "Edit Flash Campaign" : "New Flash Campaign"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-crm-border/30">
            <FiX size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin h-10 w-10 border-b-2 border-crm-warning rounded-full" />
          </div>
        ) : (
          <div className="p-6 space-y-5">
            <p className="text-xs text-crm-text-dim rounded-lg bg-crm-bg border border-crm-border px-3 py-2">
              Retail-only flash pricing · Max {MAX_UNITS} units & {MAX_PER_CUSTOMER} per customer per product · Wholesale
              pricing is snapshotted and restored when the campaign ends.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-crm-text-dim mb-1">Campaign name *</label>
                <input
                  value={form.name}
                  disabled={readOnly}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="crm-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-crm-text-dim mb-1">Start *</label>
                <input
                  type="datetime-local"
                  disabled={readOnly}
                  value={form.starts_at}
                  onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                  className="crm-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-crm-text-dim mb-1">End *</label>
                <input
                  type="datetime-local"
                  disabled={readOnly}
                  value={form.ends_at}
                  onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                  className="crm-input w-full"
                />
              </div>
            </div>

            {!readOnly && (
              <div>
                <label className="block text-xs font-semibold text-crm-text-dim mb-2">Add products</label>
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="crm-input w-full"
                  placeholder="Search products..."
                />
                {searchResults.length > 0 && (
                  <div className="mt-1 border border-crm-border rounded-xl max-h-40 overflow-y-auto bg-crm-bg">
                    {searchResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addItem(p)}
                        className="w-full text-left px-4 py-2 hover:bg-crm-border/30 text-sm"
                      >
                        {p.titleEn}{" "}
                        <span className="text-crm-text-muted text-xs">
                          ({p.pricingMode === "tiered" ? "tiered" : "flat"} retail)
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {form.items.map((item, idx) => (
              <div key={item.product_id} className="rounded-xl border border-crm-border bg-crm-bg p-3 space-y-3">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-medium text-crm-text-bright">{item.product_title}</p>
                    <p className="text-xs text-crm-text-muted">
                      {item.pricing_mode === "tiered" ? "Tiered retail flash" : "Flat retail flash"} · Was ৳
                      {Number(item.original_price || 0).toLocaleString()}
                    </p>
                  </div>
                  {!readOnly && (
                    <button type="button" onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))} className="text-crm-danger p-1">
                      <FiTrash2 size={16} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-crm-text-muted">Discount %</label>
                    <input
                      type="number"
                      disabled={readOnly}
                      value={item.discount_percent ?? 0}
                      onChange={(e) => updateItem(idx, { discount_percent: e.target.value })}
                      className="crm-input w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-crm-text-muted">Flash ৳</label>
                    <input
                      type="number"
                      disabled={readOnly}
                      value={item.flash_price}
                      onChange={(e) => updateItem(idx, { flash_price: e.target.value })}
                      className="crm-input w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-crm-text-muted">Compare ৳</label>
                    <input
                      type="number"
                      disabled={readOnly}
                      value={item.flash_compare_at ?? ""}
                      onChange={(e) => updateItem(idx, { flash_compare_at: e.target.value })}
                      className="crm-input w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-crm-text-muted">Max units (≤{MAX_UNITS})</label>
                    <input
                      type="number"
                      min={1}
                      max={MAX_UNITS}
                      disabled={readOnly}
                      value={item.max_units}
                      onChange={(e) => updateItem(idx, { max_units: e.target.value })}
                      className="crm-input w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-crm-text-muted">Per customer (≤{MAX_PER_CUSTOMER})</label>
                    <input
                      type="number"
                      min={1}
                      max={MAX_PER_CUSTOMER}
                      disabled={readOnly}
                      value={item.per_customer_limit}
                      onChange={(e) => updateItem(idx, { per_customer_limit: e.target.value })}
                      className="crm-input w-full text-sm"
                    />
                  </div>
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => updateItem(idx, { include_delivery: !item.include_delivery })}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                      item.include_delivery !== false
                        ? "border-crm-border text-crm-text-dim"
                        : "border-green-500/40 text-green-400 bg-green-500/10"
                    }`}
                  >
                    {item.include_delivery !== false ? "Delivery: customer pays" : "Delivery: FREE for customer"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && !readOnly && (
          <div className="flex flex-wrap justify-end gap-2 p-6 border-t border-crm-border sticky bottom-0 bg-crm-surface">
            <button type="button" onClick={onClose} className="crm-btn-secondary">
              Cancel
            </button>
            <button type="button" disabled={saving} onClick={() => save(true)} className="crm-btn-secondary">
              Save draft
            </button>
            <button type="button" disabled={saving} onClick={() => save(false)} className="crm-btn-primary flex items-center gap-2">
              {saving ? <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" /> : <FiCheck />}
              {isEdit ? "Update campaign" : "Schedule / publish"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
