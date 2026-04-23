import React, { useRef, useState, useCallback } from "react";
import { useCatalogStore } from "../../stores/catalogStore";
import { adminApi } from "../../lib/api";
import {
  IconHome, IconChevronRight, IconFolder, IconPackage, IconSearch,
  IconGrid, IconList, IconDetails, IconRefresh, IconPlus, IconClose,
  IconSpinner, IconPreview, IconBulkUpload,
} from "./ExplorerIcons";

export default function ExplorerToolbar({ onRefresh, showPreview, onTogglePreview }) {
  const {
    breadcrumb, currentCategoryId, setCurrentCategoryId,
    viewMode, setViewMode,
    searchQuery, setSearchQuery, setSearchResults, clearSearch,
    openModal,
  } = useCatalogStore();

  const [searching, setSearching] = useState(false);
  const searchRef = useRef(null);
  const searchTimer = useRef(null);

  const handleSearch = useCallback((e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (!q.trim()) { clearSearch(); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await adminApi.catalogSearch(q.trim());
        setSearchResults(results);
      } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 280);
  }, [setSearchQuery, clearSearch, setSearchResults]);

  const handleBreadcrumbClick = useCallback((id) => {
    setCurrentCategoryId(id);
    clearSearch();
  }, [setCurrentCategoryId, clearSearch]);

  const clearSearchInput = useCallback(() => {
    setSearchQuery("");
    clearSearch();
    searchRef.current?.focus();
  }, [setSearchQuery, clearSearch]);

  return (
    <div className="explorer-toolbar">
      {/* ─── Breadcrumb ─── */}
      <div className="toolbar-breadcrumb">
        <span
          className={`crumb${currentCategoryId === null ? " crumb-active" : ""}`}
          onClick={() => handleBreadcrumbClick(null)}
          title="All Categories"
        >
          <IconHome size={12} color="currentColor" />
          All
        </span>
        {breadcrumb.map((crumb, i) => (
          <React.Fragment key={crumb.id}>
            <span className="crumb-sep">
              <IconChevronRight size={10} color="#484f58" />
            </span>
            <span
              className={`crumb${i === breadcrumb.length - 1 ? " crumb-active" : ""}`}
              onClick={() => handleBreadcrumbClick(crumb.id)}
              title={crumb.nameEn}
            >
              {i === breadcrumb.length - 1
                ? <IconFolder size={12} color="currentColor" open />
                : <IconFolder size={12} color="currentColor" />}
              {crumb.nameEn}
            </span>
          </React.Fragment>
        ))}
      </div>

      <div className="toolbar-divider" />

      {/* ─── Actions ─── */}
      <div className="toolbar-section">
        <button
          className="toolbar-btn"
          onClick={() => openModal("createCategory", { parentId: currentCategoryId })}
          title="New Folder (Ctrl+Shift+N)"
        >
          <IconFolder size={13} color="#e3b341" />
          <IconPlus size={10} color="currentColor" />
          Folder
        </button>

        {currentCategoryId && (
          <button
            className="toolbar-btn toolbar-btn-primary"
            onClick={() => openModal("createProduct", { categoryId: currentCategoryId })}
            title="New Product (Ctrl+N)"
          >
            <IconPackage size={13} color="currentColor" />
            <IconPlus size={10} color="currentColor" />
            Product
          </button>
        )}

        <button
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => openModal("bulkUpload", {})}
          title="Bulk Upload CSV/JSON"
        >
          <IconBulkUpload size={14} color="currentColor" />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* ─── Search ─── */}
      <div className="toolbar-search">
        <span className="search-icon-wrap">
          <IconSearch size={13} />
        </span>
        <input
          ref={searchRef}
          type="text"
          placeholder="Search catalog… (Ctrl+F)"
          value={searchQuery}
          onChange={handleSearch}
          className="search-input"
        />
        {searching && (
          <span className="search-spinner-wrap">
            <IconSpinner size={13} color="#484f58" />
          </span>
        )}
        {searchQuery && !searching && (
          <button className="search-clear" onClick={clearSearchInput} title="Clear search (Esc)">
            <IconClose size={10} />
          </button>
        )}
      </div>

      <div className="toolbar-divider" />

      {/* ─── Refresh ─── */}
      <button
        className="toolbar-btn toolbar-btn-icon"
        onClick={onRefresh}
        title="Refresh (F5)"
      >
        <IconRefresh size={14} color="currentColor" />
      </button>

      {/* ─── Storefront preview toggle ─── */}
      <button
        className={`toolbar-btn toolbar-btn-icon${showPreview ? " view-btn active" : ""}`}
        onClick={onTogglePreview}
        title="Toggle Storefront Preview"
        style={showPreview ? { background: "#1f6feb", border: "1px solid #388bfd", color: "#fff" } : {}}
      >
        <IconPreview size={14} color="currentColor" />
      </button>

      <div className="toolbar-divider" />

      {/* ─── View toggle ─── */}
      <div className="toolbar-view-toggle">
        <button
          className={`view-btn${viewMode === "grid" ? " active" : ""}`}
          onClick={() => setViewMode("grid")}
          title="Grid view"
        >
          <IconGrid size={14} />
        </button>
        <button
          className={`view-btn${viewMode === "list" ? " active" : ""}`}
          onClick={() => setViewMode("list")}
          title="List view"
        >
          <IconList size={14} />
        </button>
        <button
          className={`view-btn${viewMode === "details" ? " active" : ""}`}
          onClick={() => setViewMode("details")}
          title="Details view"
        >
          <IconDetails size={14} />
        </button>
      </div>
    </div>
  );
}
