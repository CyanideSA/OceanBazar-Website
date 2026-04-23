import React, { useEffect, useRef, useCallback } from "react";
import {
  IconFolder, IconPackage, IconEdit, IconTrash, IconMove,
  IconPlus, IconCopy, IconBanner
} from "./ExplorerIcons";

function CtxItem({ icon, label, shortcut, danger, onClick }) {
  return (
    <button className={`context-item${danger ? " danger" : ""}`} onClick={onClick}>
      <span className="ctx-icon">{icon}</span>
      <span>{label}</span>
      {shortcut && <span className="ctx-shortcut"><kbd className="kbd">{shortcut}</kbd></span>}
    </button>
  );
}

export default function ExplorerContextMenu({ x, y, target, onClose, onAction }) {
  const menuRef = useRef(null);

  // Clamp position so menu never overflows viewport
  const clampedX = Math.min(x, window.innerWidth - 210);
  const clampedY = Math.min(y, window.innerHeight - 250);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const act = useCallback((action) => {
    onAction(action, target);
    onClose();
  }, [onAction, target, onClose]);

  const isRoot = !target;
  const isCategory = target?.type === "category";
  const isProduct = target?.type === "product";

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ position: "fixed", left: clampedX, top: clampedY, zIndex: 9999 }}
    >
      {/* New items */}
      {(isRoot || isCategory) && (
        <>
          <div className="context-section-label">New</div>
          <CtxItem
            icon={<IconFolder size={13} color="#e3b341" />}
            label="New Folder"
            shortcut="Ctrl+Shift+N"
            onClick={() => act("createCategory")}
          />
          {isCategory && (
            <CtxItem
              icon={<IconPackage size={13} color="#79c0ff" />}
              label="New Product"
              shortcut="Ctrl+N"
              onClick={() => act("createProduct")}
            />
          )}
          <div className="context-sep" />
        </>
      )}

      {/* Category actions */}
      {isCategory && (
        <>
          <CtxItem
            icon={<IconEdit size={13} />}
            label="Rename"
            shortcut="F2"
            onClick={() => act("rename")}
          />
          <CtxItem
            icon={<IconMove size={13} />}
            label="Move To…"
            onClick={() => act("moveTo")}
          />
          <CtxItem
            icon={<IconBanner size={13} />}
            label="Manage Banners"
            onClick={() => act("manageBanners")}
          />
          <div className="context-sep" />
          <CtxItem
            icon={<IconTrash size={13} />}
            label="Delete Folder"
            shortcut="Del"
            danger
            onClick={() => act("delete")}
          />
        </>
      )}

      {/* Product actions */}
      {isProduct && (
        <>
          <CtxItem
            icon={<IconEdit size={13} />}
            label="Open / Edit"
            shortcut="Enter"
            onClick={() => act("open")}
          />
          <CtxItem
            icon={<IconMove size={13} />}
            label="Move To…"
            onClick={() => act("moveTo")}
          />
          <CtxItem
            icon={<IconBanner size={13} />}
            label="Manage Banners"
            onClick={() => act("manageBanners")}
          />
          <CtxItem
            icon={<IconCopy size={13} />}
            label="Duplicate"
            onClick={() => act("duplicate")}
          />
          <div className="context-sep" />
          <CtxItem
            icon={<IconTrash size={13} />}
            label="Delete Product"
            shortcut="Del"
            danger
            onClick={() => act("delete")}
          />
        </>
      )}
    </div>
  );
}
