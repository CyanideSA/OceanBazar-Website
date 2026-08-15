'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { productsApi } from '@/lib/api';
import ProductCard from '@/components/product/ProductCard';
import type { Product } from '@/types';
import { cn } from '@/lib/utils';

type SectionKey = 'featured' | 'trending' | 'bestRated' | 'beauty' | 'mostSold' | 'latest' | 'bestDeals';

function sectionToCollectionSlug(key: SectionKey): string {
  switch (key) {
    case 'featured':   return 'featured';
    case 'trending':   return 'top-trending';
    case 'bestRated':  return 'best-rated';
    case 'beauty':     return 'beauty';
    case 'mostSold':   return 'most-sold';
    case 'latest':     return 'latest';
    case 'bestDeals':  return 'best-deals';
    default:           return 'featured';
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

/**
 * Renders product sections on the homepage.
 * Desktop (≥sm): single grid — 5 cols × 2 rows = 10 products.
 * Mobile (<sm): compact grid — 3 cols × 2 rows (approx.) = 5 visible products + "show more".
 */
export default function ProductSection({
  titleKey,
  categoryId,
  initialProducts,
}: {
  titleKey: SectionKey;
  categoryId?: string;
  /** Server-prefetched products so old Safari still sees cards without client JS. */
  initialProducts?: Product[];
}) {
  const locale = useLocale();
  const t = useTranslations('home.sections');
  const collection = sectionToCollectionSlug(titleKey);
  const GRID_SIZE = 12;
  const MOBILE_LIMIT = 9;
  const hasInitial = Array.isArray(initialProducts) && initialProducts.length > 0;

  const { data, isLoading } = useQuery({
    queryKey: ['home-section', titleKey, categoryId, locale],
    queryFn: () =>
      productsApi
        .list({
          limit: GRID_SIZE,
          lang: locale,
          collection,
          ...(categoryId ? { category: categoryId } : {}),
        })
        .then((r) => r.data),
    initialData: hasInitial ? { products: initialProducts } : undefined,
    staleTime: 60_000,
  });

  const products: Product[] = data?.products ?? initialProducts ?? [];
  // Never flash skeletons when SSR already seeded cards (old Safari remounts used to wipe the grid).
  const showSkeleton = isLoading && products.length < 1;

  const title = t(titleKey);
  const allHref = `/${locale}/products/${collection}`;

  const desktopGrid = 'sm:grid-cols-6';
  const mobileGrid  = 'grid-cols-3';

  if (!showSkeleton && products.length < 1) return null;

  return (
    <section
      className="section-padding"
      data-ob-section={titleKey}
      data-ob-product-count={String(products.length)}
    >
      <div className="container-tight">
        {/* Header */}
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

        {/* Product grid */}
        {showSkeleton ? (
          <>
            {/* Mobile skeleton: 9 cards (3×3) */}
            <div className={cn('grid gap-2 sm:hidden', mobileGrid)}>
              {Array.from({ length: MOBILE_LIMIT }).map((_, i) => <SkeletonCard key={`ms-${i}`} />)}
            </div>
            <div className={cn('hidden sm:grid gap-3', desktopGrid)}>
              {Array.from({ length: GRID_SIZE }).map((_, i) => <SkeletonCard key={`ds-${i}`} />)}
            </div>
          </>
        ) : (
          <>
            {/* Mobile: 5 products ≈ 2 rows */}
            <div className={cn('grid gap-2 sm:hidden', mobileGrid)}>
              {products.slice(0, MOBILE_LIMIT).map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
            {/* Mobile: small "show more" link */}
            <div className="mt-3 flex justify-center sm:hidden">
              <Link
                href={allHref}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/40 px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {t('viewAll')}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className={cn('hidden sm:grid gap-3', desktopGrid)}>
              {products.slice(0, GRID_SIZE).map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </>
        )}

        {/* "View All" button — desktop only */}
        {!isLoading && (
          <div className="mt-6 hidden justify-center sm:flex">
            <Link
              href={allHref}
              className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-6 py-2.5 text-sm font-semibold text-primary transition-all hover:bg-primary/10 hover:border-primary/50"
            >
              {t('viewAll')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
