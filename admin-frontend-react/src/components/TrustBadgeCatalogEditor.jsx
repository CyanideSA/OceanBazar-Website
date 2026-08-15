import React, { useEffect, useState } from "react";
import { adminApi } from "../lib/api";
import { useToast } from "./ToastProvider";

const TRUST_ICON_OPTIONS = [
  "shield",
  "truck",
  "rotate",
  "headphones",
  "award",
  "lock",
  "package",
  "check",
];

/**
 * Manages the product trust-badge catalog (not site_settings JSON).
 * Badges are assigned per product in Add/Edit product.
 */
export default function TrustBadgeCatalogEditor({ disabled }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminApi.trustBadges();
      setRows(Array.isArray(data?.badges) ? data.badges : []);
    } catch {
      toast.error("Failed to load trust badges");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addRow = async () => {
    if (disabled || saving) return;
    setSaving(true);
    try {
      const created = await adminApi.createTrustBadge({
        nameEn: "New trust badge",
        nameBn: "নতুন ট্রাস্ট ব্যাজ",
        icon: "shield",
        description: "",
        sortOrder: rows.length,
      });
      setRows((prev) => [...prev, created]);
      setExpandedIdx(rows.length);
      toast.success("Badge created");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const saveRow = async (idx, patch) => {
    const row = rows[idx];
    if (!row?.id || disabled) return;
    setSaving(true);
    try {
      const updated = await adminApi.updateTrustBadge(row.id, { ...row, ...patch });
      setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...updated } : r)));
    } catch (err) {
      toast.error(err?.response?.data?.error || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (idx) => {
    const row = rows[idx];
    if (!row?.id || disabled) return;
    if (!window.confirm(`Delete “${row.nameEn}”? It will be removed from all products.`)) return;
    setSaving(true);
    try {
      await adminApi.deleteTrustBadge(row.id);
      setRows((prev) => prev.filter((_, i) => i !== idx));
      setExpandedIdx(null);
      toast.success("Badge deleted");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-crm-text-dim py-2">Loading trust badges…</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-2xs text-crm-text-muted">
        These badges attach to products in Add/Edit Product. Homepage shows each badge with an active product count; click filters the catalog.
      </p>
      {rows.length === 0 ? <p className="text-sm text-crm-text-dim py-2">No trust badges yet.</p> : null}
      <ul className="divide-y divide-crm-border rounded-xl border border-crm-border overflow-hidden">
        {rows.map((row, idx) => {
          const open = expandedIdx === idx;
          return (
            <li key={row.id} className="bg-crm-bg">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button type="button" className="flex-1 min-w-0 text-left" onClick={() => setExpandedIdx(open ? null : idx)}>
                  <p className="text-sm font-semibold text-crm-text-bright truncate">{row.nameEn || `Badge ${idx + 1}`}</p>
                  <p className="text-2xs text-crm-text-dim truncate">
                    {row.icon || "shield"} · {row.productCount ?? 0} products · {row.active === false ? "inactive" : "active"}
                  </p>
                </button>
                <button type="button" className="crm-btn text-2xs px-2 py-1 text-crm-danger" disabled={disabled || saving} onClick={() => removeRow(idx)}>
                  ✕
                </button>
              </div>
              {open ? (
                <div className="mx-2 mb-2 rounded-xl border border-crm-border bg-crm-bg-alt/40 p-3 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="text-xs text-crm-text-dim block">
                      Name (EN)
                      <input
                        className="crm-input w-full mt-1"
                        value={row.nameEn || ""}
                        disabled={disabled || saving}
                        onChange={(e) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, nameEn: e.target.value } : r)))}
                        onBlur={(e) => saveRow(idx, { nameEn: e.target.value })}
                      />
                    </label>
                    <label className="text-xs text-crm-text-dim block">
                      Name (BN)
                      <input
                        className="crm-input w-full mt-1"
                        value={row.nameBn || ""}
                        disabled={disabled || saving}
                        onChange={(e) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, nameBn: e.target.value } : r)))}
                        onBlur={(e) => saveRow(idx, { nameBn: e.target.value })}
                      />
                    </label>
                    <label className="text-xs text-crm-text-dim block">
                      Icon
                      <select
                        className="crm-input w-full mt-1"
                        value={row.icon || "shield"}
                        disabled={disabled || saving}
                        onChange={(e) => {
                          const icon = e.target.value;
                          setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, icon } : r)));
                          saveRow(idx, { icon });
                        }}
                      >
                        {TRUST_ICON_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-crm-text-dim block">
                      Slug
                      <input
                        className="crm-input w-full mt-1 font-mono text-xs"
                        value={row.slug || ""}
                        disabled={disabled || saving}
                        onChange={(e) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, slug: e.target.value } : r)))}
                        onBlur={(e) => saveRow(idx, { slug: e.target.value })}
                      />
                    </label>
                  </div>
                  <label className="text-xs text-crm-text-dim block">
                    Description
                    <input
                      className="crm-input w-full mt-1"
                      value={row.description || ""}
                      disabled={disabled || saving}
                      onChange={(e) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, description: e.target.value } : r)))}
                      onBlur={(e) => saveRow(idx, { description: e.target.value })}
                    />
                  </label>
                  <label className="text-xs text-crm-text-dim flex items-center gap-2 mt-1">
                    <input
                      type="checkbox"
                      checked={row.active !== false}
                      disabled={disabled || saving}
                      onChange={(e) => {
                        const active = e.target.checked;
                        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, active } : r)));
                        saveRow(idx, { active });
                      }}
                    />
                    Active on storefront
                  </label>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <button type="button" className="crm-btn text-sm mt-1" disabled={disabled || saving} onClick={addRow}>
        + Add trust badge
      </button>
    </div>
  );
}
