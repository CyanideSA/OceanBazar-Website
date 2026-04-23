import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://oceanbazar.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages = ['', '/products', '/wholesale', '/auth/login', '/auth/register'];

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of ['en', 'bn']) {
    for (const page of staticPages) {
      entries.push({
        url: `${BASE_URL}/${locale}${page}`,
        lastModified: new Date(),
        changeFrequency: page === '' ? 'daily' : 'weekly',
        priority: page === '' ? 1.0 : 0.8,
      });
    }
  }

  // Fetch products for dynamic sitemap
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/products?limit=100`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      for (const product of data.products ?? []) {
        for (const locale of ['en', 'bn']) {
          entries.push({
            url: `${BASE_URL}/${locale}/product/${product.id}`,
            lastModified: new Date(product.updatedAt ?? product.createdAt),
            changeFrequency: 'weekly',
            priority: 0.7,
          });
        }
      }
    }
  } catch {
    // ignore
  }

  return entries;
}
