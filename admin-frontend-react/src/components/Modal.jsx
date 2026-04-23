import React, { useEffect } from "react";

export default function Modal({ open, title, onClose, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`modal-card${wide ? " modal-card--wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title || "Modal"}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title ? (
          <div className="modal-header">
            <h3 style={{ margin: 0 }}>{title}</h3>
            <button type="button" className="btn ghost" onClick={onClose}>
              Close
            </button>
          </div>
        ) : null}
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

