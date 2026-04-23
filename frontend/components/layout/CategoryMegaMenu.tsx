'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, LayoutGrid, X } from 'lucide-react';
import { categoriesApi } from '@/lib/api';
import type { Category } from '@/types';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

const SUB_ICON: Record<string, string> = {
  Smartphones: '📱',
  Laptops: '💻',
  Accessories: '🎧',
  default: '📦',
};

export default function CategoryMegaMenu({
  desktopOpen,
  onDesktopOpenChange,
  mobileOpen,
  onMobileOpenChange,
}: {
  desktopOpen: boolean;
  onDesktopOpenChange: (v: boolean) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (v: boolean) => void;
}) {
  const locale = useLocale();
  const t = useTranslations('nav');
  const wrapRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['categories-tree'],
    queryFn: () => categoriesApi.list().then((r) => r.data),
  });

  const categories: Category[] = Array.isArray(data) ? data : (data?.categories ?? []);

  useEffect(() => {
    if (categories.length && !activeId) setActiveId(categories[0]?.id ?? null);
  }, [categories, activeId]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        onDesktopOpenChange(false);
      }
    }
    if (desktopOpen) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [desktopOpen, onDesktopOpenChange]);

  const active = categories.find((c) => c.id === activeId) ?? categories[0];
  const children = active?.children ?? [];

  const label = (c: Category) => (locale === 'bn' ? c.nameBn : c.nameEn);

  return (
    <div ref={wrapRef} className="relative">
      {/* Trigger — desktop hover */}
      <button
        type="button"
        className={cn(
          'hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors md:inline-flex',
          desktopOpen
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted/80 text-foreground hover:bg-muted'
        )}
        onMouseEnter={() => onDesktopOpenChange(true)}
        aria-expanded={desktopOpen}
        aria-haspopup="true"
      >
        <LayoutGrid className="h-4 w-4" />
        {t('categories')}
      </button>

      {/* Trigger — mobile tap */}
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold md:hidden',
          mobileOpen ? 'bg-primary text-primary-foreground' : 'bg-muted/80 text-foreground'
        )}
        onClick={() => onMobileOpenChange(!mobileOpen)}
      >
        <LayoutGrid className="h-4 w-4" />
        {t('categories')}
      </button>

      {/* Desktop mega panel */}
      {desktopOpen && (
        <div
          className="absolute left-0 top-full z-[55] mt-1 hidden w-[min(100vw-2rem,720px)] rounded-xl border border-border bg-popover shadow-xl md:block"
          onMouseLeave={() => onDesktopOpenChange(false)}
        >
          <div className="flex max-h-[min(70vh,420px)]">
            <nav
              className="w-48 shrink-0 overflow-y-auto border-r border-border bg-muted/40 py-2"
              aria-label="Categories"
            >
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseEnter={() => setActiveId(c.id)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors',
                    activeId === c.id ? 'bg-background font-semibold text-primary' : 'text-foreground hover:bg-muted'
                  )}
                >
                  <span className="truncate">{label(c)}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
                </button>
              ))}
            </nav>
            <div className="min-w-0 flex-1 overflow-y-auto p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {active ? label(active) : ''}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {children.map((sub) => (
                  <Link
                    key={sub.id}
                    href={`/${locale}/products?category=${sub.id}`}
                    onClick={() => onDesktopOpenChange(false)}
                    className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm transition-colors hover:border-primary hover:bg-muted/50"
                  >
                    <span className="text-lg" aria-hidden>
                      {sub.icon || (SUB_ICON[sub.nameEn] ?? SUB_ICON.default)}
                    </span>
                    <span className="truncate font-medium">{label(sub)}</span>
                  </Link>
                ))}
                {children.length === 0 && active && (
                  <Link
                    href={`/${locale}/products?category=${active.id}`}
                    onClick={() => onDesktopOpenChange(false)}
                    className="col-span-full text-sm text-primary hover:underline"
                  >
                    {locale === 'bn' ? 'এই বিভাগে সব পণ্য' : 'View all in this category'}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile full-screen sheet */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-background md:hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
            <span className="text-base font-semibold text-foreground">{t('categories')}</span>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={() => onMobileOpenChange(false)}
              aria-label="Close categories"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
            {/* Category list — horizontal scroll on xs, vertical sidebar on sm+ */}
            <div className="scrollbar-hide overflow-x-auto border-b border-border/60 sm:max-h-none sm:w-44 sm:overflow-x-visible sm:overflow-y-auto sm:border-b-0 sm:border-r">
              <div className="flex flex-row gap-1 p-2 sm:flex-col sm:p-2">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={cn(
                      'flex min-h-[40px] shrink-0 items-center whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors sm:whitespace-normal',
                      activeId === c.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-accent'
                    )}
                  >
                    {label(c)}
                  </button>
                ))}
              </div>
            </div>
            {/* Subcategory grid */}
            <div className="flex-1 overflow-y-auto p-3">
              {active && (
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {label(active)}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {children.map((sub) => (
                  <Link
                    key={sub.id}
                    href={`/${locale}/products?category=${sub.id}`}
                    onClick={() => onMobileOpenChange(false)}
                    className="flex min-h-[52px] items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm transition-colors hover:border-primary/50 hover:bg-muted/50"
                  >
                    <span className="text-lg leading-none" aria-hidden>{sub.icon || (SUB_ICON[sub.nameEn] ?? SUB_ICON.default)}</span>
                    <span className="truncate font-medium">{label(sub)}</span>
                  </Link>
                ))}
                {children.length === 0 && active && (
                  <Link
                    href={`/${locale}/products?category=${active.id}`}
                    onClick={() => onMobileOpenChange(false)}
                    className="col-span-2 rounded-xl border border-dashed border-primary/40 p-3 text-sm text-primary hover:underline"
                  >
                    {locale === 'bn' ? 'এই বিভাগে সব পণ্য দেখুন' : 'View all in this category'}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
