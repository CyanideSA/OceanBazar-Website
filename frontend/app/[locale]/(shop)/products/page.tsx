'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Filter, SlidersHorizontal, Package } from 'lucide-react';
import { productsApi, categoriesApi } from '@/lib/api';
import ProductCard from '@/components/product/ProductCard';
import { ProductGridSkeleton } from '@/components/shared/Skeleton';
import type { Product, Category } from '@/types';

type ProductsListResponse = {
  products: Product[];
  pagination?: { total?: number; page?: number; limit?: number; pages?: number };
};

type CategoriesListResponse = {
  categories: Category[];
};

export default function ProductsPage() {
  const t = useTranslations('product');
  const tc = useTranslations('common');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') ?? '');
  const [sort, setSort] = useState('createdAt_desc');

  const { data: catData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list().then((r) => r.data as CategoriesListResponse),
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['products', page, search, selectedCategory, sort, locale],
    queryFn: () =>
      productsApi
        .list({ page, search, category: selectedCategory, sort, lang: locale, limit: 24 })
        .then((r) => r.data as ProductsListResponse),
    placeholderData: keepPreviousData,
  });

  const products: Product[] = data?.products ?? [];
  const categories: Category[] = catData?.categories ?? [];
  const pagination = data?.pagination;
  const pageCount = pagination?.pages ?? 0;

  return (
    <div className="container-tight py-5 sm:py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 sm:mb-6">
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">{t('pageTitle')}</h1>
        <p className="text-sm text-muted-foreground">{pagination?.total ?? 0} {t('results')}</p>
      </div>

      <div className="flex gap-6 lg:gap-8">
        {/* Sidebar filters */}
        <aside className="hidden lg:block w-56 flex-shrink-0 space-y-6">
          <div>
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Filter className="h-4 w-4" /> {t('categories')}
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedCategory('')}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                  !selectedCategory
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {t('allCategories')}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  {locale === 'bn' ? cat.nameBn : cat.nameEn}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Mobile category select */}
          {categories.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
              className="mb-3 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 lg:hidden"
            >
              <option value="">{t('allCategories')}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {locale === 'bn' ? cat.nameBn : cat.nameEn}
                </option>
              ))}
            </select>
          )}
          {/* Search + Sort bar */}
          <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:mb-6">
            <input
              type="search"
              placeholder={tc('search') + '...'}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[44px]"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[44px]"
            >
              <option value="createdAt_desc">{t('sortNewest')}</option>
              <option value="price_asc">{t('sortPriceLow')}</option>
              <option value="price_desc">{t('sortPriceHigh')}</option>
            </select>
          </div>

          {/* Product grid */}
          {isLoading ? (
            <ProductGridSkeleton count={12} />
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
              <Package className="h-10 w-10 text-muted-foreground/30" />
              <p className="font-semibold text-foreground">{tc('error')}</p>
              <p className="text-sm text-muted-foreground">{tc('retry')}</p>
            </div>
          ) : (
            <>
              {products.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
                  <Package className="h-10 w-10 text-muted-foreground/30" />
                  <p className="font-semibold text-foreground">{t('noResults') }</p>
                  <button
                    type="button"
                    onClick={() => { setSearch(''); setSelectedCategory(''); setPage(1); }}
                    className="mt-1 text-sm font-semibold text-primary hover:underline"
                  >
                    {tc('clearFilters')}
                  </button>
                </div>
              ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              )}

              {/* Pagination */}
              {pageCount > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                        p === page
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border bg-background text-foreground hover:bg-accent'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
