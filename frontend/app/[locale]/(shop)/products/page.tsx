import ProductsPageClient from '@/components/product/ProductsPageClient';
import type { FiltersData } from '@/components/product/ProductFilterSidebar';
import {
  fetchProductList,
  fetchStorefrontJson,
  STOREFRONT_API_URL,
} from '@/lib/fetchStorefrontCatalog';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? '';
  return v ?? '';
}

export default async function ProductsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const search = (first(sp.search) || first(sp.q)).trim();
  const category = first(sp.category).trim();
  const brand = first(sp.brand).trim();

  const [initialData, initialFiltersData] = await Promise.all([
    fetchProductList({
      locale,
      page: 1,
      limit: 24,
      search: search || undefined,
      category: category || undefined,
      brands: brand || undefined,
      sort: 'createdAt_desc',
    }),
    fetchStorefrontJson<FiltersData>(`${STOREFRONT_API_URL}/api/products/filters?lang=${encodeURIComponent(locale)}`),
  ]);


  return (
    <ProductsPageClient
      initialData={initialData}
      initialFiltersData={initialFiltersData}
    />
  );
}
