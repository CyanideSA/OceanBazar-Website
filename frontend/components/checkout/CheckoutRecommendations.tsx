'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '@/lib/api';
import ProductCard from '@/components/product/ProductCard';
import type { Product } from '@/types';

export default function CheckoutRecommendations() {
  const t = useTranslations('checkout');
  const locale = useLocale();

  const { data, isLoading } = useQuery({
    queryKey: ['checkout-recs', locale],
    queryFn: () => productsApi.list({ limit: 8, lang: locale }).then((r) => r.data as { products: Product[] }),
  });

  const products = data?.products ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-3 text-lg font-semibold text-foreground">{t('moreProducts')}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {products.slice(0, 4).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
      <section>
        <h3 className="mb-3 text-lg font-semibold text-foreground">{t('featuredProducts')}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {products.slice(4, 8).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
