'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { productsApi } from '@/lib/api';
import BrandLogoThumb from '@/components/home/BrandLogoThumb';
import { cn } from '@/lib/utils';

type TopBrandRow = {
  id: string;
  slug: string;
  nameEn: string;
  nameBn: string;
  logoUrl: string | null;
};

export default function TopBrandsPage() {
  const locale = useLocale();
  const t = useTranslations('home.brands');
  const tp = useTranslations('product');

  const { data, isLoading } = useQuery({
    queryKey: ['products-top-brands-page'],
    queryFn: () => productsApi.topBrands().then((r) => r.data as { brands: TopBrandRow[] }),
  });

  const brands = (data?.brands ?? []).filter((b) => (b.logoUrl ?? '').trim().length > 0);

  return (
    <div className="container-tight section-padding pb-16">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={`/${locale}`}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{tp('collectionTitle')} — logos from brands we stock.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : brands.length === 0 ? (
        <p className="text-muted-foreground">No branded listings yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {brands.map((b) => {
            const name = locale === 'bn' ? b.nameBn : b.nameEn;
            return (
              <Link
                key={b.id}
                href={`/${locale}/products?brand=${encodeURIComponent(b.slug)}`}
                className={cn(
                  'group flex flex-col items-center rounded-xl border border-border bg-card p-4 text-center shadow-sm transition-colors',
                  'hover:border-primary/40 hover:shadow-soft-md',
                )}
              >
                <div className="mb-3 flex h-16 w-full items-center justify-center overflow-hidden rounded-lg bg-white dark:bg-white">
                  <BrandLogoThumb logoUrl={b.logoUrl} initialsSource={name} className="max-h-full max-w-full" />
                </div>
                <span className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-primary">{name}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
