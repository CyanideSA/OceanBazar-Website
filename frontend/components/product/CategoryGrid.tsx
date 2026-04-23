'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { categoriesApi } from '@/lib/api';
import type { Category } from '@/types';
import { cn } from '@/lib/utils';

export default function CategoryGrid() {
  const t = useTranslations('home');
  const locale = useLocale();
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const { data } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const categories: Category[] = Array.isArray(data) ? data : (data?.categories ?? []);
  /* On mobile show first 8 collapsed, all when expanded */
  const mobileVisible = mobileExpanded ? categories : categories.slice(0, 8);

  return (
    <section className="section-padding content-visibility-auto">
      <div className="container-tight">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between gap-2 sm:mb-6">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-2xl">{t('categories')}</h2>
            <div className="mt-1 h-0.5 w-10 rounded-full bg-primary sm:mt-1.5 sm:w-12" />
          </div>
          {/* Mobile collapse toggle — only show if there are hidden categories */}
          {categories.length > 8 && (
            <button
              type="button"
              onClick={() => setMobileExpanded((v) => !v)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 sm:hidden"
              aria-expanded={mobileExpanded}
            >
              {mobileExpanded ? (
                <><ChevronUp className="h-4 w-4" /> Show less</>
              ) : (
                <><ChevronDown className="h-4 w-4" /> See all ({categories.length})</>
              )}
            </button>
          )}
        </div>

        {/* Mobile: scrollable horizontal pill row */}
        <div className="mb-3 sm:hidden">
          <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/${locale}/products?category=${cat.id}`}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary active:scale-95"
              >
                <span className="text-base leading-none">{cat.icon || '📦'}</span>
                <span className="whitespace-nowrap">{locale === 'bn' ? cat.nameBn : cat.nameEn}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Mobile: collapsible grid */}
        <div className="sm:hidden">
          <div className={cn(
            'grid grid-cols-4 gap-2 transition-all duration-300',
          )}>
            {mobileVisible.map((cat) => (
              <Link
                key={cat.id}
                href={`/${locale}/products?category=${cat.id}`}
                className="group flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card p-2 text-center transition-all hover:border-primary/40 hover:bg-primary/5 active:scale-95"
              >
                <span className="text-2xl leading-none">{cat.icon || '📦'}</span>
                <span className="line-clamp-2 text-[10px] font-medium text-foreground group-hover:text-primary">
                  {locale === 'bn' ? cat.nameBn : cat.nameEn}
                </span>
              </Link>
            ))}
          </div>
          {categories.length > 8 && (
            <button
              type="button"
              onClick={() => setMobileExpanded((v) => !v)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/30 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
            >
              {mobileExpanded
                ? <><ChevronUp className="h-3.5 w-3.5" /> Collapse</>
                : <><ChevronDown className="h-3.5 w-3.5" /> Show all {categories.length} categories</>
              }
            </button>
          )}
        </div>

        {/* Desktop: full grid */}
        <div className="hidden grid-cols-3 gap-3 sm:grid md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/${locale}/products?category=${cat.id}`}
              className="group flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-card p-3 text-center transition-all hover:border-primary/30 hover:shadow-soft hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <span className="text-3xl leading-none">{cat.icon || '📦'}</span>
              <span className="line-clamp-2 text-xs font-medium text-foreground transition-colors group-hover:text-primary">
                {locale === 'bn' ? cat.nameBn : cat.nameEn}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
