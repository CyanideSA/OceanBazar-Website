import { useRef, useCallback, useState, useEffect } from "react";
import { adminApi } from "../../lib/api";
import { useToast } from "../ToastProvider";

const FONTS = ["Arial", "Times New Roman", "Courier New", "Verdana", "Georgia", "Tahoma"];
const SIZES = ["8px", "10px", "12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "36px", "48px", "64px", "72px"];
const LINE_SPACINGS = [
  { label: "1.0", value: "1" },
  { label: "1.15", value: "1.15" },
  { label: "1.5", value: "1.5" },
  { label: "2.0", value: "2" },
  { label: "2.5", value: "2.5" },
];

function ToolbarBtn({ title, active, onClick, children, disabled }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`px-1.5 py-1 rounded text-xs font-medium transition-colors select-none disabled:opacity-30 ${
        active
          ? "bg-crm-primary text-white"
          : "text-crm-text hover:bg-crm-bg-hover hover:text-crm-text-bright"
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarSep() {
  return <div className="w-px h-5 bg-crm-border mx-1 self-center" />;
}

export default function RichTextEditor({ value, onChange, placeholder = "Write product description…", minHeight = 240 }) {
  const editorRef = useRef(null);
  const toast = useToast();
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef(null);
  const lastValueRef = useRef(value);

  // Sync value prop into editor when it changes externally (edit/load flows)
  useEffect(() => {
    if (!editorRef.current) return;
    const current = editorRef.current.innerHTML;
    if (value !== lastValueRef.current && value !== current) {
      editorRef.current.innerHTML = value || "";
      lastValueRef.current = value;
    }
  }, [value]);

  const exec = useCallback((cmd, val = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    triggerChange();
  }, []);

  const triggerChange = useCallback(() => {
    if (editorRef.current && onChange) {
      const html = editorRef.current.innerHTML;
      lastValueRef.current = html;
      onChange(html);
    }
  }, [onChange]);

  const applyFontSize = useCallback((size) => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const span = document.createElement("span");
    span.style.fontSize = size;
    try {
      range.surroundContents(span);
    } catch {
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
    }
    triggerChange();
  }, [triggerChange]);

  const applyFontFamily = useCallback((font) => {
    exec("fontName", font);
  }, [exec]);

  const applyLineSpacing = useCallback((spacing) => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    let container = range.commonAncestorContainer;
    if (container.nodeType === Node.TEXT_NODE) container = container.parentNode;
    const block = container.closest?.("p,div,li,td,th,h1,h2,h3,blockquote") || container;
    if (block && block !== editorRef.current) {
      block.style.lineHeight = spacing;
      triggerChange();
    }
  }, [triggerChange]);

  const insertTable = useCallback(() => {
    editorRef.current?.focus();
    const rows = Math.max(1, Number(tableRows));
    const cols = Math.max(1, Number(tableCols));
    let html = '<table style="border-collapse:collapse;width:100%;margin:8px 0">';
    for (let r = 0; r < rows; r++) {
      html += "<tr>";
      for (let c = 0; c < cols; c++) {
        html += `<td style="border:1px solid #555;padding:6px 10px;min-width:60px">${r === 0 ? `<strong>Header ${c + 1}</strong>` : "&nbsp;"}</td>`;
      }
      html += "</tr>";
    }
    html += "</table><p><br></p>";
    document.execCommand("insertHTML", false, html);
    triggerChange();
    setShowTableDialog(false);
  }, [tableRows, tableCols, triggerChange]);

  const handleInsertImage = useCallback(async (file) => {
    if (!file) return;
    setImageUploading(true);
    try {
      const r = await adminApi.uploadMedia(file, "products/description");
      const url = r.secureUrl || r.url;
      editorRef.current?.focus();
      document.execCommand("insertHTML", false,
        `<img src="${url}" alt="" style="max-width:100%;height:auto;border-radius:8px;margin:8px 0" />`
      );
      triggerChange();
    } catch {
      toast.error("Image upload failed");
    } finally {
      setImageUploading(false);
    }
  }, [triggerChange, toast]);

  const handleInsertLink = useCallback(() => {
    const url = prompt("Enter URL:");
    if (!url) return;
    exec("createLink", url);
  }, [exec]);

  const applyHeading = useCallback((tag) => {
    exec("formatBlock", tag);
  }, [exec]);

  return (
    <div className="border border-crm-border-strong rounded-xl overflow-hidden bg-crm-bg">
      {/* Toolbar Row 1: Format */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-crm-border bg-crm-bg-alt">
        <ToolbarBtn title="Undo (Ctrl+Z)" onClick={() => exec("undo")}>↩</ToolbarBtn>
        <ToolbarBtn title="Redo (Ctrl+Y)" onClick={() => exec("redo")}>↪</ToolbarBtn>
        <ToolbarSep />
        <ToolbarBtn title="Bold (Ctrl+B)" onClick={() => exec("bold")}><b>B</b></ToolbarBtn>
        <ToolbarBtn title="Italic (Ctrl+I)" onClick={() => exec("italic")}><i>I</i></ToolbarBtn>
        <ToolbarBtn title="Underline (Ctrl+U)" onClick={() => exec("underline")}><u>U</u></ToolbarBtn>
        <ToolbarBtn title="Strikethrough" onClick={() => exec("strikeThrough")}><s>S</s></ToolbarBtn>
        <ToolbarSep />
        <ToolbarBtn title="Heading 2" onClick={() => applyHeading("h2")}>H2</ToolbarBtn>
        <ToolbarBtn title="Heading 3" onClick={() => applyHeading("h3")}>H3</ToolbarBtn>
        <ToolbarBtn title="Paragraph" onClick={() => applyHeading("p")}>P</ToolbarBtn>
        <ToolbarSep />
        <ToolbarBtn title="Align Left" onClick={() => exec("justifyLeft")}>⬛←</ToolbarBtn>
        <ToolbarBtn title="Align Center" onClick={() => exec("justifyCenter")}>⬛↔</ToolbarBtn>
        <ToolbarBtn title="Align Right" onClick={() => exec("justifyRight")}>⬛→</ToolbarBtn>
        <ToolbarBtn title="Justify" onClick={() => exec("justifyFull")}>☰</ToolbarBtn>
        <ToolbarSep />
        <ToolbarBtn title="Bullet List" onClick={() => exec("insertUnorderedList")}>• List</ToolbarBtn>
        <ToolbarBtn title="Numbered List" onClick={() => exec("insertOrderedList")}>1. List</ToolbarBtn>
        <ToolbarBtn title="Indent" onClick={() => exec("indent")}>→ Indent</ToolbarBtn>
        <ToolbarBtn title="Outdent" onClick={() => exec("outdent")}>← Outdent</ToolbarBtn>
        <ToolbarSep />
        <ToolbarBtn title="Insert Link" onClick={handleInsertLink}>🔗 Link</ToolbarBtn>
        <ToolbarBtn title="Insert Image" disabled={imageUploading} onClick={() => imageInputRef.current?.click()}>
          {imageUploading ? "⏳" : "🖼"} Image
        </ToolbarBtn>
        <ToolbarSep />
        <ToolbarBtn title="Clear Formatting" onClick={() => exec("removeFormat")}>✕ Clear</ToolbarBtn>
      </div>

      {/* Toolbar Row 2: Font, Size, Color, Table, Spacing */}
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-crm-border bg-crm-bg-alt">
        <select
          title="Font Family"
          className="text-xs bg-crm-bg-hover border border-crm-border-strong text-crm-text rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-crm-primary"
          defaultValue=""
          onChange={(e) => { if (e.target.value) applyFontFamily(e.target.value); }}
        >
          <option value="">Font</option>
          {FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
        </select>

        <select
          title="Font Size"
          className="text-xs bg-crm-bg-hover border border-crm-border-strong text-crm-text rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-crm-primary"
          defaultValue=""
          onChange={(e) => { if (e.target.value) applyFontSize(e.target.value); }}
        >
          <option value="">Size</option>
          {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <ToolbarSep />

        <label title="Text Color" className="flex items-center gap-1 cursor-pointer">
          <span className="text-xs text-crm-text">A</span>
          <input
            type="color"
            className="w-6 h-6 border-0 bg-transparent cursor-pointer rounded"
            onInput={(e) => exec("foreColor", e.target.value)}
          />
        </label>

        <label title="Highlight Color" className="flex items-center gap-1 cursor-pointer">
          <span className="text-xs text-crm-text">🖊</span>
          <input
            type="color"
            className="w-6 h-6 border-0 bg-transparent cursor-pointer rounded"
            onInput={(e) => exec("hiliteColor", e.target.value)}
          />
        </label>

        <ToolbarSep />

        <ToolbarBtn title="Insert Table" onClick={() => setShowTableDialog(true)}>⊞ Table</ToolbarBtn>

        <ToolbarSep />

        <select
          title="Line Spacing"
          className="text-xs bg-crm-bg-hover border border-crm-border-strong text-crm-text rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-crm-primary"
          defaultValue=""
          onChange={(e) => { if (e.target.value) applyLineSpacing(e.target.value); }}
        >
          <option value="">Line Spacing</option>
          {LINE_SPACINGS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Table Dialog */}
      {showTableDialog && (
        <div className="flex items-center gap-2 px-3 py-2 bg-crm-bg-hover border-b border-crm-border-strong text-xs">
          <span className="text-crm-text font-medium">Insert Table:</span>
          <label className="text-crm-text-dim">Rows:</label>
          <input
            type="number" min="1" max="20" value={tableRows}
            onChange={(e) => setTableRows(e.target.value)}
            className="w-14 bg-crm-bg-alt border border-crm-border-strong text-crm-text rounded px-2 py-0.5 text-xs focus:outline-none"
          />
          <label className="text-crm-text-dim">Cols:</label>
          <input
            type="number" min="1" max="10" value={tableCols}
            onChange={(e) => setTableCols(e.target.value)}
            className="w-14 bg-crm-bg-alt border border-crm-border-strong text-crm-text rounded px-2 py-0.5 text-xs focus:outline-none"
          />
          <button type="button" onMouseDown={(e) => { e.preventDefault(); insertTable(); }}
            className="px-3 py-0.5 bg-crm-primary hover:bg-crm-primary-hover text-white rounded text-xs font-semibold">
            Insert
          </button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); setShowTableDialog(false); }}
            className="px-3 py-0.5 bg-crm-bg-hover hover:bg-crm-bg-alt text-crm-text rounded text-xs">
            Cancel
          </button>
        </div>
      )}

      {/* Hidden image file input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleInsertImage(file);
          e.target.value = "";
        }}
      />

      {/* Editor Area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={triggerChange}
        data-placeholder={placeholder}
        style={{ minHeight }}
        className="px-4 py-3 text-sm text-crm-text-bright outline-none overflow-y-auto focus:ring-0 rte-editor"
        onPaste={(e) => {
          e.preventDefault();
          const html = e.clipboardData.getData("text/html");
          const text = e.clipboardData.getData("text/plain");
          document.execCommand("insertHTML", false, html || text);
          triggerChange();
        }}
      />

      <style>{`
        .rte-editor:empty:before {
          content: attr(data-placeholder);
          color: var(--crm-text-muted);
          pointer-events: none;
        }
        .rte-editor table { border-collapse: collapse; width: 100%; }
        .rte-editor td, .rte-editor th { border: 1px solid var(--crm-border-strong); padding: 6px 10px; }
        .rte-editor ul { list-style: disc; padding-left: 1.5rem; }
        .rte-editor ol { list-style: decimal; padding-left: 1.5rem; }
        .rte-editor p { margin: 0 0 0.5em 0; }
        .rte-editor h2 { font-size: 1.5em; font-weight: 700; margin: 0.5em 0 0.3em; }
        .rte-editor h3 { font-size: 1.25em; font-weight: 600; margin: 0.4em 0 0.2em; }
        .rte-editor b, .rte-editor strong { font-weight: 700; }
        .rte-editor i, .rte-editor em { font-style: italic; }
        .rte-editor u { text-decoration: underline; }
        .rte-editor s { text-decoration: line-through; }
        .rte-editor a { color: var(--crm-primary); text-decoration: underline; }
        .rte-editor img { max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; }
      `}</style>
    </div>
  );
}
