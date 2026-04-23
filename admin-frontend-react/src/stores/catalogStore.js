import { create } from "zustand";

export const useCatalogStore = create((set, get) => ({
  // Navigation
  currentCategoryId: null,   // null = root
  breadcrumb: [],
  expandedIds: new Set(),

  // Selection
  selectedIds: new Set(),
  lastSelectedId: null,

  // Data
  tree: [],
  folderContents: null,
  loadingTree: false,
  loadingContents: false,

  // Detail panel
  openProductId: null,
  productDetail: null,
  loadingDetail: false,

  // Search
  searchQuery: "",
  searchResults: null,

  // View
  viewMode: "grid", // grid | list | details

  // Clipboard
  clipboard: null, // { action: "cut"|"copy", items: [...] }

  // Modals
  modal: null, // { type: "createCategory"|"createProduct"|"rename"|"delete"|"move", data: {} }

  // Actions
  setTree: (tree) => set({ tree }),
  setLoadingTree: (v) => set({ loadingTree: v }),

  setCurrentCategoryId: (id) => set({ currentCategoryId: id, selectedIds: new Set(), openProductId: null }),
  setBreadcrumb: (crumbs) => set({ breadcrumb: crumbs }),
  setFolderContents: (contents) => set({ folderContents: contents }),
  setLoadingContents: (v) => set({ loadingContents: v }),

  toggleExpanded: (id) => {
    const expanded = new Set(get().expandedIds);
    if (expanded.has(id)) expanded.delete(id);
    else expanded.add(id);
    set({ expandedIds: expanded });
  },
  setExpanded: (id, value) => {
    const expanded = new Set(get().expandedIds);
    if (value) expanded.add(id);
    else expanded.delete(id);
    set({ expandedIds: expanded });
  },
  expandToPath: (categoryIds) => {
    const expanded = new Set(get().expandedIds);
    categoryIds.forEach((id) => expanded.add(id));
    set({ expandedIds: expanded });
  },

  selectItem: (id, multi = false) => {
    if (multi) {
      const sel = new Set(get().selectedIds);
      if (sel.has(id)) sel.delete(id);
      else sel.add(id);
      set({ selectedIds: sel, lastSelectedId: id });
    } else {
      set({ selectedIds: new Set([id]), lastSelectedId: id });
    }
  },
  clearSelection: () => set({ selectedIds: new Set(), lastSelectedId: null }),

  openProduct: (id) => set({ openProductId: id, productDetail: null }),
  setProductDetail: (detail) => set({ productDetail: detail }),
  setLoadingDetail: (v) => set({ loadingDetail: v }),
  closeProduct: () => set({ openProductId: null, productDetail: null }),

  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchResults: (r) => set({ searchResults: r }),
  clearSearch: () => set({ searchQuery: "", searchResults: null }),

  setViewMode: (mode) => set({ viewMode: mode }),

  setClipboard: (clip) => set({ clipboard: clip }),
  clearClipboard: () => set({ clipboard: null }),

  openModal: (type, data = {}) => set({ modal: { type, data } }),
  closeModal: () => set({ modal: null }),
}));
