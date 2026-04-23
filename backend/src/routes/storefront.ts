import { Router, Request, Response } from 'express';
import { getRedisClient } from '../cache/redisClient';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const router = Router();
const prisma = new PrismaClient();

const CORE_API = process.env.CORE_API_URL || 'http://127.0.0.1:8000';
const CACHE_KEY = 'storefront:settings';
const CACHE_TTL = 300; // 5 minutes

function toCamel(s: string) { return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()); }
function camelizeObj(obj: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== null && v !== undefined) out[toCamel(k)] = v;
  return out;
}

/**
 * GET /api/storefront/settings
 * Returns public-facing site settings (hero slides, trust badges, etc.).
 * Reads from BFF Prisma DB (authoritative) with Java Core API as secondary.
 * Cached in Redis to avoid DB hits on every page load.
 */
router.get('/settings', async (_req: Request, res: Response) => {
  try {
    // Try Redis cache first
    let redis: Awaited<ReturnType<typeof getRedisClient>> | null = null;
    try {
      redis = await getRedisClient();
    } catch { /* redis unavailable */ }
    if (redis) {
      try {
        const cached = await redis.get(CACHE_KEY);
        if (cached) {
          return res.json(JSON.parse(cached));
        }
      } catch { /* cache miss, proceed */ }
    }

    // Read from BFF Prisma DB (primary source of truth for settings saved via admin CRM)
    let dbRow: Record<string, any> | null = null;
    try {
      dbRow = await prisma.site_settings.findFirst({ where: { id: 'default' } });
    } catch { /* DB miss */ }
    const db = dbRow ? camelizeObj(dbRow as Record<string, any>) : {};

    // Also try Java Core API as secondary source
    let java: Record<string, any> = {};
    try {
      const { data } = await axios.get(`${CORE_API}/api/admin/global-settings`, { timeout: 3000 });
      java = data || {};
    } catch { /* Java API down, continue with DB data */ }

    // Merge: DB fields take priority, then Java, then defaults
    const m = (key: string, fallback: any = '') => db[key] ?? java[key] ?? java[toCamel(key)] ?? fallback;

    const publicSettings = {
      heroSlides: m('heroSlides', []),
      testimonials: m('testimonials', []),
      trustBadges: m('trustBadges', []),
      featuredProductIds: m('featuredProductIds', []),
      bestDealsProductIds: m('bestDealsProductIds', []),
      newArrivalsProductIds: m('newArrivalsProductIds', []),
      defaultBannerRotationMs: Number(m('defaultBannerRotationMs', 6000)),
      testimonialCarouselMs: Number(m('testimonialCarouselMs', 6000)),
      supportEmail: m('supportEmail'),
      supportPhone: m('supportPhone'),
      facebookUrl: m('facebookUrl'),
      instagramUrl: m('instagramUrl'),
      twitterUrl: m('twitterUrl'),
      youtubeUrl: m('youtubeUrl'),
      logoDarkUrl: m('logoDarkUrl'),
      logoLightUrl: m('logoLightUrl'),
      faviconUrl: m('faviconUrl'),
    };

    // Cache for next requests
    if (redis) {
      try {
        await redis.set(CACHE_KEY, JSON.stringify(publicSettings), { EX: CACHE_TTL });
      } catch { /* non-fatal */ }
    }

    return res.json(publicSettings);
  } catch (err: any) {
    // Return safe defaults if everything is down
    return res.json({
      heroSlides: [],
      testimonials: [],
      trustBadges: [],
      featuredProductIds: [],
      bestDealsProductIds: [],
      newArrivalsProductIds: [],
      defaultBannerRotationMs: 6000,
      testimonialCarouselMs: 6000,
      supportEmail: '',
      supportPhone: '',
      logoDarkUrl: '',
      logoLightUrl: '',
    });
  }
});

/**
 * GET /api/storefront/coupons
 * Returns currently active coupons for checkout.
 */
router.get('/coupons', async (_req: Request, res: Response) => {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const now = new Date();
    const coupons = await prisma.coupon.findMany({
      where: {
        active: true,
        startsAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
      select: { id: true, code: true, type: true, value: true, minOrder: true, expiresAt: true },
      orderBy: { startsAt: 'desc' },
    });
    const available = coupons.filter(c => true); // already filtered by active
    res.json({ coupons: available });
  } catch {
    res.json({ coupons: [] });
  }
});

/**
 * GET /api/storefront/notifications?userId=xxx
 * Returns user-facing notifications (requires userId query param).
 */
router.get('/notifications', async (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  if (!userId) { res.json({ notifications: [] }); return; }

  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const notifications = await prisma.notifications.findMany({
      where: {
        OR: [
          { user_id: userId },
          { audience: 'all' },
          { audience: 'customers' },
        ],
      },
      orderBy: { created_at: 'desc' },
      take: 20,
    });
    res.json({ notifications });
  } catch {
    res.json({ notifications: [] });
  }
});

export default router;
