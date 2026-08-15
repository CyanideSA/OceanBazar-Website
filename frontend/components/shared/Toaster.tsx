'use client';

import type { ElementType } from 'react';
import { useToastStore, type ToastVariant } from '@/hooks/useToast';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isIosSafari } from '@/lib/iosSafari';

const ICONS: Record<ToastVariant, ElementType> = {
  success: CheckCircle2,
  error:   XCircle,
  warning: AlertCircle,
  info:    Info,
};

const STYLES: Record<ToastVariant, string> = {
  success: 'border-success/30 bg-success/10 text-success dark:bg-success/15',
  error:   'border-destructive/30 bg-destructive/10 text-destructive dark:bg-destructive/15',
  warning: 'border-warning/30 bg-warning/10 text-warning-foreground dark:bg-warning/15',
  info:    'border-primary/30 bg-primary/10 text-primary dark:bg-primary/15',
};

export default function Toaster() {
  const { toasts, remove } = useToastStore();
  const skipMotion = typeof window !== 'undefined' && isIosSafari();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 right-4 z-[200] flex flex-col-reverse gap-2 sm:bottom-6 sm:right-6"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.variant];
        // #region agent log
        if (typeof t.message !== 'string') {
          fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'pre-fix',hypothesisId:'H1',location:'Toaster.tsx:render',message:'non-string toast message about to render',data:{type:typeof t.message,keys:t.message&&typeof t.message==='object'?Object.keys(t.message as object).slice(0,8):[]},timestamp:Date.now()})}).catch(()=>{});
        }
        // #endregion
        return (
          <div
            key={t.id}
            role="alert"
            className={cn(
              'flex max-w-xs items-start gap-3 rounded-xl border px-4 py-3 shadow-lg',
              !skipMotion && 'animate-[slideInUp_0.25s_ease-out]',
              'sm:max-w-sm',
              STYLES[t.variant],
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1 text-sm font-medium leading-snug">
              {typeof t.message === 'string' ? t.message : String((t.message as { message?: string })?.message ?? t.message ?? '')}
            </p>
            <button
              type="button"
              onClick={() => remove(t.id)}
              className="ml-1 shrink-0 opacity-60 transition-opacity hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
