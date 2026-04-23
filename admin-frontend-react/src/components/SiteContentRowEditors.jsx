import React from "react";

function rowCardStyle(disabled) {
  return {
    border: "1px solid var(--border, #e2e8f0)",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    background: disabled ? "transparent" : "var(--card-inner, #f8fafc)",
  };
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
        <p className="muted" style={{ fontSize: 13 }}>
          No slides yet. Add a row or paste JSON below.
        </p>
      ) : null}
      {rows.map((row, idx) => (
        <div key={idx} style={rowCardStyle(disabled)}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            <button type="button" className="btn ghost" disabled={disabled || idx === 0} onClick={() => move(idx, -1)}>
              Up
            </button>
            <button type="button" className="btn ghost" disabled={disabled || idx === rows.length - 1} onClick={() => move(idx, 1)}>
              Down
            </button>
            <button type="button" className="btn ghost" disabled={disabled} onClick={() => removeRow(idx)}>
              Remove
            </button>
          </div>
          <label className="muted" style={{ fontSize: 11, display: "block" }}>
            Image URL
            <input
              style={{ width: "100%", marginTop: 4 }}
              value={row.imageUrl || ""}
              onChange={(e) => updateRow(idx, { imageUrl: e.target.value })}
              disabled={disabled}
              placeholder="https://… or /uploads/…"
            />
          </label>
          <label className="muted" style={{ fontSize: 11, display: "block", marginTop: 8 }}>
            Link URL
            <input
              style={{ width: "100%", marginTop: 4 }}
              value={row.linkUrl || ""}
              onChange={(e) => updateRow(idx, { linkUrl: e.target.value })}
              disabled={disabled}
            />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
            <label className="muted" style={{ fontSize: 11, display: "block" }}>
              Title
              <input style={{ width: "100%", marginTop: 4 }} value={row.title || ""} onChange={(e) => updateRow(idx, { title: e.target.value })} disabled={disabled} />
            </label>
            <label className="muted" style={{ fontSize: 11, display: "block" }}>
              Subtitle
              <input style={{ width: "100%", marginTop: 4 }} value={row.subtitle || ""} onChange={(e) => updateRow(idx, { subtitle: e.target.value })} disabled={disabled} />
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
            <label className="muted" style={{ fontSize: 11, display: "block" }}>
              Sort order
              <input
                type="number"
                style={{ width: "100%", marginTop: 4 }}
                value={row.sortOrder ?? idx}
                onChange={(e) => updateRow(idx, { sortOrder: Number(e.target.value) })}
                disabled={disabled}
              />
            </label>
            <label className="muted" style={{ fontSize: 11, display: "block" }}>
              Rotation (ms, optional)
              <input
                type="number"
                min={0}
                step={500}
                style={{ width: "100%", marginTop: 4 }}
                value={row.rotationMs ?? ""}
                onChange={(e) => updateRow(idx, { rotationMs: e.target.value === "" ? "" : Number(e.target.value) })}
                disabled={disabled}
                placeholder="use default"
              />
            </label>
          </div>
        </div>
      ))}
      <button type="button" className="btn ghost" disabled={disabled} onClick={addRow} style={{ marginTop: 4 }}>
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
        <p className="muted" style={{ fontSize: 13 }}>
          No testimonials yet. Add a row or paste JSON below.
        </p>
      ) : null}
      {rows.map((row, idx) => (
        <div key={idx} style={rowCardStyle(disabled)}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            <button type="button" className="btn ghost" disabled={disabled || idx === 0} onClick={() => move(idx, -1)}>
              Up
            </button>
            <button type="button" className="btn ghost" disabled={disabled || idx === rows.length - 1} onClick={() => move(idx, 1)}>
              Down
            </button>
            <button type="button" className="btn ghost" disabled={disabled} onClick={() => removeRow(idx)}>
              Remove
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label className="muted" style={{ fontSize: 11, display: "block" }}>
              Name
              <input style={{ width: "100%", marginTop: 4 }} value={row.name || ""} onChange={(e) => updateRow(idx, { name: e.target.value })} disabled={disabled} />
            </label>
            <label className="muted" style={{ fontSize: 11, display: "block" }}>
              Title / role
              <input style={{ width: "100%", marginTop: 4 }} value={row.title || ""} onChange={(e) => updateRow(idx, { title: e.target.value })} disabled={disabled} />
            </label>
          </div>
          <label className="muted" style={{ fontSize: 11, display: "block", marginTop: 8 }}>
            Quote
            <textarea
              style={{ width: "100%", marginTop: 4, minHeight: 64, fontFamily: "inherit" }}
              value={row.quote || row.comment || ""}
              onChange={(e) => updateRow(idx, { quote: e.target.value, comment: undefined })}
              disabled={disabled}
            />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
            <label className="muted" style={{ fontSize: 11, display: "block" }}>
              Rating (1–5)
              <input
                type="number"
                min={1}
                max={5}
                style={{ width: "100%", marginTop: 4 }}
                value={row.rating ?? 5}
                onChange={(e) => updateRow(idx, { rating: Number(e.target.value) })}
                disabled={disabled}
              />
            </label>
            <label className="muted" style={{ fontSize: 11, display: "block", alignSelf: "end" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 18 }}>
                <input type="checkbox" checked={Boolean(row.verified)} onChange={(e) => updateRow(idx, { verified: e.target.checked })} disabled={disabled} />
                Verified
              </span>
            </label>
            <label className="muted" style={{ fontSize: 11, display: "block" }}>
              Avatar URL
              <input style={{ width: "100%", marginTop: 4 }} value={row.avatarUrl || ""} onChange={(e) => updateRow(idx, { avatarUrl: e.target.value })} disabled={disabled} />
            </label>
          </div>
        </div>
      ))}
      <button type="button" className="btn ghost" disabled={disabled} onClick={addRow} style={{ marginTop: 4 }}>
        + Add testimonial
      </button>
    </div>
  );
}
