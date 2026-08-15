import React, { useEffect, useRef, useCallback, useState } from "react";
import EmailEditor from "react-email-editor";
import { adminApi } from "../../lib/api";
import { useToast } from "../ToastProvider";

/**
 * Visual drag-and-drop email builder (Unlayer / react-email-editor).
 * Loads/saves design JSON + exports HTML. Image upload via adminApi.uploadMedia.
 */
export default function EmailBuilder({
  designJson = null,
  htmlFallback = "",
  onChange,
  minHeight = 520,
  className = "",
}) {
  const editorRef = useRef(null);
  const toast = useToast();
  const [ready, setReady] = useState(false);
  const designLoadedRef = useRef(false);

  const exportAndNotify = useCallback(() => {
    const editor = editorRef.current?.editor;
    if (!editor) return;
    editor.exportHtml((data) => {
      onChange?.({
        html: data.html || "",
        design: data.design || null,
      });
    });
  }, [onChange]);

  const onReady = useCallback(() => {
    setReady(true);
    const editor = editorRef.current?.editor;
    if (!editor) return;

    editor.registerCallback("image", async (file, done) => {
      try {
        const uploaded = await adminApi.uploadMedia(file.attachments?.[0] || file, "email/templates");
        const url = uploaded?.url || uploaded?.secure_url || uploaded?.path;
        if (!url) throw new Error("No URL returned");
        done({ progress: 100, url });
      } catch (err) {
        toast.error(err?.response?.data?.error || err?.message || "Image upload failed");
        done({ progress: 100, url: "" });
      }
    });

    if (designJson && !designLoadedRef.current) {
      try {
        const design = typeof designJson === "string" ? JSON.parse(designJson) : designJson;
        editor.loadDesign(design);
        designLoadedRef.current = true;
      } catch {
        /* ignore bad design */
      }
    } else if (htmlFallback && !designJson && !designLoadedRef.current) {
      // Unlayer doesn't import arbitrary HTML well; leave blank canvas with optional body
      designLoadedRef.current = true;
    }
  }, [designJson, htmlFallback, toast]);

  // Reload design when prop changes after ready
  useEffect(() => {
    if (!ready || !designJson) return;
    const editor = editorRef.current?.editor;
    if (!editor) return;
    try {
      const design = typeof designJson === "string" ? JSON.parse(designJson) : designJson;
      editor.loadDesign(design);
    } catch { /* ignore */ }
  }, [designJson, ready]);

  return (
    <div className={`border border-crm-border rounded-lg overflow-hidden bg-white ${className}`}>
      <div className="flex items-center justify-between px-3 py-2 bg-crm-bg border-b border-crm-border">
        <p className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Visual email editor</p>
        <button
          type="button"
          className="crm-btn crm-btn-secondary text-xs h-7 px-3"
          onClick={exportAndNotify}
          disabled={!ready}
        >
          Apply / Preview HTML
        </button>
      </div>
      <EmailEditor
        ref={editorRef}
        onReady={onReady}
        minHeight={minHeight}
        options={{
          displayMode: "email",
          features: {
            textEditor: { spellCheck: true },
          },
          appearance: {
            theme: "modern_light",
          },
        }}
      />
    </div>
  );
}

/** Imperative helper: export html+design from a ref to EmailBuilder's inner editor */
export function exportEmailFromRef(editorComponentRef) {
  return new Promise((resolve) => {
    const editor = editorComponentRef?.current?.editor;
    if (!editor) {
      resolve({ html: "", design: null });
      return;
    }
    editor.exportHtml((data) => {
      resolve({ html: data.html || "", design: data.design || null });
    });
  });
}
