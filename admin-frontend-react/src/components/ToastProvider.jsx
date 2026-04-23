import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const pushToast = useCallback(
    ({ type, title, message, durationMs = 4000 }) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);
      timersRef.current[id] = setTimeout(() => removeToast(id), durationMs);
    },
    [removeToast]
  );

  const toastApi = useMemo(
    () => ({
      success: (title, message) => pushToast({ type: "success", title, message }),
      error: (title, message) => pushToast({ type: "error", title, message }),
      info: (title, message) => pushToast({ type: "info", title, message })
    }),
    [pushToast]
  );

  const value = useMemo(
    () => ({
      toasts,
      toast: toastApi
    }),
    [toasts, toastApi]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <div className="toast-title">{t.title}</div>
            {t.message ? <div className="toast-message">{t.message}</div> : null}
            <button type="button" className="toast-close" onClick={() => removeToast(t.id)} aria-label="Close toast">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx.toast;
}

