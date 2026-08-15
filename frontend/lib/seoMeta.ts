/**
 * Fetches AI/admin-managed SEO metadata for a storefront entity from the BFF
 * (`GET /api/seo/:entityType/:entityId`). Returns null when none exists, so
 * pages can fall back to their default metadata.
 */
import { shouldSkipLoopbackBffDuringBuild } from '@/lib/shouldSkipLoopbackBffDuringBuild';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface SeoMeta {
  metaTitle: string | null;
  metaDescription: string | null;
  keywords: string[];
  canonicalUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  schemaJson: Record<string, unknown> | null;
  faq: Array<{ question: string; answer: string }> | null;
  faqJsonLd: Record<string, unknown> | null;
  contentBlocks: unknown;
  seoScore: number | null;
}

export async function fetchSeoMeta(
  entityType: 'product' | 'category' | 'brand' | 'page',
  entityId: string,
  locale = 'en'
): Promise<SeoMeta | null> {
  if (shouldSkipLoopbackBffDuringBuild()) return null;
  try {
    const res = await fetch(
      `${API_URL}/api/seo/${entityType}/${encodeURIComponent(entityId)}?locale=${locale}`,
      { next: { revalidate: 600 }, signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    return (await res.json()) as SeoMeta;
  } catch {
    return null;
  }
}
