import { useState } from "react";
import { X } from "lucide-react";

const TITLES = {
  category: "Add category",
  subcategory: "Add subcategory",
  brand: "Add brand",
};

export default function AddCatalogModal({ type, parentCategory, onClose, onSubmit, submitting }) {
  const [nameEn, setNameEn] = useState("");
  const [nameBn, setNameBn] = useState("");

  async function handleSubmit(e) {
    e?.preventDefault?.();
    if (!nameEn.trim()) return;
    await onSubmit({ nameEn: nameEn.trim(), nameBn: nameBn.trim() || undefined });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="ob-card relative w-full max-w-md p-6 shadow-soft-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{TITLES[type]}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-secondary">
            <X size={18} />
          </button>
        </div>

        {type === "subcategory" && parentCategory && (
          <p className="mb-4 text-sm text-muted-foreground">
            Under category: <span className="font-semibold text-foreground">{parentCategory.nameEn}</span>
          </p>
        )}

        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Name (English) *
            </span>
            <input
              className="ob-input"
              required
              autoFocus
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="e.g. Electronics"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Name (Bengali, optional)
            </span>
            <input
              className="ob-input"
              value={nameBn}
              onChange={(e) => setNameBn(e.target.value)}
              placeholder="বাংলায় নাম"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="ob-btn ob-btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || !nameEn.trim()}
              onClick={handleSubmit}
              className="ob-btn ob-btn-primary"
            >
              {submitting ? "Saving…" : "Add to catalog"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
