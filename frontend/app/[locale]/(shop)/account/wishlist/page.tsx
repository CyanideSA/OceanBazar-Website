'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { productsApi } from '@/lib/api';
import { useWishlistStore } from '@/stores/wishlistStore';
import { useAuthStore } from '@/stores/authStore';
import { chunk } from '@/lib/utils';
import type { Product } from '@/types';

export default function AccountWishlistPage() {
  const t = useTranslations('account');
  const tc = useTranslations('common');
  const locale = useLocale();
  const ids = useWishlistStore((s) => s.ids);
  const { user } = useAuthStore();

  const chunks = useMemo(() => chunk(ids, 4), [ids]);

  const { data: products, isLoading } = useQuery({
    queryKey: ['wishlist-products', ids.join(',')],
    queryFn: async () => {
      if (ids.length === 0) return [] as Product[];
      const batches = await Promise.all(
        chunks.map((c) => productsApi.compare(c).then((r) => r.data.products as Product[]))
      );
      const map = new Map<string, Product>();
      for (const batch of batches) {
        for (const p of batch) map.set(p.id, p);
      }
      return ids.map((id) => map.get(id)).filter(Boolean) as Product[];
    },
    enabled: ids.length > 0,
  });

  const list = products ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2">
        <Heart className="h-6 w-6 text-primary sm:h-7 sm:w-7" />
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">{t('wishlist')}</h1>
      </div>

      {ids.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-muted-foreground">
          {t('wishlistEmpty')}
        </p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">{tc('loading')}</p>
      ) : list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-muted-foreground">
          {t('wishlistEmpty')}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          {list.map((p) => {
            const price =
              user?.userType === 'wholesale'
                ? (p.wholesalePrice ?? p.retailPrice)
                : (p.retailPrice ?? p.wholesalePrice);
            return (
              <li key={p.id}>
                <Link
                  href={`/${locale}/products/${p.id}`}
                  className="flex gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40 sm:gap-4"
                >
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-24 sm:w-24">
                    {p.primaryImage ? (
                      <img src={p.primaryImage} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground line-clamp-2">{p.title}</p>
                    {price != null ? (
                      <p className="mt-1 text-sm font-semibold text-primary">
                        {tc('taka')}
                        {Number(price).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
