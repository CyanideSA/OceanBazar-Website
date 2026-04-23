import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { routeParam } from '../../utils/params';

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/coupons
router.get('/', async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = 20;
  const { active } = req.query as Record<string, string>;
  const where: any = {};
  if (active === 'true') where.active = true;
  if (active === 'false') where.active = false;

  const [coupons, total] = await Promise.all([
    prisma.coupon.findMany({ where, orderBy: { id: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.coupon.count({ where }),
  ]);
  res.json({ coupons, total, page, limit });
});

// GET /api/admin/coupons/active — for storefront checkout
router.get('/active', async (_req: Request, res: Response) => {
  const now = new Date();
  const coupons = await prisma.coupon.findMany({
    where: {
      active: true,
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
    },
    orderBy: { startsAt: 'desc' },
  });
  // Filter out fully used coupons
  const available = coupons.filter(c => !c.maxUses || c.usedCount < c.maxUses);
  res.json({ coupons: available });
});

// POST /api/admin/coupons/validate — validate a coupon code
router.post('/validate', async (req: Request, res: Response) => {
  const { code, total } = req.body as { code: string; total?: number };
  if (!code) { res.status(400).json({ error: 'code required' }); return; }

  const coupon = await prisma.coupon.findUnique({ where: { code: String(code).toUpperCase() } });
  if (!coupon) { res.status(404).json({ valid: false, error: 'Coupon not found' }); return; }

  const now = new Date();
  if (!coupon.active) { res.json({ valid: false, error: 'Coupon is inactive' }); return; }
  if (coupon.startsAt > now) { res.json({ valid: false, error: 'Coupon not yet active' }); return; }
  if (coupon.expiresAt && coupon.expiresAt < now) { res.json({ valid: false, error: 'Coupon expired' }); return; }
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) { res.json({ valid: false, error: 'Coupon usage limit reached' }); return; }
  if (total !== undefined && Number(coupon.minOrder) > total) { res.json({ valid: false, error: `Minimum order amount is ${coupon.minOrder}` }); return; }

  let discountAmount = 0;
  if (coupon.type === 'percent' && total) discountAmount = total * (Number(coupon.value) / 100);
  else if (coupon.type === 'fixed') discountAmount = Number(coupon.value);

  res.json({ valid: true, coupon, discountAmount });
});

// GET /api/admin/coupons/:id
router.get('/:id', async (req: Request, res: Response) => {
  const coupon = await prisma.coupon.findUnique({ where: { id: parseInt(routeParam(req.params.id)) } });
  if (!coupon) { res.status(404).json({ error: 'Coupon not found' }); return; }
  res.json({ coupon });
});

// POST /api/admin/coupons
router.post('/', async (req: Request, res: Response) => {
  const { code, type, value, minOrder, maxUses, startsAt, expiresAt } = req.body;
  if (!code || !type || value === undefined || !startsAt) {
    res.status(400).json({ error: 'code, type, value, startsAt required' });
    return;
  }

  const existing = await prisma.coupon.findUnique({ where: { code: String(code).toUpperCase() } });
  if (existing) { res.status(409).json({ error: 'Coupon code already exists' }); return; }

  const coupon = await prisma.coupon.create({
    data: {
      code: String(code).toUpperCase(),
      type: type as 'percent' | 'fixed' | 'free_shipping',
      value: Number(value),
      minOrder: minOrder ? Number(minOrder) : 0,
      maxUses: maxUses ? Number(maxUses) : null,
      startsAt: new Date(startsAt),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'CREATE_COUPON', targetType: 'coupon', targetId: String(coupon.id), details: { code: coupon.code, type, value } },
  });

  res.status(201).json({ coupon });
});

// PUT /api/admin/coupons/:id
router.put('/:id', async (req: Request, res: Response) => {
  const { code, type, value, minOrder, maxUses, startsAt, expiresAt, active } = req.body;
  const coupon = await prisma.coupon.update({
    where: { id: parseInt(routeParam(req.params.id)) },
    data: {
      ...(code && { code: String(code).toUpperCase() }),
      ...(type && { type: type as 'percent' | 'fixed' | 'free_shipping' }),
      ...(value !== undefined && { value: Number(value) }),
      ...(minOrder !== undefined && { minOrder: Number(minOrder) }),
      ...(maxUses !== undefined && { maxUses: maxUses ? Number(maxUses) : null }),
      ...(startsAt && { startsAt: new Date(startsAt) }),
      ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
      ...(active !== undefined && { active: Boolean(active) }),
    },
  });
  res.json({ coupon });
});

// DELETE /api/admin/coupons/:id — soft delete (deactivate)
router.delete('/:id', async (req: Request, res: Response) => {
  await prisma.coupon.update({ where: { id: parseInt(routeParam(req.params.id)) }, data: { active: false } });
  res.json({ message: 'Coupon deactivated' });
});

export default router;
