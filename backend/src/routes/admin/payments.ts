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
    // Gateway captured funds awaiting admin verification (full order OR delivery fee).
    where.status = 'success';
    where.OR = [
      { order: { paymentStatus: 'under_verification' } },
      {
        AND: [
          { metadata: { path: ['purpose'], equals: 'delivery_fee' } },
          { order: { deliveryPaymentStatus: 'under_verification' } },
        ],
      },
    ];
  } else if (status) {
    where.status = status;
  }
  if (method) where.method = method;
  if (search) {
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { orderId: { contains: search } },
          { providerTxId: { contains: search } },
          { id: { contains: search } },
        ],
      },
    ];
  }

  const [transactions, total] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where,
      include: {
        order: {
          select: {
            orderNumber: true,
            status: true,
            paymentStatus: true,
            paymentMethod: true,
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
      order: { include: { items: true, user: { select: { name: true, email: true, phone: true } } } },
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

  const meta =
    tx.metadata && typeof tx.metadata === 'object' && !Array.isArray(tx.metadata)
      ? (tx.metadata as Record<string, unknown>)
      : {};
  const isDeliveryFee = String(meta.purpose || '') === 'delivery_fee';

  const updatedTx = await prisma.paymentTransaction.update({
    where: { id: tx.id },
    data: { status: 'success' },
  });

  let order;
  if (isDeliveryFee) {
    // Pay later: verify delivery charge only — goods remain unpaid/COD.
    await prisma.$executeRaw`
      UPDATE orders
      SET delivery_payment_status = 'paid',
          delivery_fee_paid = ${tx.amount},
          payment_status = 'unpaid',
          status = 'processing'
      WHERE id = ${tx.orderId}
    `;
    order = await prisma.order.findUniqueOrThrow({ where: { id: tx.orderId } });
    await prisma.orderTimeline.create({
      data: {
        orderId: order.id,
        status: 'processing',
        note: `Delivery fee ৳${Number(tx.amount)} verified by admin — goods remain pay-later / COD`,
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
      action: 'MARK_PAYMENT_PAID',
      targetType: 'payment_transaction',
      targetId: tx.id,
      details: { orderId: order.id, purpose: isDeliveryFee ? 'delivery_fee' : 'order_total' },
    },
  });

  try {
    await notifyCustomer({ userId: order.userId, event: 'payment_received', vars: { orderNumber: order.orderNumber } });
  } catch { /* non-fatal */ }

  res.json({ transaction: updatedTx, order, message: 'Payment marked as received' });
});

// POST /api/admin/payments/:id/request-repay — ask customer to pay again (UV / unpaid issues)
router.post('/:id/request-repay', async (req: Request, res: Response) => {
  const tx = await prisma.paymentTransaction.findUnique({
    where: { id: routeParam(req.params.id) },
    include: { order: true },
  });
  if (!tx) { res.status(404).json({ error: 'Transaction not found' }); return; }
  if (!tx.order) { res.status(404).json({ error: 'Order not found' }); return; }

  const meta =
    tx.metadata && typeof tx.metadata === 'object' && !Array.isArray(tx.metadata)
      ? (tx.metadata as Record<string, unknown>)
      : {};
  const isDeliveryFee = String(meta.purpose || '') === 'delivery_fee';
  const note = String((req.body as { note?: string })?.note || '').trim();

  // Supersede this capture so a fresh gateway payment can be started from the order page.
  await prisma.paymentTransaction.update({
    where: { id: tx.id },
    data: {
      status: 'failed',
      notes: note || 'Admin requested customer to pay again',
      metadata: {
        ...meta,
        repayRequestedAt: new Date().toISOString(),
        repayRequestedBy: String(req.admin?.adminId ?? ''),
        previousStatus: tx.status,
      },
    },
  });

  if (isDeliveryFee) {
    await prisma.$executeRaw`
      UPDATE orders
      SET delivery_payment_status = 'unpaid',
          payment_status = 'unpaid'
      WHERE id = ${tx.orderId}
    `;
  } else {
    await prisma.order.update({
      where: { id: tx.orderId },
      data: { paymentStatus: 'unpaid' },
    });
  }

  await prisma.orderTimeline.create({
    data: {
      orderId: tx.orderId,
      status: tx.order.status,
      note: isDeliveryFee
        ? `Admin asked customer to pay delivery fee again${note ? `: ${note}` : ''}`
        : `Admin asked customer to pay again${note ? `: ${note}` : ''}`,
      actorType: 'admin',
      actorId: String(req.admin!.adminId),
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: req.admin!.adminId,
      action: 'REQUEST_PAYMENT_AGAIN',
      targetType: 'payment_transaction',
      targetId: tx.id,
      details: { orderId: tx.orderId, purpose: isDeliveryFee ? 'delivery_fee' : 'order_total', note: note || null },
    },
  });

  try {
    await notifyCustomer({
      userId: tx.order.userId,
      event: 'payment_retry_requested',
      vars: {
        orderNumber: tx.order.orderNumber,
        purpose: isDeliveryFee ? 'delivery fee' : 'order payment',
      },
    });
  } catch { /* non-fatal */ }

  // #region agent log
  fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'request-repay',hypothesisId:'H-repay',location:'admin/payments.ts:request-repay',message:'admin requested repay',data:{txId:tx.id,orderId:tx.orderId,isDeliveryFee},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  const order = await prisma.order.findUnique({ where: { id: tx.orderId } });
  res.json({ ok: true, order, message: 'Customer can pay again from their order page' });
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

  // #region agent log
  try {
    const fs = await import('fs');
    const path = await import('path');
    fs.appendFileSync(
      path.resolve(__dirname, '../../../../debug-1eb282.log'),
      `${JSON.stringify({
        sessionId: '1eb282',
        runId: 'pre-fix',
        hypothesisId: 'H5',
        location: 'admin/payments.ts:invoice',
        message: 'admin invoice endpoint hit',
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          itemCount: Array.isArray(order.items) ? order.items.length : 0,
          txCount: Array.isArray(order.paymentTxs) ? order.paymentTxs.length : 0,
        },
        timestamp: Date.now(),
      })}\n`,
    );
  } catch { /* ignore */ }
  // #endregion

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
