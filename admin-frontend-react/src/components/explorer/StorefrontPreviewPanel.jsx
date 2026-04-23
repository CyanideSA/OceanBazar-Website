import React, { useState, useRef, useCallback } from "react";
import { useCatalogStore } from "../../stores/catalogStore";
import {
  IconClose, IconRefresh, IconExternalLink, IconSpinner, IconPreview,
} from "./ExplorerIcons";

const STOREFRONT_BASE = import.meta.env.VITE_STOREFRONT_URL || "http://localhost:5173";

export default function StorefrontPreviewPanel({ onClose }) {
  const { currentCategoryId, breadcrumb, openProductId } = useCatalogStore();
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const iframeRef = useRef(null);

  const getPreviewUrl = useCallback(() => {
    if (openProductId) return `${STOREFRONT_BASE}/product/${openProductId}`;
    if (currentCategoryId) {
      const slug = breadcrumb[breadcrumb.length - 1]?.slug;
      return slug
        ? `${STOREFRONT_BASE}/category/${slug}`
        : `${STOREFRONT_BASE}/category/${currentCategoryId}`;
    }
    return `${STOREFRONT_BASE}/`;
  }, [currentCategoryId, breadcrumb, openProductId]);

  const previewUrl = getPreviewUrl();

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  const handleOpenExternal = () => window.open(previewUrl, "_blank", "noopener");

  return (
    <div className="storefront-preview-panel">
      {/* Header */}
      <div className="preview-header">
        <span className="preview-title">
          <IconPreview size={13} color="currentColor" />
          Storefront Preview
        </span>
        <div className="preview-toolbar">
          <button className="btn-icon-sm" onClick={handleRefresh} title="Refresh preview">
            <IconRefresh size={12} />
          </button>
          <button className="btn-icon-sm" onClick={handleOpenExternal} title="Open in new tab">
            <IconExternalLink size={12} />
          </button>
          <button className="btn-icon-sm" onClick={onClose} title="Close preview">
            <IconClose size={12} />
          </button>
        </div>
      </div>

      {/* URL bar */}
      <div className="preview-url-bar">
        <input
          className="preview-url-input"
          readOnly
          value={previewUrl}
          title={previewUrl}
        />
      </div>

      {/* iframe */}
      <div className="preview-iframe-wrap">
        {loading && (
          <div className="preview-loading">
            <IconSpinner size={16} color="#484f58" />
            Loading storefront…
          </div>
        )}
        <iframe
          key={`${previewUrl}-${refreshKey}`}
          ref={iframeRef}
          src={previewUrl}
          className="preview-iframe"
          title="Storefront Preview"
          onLoad={() => setLoading(false)}
          onError={() => setLoading(false)}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </div>
  );
}
