import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { routeParam } from '../utils/params';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const prisma = new PrismaClient();

// POST /api/returns — customer submits a return request
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const { orderId, reason, reasonCategory, description, items, images } = req.body as {
    orderId: string;
    reason?: string;
    reasonCategory?: string;
    description?: string;
    items?: Array<{ productId: string; title: string; quantity: number; unitPrice: number }>;
    images?: string[];
  };

  if (!orderId) { res.status(400).json({ error: 'orderId is required' }); return; }

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: req.user!.userId },
  });
  if (!order) { res.status(404).json({ error: 'Order not found or does not belong to you' }); return; }

  const existing = await prisma.return_requests.findFirst({
    where: { order_id: orderId, user_id: req.user!.userId },
  });
  if (existing) {
    res.status(409).json({ error: 'A return request for this order already exists', returnRequest: existing });
    return;
  }

  const returnReq = await (prisma as any).return_requests.create({
    data: {
      id: uuidv4(),
      order_id: orderId,
      user_id: req.user!.userId,
      reason: reason || null,
      reason_category: reasonCategory || null,
      description: description || null,
      items: items ? JSON.stringify(items) : null,
      images: images ? JSON.stringify(images) : null,
      status: 'pending',
      timeline: JSON.stringify([{ status: 'pending', timestamp: new Date().toISOString(), actor: 'customer' }]),
      created_at: new Date(),
      updated_at: new Date(),
    },
  });

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { orderNumber: true } });
    const { alertRefundRequest } = await import('../services/teamsService');
    alertRefundRequest(order?.orderNumber || orderId, reason || reasonCategory).catch(() => {});
  } catch { /* non-fatal */ }

  res.status(201).json({ returnRequest: returnReq, message: 'Return request submitted successfully' });
});

// GET /api/returns — list the current user's return requests
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const returns = await (prisma as any).return_requests.findMany({
    where: { user_id: req.user!.userId },
    orderBy: { created_at: 'desc' },
  });
  res.json({ returns });
});

// GET /api/returns/:id — get a single return request (must belong to user)
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const returnReq = await (prisma as any).return_requests.findFirst({
    where: { id: routeParam(req.params.id), user_id: req.user!.userId },
  });
  if (!returnReq) { res.status(404).json({ error: 'Return request not found' }); return; }
  res.json({ returnRequest: returnReq });
});

export default router;
