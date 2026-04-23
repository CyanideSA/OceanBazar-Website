import React, { useCallback } from "react";
import { useCatalogStore } from "../../stores/catalogStore";
import {
  IconFolder, IconPackage, IconSpinner, IconEdit, IconSearch,
  IconStar,
} from "./ExplorerIcons";

const STATUS_COLOR = { active: "#56d364", draft: "#e3b341", archived: "#8b949e" };

function FolderCard({ node, onOpen, onContextMenu }) {
  const { selectedIds, selectItem } = useCatalogStore();
  const isSelected = selectedIds.has("cat_" + node.id);

  return (
    <div
      className={`explorer-item folder-card${isSelected ? " selected" : ""}`}
      onClick={(e) => { e.stopPropagation(); selectItem("cat_" + node.id, e.ctrlKey || e.metaKey); }}
      onDoubleClick={() => onOpen(node.id)}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, { type: "category", node }); }}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("categoryId", node.id); e.dataTransfer.setData("type", "category"); }}
      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("drag-over"); }}
      onDragLeave={(e) => { e.currentTarget.classList.remove("drag-over"); }}
      onDrop={(e) => {
        e.preventDefault();
        e.currentTarget.classList.remove("drag-over");
        const type = e.dataTransfer.getData("type");
        const srcId = e.dataTransfer.getData(type === "product" ? "productId" : "categoryId");
        if (srcId && srcId !== node.id) {
          window.dispatchEvent(new CustomEvent("explorer:drop", { detail: { type, srcId, targetCategoryId: node.id } }));
        }
      }}
      title={`${node.nameEn} — double-click to open`}
    >
      <div className="item-icon-wrap">
        <IconFolder size={36} color="#e3b341" open={false} />
      </div>
      <div className="item-name" title={node.nameEn}>{node.nameEn}</div>
      <div className="item-meta">
        {node.childCount > 0 && <span>{node.childCount} folders</span>}
        {node.productCount > 0 && <span>{node.productCount} items</span>}
        {!node.childCount && !node.productCount && <span>Empty</span>}
      </div>
    </div>
  );
}

function ProductCard({ product, onOpen, onContextMenu, viewMode }) {
  const { selectedIds, selectItem } = useCatalogStore();
  const isSelected = selectedIds.has("prod_" + product.id);
  const statusColor = STATUS_COLOR[product.status] || "#8b949e";

  const dragHandlers = {
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.setData("productId", product.id);
      e.dataTransfer.setData("type", "product");
    },
  };

  const selectHandlers = {
    onClick: (e) => { e.stopPropagation(); selectItem("prod_" + product.id, e.ctrlKey || e.metaKey); },
    onDoubleClick: () => onOpen(product.id),
    onContextMenu: (e) => { e.preventDefault(); onContextMenu(e, { type: "product", node: product }); },
  };

  if (viewMode === "details") {
    return (
      <div
        className={`explorer-item product-row${isSelected ? " selected" : ""}`}
        {...selectHandlers}
        {...dragHandlers}
      >
        <div className="row-thumb">
          {product.primaryImage
            ? <img src={product.primaryImage} alt={product.titleEn} />
            : <IconPackage size={14} color="#484f58" />}
        </div>
        <div className="row-name">{product.titleEn}</div>
        <div className="row-sku">{product.sku || "—"}</div>
        <div className="row-status">
          <span className="status-dot" style={{ background: statusColor }} />
          {product.status}
        </div>
        <div className="row-stock">{product.stock ?? "—"}</div>
        <div className="row-price">{product.retailPrice != null ? `৳${product.retailPrice}` : "—"}</div>
        <div className="row-actions">
          <button
            className="row-action-btn"
            onClick={(e) => { e.stopPropagation(); onOpen(product.id); }}
            title="Open"
          >
            <IconEdit size={12} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`explorer-item product-card${isSelected ? " selected" : ""}`}
      {...selectHandlers}
      {...dragHandlers}
      title={`${product.titleEn} — double-click to edit`}
    >
      <div className="item-thumb">
        {product.primaryImage
          ? <img src={product.primaryImage} alt={product.titleEn} />
          : <div className="item-thumb-placeholder"><IconPackage size={28} color="#484f58" /></div>}
        <span
          className="item-status-badge"
          style={{ background: statusColor === "#56d364" ? "#1a3a1a" : statusColor === "#e3b341" ? "#2d2010" : "#21262d", color: statusColor }}
        >
          {product.status}
        </span>
        {product.isFeatured && (
          <span className="item-featured-badge">
            <IconStar size={12} color="#f0a500" filled />
          </span>
        )}
      </div>
      <div className="item-name" title={product.titleEn}>{product.titleEn}</div>
      <div className="item-meta">
        {product.retailPrice != null && <span style={{ color: "#56d364", fontWeight: 600 }}>৳{product.retailPrice}</span>}
        <span>#{product.stock ?? 0}</span>
      </div>
    </div>
  );
}

function GroupLabel({ label, count }) {
  return (
    <div className="content-group-label">
      {label}
      {count != null && <span className="group-count">{count}</span>}
    </div>
  );
}

function DetailsHeader() {
  return (
    <div className="content-details-header">
      <span />
      <span>Name</span>
      <span>SKU</span>
      <span>Status</span>
      <span>Stock</span>
      <span>Price</span>
      <span />
    </div>
  );
}

export default function ContentPanel({ onOpenCategory, onOpenProduct, onContextMenu }) {
  const { folderContents, loadingContents, viewMode, searchResults, clearSelection } = useCatalogStore();

  const handleBgClick = useCallback(() => clearSelection(), [clearSelection]);

  if (loadingContents) {
    return (
      <div className="content-panel custom-scrollbar" onClick={handleBgClick}>
        <div className="content-loading">
          <IconSpinner size={16} color="#484f58" />
          Loading…
        </div>
      </div>
    );
  }

  if (searchResults) {
    const { categories = [], products = [] } = searchResults;
    const hasResults = categories.length > 0 || products.length > 0;
    return (
      <div className="content-panel custom-scrollbar" onClick={handleBgClick}>
        <div className="content-inner">
          <div className="content-section-title">
            <IconSearch size={14} color="#8b949e" />
            Search Results
          </div>
          {!hasResults && (
            <div className="empty-state">
              <div className="empty-state-icon"><IconSearch size={40} color="#484f58" /></div>
              <div className="empty-state-title">No results found</div>
              <div className="empty-state-desc">Try a different search term</div>
            </div>
          )}
          {categories.length > 0 && (
            <>
              <GroupLabel label="Folders" count={categories.length} />
              <div className="content-grid">
                {categories.map((cat) => (
                  <FolderCard key={cat.id} node={cat} onOpen={onOpenCategory} onContextMenu={onContextMenu} />
                ))}
              </div>
            </>
          )}
          {products.length > 0 && (
            <>
              <GroupLabel label="Products" count={products.length} />
              {viewMode === "details" && <DetailsHeader />}
              <div className={viewMode === "details" ? "content-list" : "content-grid"}>
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} onOpen={onOpenProduct} onContextMenu={onContextMenu} viewMode={viewMode} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!folderContents) {
    return (
      <div className="content-panel custom-scrollbar content-empty-panel" onClick={handleBgClick}>
        <div className="empty-state">
          <div className="empty-state-icon"><IconFolder size={48} color="#484f58" /></div>
          <div className="empty-state-title">Select a folder</div>
          <div className="empty-state-desc">Choose a category from the left panel to explore its contents</div>
        </div>
      </div>
    );
  }

  const { subfolders = [], products = [] } = folderContents;

  return (
    <div className="content-panel custom-scrollbar" onClick={handleBgClick}>
      <div className="content-inner">
        {subfolders.length === 0 && products.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon"><IconFolder size={44} color="#484f58" open /></div>
            <div className="empty-state-title">This folder is empty</div>
            <div className="empty-state-desc">Right-click or use the toolbar to add sub-folders or products</div>
          </div>
        )}

        {subfolders.length > 0 && (
          <>
            {products.length > 0 && <GroupLabel label="Subfolders" count={subfolders.length} />}
            <div className="content-grid">
              {subfolders.map((node) => (
                <FolderCard key={node.id} node={node} onOpen={onOpenCategory} onContextMenu={onContextMenu} />
              ))}
            </div>
          </>
        )}

        {products.length > 0 && (
          <>
            {subfolders.length > 0 && <GroupLabel label="Products" count={products.length} />}
            {viewMode === "details" && <DetailsHeader />}
            <div className={viewMode === "details" ? "content-list" : "content-grid"}>
              {products.map((p) => (
                <ProductCard key={p.id} product={p} onOpen={onOpenProduct} onContextMenu={onContextMenu} viewMode={viewMode} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
