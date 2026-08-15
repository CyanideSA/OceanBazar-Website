import { shouldSkipLoopbackBffDuringBuild } from '@/lib/shouldSkipLoopbackBffDuringBuild';
import type { FlashActivePayload, FlashPagePayload, FlashSaleMeta } from '@/lib/flashDeals';
import type { Category, Product } from '@/types';

export const STOREFRONT_API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(
  /\/$/,
  ''
);

export function shouldSkipBuildFetch() {
  return shouldSkipLoopbackBffDuringBuild();
}

export type ProductsListPayload = {
  products: Product[];
  pagination?: { total?: number; page?: number; limit?: number; pages?: number };
};

export type CategoriesPayload = {
  categories: Category[];
};

export async function fetchStorefrontJson<T>(url: string, revalidate = 60): Promise<T | null> {
  if (shouldSkipLoopbackBffDuringBuild()) return null;
  try {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export type ProductListQuery = {
  locale: string;
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  brands?: string;
  collection?: string;
  trustBadge?: string;
  sort?: string;
  minPrice?: string;
  maxPrice?: string;
  rating?: string;
};

export async function fetchProductList(query: ProductListQuery): Promise<ProductsListPayload> {
  const params = new URLSearchParams();
  params.set('lang', query.locale);
  params.set('page', String(query.page ?? 1));
  params.set('limit', String(query.limit ?? 24));
  if (query.search) params.set('search', query.search);
  if (query.category) params.set('category', query.category);
  if (query.brands) params.set('brands', query.brands);
  if (query.collection) params.set('collection', query.collection);
  if (query.trustBadge) params.set('trustBadge', query.trustBadge);
  if (query.sort) params.set('sort', query.sort);
  if (query.minPrice) params.set('minPrice', query.minPrice);
  if (query.maxPrice) params.set('maxPrice', query.maxPrice);
  if (query.rating) params.set('rating', query.rating);

  const data = await fetchStorefrontJson<ProductsListPayload>(
    `${STOREFRONT_API_URL}/api/products?${params.toString()}`
  );
  return {
    products: Array.isArray(data?.products) ? data.products : [],
    pagination: data?.pagination,
  };
}

export async function fetchCategoriesList(): Promise<Category[]> {
  const data = await fetchStorefrontJson<CategoriesPayload | Category[]>(
    `${STOREFRONT_API_URL}/api/categories`
  );
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.categories) ? data.categories : [];
}

/** Public site settings used by footer, contact, and business pages. */
export type StorefrontPublicSettings = {
  heroSlides?: unknown[];
  testimonials?: unknown[];
  trustBadges?: unknown[];
  storefrontPopups?: unknown[];
  appDownload?: {
    enabled?: boolean;
    androidUrl?: string;
    iosUrl?: string;
    windowsUrl?: string;
    macUrl?: string;
    bannerText?: string;
    animation?: string;
  };
  defaultHeroAnimation?: string;
  featuredProductIds?: string[];
  bestDealsProductIds?: string[];
  newArrivalsProductIds?: string[];
  defaultBannerRotationMs?: number;
  testimonialCarouselMs?: number;
  supportEmail?: string;
  supportPhone?: string;
  contactAddress?: string;
  businessInquiryEmail?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  youtubeUrl?: string;
  threadsUrl?: string;
  logoDarkUrl?: string;
  logoLightUrl?: string;
  faviconUrl?: string;
  legalName?: string;
  tradeLicenseNo?: string;
  tinNumber?: string;
  registeredAddress?: string;
  managementDetails?: string;
  companyVision?: string;
  leadershipIntro?: string;
  leadershipTeam?: Array<{
    name?: string;
    title?: string;
    bio?: string;
    email?: string;
    phone?: string;
  }>;
  /** Editable page copy from Admin > Global Settings */
  pageContent?: import('./pageContent').PageContentBlob;
};

export async function fetchStorefrontSettings(): Promise<StorefrontPublicSettings> {
  const data = await fetchStorefrontJson<StorefrontPublicSettings>(
    `${STOREFRONT_API_URL}/api/storefront/settings`,
    60
  );
  return data && typeof data === 'object' ? data : {};
}

export async function fetchFlashDealsPage(locale: string, saleId?: string | null): Promise<FlashPagePayload | null> {
  const qs = new URLSearchParams({ lang: locale });
  if (saleId) qs.set('sale', saleId);
  return fetchStorefrontJson<FlashPagePayload>(
    `${STOREFRONT_API_URL}/api/flash-sales/page?${qs.toString()}`,
    30
  );
}

/** Active flash sale for the sticky mini-bar (SSR so old phones see it before hydration). */
export async function fetchActiveFlashSaleMeta(locale: string): Promise<FlashSaleMeta | null> {
  const data = await fetchStorefrontJson<FlashActivePayload>(
    `${STOREFRONT_API_URL}/api/flash-sales/active?lang=${encodeURIComponent(locale)}`,
    30
  );
  const sale = data?.sale ?? data?.campaigns?.[0]?.sale ?? null;
  if (!sale?.id || !sale?.ends_at) return null;
  if (new Date(sale.ends_at).getTime() <= Date.now()) return null;
  return sale;
}
