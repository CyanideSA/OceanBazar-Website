'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '@/lib/api';
import ProductCard from './ProductCard';
import { ProductGridSkeleton } from '@/components/shared/Skeleton';
import type { Product } from '@/types';

export default function FeaturedProducts() {
  const t = useTranslations('home');
  const locale = useLocale();

  const { data, isLoading } = useQuery({
    queryKey: ['products-featured', locale],
    queryFn: () => productsApi.list({ limit: 8, lang: locale }).then((r) => r.data),
  });

  const products: Product[] = data?.products ?? [];

  return (
    <section className="section-padding content-visibility-auto">
      <div className="container-tight rounded-2xl bg-muted/30 px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-4 sm:mb-6">
          <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-2xl">{t('featuredProducts')}</h2>
          <div className="mt-1 h-0.5 w-10 rounded-full bg-primary sm:mt-1.5 sm:w-12" />
        </div>
        {isLoading ? (
          <ProductGridSkeleton count={8} />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
