import React, { useCallback, useEffect, memo } from "react";
import { useCatalogStore } from "../../stores/catalogStore";
import { adminApi } from "../../lib/api";
import {
  IconFolder, IconHome, IconChevronRight, IconChevronDown, IconSpinner, IconPackage,
} from "./ExplorerIcons";

const BrandRow = memo(function BrandRow({ brand, categoryId, level }) {
  const { selectedBrandId, selectedBrandCategoryId, selectBrand } = useCatalogStore();
  const isActive = selectedBrandId === brand.id && selectedBrandCategoryId === categoryId;
  return (
    <div
      className={`tree-node${isActive ? " active" : ""}`}
      style={{ paddingLeft: `${6 + (level + 1) * 14}px`, cursor: "pointer" }}
      title={brand.nameEn}
      onClick={(e) => { e.stopPropagation(); selectBrand(brand.id, categoryId); }}
    >
      <span className="tree-node-arrow-placeholder" />
      <span className="tree-node-icon">
        {brand.logoUrl
          ? <img src={brand.logoUrl} alt="" style={{ width: 14, height: 14, borderRadius: 2, objectFit: "contain" }} />
          : <span style={{ fontSize: 10, color: "#8b949e" }}>🏷</span>}
      </span>
      <span className="tree-node-label" style={{ color: isActive ? "#58a6ff" : "#8b949e", fontSize: 12 }}>
        {brand.nameEn}
      </span>
      {brand.productCount > 0 && (
        <span className="tree-node-badge">{brand.productCount}</span>
      )}
    </div>
  );
});

// Memoized tree node to avoid re-rendering the whole tree on selection change
const TreeNode = memo(function TreeNode({ node, onNavigate, onContextMenu, level = 0 }) {
  const {
    expandedIds, currentCategoryId, toggleExpanded,
    categoryBrands, loadingBrands, setCategoryBrands, setLoadingBrands,
  } = useCatalogStore();
  const isExpanded = expandedIds.has(node.id);
  const isActive = currentCategoryId === node.id;
  const hasChildren = node.children && node.children.length > 0;

  // Load brands when a leaf category is expanded
  useEffect(() => {
    if (isExpanded && node.isLeaf && !(node.id in categoryBrands) && !loadingBrands.has(node.id)) {
      setLoadingBrands(node.id, true);
      adminApi.brandsInCategory(node.id)
        .then((brands) => setCategoryBrands(node.id, brands ?? []))
        .catch(() => setCategoryBrands(node.id, []));
    }
  }, [isExpanded, node.isLeaf, node.id, categoryBrands, loadingBrands, setCategoryBrands, setLoadingBrands]);

  const brands = (node.isLeaf && isExpanded) ? (categoryBrands[node.id] ?? null) : null;
  const loadingNodeBrands = loadingBrands.has(node.id);

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    onNavigate(node.id);
  }, [node.id, onNavigate]);

  const handleArrow = useCallback((e) => {
    e.stopPropagation();
    toggleExpanded(node.id);
  }, [node.id, toggleExpanded]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.currentTarget.classList.add("drag-over");
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.currentTarget.classList.remove("drag-over");
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");
    const type = e.dataTransfer.getData("type");
    const srcId = e.dataTransfer.getData(type === "product" ? "productId" : "categoryId");
    if (srcId && srcId !== node.id) {
      window.dispatchEvent(new CustomEvent("explorer:drop", {
        detail: { type, srcId, targetCategoryId: node.id },
      }));
    }
  }, [node.id]);

  const folderColor = isActive ? "#58a6ff" : isExpanded ? "#f0a500" : "#e3b341";
  const canExpand = hasChildren || node.isLeaf;

  return (
    <div className="tree-node-wrap">
      <div
        className={`tree-node${isActive ? " active" : ""}`}
        style={{ paddingLeft: `${6 + level * 14}px` }}
        onClick={handleClick}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, node); }}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("categoryId", node.id);
          e.dataTransfer.setData("type", "category");
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        title={node.nameEn}
      >
        {canExpand ? (
          <button
            className="tree-node-arrow-btn"
            onClick={handleArrow}
            tabIndex={-1}
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded
              ? <IconChevronDown size={11} color="#8b949e" />
              : <IconChevronRight size={11} color="#8b949e" />}
          </button>
        ) : (
          <span className="tree-node-arrow-placeholder" />
        )}

        <span className="tree-node-icon">
          {node.isLeaf
            ? <IconPackage size={14} color={isActive ? "#58a6ff" : "#8b949e"} />
            : <IconFolder size={14} color={folderColor} open={isExpanded} />}
        </span>

        <span className="tree-node-label">{node.nameEn}</span>

        {node.productCount > 0 && (
          <span className="tree-node-badge">{node.productCount}</span>
        )}
      </div>

      {isExpanded && (
        <div className="tree-children">
          {/* Sub-category children */}
          {hasChildren && node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              onNavigate={onNavigate}
              onContextMenu={onContextMenu}
              level={level + 1}
            />
          ))}
          {/* Brand nodes under leaf categories */}
          {node.isLeaf && (
            loadingNodeBrands
              ? <div className="tree-node" style={{ paddingLeft: `${6 + (level + 1) * 14}px`, color: "#484f58", fontSize: 11 }}>
                  <IconSpinner size={11} color="#484f58" /> Loading brands…
                </div>
              : brands && brands.length > 0
                ? brands.map((b) => (
                    <BrandRow key={b.id} brand={b} categoryId={node.id} level={level} />
                  ))
                : null
          )}
        </div>
      )}
    </div>
  );
});

export default function FolderTreePanel({ onContextMenu, style }) {
  const { tree, loadingTree, currentCategoryId, setCurrentCategoryId, setExpanded } = useCatalogStore();

  const handleNavigate = useCallback((id) => {
    setCurrentCategoryId(id);
    setExpanded(id, true);
  }, [setCurrentCategoryId, setExpanded]);

  return (
    <div className="folder-tree-panel custom-scrollbar" style={style}>
      <div className="tree-panel-header">
        <span className="tree-panel-title">Explorer</span>
      </div>

      <div className="tree-scroll">
        {/* Root "All Categories" */}
        <div
          className={`tree-root-item${currentCategoryId === null ? " active" : ""}`}
          onClick={() => setCurrentCategoryId(null)}
          onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, null); }}
        >
          <IconHome size={14} color={currentCategoryId === null ? "#58a6ff" : "#8b949e"} />
          <span className="tree-root-item-label">All Categories</span>
        </div>

        {loadingTree ? (
          <div className="tree-loading">
            <IconSpinner size={14} color="#484f58" />
            Loading tree…
          </div>
        ) : (
          tree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              onNavigate={handleNavigate}
              onContextMenu={onContextMenu}
            />
          ))
        )}
      </div>
    </div>
  );
}
