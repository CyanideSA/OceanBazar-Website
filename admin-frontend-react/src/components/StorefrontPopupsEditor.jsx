import React, { useMemo } from "react";
import { FiPlus, FiTrash2, FiArrowUp, FiArrowDown, FiImage } from "react-icons/fi";
import { AnimationSelect } from "../lib/storefrontMotion";
import { adminApi } from "../lib/api";

function uid() {
  return `popup-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function safeParse(json, fallback = []) {
  try {
    const v = JSON.parse(json || "[]");
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function normalizePopup(row, idx = 0) {
  const p = row && typeof row === "object" ? { ...row } : {};
  return {
    id: p.id || uid(),
    enabled: p.enabled !== false,
    type: p.type || "custom",
    title: p.title || "",
    body: p.body || "",
    imageUrl: p.imageUrl || "",
    buttonLabel: p.buttonLabel || "Close",
    buttonAction: p.buttonAction === "link" ? "link" : "close",
    buttonUrl: p.buttonUrl || "",
    buttonCloseMessage: p.buttonCloseMessage || "",
    sortOrder: p.sortOrder != null ? Number(p.sortOrder) : idx,
    animation: p.animation || "zoom-in",
    showToLoggedIn: Boolean(p.showToLoggedIn),
    dismissHours: p.dismissHours != null ? Number(p.dismissHours) : 24,
    delayMs: p.delayMs != null ? Number(p.delayMs) : 1200,
  };
}

export function StorefrontPopupsEditor({ jsonString, onJsonChange, disabled }) {
  const popups = useMemo(
    () => safeParse(jsonString).map(normalizePopup).sort((a, b) => a.sortOrder - b.sortOrder),
    [jsonString],
  );

  function commit(next) {
    const ordered = next.map((p, i) => ({ ...p, sortOrder: i }));
    onJsonChange(JSON.stringify(ordered, null, 2));
  }

  function patchAt(idx, patch) {
    const next = popups.map((p, i) => (i === idx ? { ...p, ...patch } : p));
    commit(next);
  }

  function move(idx, dir) {
    const j = idx + dir;
    if (j < 0 || j >= popups.length) return;
    const next = popups.slice();
    const tmp = next[idx];
    next[idx] = next[j];
    next[j] = tmp;
    commit(next);
  }

  async function uploadImage(idx, file) {
    if (!file) return;
    try {
      const data = await adminApi.uploadMedia(file, "storefront-popups");
      const url = data?.url || data?.secure_url || data?.secureUrl;
      if (url) patchAt(idx, { imageUrl: url });
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-crm-text-dim">
        Multiple popups are shown one at a time (by order). Welcome popups never show to logged-in customers.
      </p>
      {popups.map((p, idx) => (
        <div key={p.id} className="rounded-xl border border-crm-border bg-crm-bg-alt p-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="inline-flex items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={p.enabled}
                disabled={disabled}
                onChange={(e) => patchAt(idx, { enabled: e.target.checked })}
              />
              Enabled
            </label>
            <select
              className="crm-input text-xs w-auto"
              value={p.type}
              disabled={disabled}
              onChange={(e) => patchAt(idx, { type: e.target.value, showToLoggedIn: e.target.value === "welcome" ? false : p.showToLoggedIn })}
            >
              <option value="welcome">Welcome</option>
              <option value="promo">Promo</option>
              <option value="custom">Custom</option>
            </select>
            <div className="flex-1" />
            <button type="button" className="crm-btn text-xs" disabled={disabled || idx === 0} onClick={() => move(idx, -1)} title="Move up"><FiArrowUp size={14} /></button>
            <button type="button" className="crm-btn text-xs" disabled={disabled || idx === popups.length - 1} onClick={() => move(idx, 1)} title="Move down"><FiArrowDown size={14} /></button>
            <button type="button" className="crm-btn text-xs text-crm-danger" disabled={disabled} onClick={() => commit(popups.filter((_, i) => i !== idx))} title="Delete"><FiTrash2 size={14} /></button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-2xs font-bold uppercase text-crm-text-dim">Title</span>
              <input className="crm-input text-sm" value={p.title} disabled={disabled} onChange={(e) => patchAt(idx, { title: e.target.value })} />
            </label>
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-2xs font-bold uppercase text-crm-text-dim">Text</span>
              <textarea className="crm-input text-sm min-h-[72px]" value={p.body} disabled={disabled} onChange={(e) => patchAt(idx, { body: e.target.value })} />
            </label>
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-2xs font-bold uppercase text-crm-text-dim">Image URL</span>
              <div className="flex gap-2">
                <input className="crm-input text-sm flex-1" value={p.imageUrl} disabled={disabled} onChange={(e) => patchAt(idx, { imageUrl: e.target.value })} />
                <label className="crm-btn text-xs inline-flex items-center gap-1 cursor-pointer">
                  <FiImage size={14} /> Upload
                  <input type="file" accept="image/*" className="hidden" disabled={disabled} onChange={(e) => uploadImage(idx, e.target.files?.[0])} />
                </label>
              </div>
            </label>
            <label className="block space-y-1">
              <span className="text-2xs font-bold uppercase text-crm-text-dim">Button label</span>
              <input className="crm-input text-sm" value={p.buttonLabel} disabled={disabled} onChange={(e) => patchAt(idx, { buttonLabel: e.target.value })} />
            </label>
            <label className="block space-y-1">
              <span className="text-2xs font-bold uppercase text-crm-text-dim">Button action</span>
              <select className="crm-input text-sm" value={p.buttonAction} disabled={disabled} onChange={(e) => patchAt(idx, { buttonAction: e.target.value })}>
                <option value="link">Visit a link</option>
                <option value="close">Close popup</option>
              </select>
            </label>
            {p.buttonAction === "link" ? (
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-2xs font-bold uppercase text-crm-text-dim">Button link URL</span>
                <input className="crm-input text-sm" value={p.buttonUrl} disabled={disabled} onChange={(e) => patchAt(idx, { buttonUrl: e.target.value })} placeholder="/en/products or https://…" />
              </label>
            ) : (
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-2xs font-bold uppercase text-crm-text-dim">Close button message</span>
                <input className="crm-input text-sm" value={p.buttonCloseMessage || p.buttonLabel} disabled={disabled} onChange={(e) => patchAt(idx, { buttonCloseMessage: e.target.value })} placeholder="Got it" />
              </label>
            )}
            <AnimationSelect value={p.animation} disabled={disabled} onChange={(v) => patchAt(idx, { animation: v })} />
            <label className="block space-y-1">
              <span className="text-2xs font-bold uppercase text-crm-text-dim">Delay (ms)</span>
              <input type="number" min={0} className="crm-input text-sm" value={p.delayMs} disabled={disabled} onChange={(e) => patchAt(idx, { delayMs: Number(e.target.value) || 0 })} />
            </label>
            <label className="block space-y-1">
              <span className="text-2xs font-bold uppercase text-crm-text-dim">Dismiss hours</span>
              <input type="number" min={0} className="crm-input text-sm" value={p.dismissHours} disabled={disabled} onChange={(e) => patchAt(idx, { dismissHours: Number(e.target.value) || 0 })} />
            </label>
            {p.type !== "welcome" ? (
              <label className="inline-flex items-center gap-2 text-xs font-semibold mt-5">
                <input
                  type="checkbox"
                  checked={p.showToLoggedIn}
                  disabled={disabled}
                  onChange={(e) => patchAt(idx, { showToLoggedIn: e.target.checked })}
                />
                Show to logged-in users
              </label>
            ) : (
              <p className="text-2xs text-crm-text-muted mt-5">Welcome popups are hidden for logged-in sessions.</p>
            )}
          </div>
        </div>
      ))}

      <button
        type="button"
        className="crm-btn text-sm inline-flex items-center gap-2"
        disabled={disabled}
        onClick={() => commit([...popups, normalizePopup({ type: "custom", title: "New popup", buttonLabel: "Close", buttonAction: "close" }, popups.length)])}
      >
        <FiPlus size={14} /> Add popup
      </button>
    </div>
  );
}

export function AppDownloadSettingsEditor({ value, onChange, disabled }) {
  const cfg = value && typeof value === "object" ? value : {};
  function patch(p) {
    onChange({ ...cfg, ...p });
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-crm-text-dim">
        Top-of-header app download banner. Empty Windows/Mac links fall back to installable web app (PWA).
      </p>
      <label className="inline-flex items-center gap-2 text-xs font-semibold">
        <input type="checkbox" checked={cfg.enabled !== false} disabled={disabled} onChange={(e) => patch({ enabled: e.target.checked })} />
        Show app download banner
      </label>
      <label className="block space-y-1">
        <span className="text-2xs font-bold uppercase text-crm-text-dim">Banner text</span>
        <input className="crm-input text-sm" value={cfg.bannerText || ""} disabled={disabled} onChange={(e) => patch({ bannerText: e.target.value })} />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-2xs font-bold uppercase text-crm-text-dim">Android (Play Store / APK)</span>
          <input className="crm-input text-sm" value={cfg.androidUrl || ""} disabled={disabled} onChange={(e) => patch({ androidUrl: e.target.value })} placeholder="https://play.google.com/…" />
        </label>
        <label className="block space-y-1">
          <span className="text-2xs font-bold uppercase text-crm-text-dim">iOS (App Store)</span>
          <input className="crm-input text-sm" value={cfg.iosUrl || ""} disabled={disabled} onChange={(e) => patch({ iosUrl: e.target.value })} placeholder="https://apps.apple.com/…" />
        </label>
        <label className="block space-y-1">
          <span className="text-2xs font-bold uppercase text-crm-text-dim">Windows</span>
          <input className="crm-input text-sm" value={cfg.windowsUrl || ""} disabled={disabled} onChange={(e) => patch({ windowsUrl: e.target.value })} placeholder="Leave empty → web app install" />
        </label>
        <label className="block space-y-1">
          <span className="text-2xs font-bold uppercase text-crm-text-dim">Mac</span>
          <input className="crm-input text-sm" value={cfg.macUrl || ""} disabled={disabled} onChange={(e) => patch({ macUrl: e.target.value })} placeholder="Leave empty → web app install" />
        </label>
      </div>
      <AnimationSelect value={cfg.animation || "slide-down"} disabled={disabled} onChange={(v) => patch({ animation: v })} label="Banner animation" />
    </div>
  );
}
