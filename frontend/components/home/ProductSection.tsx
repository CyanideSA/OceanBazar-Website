'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { productsApi } from '@/lib/api';
import ProductCard from '@/components/product/ProductCard';
import type { Product } from '@/types';
import { cn } from '@/lib/utils';

type Layout = 'thirty' | 'eleven';
type SectionKey = 'trending' | 'bestSeller' | 'beauty' | 'mostSold' | 'gadgets' | 'home' | 'kids' | 'more';

function sectionToCollectionSlug(key: SectionKey): string {
  switch (key) {
    case 'trending':
      return 'top-trending';
    case 'bestSeller':
      return 'best-seller';
    case 'beauty':
      return 'beauty';
    case 'mostSold':
      return 'most-sold';
    case 'gadgets':
      return 'gadgets';
    case 'home':
      return 'home';
    case 'kids':
      return 'kids';
    case 'more':
      return 'more-for-you';
    default:
      return 'products';
  }
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/40 bg-card">
      <div className="relative aspect-square overflow-hidden bg-muted">
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>
      <div className="space-y-2.5 p-3.5">
        <div className="h-3 w-2/3 rounded bg-muted" />
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-5 w-1/2 rounded bg-muted" />
      </div>
    </div>
  );
}

export default function ProductSection({
  titleKey,
  searchQuery,
  categoryId,
  layout,
}: {
  titleKey: SectionKey;
  searchQuery?: string;
  categoryId?: string;
  layout: Layout;
}) {
  const locale = useLocale();
  const t = useTranslations('home.sections');
  const limit = layout === 'thirty' ? 29 : 11;
  const collection = sectionToCollectionSlug(titleKey);

  const { data, isLoading } = useQuery({
    queryKey: ['home-section', titleKey, searchQuery, categoryId, layout, locale],
    queryFn: () =>
      productsApi
        .list({
          limit,
          lang: locale,
          ...(collection ? { collection } : {}),
          ...(!collection && searchQuery ? { search: searchQuery } : {}),
          ...(categoryId ? { category: categoryId } : {}),
        })
        .then((r) => r.data),
  });

  const products: Product[] = data?.products ?? [];
  const title = t(titleKey);
  const allHref = `/${locale}/products/${sectionToCollectionSlug(titleKey)}`;

  const gridCols = 'grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';

  function renderHeader() {
    return (
      <div className="mb-4 flex items-center justify-between gap-2 sm:mb-6">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold tracking-tight text-foreground sm:text-2xl">{title}</h2>
          <div className="mt-1 h-0.5 w-10 rounded-full bg-primary sm:mt-1.5 sm:w-12" />
        </div>
        <Link
          href={allHref}
          className="group inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 hover:text-primary/80"
        >
          {t('viewAll')}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    );
  }

  function renderSkeletons(count: number) {
    return (
      <div className={cn('grid gap-2.5 sm:gap-4', gridCols)}>
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  function ViewAllCard() {
    return (
      <Link
        href={allHref}
        className={cn(
          'flex min-h-[140px] flex-col items-center justify-center rounded-xl sm:min-h-[200px]',
          'border-2 border-dashed border-primary/30 bg-primary/[0.03]',
          'p-3 text-center transition-all hover:border-primary/50 hover:bg-primary/[0.06]',
        )}
      >
        <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 sm:h-10 sm:w-10">
          <ArrowRight className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
        </div>
        <span className="text-xs font-bold text-primary sm:text-sm">{t('viewAll')}</span>
        <span className="mt-0.5 text-2xs text-muted-foreground">{title}</span>
      </Link>
    );
  }

  // Hide section entirely if no products and done loading
  if (!isLoading && products.length === 0) return null;

  if (layout === 'thirty') {
    const row1 = products.slice(0, 24);
    const row2 = products.slice(24, 29);
    return (
      <section className="section-padding content-visibility-auto">
        <div className="container-tight">
          {renderHeader()}
          {isLoading ? (
            renderSkeletons(12)
          ) : (
            <>
              <div className={cn('grid gap-2.5 sm:gap-4', gridCols)}>
                {row1.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
              {row2.length > 0 && (
                <div className={cn('mt-2.5 grid gap-2.5 sm:mt-4 sm:gap-4', gridCols)}>
                  {row2.map((p) => <ProductCard key={p.id} product={p} />)}
                  <ViewAllCard />
                </div>
              )}
            </>
          )}
        </div>
      </section>
    );
  }

  const rowA = products.slice(0, 6);
  const rowB = products.slice(6, 11);

  return (
    <section className="section-padding content-visibility-auto">
      <div className="container-tight">
        {renderHeader()}
        {isLoading ? (
          renderSkeletons(6)
        ) : (
          <>
            <div className={cn('grid gap-2.5 sm:gap-4', gridCols)}>
              {rowA.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
            {rowB.length > 0 && (
              <div className={cn('mt-2.5 grid gap-2.5 sm:mt-4 sm:gap-4', gridCols)}>
                {rowB.map((p) => <ProductCard key={p.id} product={p} />)}
                <ViewAllCard />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
