import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { routeParam } from '../../utils/params';

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/returns
router.get('/', async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = 20;
  const { status, search } = req.query as Record<string, string>;
  const where: any = {};
  if (status) where.status = status;
  if (search) where.OR = [
    { order_id: { contains: search } },
    { user_id: { contains: search } },
    { id: { contains: search } },
  ];

  const [items, total] = await Promise.all([
    prisma.return_requests.findMany({ where, orderBy: { created_at: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.return_requests.count({ where }),
  ]);
  res.json({ returns: items, total, page, limit });
});

// GET /api/admin/returns/:id
router.get('/:id', async (req: Request, res: Response) => {
  const item = await prisma.return_requests.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!item) { res.status(404).json({ error: 'Return request not found' }); return; }
  res.json({ returnRequest: item });
});

// PATCH /api/admin/returns/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const { status, admin_note, assigned_to_admin_id, refund_method, refund_amount, tracking_number, shipping_carrier } = req.body;
  const prev = await prisma.return_requests.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!prev) { res.status(404).json({ error: 'Not found' }); return; }

  const timeline = Array.isArray(prev.timeline) ? prev.timeline : [];
  if (status && status !== prev.status) {
    (timeline as any[]).push({ status, timestamp: new Date().toISOString(), actor: String(req.admin!.adminId) });
  }

  const updated = await prisma.return_requests.update({
    where: { id: routeParam(req.params.id) },
    data: {
      ...(status && { status }),
      ...(admin_note !== undefined && { admin_note }),
      ...(assigned_to_admin_id !== undefined && { assigned_to_admin_id }),
      ...(refund_method && { refund_method }),
      ...(refund_amount !== undefined && { refund_amount }),
      ...(tracking_number && { tracking_number }),
      ...(shipping_carrier && { shipping_carrier }),
      timeline,
      updated_at: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'UPDATE_RETURN', targetType: 'return_request', targetId: prev.id, details: { status, admin_note } },
  });

  res.json({ returnRequest: updated });
});

// PATCH /api/admin/returns/:id/status — alias
router.patch('/:id/status', async (req: Request, res: Response) => {
  const { status, note } = req.body;
  const prev = await prisma.return_requests.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!prev) { res.status(404).json({ error: 'Not found' }); return; }

  const timeline = Array.isArray(prev.timeline) ? prev.timeline : [];
  (timeline as any[]).push({ status, timestamp: new Date().toISOString(), actor: String(req.admin!.adminId), note });

  const updated = await prisma.return_requests.update({
    where: { id: prev.id },
    data: { status, admin_note: note, timeline, updated_at: new Date() },
  });

  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'UPDATE_RETURN_STATUS', targetType: 'return_request', targetId: prev.id, details: { status, note } },
  });

  res.json({ returnRequest: updated });
});

// POST /api/admin/returns/:id/refund
router.post('/:id/refund', async (req: Request, res: Response) => {
  const { amount, method, note } = req.body as { amount: number; method?: string; note?: string };
  const rr = await prisma.return_requests.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!rr) { res.status(404).json({ error: 'Not found' }); return; }

  const updated = await prisma.return_requests.update({
    where: { id: rr.id },
    data: { status: 'refunded', refund_amount: amount, refund_method: method || 'original_payment', admin_note: note, updated_at: new Date() },
  });

  // Update the order payment status
  await prisma.order.updateMany({
    where: { id: rr.order_id },
    data: { paymentStatus: 'refunded' },
  });

  res.json({ returnRequest: updated, message: 'Refund processed' });
});

export default router;
