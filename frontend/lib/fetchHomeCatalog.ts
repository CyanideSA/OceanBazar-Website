import type { FlashActivePayload, FlashCampaign } from '@/lib/flashDeals';
import type { Category, Product } from '@/types';
import {
  fetchCategoriesList,
  fetchStorefrontJson,
  STOREFRONT_API_URL,
  shouldSkipBuildFetch,
} from '@/lib/fetchStorefrontCatalog';

const GRID_SIZE = 12;

export type HomeSectionKey = 'featured' | 'trending' | 'bestRated' | 'mostSold';

const SECTION_COLLECTIONS: Record<HomeSectionKey, string> = {
  featured: 'featured',
  trending: 'top-trending',
  bestRated: 'best-rated',
  mostSold: 'most-sold',
};

export type HomeSectionPayload = {
  products: Product[];
};

export type HomeTopBrand = {
  id: string;
  slug: string;
  nameEn: string;
  nameBn: string;
  logoUrl: string | null;
};

export type HomeCatalog = {
  sections: Partial<Record<HomeSectionKey, HomeSectionPayload>>;
  flashCampaigns: FlashCampaign[];
  categories: Category[];
  brands: HomeTopBrand[];
  /** Prefetched for old Safari / no-JS so the first hero paint is in HTML */
  heroSlides: Array<Record<string, unknown>>;
  defaultBannerRotationMs: number;
};

/**
 * Prefetch homepage product grids on the server so old Safari / no-JS clients
 * still receive real product cards in the initial HTML (Next 15 client bundles
 * target Safari 16.4+ by default and can fail to parse on older iPhones).
 */
export async function fetchHomeCatalog(locale: string): Promise<HomeCatalog> {
  if (shouldSkipBuildFetch()) {
    return {
      sections: {},
      flashCampaigns: [],
      categories: [],
      brands: [],
      heroSlides: [],
      defaultBannerRotationMs: 6000,
    };
  }

  const keys = Object.keys(SECTION_COLLECTIONS) as HomeSectionKey[];
  const [sectionResults, flash, categories, brandsPayload, settings] = await Promise.all([
    Promise.all(
      keys.map(async (key) => {
        const collection = SECTION_COLLECTIONS[key];
        const data = await fetchStorefrontJson<{ products?: Product[] }>(
          `${STOREFRONT_API_URL}/api/products?limit=${GRID_SIZE}&lang=${encodeURIComponent(locale)}&collection=${encodeURIComponent(collection)}`
        );
        const products = Array.isArray(data?.products) ? data.products : [];
        return [key, { products }] as const;
      })
    ),
    fetchStorefrontJson<FlashActivePayload>(
      `${STOREFRONT_API_URL}/api/flash-sales/active?lang=${encodeURIComponent(locale)}`
    ),
    fetchCategoriesList(),
    fetchStorefrontJson<{ brands?: HomeTopBrand[] }>(`${STOREFRONT_API_URL}/api/products/top-brands`),
    fetchStorefrontJson<{
      heroSlides?: Array<Record<string, unknown>>;
      defaultBannerRotationMs?: number;
    }>(`${STOREFRONT_API_URL}/api/storefront/settings`),
  ]);

  const flashCampaigns = (flash?.campaigns ?? []).filter((c) => (c.products?.length ?? 0) > 0);

  return {
    sections: Object.fromEntries(sectionResults),
    flashCampaigns,
    categories,
    brands: Array.isArray(brandsPayload?.brands) ? brandsPayload.brands : [],
    heroSlides: Array.isArray(settings?.heroSlides) ? settings.heroSlides : [],
    defaultBannerRotationMs: Number(settings?.defaultBannerRotationMs) || 6000,
  };
}
