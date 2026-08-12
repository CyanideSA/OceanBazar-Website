import { create } from 'zustand';
import { formatApiErrorMessage } from '@/lib/formatApiError';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  add: (toast: Omit<Toast, 'id'>) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (toast) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, toast.duration ?? 3500);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

function describeToastMessage(message: unknown) {
  if (typeof message === 'string') return { type: 'string', preview: message.slice(0, 120) };
  if (message && typeof message === 'object') {
    const o = message as Record<string, unknown>;
    return { type: 'object', keys: Object.keys(o).slice(0, 8), hasMessage: 'message' in o, hasCode: 'code' in o };
  }
  return { type: typeof message };
}

export function useToast() {
  const add = useToastStore((s) => s.add);
  return {
    toast: (message: string, variant: ToastVariant = 'info', duration?: number) =>
      add({ message: formatApiErrorMessage(message), variant, duration }),
    success: (message: string) => add({ message: formatApiErrorMessage(message), variant: 'success' }),
    error: (message: string) => {
      const safe = formatApiErrorMessage(message);
      // #region agent log
      fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'post-fix',hypothesisId:'H1',location:'useToast.ts:error',message:'toast error invoked',data:{...describeToastMessage(message),safePreview:safe.slice(0,120)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      add({ message: safe, variant: 'error' });
    },
    info: (message: string) => add({ message: formatApiErrorMessage(message), variant: 'info' }),
    warning: (message: string) => add({ message: formatApiErrorMessage(message), variant: 'warning' }),
  };
}
