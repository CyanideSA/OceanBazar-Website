import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import {
  listRefundsForReturn,
  findLatestRefundForReturn,
  createRefundRecord,
  updateRefundRecord,
} from '../lib/refundRecords';

import { requireAuth } from '../middleware/auth';
import { routeParam } from '../utils/params';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

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
    const orderMeta = await prisma.order.findUnique({ where: { id: orderId }, select: { orderNumber: true } });
    const { alertRefundRequest } = await import('../services/teamsService');
    alertRefundRequest(orderMeta?.orderNumber || orderId, reason || reasonCategory).catch(() => {});
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
  const refundRecords = await listRefundsForReturn(returnReq.id);
  res.json({ returnRequest: returnReq, refundRecords });
});

// POST /api/returns/:id/refund-account — customer submits how they'd like to receive their refund
router.post('/:id/refund-account', requireAuth, async (req: Request, res: Response) => {
  const { method, accountNumber, accountName, bankName, branchName, notes } = req.body as {
    method?: string;
    accountNumber?: string;
    accountName?: string;
    bankName?: string;
    branchName?: string;
    notes?: string;
  };

  if (!method || !accountNumber) {
    res.status(400).json({ error: 'method and accountNumber are required' });
    return;
  }

  const rr = await prisma.return_requests.findFirst({
    where: { id: routeParam(req.params.id), user_id: req.user!.userId },
  });
  if (!rr) { res.status(404).json({ error: 'Return request not found' }); return; }
  if (!['refund_eligible', 'refund_processing'].includes(rr.status)) {
    res.status(400).json({ error: 'This return is not yet eligible for refund payment details' });
    return;
  }

  const customerAccount = {
    method,
    accountNumber,
    accountName: accountName || null,
    bankName: bankName || null,
    branchName: branchName || null,
    notes: notes || null,
    submittedAt: new Date().toISOString(),
  };

  let record = await findLatestRefundForReturn(rr.id);
  if (record) {
    record = await updateRefundRecord(record.id, {
      customer_account: customerAccount,
      method: method || record.method,
    });
  } else {
    record = await createRefundRecord({
      id: uuidv4(),
      order_id: rr.order_id,
      return_id: rr.id,
      user_id: req.user!.userId,
      amount: rr.refund_amount || 0,
      method,
      customer_account: customerAccount,
      status: 'pending_info',
    });
  }

  res.json({ refundRecord: record, message: 'Refund payment details submitted' });
});

export default router;
