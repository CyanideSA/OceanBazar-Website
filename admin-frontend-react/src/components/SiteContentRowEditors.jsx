import React from "react";

function rowCardClass(disabled) {
  return `rounded-lg border border-crm-border p-3 mb-3 ${disabled ? "opacity-60" : "bg-crm-bg"}`;
}

export function HeroSlidesRowEditor({ jsonString, onJsonChange, disabled }) {
  let rows = [];
  try {
    const p = JSON.parse(jsonString || "[]");
    rows = Array.isArray(p) ? p : [];
  } catch {
    rows = [];
  }

  const commit = (next) => {
    onJsonChange(JSON.stringify(next, null, 2));
  };

  const updateRow = (idx, patch) => {
    const next = rows.map((r, i) => (i === idx ? { ...(r && typeof r === "object" ? r : {}), ...patch } : r));
    commit(next);
  };

  const addRow = () => {
    commit([...rows, { imageUrl: "", linkUrl: "", title: "", subtitle: "", sortOrder: rows.length, rotationMs: "" }]);
  };

  const removeRow = (idx) => {
    commit(rows.filter((_, i) => i !== idx));
  };

  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[idx], next[j]] = [next[j], next[idx]];
    commit(next);
  };

  return (
    <div>
      {rows.length === 0 ? (
        <p className="text-sm text-crm-text-dim">
          No slides yet. Add a row or paste JSON below.
        </p>
      ) : null}
      {rows.map((row, idx) => (
        <div key={idx} className={rowCardClass(disabled)}>
          <div className="flex flex-wrap gap-2 mb-2">
            <button type="button" className="crm-btn text-xs" disabled={disabled || idx === 0} onClick={() => move(idx, -1)}>
              Up
            </button>
            <button type="button" className="crm-btn text-xs" disabled={disabled || idx === rows.length - 1} onClick={() => move(idx, 1)}>
              Down
            </button>
            <button type="button" className="crm-btn text-xs text-crm-danger" disabled={disabled} onClick={() => removeRow(idx)}>
              Remove
            </button>
          </div>
          <label className="text-xs text-crm-text-dim block">
            Image URL
            <input
              className="crm-input w-full mt-1"
              value={row.imageUrl || ""}
              onChange={(e) => updateRow(idx, { imageUrl: e.target.value })}
              disabled={disabled}
              placeholder="https://… or /uploads/…"
            />
          </label>
          <label className="text-xs text-crm-text-dim block mt-2">
            Link URL
            <input
              className="crm-input w-full mt-1"
              value={row.linkUrl || ""}
              onChange={(e) => updateRow(idx, { linkUrl: e.target.value })}
              disabled={disabled}
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            <label className="text-xs text-crm-text-dim block">
              Title
              <input className="crm-input w-full mt-1" value={row.title || ""} onChange={(e) => updateRow(idx, { title: e.target.value })} disabled={disabled} />
            </label>
            <label className="text-xs text-crm-text-dim block">
              Subtitle
              <input className="crm-input w-full mt-1" value={row.subtitle || ""} onChange={(e) => updateRow(idx, { subtitle: e.target.value })} disabled={disabled} />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            <label className="text-xs text-crm-text-dim block">
              Sort order
              <input
                type="number"
                className="crm-input w-full mt-1"
                value={row.sortOrder ?? idx}
                onChange={(e) => updateRow(idx, { sortOrder: Number(e.target.value) })}
                disabled={disabled}
              />
            </label>
            <label className="text-xs text-crm-text-dim block">
              Rotation (ms, optional)
              <input
                type="number"
                min={0}
                step={500}
                className="crm-input w-full mt-1"
                value={row.rotationMs ?? ""}
                onChange={(e) => updateRow(idx, { rotationMs: e.target.value === "" ? "" : Number(e.target.value) })}
                disabled={disabled}
                placeholder="use default"
              />
            </label>
          </div>
        </div>
      ))}
      <button type="button" className="crm-btn text-sm mt-1" disabled={disabled} onClick={addRow}>
        + Add hero slide
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

  const commit = (next) => {
    onJsonChange(JSON.stringify(next, null, 2));
  };

  const updateRow = (idx, patch) => {
    const next = rows.map((r, i) => (i === idx ? { ...(r && typeof r === "object" ? r : {}), ...patch } : r));
    commit(next);
  };

  const addRow = () => {
    commit([...rows, { name: "", title: "", quote: "", rating: 5, verified: true, avatarUrl: "" }]);
  };

  const removeRow = (idx) => {
    commit(rows.filter((_, i) => i !== idx));
  };

  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[idx], next[j]] = [next[j], next[idx]];
    commit(next);
  };

  return (
    <div>
      {rows.length === 0 ? (
        <p className="text-sm text-crm-text-dim">
          No testimonials yet. Add a row or paste JSON below.
        </p>
      ) : null}
      {rows.map((row, idx) => (
        <div key={idx} className={rowCardClass(disabled)}>
          <div className="flex flex-wrap gap-2 mb-2">
            <button type="button" className="crm-btn text-xs" disabled={disabled || idx === 0} onClick={() => move(idx, -1)}>
              Up
            </button>
            <button type="button" className="crm-btn text-xs" disabled={disabled || idx === rows.length - 1} onClick={() => move(idx, 1)}>
              Down
            </button>
            <button type="button" className="crm-btn text-xs text-crm-danger" disabled={disabled} onClick={() => removeRow(idx)}>
              Remove
            </button>
          </div>
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
      ))}
      <button type="button" className="crm-btn text-sm mt-1" disabled={disabled} onClick={addRow}>
        + Add testimonial
      </button>
    </div>
  );
}
