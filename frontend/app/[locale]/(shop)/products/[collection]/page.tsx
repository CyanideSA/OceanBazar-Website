'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
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

type CollectionKey =
  | 'featured'
  | 'top-trending'
  | 'latest'
  | 'best-seller'
  | 'most-sold'
  | 'beauty'
  | 'gadgets'
  | 'home'
  | 'kids'
  | 'more-for-you';

function getCollectionConfig(key: string): { titleKey: string; sort?: string } {
  switch (key as CollectionKey) {
    case 'featured':     return { titleKey: 'featured' };
    case 'top-trending': return { titleKey: 'topTrending' };
    case 'latest':       return { titleKey: 'latest', sort: 'createdAt_desc' };
    case 'best-seller':  return { titleKey: 'bestSeller' };
    case 'most-sold':    return { titleKey: 'mostSold' };
    case 'beauty':       return { titleKey: 'beauty' };
    case 'gadgets':      return { titleKey: 'gadgets' };
    case 'home':         return { titleKey: 'home' };
    case 'kids':         return { titleKey: 'kids' };
    case 'more-for-you': return { titleKey: 'moreForYou' };
    default:             return { titleKey: 'collectionTitle', sort: 'createdAt_desc' };
  }
}

export default function ProductCollectionPage() {
  const tc = useTranslations('common');
  const tp = useTranslations('product');
  const locale = useLocale();
  const params = useParams();
  const searchParams = useSearchParams();

  const collection = String(params.collection || '').trim();
  const config = useMemo(() => getCollectionConfig(collection), [collection]);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') ?? '');
  const [sort, setSort] = useState(config.sort ?? 'createdAt_desc');

  const { data: catData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list().then((r) => r.data as CategoriesListResponse),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['products-collection', collection, page, search, selectedCategory, sort, locale],
    queryFn: () =>
      productsApi
        .list({ page, collection, search, category: selectedCategory, sort, lang: locale, limit: 24 })
        .then((r) => r.data as ProductsListResponse),
    placeholderData: keepPreviousData,
  });

  const products: Product[] = data?.products ?? [];
  const categories: Category[] = catData?.categories ?? [];
  const pagination = data?.pagination;
  const pageCount = pagination?.pages ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5 sm:mb-6">
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">{tp(config.titleKey as Parameters<typeof tp>[0])}</h1>
        <p className="text-sm text-muted-foreground">{pagination?.total ?? 0} {tp('results')}</p>
      </div>

      <div className="flex gap-6 lg:gap-8">
        <aside className="hidden lg:block w-56 flex-shrink-0 space-y-6">
          <div>
            <h3 className="font-semibold text-foreground mb-3">{tc('categories')}</h3>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedCategory('')}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                  !selectedCategory ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                {tc('all')}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                    selectedCategory === cat.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {locale === 'bn' ? cat.nameBn : cat.nameEn}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Mobile category select — visible only below lg */}
          {categories.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
              className="mb-3 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 lg:hidden"
            >
              <option value="">{tc('all')}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {locale === 'bn' ? cat.nameBn : cat.nameEn}
                </option>
              ))}
            </select>
          )}
          <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:mb-6">
            <input
              type="search"
              placeholder={tc('search') + '...'}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="flex-1 border border-border bg-background text-foreground rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground min-h-[44px]"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="border border-border bg-background text-foreground rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[44px]"
            >
              <option value="createdAt_desc">{tc('sortNewest')}</option>
              <option value="price_asc">{tc('sortPriceLow')}</option>
              <option value="price_desc">{tc('sortPriceHigh')}</option>
            </select>
          </div>

          {isLoading ? (
            <ProductGridSkeleton count={12} />
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {pageCount > 1 && (
                <div className="flex flex-wrap items-center justify-center gap-2 mt-6 sm:mt-8">
                  {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                        p === page ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground hover:bg-accent'
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
