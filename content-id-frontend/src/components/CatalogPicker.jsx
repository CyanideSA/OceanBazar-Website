import { useState } from "react";
import { Plus } from "lucide-react";
import AddCatalogModal from "./AddCatalogModal";
import { contentIdApi } from "../lib/api";

export default function CatalogPicker({
  catalog,
  selection,
  onChange,
  onRefreshCatalog,
  onNotice,
}) {
  const [modal, setModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedCategory = catalog.categories?.find((c) => c.id === selection.categoryId);
  const subcategories = selectedCategory?.subcategories || [];

  async function handleCreate(type, payload) {
    setSubmitting(true);
    try {
      let res;
      if (type === "category") {
        res = await contentIdApi.createCategory(payload);
        onChange({ categoryId: res.category.id, subcategoryId: "" });
        onNotice(
          res.created
            ? `Category "${res.category.nameEn}" added to catalog`
            : `Category "${res.category.nameEn}" already exists — selected`,
        );
      } else if (type === "subcategory") {
        res = await contentIdApi.createSubcategory({
            parentId: selection.categoryId,
            ...payload,
          });
        onChange({ subcategoryId: res.subcategory.id });
        onNotice(
          res.created
            ? `Subcategory "${res.subcategory.nameEn}" added to catalog`
            : `Subcategory "${res.subcategory.nameEn}" already exists — selected`,
        );
      } else if (type === "brand") {
        res = await contentIdApi.createBrand(payload);
        onChange({ brandId: res.brand.id });
        onNotice(
          res.created
            ? `Brand "${res.brand.nameEn}" added to catalog`
            : `Brand "${res.brand.nameEn}" already exists — selected`,
        );
      }
      await onRefreshCatalog();
      setModal(null);
    } catch (err) {
      const msg =
        err?.response?.data?.errors?.[0]?.msg ||
        err?.response?.data?.error ||
        "Could not add to catalog";
      onNotice(msg, true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="space-y-4">
        <PickerField label="Category *">
          <div className="flex gap-2">
            <select
              className="ob-input flex-1"
              required
              value={selection.categoryId}
              onChange={(e) =>
                onChange({ categoryId: e.target.value, subcategoryId: "" })
              }
            >
              <option value="">Select category</option>
              {catalog.categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameEn}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="ob-btn ob-btn-secondary shrink-0 px-3"
              onClick={() => setModal("category")}
              title="Add category"
            >
              <Plus size={16} />
            </button>
          </div>
        </PickerField>

        <PickerField label="Subcategory *">
          <div className="flex gap-2">
            <select
              className="ob-input flex-1"
              required
              disabled={!selection.categoryId}
              value={selection.subcategoryId}
              onChange={(e) => onChange({ subcategoryId: e.target.value })}
            >
              <option value="">Select subcategory</option>
              {subcategories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameEn}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="ob-btn ob-btn-secondary shrink-0 px-3"
              disabled={!selection.categoryId}
              onClick={() => setModal("subcategory")}
              title="Add subcategory"
            >
              <Plus size={16} />
            </button>
          </div>
        </PickerField>

        <PickerField label="Brand *">
          <div className="flex gap-2">
            <select
              className="ob-input flex-1"
              required
              value={selection.brandId}
              onChange={(e) => onChange({ brandId: e.target.value })}
            >
              <option value="">Select brand</option>
              {catalog.brands?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nameEn}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="ob-btn ob-btn-secondary shrink-0 px-3"
              onClick={() => setModal("brand")}
              title="Add brand"
            >
              <Plus size={16} />
            </button>
          </div>
        </PickerField>
      </div>

      {modal && (
        <AddCatalogModal
          type={modal}
          parentCategory={selectedCategory}
          submitting={submitting}
          onClose={() => setModal(null)}
          onSubmit={(payload) => handleCreate(modal, payload)}
        />
      )}
    </>
  );
}

function PickerField({ label, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
