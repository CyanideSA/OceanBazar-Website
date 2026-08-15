import { prisma } from '../lib/prisma';

import { v4 as uuidv4 } from 'uuid';
import { generateSeo, isMlConfigured } from './mlClient';


export type SeoEntityType = 'product' | 'category' | 'brand' | 'page';

const CLIENT = (process.env.CLIENT_URL || 'https://oceanbazar.com.bd').replace(/\/$/, '');

export interface SeoMetadataInput {
  entityType: SeoEntityType;
  entityId: string;
  locale?: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  keywords?: string[];
  canonicalUrl?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  schemaJson?: unknown;
  faq?: unknown;
  contentBlocks?: unknown;
  internalLinks?: unknown;
  source?: string;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

export function computeSeoScore(meta: {
  metaTitle?: string | null;
  metaDescription?: string | null;
  keywords?: string[] | null;
  faq?: unknown;
  schemaJson?: unknown;
}): number {
  let score = 0;
  const title = meta.metaTitle?.trim() || '';
  const desc = meta.metaDescription?.trim() || '';
  if (title.length >= 30 && title.length <= 60) score += 30;
  else if (title) score += 15;
  if (desc.length >= 70 && desc.length <= 160) score += 30;
  else if (desc) score += 15;
  score += Math.min(20, (meta.keywords?.length || 0) * 2);
  if (Array.isArray(meta.faq) && meta.faq.length) score += 10;
  if (meta.schemaJson) score += 10;
  return Math.min(100, score);
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export async function getSeo(entityType: string, entityId: string, locale = 'en') {
  return prisma.seoMetadata.findUnique({
    where: { entityType_entityId_locale: { entityType, entityId, locale } },
  });
}

export async function listSeo(params: { entityType?: string; limit?: number; offset?: number }) {
  const where = params.entityType ? { entityType: params.entityType } : {};
  const [items, total] = await Promise.all([
    prisma.seoMetadata.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: Math.min(params.limit ?? 50, 200),
      skip: params.offset ?? 0,
    }),
    prisma.seoMetadata.count({ where }),
  ]);
  return { items, total };
}

export async function getOverview() {
  const [total, byType, lowScores, aiGenerated] = await Promise.all([
    prisma.seoMetadata.count(),
    prisma.seoMetadata.groupBy({ by: ['entityType'], _count: { _all: true } }),
    prisma.seoMetadata.count({ where: { seoScore: { lt: 60 } } }),
    prisma.seoMetadata.count({ where: { source: 'ai' } }),
  ]);
  const productTotal = await prisma.product.count();
  const categoryTotal = await prisma.category.count();
  return {
    total,
    byType: byType.map((b) => ({ entityType: b.entityType, count: b._count._all })),
    lowScores,
    aiGenerated,
    coverage: {
      products: productTotal,
      categories: categoryTotal,
    },
  };
}

// ─── Writes ────────────────────────────────────────────────────────────────

export async function upsertSeo(input: SeoMetadataInput) {
  const locale = input.locale || 'en';
  const score = computeSeoScore({
    metaTitle: input.metaTitle,
    metaDescription: input.metaDescription,
    keywords: input.keywords,
    faq: input.faq,
    schemaJson: input.schemaJson,
  });
  const data = {
    metaTitle: input.metaTitle ?? null,
    metaDescription: input.metaDescription ?? null,
    keywords: input.keywords ?? [],
    canonicalUrl: input.canonicalUrl ?? null,
    ogTitle: input.ogTitle ?? null,
    ogDescription: input.ogDescription ?? null,
    ogImage: input.ogImage ?? null,
    schemaJson: (input.schemaJson as object) ?? undefined,
    faq: (input.faq as object) ?? undefined,
    contentBlocks: (input.contentBlocks as object) ?? undefined,
    internalLinks: (input.internalLinks as object) ?? undefined,
    seoScore: score,
    source: input.source ?? 'manual',
  };
  return prisma.seoMetadata.upsert({
    where: { entityType_entityId_locale: { entityType: input.entityType, entityId: input.entityId, locale } },
    create: { id: uuidv4(), entityType: input.entityType, entityId: input.entityId, locale, ...data },
    update: data,
  });
}

// ─── Entity context loaders (name/description/url for generation) ─────────────

async function loadEntityContext(entityType: SeoEntityType, entityId: string, locale: string) {
  if (entityType === 'product') {
    const p = await prisma.product.findUnique({
      where: { id: entityId },
      select: { titleEn: true, titleBn: true, descriptionEn: true, descriptionBn: true, brand: true },
    });
    if (!p) return null;
    return {
      name: locale === 'bn' ? p.titleBn || p.titleEn : p.titleEn,
      description: locale === 'bn' ? p.descriptionBn || p.descriptionEn : p.descriptionEn,
      category: p.brand || undefined,
      canonicalUrl: `${CLIENT}/${locale}/product/${entityId}`,
    };
  }
  if (entityType === 'category') {
    const c = await prisma.category.findUnique({
      where: { id: entityId },
      select: { nameEn: true, nameBn: true, slug: true, description: true },
    });
    if (!c) return null;
    return {
      name: locale === 'bn' ? c.nameBn || c.nameEn : c.nameEn,
      description: c.description ?? undefined,
      canonicalUrl: `${CLIENT}/${locale}/category/${c.slug || entityId}`,
    };
  }
  if (entityType === 'brand') {
    const b = await prisma.brand.findUnique({ where: { id: entityId }, select: { nameEn: true, nameBn: true, slug: true } });
    if (!b) return null;
    return {
      name: locale === 'bn' ? b.nameBn || b.nameEn : b.nameEn,
      description: undefined,
      canonicalUrl: `${CLIENT}/${locale}/brand/${b.slug || entityId}`,
    };
  }
  return null;
}

// ─── AI / heuristic generation ────────────────────────────────────────────────

function heuristicSeo(entityType: SeoEntityType, ctx: { name: string; description?: string | null; category?: string | null; canonicalUrl?: string }) {
  const suffix = ' | OceanBazar Bangladesh';
  const baseTitle = `${ctx.name}${ctx.category ? ` - ${ctx.category}` : ''}`;
  const metaTitle = (baseTitle.length + suffix.length > 60 ? baseTitle.slice(0, 57 - suffix.length) + '…' : baseTitle) + suffix;
  const baseDesc = ctx.description || `Buy ${ctx.name} online in Bangladesh at the best price.`;
  const metaDescription = `${baseDesc} Fast delivery, secure payment & OB Points rewards on OceanBazar.`.slice(0, 160);
  const keywords = Array.from(new Set([
    ...ctx.name.toLowerCase().split(/\s+/).filter((w) => w.length > 2),
    'oceanbazar', 'bangladesh', 'online shopping', 'buy online',
  ])).slice(0, 12);
  const faq = [
    { question: `Is ${ctx.name} available for delivery across Bangladesh?`, answer: `Yes. OceanBazar delivers ${ctx.name} nationwide via trusted couriers.` },
    { question: `What payment methods can I use for ${ctx.name}?`, answer: 'You can pay with bKash, Nagad, SSLCommerz cards or Cash on Delivery.' },
  ];
  const schemaJson = buildSchema(entityType, ctx.name, metaDescription, ctx.canonicalUrl);
  return { metaTitle, metaDescription, keywords, faq, schemaJson, source: 'heuristic' as const };
}

export function buildSchema(entityType: SeoEntityType, name: string, description: string, url?: string) {
  const typeMap: Record<SeoEntityType, string> = {
    product: 'Product', category: 'CollectionPage', brand: 'Brand', page: 'WebPage',
  };
  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': typeMap[entityType],
    name,
    description,
  };
  if (url) node.url = url;
  if (entityType === 'product') {
    node.offers = {
      '@type': 'Offer',
      availability: 'https://schema.org/InStock',
      priceCurrency: 'BDT',
      seller: { '@type': 'Organization', name: 'OceanBazar' },
    };
  }
  return node;
}

export function buildFaqJsonLd(faq: { question: string; answer: string }[]) {
  if (!Array.isArray(faq) || faq.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

export async function generateForEntity(entityType: SeoEntityType, entityId: string, locale = 'en', persist = true) {
  const ctx = await loadEntityContext(entityType, entityId, locale);
  if (!ctx) throw new Error(`Entity not found: ${entityType}/${entityId}`);

  let result: {
    metaTitle: string; metaDescription: string; keywords: string[];
    faq: { question: string; answer: string }[]; schemaJson: unknown; source: string;
  };

  if (isMlConfigured()) {
    try {
      const gen = await generateSeo({
        entity_type: entityType,
        name: ctx.name,
        description: ctx.description ?? undefined,
        category: ctx.category ?? undefined,
        language: locale,
        canonical_url: ctx.canonicalUrl,
      });
      result = {
        metaTitle: gen.meta_title,
        metaDescription: gen.meta_description,
        keywords: gen.keywords,
        faq: gen.faq,
        schemaJson: gen.schema_json,
        source: gen.source === 'openai' ? 'ai' : 'heuristic',
      };
    } catch {
      result = heuristicSeo(entityType, ctx);
    }
  } else {
    result = heuristicSeo(entityType, ctx);
  }

  if (!persist) {
    return { ...result, entityType, entityId, locale, canonicalUrl: ctx.canonicalUrl };
  }

  return upsertSeo({
    entityType,
    entityId,
    locale,
    metaTitle: result.metaTitle,
    metaDescription: result.metaDescription,
    keywords: result.keywords,
    canonicalUrl: ctx.canonicalUrl,
    schemaJson: result.schemaJson,
    faq: result.faq,
    source: result.source,
  });
}

export async function bulkGenerate(entityType: SeoEntityType, opts: { ids?: string[]; limit?: number; locale?: string }) {
  const locale = opts.locale || 'en';
  let ids = opts.ids;
  if (!ids || ids.length === 0) {
    const limit = Math.min(opts.limit ?? 50, 200);
    if (entityType === 'product') {
      const rows = await prisma.product.findMany({ select: { id: true }, take: limit, orderBy: { updatedAt: 'desc' } });
      ids = rows.map((r) => r.id);
    } else if (entityType === 'category') {
      const rows = await prisma.category.findMany({ select: { id: true }, take: limit });
      ids = rows.map((r) => r.id);
    } else if (entityType === 'brand') {
      const rows = await prisma.brand.findMany({ select: { id: true }, take: limit });
      ids = rows.map((r) => r.id);
    } else {
      ids = [];
    }
  }
  let ok = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      await generateForEntity(entityType, id, locale, true);
      ok += 1;
    } catch {
      failed += 1;
    }
  }
  return { requested: ids.length, generated: ok, failed };
}

/** Internal linking suggestions: related products in the same category/brand. */
export async function buildInternalLinks(entityType: SeoEntityType, entityId: string, locale = 'en') {
  if (entityType !== 'product') return [];
  const product = await prisma.product.findUnique({
    where: { id: entityId },
    select: { brandId: true, productCategories: { select: { categoryId: true }, take: 1 } },
  });
  if (!product) return [];
  const categoryId = product.productCategories[0]?.categoryId;
  const related = await prisma.product.findMany({
    where: {
      id: { not: entityId },
      status: 'active',
      ...(categoryId ? { productCategories: { some: { categoryId } } } : { brandId: product.brandId ?? undefined }),
    },
    select: { id: true, titleEn: true },
    take: 8,
  });
  return related.map((r) => ({ id: r.id, title: r.titleEn, url: `${CLIENT}/${locale}/product/${r.id}` }));
}
