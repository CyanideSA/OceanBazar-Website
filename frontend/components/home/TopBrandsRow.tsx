'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import BrandLogoThumb from '@/components/home/BrandLogoThumb';

type TopBrandRow = {
  id: string;
  slug: string;
  nameEn: string;
  nameBn: string;
  logoUrl: string | null;
};

const HOME_BRAND_COUNT = 8;

export default function TopBrandsRow({ initialBrands }: { initialBrands?: TopBrandRow[] }) {
  const locale = useLocale();
  const t = useTranslations('home.brands');

  const { data, isLoading } = useQuery({
    queryKey: ['products-top-brands'],
    queryFn: () => productsApi.topBrands().then((r) => r.data as { brands: TopBrandRow[] }),
    staleTime: 5 * 60_000,
    initialData: initialBrands?.length ? { brands: initialBrands } : undefined,
  });

  const displayed = (data?.brands ?? initialBrands ?? []).slice(0, HOME_BRAND_COUNT);

  if (!isLoading && displayed.length < 1) return null;

  return (
    <section className="section-padding border-y border-border/40 bg-muted/10">
      <div className="container-tight">
        <h2 className="mb-3 text-lg font-bold tracking-tight text-foreground sm:mb-4 sm:text-2xl">
          {t('title')}
        </h2>

        <div className="flex min-h-[4.5rem] flex-row items-center gap-2 sm:min-h-[5rem] sm:gap-3">
          <div className="grid min-w-0 flex-1 grid-cols-8 gap-1 sm:gap-2">
            {isLoading
              ? Array.from({ length: HOME_BRAND_COUNT }).map((_, i) => (
                  <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted sm:rounded-xl" />
                ))
              : displayed.map((b) => {
                  const name = locale === 'bn' ? b.nameBn : b.nameEn;
                  return (
                    <Link
                      key={b.id}
                      href={`/${locale}/products?brand=${encodeURIComponent(b.slug)}`}
                      className={cn(
                        'group flex aspect-square min-h-0 flex-col items-stretch overflow-hidden rounded-lg border border-border/50 bg-card p-1 shadow-sm sm:rounded-xl sm:p-1.5',
                        'transition-all hover:border-primary/35 hover:shadow-soft-md',
                      )}
                      title={name}
                    >
                      <div className="flex min-h-0 flex-1 items-center justify-center rounded-md bg-white dark:bg-white">
                        <BrandLogoThumb logoUrl={b.logoUrl} initialsSource={name} />
                      </div>
                    </Link>
                  );
                })}
          </div>

          <Link
            href={`/${locale}/products/top-brands`}
            className={cn(
              'inline-flex shrink-0 items-center justify-center self-center rounded-md border border-border/70 bg-card px-2 py-1',
              'text-[10px] font-semibold uppercase tracking-wide text-primary shadow-sm',
              'transition-colors hover:bg-accent hover:text-primary sm:px-2.5 sm:py-1.5 sm:text-xs sm:normal-case sm:tracking-normal',
            )}
          >
            {t('viewAll')}
          </Link>
        </div>
      </div>
    </section>
  );
}
