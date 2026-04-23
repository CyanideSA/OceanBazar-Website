'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { productsApi } from '@/lib/api';
import ProductCard from './ProductCard';
import type { Product } from '@/types';

interface Props {
  productId: string;
  categoryId: string;
}

export default function ProductRelatedSections({ productId, categoryId }: Props) {
  const t = useTranslations('productDetail');
  const locale = useLocale();

  const { data: similarData, isLoading: simLoad } = useQuery({
    queryKey: ['products-similar', categoryId, productId, locale],
    queryFn: () =>
      productsApi
        .list({ category: categoryId, limit: 8, excludeId: productId, lang: locale })
        .then((r) => r.data as { products: Product[] }),
  });

  const { data: moreData, isLoading: moreLoad } = useQuery({
    queryKey: ['products-more', productId, locale],
    queryFn: () =>
      productsApi
        .list({ limit: 8, excludeId: productId, lang: locale })
        .then((r) => r.data as { products: Product[] }),
  });

  const { data: featData, isLoading: featLoad } = useQuery({
    queryKey: ['products-featured-pdp', productId, locale],
    queryFn: () =>
      productsApi
        .list({ limit: 8, excludeId: productId, lang: locale })
        .then((r) => r.data as { products: Product[] }),
  });

  const similar = similarData?.products ?? [];
  const more = moreData?.products ?? [];
  const featured = featData?.products ?? [];

  return (
    <div className="mt-10 space-y-10 sm:mt-16 sm:space-y-14">

      {/* Similar products — horizontal scroll on mobile, grid on sm+ */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-2 sm:mb-4">
          <h2 className="text-lg font-bold text-foreground sm:text-xl">{t('similarCategory')}</h2>
          <Link
            href={`/${locale}/products?category=${categoryId}`}
            className="shrink-0 text-sm font-medium text-primary hover:underline"
          >
            {t('viewAll')}
          </Link>
        </div>
        {simLoad ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-52 animate-pulse rounded-xl bg-muted sm:h-64" />
            ))}
          </div>
        ) : (
          <>
            {/* Mobile: horizontal scroll */}
            <div className="scrollbar-hide -mx-3 flex gap-3 overflow-x-auto px-3 pb-2 sm:hidden">
              {similar.map((p) => (
                <div key={p.id} className="w-[160px] shrink-0">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
            {/* sm+: grid */}
            <div className="hidden grid-cols-3 gap-4 sm:grid lg:grid-cols-4">
              {similar.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </>
        )}
      </section>

      {/* More products — 2-col grid on mobile */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-foreground sm:mb-4 sm:text-xl">{t('moreProducts')}</h2>
        {moreLoad ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-52 animate-pulse rounded-xl bg-muted sm:h-64" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {more.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* Featured products — 2-col grid on mobile */}
      <section className="rounded-2xl bg-muted/40 p-4 sm:p-6">
        <h2 className="mb-3 text-lg font-bold text-foreground sm:mb-4 sm:text-xl">{t('featuredProducts')}</h2>
        {featLoad ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-52 animate-pulse rounded-xl bg-muted sm:h-64" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
