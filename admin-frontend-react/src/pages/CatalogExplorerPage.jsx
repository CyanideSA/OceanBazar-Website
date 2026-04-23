import React, { useCallback, useEffect, useRef, useState } from "react";
import { adminApi } from "../lib/api";
import { useCatalogStore } from "../stores/catalogStore";
import FolderTreePanel from "../components/explorer/FolderTreePanel";
import ExplorerToolbar from "../components/explorer/ExplorerToolbar";
import ContentPanel from "../components/explorer/ContentPanel";
import ProductDetailPanel from "../components/explorer/ProductDetailPanel";
import StorefrontPreviewPanel from "../components/explorer/StorefrontPreviewPanel";
import ExplorerContextMenu from "../components/explorer/ExplorerContextMenu";
import {
  CreateCategoryModal,
  RenameCategoryModal,
  DeleteConfirmModal,
  MoveToModal,
  CreateProductModal,
  BulkUploadModal,
  BannerManagerModal,
} from "../components/explorer/ExplorerModals";
import "../components/explorer/explorer.css";

const TREE_MIN_WIDTH = 160;
const TREE_MAX_WIDTH = 400;
const TREE_DEFAULT_WIDTH = 240;

export default function CatalogExplorerPage() {
  const {
    currentCategoryId,
    setCurrentCategoryId,
    setTree,
    setLoadingTree,
    setFolderContents,
    setLoadingContents,
    setBreadcrumb,
    openProductId,
    openProduct,
    closeProduct,
    modal,
    openModal,
    closeModal,
    setExpanded,
    clearSearch,
  } = useCatalogStore();

  const [contextMenu, setContextMenu] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // ─── Resizable tree panel ────────────────────────────────────────────────
  const [treeWidth, setTreeWidth] = useState(TREE_DEFAULT_WIDTH);
  const resizingRef = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);

  const handleResizeMouseDown = useCallback((e) => {
    resizingRef.current = true;
    resizeStartX.current = e.clientX;
    resizeStartW.current = treeWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const handleMove = (ev) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - resizeStartX.current;
      const newW = Math.max(TREE_MIN_WIDTH, Math.min(TREE_MAX_WIDTH, resizeStartW.current + delta));
      setTreeWidth(newW);
    };
    const handleUp = () => {
      resizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  }, [treeWidth]);

  // ─── Load tree ──────────────────────────────────────────────────────────
  const loadTree = useCallback(async () => {
    setLoadingTree(true);
    try {
      const tree = await adminApi.categoryTree();
      setTree(tree);
    } catch { /* ignore */ }
    finally { setLoadingTree(false); }
  }, [setLoadingTree, setTree]);

  // ─── Load folder contents ────────────────────────────────────────────────
  const loadContents = useCallback(async () => {
    setLoadingContents(true);
    try {
      if (currentCategoryId === null) {
        const contents = await adminApi.rootContents();
        setFolderContents(contents);
        setBreadcrumb([]);
      } else {
        const [contents, crumbs] = await Promise.all([
          adminApi.folderContents(currentCategoryId),
          adminApi.categoryBreadcrumb(currentCategoryId),
        ]);
        setFolderContents(contents);
        setBreadcrumb(crumbs);
        crumbs.forEach((c) => setExpanded(c.id, true));
      }
    } catch { /* ignore */ }
    finally { setLoadingContents(false); }
  }, [currentCategoryId, setFolderContents, setBreadcrumb, setLoadingContents, setExpanded]);

  useEffect(() => { loadTree(); }, [loadTree]);
  useEffect(() => { loadContents(); }, [loadContents]);

  // ─── Drag-drop cross-panel ───────────────────────────────────────────────
  useEffect(() => {
    const handleDrop = async (e) => {
      const { type, srcId, targetCategoryId } = e.detail;
      try {
        if (type === "product") await adminApi.moveProduct(srcId, targetCategoryId);
        else await adminApi.moveCategory(srcId, { newParentId: targetCategoryId });
        await Promise.all([loadTree(), loadContents()]);
      } catch { /* ignore */ }
    };
    window.addEventListener("explorer:drop", handleDrop);
    return () => window.removeEventListener("explorer:drop", handleDrop);
  }, [loadTree, loadContents]);

  // ─── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e) => {
      const tag = document.activeElement?.tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (e.key === "F5") { e.preventDefault(); loadTree(); loadContents(); return; }

      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        document.querySelector(".search-input")?.focus();
        return;
      }

      if (inInput) return;

      if (e.key === "F2") {
        const { selectedIds, folderContents } = useCatalogStore.getState();
        const id = [...selectedIds][0];
        if (!id) return;
        if (id.startsWith("cat_")) {
          const node = folderContents?.subfolders?.find((c) => "cat_" + c.id === id);
          if (node) openModal("rename", { type: "category", node });
        }
      }

      if (e.key === "Delete") {
        const { selectedIds, folderContents } = useCatalogStore.getState();
        const id = [...selectedIds][0];
        if (!id) return;
        if (id.startsWith("cat_")) {
          const node = folderContents?.subfolders?.find((c) => "cat_" + c.id === id);
          if (node) openModal("delete", { type: "category", node });
        } else if (id.startsWith("prod_")) {
          const node = folderContents?.products?.find((p) => "prod_" + p.id === id);
          if (node) openModal("delete", { type: "product", node });
        }
      }

      if (e.key === "Escape") {
        setContextMenu(null);
        closeProduct();
        clearSearch();
      }

      if (e.key === "Enter") {
        const { selectedIds, folderContents } = useCatalogStore.getState();
        const id = [...selectedIds][0];
        if (!id) return;
        if (id.startsWith("prod_")) {
          const node = folderContents?.products?.find((p) => "prod_" + p.id === id);
          if (node) openProduct(node.id);
        }
        if (id.startsWith("cat_")) {
          const node = folderContents?.subfolders?.find((c) => "cat_" + c.id === id);
          if (node) { setCurrentCategoryId(node.id); setExpanded(node.id, true); }
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [openModal, closeProduct, clearSearch, loadTree, loadContents, openProduct, setCurrentCategoryId, setExpanded]);

  // ─── Context menu ─────────────────────────────────────────────────────────
  const handleContextMenu = useCallback((e, target) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, target });
  }, []);

  const handleContextAction = useCallback((action, target) => {
    switch (action) {
      case "createCategory":
        openModal("createCategory", { parentId: target?.node?.id || currentCategoryId });
        break;
      case "createProduct":
        openModal("createProduct", { categoryId: target?.node?.id || currentCategoryId });
        break;
      case "rename":
        openModal("rename", target);
        break;
      case "delete":
        openModal("delete", target);
        break;
      case "moveTo":
        openModal("moveTo", target);
        break;
      case "manageBanners":
        openModal("manageBanners", target);
        break;
      case "open":
        if (target?.type === "product") openProduct(target.node.id);
        break;
      default: break;
    }
  }, [openModal, currentCategoryId, openProduct]);

  // ─── Navigation ──────────────────────────────────────────────────────────
  const handleOpenCategory = useCallback((id) => {
    setCurrentCategoryId(id);
    setExpanded(id, true);
    closeProduct();
    clearSearch();
  }, [setCurrentCategoryId, setExpanded, closeProduct, clearSearch]);

  const handleOpenProduct = useCallback((id) => {
    openProduct(id);
  }, [openProduct]);

  const handleRefresh = useCallback(() => {
    loadTree();
    loadContents();
  }, [loadTree, loadContents]);

  const handleModalSuccess = useCallback(() => {
    loadTree();
    loadContents();
  }, [loadTree, loadContents]);

  return (
    <div className="catalog-explorer" style={{ height: "calc(100vh - 70px)" }}>
      <ExplorerToolbar
        onRefresh={handleRefresh}
        showPreview={showPreview}
        onTogglePreview={() => setShowPreview((v) => !v)}
      />

      <div className="explorer-body">
        {/* ── Resizable tree panel ── */}
        <FolderTreePanel
          onContextMenu={handleContextMenu}
          style={{ width: treeWidth, minWidth: treeWidth, maxWidth: treeWidth }}
        />

        {/* ── Resize handle ── */}
        <div
          className="resize-handle"
          onMouseDown={handleResizeMouseDown}
          title="Drag to resize"
        />

        {/* ── Content area ── */}
        <ContentPanel
          onOpenCategory={handleOpenCategory}
          onOpenProduct={handleOpenProduct}
          onContextMenu={handleContextMenu}
        />

        {/* ── Product detail panel ── */}
        {openProductId && (
          <ProductDetailPanel
            onClose={closeProduct}
            onProductUpdated={handleRefresh}
          />
        )}

        {/* ── Storefront preview panel ── */}
        {showPreview && (
          <StorefrontPreviewPanel onClose={() => setShowPreview(false)} />
        )}
      </div>

      {/* ── Context menu ── */}
      {contextMenu && (
        <ExplorerContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          target={contextMenu.target}
          onClose={() => setContextMenu(null)}
          onAction={handleContextAction}
        />
      )}

      {/* ── Modals ── */}
      {modal?.type === "createCategory" && (
        <CreateCategoryModal data={modal.data} onClose={closeModal} onSuccess={handleModalSuccess} />
      )}
      {modal?.type === "createProduct" && (
        <CreateProductModal data={modal.data} onClose={closeModal} onSuccess={handleModalSuccess} />
      )}
      {modal?.type === "rename" && (
        <RenameCategoryModal data={modal.data} onClose={closeModal} onSuccess={handleModalSuccess} />
      )}
      {modal?.type === "delete" && (
        <DeleteConfirmModal data={modal.data} onClose={closeModal} onSuccess={handleModalSuccess} />
      )}
      {modal?.type === "moveTo" && (
        <MoveToModal data={modal.data} onClose={closeModal} onSuccess={handleModalSuccess} />
      )}
      {modal?.type === "bulkUpload" && (
        <BulkUploadModal onClose={closeModal} onSuccess={handleModalSuccess} />
      )}
      {modal?.type === "manageBanners" && (
        <BannerManagerModal data={modal.data} onClose={closeModal} onSuccess={handleModalSuccess} />
      )}
    </div>
  );
}
