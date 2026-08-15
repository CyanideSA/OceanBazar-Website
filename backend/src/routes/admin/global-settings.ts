import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

import { requireRole } from '../../middleware/auth';

const router = Router();

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
  try {
    let settings = await prisma.site_settings.findFirst({ where: { id: 'default' } });
    if (!settings) {
      settings = await prisma.site_settings.create({ data: { id: 'default' } });
    }
    res.json({ ...settings, ...camelizeObj(settings as any) });
  } catch (err: any) {
    console.error('[global-settings] GET failed:', err);
    res.status(500).json({ error: err?.message || 'Failed to load settings' });
  }
});

// PUT /api/admin/global-settings
router.put('/', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const data = req.body;
  // Whitelist allowed fields
  const allowed = [
    'support_email', 'support_phone', 'contact_address', 'business_inquiry_email',
    'facebook_url', 'twitter_url', 'instagram_url', 'youtube_url', 'threads_url',
    'hero_slides', 'product_banners',
    'featured_product_ids', 'best_deals_product_ids', 'new_arrivals_product_ids',
    'testimonials', 'trust_badges',
    'storefront_popups', 'app_download', 'default_hero_animation',
    'default_banner_rotation_ms', 'testimonial_carousel_ms',
    'sslcommerz_store_id', 'sslcommerz_store_password',
    'sslcommerz_sandbox_store_id', 'sslcommerz_sandbox_store_password',
    'sslcommerz_live_store_id', 'sslcommerz_live_store_password',
    'sslcommerz_mode',
    'legal_name', 'trade_license_no', 'tin_number', 'registered_address', 'management_details',
    'company_vision', 'leadership_intro', 'leadership_team',
    'pathao_client_id', 'pathao_client_secret', 'pathao_store_id',
    'steadfast_api_key', 'steadfast_secret_key', 'redx_api_key',
    'paperfly_username', 'paperfly_password', 'paperfly_key',
    'logo_dark_url', 'logo_light_url', 'favicon_url',
    'default_courier',
    'page_content',
  ];

  const updateData: Record<string, any> = { updated_at: new Date() };
  for (const key of allowed) {
    // Accept both snake_case and camelCase input
    const camelKey = toCamel(key);
    if (data[key] !== undefined) updateData[key] = data[key];
    else if (data[camelKey] !== undefined) updateData[key] = data[camelKey];
  }

  if (updateData.sslcommerz_mode != null) {
    const mode = String(updateData.sslcommerz_mode).toLowerCase();
    updateData.sslcommerz_mode = mode === 'live' ? 'live' : 'sandbox';
  }

  // Keep legacy columns in sync with active mode pair for older readers
  if (updateData.sslcommerz_mode === 'live') {
    if (updateData.sslcommerz_live_store_id !== undefined) {
      updateData.sslcommerz_store_id = updateData.sslcommerz_live_store_id;
    }
    if (updateData.sslcommerz_live_store_password !== undefined) {
      updateData.sslcommerz_store_password = updateData.sslcommerz_live_store_password;
    }
  } else if (updateData.sslcommerz_mode === 'sandbox' || updateData.sslcommerz_sandbox_store_id !== undefined) {
    if (updateData.sslcommerz_sandbox_store_id !== undefined) {
      updateData.sslcommerz_store_id = updateData.sslcommerz_sandbox_store_id;
    }
    if (updateData.sslcommerz_sandbox_store_password !== undefined) {
      updateData.sslcommerz_store_password = updateData.sslcommerz_sandbox_store_password;
    }
  }

  const settings = await prisma.site_settings.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...updateData },
    update: updateData,
  });

  // Invalidate Redis cache for storefront settings + SSL credential cache
  try {
    const { getRedisClient } = await import('../../cache/redisClient');
    const redis = await getRedisClient();
    if (redis) await redis.del('storefront:settings');
  } catch { /* non-fatal */ }
  try {
    const { invalidateSslCredentialCache } = await import('../../services/sslcommerzService');
    invalidateSslCredentialCache();
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

// POST /api/admin/global-settings/sslcommerz/test — credential connectivity check
router.post('/sslcommerz/test', requireRole('super_admin', 'admin'), async (_req: Request, res: Response) => {
  try {
    const { testSslConnection } = await import('../../services/sslcommerzService');
    const result = await testSslConnection();
    res.status(result.ok ? 200 : 400).json(result);
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err?.message || 'SSLCommerz test failed' });
  }
});

export default router;
