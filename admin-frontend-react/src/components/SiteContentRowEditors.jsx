import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adminApi } from "../lib/api";

const FONT_OPTIONS = [
  "Inter",
  "Poppins",
  "Montserrat",
  "Roboto",
  "Open Sans",
  "Lato",
  "Nunito",
  "Raleway",
  "Oswald",
  "Playfair Display",
  "Merriweather",
  "Bebas Neue",
];

function uid() {
  return `ov_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function rowCardClass(disabled) {
  return `rounded-lg border border-crm-border p-3 mb-3 ${disabled ? "opacity-60" : "bg-crm-bg"}`;
}

function parseRows(jsonString) {
  try {
    const p = JSON.parse(jsonString || "[]");
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

/** Migrate legacy title/subtitle/cta fields into overlays when missing. */
export function normalizeSlide(row, idx = 0) {
  const base = row && typeof row === "object" ? { ...row } : {};
  if (!Array.isArray(base.overlays) || base.overlays.length === 0) {
    const overlays = [];
    if (base.title) {
      overlays.push({
        id: uid(),
        type: "text",
        text: String(base.title),
        fontFamily: "Inter",
        fontSize: 42,
        fontWeight: 800,
        color: "#ffffff",
        x: 8,
        y: 28,
      });
    }
    if (base.subtitle) {
      overlays.push({
        id: uid(),
        type: "text",
        text: String(base.subtitle),
        fontFamily: "Inter",
        fontSize: 18,
        fontWeight: 500,
        color: "#ffffff",
        x: 8,
        y: 42,
      });
    }
    if (base.ctaText || base.ctaLink || base.linkUrl) {
      overlays.push({
        id: uid(),
        type: "button",
        text: String(base.ctaText || "Shop Now"),
        linkUrl: String(base.ctaLink || base.linkUrl || "/en/products"),
        fontFamily: "Inter",
        fontSize: 16,
        fontWeight: 700,
        color: "#0a5d61",
        bgColor: "#ffffff",
        x: 8,
        y: 58,
      });
    }
    base.overlays = overlays;
  }
  if (base.sortOrder == null) base.sortOrder = idx;
  if (!base.animation) base.animation = "fade";
  return base;
}

function ensureGoogleFonts(families) {
  if (typeof document === "undefined") return;
  const needed = [...new Set(families.filter(Boolean))];
  if (!needed.length) return;
  const id = "ob-hero-google-fonts";
  let link = document.getElementById(id);
  const familyQuery = needed
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700;800`)
    .join("&");
  const href = `https://fonts.googleapis.com/css2?${familyQuery}&display=swap`;
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  if (link.getAttribute("href") !== href) link.setAttribute("href", href);
}

function OverlayNode({
  overlay,
  selected,
  disabled,
  onSelect,
  onMovePercent,
}) {
  const dragRef = useRef(null);

  const onPointerDown = (e) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(overlay.id);
    const canvas = e.currentTarget.parentElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: Number(overlay.x) || 0,
      origY: Number(overlay.y) || 0,
      w: rect.width,
      h: rect.height,
      pointerId: e.pointerId,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = ((e.clientX - d.startX) / d.w) * 100;
    const dy = ((e.clientY - d.startY) / d.h) * 100;
    const x = Math.min(95, Math.max(0, d.origX + dx));
    const y = Math.min(92, Math.max(0, d.origY + dy));
    onMovePercent(overlay.id, x, y);
  };

  const onPointerUp = (e) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch { /* ignore */ }
    }
  };

  const style = {
    left: `${Number(overlay.x) || 0}%`,
    top: `${Number(overlay.y) || 0}%`,
    fontFamily: `"${overlay.fontFamily || "Inter"}", system-ui, sans-serif`,
    fontSize: `${Number(overlay.fontSize) || 16}px`,
    fontWeight: Number(overlay.fontWeight) || 600,
    color: overlay.color || "#fff",
    cursor: disabled ? "default" : "grab",
    touchAction: "none",
    userSelect: "none",
    maxWidth: "90%",
  };

  if (overlay.type === "button") {
    return (
      <button
        type="button"
        className={`absolute z-10 rounded-lg px-4 py-2 shadow-md border ${selected ? "ring-2 ring-crm-primary border-crm-primary" : "border-transparent"}`}
        style={{
          ...style,
          background: overlay.bgColor || "#ffffff",
          color: overlay.color || "#0a5d61",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={(e) => e.preventDefault()}
      >
        {overlay.text || "Button"}
      </button>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={`absolute z-10 whitespace-pre-wrap drop-shadow-md ${selected ? "ring-2 ring-crm-primary rounded-sm px-1" : ""}`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {overlay.text || "Text"}
    </div>
  );
}

function SlideEditorCard({
  row,
  idx,
  total,
  disabled,
  onChange,
  onRemove,
  onMove,
  compactChrome = false,
}) {
  const [uploading, setUploading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const slide = normalizeSlide(row, idx);
  const overlays = Array.isArray(slide.overlays) ? slide.overlays : [];
  const selected = overlays.find((o) => o.id === selectedId) || null;

  useEffect(() => {
    ensureGoogleFonts(overlays.map((o) => o.fontFamily));
  }, [overlays]);

  const patch = (partial) => onChange({ ...slide, ...partial });
  const patchOverlay = (id, partial) => {
    patch({
      overlays: overlays.map((o) => (o.id === id ? { ...o, ...partial } : o)),
    });
  };

  const addOverlay = (type) => {
    const next =
      type === "button"
        ? {
            id: uid(),
            type: "button",
            text: "Shop Now",
            linkUrl: "/en/products",
            fontFamily: "Inter",
            fontSize: 16,
            fontWeight: 700,
            color: "#0a5d61",
            bgColor: "#ffffff",
            x: 12,
            y: 60,
          }
        : {
            id: uid(),
            type: "text",
            text: "New text",
            fontFamily: "Inter",
            fontSize: 32,
            fontWeight: 700,
            color: "#ffffff",
            x: 12,
            y: 30,
          };
    patch({ overlays: [...overlays, next] });
    setSelectedId(next.id);
  };

  const removeOverlay = (id) => {
    patch({ overlays: overlays.filter((o) => o.id !== id) });
    if (selectedId === id) setSelectedId(null);
  };

  const uploadFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const res = await adminApi.uploadMedia(file, "hero-slides");
      const url = res?.secureUrl || res?.url || res?.secure_url || res?.data?.url;
      if (!url) throw new Error("No URL returned");
      patch({ imageUrl: url });
    } catch (e) {
      setError(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={compactChrome ? "rounded-lg p-2" : rowCardClass(disabled)}>
      {!compactChrome ? (
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs font-bold text-crm-text-bright uppercase tracking-wide">Slide {idx + 1}</span>
        <div className="flex-1" />
        <button type="button" className="crm-btn text-xs" disabled={disabled || idx === 0} onClick={() => onMove(-1)}>
          Up
        </button>
        <button type="button" className="crm-btn text-xs" disabled={disabled || idx === total - 1} onClick={() => onMove(1)}>
          Down
        </button>
        <button type="button" className="crm-btn text-xs text-crm-danger" disabled={disabled} onClick={onRemove}>
          Remove
        </button>
      </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Visual canvas */}
        <div className="xl:col-span-3 space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              className="crm-btn text-xs"
              disabled={disabled || uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? "Uploading…" : slide.imageUrl ? "Replace image" : "Upload image"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={disabled}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f);
                e.target.value = "";
              }}
            />
            <button type="button" className="crm-btn text-xs" disabled={disabled || !slide.imageUrl} onClick={() => addOverlay("text")}>
              + Text
            </button>
            <button type="button" className="crm-btn text-xs" disabled={disabled || !slide.imageUrl} onClick={() => addOverlay("button")}>
              + Button
            </button>
            <span className="text-2xs text-crm-text-dim">Drag overlays on the image to place them</span>
          </div>
          {error ? <p className="text-xs text-crm-danger">{error}</p> : null}

          <div
            className="relative w-full overflow-hidden rounded-xl border border-crm-border bg-crm-bg-alt aspect-[16/7] select-none"
            onClick={() => setSelectedId(null)}
          >
            {slide.imageUrl ? (
              <img src={slide.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover pointer-events-none" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-crm-text-dim">
                Upload a hero image to start designing
              </div>
            )}
            {slide.imageUrl
              ? overlays.map((ov) => (
                  <OverlayNode
                    key={ov.id}
                    overlay={ov}
                    selected={ov.id === selectedId}
                    disabled={disabled}
                    onSelect={setSelectedId}
                    onMovePercent={(id, x, y) => patchOverlay(id, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 })}
                  />
                ))
              : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="text-xs text-crm-text-dim block">
              Transition / animation
              <select
                className="crm-input w-full mt-1"
                value={slide.animation || "fade"}
                onChange={(e) => patch({ animation: e.target.value })}
                disabled={disabled}
              >
                <option value="none">None</option>
                <option value="fade">Fade</option>
                <option value="fade-up">Fade up</option>
                <option value="fade-down">Fade down</option>
                <option value="fade-left">Fade left</option>
                <option value="fade-right">Fade right</option>
                <option value="zoom-in">Zoom in</option>
                <option value="zoom-out">Zoom out</option>
                <option value="slide-up">Slide up</option>
                <option value="slide-down">Slide down</option>
                <option value="slide-left">Slide left</option>
                <option value="slide-right">Slide right</option>
                <option value="bounce">Bounce</option>
                <option value="flip">Flip</option>
                <option value="blur-in">Blur in</option>
                <option value="scale-spring">Scale spring</option>
                <option value="rotate-in">Rotate in</option>
                <option value="ken-burns">Ken Burns</option>
              </select>
            </label>
            <label className="text-xs text-crm-text-dim block">
              Rotation (ms, optional)
              <input
                type="number"
                min={0}
                step={500}
                className="crm-input w-full mt-1"
                value={slide.rotationMs ?? ""}
                onChange={(e) => patch({ rotationMs: e.target.value === "" ? "" : Number(e.target.value) })}
                disabled={disabled}
                placeholder="use default"
              />
            </label>
            <label className="text-xs text-crm-text-dim block">
              Sort order
              <input
                type="number"
                className="crm-input w-full mt-1"
                value={slide.sortOrder ?? idx}
                onChange={(e) => patch({ sortOrder: Number(e.target.value) })}
                disabled={disabled}
              />
            </label>
          </div>
        </div>

        {/* Overlay inspector */}
        <div className="xl:col-span-2 space-y-3">
          <h4 className="text-xs font-black uppercase tracking-widest text-crm-text-dim">Selected overlay</h4>
          {!selected ? (
            <p className="text-sm text-crm-text-dim">Click a text or button on the preview to edit it.</p>
          ) : (
            <div className="space-y-2 rounded-lg border border-crm-border p-3 bg-crm-bg-alt">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-crm-text-bright uppercase">{selected.type}</span>
                <button type="button" className="crm-btn text-xs text-crm-danger" disabled={disabled} onClick={() => removeOverlay(selected.id)}>
                  Delete
                </button>
              </div>
              <label className="text-xs text-crm-text-dim block">
                {selected.type === "button" ? "Button text" : "Text"}
                <input
                  className="crm-input w-full mt-1"
                  value={selected.text || ""}
                  disabled={disabled}
                  onChange={(e) => patchOverlay(selected.id, { text: e.target.value })}
                />
              </label>
              {selected.type === "button" ? (
                <label className="text-xs text-crm-text-dim block">
                  Button link
                  <input
                    className="crm-input w-full mt-1"
                    value={selected.linkUrl || ""}
                    disabled={disabled}
                    placeholder="/en/products or https://…"
                    onChange={(e) => patchOverlay(selected.id, { linkUrl: e.target.value })}
                  />
                </label>
              ) : null}
              <label className="text-xs text-crm-text-dim block">
                Font
                <select
                  className="crm-input w-full mt-1"
                  value={selected.fontFamily || "Inter"}
                  disabled={disabled}
                  onChange={(e) => patchOverlay(selected.id, { fontFamily: e.target.value })}
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f} value={f} style={{ fontFamily: f }}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-crm-text-dim block">
                  Font size
                  <input
                    type="number"
                    min={10}
                    max={120}
                    className="crm-input w-full mt-1"
                    value={selected.fontSize ?? 16}
                    disabled={disabled}
                    onChange={(e) => patchOverlay(selected.id, { fontSize: Number(e.target.value) })}
                  />
                </label>
                <label className="text-xs text-crm-text-dim block">
                  Weight
                  <select
                    className="crm-input w-full mt-1"
                    value={selected.fontWeight ?? 700}
                    disabled={disabled}
                    onChange={(e) => patchOverlay(selected.id, { fontWeight: Number(e.target.value) })}
                  >
                    {[400, 500, 600, 700, 800].map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-crm-text-dim block">
                  Text color
                  <input
                    type="color"
                    className="crm-input w-full mt-1 h-10 p-1"
                    value={selected.color || "#ffffff"}
                    disabled={disabled}
                    onChange={(e) => patchOverlay(selected.id, { color: e.target.value })}
                  />
                </label>
                {selected.type === "button" ? (
                  <label className="text-xs text-crm-text-dim block">
                    Button background
                    <input
                      type="color"
                      className="crm-input w-full mt-1 h-10 p-1"
                      value={selected.bgColor || "#ffffff"}
                      disabled={disabled}
                      onChange={(e) => patchOverlay(selected.id, { bgColor: e.target.value })}
                    />
                  </label>
                ) : (
                  <div />
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-crm-text-dim block">
                  X %
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    className="crm-input w-full mt-1"
                    value={selected.x ?? 0}
                    disabled={disabled}
                    onChange={(e) => patchOverlay(selected.id, { x: Number(e.target.value) })}
                  />
                </label>
                <label className="text-xs text-crm-text-dim block">
                  Y %
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    className="crm-input w-full mt-1"
                    value={selected.y ?? 0}
                    disabled={disabled}
                    onChange={(e) => patchOverlay(selected.id, { y: Number(e.target.value) })}
                  />
                </label>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-2xs text-crm-text-dim uppercase font-bold tracking-wide">Overlays on this slide</p>
            {overlays.length === 0 ? (
              <p className="text-xs text-crm-text-dim">None yet — add text or a button.</p>
            ) : (
              <ul className="space-y-1">
                {overlays.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      className={`w-full text-left text-xs rounded-md px-2 py-1.5 border ${o.id === selectedId ? "border-crm-primary bg-crm-primary/10" : "border-crm-border"}`}
                      onClick={() => setSelectedId(o.id)}
                    >
                      <span className="font-semibold uppercase text-crm-text-dim mr-2">{o.type}</span>
                      {(o.text || "").slice(0, 40) || "—"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroSlidesRowEditor({ jsonString, onJsonChange, disabled }) {
  const rows = useMemo(() => parseRows(jsonString).map((r, i) => normalizeSlide(r, i)), [jsonString]);
  const [expandedIdx, setExpandedIdx] = useState(null);

  const commit = useCallback(
    (next) => {
      onJsonChange(JSON.stringify(next, null, 2));
    },
    [onJsonChange],
  );

  const updateRow = (idx, nextRow) => {
    const next = rows.map((r, i) => (i === idx ? nextRow : r));
    commit(next);
  };

  const addRow = () => {
    const nextIdx = rows.length;
    commit([
      ...rows,
      normalizeSlide(
        {
          imageUrl: "",
          sortOrder: rows.length,
          rotationMs: "",
          overlays: [
            {
              id: uid(),
              type: "text",
              text: "Your headline",
              fontFamily: "Inter",
              fontSize: 42,
              fontWeight: 800,
              color: "#ffffff",
              x: 8,
              y: 28,
            },
            {
              id: uid(),
              type: "button",
              text: "Shop Now",
              linkUrl: "/en/products",
              fontFamily: "Inter",
              fontSize: 16,
              fontWeight: 700,
              color: "#0a5d61",
              bgColor: "#ffffff",
              x: 8,
              y: 58,
            },
          ],
        },
        rows.length,
      ),
    ]);
    setExpandedIdx(nextIdx);
  };

  const removeRow = (idx) => {
    commit(rows.filter((_, i) => i !== idx));
    setExpandedIdx((cur) => {
      if (cur == null) return null;
      if (cur === idx) return null;
      if (cur > idx) return cur - 1;
      return cur;
    });
  };

  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[idx], next[j]] = [next[j], next[idx]];
    commit(next.map((r, i) => ({ ...r, sortOrder: i })));
    setExpandedIdx((cur) => {
      if (cur === idx) return j;
      if (cur === j) return idx;
      return cur;
    });
  };

  const slideLabel = (row, idx) => {
    const overlays = Array.isArray(row.overlays) ? row.overlays : [];
    const textOv = overlays.find((o) => o.type === "text" && o.text);
    return (textOv?.text || row.title || `Slide ${idx + 1}`).slice(0, 48);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-crm-text-dim">
        Compact list — expand a slide to upload the image and place text/buttons.
      </p>
      {rows.length === 0 ? <p className="text-sm text-crm-text-dim py-2">No slides yet.</p> : null}
      <ul className="divide-y divide-crm-border rounded-xl border border-crm-border overflow-hidden bg-crm-bg-alt/40">
        {rows.map((row, idx) => {
          const open = expandedIdx === idx;
          const overlays = Array.isArray(row.overlays) ? row.overlays : [];
          return (
            <li key={row.id || `slide-${idx}`} className="bg-crm-bg">
              <div className="flex items-center gap-3 px-3 py-2.5">
                <button
                  type="button"
                  className="flex flex-1 min-w-0 items-center gap-3 text-left"
                  onClick={() => setExpandedIdx(open ? null : idx)}
                  disabled={disabled && !open}
                >
                  <div className="h-12 w-20 shrink-0 overflow-hidden rounded-md border border-crm-border bg-crm-bg-alt">
                    {row.imageUrl ? (
                      <img src={row.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-2xs text-crm-text-muted">No image</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-crm-text-bright truncate">{slideLabel(row, idx)}</p>
                    <p className="text-2xs text-crm-text-dim">
                      #{idx + 1} · {overlays.length} overlay{overlays.length === 1 ? "" : "s"}
                      {!row.imageUrl ? " · needs image" : ""}
                    </p>
                  </div>
                  <span className="text-xs text-crm-primary font-semibold shrink-0">{open ? "Collapse" : "Edit"}</span>
                </button>
                <div className="flex shrink-0 gap-1">
                  <button type="button" className="crm-btn text-2xs px-2 py-1" disabled={disabled || idx === 0} onClick={() => move(idx, -1)}>↑</button>
                  <button type="button" className="crm-btn text-2xs px-2 py-1" disabled={disabled || idx === rows.length - 1} onClick={() => move(idx, 1)}>↓</button>
                  <button type="button" className="crm-btn text-2xs px-2 py-1 text-crm-danger" disabled={disabled} onClick={() => removeRow(idx)}>✕</button>
                </div>
              </div>
              {open ? (
                <div className="border-t border-crm-border px-2 pb-3 pt-1 bg-crm-bg-alt/30">
                  <SlideEditorCard
                    row={row}
                    idx={idx}
                    total={rows.length}
                    disabled={disabled}
                    onChange={(next) => updateRow(idx, next)}
                    onRemove={() => removeRow(idx)}
                    onMove={(dir) => move(idx, dir)}
                    compactChrome
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <button type="button" className="crm-btn text-sm mt-2" disabled={disabled} onClick={addRow}>
        + Add hero slide
      </button>
    </div>
  );
}

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

export function TrustBadgesRowEditor({ jsonString, onJsonChange, disabled }) {
  let rows = [];
  try {
    const p = JSON.parse(jsonString || "[]");
    rows = Array.isArray(p) ? p : [];
  } catch {
    rows = [];
  }
  const [expandedIdx, setExpandedIdx] = useState(null);

  const commit = (next) => {
    onJsonChange(JSON.stringify(next, null, 2));
  };

  const updateRow = (idx, patch) => {
    const next = rows.map((r, i) => (i === idx ? { ...(r && typeof r === "object" ? r : {}), ...patch } : r));
    commit(next);
  };

  const addRow = () => {
    commit([...rows, { icon: "shield", label: "", labelBn: "", description: "" }]);
    setExpandedIdx(rows.length);
  };

  const removeRow = (idx) => {
    commit(rows.filter((_, i) => i !== idx));
    setExpandedIdx((cur) => {
      if (cur == null) return null;
      if (cur === idx) return null;
      if (cur > idx) return cur - 1;
      return cur;
    });
  };

  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[idx], next[j]] = [next[j], next[idx]];
    commit(next);
    setExpandedIdx((cur) => {
      if (cur === idx) return j;
      if (cur === j) return idx;
      return cur;
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-2xs text-crm-text-muted">
        Icons: {TRUST_ICON_OPTIONS.join(", ")}. Empty list → storefront falls back to built-in badges.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-crm-text-dim py-2">No trust badges yet.</p>
      ) : null}
      <ul className="divide-y divide-crm-border rounded-xl border border-crm-border overflow-hidden">
        {rows.map((row, idx) => {
          const open = expandedIdx === idx;
          return (
            <li key={idx} className="bg-crm-bg">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left"
                  onClick={() => setExpandedIdx(open ? null : idx)}
                >
                  <p className="text-sm font-semibold text-crm-text-bright truncate">
                    {row.label || `Badge ${idx + 1}`}
                  </p>
                  <p className="text-2xs text-crm-text-dim truncate">
                    {row.icon || "shield"}{row.description ? ` · ${String(row.description).slice(0, 48)}` : ""}
                  </p>
                </button>
                <button type="button" className="crm-btn text-2xs px-2 py-1" disabled={disabled || idx === 0} onClick={() => move(idx, -1)}>↑</button>
                <button type="button" className="crm-btn text-2xs px-2 py-1" disabled={disabled || idx === rows.length - 1} onClick={() => move(idx, 1)}>↓</button>
                <button type="button" className="crm-btn text-2xs px-2 py-1 text-crm-danger" disabled={disabled} onClick={() => removeRow(idx)}>✕</button>
              </div>
              {open ? (
                <div className={`${rowCardClass(disabled)} mx-2 mb-2`}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="text-xs text-crm-text-dim block">
                      Icon
                      <select
                        className="crm-input w-full mt-1"
                        value={row.icon || "shield"}
                        onChange={(e) => updateRow(idx, { icon: e.target.value })}
                        disabled={disabled}
                      >
                        {TRUST_ICON_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-crm-text-dim block">
                      Label (EN)
                      <input className="crm-input w-full mt-1" value={row.label || ""} onChange={(e) => updateRow(idx, { label: e.target.value })} disabled={disabled} />
                    </label>
                    <label className="text-xs text-crm-text-dim block">
                      Label (BN)
                      <input className="crm-input w-full mt-1" value={row.labelBn || ""} onChange={(e) => updateRow(idx, { labelBn: e.target.value })} disabled={disabled} />
                    </label>
                    <label className="text-xs text-crm-text-dim block">
                      Description
                      <input className="crm-input w-full mt-1" value={row.description || ""} onChange={(e) => updateRow(idx, { description: e.target.value })} disabled={disabled} />
                    </label>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <button type="button" className="crm-btn text-sm mt-1" disabled={disabled} onClick={addRow}>
        + Add trust badge
      </button>
    </div>
  );
}

export function TestimonialsRowEditor({ jsonString, onJsonChange, disabled }) {
  let rows = [];
  try {
    const p = JSON.parse(jsonString || "[]");
    rows = Array.isArray(p) ? p : [];
  } catch {
    rows = [];
  }
  const [expandedIdx, setExpandedIdx] = useState(null);

  const commit = (next) => {
    onJsonChange(JSON.stringify(next, null, 2));
  };

  const updateRow = (idx, patch) => {
    const next = rows.map((r, i) => (i === idx ? { ...(r && typeof r === "object" ? r : {}), ...patch } : r));
    commit(next);
  };

  const addRow = () => {
    commit([...rows, { name: "", title: "", quote: "", rating: 5, verified: true, avatarUrl: "" }]);
    setExpandedIdx(rows.length);
  };

  const removeRow = (idx) => {
    commit(rows.filter((_, i) => i !== idx));
    setExpandedIdx((cur) => {
      if (cur == null) return null;
      if (cur === idx) return null;
      if (cur > idx) return cur - 1;
      return cur;
    });
  };

  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[idx], next[j]] = [next[j], next[idx]];
    commit(next);
    setExpandedIdx((cur) => {
      if (cur === idx) return j;
      if (cur === j) return idx;
      return cur;
    });
  };

  return (
    <div className="space-y-2">
      {rows.length === 0 ? (
        <p className="text-sm text-crm-text-dim py-2">No testimonials yet.</p>
      ) : null}
      <ul className="divide-y divide-crm-border rounded-xl border border-crm-border overflow-hidden">
        {rows.map((row, idx) => {
          const open = expandedIdx === idx;
          return (
            <li key={idx} className="bg-crm-bg">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left"
                  onClick={() => setExpandedIdx(open ? null : idx)}
                >
                  <p className="text-sm font-semibold text-crm-text-bright truncate">{row.name || `Testimonial ${idx + 1}`}</p>
                  <p className="text-2xs text-crm-text-dim truncate">{(row.quote || row.comment || "No quote").slice(0, 72)}</p>
                </button>
                <button type="button" className="crm-btn text-2xs px-2 py-1" disabled={disabled || idx === 0} onClick={() => move(idx, -1)}>↑</button>
                <button type="button" className="crm-btn text-2xs px-2 py-1" disabled={disabled || idx === rows.length - 1} onClick={() => move(idx, 1)}>↓</button>
                <button type="button" className="crm-btn text-2xs px-2 py-1 text-crm-danger" disabled={disabled} onClick={() => removeRow(idx)}>✕</button>
              </div>
              {open ? (
                <div className={`${rowCardClass(disabled)} mx-2 mb-2`}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="text-xs text-crm-text-dim block">
                      Name
                      <input className="crm-input w-full mt-1" value={row.name || ""} onChange={(e) => updateRow(idx, { name: e.target.value })} disabled={disabled} />
                    </label>
                    <label className="text-xs text-crm-text-dim block">
                      Title / role
                      <input className="crm-input w-full mt-1" value={row.title || ""} onChange={(e) => updateRow(idx, { title: e.target.value })} disabled={disabled} />
                    </label>
                  </div>
                  <label className="text-xs text-crm-text-dim block mt-2">
                    Quote
                    <textarea
                      className="crm-input w-full mt-1 min-h-[64px]"
                      value={row.quote || row.comment || ""}
                      onChange={(e) => updateRow(idx, { quote: e.target.value, comment: undefined })}
                      disabled={disabled}
                    />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                    <label className="text-xs text-crm-text-dim block">
                      Rating (1–5)
                      <input
                        type="number"
                        min={1}
                        max={5}
                        className="crm-input w-full mt-1"
                        value={row.rating ?? 5}
                        onChange={(e) => updateRow(idx, { rating: Number(e.target.value) })}
                        disabled={disabled}
                      />
                    </label>
                    <label className="text-xs text-crm-text-dim block self-end">
                      <span className="flex items-center gap-2 mt-5">
                        <input type="checkbox" checked={Boolean(row.verified)} onChange={(e) => updateRow(idx, { verified: e.target.checked })} disabled={disabled} />
                        Verified
                      </span>
                    </label>
                    <label className="text-xs text-crm-text-dim block">
                      Avatar URL
                      <input className="crm-input w-full mt-1" value={row.avatarUrl || ""} onChange={(e) => updateRow(idx, { avatarUrl: e.target.value })} disabled={disabled} />
                    </label>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <button type="button" className="crm-btn text-sm mt-1" disabled={disabled} onClick={addRow}>
        + Add testimonial
      </button>
    </div>
  );
}
