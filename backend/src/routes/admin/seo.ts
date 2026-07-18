import { Router, Request, Response } from 'express';
import { requireRole } from '../../middleware/auth';
import { aiGenerationLimiter } from '../../middleware/rateLimiter';
import {
  getOverview,
  listSeo,
  getSeo,
  upsertSeo,
  generateForEntity,
  bulkGenerate,
  buildInternalLinks,
  type SeoEntityType,
} from '../../services/seoService';

const router = Router();

const VALID_TYPES: SeoEntityType[] = ['product', 'category', 'brand', 'page'];

function isValidType(t: unknown): t is SeoEntityType {
  return typeof t === 'string' && (VALID_TYPES as string[]).includes(t);
}

/** GET /api/admin/seo/overview */
router.get('/overview', async (_req: Request, res: Response) => {
  try {
    res.json(await getOverview());
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load SEO overview' });
  }
});

/** GET /api/admin/seo/metadata?entityType=&limit=&offset= */
router.get('/metadata', async (req: Request, res: Response) => {
  try {
    const result = await listSeo({
      entityType: (req.query.entityType as string) || undefined,
      limit: req.query.limit ? parseInt(String(req.query.limit)) : undefined,
      offset: req.query.offset ? parseInt(String(req.query.offset)) : undefined,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load SEO metadata' });
  }
});

/** GET /api/admin/seo/metadata/:entityType/:entityId?locale= */
router.get('/metadata/:entityType/:entityId', async (req: Request, res: Response) => {
  const meta = await getSeo(String(req.params.entityType), String(req.params.entityId), (req.query.locale as string) || 'en');
  const links = await buildInternalLinks(req.params.entityType as SeoEntityType, String(req.params.entityId), (req.query.locale as string) || 'en');
  res.json({ meta, internalLinks: links });
});

/** POST /api/admin/seo/metadata — manual upsert */
router.post('/metadata', requireRole('super_admin', 'admin', 'staff'), async (req: Request, res: Response) => {
  const body = req.body || {};
  if (!isValidType(body.entityType) || !body.entityId) {
    res.status(400).json({ error: 'entityType (product|category|brand|page) and entityId are required' });
    return;
  }
  const saved = await upsertSeo(body);
  res.json({ meta: saved });
});

/** POST /api/admin/seo/generate — AI/heuristic generate for one entity */
router.post('/generate', aiGenerationLimiter, requireRole('super_admin', 'admin', 'staff'), async (req: Request, res: Response) => {
  const { entityType, entityId, locale, persist } = req.body || {};
  if (!isValidType(entityType) || !entityId) {
    res.status(400).json({ error: 'entityType and entityId are required' });
    return;
  }
  try {
    const meta = await generateForEntity(entityType, String(entityId), locale || 'en', persist !== false);
    res.json({ meta });
  } catch (err: any) {
    res.status(404).json({ error: err?.message || 'generation_failed' });
  }
});

/** POST /api/admin/seo/bulk-generate — generate for many entities */
router.post('/bulk-generate', aiGenerationLimiter, requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const { entityType, ids, limit, locale } = req.body || {};
  if (!isValidType(entityType)) {
    res.status(400).json({ error: 'entityType is required' });
    return;
  }
  const result = await bulkGenerate(entityType, { ids, limit, locale });
  res.json(result);
});

/** POST /api/admin/seo/sitemap/ping — notify search engines of the sitemap */
router.post('/sitemap/ping', requireRole('super_admin', 'admin'), async (_req: Request, res: Response) => {
  const site = (process.env.CLIENT_URL || 'https://oceanbazar.com.bd').replace(/\/$/, '');
  const sitemapUrl = `${site}/sitemap.xml`;
  const targets = [
    `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
    `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
  ];
  const results: { target: string; ok: boolean }[] = [];
  await Promise.all(targets.map(async (t) => {
    try {
      const r = await fetch(t, { method: 'GET' });
      results.push({ target: t, ok: r.ok });
    } catch {
      results.push({ target: t, ok: false });
    }
  }));
  res.json({ sitemapUrl, results });
});

export default router;
