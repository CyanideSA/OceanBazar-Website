'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, LayoutGrid, X } from 'lucide-react';
import { categoriesApi } from '@/lib/api';
import type { Category } from '@/types';
import { cn } from '@/lib/utils';
import { useEffect, useMemo, useRef, useState } from 'react';
import CategoryLabelVisual from '@/components/category/CategoryLabelVisual';

const LEFT_INITIAL = 10;
const RIGHT_INITIAL = 12;

/** Subcategories for the mega menu right column (direct children, or flattened one level). */
function subcategoriesForPanel(category: Category | undefined): Category[] {
  if (!category) return [];
  const direct = category.children ?? [];
  if (direct.length > 0) return direct;
  return [];
}

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
  const [showAllLeft, setShowAllLeft] = useState(false);
  const [showAllRight, setShowAllRight] = useState(false);

  const { data } = useQuery({
    queryKey: ['categories-tree'],
    queryFn: () => categoriesApi.list().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const categories: Category[] = Array.isArray(data) ? data : (data?.categories ?? []);

  useEffect(() => {
    if (categories.length && !activeId) setActiveId(categories[0]?.id ?? null);
  }, [categories, activeId]);

  useEffect(() => {
    if (!desktopOpen) {
      setShowAllLeft(false);
      setShowAllRight(false);
    }
  }, [desktopOpen]);

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
  const subs = useMemo(() => subcategoriesForPanel(active), [active]);

  const label = (c: Category) => (locale === 'bn' ? c.nameBn : c.nameEn);

  const leftVisible = showAllLeft ? categories : categories.slice(0, LEFT_INITIAL);
  const rightVisible = showAllRight ? subs : subs.slice(0, RIGHT_INITIAL);
  const hasMoreLeft = categories.length > LEFT_INITIAL;
  const hasMoreRight = subs.length > RIGHT_INITIAL;

  const showMoreLabel = locale === 'bn' ? 'আরও দেখুন' : 'Show more';
  const showLessLabel = locale === 'bn' ? 'কম দেখুন' : 'Show less';

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        className={cn(
          'hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors md:inline-flex',
          desktopOpen
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted/80 text-foreground hover:bg-muted',
        )}
        onMouseEnter={() => onDesktopOpenChange(true)}
        aria-expanded={desktopOpen}
        aria-haspopup="true"
      >
        <LayoutGrid className="h-4 w-4" />
        {t('categories')}
      </button>

      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold md:hidden',
          mobileOpen ? 'bg-primary text-primary-foreground' : 'bg-muted/80 text-foreground',
        )}
        onClick={() => onMobileOpenChange(!mobileOpen)}
      >
        <LayoutGrid className="h-4 w-4" />
        {t('categories')}
      </button>

      {desktopOpen && (
        <div
          className="absolute left-0 top-full z-[55] mt-1 hidden w-[min(100vw-2rem,780px)] rounded-xl border border-border bg-popover shadow-xl md:block"
          onMouseLeave={() => onDesktopOpenChange(false)}
        >
          <div className="flex max-h-[min(70vh,440px)] min-h-[240px]">
            <nav
              className="flex w-52 shrink-0 flex-col border-r border-border bg-muted/40"
              aria-label="Categories"
            >
              <div className="flex-1 overflow-y-auto py-2">
                {leftVisible.map((c) => (
                  <Link
                    key={c.id}
                    href={`/${locale}/products?category=${c.id}`}
                    onClick={() => onDesktopOpenChange(false)}
                    onMouseEnter={() => {
                      setActiveId(c.id);
                      setShowAllRight(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors',
                      activeId === c.id
                        ? 'bg-background font-semibold text-primary'
                        : 'text-foreground hover:bg-muted',
                    )}
                  >
                    <CategoryLabelVisual category={c} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{label(c)}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
                  </Link>
                ))}
              </div>
              {hasMoreLeft && (
                <button
                  type="button"
                  onClick={() => setShowAllLeft((v) => !v)}
                  className="mx-2 mb-2 rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-semibold text-primary hover:bg-muted"
                >
                  {showAllLeft ? showLessLabel : showMoreLabel}
                </button>
              )}
            </nav>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="shrink-0 border-b border-border px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {active ? label(active) : ''}
                </p>
                {active && (
                  <Link
                    href={`/${locale}/products?category=${active.id}`}
                    onClick={() => onDesktopOpenChange(false)}
                    className="mt-1 inline-flex text-sm text-primary hover:underline"
                  >
                    {locale === 'bn' ? 'এই বিভাগে সব পণ্য' : 'View all in this category'}
                  </Link>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {subs.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {locale === 'bn' ? 'কোনো উপ-বিভাগ নেই' : 'No subcategories yet'}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {rightVisible.map((sub) => (
                      <Link
                        key={sub.id}
                        href={`/${locale}/products?category=${sub.id}`}
                        onClick={() => onDesktopOpenChange(false)}
                        className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-2.5 py-2 text-sm transition-colors hover:border-primary hover:bg-muted/50"
                      >
                        <CategoryLabelVisual category={sub} size="sm" />
                        <span className="min-w-0 flex-1 truncate font-medium leading-tight">
                          {label(sub)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              {hasMoreRight && (
                <div className="shrink-0 border-t border-border p-2">
                  <button
                    type="button"
                    onClick={() => setShowAllRight((v) => !v)}
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-semibold text-primary hover:bg-muted"
                  >
                    {showAllRight ? showLessLabel : showMoreLabel}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
            <div className="flex max-h-[38vh] flex-col border-b border-border/60 sm:max-h-none sm:w-48 sm:border-b-0 sm:border-r">
              <div className="flex-1 overflow-y-auto p-2">
                <div className="flex flex-row gap-1 sm:flex-col">
                  {categories.map((c) => (
                    <Link
                      key={c.id}
                      href={`/${locale}/products?category=${c.id}`}
                      onClick={() => onMobileOpenChange(false)}
                      onMouseEnter={() => setActiveId(c.id)}
                      className={cn(
                        'flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors sm:whitespace-normal',
                        activeId === c.id
                          ? 'bg-primary text-primary-foreground'
                          : 'text-foreground hover:bg-accent',
                      )}
                    >
                      <CategoryLabelVisual category={c} size="sm" />
                      {label(c)}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 overflow-y-auto p-3">
                {active && (
                  <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {label(active)}
                  </p>
                )}
                {active && (
                  <Link
                    href={`/${locale}/products?category=${active.id}`}
                    onClick={() => onMobileOpenChange(false)}
                    className="mb-3 inline-flex text-sm text-primary hover:underline"
                  >
                    {locale === 'bn' ? 'এই বিভাগে সব পণ্য দেখুন' : 'View all in this category'}
                  </Link>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {subs.map((sub) => (
                    <Link
                      key={sub.id}
                      href={`/${locale}/products?category=${sub.id}`}
                      onClick={() => onMobileOpenChange(false)}
                      className="flex min-h-[52px] items-center gap-2 rounded-xl border border-border bg-card p-2.5 text-sm transition-colors hover:border-primary/50 hover:bg-muted/50"
                    >
                      <CategoryLabelVisual category={sub} size="sm" />
                      <span className="min-w-0 flex-1 truncate font-medium">{label(sub)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
