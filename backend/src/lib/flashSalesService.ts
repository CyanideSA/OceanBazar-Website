import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { formatProduct } from '../routes/products';

const prisma = new PrismaClient();
let schemaReady = false;

export const MAX_FLASH_UNITS = 15;
export const MAX_PER_CUSTOMER_QTY = 15;

export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'completed';

export interface PricingRowSnap {
  price: number;
  compareAt: number | null;
  tier1MinQty?: number | null;
  tier1Discount?: number | null;
  tier2MinQty?: number | null;
  tier2Discount?: number | null;
  tier3MinQty?: number | null;
  tier3Discount?: number | null;
  tierBands?: unknown;
}

export interface FullPricingSnapshot {
  pricingMode: 'tiered' | 'non_tiered';
  retail: PricingRowSnap | null;
  wholesale: PricingRowSnap | null;
}

export interface FlashPricingSnapshot {
  pricingMode: 'tiered' | 'non_tiered';
  price: number;
  compareAt: number | null;
  tierBands?: unknown;
}

const PRODUCT_INCLUDE = {
  productAssets: { orderBy: { sortOrder: 'asc' as const }, take: 8 },
  pricing: true,
  productCategories: { include: { category: true } },
  brandRelation: true,
  productTags: { include: { tags: true } },
  metrics: true,
};

export interface FlashSaleItemRow {
  id: string;
  product_id: string;
  flash_price: number | string;
  flash_compare_at?: number | string | null;
  original_price?: number | string | null;
  original_compare_at?: number | string | null;
  include_delivery?: boolean;
  max_units: number;
  reserved: number;
  sold: number;
  available?: number;
  pricing_applied?: boolean;
  pricing_mode?: string;
  per_customer_limit?: number;
  original_pricing_snapshot?: FullPricingSnapshot | null;
  flash_pricing_snapshot?: FlashPricingSnapshot | null;
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function rowToSnap(row: Record<string, unknown> | undefined): PricingRowSnap | null {
  if (!row) return null;
  return {
    price: num(row.price) ?? 0,
    compareAt: num(row.compare_at ?? row.compareAt),
    tier1MinQty: num(row.tier1_min_qty ?? row.tier1MinQty) as number | null,
    tier1Discount: num(row.tier1_discount ?? row.tier1Discount) as number | null,
    tier2MinQty: num(row.tier2_min_qty ?? row.tier2MinQty) as number | null,
    tier2Discount: num(row.tier2_discount ?? row.tier2Discount) as number | null,
    tier3MinQty: num(row.tier3_min_qty ?? row.tier3MinQty) as number | null,
    tier3Discount: num(row.tier3_discount ?? row.tier3Discount) as number | null,
    tierBands: row.tier_bands ?? row.tierBands ?? null,
  };
}

export async function ensureFlashSaleSchema(): Promise<void> {
  if (schemaReady) return;
  schemaReady = true;
}

export function computeCampaignStatus(
  sale: { campaign_status?: string; is_active?: boolean; starts_at: Date | string; ends_at: Date | string },
  now = new Date(),
): CampaignStatus {
  const start = new Date(sale.starts_at);
  const end = new Date(sale.ends_at);
  if (sale.campaign_status === 'draft' || sale.is_active === false) {
    if (end < now && sale.campaign_status !== 'draft') return 'completed';
    return 'draft';
  }
  if (end < now) return 'completed';
  if (start > now) return 'scheduled';
  return 'running';
}

export async function snapshotFullProductPricing(productId: string): Promise<FullPricingSnapshot> {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT customer_type, price, compare_at,
      tier1_min_qty, tier1_discount, tier2_min_qty, tier2_discount, tier3_min_qty, tier3_discount,
      tier_bands
    FROM product_pricing WHERE product_id = ${productId}
  `;
  const product = await prisma.$queryRaw<{ pricing_mode: string }[]>`
    SELECT pricing_mode FROM products WHERE id = ${productId} LIMIT 1
  `;
  const retailRow = rows.find((r) => r.customer_type === 'retail');
  const wholesaleRow = rows.find((r) => r.customer_type === 'wholesale');
  const pricingMode =
    product[0]?.pricing_mode === 'tiered' ? 'tiered' : 'non_tiered';
  return {
    pricingMode,
    retail: rowToSnap(retailRow),
    wholesale: rowToSnap(wholesaleRow),
  };
}

export function buildFlashPricingSnapshot(
  item: {
    flash_price: number;
    flash_compare_at?: number | null;
    pricing_mode?: string;
    flash_tier_bands?: unknown;
  },
  original: FullPricingSnapshot,
): FlashPricingSnapshot {
  const mode =
    item.pricing_mode === 'tiered' || original.pricingMode === 'tiered'
      ? 'tiered'
      : 'non_tiered';
  return {
    pricingMode: mode,
    price: item.flash_price,
    compareAt: item.flash_compare_at ?? original.retail?.compareAt ?? original.retail?.price ?? null,
    tierBands:
      mode === 'tiered'
        ? item.flash_tier_bands ?? original.retail?.tierBands ?? null
        : null,
  };
}

async function applyPricingRow(productId: string, customerType: string, snap: PricingRowSnap) {
  await prisma.$executeRaw`
    UPDATE product_pricing SET
      price = ${snap.price},
      compare_at = ${snap.compareAt},
      tier1_min_qty = ${snap.tier1MinQty ?? null},
      tier1_discount = ${snap.tier1Discount ?? null},
      tier2_min_qty = ${snap.tier2MinQty ?? null},
      tier2_discount = ${snap.tier2Discount ?? null},
      tier3_min_qty = ${snap.tier3MinQty ?? null},
      tier3_discount = ${snap.tier3Discount ?? null},
      tier_bands = ${snap.tierBands != null ? JSON.stringify(snap.tierBands) : null}::jsonb
    WHERE product_id = ${productId} AND customer_type = ${customerType}
  `;
}

function flashSnapToRetailRow(flash: FlashPricingSnapshot): PricingRowSnap {
  if (flash.pricingMode === 'tiered' && flash.tierBands) {
    return {
      price: flash.price,
      compareAt: flash.compareAt,
      tierBands: flash.tierBands,
      tier1MinQty: null,
      tier1Discount: null,
      tier2MinQty: null,
      tier2Discount: null,
      tier3MinQty: null,
      tier3Discount: null,
    };
  }
  return {
    price: flash.price,
    compareAt: flash.compareAt,
    tier1MinQty: null,
    tier1Discount: null,
    tier2MinQty: null,
    tier2Discount: null,
    tier3MinQty: null,
    tier3Discount: null,
    tierBands: null,
  };
}

export async function revertSalePricing(saleId: string): Promise<void> {
  await ensureFlashSaleSchema();
  const items = await prisma.$queryRaw<FlashSaleItemRow[]>`
    SELECT id, product_id, original_pricing_snapshot, pricing_applied
    FROM flash_sale_items
    WHERE flash_sale_id = ${saleId} AND pricing_applied = TRUE
  `;

  for (const item of items) {
    const snap = item.original_pricing_snapshot as FullPricingSnapshot | null;
    if (snap?.retail) {
      await applyPricingRow(item.product_id, 'retail', snap.retail);
    }
    if (snap?.wholesale) {
      await applyPricingRow(item.product_id, 'wholesale', snap.wholesale);
    } else if (snap && !snap.wholesale) {
      /* wholesale unchanged */
    }
    if (snap?.pricingMode) {
      await prisma.$executeRaw`
        UPDATE products SET pricing_mode = ${snap.pricingMode} WHERE id = ${item.product_id}
      `;
    }
    await prisma.$executeRaw`
      UPDATE flash_sale_items SET pricing_applied = FALSE WHERE id = ${item.id}
    `;
  }
}

export async function applySalePricing(saleId: string): Promise<void> {
  await ensureFlashSaleSchema();
  const items = await prisma.$queryRaw<FlashSaleItemRow[]>`
    SELECT id, product_id, flash_pricing_snapshot, original_pricing_snapshot, pricing_applied
    FROM flash_sale_items WHERE flash_sale_id = ${saleId}
  `;

  for (const item of items) {
    if (item.pricing_applied) continue;
    let flash = item.flash_pricing_snapshot as FlashPricingSnapshot | null;
    if (!flash) continue;

    await prisma.$executeRaw`
      UPDATE products SET pricing_mode = 'non_tiered' WHERE id = ${item.product_id}
    `;
    if (flash.pricingMode === 'tiered') {
      await prisma.$executeRaw`
        UPDATE products SET pricing_mode = 'tiered' WHERE id = ${item.product_id}
      `;
    }

    await applyPricingRow(item.product_id, 'retail', flashSnapToRetailRow(flash));

    await prisma.$executeRaw`
      UPDATE flash_sale_items SET pricing_applied = TRUE WHERE id = ${item.id}
    `;
  }
}

export async function syncCampaignStatuses(): Promise<void> {
  await ensureFlashSaleSchema();
  const now = new Date();
  await prisma.$executeRaw`
    UPDATE flash_sales SET campaign_status = 'completed'
    WHERE ends_at < ${now} AND campaign_status != 'draft'
  `;
  await prisma.$executeRaw`
    UPDATE flash_sales SET campaign_status = 'running'
    WHERE is_active = TRUE AND starts_at <= ${now} AND ends_at >= ${now}
  `;
  await prisma.$executeRaw`
    UPDATE flash_sales SET campaign_status = 'scheduled'
    WHERE is_active = TRUE AND starts_at > ${now}
  `;
}

export async function syncFlashSalePricingLifecycle(): Promise<void> {
  await syncCampaignStatuses();
  const now = new Date();

  const toRevert = await prisma.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT fs.id FROM flash_sales fs
    JOIN flash_sale_items fsi ON fsi.flash_sale_id = fs.id
    WHERE fsi.pricing_applied = TRUE
      AND (fs.campaign_status = 'completed' OR fs.campaign_status = 'draft' OR fs.is_active = FALSE OR fs.ends_at < ${now})
  `;
  for (const row of toRevert) {
    await revertSalePricing(row.id);
  }

  const toApply = await prisma.$queryRaw<{ id: string }[]>`
    SELECT fs.id FROM flash_sales fs
    WHERE fs.campaign_status = 'running'
      AND fs.is_active = TRUE
      AND fs.starts_at <= ${now}
      AND fs.ends_at >= ${now}
  `;
  for (const row of toApply) {
    await applySalePricing(row.id);
  }
}

const ITEMS_AGG = `
  json_agg(
    json_build_object(
      'id', fsi.id,
      'product_id', fsi.product_id,
      'flash_price', fsi.flash_price,
      'flash_compare_at', fsi.flash_compare_at,
      'original_price', fsi.original_price,
      'original_compare_at', fsi.original_compare_at,
      'include_delivery', COALESCE(fsi.include_delivery, TRUE),
      'pricing_mode', fsi.pricing_mode,
      'per_customer_limit', COALESCE(fsi.per_customer_limit, 15),
      'max_units', fsi.max_units,
      'reserved', fsi.reserved,
      'sold', fsi.sold,
      'available', GREATEST(0, fsi.max_units - fsi.reserved - fsi.sold),
      'flash_pricing_snapshot', fsi.flash_pricing_snapshot,
      'original_pricing_snapshot', fsi.original_pricing_snapshot
    )
    ORDER BY fsi.flash_price ASC
  ) FILTER (WHERE fsi.id IS NOT NULL) AS items
`;

export async function fetchActiveSales(now: Date, limit = 3): Promise<any[]> {
  await syncFlashSalePricingLifecycle();
  const sales = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      fs.id, fs.name, fs.discount_type, fs.discount_value,
      fs.starts_at, fs.ends_at, fs.banner_text, fs.banner_color,
      fs.campaign_status, fs.is_active,
      ${ITEMS_AGG}
    FROM flash_sales fs
    LEFT JOIN flash_sale_items fsi ON fsi.flash_sale_id = fs.id
    WHERE fs.campaign_status = 'running'
      AND fs.is_active = TRUE
      AND fs.starts_at <= $1
      AND fs.ends_at >= $1
    GROUP BY fs.id
    ORDER BY fs.ends_at ASC
    LIMIT $2
  `, now, limit);
  return sales || [];
}

export async function fetchUpcomingSales(now: Date, limit = 3): Promise<any[]> {
  await syncCampaignStatuses();
  const sales = await prisma.$queryRaw<any[]>`
    SELECT id, name, starts_at, ends_at, banner_text, banner_color, campaign_status
    FROM flash_sales
    WHERE campaign_status = 'scheduled' AND is_active = TRUE AND starts_at > ${now}
    ORDER BY starts_at ASC
    LIMIT ${limit}
  `;
  return sales || [];
}

export async function fetchSaleById(saleId: string): Promise<any | null> {
  const sales = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      fs.id, fs.name, fs.discount_type, fs.discount_value,
      fs.starts_at, fs.ends_at, fs.banner_text, fs.banner_color,
      fs.is_active, fs.campaign_status,
      ${ITEMS_AGG}
    FROM flash_sales fs
    LEFT JOIN flash_sale_items fsi ON fsi.flash_sale_id = fs.id
    WHERE fs.id = $1
    GROUP BY fs.id
    LIMIT 1
  `, saleId);
  return sales?.[0] ?? null;
}

export async function loadProductsForSale(
  sale: { id: string; items?: FlashSaleItemRow[] },
  lang: string,
  limit?: number,
): Promise<any[]> {
  const items: FlashSaleItemRow[] = Array.isArray(sale.items) ? sale.items : [];
  const productIds = items.map((i) => i.product_id).filter(Boolean);
  const ids = limit ? productIds.slice(0, limit) : productIds;
  if (ids.length === 0) return [];

  const metaByProduct = new Map(items.map((i) => [i.product_id, i]));
  const prismaAny = prisma as any;
  const rows = await prismaAny.product.findMany({
    where: { id: { in: ids }, status: 'active' },
    include: PRODUCT_INCLUDE,
  });

  const orderIndex = new Map(ids.map((id, idx) => [id, idx]));
  rows.sort(
    (a: { id: string }, b: { id: string }) =>
      (orderIndex.get(a.id) ?? 99) - (orderIndex.get(b.id) ?? 99),
  );

  return rows.map((p: any) => {
    const formatted = formatProduct(p, lang);
    const meta = metaByProduct.get(p.id);
    if (!meta) return formatted;

    const flash = meta.flash_pricing_snapshot as FlashPricingSnapshot | null;
    const flashPrice = flash?.price != null ? Number(flash.price) : Number(meta.flash_price);
    const original =
      meta.original_price != null
        ? Number(meta.original_price)
        : Number(formatted.pricing?.retail?.price ?? flashPrice);
    const compareAt =
      flash?.compareAt != null
        ? Number(flash.compareAt)
        : meta.flash_compare_at != null
          ? Number(meta.flash_compare_at)
          : original > flashPrice
            ? original
            : formatted.pricing?.retail?.compareAt ?? original;

    if (formatted.pricing?.retail) {
      formatted.pricing = {
        ...formatted.pricing,
        retail: {
          ...formatted.pricing.retail,
          price: flashPrice,
          compareAt: compareAt > flashPrice ? compareAt : original,
          ...(flash?.tierBands ? { tierBands: flash.tierBands } : {}),
        },
      };
    }
    formatted.retailPrice = flashPrice;
    (formatted as { flashDeal?: boolean }).flashDeal = true;
    (formatted as { flashFreeDelivery?: boolean }).flashFreeDelivery = meta.include_delivery === false;
    (formatted as { flashSaleId?: string }).flashSaleId = sale.id;
    (formatted as { flashPerCustomerLimit?: number }).flashPerCustomerLimit =
      meta.per_customer_limit ?? MAX_PER_CUSTOMER_QTY;
    return formatted;
  });
}

export async function buildActivePayload(lang: string, homeLimit = 12) {
  const now = new Date();
  const activeRows = await fetchActiveSales(now, 3);
  const campaigns = await Promise.all(
    activeRows.map(async (sale) => ({
      sale,
      products: await loadProductsForSale(sale, lang, homeLimit),
    })),
  );
  const upcoming = await fetchUpcomingSales(now, 3);
  const hasActive = campaigns.some((c) => c.products.length > 0);

  return {
    hasActive,
    activeCount: campaigns.filter((c) => c.products.length > 0).length,
    campaigns,
    upcoming,
    sale: campaigns[0]?.sale ?? null,
    products: campaigns[0]?.products ?? [],
  };
}

export async function getCampaignReport(saleId: string) {
  const sale = await fetchSaleById(saleId);
  if (!sale) return null;

  const productRows = await prisma.$queryRaw<any[]>`
    SELECT
      fsi.*,
      p.title_en,
      p.sku,
      (fsi.sold::numeric * fsi.flash_price) AS revenue,
      GREATEST(0, fsi.max_units - fsi.reserved - fsi.sold) AS remaining
    FROM flash_sale_items fsi
    JOIN products p ON p.id = fsi.product_id
    WHERE fsi.flash_sale_id = ${saleId}
    ORDER BY fsi.sold DESC, fsi.flash_price ASC
  `;

  const orderRows = await prisma.$queryRaw<any[]>`
    SELECT
      o.id AS order_id,
      o.status AS order_status,
      o.created_at,
      o.total AS order_total,
      oi.id AS line_id,
      oi.product_id,
      oi.product_title,
      oi.quantity,
      oi.unit_price,
      oi.line_total,
      fsi.flash_price AS campaign_flash_price
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN flash_sale_items fsi ON fsi.product_id = oi.product_id AND fsi.flash_sale_id = ${saleId}
    WHERE o.created_at >= (SELECT starts_at FROM flash_sales WHERE id = ${saleId})
      AND o.created_at <= (SELECT ends_at FROM flash_sales WHERE id = ${saleId})
    ORDER BY o.created_at DESC, o.id DESC
  `;

  const summary = {
    totalUnitsSold: productRows.reduce((s, r) => s + Number(r.sold || 0), 0),
    totalRevenue: productRows.reduce((s, r) => s + Number(r.revenue || 0), 0),
    orderCount: new Set(orderRows.map((r) => r.order_id)).size,
    productCount: productRows.length,
  };

  return { sale, summary, products: productRows, orders: orderRows };
}

export async function insertSaleItems(
  saleId: string,
  items: Array<{
    product_id: string;
    flash_price: number;
    flash_compare_at?: number | null;
    max_units: number;
    include_delivery?: boolean;
    pricing_mode?: string;
    flash_tier_bands?: unknown;
    per_customer_limit?: number;
  }>,
  captureSnapshots = true,
) {
  for (const item of items) {
    const maxUnits = Math.min(MAX_FLASH_UNITS, Math.max(1, Number(item.max_units) || 1));
    const perLimit = Math.min(
      MAX_PER_CUSTOMER_QTY,
      Math.max(1, Number(item.per_customer_limit) || MAX_PER_CUSTOMER_QTY),
    );
    const fullSnap = captureSnapshots ? await snapshotFullProductPricing(item.product_id) : null;
    const flashSnap = fullSnap
      ? buildFlashPricingSnapshot(item, fullSnap)
      : buildFlashPricingSnapshot(item, {
          pricingMode: 'non_tiered',
          retail: { price: item.flash_price, compareAt: item.flash_compare_at ?? null },
          wholesale: null,
        });

    await prisma.$executeRaw`
      INSERT INTO flash_sale_items (
        id, flash_sale_id, product_id, flash_price, flash_compare_at,
        original_price, original_compare_at, include_delivery,
        pricing_mode, per_customer_limit, max_units, reserved, sold, pricing_applied,
        original_pricing_snapshot, flash_pricing_snapshot
      )
      VALUES (
        ${uuidv4()}, ${saleId}, ${item.product_id}, ${item.flash_price},
        ${item.flash_compare_at ?? null},
        ${fullSnap?.retail?.price ?? item.flash_price},
        ${fullSnap?.retail?.compareAt ?? null},
        ${item.include_delivery !== false},
        ${flashSnap.pricingMode},
        ${perLimit},
        ${maxUnits}, 0, 0, FALSE,
        ${fullSnap ? JSON.stringify(fullSnap) : null}::jsonb,
        ${JSON.stringify(flashSnap)}::jsonb
      )
    `;
  }
}

export function resolveInitialStatus(
  saveAsDraft: boolean,
  startDate: Date,
  endDate: Date,
  now = new Date(),
): { campaign_status: CampaignStatus; is_active: boolean } {
  if (saveAsDraft) return { campaign_status: 'draft', is_active: false };
  if (endDate < now) return { campaign_status: 'completed', is_active: false };
  if (startDate > now) return { campaign_status: 'scheduled', is_active: true };
  return { campaign_status: 'running', is_active: true };
}

/** Activate a draft campaign (scheduled or running). Used by schedule route and approval queue. */
export async function scheduleFlashCampaign(saleId: string) {
  await ensureFlashSaleSchema();
  const sale = await fetchSaleById(saleId);
  if (!sale) throw new Error('Campaign not found');
  const now = new Date();
  if (new Date(sale.ends_at) < now) throw new Error('End date is in the past');
  const campaign_status: CampaignStatus =
    new Date(sale.starts_at) > now ? 'scheduled' : 'running';
  await prisma.$executeRaw`
    UPDATE flash_sales SET is_active = TRUE, campaign_status = ${campaign_status} WHERE id = ${saleId}
  `;
  if (campaign_status === 'running') await applySalePricing(saleId);
  return { ok: true, campaign_status };
}
