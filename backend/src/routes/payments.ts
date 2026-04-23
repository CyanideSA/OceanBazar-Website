import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { generateEntityId } from '../utils/hexId';
import { earnPoints } from '../services/obPointsService';

const router = Router();
const prisma = new PrismaClient();

// ─── bKash ────────────────────────────────────────────────────────────────────

router.post('/bkash/initiate', requireAuth, async (req: Request, res: Response) => {
  const { orderId } = req.body as { orderId: string };
  const order = await prisma.order.findFirst({ where: { id: orderId, userId: req.user!.userId } });
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

  const tx = await prisma.paymentTransaction.create({
    data: {
      id: generateEntityId(),
      orderId,
      userId: req.user!.userId,
      method: 'bkash',
      amount: order.total,
      metadata: { initiatedAt: new Date().toISOString() },
    },
  });

  // TODO: Call real bKash Checkout API
  // const bkashResponse = await bkashService.createPayment(order.total, orderId);
  res.json({
    transactionId: tx.id,
    message: 'bKash payment initiated (placeholder)',
    redirectUrl: `${process.env.BKASH_BASE_URL}/checkout?amount=${order.total}`,
  });
});

router.post('/bkash/confirm', requireAuth, async (req: Request, res: Response) => {
  const { transactionId, providerTxId } = req.body as { transactionId: string; providerTxId: string };
  const tx = await prisma.paymentTransaction.findUnique({ where: { id: transactionId } });
  if (!tx) { res.status(404).json({ error: 'Transaction not found' }); return; }

  // TODO: Verify with bKash API
  await prisma.paymentTransaction.update({
    where: { id: transactionId },
    data: { status: 'success', providerTxId },
  });
  await prisma.order.update({
    where: { id: tx.orderId },
    data: { paymentStatus: 'paid', status: 'confirmed' },
  });
  await prisma.orderTimeline.create({
    data: { orderId: tx.orderId, status: 'confirmed', note: 'Payment received via bKash', actorType: 'system' },
  });

  await earnPoints(tx.userId, tx.orderId, Number(tx.amount));
  res.json({ message: 'Payment confirmed' });
});

// ─── Nagad ────────────────────────────────────────────────────────────────────

router.post('/nagad/initiate', requireAuth, async (req: Request, res: Response) => {
  const { orderId } = req.body as { orderId: string };
  const order = await prisma.order.findFirst({ where: { id: orderId, userId: req.user!.userId } });
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

  const tx = await prisma.paymentTransaction.create({
    data: {
      id: generateEntityId(),
      orderId,
      userId: req.user!.userId,
      method: 'nagad',
      amount: order.total,
    },
  });

  // TODO: Call real Nagad API
  res.json({
    transactionId: tx.id,
    message: 'Nagad payment initiated (placeholder)',
    redirectUrl: `${process.env.APP_URL || 'http://localhost:3000'}/checkout/pay?tx=${tx.id}`,
  });
});

router.post('/nagad/confirm', requireAuth, async (req: Request, res: Response) => {
  const { transactionId, providerTxId } = req.body as { transactionId: string; providerTxId: string };
  await onPaymentSuccess(transactionId, providerTxId, 'nagad');
  res.json({ message: 'Payment confirmed' });
});

// ─── Rocket ───────────────────────────────────────────────────────────────────

router.post('/rocket/initiate', requireAuth, async (req: Request, res: Response) => {
  const { orderId } = req.body as { orderId: string };
  const order = await prisma.order.findFirst({ where: { id: orderId, userId: req.user!.userId } });
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

  const tx = await prisma.paymentTransaction.create({
    data: {
      id: generateEntityId(),
      orderId,
      userId: req.user!.userId,
      method: 'rocket',
      amount: order.total,
    },
  });

  res.json({
    transactionId: tx.id,
    message: 'Rocket payment initiated (placeholder)',
    redirectUrl: `${process.env.APP_URL || 'http://localhost:3000'}/checkout/pay?tx=${tx.id}`,
  });
});

// ─── Upay ─────────────────────────────────────────────────────────────────────

router.post('/upay/initiate', requireAuth, async (req: Request, res: Response) => {
  const { orderId } = req.body as { orderId: string };
  const order = await prisma.order.findFirst({ where: { id: orderId, userId: req.user!.userId } });
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

  const tx = await prisma.paymentTransaction.create({
    data: {
      id: generateEntityId(),
      orderId,
      userId: req.user!.userId,
      method: 'upay',
      amount: order.total,
    },
  });

  res.json({
    transactionId: tx.id,
    message: 'Upay payment initiated (placeholder)',
    redirectUrl: `${process.env.APP_URL || 'http://localhost:3000'}/checkout/pay?tx=${tx.id}`,
  });
});

// ─── SSLCommerz ───────────────────────────────────────────────────────────────

router.post('/sslcommerz/initiate', requireAuth, async (req: Request, res: Response) => {
  const { orderId } = req.body as { orderId: string };
  const order = await prisma.order.findFirst({ where: { id: orderId, userId: req.user!.userId } });
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

  const tx = await prisma.paymentTransaction.create({
    data: {
      id: generateEntityId(),
      orderId,
      userId: req.user!.userId,
      method: 'sslcommerz',
      amount: order.total,
    },
  });

  // TODO: Call real SSLCommerz API
  res.json({
    transactionId: tx.id,
    message: 'SSLCommerz payment initiated (placeholder)',
    redirectUrl: `${process.env.SSLCOMMERZ_GATEWAY_URL || process.env.APP_URL || 'http://localhost:3000'}/checkout/pay?tx=${tx.id}`,
  });
});

// SSLCommerz IPN webhook (no auth — verified by store credentials)
router.post('/sslcommerz/ipn', async (req: Request, res: Response) => {
  const { tran_id, val_id, status } = req.body as { tran_id: string; val_id: string; status: string };

  if (status !== 'VALID') {
    res.status(200).send('INVALID');
    return;
  }

  // TODO: Verify val_id with SSLCommerz validation API
  const tx = await prisma.paymentTransaction.findFirst({ where: { metadata: { path: ['tran_id'], equals: tran_id } } });
  if (tx) {
    await onPaymentSuccess(tx.id, val_id, 'sslcommerz');
  }

  res.status(200).send('OK');
});

// ─── Helper ───────────────────────────────────────────────────────────────────

async function onPaymentSuccess(transactionId: string, providerTxId: string, _method: string) {
  const tx = await prisma.paymentTransaction.update({
    where: { id: transactionId },
    data: { status: 'success', providerTxId },
  });
  await prisma.order.update({
    where: { id: tx.orderId },
    data: { paymentStatus: 'paid', status: 'confirmed' },
  });
  await prisma.orderTimeline.create({
    data: { orderId: tx.orderId, status: 'confirmed', note: `Payment received`, actorType: 'system' },
  });
  await earnPoints(tx.userId, tx.orderId, Number(tx.amount));
}

export default router;
