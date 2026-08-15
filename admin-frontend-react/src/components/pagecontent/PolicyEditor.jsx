import React from "react";
import { FiPlus, FiTrash2 } from "react-icons/fi";

const ICONS = [
  "shield", "check", "clock", "alert", "info", "truck",
  "package", "credit", "ban", "file", "scale", "lock",
  "refresh", "star", "list", "user", "mail",
];

const TAGS = ["eligibility", "process", "timeline", "conditions", "info"];

const EMPTY_SECTION = {
  icon: "info",
  tag: "info",
  heading: "",
  body: "",
  highlight: "",
  bullets: [""],
};

export default function PolicyEditor({ value, onChange, disabled }) {
  const doc = value && typeof value === "object"
    ? value
    : { title: "", intro: "", lastUpdated: "", sections: [{ ...EMPTY_SECTION, bullets: [""] }] };

  const sections = Array.isArray(doc.sections) && doc.sections.length
    ? doc.sections
    : [{ ...EMPTY_SECTION, bullets: [""] }];

  const setField = (field, val) => onChange({ ...doc, [field]: val, sections });

  const setSection = (idx, patch) => {
    const next = sections.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange({ ...doc, sections: next });
  };

  const addSection = () => onChange({
    ...doc,
    sections: [...sections, { ...EMPTY_SECTION, bullets: [""] }],
  });

  const removeSection = (idx) => {
    if (sections.length <= 1) return;
    onChange({ ...doc, sections: sections.filter((_, i) => i !== idx) });
  };

  const setBullet = (si, bi, val) => {
    const bullets = [...(sections[si].bullets || [])];
    bullets[bi] = val;
    setSection(si, { bullets });
  };

  const addBullet = (si) => {
    const bullets = [...(sections[si].bullets || []), ""];
    setSection(si, { bullets });
  };

  const removeBullet = (si, bi) => {
    const bullets = (sections[si].bullets || []).filter((_, i) => i !== bi);
    setSection(si, { bullets: bullets.length ? bullets : [""] });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-2xs font-bold uppercase tracking-wide text-crm-text-dim">Title</label>
          <input className="crm-input text-sm mt-1" disabled={disabled} value={doc.title || ""} onChange={(e) => setField("title", e.target.value)} />
        </div>
        <div>
          <label className="text-2xs font-bold uppercase tracking-wide text-crm-text-dim">Last updated</label>
          <input className="crm-input text-sm mt-1" disabled={disabled} value={doc.lastUpdated || ""} onChange={(e) => setField("lastUpdated", e.target.value)} placeholder="e.g. April 2025" />
        </div>
      </div>
      <div>
        <label className="text-2xs font-bold uppercase tracking-wide text-crm-text-dim">Intro</label>
        <textarea className="crm-input text-sm mt-1 min-h-[72px]" disabled={disabled} value={doc.intro || ""} onChange={(e) => setField("intro", e.target.value)} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Sections ({sections.length})</p>
        <button type="button" disabled={disabled} onClick={addSection} className="crm-btn text-xs flex items-center gap-1">
          <FiPlus size={12} /> Add section
        </button>
      </div>

      {sections.map((sec, si) => (
        <div key={si} className="rounded-xl border border-crm-border bg-crm-bg-alt/40 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-crm-text-bright">Section {si + 1}</span>
            <button type="button" disabled={disabled || sections.length <= 1} onClick={() => removeSection(si)} className="text-crm-text-muted hover:text-crm-danger p-1">
              <FiTrash2 size={13} />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <label className="text-2xs text-crm-text-muted">Icon</label>
              <select className="crm-input text-xs mt-0.5" disabled={disabled} value={sec.icon || "info"} onChange={(e) => setSection(si, { icon: e.target.value })}>
                {ICONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
              </select>
            </div>
            <div>
              <label className="text-2xs text-crm-text-muted">Tag</label>
              <select className="crm-input text-xs mt-0.5" disabled={disabled} value={sec.tag || "info"} onChange={(e) => setSection(si, { tag: e.target.value })}>
                {TAGS.map((tg) => <option key={tg} value={tg}>{tg}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-2xs text-crm-text-muted">Heading</label>
              <input className="crm-input text-xs mt-0.5" disabled={disabled} value={sec.heading || ""} onChange={(e) => setSection(si, { heading: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-2xs text-crm-text-muted">Body</label>
            <textarea className="crm-input text-xs mt-0.5 min-h-[56px]" disabled={disabled} value={sec.body || ""} onChange={(e) => setSection(si, { body: e.target.value })} />
          </div>
          <div>
            <label className="text-2xs text-crm-text-muted">Highlight (optional callout)</label>
            <input className="crm-input text-xs mt-0.5" disabled={disabled} value={sec.highlight || ""} onChange={(e) => setSection(si, { highlight: e.target.value })} />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-2xs text-crm-text-muted">Bullets</label>
              <button type="button" disabled={disabled} onClick={() => addBullet(si)} className="text-2xs text-crm-primary flex items-center gap-0.5">
                <FiPlus size={10} /> Add
              </button>
            </div>
            <div className="space-y-1.5 mt-1">
              {(sec.bullets || [""]).map((b, bi) => (
                <div key={bi} className="flex gap-1.5">
                  <input
                    className="crm-input text-xs flex-1"
                    disabled={disabled}
                    value={b}
                    onChange={(e) => setBullet(si, bi, e.target.value)}
                    placeholder={`Bullet ${bi + 1}`}
                  />
                  <button type="button" disabled={disabled} onClick={() => removeBullet(si, bi)} className="text-crm-text-muted hover:text-crm-danger px-1">
                    <FiTrash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
