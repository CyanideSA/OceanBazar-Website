import ProductCollectionPageClient from '@/components/product/ProductCollectionPageClient';
import { fetchCategoriesList, fetchProductList } from '@/lib/fetchStorefrontCatalog';

type Props = {
  params: Promise<{ locale: string; collection: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? '';
  return v ?? '';
}

function defaultSort(collection: string): string {
  if (collection === 'latest') return 'createdAt_desc';
  return 'createdAt_desc';
}

export default async function ProductCollectionPage({ params, searchParams }: Props) {
  const { locale, collection } = await params;
  const sp = await searchParams;
  const category = first(sp.category).trim();
  const sort = defaultSort(collection);

  const [initialData, initialCategories] = await Promise.all([
    fetchProductList({
      locale,
      page: 1,
      limit: 24,
      collection,
      category: category || undefined,
      sort,
    }),
    fetchCategoriesList(),
  ]);


  return (
    <ProductCollectionPageClient
      collection={collection}
      initialData={initialData}
      initialCategories={initialCategories}
    />
  );
}
