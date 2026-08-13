import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { requireRole } from '../../middleware/auth';

/**
 * Admin trust-badges router.
 *
 * Trust badges are stored as the `trust_badges` JSONB column on the single
 * `site_settings` row (id = "default"). This router exposes a focused
 * read/replace API for that field. The main admin CRM manages the same data
 * through /api/admin/global-settings; this endpoint is kept for parity and for
 * clients that only need the badge list.
 */
const router = Router();

async function loadSettings() {
  let settings = await prisma.site_settings.findFirst({ where: { id: 'default' } });
  if (!settings) {
    settings = await prisma.site_settings.create({ data: { id: 'default' } });
  }
  return settings;
}

// GET /api/admin/trust-badges — list configured trust badges
router.get('/', async (_req: Request, res: Response) => {
  try {
    const settings = await loadSettings();
    res.json({ trustBadges: (settings as any).trust_badges ?? [] });
  } catch (err: any) {
    console.error('[trust-badges] GET failed:', err);
    res.status(500).json({ error: err?.message || 'Failed to load trust badges' });
  }
});

// PUT /api/admin/trust-badges — replace the trust badge list
router.put('/', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const badges = req.body?.trustBadges ?? req.body?.trust_badges;
    if (!Array.isArray(badges)) {
      return res.status(400).json({ error: 'trustBadges must be an array' });
    }

    const settings = await prisma.site_settings.upsert({
      where: { id: 'default' },
      create: { id: 'default', trust_badges: badges, updated_at: new Date() },
      update: { trust_badges: badges, updated_at: new Date() },
    });

    try {
      const { getRedisClient } = await import('../../cache/redisClient');
      const redis = await getRedisClient();
      if (redis) await redis.del('storefront:settings');
    } catch { /* non-fatal */ }

    if (req.admin?.adminId) {
      await prisma.auditLog.create({
        data: {
          adminId: req.admin.adminId,
          action: 'UPDATE_TRUST_BADGES',
          targetType: 'site_settings',
          targetId: 'default',
          details: { count: badges.length },
        },
      });
    }

    res.json({ trustBadges: (settings as any).trust_badges ?? [] });
  } catch (err: any) {
    console.error('[trust-badges] PUT failed:', err);
    res.status(500).json({ error: err?.message || 'Failed to update trust badges' });
  }
});

export default router;
