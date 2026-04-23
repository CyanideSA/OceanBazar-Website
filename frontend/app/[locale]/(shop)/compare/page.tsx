'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { X, ArrowLeft, GitCompare } from 'lucide-react';
import { useCompareStore } from '@/stores/compareStore';
import { productsApi } from '@/lib/api';
import { getMediaUrl } from '@/lib/mediaUrl';
import { cn } from '@/lib/utils';
import type { Product } from '@/types';

export default function ComparePage() {
  const locale = useLocale();
  const t = useTranslations('productDetail');
  const tp = useTranslations('product');
  const { ids, remove, clear } = useCompareStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ids.length === 0) { setProducts([]); setLoading(false); return; }
    setLoading(true);
    productsApi.compare(ids)
      .then((r) => {
        const data = r.data;
        setProducts(Array.isArray(data) ? data : data?.products ?? []);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [ids]);

  const specKeys = Array.from(
    new Set(products.flatMap((p) => {
      if (!p.specifications) return [];
      const specs = typeof p.specifications === 'string' ? JSON.parse(p.specifications) : p.specifications;
      return Object.keys(specs);
    }))
  );

  function getSpec(product: Product, key: string): string {
    if (!product.specifications) return '—';
    const specs = typeof product.specifications === 'string' ? JSON.parse(product.specifications) : product.specifications;
    return specs[key] ?? '—';
  }

  if (ids.length === 0 && !loading) {
    return (
      <div className="container-tight flex min-h-[50vh] flex-col items-center justify-center py-20">
        <GitCompare className="mb-4 h-16 w-16 text-muted-foreground/20" />
        <p className="text-lg font-semibold text-muted-foreground">No products to compare</p>
        <p className="mb-6 text-sm text-muted-foreground">Add products using the compare button on product pages.</p>
        <Link href={`/${locale}/products`} className="text-primary font-medium hover:underline">
          {tp('pageTitle')}
        </Link>
      </div>
    );
  }

  return (
    <div className="container-tight py-6 sm:py-10">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/products`}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t('compare')} ({products.length})</h1>
        </div>
        <button
          type="button"
          onClick={clear}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Clear all
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="w-40 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Product
                </th>
                {products.map((p) => (
                  <th key={p.id} className="relative min-w-[180px] px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => remove(p.id)}
                      className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <Link href={`/${locale}/product/${p.id}`} className="block">
                      <div className="mx-auto mb-2 h-28 w-28 overflow-hidden rounded-lg bg-muted">
                        {p.primaryImage ? (
                          <img
                            src={getMediaUrl(p.primaryImage)}
                            alt={p.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
                            <GitCompare className="h-8 w-8" />
                          </div>
                        )}
                      </div>
                      <p className="line-clamp-2 text-sm font-semibold text-foreground hover:text-primary">
                        {p.title}
                      </p>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Price */}
              <tr className="border-b border-border">
                <td className="px-4 py-3 font-medium text-muted-foreground">Price</td>
                {products.map((p) => (
                  <td key={p.id} className="px-4 py-3 text-center">
                    <span className="text-lg font-bold text-primary">৳{Number(p.price).toLocaleString()}</span>
                    {p.comparePrice && Number(p.comparePrice) > Number(p.price) && (
                      <span className="ml-2 text-sm text-muted-foreground line-through">
                        ৳{Number(p.comparePrice).toLocaleString()}
                      </span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Brand */}
              <tr className="border-b border-border bg-muted/20">
                <td className="px-4 py-3 font-medium text-muted-foreground">{t('brand')}</td>
                {products.map((p) => (
                  <td key={p.id} className="px-4 py-3 text-center font-medium">
                    {p.brand || '—'}
                  </td>
                ))}
              </tr>

              {/* Rating */}
              <tr className="border-b border-border">
                <td className="px-4 py-3 font-medium text-muted-foreground">Rating</td>
                {products.map((p) => (
                  <td key={p.id} className="px-4 py-3 text-center">
                    {p.ratingAvg ? `${Number(p.ratingAvg).toFixed(1)} ★` : '—'}
                  </td>
                ))}
              </tr>

              {/* Stock */}
              <tr className="border-b border-border bg-muted/20">
                <td className="px-4 py-3 font-medium text-muted-foreground">Stock</td>
                {products.map((p) => (
                  <td key={p.id} className="px-4 py-3 text-center">
                    {p.stockQty != null ? (
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        Number(p.stockQty) > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                      )}>
                        {Number(p.stockQty) > 0 ? `${p.stockQty} in stock` : 'Out of stock'}
                      </span>
                    ) : '—'}
                  </td>
                ))}
              </tr>

              {/* Dynamic specifications */}
              {specKeys.map((key, i) => (
                <tr key={key} className={cn('border-b border-border', i % 2 === 0 && 'bg-muted/20')}>
                  <td className="px-4 py-3 font-medium text-muted-foreground capitalize">{key}</td>
                  {products.map((p) => (
                    <td key={p.id} className="px-4 py-3 text-center">{getSpec(p, key)}</td>
                  ))}
                </tr>
              ))}

              {/* Add to cart row */}
              <tr>
                <td className="px-4 py-4" />
                {products.map((p) => (
                  <td key={p.id} className="px-4 py-4 text-center">
                    <Link
                      href={`/${locale}/product/${p.id}`}
                      className="inline-flex rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition-all hover:brightness-110"
                    >
                      {tp('addToCart')}
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
