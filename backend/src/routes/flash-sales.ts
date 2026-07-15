/**
 * Flash Sales — campaign lifecycle, pricing snapshots, analytics
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../middleware/auth';
import { routeParam } from '../utils/params';
import { v4 as uuidv4 } from 'uuid';
import { emitBroadcast } from '../lib/adminEvents';
import { applyOrQueueChange } from '../lib/adminGovernance';
import {
  applySalePricing,
  buildActivePayload,
  computeCampaignStatus,
  ensureFlashSaleSchema,
  fetchActiveSales,
  fetchSaleById,
  fetchUpcomingSales,
  getCampaignReport,
  insertSaleItems,
  loadProductsForSale,
  MAX_FLASH_UNITS,
  MAX_PER_CUSTOMER_QTY,
  resolveInitialStatus,
  revertSalePricing,
  syncFlashSalePricingLifecycle,
  syncCampaignStatuses,
  scheduleFlashCampaign,
} from '../lib/flashSalesService';

const router = Router();
const prisma = new PrismaClient();
let hasWarnedMissingFlashTables = false;

const RESERVED = new Set(['active', 'upcoming', 'validate', 'page', 'status', 'report', 'admin']);

type ItemInput = {
  product_id: string;
  flash_price: number;
  flash_compare_at?: number | null;
  max_units: number;
  include_delivery?: boolean;
  pricing_mode?: string;
  flash_tier_bands?: unknown;
  per_customer_limit?: number;
};

function isMissingFlashSalesTable(err: unknown): boolean {
  const msg = (err as { message?: string })?.message ?? '';
  return msg.includes('42P01') && msg.includes('flash_sales');
}

function handleFlashError(res: Response, err: unknown, empty: Record<string, unknown>) {
  if (isMissingFlashSalesTable(err)) {
    if (!hasWarnedMissingFlashTables) {
      hasWarnedMissingFlashTables = true;
      console.warn('[flash-sale] flash_sales tables not found; returning empty sale data.');
    }
  } else {
    console.error('[flash-sale] error:', (err as Error)?.message);
  }
  res.json(empty);
}

function validateItems(items: ItemInput[]): string | null {
  if (!items.length) return 'Add at least one product';
  for (const item of items) {
    if (!item.product_id) return 'Invalid product';
    if (Number(item.max_units) > MAX_FLASH_UNITS) {
      return `Max units per product is ${MAX_FLASH_UNITS}`;
    }
    if (Number(item.per_customer_limit ?? MAX_PER_CUSTOMER_QTY) > MAX_PER_CUSTOMER_QTY) {
      return `Per-customer quantity limit is ${MAX_PER_CUSTOMER_QTY}`;
    }
  }
  return null;
}

// ─── Public ─────────────────────────────────────────────────────────────────

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const payload = await buildActivePayload('en', 1);
    res.json({
      hasActive: payload.hasActive,
      activeCount: payload.activeCount,
      upcomingCount: payload.upcoming.length,
    });
  } catch (err) {
    handleFlashError(res, err, { hasActive: false, activeCount: 0, upcomingCount: 0 });
  }
});

router.get('/active', async (req: Request, res: Response) => {
  const lang = String(req.query.lang || 'en');
  try {
    res.json(await buildActivePayload(lang, 12));
  } catch (err) {
    handleFlashError(res, err, {
      hasActive: false,
      activeCount: 0,
      campaigns: [],
      upcoming: [],
      sale: null,
      products: [],
    });
  }
});

router.get('/page', async (req: Request, res: Response) => {
  const lang = String(req.query.lang || 'en');
  const saleFilter = req.query.sale ? String(req.query.sale) : null;
  try {
    await syncFlashSalePricingLifecycle();
    const activeRows = await fetchActiveSales(new Date(), 3);
    const upcoming = await fetchUpcomingSales(new Date(), 3);
    let campaigns = await Promise.all(
      activeRows.map(async (sale) => ({
        sale,
        products: await loadProductsForSale(sale, lang),
      })),
    );
    campaigns = campaigns.filter((c) => c.products.length > 0);
    if (saleFilter) campaigns = campaigns.filter((c) => c.sale.id === saleFilter);

    res.json({
      mode: campaigns.length > 0 ? 'live' : upcoming.length > 0 ? 'upcoming' : 'empty',
      campaigns,
      upcoming,
      hasActive: campaigns.length > 0,
    });
  } catch (err) {
    handleFlashError(res, err, { mode: 'empty', campaigns: [], upcoming: [], hasActive: false });
  }
});

router.get('/upcoming', async (_req: Request, res: Response) => {
  try {
    res.json({ sales: await fetchUpcomingSales(new Date(), 3) });
  } catch {
    res.json({ sales: [] });
  }
});

router.post('/validate', async (req: Request, res: Response) => {
  const { productId, quantity = 1 } = req.body as { productId: string; quantity: number };
  if (!productId) {
    res.status(400).json({ error: 'productId required' });
    return;
  }
  try {
    const now = new Date();
    const items = await prisma.$queryRaw<any[]>`
      SELECT fsi.id, fsi.flash_price, fsi.max_units, fsi.reserved, fsi.sold,
             fsi.include_delivery, fsi.per_customer_limit, fs.ends_at
      FROM flash_sale_items fsi
      JOIN flash_sales fs ON fs.id = fsi.flash_sale_id
      WHERE fsi.product_id = ${productId}
        AND fs.campaign_status = 'running'
        AND fs.is_active = TRUE
        AND fs.starts_at <= ${now}
        AND fs.ends_at >= ${now}
      LIMIT 1
    `;
    if (!items?.length) {
      res.json({ valid: false, flashPrice: null, reason: 'No active flash sale' });
      return;
    }
    const item = items[0];
    const perLimit = Math.min(MAX_PER_CUSTOMER_QTY, Number(item.per_customer_limit) || MAX_PER_CUSTOMER_QTY);
    if (quantity > perLimit) {
      res.json({ valid: false, flashPrice: null, reason: `Maximum ${perLimit} per customer` });
      return;
    }
    const available = Math.max(0, item.max_units - item.reserved - item.sold);
    if (available < quantity) {
      res.json({ valid: false, flashPrice: null, reason: 'Insufficient flash sale stock' });
      return;
    }
    res.json({
      valid: true,
      flashPrice: Number(item.flash_price),
      available,
      perCustomerLimit: perLimit,
      endsAt: item.ends_at,
      includeDelivery: item.include_delivery !== false,
      freeDelivery: item.include_delivery === false,
    });
  } catch {
    res.json({ valid: false, flashPrice: null, reason: 'Error validating flash sale' });
  }
});

// ─── Admin: list ─────────────────────────────────────────────────────────────

router.get('/', requireAdmin, async (_req: Request, res: Response) => {
  try {
    await syncCampaignStatuses();
    const sales = await prisma.$queryRaw<any[]>`
      SELECT fs.*,
        COUNT(fsi.id)::int AS item_count,
        COALESCE(SUM(fsi.sold), 0)::int AS total_sold,
        COALESCE(SUM(fsi.sold::numeric * fsi.flash_price), 0)::float AS total_revenue
      FROM flash_sales fs
      LEFT JOIN flash_sale_items fsi ON fsi.flash_sale_id = fs.id
      GROUP BY fs.id
      ORDER BY fs.starts_at DESC
    `;
    const enriched = (sales || []).map((s) => ({
      ...s,
      computed_status: computeCampaignStatus(s),
    }));
    res.json({ sales: enriched });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: create ───────────────────────────────────────────────────────────

router.post('/', requireAdmin, async (req: Request, res: Response) => {
  const {
    name,
    discount_type = 'fixed',
    discount_value,
    starts_at,
    ends_at,
    banner_text,
    banner_color = '#ef4444',
    items = [],
    save_as_draft = false,
  } = req.body as {
    name: string;
    discount_type?: string;
    discount_value?: number;
    starts_at: string;
    ends_at: string;
    banner_text?: string;
    banner_color?: string;
    items: ItemInput[];
    save_as_draft?: boolean;
  };

  if (!name || !starts_at || !ends_at) {
    if (!save_as_draft) {
      res.status(400).json({ error: 'name, starts_at, ends_at required' });
      return;
    }
  }
  if (!save_as_draft) {
    const itemErr = validateItems(items);
    if (itemErr) {
      res.status(400).json({ error: itemErr });
      return;
    }
  }

  const saleId = uuidv4();
  const startDate = new Date(starts_at || Date.now());
  const endDate = new Date(ends_at || Date.now() + 7 * 86400000);
  const safeName = name || 'New campaign';
  const { campaign_status, is_active } = resolveInitialStatus(!!save_as_draft, startDate, endDate);

  try {
    await ensureFlashSaleSchema();
    await prisma.$executeRaw`
      INSERT INTO flash_sales (
        id, name, discount_type, discount_value, starts_at, ends_at,
        banner_text, banner_color, is_active, campaign_status, created_at
      )
      VALUES (
        ${saleId}, ${safeName}, ${discount_type}, ${discount_value ?? null},
        ${startDate}, ${endDate}, ${banner_text ?? null}, ${banner_color},
        ${is_active}, ${campaign_status}, NOW()
      )
    `;
    if (items.length) await insertSaleItems(saleId, items, true);
    if (campaign_status === 'running') await applySalePricing(saleId);
    emitBroadcast('flash_sale:update', { saleId, status: campaign_status });
    res.status(201).json({ id: saleId, campaign_status, message: 'Flash campaign saved' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: get detail (edit) ────────────────────────────────────────────────

router.get('/:id/admin', requireAdmin, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  if (RESERVED.has(id)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  try {
    const sale = await fetchSaleById(id);
    if (!sale) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({
      sale: { ...sale, computed_status: computeCampaignStatus(sale) },
      items: sale.items || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: report ───────────────────────────────────────────────────────────

router.get('/:id/report', requireAdmin, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  if (RESERVED.has(id)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  try {
    const report = await getCampaignReport(id);
    if (!report) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({
      ...report,
      sale: { ...report.sale, computed_status: computeCampaignStatus(report.sale) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: update ───────────────────────────────────────────────────────────

router.put('/:id', requireAdmin, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const {
    name,
    starts_at,
    ends_at,
    banner_text,
    banner_color,
    items,
    save_as_draft,
  } = req.body as {
    name?: string;
    starts_at?: string;
    ends_at?: string;
    banner_text?: string;
    banner_color?: string;
    items?: ItemInput[];
    save_as_draft?: boolean;
  };

  try {
    const existing = await fetchSaleById(id);
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const status = computeCampaignStatus(existing);
    if (status === 'completed') {
      res.status(400).json({ error: 'Completed campaigns cannot be edited' });
      return;
    }

    if (items && !save_as_draft) {
      const itemErr = validateItems(items);
      if (itemErr) {
        res.status(400).json({ error: itemErr });
        return;
      }
    }

    const wasRunning = status === 'running';
    const startDate = starts_at ? new Date(starts_at) : new Date(existing.starts_at);
    const endDate = ends_at ? new Date(ends_at) : new Date(existing.ends_at);

    if (wasRunning) await revertSalePricing(id);
    const { campaign_status, is_active } =
      save_as_draft === true
        ? { campaign_status: 'draft' as const, is_active: false }
        : resolveInitialStatus(false, startDate, endDate);

    await prisma.$executeRaw`
      UPDATE flash_sales SET
        name = COALESCE(${name ?? null}, name),
        starts_at = ${startDate},
        ends_at = ${endDate},
        banner_text = COALESCE(${banner_text ?? null}, banner_text),
        banner_color = COALESCE(${banner_color ?? null}, banner_color),
        is_active = ${is_active},
        campaign_status = ${campaign_status}
      WHERE id = ${id}
    `;

    if (items) {
      await prisma.$executeRaw`DELETE FROM flash_sale_items WHERE flash_sale_id = ${id}`;
      if (items.length) await insertSaleItems(id, items, true);
    }

    if (campaign_status === 'running') await applySalePricing(id);
    emitBroadcast('flash_sale:update', { saleId: id, status: campaign_status });
    res.json({ ok: true, campaign_status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: schedule (draft → scheduled) ─────────────────────────────────────

router.post('/:id/schedule', requireAdmin, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  try {
    const sale = await fetchSaleById(id);
    if (!sale) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const label = sale.name || id;

    const result = await applyOrQueueChange(req, {
      module: 'flashSales',
      action: 'schedule',
      resourceId: id,
      resourceLabel: label,
      summary: `Schedule flash campaign "${label}" for publication`,
      payload: { saleId: id },
      apply: async () => scheduleFlashCampaign(id),
    });

    if (result.pending) {
      res.status(202).json(result);
      return;
    }
    res.json(result.result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: complete early ───────────────────────────────────────────────────

router.post('/:id/complete', requireAdmin, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  try {
    await revertSalePricing(id);
    await prisma.$executeRaw`
      UPDATE flash_sales SET campaign_status = 'completed', is_active = FALSE WHERE id = ${id}
    `;
    emitBroadcast('flash_sale:update', { saleId: id, status: 'completed' });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: toggle (legacy) ──────────────────────────────────────────────────

router.patch('/:id/toggle', requireAdmin, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const { active } = req.body as { active: boolean };
  try {
    if (!active) {
      await revertSalePricing(id);
      await prisma.$executeRaw`
        UPDATE flash_sales SET is_active = FALSE, campaign_status = 'draft' WHERE id = ${id}
      `;
    } else {
      const sale = await fetchSaleById(id);
      if (!sale) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      const st = resolveInitialStatus(false, new Date(sale.starts_at), new Date(sale.ends_at));
      await prisma.$executeRaw`
        UPDATE flash_sales SET is_active = TRUE, campaign_status = ${st.campaign_status} WHERE id = ${id}
      `;
      if (st.campaign_status === 'running') await applySalePricing(id);
    }
    emitBroadcast('flash_sale:update', { saleId: id, active });
    res.json({ ok: true, active });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  try {
    await revertSalePricing(id);
    await prisma.$executeRaw`DELETE FROM flash_sale_items WHERE flash_sale_id = ${id}`;
    await prisma.$executeRaw`DELETE FROM flash_sales WHERE id = ${id}`;
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Public: single sale ─────────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response) => {
  const lang = String(req.query.lang || 'en');
  const id = routeParam(req.params.id);
  if (RESERVED.has(id) || id.endsWith('/admin') || id.endsWith('/report')) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  try {
    const sale = await fetchSaleById(id);
    if (!sale) {
      res.status(404).json({ error: 'Flash sale not found' });
      return;
    }
    const products = await loadProductsForSale(sale, lang);
    res.json({ sale, products });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
