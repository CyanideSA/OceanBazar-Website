import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { routeParam } from '../utils/params';
import { cacheResponse } from '../cache/cacheMiddleware';
import { emitAdminEvent } from '../lib/adminEvents';
import { prisma } from '../lib/prisma';

const router = Router();
const productCache = cacheResponse({ ttlSeconds: 300, keyPrefix: 'bff:products' });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaAny = prisma as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProductPayload = any;

type CollectionKey =
  | 'featured'
  | 'top-trending'
  | 'latest'
  | 'best-rated'
  | 'best-seller'
  | 'most-sold'
  | 'beauty';

const COLLECTION_TAGS: Record<Exclude<CollectionKey, 'latest'>, string> = {
  'featured': 'ob_featured',
  'top-trending': 'ob_top_trending',
  'best-rated': 'ob_best_rated',
  'best-seller': 'ob_best_seller',
  'most-sold': 'ob_most_sold',
  'beauty': 'ob_beauty',
};

function normalizeCollection(raw: string | undefined): CollectionKey | null {
  const c = String(raw ?? '').trim();
  if (!c) return null;
  // Legacy storefront slug → canonical
  if (c === 'best-seller') return 'best-rated';
  const allowed: CollectionKey[] = [
    'featured',
    'top-trending',
    'latest',
    'best-rated',
    'best-seller',
    'most-sold',
    'beauty',
  ];
  return allowed.includes(c as CollectionKey) ? (c as CollectionKey) : null;
}

/** Return categoryId plus all descendant IDs (breadth-first, max depth 3) */
async function getCategoryDescendants(categoryId: string): Promise<string[]> {
  const all: string[] = [categoryId];
  const queue: string[] = [categoryId];
  while (queue.length > 0) {
    const parentId = queue.shift()!;
    const children = await prisma.category.findMany({
      where: { parentId },
      select: { id: true },
    });
    for (const child of children) {
      all.push(child.id);
      queue.push(child.id);
    }
  }
  return all;
}

async function resolveBrandId(rawBrand: string): Promise<string | null> {
  const brand = String(rawBrand ?? '').trim();
  if (!brand) return null;

  const found = await prisma.brand.findFirst({
    where: {
      OR: [
        { id: brand },
        { slug: brand },
        { nameEn: { equals: brand, mode: 'insensitive' } },
        { nameBn: { equals: brand, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });

  return found?.id ?? null;
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

  // ── Featured: flag-first, tag fallback ──────────────────────────────────────
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

  // ── Best rated: admin flag first, reviews (ratingAvg), legacy tag ───────────
  if (collection === 'best-rated' || collection === 'best-seller') {
    const [rated, flagged, tagRows] = await Promise.all([
      prisma.product.findMany({
        where: { status: 'active', ratingAvg: { gte: 4 }, reviewCount: { gte: 1 } },
        select: { id: true },
        orderBy: [{ ratingAvg: 'desc' }, { reviewCount: 'desc' }],
        take: 300,
      }),
      prismaAny.product.findMany({
        where: { status: 'active', isBestRated: true },
        select: { id: true },
        orderBy: { updatedAt: 'desc' },
        take: 200,
      }) as Promise<Array<{ id: string }>>,
      prisma.product.findMany({
        where: {
          status: 'active',
          OR: [
            { productTags: { some: { tags: { slug: COLLECTION_TAGS['best-rated'] } } } },
            { productTags: { some: { tags: { slug: COLLECTION_TAGS['best-seller'] } } } },
          ],
        },
        select: { id: true },
        take: 200,
      }),
    ]);
    const all = [
      ...flagged.map((r) => r.id),
      ...rated.map((r) => r.id),
      ...tagRows.map((r) => r.id),
    ];
    return [...new Set(all)].slice(0, 400);
  }

  // ── Most Sold: metrics first, then order aggregation, then tags ──────────────
  if (collection === 'most-sold') {
    const [metricRows, orderRanked, tagRows] = await Promise.all([
      prismaAny.productMetrics.findMany({
        where: { totalQuantitySold: { gt: 0 } },
        orderBy: { totalQuantitySold: 'desc' },
        take: 250,
      }) as Promise<Array<{ productId: string }>>,
      getOrderRanks(365),
      prisma.product.findMany({
        where: { status: 'active', productTags: { some: { tags: { slug: COLLECTION_TAGS['most-sold'] } } } },
        select: { id: true },
        take: 200,
      }),
    ]);
    const all = [
      ...(metricRows as Array<{ productId: string }>).map((r) => r.productId),
      ...orderRanked.map((r) => r.productId),
      ...tagRows.map((r) => r.id),
    ];
    return [...new Set(all)].slice(0, 400);
  }

  // ── Top Trending: storefront views (clicks) first, curated tag, then metric clicks fallback ──
  if (collection === 'top-trending') {
    const [viewRanked, tagRows] = await Promise.all([
      getViewRanks(90),
      prisma.product.findMany({
        where: { status: 'active', productTags: { some: { tags: { slug: COLLECTION_TAGS['top-trending'] } } } },
        select: { id: true },
        take: 200,
      }),
    ]);
    const ranked = viewRanked.map((r) => r.productId).filter(Boolean);
    const all = [...new Set([...tagRows.map((r) => r.id), ...ranked])];
    if (all.length === 0) {
      const metricRows = (await prismaAny.productMetrics.findMany({
        orderBy: { totalClicks: 'desc' },
        take: 300,
      })) as Array<{ productId: string }>;
      const fb = metricRows.map((r) => r.productId);
      if (fb.length) return fb.slice(0, 400);
      const fallback = await prisma.product.findMany({
        where: { status: 'active' },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
        take: 400,
      });
      return fallback.map((r) => r.id);
    }
    return all.slice(0, 400);
  }

  // ── Beauty: tag-based + keyword title search ──────────────────────────────────
  const tag = COLLECTION_TAGS[collection as Exclude<CollectionKey, 'latest'>];
  const keywords = ['beauty', 'cosmetic', 'hair', 'skin', 'makeup', 'clothing', 'accessories', 'fashion'];
  const [manual, auto] = await Promise.all([
    prisma.product.findMany({
      where: { status: 'active', productTags: { some: { tags: { slug: tag } } } },
      select: { id: true },
      orderBy: { updatedAt: 'desc' },
      take: 300,
    }),
    prisma.product.findMany({
      where: {
        status: 'active',
        OR: keywords.map((kw) => ({ titleEn: { contains: kw, mode: 'insensitive' as const } })),
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      take: 400,
    }),
  ]);
  const merged = [...manual.map((m) => m.id), ...auto.map((a) => a.id).filter((id) => !manual.some((m) => m.id === id))];
  return merged.slice(0, 500);
}

// GET /api/products (cached 5 min)
router.get('/', productCache, async (req: Request, res: Response) => {
  const {
    page = '1',
    limit = '24',
    category,
    brand,
    brands: brandsParam,
    search,
    sort = 'createdAt_desc',
    lang = 'en',
    excludeId,
    collection,
    minPrice,
    maxPrice,
    rating,
  } = req.query as Record<string, string>;

  const take = Math.min(parseInt(limit), 100);
  const skip = (parseInt(page) - 1) * take;

  const collectionKey = normalizeCollection(collection);
  const catIds = category ? await getCategoryDescendants(category) : null;

  // Multi-brand support: ?brands=id1,id2,slug1 takes precedence over single ?brand=
  // Each entry is resolved by id/slug/name so URLs like ?brand=sony work correctly
  let brandWhere: Record<string, any> = {};
  if (brandsParam) {
    const raw = brandsParam.split(',').map((b) => b.trim()).filter(Boolean);
    const resolved = (await Promise.all(raw.map(resolveBrandId))).filter(Boolean) as string[];
    if (resolved.length > 0) brandWhere = { brandId: { in: resolved } };
  } else if (brand) {
    const brandId = await resolveBrandId(brand);
    if (brandId) brandWhere = { brandId };
  }

  // Price range filter (uses subquery on product_pricing retail)
  let priceProductIds: string[] | null = null;
  if (minPrice || maxPrice) {
    const minP = minPrice ? parseFloat(minPrice) : 0;
    const maxP = maxPrice ? parseFloat(maxPrice) : 999999999;
    const priceRows = await prisma.$queryRaw<Array<{ product_id: string }>>`
      SELECT DISTINCT pp.product_id
      FROM product_pricing pp
      JOIN products p ON p.id = pp.product_id
      WHERE pp.customer_type = 'retail'
        AND p.status = 'active'
        AND pp.price >= ${minP}
        AND pp.price <= ${maxP}
    `;
    priceProductIds = priceRows.map((r) => r.product_id);
  }

  // Rating filter
  const ratingMin = rating ? parseFloat(rating) : null;

  // Build shared AND conditions for extra filters
  const extraAnd: Record<string, any>[] = [];
  if (priceProductIds !== null) extraAnd.push({ id: { in: priceProductIds } });
  if (ratingMin) extraAnd.push({ ratingAvg: { gte: ratingMin } });

  if (collectionKey) {
    const ids = await resolveCollectionIds(collectionKey);
    const baseWhere = {
      status: 'active',
      ...(catIds ? { productCategories: { some: { categoryId: { in: catIds } } } } : {}),
      ...brandWhere,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      ...(search
        ? {
            OR: [
              { titleEn: { contains: search, mode: 'insensitive' } },
              { titleBn: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(extraAnd.length ? { AND: extraAnd } : {}),
    };

    // latest uses DB ordering
    if (collectionKey === 'latest') {
      const [products, total] = await Promise.all([
        prismaAny.product.findMany({
          where: baseWhere,
          include: {
            productAssets: { orderBy: { sortOrder: 'asc' }, take: 8 },
            pricing: true,
            productCategories: { include: { category: true } },
            brandRelation: true,
            productTags: { include: { tags: true } },
            metrics: true,
          },
          skip,
          take,
          orderBy: { createdAt: 'desc' },
        }),
        prismaAny.product.count({ where: baseWhere }),
      ]);

      res.json({
        products: (products as ProductPayload[]).map((p: ProductPayload) => formatProduct(p, lang)),
        pagination: { page: parseInt(page), limit: take, total, pages: Math.ceil(total / take) },
      });
      return;
    }

    // For ranked/tag collections, fetch all matching IDs then paginate in JS (preserve rank).
    const idSet = new Set(ids ?? []);
    const where = {
      ...baseWhere,
      ...(ids ? { id: { in: [...idSet] } } : {}),
    };

    const rows = await prismaAny.product.findMany({
      where,
      include: {
        productAssets: { orderBy: { sortOrder: 'asc' }, take: 8 },
        pricing: true,
        productCategories: { include: { category: true } },
        brandRelation: true,
        productTags: { include: { tags: true } },
        metrics: true,
      },
      take: 500,
      orderBy: { updatedAt: 'desc' },
    });

    const orderIndex = new Map<string, number>();
    (ids ?? []).forEach((id, idx) => orderIndex.set(id, idx));
    (rows as ProductPayload[]).sort((a: ProductPayload, b: ProductPayload) => (orderIndex.get(a.id) ?? 999999) - (orderIndex.get(b.id) ?? 999999));

    const total = rows.length;
    const paged = rows.slice(skip, skip + take);
    res.json({
      products: (paged as ProductPayload[]).map((p: ProductPayload) => formatProduct(p, lang)),
      pagination: { page: parseInt(page), limit: take, total, pages: Math.ceil(total / take) },
    });
    return;
  }

  const where = {
    status: 'active',
    ...(catIds ? { productCategories: { some: { categoryId: { in: catIds } } } } : {}),
    ...brandWhere,
    ...(excludeId ? { id: { not: excludeId } } : {}),
    ...(search
      ? {
          OR: [
            { titleEn: { contains: search, mode: 'insensitive' } },
            { titleBn: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(extraAnd.length ? { AND: extraAnd } : {}),
  };

  const [products, total] = await Promise.all([
    prismaAny.product.findMany({
      where,
      include: {
        productAssets: { orderBy: { sortOrder: 'asc' }, take: 8 },
        pricing: true,
        productCategories: { include: { category: true } },
        brandRelation: true,
        productTags: { include: { tags: true } },
        metrics: true,
      },
      skip,
      take,
      orderBy: sort === 'price_asc'
        ? undefined
        : sort === 'createdAt_desc'
        ? { createdAt: 'desc' }
        : { createdAt: 'desc' },
    }),
    prismaAny.product.count({ where }),
  ]);

  const formatted = (products as ProductPayload[]).map((p: ProductPayload) => formatProduct(p, lang));

  res.json({
    products: formatted,
    pagination: { page: parseInt(page), limit: take, total, pages: Math.ceil(total / take) },
  });
});

router.get('/top-brands', cacheResponse({ ttlSeconds: 900, keyPrefix: 'bff:top-brands' }), async (_req: Request, res: Response) => {
  try {
    const brands = await prisma.brand.findMany({
      where: {
        active: true,
        products: { some: { status: 'active' } },
      },
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
      take: 40,
      select: { id: true, slug: true, nameEn: true, nameBn: true, logoUrl: true },
    });
    res.json({ brands });
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : 'Unable to load brands';
    res.status(500).json({ error: msg });
  }
});

// GET /api/products/filters — sidebar filter metadata (categories, brands, price range, ratings)
router.get('/filters', cacheResponse({ ttlSeconds: 600, keyPrefix: 'bff:product-filters' }), async (req: Request, res: Response) => {
  const lang = String(req.query.lang || 'en');

  try {
    const [categories, brands, priceAgg, ratingRows] = await Promise.all([
      // 1. Full category tree (parents with children)
      prisma.category.findMany({
        where: { parentId: null },
        include: {
          children: {
            orderBy: { sortOrder: 'asc' },
            select: { id: true, nameEn: true, nameBn: true, slug: true, icon: true, parentId: true, is_leaf: true },
          },
        },
        orderBy: { sortOrder: 'asc' },
      }),

      // 2. Active brands with product counts
      prisma.brand.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
        select: {
          id: true,
          nameEn: true,
          nameBn: true,
          slug: true,
          logoUrl: true,
          _count: { select: { products: { where: { status: 'active' } } } },
        },
      }),

      // 3. Price range (min/max from retail pricing of active products)
      prisma.$queryRaw<Array<{ min_price: number; max_price: number }>>`
        SELECT
          COALESCE(MIN(pp.price), 0)::float AS min_price,
          COALESCE(MAX(pp.price), 0)::float AS max_price
        FROM product_pricing pp
        JOIN products p ON p.id = pp.product_id
        WHERE pp.customer_type = 'retail'
          AND p.status = 'active'
      `,

      // 4. Rating distribution
      prisma.$queryRaw<Array<{ bucket: number; count: bigint }>>`
        SELECT
          CASE
            WHEN rating_avg >= 4 THEN 4
            WHEN rating_avg >= 3 THEN 3
            WHEN rating_avg >= 2 THEN 2
            WHEN rating_avg >= 1 THEN 1
            ELSE 0
          END AS bucket,
          COUNT(*)::bigint AS count
        FROM products
        WHERE status = 'active' AND rating_avg IS NOT NULL
        GROUP BY bucket
        ORDER BY bucket DESC
      `,
    ]);

    // Format categories
    const formattedCategories = categories.map((cat) => ({
      id: cat.id,
      name: lang === 'bn' ? cat.nameBn : cat.nameEn,
      nameEn: cat.nameEn,
      nameBn: cat.nameBn,
      slug: cat.slug,
      icon: cat.icon,
      children: cat.children.map((child) => ({
        id: child.id,
        name: lang === 'bn' ? child.nameBn : child.nameEn,
        nameEn: child.nameEn,
        nameBn: child.nameBn,
        slug: child.slug,
        icon: child.icon,
        parentId: child.parentId,
      })),
    }));

    // Format brands
    const formattedBrands = brands
      .filter((b) => b._count.products > 0)
      .map((b) => ({
        id: b.id,
        name: lang === 'bn' ? b.nameBn : b.nameEn,
        nameEn: b.nameEn,
        nameBn: b.nameBn,
        slug: b.slug,
        logoUrl: b.logoUrl,
        productCount: b._count.products,
      }));

    // Price range
    const priceRange = {
      min: Math.floor(Number(priceAgg[0]?.min_price ?? 0)),
      max: Math.ceil(Number(priceAgg[0]?.max_price ?? 100000)),
    };

    // Rating distribution: cumulative counts for "X stars & up"
    const ratingMap = new Map<number, number>();
    for (const row of ratingRows) {
      ratingMap.set(Number(row.bucket), Number(row.count));
    }
    const ratingBuckets = [4, 3, 2, 1].map((star) => {
      let cumulative = 0;
      for (const [bucket, count] of ratingMap) {
        if (bucket >= star) cumulative += count;
      }
      return { minRating: star, count: cumulative };
    });

    // Collections for "Deals & Discounts"
    const collections = [
      { key: 'featured', labelEn: 'Featured Products', labelBn: 'বৈশিষ্ট্যযুক্ত পণ্য' },
      { key: 'best-rated', labelEn: 'Best Rated', labelBn: 'সেরা রেটেড' },
      { key: 'most-sold', labelEn: 'Most Sold', labelBn: 'সর্বাধিক বিক্রিত' },
      { key: 'top-trending', labelEn: 'Top Trending', labelBn: 'শীর্ষ ট্রেন্ডিং' },
    ];

    res.json({
      categories: formattedCategories,
      brands: formattedBrands,
      priceRange,
      ratingBuckets,
      collections,
    });
  } catch (err: any) {
    console.error('[products/filters] Error:', err.message);
    res.status(500).json({ error: 'Failed to load filters' });
  }
});

// POST /api/products/:id/track  (public click tracking)
router.post('/:id/track', async (req: Request, res: Response) => {
  const pid = routeParam(req.params.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pAny = prisma as any;
  try {
    await pAny.productMetrics.upsert({
      where: { productId: pid },
      update: { totalClicks: { increment: 1 }, lastUpdated: new Date() },
      create: { productId: pid, totalClicks: 1n, totalOrders: 0, totalQuantitySold: 0n },
    });
  } catch { /* ignore if product doesn't exist */ }
  res.json({ ok: true });
});

// GET /api/products/compare?ids=A,B,C (cached 5 min)
router.get('/compare', cacheResponse({ ttlSeconds: 300, keyPrefix: 'bff:product-compare' }), async (req: Request, res: Response) => {
  const lang = String(req.query.lang || 'en');
  const ids = String(req.query.ids || '').split(',').filter(Boolean).slice(0, 4);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const products = await (prisma as any).product.findMany({
    where: { id: { in: ids } },
    include: { productAssets: true, pricing: true, variants: true, productCategories: { include: { category: true } }, brandRelation: true, productTags: { include: { tags: true } }, metrics: true },
  });
  res.json({ products: (products as ProductPayload[]).map((p) => formatProduct(p, lang)) });
});

// POST /api/products/notify-stock
router.post('/notify-stock', async (req: Request, res: Response) => {
  const { productId, email } = req.body as { productId?: string; email?: string };
  if (!productId || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Valid productId and email required' });
    return;
  }
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, titleEn: true, stock: true } });
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  await prisma.$executeRaw`
    INSERT INTO email_logs (id, to_address, subject, template, status, created_at)
    VALUES (${uuidv4()}, ${email}, ${'Restock alert: ' + product.titleEn}, ${`restock_notify:${productId}`}, 'pending', NOW())
  `;
  try {
    emitAdminEvent('admin:restock:subscription', { productId: product.id, productTitle: product.titleEn, email });
  } catch { /* non-fatal */ }
  res.status(201).json({ success: true, message: 'Subscription saved' });
});

// GET /api/products/:id (cached 2 min)
router.get('/:id', cacheResponse({ ttlSeconds: 120, keyPrefix: 'bff:product-detail' }), async (req: Request, res: Response) => {
  const lang = String(req.query.lang || 'en');
  const pidOrSlug = routeParam(req.params.id);
  let resolvedId = pidOrSlug;
  if (!/^[A-Za-z0-9_-]{8,}$/.test(pidOrSlug)) {
    resolvedId = pidOrSlug;
  }
  const productById = await prisma.product.findFirst({
    where: { id: resolvedId, status: 'active' },
    include: { productAssets: true, pricing: true, variants: true, productCategories: { include: { category: true } }, brandRelation: true, productTags: { include: { tags: true } }, metrics: true },
  });
  let product = productById;
  if (!product) {
    try {
      const slugRow = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM products WHERE slug = ${pidOrSlug} AND status = 'active' LIMIT 1
      `;
      if (slugRow[0]?.id) {
        product = await prisma.product.findFirst({
          where: { id: slugRow[0].id, status: 'active' },
          include: { productAssets: true, pricing: true, variants: true, productCategories: { include: { category: true } }, brandRelation: true, productTags: { include: { tags: true } }, metrics: true },
        });
      }
    } catch {
      // Some environments do not have a slug column yet. Fall back to ID-only lookup.
    }
  }
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  const orderCount = (await prisma.orderItem.aggregate({ where: { productId: product.id }, _sum: { quantity: true } }))._sum?.quantity ?? 0;
  const banners = await prisma.productBanner.findMany({
    where: { productId: product.id, enabled: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, imageUrl: true, linkUrl: true, title: true, sortOrder: true },
  }).catch(() => []);
  const formatted = formatProduct(product as ProductPayload, lang, { orderCount });
  res.json({ product: { ...formatted, banners } });
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function parseJsonRecord(val: unknown): Record<string, string> | null {
  // Parse string JSON first
  let parsed: unknown = val;
  if (typeof val === 'string') {
    try { parsed = JSON.parse(val); } catch { return null; }
  }
  if (!parsed) return null;
  // Handle array of {key, value} pairs (our admin wizard format)
  if (Array.isArray(parsed)) {
    const out: Record<string, string> = {};
    for (const item of parsed) {
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        const k = o.key != null ? String(o.key).trim() : '';
        const v = o.value != null ? String(o.value).trim() : '';
        if (k) out[k] = v;
      }
    }
    return Object.keys(out).length ? out : null;
  }
  // Handle plain object
  if (typeof parsed !== 'object') return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
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

export function formatProduct(p: ProductPayload, lang: string, opts?: { orderCount?: number }) {
  const title = lang === 'bn' ? p.titleBn : p.titleEn;
  const description = lang === 'bn' ? p.descriptionBn : p.descriptionEn;
  const sortedImages = [...p.productAssets].sort((a, b) => a.sortOrder - b.sortOrder);
  const primaryImage = sortedImages.find((i) => i.isPrimary) ?? sortedImages[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const retailPricing = p.pricing.find((pr: any) => pr.customerType === 'retail');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wholesalePricing = p.pricing.find((pr: any) => pr.customerType === 'wholesale');

  const variants =
    'variants' in p && Array.isArray((p as { variants?: Prisma.ProductVariantGetPayload<object>[] }).variants)
      ? formatVariants((p as { variants: Prisma.ProductVariantGetPayload<object>[] }).variants, lang)
      : [];

  // Resolve primary category from many-to-many map
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const catMaps: Array<{ isPrimary: boolean; category: { id: string; nameEn: string; nameBn: string; icon: string | null } }> = (p.productCategories ?? []) as any;
  const primaryCatMap = catMaps.find((m: { isPrimary: boolean }) => m.isPrimary) ?? catMaps[0] ?? null;
  const category = primaryCatMap?.category
    ? {
        id: primaryCatMap.category.id,
        nameEn: primaryCatMap.category.nameEn,
        nameBn: primaryCatMap.category.nameBn,
        icon: primaryCatMap.category.icon,
      }
    : null;
  const categoryIds = catMaps.map((m: { category: { id: string } }) => m.category.id);

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tags = (p.productTags ?? []).map((pt: any) => pt.tags?.slug ?? '') as string[];

  return {
    id: p.id,
    slug: p.slug ?? null,
    title,
    description,
    categoryId: primaryCatMap?.category?.id ?? null,
    categoryIds,
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
    isFeatured: (p as { isFeatured?: boolean }).isFeatured ?? false,
    isBestSeller: !!(p as { isBestSeller?: boolean }).isBestSeller,
    isBestRated:
      !!(p as { isBestRated?: boolean }).isBestRated ||
      !!(p as { isBestSeller?: boolean }).isBestSeller,
    weight: (p as { weight?: unknown }).weight != null ? Number((p as { weight: unknown }).weight) : null,
    weightUnit: (p as { weightUnit?: string | null }).weightUnit ?? null,
    category,
    variants,
    orderCount: opts?.orderCount ?? 0,
    specifications,
    attributes: attributesExtra,
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
