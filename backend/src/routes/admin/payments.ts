import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { routeParam } from '../../utils/params';

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/payments
router.get('/', async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = 20;
  const { status, method, search } = req.query as Record<string, string>;
  const where: any = {};
  if (status) where.status = status;
  if (method) where.method = method;
  if (search) where.OR = [
    { orderId: { contains: search } },
    { providerTxId: { contains: search } },
    { id: { contains: search } },
  ];

  const [transactions, total] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where,
      include: {
        order: { select: { orderNumber: true, status: true } },
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

// POST /api/admin/payments/:id/refund
router.post('/:id/refund', async (req: Request, res: Response) => {
  const { amount, note } = req.body as { amount?: number; note?: string };
  const tx = await prisma.paymentTransaction.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!tx) { res.status(404).json({ error: 'Transaction not found' }); return; }

  const updated = await prisma.paymentTransaction.update({
    where: { id: tx.id },
    data: { status: 'refunded', metadata: { ...(tx.metadata as object || {}), refundNote: note, refundAmount: amount || Number(tx.amount), refundedAt: new Date().toISOString() } },
  });

  await prisma.order.update({
    where: { id: tx.orderId },
    data: { paymentStatus: 'refunded' },
  });

  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'REFUND_PAYMENT', targetType: 'payment_transaction', targetId: tx.id, details: { amount: amount || Number(tx.amount), note } },
  });

  res.json({ transaction: updated, message: 'Refund processed' });
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

export default router;
