import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { routeParam } from '../../utils/params';

const router = Router();
const prisma = new PrismaClient();

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
router.get('/low-stock', async (_req: Request, res: Response) => {
  const items = await prisma.inventory_items.findMany({
    where: {
      quantity_available: { lte: prisma.inventory_items.fields?.reorder_point as any || 10 },
    },
    orderBy: { quantity_available: 'asc' },
    take: 50,
  });
  // Fallback: filter in-app since Prisma can't compare two columns directly
  const lowStock = await prisma.inventory_items.findMany({
    orderBy: { quantity_available: 'asc' },
    take: 200,
  });
  const filtered = lowStock.filter(i => i.quantity_available <= i.reorder_point);
  res.json({ items: filtered });
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

  const updated = await prisma.inventory_items.update({
    where: { id: item.id },
    data: {
      quantity_on_hand: Math.max(0, newOnHand),
      quantity_available: Math.max(0, newOnHand - item.quantity_reserved),
      status: newOnHand <= 0 ? 'out_of_stock' : newOnHand <= item.reorder_point ? 'low_stock' : 'in_stock',
      last_restocked_at: type === 'add' ? new Date() : undefined,
      updated_at: new Date(),
    },
  });

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

  const updated = await prisma.inventory_items.update({
    where: { id: item.id },
    data: {
      quantity_on_hand: Math.max(0, newQuantity),
      quantity_available: Math.max(0, newQuantity - item.quantity_reserved),
      status: newQuantity <= 0 ? 'out_of_stock' : newQuantity <= item.reorder_point ? 'low_stock' : 'in_stock',
      updated_at: new Date(),
    },
  });

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
