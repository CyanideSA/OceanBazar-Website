'use client';

import { useToastStore, type ToastVariant } from '@/hooks/useToast';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS: Record<ToastVariant, React.ElementType> = {
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

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 right-4 z-[200] flex flex-col-reverse gap-2 sm:bottom-6 sm:right-6"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.variant];
        return (
          <div
            key={t.id}
            role="alert"
            className={cn(
              'flex max-w-xs items-start gap-3 rounded-xl border px-4 py-3 shadow-lg',
              'animate-[slideInUp_0.25s_ease-out]',
              'sm:max-w-sm',
              STYLES[t.variant],
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1 text-sm font-medium leading-snug">{t.message}</p>
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
