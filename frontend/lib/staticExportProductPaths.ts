import { shouldSkipLoopbackBffDuringBuild } from '@/lib/shouldSkipLoopbackBffDuringBuild';
import { STATIC_EXPORT_PLACEHOLDER_ID } from '@/lib/staticExportDummyParams';

/** Product IDs/slugs for static export (S3). Requires reachable BFF unless skipping. */
export async function fetchProductPathsForStaticExport(): Promise<{ id: string }[]> {
  if (process.env.NEXT_STATIC_EXPORT !== '1') return [];
  if (shouldSkipLoopbackBffDuringBuild()) {
    return [{ id: STATIC_EXPORT_PLACEHOLDER_ID }];
  }

  const api = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (!api) {
    return [{ id: STATIC_EXPORT_PLACEHOLDER_ID }];
  }

  const ids: string[] = [];
  let page = 1;
  while (page <= 100) {
    try {
      const res = await fetch(`${api}/api/products?limit=100&page=${page}&sort=updatedAt_desc`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) break;
      const data = (await res.json()) as { products?: Array<{ id?: string; slug?: string }> };
      const products = data.products ?? [];
      if (products.length === 0) break;
      for (const p of products) {
        const key = p.slug || p.id;
        if (key) ids.push(String(key));
      }
      if (products.length < 100) break;
      page += 1;
    } catch {
      break;
    }
  }

  const paths = [...new Set(ids)].map((id) => ({ id }));
  if (paths.length === 0) {
    return [{ id: STATIC_EXPORT_PLACEHOLDER_ID }];
  }
  return paths;
}
