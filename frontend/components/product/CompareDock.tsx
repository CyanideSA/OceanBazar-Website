'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { X, GitCompare } from 'lucide-react';
import { useCompareStore } from '@/stores/compareStore';
import { cn } from '@/lib/utils';

export default function CompareDock() {
  const locale = useLocale();
  const t = useTranslations('productDetail');
  const { ids, remove, clear } = useCompareStore();

  if (ids.length === 0) return null;

  return (
    <div className={cn(
      'fixed bottom-20 left-1/2 z-50 -translate-x-1/2 md:bottom-6',
      'flex items-center gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-2xl backdrop-blur-md',
      'animate-in slide-in-from-bottom-4 duration-300',
    )}>
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <GitCompare className="h-4 w-4 text-primary" />
        <span>{ids.length}/4</span>
      </div>

      <div className="flex items-center gap-1">
        {ids.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => remove(id)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="Remove"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>

      <Link
        href={`/${locale}/compare`}
        className={cn(
          'rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-all',
          'hover:brightness-110 active:scale-95',
          ids.length < 2 && 'pointer-events-none opacity-50',
        )}
      >
        {t('compare')}
      </Link>

      <button
        type="button"
        onClick={clear}
        className="ml-1 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title="Clear all"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
