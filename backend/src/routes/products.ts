import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { routeParam } from '../utils/params';
import { cacheResponse } from '../cache/cacheMiddleware';

const router = Router();
const productCache = cacheResponse({ ttlSeconds: 300, keyPrefix: 'bff:products' });
const prisma = new PrismaClient();

type ProductInclude = {
  productAssets: true;
  pricing: true;
  category: true;
  brandRelation: true;
  productTags: { include: { tags: true } };
  variants?: true;
};

type ProductPayload = Prisma.ProductGetPayload<{ include: ProductInclude }>;

type CollectionKey =
  | 'featured'
  | 'top-trending'
  | 'latest'
  | 'best-seller'
  | 'most-sold'
  | 'beauty'
  | 'gadgets'
  | 'home'
  | 'kids'
  | 'more-for-you';

const COLLECTION_TAGS: Record<Exclude<CollectionKey, 'latest'>, string> = {
  'featured': 'ob_featured',
  'top-trending': 'ob_top_trending',
  'best-seller': 'ob_best_seller',
  'most-sold': 'ob_most_sold',
  'beauty': 'ob_beauty',
  'gadgets': 'ob_gadgets',
  'home': 'ob_home',
  'kids': 'ob_kids',
  'more-for-you': 'ob_more_for_you',
};

function normalizeCollection(raw: string | undefined): CollectionKey | null {
  const c = String(raw ?? '').trim();
  if (!c) return null;
  const allowed: CollectionKey[] = [
    'featured',
    'top-trending',
    'latest',
    'best-seller',
    'most-sold',
    'beauty',
    'gadgets',
    'home',
    'kids',
    'more-for-you',
  ];
  return allowed.includes(c as CollectionKey) ? (c as CollectionKey) : null;
}

async function getOrderRanks(days: number): Promise<Array<{ productId: string; qty: number }>> {
  const since = new Date(Date.now() - days * 86400_000);
  const rows = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: {
      order: {
        createdAt: { gte: since },
        status: { in: ['confirmed', 'processing', 'shipped', 'delivered'] },
      },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 250,
  });

  return rows
    .map((r) => ({ productId: r.productId, qty: Number(r._sum.quantity ?? 0) }))
    .filter((r) => r.productId && r.qty > 0);
}

async function getViewRanks(days: number): Promise<Array<{ productId: string; views: number }>> {
  const since = new Date(Date.now() - days * 86400_000);
  const rows = await prisma.$queryRaw<Array<{ productId: string; views: bigint }>>`
    SELECT (payload->>'productId') AS "productId", COUNT(*)::bigint AS views
    FROM analytics_events
    WHERE event_type = 'product_view'
      AND created_at >= ${since}
      AND (payload->>'productId') IS NOT NULL
    GROUP BY 1
    ORDER BY views DESC
    LIMIT 500;
  `;
  return rows
    .map((r) => ({ productId: String(r.productId), views: Number(r.views ?? 0) }))
    .filter((r) => r.productId && r.views > 0);
}

async function resolveCollectionIds(collection: CollectionKey): Promise<string[] | null> {
  if (collection === 'latest') return null;

  if (collection === 'featured') {
    const rows = await prisma.product.findMany({
      where: {
        status: 'active',
        OR: [
          { isFeatured: true },
          { productTags: { some: { tags: { slug: COLLECTION_TAGS.featured } } } },
        ],
      },
      select: { id: true },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });
    return rows.map((r) => r.id);
  }

  // Tag-only collections (admin override first)
  if (collection !== 'top-trending' && collection !== 'best-seller' && collection !== 'most-sold') {
    const tag = COLLECTION_TAGS[collection as Exclude<CollectionKey, 'latest' | 'top-trending'>];

    // Manual overrides
    const manual = await prisma.product.findMany({
      where: { status: 'active', productTags: { some: { tags: { slug: tag } } } },
      select: { id: true },
      orderBy: { updatedAt: 'desc' },
      take: 300,
    });

    // Auto-detection fallback with multiple keywords per collection
    const keywords: string[] =
      collection === 'beauty'
        ? ['beauty', 'cosmetic', 'hair', 'skin', 'makeup', 'clothing', 'accessories', 'fashion']
        : collection === 'gadgets'
          ? ['gadget', 'electronic', 'smartphone', 'laptop', 'wireless', 'bluetooth', 'smart', 'camera']
          : collection === 'home'
            ? ['home', 'garden', 'kitchen', 'pillow', 'bed', 'curtain', 'lamp', 'towel']
            : collection === 'kids'
              ? ['kids', 'baby', 'toy', 'school', 'ball', 'jump', 'bicycle', 'sports']
              : collection === 'more-for-you'
                ? ['new', 'arrival']
                : [];

    let auto: { id: string }[] = [];
    if (keywords.length > 0) {
      const orConditions = keywords.flatMap((kw) => [
        { titleEn: { contains: kw, mode: 'insensitive' as const } },
        { category: { nameEn: { contains: kw, mode: 'insensitive' as const } } },
      ]);
      auto = await prisma.product.findMany({
        where: { status: 'active', OR: orConditions },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
        take: 400,
      });
    }

    // For more-for-you, also include products with 'New Arrival' popularity label
    if (collection === 'more-for-you') {
      const newArrivals = await prisma.product.findMany({
        where: { status: 'active', popularityLabelEn: 'New Arrival' },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      auto = [...auto, ...newArrivals];
    }

    const merged = [...manual.map((m) => m.id), ...auto.map((a) => a.id).filter((id) => !manual.some((m) => m.id === id))];
    return merged.slice(0, 500);
  }

  if (collection === 'best-seller') {
    const manual = await prisma.product.findMany({
      where: { status: 'active', productTags: { some: { tags: { slug: COLLECTION_TAGS['best-seller'] } } } },
      select: { id: true },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    const ranked = await getOrderRanks(90);
    const rankedIds = ranked.map((r) => r.productId);
    // Fallback: products with popularity_label_en = 'Best Seller'
    const labelFallback = await prisma.product.findMany({
      where: { status: 'active', popularityLabelEn: 'Best Seller' },
      select: { id: true },
      orderBy: { popularityRank: 'asc' },
      take: 200,
    });
    const all = [...manual.map((m) => m.id), ...rankedIds, ...labelFallback.map((l) => l.id)];
    const merged = [...new Set(all)];
    return merged.slice(0, 400);
  }

  if (collection === 'most-sold') {
    const manual = await prisma.product.findMany({
      where: { status: 'active', productTags: { some: { tags: { slug: COLLECTION_TAGS['most-sold'] } } } },
      select: { id: true },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    const ranked = await getOrderRanks(365);
    const rankedIds = ranked.map((r) => r.productId);
    // Fallback: use high review_count products as "most sold" proxy
    const fallback = await prisma.product.findMany({
      where: { status: 'active', reviewCount: { gt: 0 } },
      select: { id: true },
      orderBy: { reviewCount: 'desc' },
      take: 200,
    });
    const all = [...manual.map((m) => m.id), ...rankedIds, ...fallback.map((f) => f.id)];
    const merged = [...new Set(all)];
    return merged.slice(0, 400);
  }

  // top-trending: combine views (30d) + order qty (30d), plus admin override tag
  const manual = await prisma.product.findMany({
    where: { status: 'active', productTags: { some: { tags: { slug: COLLECTION_TAGS['top-trending'] } } } },
    select: { id: true },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
  const [views, orders] = await Promise.all([getViewRanks(30), getOrderRanks(30)]);
  const score = new Map<string, number>();
  for (const v of views) score.set(v.productId, (score.get(v.productId) ?? 0) + v.views);
  for (const o of orders) score.set(o.productId, (score.get(o.productId) ?? 0) + o.qty * 5);
  const rankedIds = [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  // Fallback: products marked as 'Trending' by seed or with is_featured
  const trendFallback = await prisma.product.findMany({
    where: { status: 'active', OR: [{ popularityLabelEn: 'Trending' }, { isFeatured: true }] },
    select: { id: true },
    orderBy: { popularityRank: 'asc' },
    take: 200,
  });

  const all = [...manual.map((m) => m.id), ...rankedIds, ...trendFallback.map((f) => f.id)];
  const merged = [...new Set(all)];
  return merged.slice(0, 400);
}

// GET /api/products (cached 5 min)
router.get('/', productCache, async (req: Request, res: Response) => {
  const {
    page = '1',
    limit = '24',
    category,
    search,
    sort = 'createdAt_desc',
    lang = 'en',
    excludeId,
    collection,
  } = req.query as Record<string, string>;

  const take = Math.min(parseInt(limit), 100);
  const skip = (parseInt(page) - 1) * take;

  const collectionKey = normalizeCollection(collection);

  if (collectionKey) {
    const ids = await resolveCollectionIds(collectionKey);
    const baseWhere: Prisma.ProductWhereInput = {
      status: 'active',
      ...(category ? { categoryId: category } : {}),
      ...(excludeId ? { id: { not: excludeId } } : {}),
      ...(search
        ? {
            OR: [
              { titleEn: { contains: search, mode: 'insensitive' } },
              { titleBn: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    // latest uses DB ordering
    if (collectionKey === 'latest') {
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where: baseWhere,
          include: {
            productAssets: { where: { isPrimary: true }, take: 1 },
            pricing: true,
            category: true,
            brandRelation: true,
            productTags: { include: { tags: true } },
          },
          skip,
          take,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.product.count({ where: baseWhere }),
      ]);

      res.json({
        products: products.map((p) => formatProduct(p as ProductPayload, lang)),
        pagination: { page: parseInt(page), limit: take, total, pages: Math.ceil(total / take) },
      });
      return;
    }

    // For ranked/tag collections, fetch all matching IDs then paginate in JS (preserve rank).
    const idSet = new Set(ids ?? []);
    const where: Prisma.ProductWhereInput = {
      ...baseWhere,
      ...(ids ? { id: { in: [...idSet] } } : {}),
    };

    const rows = await prisma.product.findMany({
      where,
      include: {
        productAssets: { where: { isPrimary: true }, take: 1 },
        pricing: true,
        category: true,
        brandRelation: true,
        productTags: { include: { tags: true } },
      },
      take: 500,
      orderBy: { updatedAt: 'desc' },
    });

    const orderIndex = new Map<string, number>();
    (ids ?? []).forEach((id, idx) => orderIndex.set(id, idx));
    rows.sort((a, b) => (orderIndex.get(a.id) ?? 999999) - (orderIndex.get(b.id) ?? 999999));

    const total = rows.length;
    const paged = rows.slice(skip, skip + take);
    res.json({
      products: paged.map((p) => formatProduct(p as ProductPayload, lang)),
      pagination: { page: parseInt(page), limit: take, total, pages: Math.ceil(total / take) },
    });
    return;
  }

  const where: Prisma.ProductWhereInput = {
    status: 'active',
    ...(category ? { categoryId: category } : {}),
    ...(excludeId ? { id: { not: excludeId } } : {}),
    ...(search
      ? {
          OR: [
            { titleEn: { contains: search, mode: 'insensitive' } },
            { titleBn: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        productAssets: { where: { isPrimary: true }, take: 1 },
        pricing: true,
        category: true,
        brandRelation: true,
        productTags: { include: { tags: true } },
      },
      skip,
      take,
      orderBy: sort === 'price_asc'
        ? undefined
        : sort === 'createdAt_desc'
        ? { createdAt: 'desc' }
        : { createdAt: 'desc' },
    }),
    prisma.product.count({ where }),
  ]);

  const formatted = products.map((p) => formatProduct(p as ProductPayload, lang));

  res.json({
    products: formatted,
    pagination: { page: parseInt(page), limit: take, total, pages: Math.ceil(total / take) },
  });
});

// GET /api/products/compare?ids=A,B,C
router.get('/compare', async (req: Request, res: Response) => {
  const lang = String(req.query.lang || 'en');
  const ids = String(req.query.ids || '').split(',').filter(Boolean).slice(0, 4);
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: { productAssets: true, pricing: true, variants: true, category: true, brandRelation: true, productTags: { include: { tags: true } } },
  });
  res.json({ products: products.map((p) => formatProduct(p as ProductPayload, lang)) });
});

// GET /api/products/:id
router.get('/:id', async (req: Request, res: Response) => {
  const lang = String(req.query.lang || 'en');
  const pid = routeParam(req.params.id);
  const [product, soldAgg] = await Promise.all([
    prisma.product.findUnique({
      where: { id: pid, status: 'active' },
      include: { productAssets: true, pricing: true, variants: true, category: true, brandRelation: true, productTags: { include: { tags: true } } },
    }),
    prisma.orderItem.aggregate({
      where: { productId: pid },
      _sum: { quantity: true },
    }),
  ]);
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  const orderCount = soldAgg._sum?.quantity ?? 0;
  res.json({ product: formatProduct(product as ProductPayload, lang, { orderCount }) });
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function parseJsonRecord(val: unknown): Record<string, string> | null {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    if (v !== undefined && v !== null) out[k] = String(v);
  }
  return Object.keys(out).length ? out : null;
}

function formatVariants(
  variants: Prisma.ProductVariantGetPayload<object>[],
  lang: string
) {
  return [...variants]
    .filter((v) => v.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((v) => {
      const raw = v.attributes;
      const attributes: Record<string, string> =
        raw && typeof raw === 'object' && !Array.isArray(raw)
          ? Object.fromEntries(
              Object.entries(raw as Record<string, unknown>).map(([k, val]) => [k, String(val ?? '')])
            )
          : {};
      return {
        id: v.id,
        sku: v.sku,
        name: lang === 'bn' ? v.nameBn : v.nameEn,
        stock: v.stock,
        priceOverride: v.priceOverride != null ? Number(v.priceOverride) : null,
        attributes,
      };
    });
}

function parseReviewsSnapshot(raw: unknown): Array<{
  authorName: string;
  rating: number;
  body: string | null;
  createdAt: string;
}> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      if (!r || typeof r !== 'object') return null;
      const o = r as Record<string, unknown>;
      const authorName = typeof o.authorName === 'string' ? o.authorName : 'Customer';
      const rating = typeof o.rating === 'number' ? Math.min(5, Math.max(1, Math.round(o.rating))) : 5;
      const body = o.body != null ? String(o.body) : null;
      const createdAt = o.createdAt != null ? String(o.createdAt) : new Date().toISOString();
      return { authorName, rating, body, createdAt };
    })
    .filter(Boolean) as Array<{
      authorName: string;
      rating: number;
      body: string | null;
      createdAt: string;
    }>;
}

function formatProduct(p: ProductPayload, lang: string, opts?: { orderCount?: number }) {
  const title = lang === 'bn' ? p.titleBn : p.titleEn;
  const description = lang === 'bn' ? p.descriptionBn : p.descriptionEn;
  const sortedImages = [...p.productAssets].sort((a, b) => a.sortOrder - b.sortOrder);
  const primaryImage = sortedImages.find((i) => i.isPrimary) ?? sortedImages[0];
  const retailPricing = p.pricing.find((pr) => pr.customerType === 'retail');
  const wholesalePricing = p.pricing.find((pr) => pr.customerType === 'wholesale');

  const variants =
    'variants' in p && Array.isArray((p as { variants?: Prisma.ProductVariantGetPayload<object>[] }).variants)
      ? formatVariants((p as { variants: Prisma.ProductVariantGetPayload<object>[] }).variants, lang)
      : [];

  const category = p.category
    ? {
        id: p.category.id,
        nameEn: p.category.nameEn,
        nameBn: p.category.nameBn,
        icon: p.category.icon,
      }
    : null;

  const popularityLabel =
    lang === 'bn'
      ? (p as { popularityLabelBn?: string | null }).popularityLabelBn ?? null
      : (p as { popularityLabelEn?: string | null }).popularityLabelEn ?? null;

  const br = (p as ProductPayload & { brandRelation?: { id: string; nameEn: string; nameBn: string; slug: string; logoUrl: string | null } | null }).brandRelation;
  const brandDetail = br
    ? { id: br.id, nameEn: br.nameEn, nameBn: br.nameBn, slug: br.slug, logoUrl: br.logoUrl }
    : null;

  const specifications = parseJsonRecord((p as { specifications?: unknown }).specifications);
  const attributesExtra = parseJsonRecord((p as { attributesExtra?: unknown }).attributesExtra);
  const reviews = parseReviewsSnapshot((p as { reviewsSnapshot?: unknown }).reviewsSnapshot);

  const tags = p.productTags?.map(pt => pt.tags.slug) ?? [];

  return {
    id: p.id,
    title,
    description,
    categoryId: p.categoryId,
    brandId: p.brandId,
    brandDetail,
    sku: p.sku,
    status: p.status,
    moq: p.moq,
    stock: p.stock,
    tags,
    primaryImage: primaryImage?.url ?? null,
    images: sortedImages.map((img) => ({
      id: img.id,
      productId: img.productId,
      url: img.url,
      altEn: img.altEn,
      altBn: img.altBn,
      sortOrder: img.sortOrder,
      mediaType: img.assetType,
      isPrimary: img.isPrimary,
      colorKey: img.colorKey ?? null,
    })),
    retailPrice: retailPricing ? Number(retailPricing.price) : null,
    wholesalePrice: wholesalePricing ? Number(wholesalePricing.price) : null,
    pricing: { retail: retailPricing, wholesale: wholesalePricing },
    createdAt: p.createdAt,
    weight: (p as { weight?: unknown }).weight != null ? Number((p as { weight: unknown }).weight) : null,
    weightUnit: (p as { weightUnit?: string | null }).weightUnit ?? null,
    category,
    variants,
    orderCount: opts?.orderCount ?? 0,
    specifications,
    attributesExtra,
    ratingAvg:
      (p as { ratingAvg?: unknown }).ratingAvg != null ? Number((p as { ratingAvg: unknown }).ratingAvg) : null,
    reviewCount: (p as { reviewCount?: number }).reviewCount ?? 0,
    brandLogoUrl: (p as { brandLogoUrl?: string | null }).brandLogoUrl ?? null,
    popularityRank: (p as { popularityRank?: number | null }).popularityRank ?? null,
    popularityLabel,
    reviews,
  };
}

export default router;
