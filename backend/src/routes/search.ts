import { Router, Request, Response } from 'express';
import { getRedisClient, isRedisConnected } from '../cache/redisClient';
import { prisma } from '../lib/prisma';

import { internalApiRequest } from '../clients/internal-api-client';
import { ProductListResponseSchema } from '../contracts/catalog.contract';

const router = Router();
const SEARCH_CACHE_TTL = 120; // 2 minutes

/**
 * GET /api/search?q=...&category=...&minPrice=...&maxPrice=...&sort=...&page=...&limit=...
 * Main search — proxies to Spring Boot with Redis cache
 */
router.get('/', async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  // Log search query async (non-blocking)
  if (q.length >= 2) {
    logSearch(q).catch(() => {});
  }

  try {
    const cacheKey = `bff:search:${req.originalUrl}`;
    if (isRedisConnected()) {
      try {
        const redis = await getRedisClient();
        const cached = await redis.get(cacheKey);
        if (cached) { res.setHeader('X-Cache', 'HIT'); return res.json(JSON.parse(cached)); }
      } catch { /* Redis unavailable */ }
    }

    const data = await internalApiRequest({
      path: '/api/products',
      params: req.query as Record<string, unknown>,
      requestId: req.requestId,
      schema: ProductListResponseSchema,
    });

    if (isRedisConnected()) {
      getRedisClient()
        .then((redis) => redis.setEx(cacheKey, SEARCH_CACHE_TTL, JSON.stringify(data)))
        .catch(() => {});
    }
    res.setHeader('X-Cache', 'MISS');
    res.json(data);
  } catch (err: any) {
    console.error('[search] Proxy to Spring Boot failed:', err.message);
    if (err.response) return res.status(err.response.status).json(err.response.data);
    res.status(502).json({ error: 'Search service unavailable' });
  }
});

/**
 * GET /api/search/suggest?q=...&lang=en|bn&limit=8
 * Instant autocomplete using PostgreSQL full-text search.
 * Returns product titles, prices and images — no Spring Boot needed.
 */
router.get('/suggest', async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  const lang = String(req.query.lang || 'en');
  const limit = Math.min(12, Math.max(1, parseInt(String(req.query.limit || '8'), 10) || 8));

  if (q.length < 2) { res.json({ suggestions: [] }); return; }

  const cacheKey = `bff:suggest:${q}:${lang}:${limit}`;
  if (isRedisConnected()) {
    try {
      const redis = await getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) { res.setHeader('X-Cache', 'HIT'); return res.json(JSON.parse(cached)); }
    } catch { /* ignore */ }
  }

  try {
    // PostgreSQL full-text search with prefix matching via ILIKE + tsquery
    const products = await prisma.$queryRaw<{
      id: string; title_en: string | null; title_bn: string | null; price: number | null; image: string | null; category: string | null;
    }[]>`
      SELECT
        p.id,
        p.title_en,
        p.title_bn,
        pp.price::float as price,
        pa.url as image,
        c.name_en as category
      FROM products p
      LEFT JOIN product_pricing pp ON pp.product_id = p.id AND pp.customer_type = 'retail'
      LEFT JOIN product_assets pa ON pa.product_id = p.id AND pa.is_primary = true AND pa.asset_type = 'image'
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE
        p.is_active = true
        AND (
          LOWER(p.title_en) LIKE LOWER(${`%${q}%`})
          OR LOWER(p.title_bn) LIKE LOWER(${`%${q}%`})
          OR to_tsvector('english', COALESCE(p.title_en, '')) @@ plainto_tsquery('english', ${q})
        )
      ORDER BY
        CASE WHEN LOWER(p.title_en) LIKE LOWER(${`${q}%`}) THEN 0 ELSE 1 END,
        p.view_count DESC NULLS LAST
      LIMIT ${limit}
    `;

    const suggestions = products.map((p) => ({
      id: p.id,
      title: (lang === 'bn' ? p.title_bn : p.title_en) ?? p.title_en ?? '',
      price: p.price,
      image: p.image,
      category: p.category,
    }));
    const result = { suggestions };
    if (isRedisConnected()) {
      getRedisClient()
        .then((r) => r.setEx(cacheKey, 30, JSON.stringify(result)))
        .catch(() => {});
    }

    res.setHeader('X-Cache', 'MISS');
    res.json(result);
  } catch (err: any) {
    // Fallback: simple Prisma ILIKE search if raw query fails
    try {
      const products = await prisma.product.findMany({
        where: {
          status: 'active',
          OR: [
            { titleEn: { contains: q, mode: 'insensitive' } },
            { titleBn: { contains: q, mode: 'insensitive' } },
          ],
        },
        include: {
          pricing: { where: { customerType: 'retail' }, take: 1 },
          productAssets: { where: { isPrimary: true, assetType: 'image' }, take: 1 },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      const suggestions = products.map((p) => ({
        id: p.id,
        title: (lang === 'bn' ? p.titleBn : p.titleEn) ?? p.titleEn,
        price: p.pricing[0] ? Number(p.pricing[0].price) : null,
        image: p.productAssets[0]?.url ?? null,
        category: null,
      }));

      res.json({ suggestions });
    } catch (fallbackErr) {
      console.error('[search/suggest] Fallback also failed:', fallbackErr);
      res.json({ suggestions: [] });
    }
  }
});

/**
 * GET /api/search/trending?lang=en|bn&limit=8
 * Returns top searched terms from search_logs (last 7 days).
 * Falls back to static trending if table is empty.
 */
router.get('/trending', async (req: Request, res: Response) => {
  const lang = String(req.query.lang || 'en');
  const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit || '8'), 10) || 8));

  const STATIC_TRENDING = {
    en: ['iPhone', 'Samsung Galaxy', 'Laptop', 'Headphones', 'Smart Watch', 'Camera', 'Perfume', 'Sneakers'],
    bn: ['আইফোন', 'স্যামসাং', 'ল্যাপটপ', 'হেডফোন', 'স্মার্ট ওয়াচ', 'ক্যামেরা', 'পারফিউম', 'স্নিকার্স'],
  };

  const cacheKey = `bff:trending:${lang}`;
  if (isRedisConnected()) {
    try {
      const redis = await getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));
    } catch { /* ignore */ }
  }

  try {
    const rows = await prisma.$queryRaw<{ query: string; count: bigint }[]>`
      SELECT query, COUNT(*) as count
      FROM search_logs
      WHERE created_at > NOW() - INTERVAL '7 days'
        AND LENGTH(query) >= 2
      GROUP BY query
      ORDER BY count DESC
      LIMIT ${limit}
    `;

    const trending = rows.length > 0
      ? rows.map((r) => r.query)
      : (STATIC_TRENDING[lang as 'en' | 'bn'] ?? STATIC_TRENDING.en);

    const result = { trending };
    if (isRedisConnected()) {
      getRedisClient().then((r) => r.setEx(cacheKey, 300, JSON.stringify(result))).catch(() => {});
    }
    res.json(result);
  } catch {
    res.json({ trending: STATIC_TRENDING[lang as 'en' | 'bn'] ?? STATIC_TRENDING.en });
  }
});

/**
 * POST /api/search/log — log a search query for analytics
 */
router.post('/log', async (req: Request, res: Response) => {
  const { query } = req.body;
  if (query && typeof query === 'string') {
    logSearch(query.trim(), req.user?.userId).catch(() => {});
  }
  res.json({ ok: true });
});

async function logSearch(query: string, userId?: string) {
  if (!query || query.length < 2) return;
  try {
    await prisma.$executeRaw`
      INSERT INTO search_logs (id, query, user_id, created_at)
      VALUES (gen_random_uuid()::text, ${query.slice(0, 200)}, ${userId ?? null}, NOW())
    `;
  } catch { /* non-fatal: table may not exist yet */ }
}

export default router;
