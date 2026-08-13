import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { createRefundRecord } from '../../lib/refundRecords';

import { v4 as uuidv4 } from 'uuid';
import { routeParam } from '../../utils/params';
import { requireIdempotencyKey } from '../../middleware/idempotency';
import { refundTransaction } from '../../services/paymentAdminService';
import { requireAdminReauth } from '../../middleware/adminReauth';
import { notifyCustomer } from '../../services/customerNotify';

const router = Router();

// GET /api/admin/payments/reconciliation/mismatches — tx status vs order.payment_status drift
router.get('/reconciliation/mismatches', async (_req: Request, res: Response) => {
  const mismatches = await prisma.paymentTransaction.findMany({
    where: {
      OR: [
        {
          status: { in: ['pending', 'failed'] },
          order: { paymentStatus: 'paid' },
        },
        {
          status: 'success',
          NOT: { order: { paymentStatus: 'paid' } },
        },
      ],
    },
    include: {
      order: { select: { orderNumber: true, status: true, paymentStatus: true } },
      user: { select: { name: true, email: true, phone: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  res.json({
    transactions: mismatches,
    total: mismatches.length,
    page: 1,
    limit: mismatches.length,
  });
});

// GET /api/admin/payments
router.get('/', async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = 20;
  const { status, method, search } = req.query as Record<string, string>;
  const where: any = {};
  if (status === 'under_verification') {
    // Gateway captured the funds but an admin has not verified them yet.
    where.status = 'success';
    where.OR = [
      { order: { paymentStatus: 'under_verification' } },
      { order: { deliveryPaymentStatus: 'under_verification' } },
    ];
  } else if (status) {
    where.status = status;
  }
  if (method) where.method = method;
  if (search) where.AND = [
    ...(where.AND || []),
    {
      OR: [
        { orderId: { contains: search } },
        { providerTxId: { contains: search } },
        { id: { contains: search } },
      ],
    },
  ];

  const [transactions, total] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where,
      include: {
        order: {
          select: {
            orderNumber: true,
            status: true,
            paymentStatus: true,
            deliveryPaymentStatus: true,
            deliveryFeePaid: true,
          },
        },
        user: { select: { name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.paymentTransaction.count({ where }),
  ]);

  res.json({ transactions, total, page, limit });
});

// GET /api/admin/payments/:id
router.get('/:id', async (req: Request, res: Response) => {
  const tx = await prisma.paymentTransaction.findUnique({
    where: { id: routeParam(req.params.id) },
    include: {
      order: {
        include: {
          items: true,
          user: { select: { name: true, email: true, phone: true } },
        },
      },
      user: { select: { name: true, email: true } },
    },
  });
  if (!tx) { res.status(404).json({ error: 'Transaction not found' }); return; }
  res.json({ transaction: tx });
});

// POST /api/admin/payments/:id/mark-paid — admin confirms a payment was received (e.g. under verification → paid)
router.post('/:id/mark-paid', async (req: Request, res: Response) => {
  const tx = await prisma.paymentTransaction.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!tx) { res.status(404).json({ error: 'Transaction not found' }); return; }

  const meta = (tx.metadata && typeof tx.metadata === 'object') ? tx.metadata as Record<string, unknown> : {};
  const isDeliveryFee = meta.purpose === 'delivery_fee';

  const updatedTx = await prisma.paymentTransaction.update({
    where: { id: tx.id },
    data: { status: 'success' },
  });

  let order;
  if (isDeliveryFee) {
    order = await prisma.order.update({
      where: { id: tx.orderId },
      data: {
        deliveryPaymentStatus: 'paid',
        deliveryFeePaid: tx.amount,
        // Goods remain COD unpaid; move into processing once courier fee is verified.
        status: 'processing',
      },
    });
    await prisma.orderTimeline.create({
      data: {
        orderId: order.id,
        status: 'processing',
        note: 'Delivery charge verified by admin — order ready to process (goods COD)',
        actorType: 'admin',
        actorId: String(req.admin!.adminId),
      },
    });
  } else {
    order = await prisma.order.update({
      where: { id: tx.orderId },
      data: { paymentStatus: 'paid', status: 'processing' },
    });
    await prisma.orderTimeline.create({
      data: {
        orderId: order.id,
        status: 'processing',
        note: 'Payment confirmed by admin — order moved to processing',
        actorType: 'admin',
        actorId: String(req.admin!.adminId),
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      adminId: req.admin!.adminId,
      action: isDeliveryFee ? 'MARK_DELIVERY_FEE_PAID' : 'MARK_PAYMENT_PAID',
      targetType: 'payment_transaction',
      targetId: tx.id,
      details: { orderId: order.id, purpose: isDeliveryFee ? 'delivery_fee' : 'order_total' },
    },
  });

  try {
    await notifyCustomer({
      userId: order.userId,
      event: 'payment_received',
      vars: { orderNumber: order.orderNumber },
    });
  } catch { /* non-fatal */ }

  res.json({
    transaction: updatedTx,
    order,
    message: isDeliveryFee ? 'Delivery charge marked as verified' : 'Payment marked as received',
  });
});

// POST /api/admin/payments/:id/request-again — ask customer to pay again
router.post('/:id/request-again', async (req: Request, res: Response) => {
  const tx = await prisma.paymentTransaction.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!tx) { res.status(404).json({ error: 'Transaction not found' }); return; }

  const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 500) : undefined;
  const meta = (tx.metadata && typeof tx.metadata === 'object') ? tx.metadata as Record<string, unknown> : {};
  const isDeliveryFee = meta.purpose === 'delivery_fee';

  const updatedTx = await prisma.paymentTransaction.update({
    where: { id: tx.id },
    data: {
      status: 'failed',
      metadata: {
        ...meta,
        repayRequestedAt: new Date().toISOString(),
        repayNote: note || null,
      },
    },
  });

  const order = await prisma.order.update({
    where: { id: tx.orderId },
    data: isDeliveryFee
      ? { deliveryPaymentStatus: 'pending', deliveryFeePaid: 0 }
      : { paymentStatus: 'unpaid' },
  });

  await prisma.orderTimeline.create({
    data: {
      orderId: order.id,
      status: order.status,
      note: note || (isDeliveryFee
        ? 'Admin requested delivery fee payment again'
        : 'Admin requested payment again'),
      actorType: 'admin',
      actorId: String(req.admin!.adminId),
    },
  });

  try {
    await notifyCustomer({
      userId: order.userId,
      event: 'payment_verification',
      vars: { orderNumber: order.orderNumber },
    });
  } catch { /* non-fatal */ }

  res.json({ transaction: updatedTx, order, message: 'Customer can pay again from their order page' });
});

// POST /api/admin/payments/:id/refund
router.post('/:id/refund', requireIdempotencyKey(), requireAdminReauth(), async (req: Request, res: Response) => {
  const { amount, note, method } = req.body as { amount?: number; note?: string; method?: string };
  try {
    const updated = await refundTransaction(req, routeParam(req.params.id), amount, note);
    const order = await prisma.order.findUnique({ where: { id: updated.orderId } });

    const refundAmount = amount ?? Number(updated.amount);
    const record = await createRefundRecord({
      id: uuidv4(),
      order_id: updated.orderId,
      payment_tx_id: updated.id,
      user_id: updated.userId,
      amount: refundAmount,
      method: method || 'original_payment',
      notes: note,
      status: 'completed',
      completed_at: new Date(),
      created_by: String(req.admin?.adminId ?? ''),
    });

    if (order) {
      try {
        await notifyCustomer({
          userId: order.userId,
          event: 'refund_completed',
          vars: { orderNumber: order.orderNumber, amount: String(refundAmount), method: method || 'original_payment' },
        });
      } catch { /* non-fatal */ }
    }

    res.json({ transaction: updated, refundRecord: record, message: 'Refund processed' });
  } catch (err: any) {
    res.status(err?.status || 500).json({ error: err?.message || 'Refund failed' });
  }
});

// GET /api/admin/payments/invoice/:orderId — generate invoice data
router.get('/invoice/:orderId', async (req: Request, res: Response) => {
  const order = await prisma.order.findUnique({
    where: { id: routeParam(req.params.orderId) },
    include: {
      items: true,
      user: { select: { name: true, email: true, phone: true } },
      shippingAddress: true,
      paymentTxs: true,
    },
  });
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

  res.json({
    invoice: {
      orderNumber: order.orderNumber,
      date: order.createdAt,
      customer: order.user,
      address: order.shippingAddress,
      items: order.items,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      gst: Number(order.gst),
      shippingFee: Number(order.shippingFee),
      serviceFee: Number(order.serviceFee),
      obDiscount: Number(order.obDiscount),
      total: Number(order.total),
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      transactions: order.paymentTxs,
    },
  });
});

// PATCH /api/admin/payments/:id — manually update transaction status/notes
router.patch('/:id', async (req: Request, res: Response) => {
  const { status, notes, providerTxId } = req.body as { status?: string; notes?: string; providerTxId?: string };
  const prismaAny = prisma as any;
  const tx = await prismaAny.paymentTransaction.update({
    where: { id: routeParam(req.params.id) },
    data: {
      ...(status && { status }),
      ...(notes !== undefined && { notes }),
      ...(providerTxId !== undefined && { providerTxId }),
    },
  });
  res.json({ transaction: tx });
});

export default router;
