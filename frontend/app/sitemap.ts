import type { MetadataRoute } from 'next';
import { shouldSkipLoopbackBffDuringBuild } from '@/lib/shouldSkipLoopbackBffDuringBuild';

export const dynamic = 'force-static';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://oceanbazar.com';
const LOCALES = ['en', 'bn'];

async function safeFetch(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages = [
    { path: '',              priority: 1.0, freq: 'daily' as const },
    { path: '/products',     priority: 0.9, freq: 'daily' as const },
    { path: '/wholesale',    priority: 0.8, freq: 'weekly' as const },
    { path: '/auth/login',   priority: 0.5, freq: 'monthly' as const },
    { path: '/auth/register',priority: 0.5, freq: 'monthly' as const },
    { path: '/returns',      priority: 0.4, freq: 'monthly' as const },
    { path: '/tickets',      priority: 0.4, freq: 'monthly' as const },
    { path: '/compare',      priority: 0.4, freq: 'monthly' as const },
  ];

  const entries: MetadataRoute.Sitemap = [];
  const apiBase = process.env.NEXT_PUBLIC_API_URL;

  for (const locale of LOCALES) {
    for (const { path, priority, freq } of staticPages) {
      entries.push({ url: `${BASE_URL}/${locale}${path}`, lastModified: new Date(), changeFrequency: freq, priority });
    }
  }

  // Avoid hammering localhost during `next build` when BFF is not running
  if (!apiBase || shouldSkipLoopbackBffDuringBuild()) return entries;

  // All products — paginate until exhausted (bounded for runtime safety)
  try {
    let page = 1;
    let hasMore = true;
    while (hasMore && page <= 100) {
      const data = await safeFetch(`${apiBase}/api/products?limit=100&page=${page}&sort=updatedAt_desc`);
      const products: any[] = data?.products ?? [];
      if (products.length === 0) { hasMore = false; break; }
      for (const p of products) {
        for (const locale of LOCALES) {
          entries.push({
            url: `${BASE_URL}/${locale}/product/${p.slug || p.id}`,
            lastModified: new Date(p.updatedAt ?? p.createdAt ?? Date.now()),
            changeFrequency: 'weekly',
            priority: p.isBestSeller ? 0.9 : p.isFeatured ? 0.85 : 0.7,
          });
        }
      }
      hasMore = products.length === 100;
      page++;
    }
  } catch { /* ignore */ }

  // Categories
  try {
    const catData = await safeFetch(`${apiBase}/api/categories`);
    const categories: any[] = catData?.categories ?? catData ?? [];
    for (const cat of categories) {
      for (const locale of LOCALES) {
        entries.push({
          url: `${BASE_URL}/${locale}/products?category=${cat.id}`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.75,
        });
      }
    }
  } catch { /* ignore */ }

  // Brands
  try {
    const brandData = await safeFetch(`${apiBase}/api/brands`);
    const brands: any[] = brandData?.brands ?? brandData ?? [];
    for (const brand of brands) {
      for (const locale of LOCALES) {
        entries.push({
          url: `${BASE_URL}/${locale}/products?brand=${brand.slug || brand.id}`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.7,
        });
      }
    }
  } catch { /* ignore */ }

  return entries;
}
