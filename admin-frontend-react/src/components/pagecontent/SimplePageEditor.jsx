import React, { useMemo } from "react";

/**
 * Flat key→string editor for message-based pages (support, marketing, wholesale, etc.).
 * Groups keys by common prefix for readability.
 */
export default function SimplePageEditor({ value, onChange, disabled, fieldHints = {} }) {
  const fields = value && typeof value === "object" ? value : {};
  const keys = useMemo(() => Object.keys(fields).sort((a, b) => a.localeCompare(b)), [fields]);

  const setKey = (key, val) => onChange({ ...fields, [key]: val });

  if (!keys.length) {
    return (
      <p className="text-xs text-crm-text-muted py-4">
        No fields loaded. Use &quot;Load current defaults&quot; to seed editable copy for this page.
      </p>
    );
  }

  // Group by first segment
  const groups = {};
  for (const k of keys) {
    const g = k.includes(".") ? k.split(".")[0] : "_general";
    if (!groups[g]) groups[g] = [];
    groups[g].push(k);
  }

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      {Object.entries(groups).map(([group, gKeys]) => (
        <div key={group} className="rounded-xl border border-crm-border overflow-hidden">
          <div className="px-3 py-2 bg-crm-bg-alt border-b border-crm-border text-2xs font-bold uppercase tracking-wide text-crm-text-dim">
            {group === "_general" ? "General" : group}
          </div>
          <div className="p-3 space-y-2.5">
            {gKeys.map((key) => {
              const hint = fieldHints[key];
              const long = String(fields[key] || "").length > 80 || /Sub$|Body$|Desc$|intro|subtitle|message/i.test(key);
              return (
                <div key={key}>
                  <label className="text-2xs font-semibold text-crm-text-dim">
                    {key}
                    {hint ? <span className="text-crm-text-muted font-normal"> — {hint}</span> : null}
                  </label>
                  {long ? (
                    <textarea
                      className="crm-input text-xs mt-0.5 min-h-[56px]"
                      disabled={disabled}
                      value={fields[key] || ""}
                      onChange={(e) => setKey(key, e.target.value)}
                    />
                  ) : (
                    <input
                      className="crm-input text-xs mt-0.5"
                      disabled={disabled}
                      value={fields[key] || ""}
                      onChange={(e) => setKey(key, e.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
