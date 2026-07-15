import { ChevronDown, ChevronRight, Tag } from "lucide-react";
import { useState } from "react";

export default function CatalogBrowser({ catalog, selection, onSelect }) {
  const [expanded, setExpanded] = useState({});

  function toggleCategory(id) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (!catalog?.categories?.length && !catalog?.brands?.length) {
    return (
      <div className="ob-card p-6">
        <h2 className="text-lg font-bold">Catalog</h2>
        <p className="mt-2 text-sm text-muted-foreground">No categories or brands yet. Add one below.</p>
      </div>
    );
  }

  return (
    <div className="ob-card overflow-hidden">
      <div className="border-b border-border/60 px-4 py-3">
        <h2 className="text-lg font-bold">Catalog browser</h2>
        <p className="text-xs text-muted-foreground">Click to select category &amp; subcategory</p>
      </div>
      <div className="max-h-72 overflow-y-auto p-2">
        {catalog.categories.map((cat) => {
          const isOpen = expanded[cat.id] ?? true;
          const isCatSelected = selection.categoryId === cat.id;
          return (
            <div key={cat.id} className="mb-1">
              <button
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium ${
                  isCatSelected ? "bg-primary/10 text-primary" : "hover:bg-secondary"
                }`}
              >
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {cat.nameEn}
              </button>
              {isOpen && (
                <ul className="ml-5 border-l border-border/60 pl-2">
                  {cat.subcategories?.length ? (
                    cat.subcategories.map((sub) => {
                      const selected =
                        selection.categoryId === cat.id && selection.subcategoryId === sub.id;
                      return (
                        <li key={sub.id}>
                          <button
                            type="button"
                            onClick={() => onSelect({ categoryId: cat.id, subcategoryId: sub.id })}
                            className={`w-full rounded-lg px-2 py-1.5 text-left text-sm ${
                              selected
                                ? "bg-primary/15 font-semibold text-primary"
                                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                            }`}
                          >
                            {sub.nameEn}
                          </button>
                        </li>
                      );
                    })
                  ) : (
                    <li className="px-2 py-1 text-xs text-muted-foreground">No subcategories</li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      <div className="border-t border-border/60 px-4 py-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Tag size={12} />
          Brands
        </div>
        <div className="flex flex-wrap gap-1.5">
          {catalog.brands?.map((brand) => {
            const selected = selection.brandId === brand.id;
            return (
              <button
                key={brand.id}
                type="button"
                onClick={() => onSelect({ brandId: brand.id })}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-white hover:border-primary/40"
                }`}
              >
                {brand.nameEn}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
