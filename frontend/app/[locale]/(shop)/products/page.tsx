'use client';

import { Suspense, useState, useCallback, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { SlidersHorizontal, Package, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { productsApi } from '@/lib/api';
import ProductCard from '@/components/product/ProductCard';
import { ProductGridSkeleton } from '@/components/shared/Skeleton';
import ProductFilterSidebar, {
  type FiltersData,
  type ActiveFilters,
} from '@/components/product/ProductFilterSidebar';
import type { Product } from '@/types';

type ProductsListResponse = {
  products: Product[];
  pagination?: { total?: number; page?: number; limit?: number; pages?: number };
};

function ProductsPageInner() {
  const t = useTranslations('product');
  const tc = useTranslations('common');
  const locale = useLocale();
  const searchParams = useSearchParams();

  // ─── Filter state ──────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('createdAt_desc');
  const [mobileOpen, setMobileOpen] = useState(false);

  const [filters, setFilters] = useState<ActiveFilters>({
    category: searchParams.get('category') ?? '',
    brands: searchParams.get('brand') ? [searchParams.get('brand')!] : [],
    minPrice: null,
    maxPrice: null,
    rating: null,
    collection: '',
  });

  // Sync URL searchParams → filter state (e.g. when clicking a subcategory link from mega menu)
  useEffect(() => {
    const urlCategory = searchParams.get('category') ?? '';
    const urlBrand = searchParams.get('brand') ?? '';
    setFilters((prev) => ({
      ...prev,
      category: urlCategory,
      brands: urlBrand ? [urlBrand] : prev.brands.length > 0 && !urlBrand ? prev.brands : [],
    }));
    setPage(1);
  }, [searchParams]);

  // Fetch filter metadata from DB
  const { data: filtersData } = useQuery({
    queryKey: ['product-filters', locale],
    queryFn: () => productsApi.filters(locale).then((r) => r.data as FiltersData),
    staleTime: 5 * 60 * 1000,
  });

  // Handle filter changes — reset page to 1
  const handleFilterChange = useCallback((next: Partial<ActiveFilters>) => {
    setFilters((prev) => ({ ...prev, ...next }));
    setPage(1);
  }, []);

  // Build API params from active filters
  const apiParams = {
    page,
    search: search || undefined,
    category: filters.category || undefined,
    brands: filters.brands.length > 0 ? filters.brands.join(',') : undefined,
    minPrice: filters.minPrice ?? undefined,
    maxPrice: filters.maxPrice ?? undefined,
    rating: filters.rating ?? undefined,
    collection: filters.collection || undefined,
    sort,
    lang: locale,
    limit: 24,
  };

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['products', apiParams],
    queryFn: () =>
      productsApi.list(apiParams).then((r) => r.data as ProductsListResponse),
    placeholderData: keepPreviousData,
  });

  const products: Product[] = data?.products ?? [];
  const pagination = data?.pagination;
  const pageCount = pagination?.pages ?? 0;

  // Count active filters for badge
  const activeCount =
    (filters.category ? 1 : 0) +
    filters.brands.length +
    (filters.minPrice !== null || filters.maxPrice !== null ? 1 : 0) +
    (filters.rating !== null ? 1 : 0) +
    (filters.collection ? 1 : 0);

  const clearAll = () => {
    setFilters({ category: '', brands: [], minPrice: null, maxPrice: null, rating: null, collection: '' });
    setSearch('');
    setPage(1);
  };

  // Close mobile drawer on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Pagination helpers
  const maxVisiblePages = 5;
  const paginationStart = Math.max(1, page - Math.floor(maxVisiblePages / 2));
  const paginationEnd = Math.min(pageCount, paginationStart + maxVisiblePages - 1);
  const visiblePages = Array.from({ length: paginationEnd - paginationStart + 1 }, (_, i) => paginationStart + i);

  return (
    <div className="container-tight relative py-5 sm:py-8">
      {isFetching && !isLoading && (
        <div
          className="pointer-events-none absolute left-0 right-0 top-0 z-10 h-0.5 rounded-full bg-primary/30 animate-pulse"
          aria-hidden
        />
      )}
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 sm:mb-6">
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">{t('pageTitle')}</h1>
        <p className="text-sm text-muted-foreground">
          {pagination?.total ?? 0} {t('results')}
        </p>
      </div>

      <div className="flex gap-6 lg:gap-8">
        {/* ─── Desktop Sidebar ───────────────────────────────────────────────── */}
        <aside className="hidden lg:block w-56 flex-shrink-0">
          <ProductFilterSidebar
            filters={filtersData ?? null}
            active={filters}
            onChange={handleFilterChange}
          />
        </aside>

        {/* ─── Main Content ──────────────────────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          {/* Search + Sort + Mobile filter toggle */}
          <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:mb-6">
            {/* Mobile filter button */}
            <button
              onClick={() => setMobileOpen(true)}
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors min-h-[44px] lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeCount > 0 && (
                <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {activeCount}
                </span>
              )}
            </button>

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

          {/* Active filter chips */}
          {activeCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {filters.category && filtersData && (
                <FilterChip
                  label={findCategoryName(filtersData.categories, filters.category, locale)}
                  onRemove={() => handleFilterChange({ category: '' })}
                />
              )}
              {filters.brands.map((bId) => (
                <FilterChip
                  key={bId}
                  label={filtersData?.brands.find((b) => b.id === bId)?.[locale === 'bn' ? 'nameBn' : 'nameEn'] ?? bId}
                  onRemove={() => handleFilterChange({ brands: filters.brands.filter((b) => b !== bId) })}
                />
              ))}
              {(filters.minPrice !== null || filters.maxPrice !== null) && (
                <FilterChip
                  label={`৳${filters.minPrice ?? 0} – ৳${filters.maxPrice ?? '∞'}`}
                  onRemove={() => handleFilterChange({ minPrice: null, maxPrice: null })}
                />
              )}
              {filters.rating !== null && (
                <FilterChip
                  label={`${filters.rating}★ & Up`}
                  onRemove={() => handleFilterChange({ rating: null })}
                />
              )}
              {filters.collection && (
                <FilterChip
                  label={filtersData?.collections.find((c) => c.key === filters.collection)?.[locale === 'bn' ? 'labelBn' : 'labelEn'] ?? filters.collection}
                  onRemove={() => handleFilterChange({ collection: '' })}
                />
              )}
              <button
                onClick={clearAll}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {tc('clearFilters')}
              </button>
            </div>
          )}

          {/* Product grid */}
          {isLoading ? (
            <ProductGridSkeleton count={12} />
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
              <Package className="h-10 w-10 text-muted-foreground/30" />
              <p className="font-semibold text-foreground">{tc('error')}</p>
              <p className="text-sm text-muted-foreground">{tc('retry')}</p>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
              <Package className="h-10 w-10 text-muted-foreground/30" />
              <p className="font-semibold text-foreground">{t('noResults')}</p>
              <button type="button" onClick={clearAll} className="mt-1 text-sm font-semibold text-primary hover:underline">
                {tc('clearFilters')}
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* Pagination */}
              {pageCount > 1 && (
                <div className="flex items-center justify-center gap-1.5 mt-8">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {paginationStart > 1 && (
                    <>
                      <PageBtn n={1} current={page} onSelect={setPage} />
                      {paginationStart > 2 && <span className="px-1 text-muted-foreground">...</span>}
                    </>
                  )}
                  {visiblePages.map((p) => (
                    <PageBtn key={p} n={p} current={page} onSelect={setPage} />
                  ))}
                  {paginationEnd < pageCount && (
                    <>
                      {paginationEnd < pageCount - 1 && <span className="px-1 text-muted-foreground">...</span>}
                      <PageBtn n={pageCount} current={page} onSelect={setPage} />
                    </>
                  )}
                  <button
                    disabled={page >= pageCount}
                    onClick={() => setPage(page + 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ─── Mobile Filter Drawer ──────────────────────────────────────────── */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 z-50 w-[300px] max-w-[85vw] bg-background shadow-xl overflow-y-auto lg:hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-base font-bold text-foreground">Filters</h2>
              <button onClick={() => setMobileOpen(false)} className="p-1 rounded-lg hover:bg-accent">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-4">
              <ProductFilterSidebar
                filters={filtersData ?? null}
                active={filters}
                onChange={(next) => { handleFilterChange(next); }}
              />
            </div>
            <div className="sticky bottom-0 border-t border-border bg-background p-4 flex gap-2">
              <button
                onClick={() => { clearAll(); setMobileOpen(false); }}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={() => setMobileOpen(false)}
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Show Results
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<ProductGridSkeleton />}>
      <ProductsPageInner />
    </Suspense>
  );
}

// ─── Small helper components ────────────────────────────────────────────────

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
      {label}
      <button onClick={onRemove} className="ml-0.5 hover:text-primary/70">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function PageBtn({ n, current, onSelect }: { n: number; current: number; onSelect: (p: number) => void }) {
  return (
    <button
      onClick={() => onSelect(n)}
      className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
        n === current
          ? 'bg-primary text-primary-foreground'
          : 'border border-border bg-background text-foreground hover:bg-accent'
      }`}
    >
      {n}
    </button>
  );
}

function findCategoryName(
  categories: Array<{ id: string; nameEn: string; nameBn: string; children?: Array<{ id: string; nameEn: string; nameBn: string }> }>,
  id: string,
  locale: string,
): string {
  for (const cat of categories) {
    if (cat.id === id) return locale === 'bn' ? cat.nameBn : cat.nameEn;
    if (cat.children) {
      for (const child of cat.children) {
        if (child.id === id) return locale === 'bn' ? child.nameBn : child.nameEn;
      }
    }
  }
  return id;
}
