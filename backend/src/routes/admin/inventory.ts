import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

import { v4 as uuidv4 } from 'uuid';
import { routeParam } from '../../utils/params';

const router = Router();

async function maybeAlertLowStock(
  item: { product_id: string; sku: string | null; quantity_available: number; status: string },
  previousStatus: string,
): Promise<void> {
  if (item.status !== 'low_stock' || previousStatus === 'low_stock') return;
  const { alertLowStock } = await import('../../services/teamsService');
  let title = item.sku || item.product_id;
  try {
    const product = await prisma.product.findUnique({
      where: { id: item.product_id },
      select: { titleEn: true },
    });
    if (product?.titleEn) title = product.titleEn;
  } catch { /* non-fatal */ }
  alertLowStock(title, item.quantity_available).catch(() => {});
}

// GET /api/admin/inventory/analytics
router.get('/analytics', async (_req: Request, res: Response) => {
  try {
    const [stockByCategory, lowStockRow, valueRow, movementTrend] = await Promise.all([
      prisma.$queryRaw<Array<{ category: string; units: number; sku_count: number }>>`
        SELECT
          COALESCE(c.name_en, 'Uncategorized') AS category,
          SUM(ii.quantity_on_hand)::int AS units,
          COUNT(DISTINCT ii.id)::int AS sku_count
        FROM inventory_items ii
        LEFT JOIN products p ON p.id = ii.product_id
        LEFT JOIN product_category_map pc ON pc.product_id = p.id AND pc.is_primary = true
        LEFT JOIN categories c ON c.id = pc.category_id
        GROUP BY c.name_en
        ORDER BY units DESC
        LIMIT 10
      `,
      prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(*)::bigint AS c FROM inventory_items
        WHERE status IN ('low_stock', 'out_of_stock')
           OR quantity_available <= reorder_point
      `,
      prisma.$queryRaw<Array<{ total_value: number | string }>>`
        SELECT COALESCE(SUM(ii.quantity_on_hand * COALESCE(pp.price, 0)), 0)::float AS total_value
        FROM inventory_items ii
        LEFT JOIN product_pricing pp
          ON pp.product_id = ii.product_id AND pp.customer_type = 'retail'
      `,
      prisma.$queryRaw<Array<{ day: Date; inbound: number; outbound: number }>>`
        SELECT
          DATE(created_at) AS day,
          COALESCE(SUM(CASE WHEN type IN ('adjustment_in', 'restock', 'set_quantity') THEN ABS(quantity) ELSE 0 END), 0)::int AS inbound,
          COALESCE(SUM(CASE WHEN type IN ('adjustment_out', 'sale', 'deduct') THEN ABS(quantity) ELSE 0 END), 0)::int AS outbound
        FROM inventory_transactions
        WHERE created_at >= NOW() - INTERVAL '14 days'
        GROUP BY DATE(created_at)
        ORDER BY day ASC
      `,
    ]);

    const topProducts = await prisma.$queryRaw<Array<{ product_id: string; title: string; units: number }>>`
      SELECT
        ii.product_id,
        COALESCE(p.title_en, ii.sku, ii.product_id) AS title,
        ii.quantity_on_hand::int AS units
      FROM inventory_items ii
      LEFT JOIN products p ON p.id = ii.product_id
      ORDER BY ii.quantity_on_hand DESC
      LIMIT 10
    `;

    res.json({
      stockByCategory: stockByCategory || [],
      stockByProduct: topProducts || [],
      lowStockCount: Number(lowStockRow?.[0]?.c ?? 0),
      totalValue: Number(valueRow?.[0]?.total_value ?? 0),
      movementTrend: (movementTrend || []).map((r) => ({
        day: r.day,
        inbound: Number(r.inbound ?? 0),
        outbound: Number(r.outbound ?? 0),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'analytics_failed' });
  }
});

// GET /api/admin/inventory
router.get('/', async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = parseInt(String(req.query.limit || '20'));
  const { status, search } = req.query as Record<string, string>;

  const where: any = {};
  if (status) where.status = status;
  if (search) where.OR = [
    { product_id: { contains: search } },
    { sku: { contains: search, mode: 'insensitive' } },
  ];

  const [items, total] = await Promise.all([
    prisma.inventory_items.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.inventory_items.count({ where }),
  ]);

  res.json({ items, total, page, limit });
});

// GET /api/admin/inventory/low-stock
router.get('/low-stock', async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = parseInt(String(req.query.limit || '20'));
  const all = await prisma.inventory_items.findMany({
    orderBy: { quantity_available: 'asc' },
  });
  const filtered = all.filter((i) => i.quantity_available <= i.reorder_point);
  const total = filtered.length;
  const items = filtered.slice((page - 1) * limit, page * limit);
  res.json({ items, total, page, limit });
});

// GET /api/admin/inventory/:id
router.get('/:id', async (req: Request, res: Response) => {
  const item = await prisma.inventory_items.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!item) { res.status(404).json({ error: 'Inventory item not found' }); return; }

  const transactions = await prisma.inventory_transactions.findMany({
    where: { inventory_item_id: item.id },
    orderBy: { created_at: 'desc' },
    take: 50,
  });
  const reservations = await prisma.inventory_reservations.findMany({
    where: { inventory_item_id: item.id, status: 'held' },
  });

  res.json({ item, transactions, reservations });
});

// PUT /api/admin/inventory/:id
router.put('/:id', async (req: Request, res: Response) => {
  const { quantity_on_hand, reorder_point, reorder_quantity, status, warehouse_name } = req.body;
  const item = await prisma.inventory_items.update({
    where: { id: routeParam(req.params.id) },
    data: {
      ...(quantity_on_hand !== undefined && { quantity_on_hand, quantity_available: quantity_on_hand }),
      ...(reorder_point !== undefined && { reorder_point }),
      ...(reorder_quantity !== undefined && { reorder_quantity }),
      ...(status && { status }),
      ...(warehouse_name && { warehouse_name }),
      updated_at: new Date(),
    },
  });
  res.json({ item });
});

// POST /api/admin/inventory/:id/adjust — manual stock adjustment
router.post('/:id/adjust', async (req: Request, res: Response) => {
  const { quantity, type, note } = req.body as { quantity: number; type: string; note?: string };
  if (!quantity || !type) { res.status(400).json({ error: 'quantity and type required' }); return; }

  const item = await prisma.inventory_items.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!item) { res.status(404).json({ error: 'Item not found' }); return; }

  const previousOnHand = item.quantity_on_hand;
  const newOnHand = type === 'add' ? previousOnHand + quantity : previousOnHand - quantity;

  await prisma.inventory_transactions.create({
    data: {
      id: uuidv4(),
      inventory_item_id: item.id,
      product_id: item.product_id,
      variant_id: item.variant_id,
      type: type === 'add' ? 'adjustment_in' : 'adjustment_out',
      quantity,
      previous_on_hand: previousOnHand,
      new_on_hand: newOnHand,
      note,
      actor_id: String(req.admin!.adminId),
      actor_type: 'admin',
    },
  });

  const newStatus = newOnHand <= 0 ? 'out_of_stock' : newOnHand <= item.reorder_point ? 'low_stock' : 'in_stock';
  const updated = await prisma.inventory_items.update({
    where: { id: item.id },
    data: {
      quantity_on_hand: Math.max(0, newOnHand),
      quantity_available: Math.max(0, newOnHand - item.quantity_reserved),
      status: newStatus,
      last_restocked_at: type === 'add' ? new Date() : undefined,
      updated_at: new Date(),
    },
  });

  await maybeAlertLowStock(updated, item.status);
  res.json({ item: updated, adjustment: { previous: previousOnHand, new: newOnHand } });
});

// POST /api/admin/inventory/:id/set-quantity
router.post('/:id/set-quantity', async (req: Request, res: Response) => {
  const { newQuantity, note } = req.body as { newQuantity: number; note?: string };
  if (newQuantity === undefined) { res.status(400).json({ error: 'newQuantity required' }); return; }

  const item = await prisma.inventory_items.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!item) { res.status(404).json({ error: 'Item not found' }); return; }

  const previousOnHand = item.quantity_on_hand;
  await prisma.inventory_transactions.create({
    data: {
      id: uuidv4(),
      inventory_item_id: item.id,
      product_id: item.product_id,
      variant_id: item.variant_id,
      type: 'set_quantity',
      quantity: Math.abs(newQuantity - previousOnHand),
      previous_on_hand: previousOnHand,
      new_on_hand: newQuantity,
      note,
      actor_id: String(req.admin!.adminId),
      actor_type: 'admin',
    },
  });

  const newStatus = newQuantity <= 0 ? 'out_of_stock' : newQuantity <= item.reorder_point ? 'low_stock' : 'in_stock';
  const updated = await prisma.inventory_items.update({
    where: { id: item.id },
    data: {
      quantity_on_hand: Math.max(0, newQuantity),
      quantity_available: Math.max(0, newQuantity - item.quantity_reserved),
      status: newStatus,
      updated_at: new Date(),
    },
  });

  await maybeAlertLowStock(updated, item.status);
  res.json({ item: updated });
});

// GET /api/admin/inventory/product/:productId — by product
router.get('/product/:productId', async (req: Request, res: Response) => {
  const items = await prisma.inventory_items.findMany({
    where: { product_id: routeParam(req.params.productId) },
  });
  res.json({ items });
});

// GET /api/admin/inventory/transactions/:productId
router.get('/transactions/:productId', async (req: Request, res: Response) => {
  const transactions = await prisma.inventory_transactions.findMany({
    where: { product_id: routeParam(req.params.productId) },
    orderBy: { created_at: 'desc' },
    take: 100,
  });
  res.json({ transactions });
});

export default router;
