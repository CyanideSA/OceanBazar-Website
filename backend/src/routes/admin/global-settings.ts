import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireRole } from '../../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// snake_case -> camelCase helper
function toCamel(s: string) { return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase()); }
function camelizeObj(obj: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) out[toCamel(k)] = v;
  return out;
}
function toSnake(s: string) { return s.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`); }

// GET /api/admin/global-settings
router.get('/', async (_req: Request, res: Response) => {
  let settings = await prisma.site_settings.findFirst({ where: { id: 'default' } });
  if (!settings) {
    settings = await prisma.site_settings.create({ data: { id: 'default' } });
  }
  // Return both snake_case and camelCase for compatibility
  res.json({ ...settings, ...camelizeObj(settings as any) });
});

// PUT /api/admin/global-settings
router.put('/', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const data = req.body;
  // Whitelist allowed fields
  const allowed = [
    'support_email', 'support_phone',
    'facebook_url', 'twitter_url', 'instagram_url', 'youtube_url',
    'hero_slides', 'product_banners',
    'featured_product_ids', 'best_deals_product_ids', 'new_arrivals_product_ids',
    'testimonials', 'trust_badges',
    'default_banner_rotation_ms', 'testimonial_carousel_ms',
    'sslcommerz_store_id', 'sslcommerz_store_password',
    'pathao_client_id', 'pathao_client_secret', 'pathao_store_id',
    'steadfast_api_key', 'steadfast_secret_key', 'redx_api_key',
    'paperfly_username', 'paperfly_password', 'paperfly_key',
    'logo_dark_url', 'logo_light_url', 'favicon_url',
    'default_courier',
  ];

  const updateData: Record<string, any> = { updated_at: new Date() };
  for (const key of allowed) {
    // Accept both snake_case and camelCase input
    const camelKey = toCamel(key);
    if (data[key] !== undefined) updateData[key] = data[key];
    else if (data[camelKey] !== undefined) updateData[key] = data[camelKey];
  }

  const settings = await prisma.site_settings.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...updateData },
    update: updateData,
  });

  // Invalidate Redis cache for storefront settings
  try {
    const { getRedisClient } = await import('../../cache/redisClient');
    const redis = await getRedisClient();
    if (redis) await redis.del('storefront:settings');
  } catch { /* non-fatal */ }

  await prisma.auditLog.create({
    data: {
      adminId: req.admin!.adminId,
      action: 'UPDATE_GLOBAL_SETTINGS',
      targetType: 'site_settings',
      targetId: 'default',
      details: { updatedKeys: Object.keys(updateData).filter(k => k !== 'updated_at') },
    },
  });

  res.json(settings);
});

export default router;
