import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { generateEntityId } from '../utils/hexId';
import { earnPoints } from '../services/obPointsService';
import { emitAdminEvent } from '../lib/adminEvents';
import * as bkash from '../services/bkashService';
import * as ssl from '../services/sslcommerzService';
import * as nagad from '../services/nagadService';
import { sendToUser } from '../services/pushNotificationService';
import { appLog } from '../lib/appLog';

const router = Router();
const prisma = new PrismaClient();

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const API_BASE = process.env.API_BASE_URL || process.env.PUBLIC_BASE_URL || 'http://localhost:4000';

// ─── Helper ───────────────────────────────────────────────────────────────────

function sslValidationMatchesTransaction(
  validation: ssl.SslValidationResult,
  transaction: { id: string; amount: unknown },
): boolean {
  const expectedAmount = Number(transaction.amount);
  const receivedAmount = Number(validation.amount);
  return validation.isValid
    && validation.tranId === transaction.id
    && validation.currency.toUpperCase() === 'BDT'
    && Number.isFinite(receivedAmount)
    && Math.abs(receivedAmount - expectedAmount) < 0.01;
}

async function onPaymentSuccess(transactionId: string, providerTxId: string, method: string) {
  const outcome = await prisma.$transaction(async (txn) => {
    const row = await txn.paymentTransaction.findUnique({ where: { id: transactionId } });
    if (!row) return { kind: 'missing' as const };
    if (row.status === 'success') {
      return { kind: 'duplicate' as const, orderId: row.orderId, userId: row.userId, amount: row.amount };
    }
    if (row.status === 'refunded') {
      return { kind: 'blocked' as const, reason: 'refunded' as const };
    }
    const tx = await txn.paymentTransaction.update({
      where: { id: transactionId },
      data: { status: 'success', providerTxId },
    });
    await txn.order.update({
      where: { id: tx.orderId },
      data: { paymentStatus: 'paid', status: 'confirmed' },
    });
    await txn.orderTimeline.create({
      data: { orderId: tx.orderId, status: 'confirmed', note: `Payment received via ${method}`, actorType: 'system' },
    });
    return { kind: 'applied' as const, tx };
  });

  if (outcome.kind === 'missing') return;
  if (outcome.kind === 'blocked') {
    appLog('warn', 'payment_success_blocked', { transactionId, method, reason: outcome.reason });
    return;
  }
  if (outcome.kind === 'duplicate') {
    appLog('info', 'payment_success_idempotent_skip', {
      transactionId,
      method,
      orderId: outcome.orderId,
      providerTxId,
    });
    return;
  }

  const tx = outcome.tx;
  await earnPoints(tx.userId, tx.orderId, Number(tx.amount));
  try { emitAdminEvent('admin:payment', { txId: tx.id, orderId: tx.orderId, amount: Number(tx.amount), status: 'success', method }); } catch { /* non-fatal */ }
  const paidOrder = await prisma.order.findUnique({ where: { id: tx.orderId }, select: { orderNumber: true } });
  sendToUser(tx.userId, {
    title: 'Payment Confirmed ✅',
    body: `Order #${paidOrder?.orderNumber} — ৳${Number(tx.amount).toLocaleString()} paid via ${method}.`,
    url: `/en/orders/${tx.orderId}`,
    tag: 'payment',
  }).catch(() => {});
}

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

  if (!bkash.isBkashConfigured()) {
    return res.status(503).json({
      error: 'bKash payment is not configured. Please set up bKash credentials in the admin settings or use COD.',
      transactionId: tx.id,
    });
  }

  try {
    const result = await bkash.createPayment({
      amount: Number(order.total),
      orderId: order.id,
      orderNumber: order.orderNumber,
      callbackURL: `${API_BASE}/api/payments/bkash/callback`,
    });

    await prisma.paymentTransaction.update({
      where: { id: tx.id },
      data: { metadata: { paymentID: result.paymentID, initiatedAt: new Date().toISOString() } },
    });

    res.json({ transactionId: tx.id, paymentID: result.paymentID, redirectUrl: result.bkashURL });
  } catch (err: any) {
    console.error('[bKash] initiate error:', err.message);
    res.status(502).json({ error: 'Failed to initiate bKash payment. Please try again or use COD.' });
  }
});

// bKash callback — customer redirected back after payment
router.get('/bkash/callback', async (req: Request, res: Response) => {
  const { paymentID, status } = req.query as { paymentID: string; status: string };

  if (status === 'cancel' || status === 'failure') {
    return res.redirect(`${CLIENT_URL}/en/checkout?payment=cancelled`);
  }

  try {
    const tx = await prisma.paymentTransaction.findFirst({
      where: { metadata: { path: ['paymentID'], equals: paymentID } },
    });
    if (!tx) { return res.redirect(`${CLIENT_URL}/en/checkout?payment=error`); }

    const result = await bkash.executePayment(paymentID);

    if (result.transactionStatus === 'Completed') {
      await onPaymentSuccess(tx.id, result.trxID, 'bkash');
      return res.redirect(`${CLIENT_URL}/en/orders/${tx.orderId}?payment=success`);
    }

    res.redirect(`${CLIENT_URL}/en/checkout?payment=failed`);
  } catch (err: any) {
    console.error('[bKash] callback error:', err.message);
    res.redirect(`${CLIENT_URL}/en/checkout?payment=error`);
  }
});

router.post('/bkash/confirm', requireAuth, async (req: Request, res: Response) => {
  const { transactionId, providerTxId } = req.body as { transactionId: string; providerTxId: string };
  const tx = await prisma.paymentTransaction.findUnique({ where: { id: transactionId } });
  if (!tx) { res.status(404).json({ error: 'Transaction not found' }); return; }
  await onPaymentSuccess(transactionId, providerTxId, 'bkash');
  res.json({ message: 'Payment confirmed' });
});

// ─── SSLCommerz ───────────────────────────────────────────────────────────────

router.post('/sslcommerz/initiate', requireAuth, async (req: Request, res: Response) => {
  const { orderId } = req.body as { orderId: string };
  // #region agent log
  const _dbg = (message: string, data: Record<string, unknown>) => {
    fetch(process.env.DEBUG_INGEST_URL || 'http://host.docker.internal:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a2ffd6'},body:JSON.stringify({sessionId:'a2ffd6',runId:'checkout-listen',hypothesisId:'E',location:'payments.ts:sslcommerz/initiate',message,data,timestamp:Date.now()})}).catch(()=>{});
  };
  _dbg('ssl initiate entry', { orderId, userId: req.user?.userId, configured: ssl.isSslConfigured() });
  // #endregion
  const [order, user] = await Promise.all([
    prisma.order.findFirst({ where: { id: orderId, userId: req.user!.userId } }),
    prisma.user.findUnique({ where: { id: req.user!.userId } }),
  ]);
  if (!order || !user) { res.status(404).json({ error: 'Order not found' }); return; }

  const tx = await prisma.paymentTransaction.create({
    data: {
      id: generateEntityId(),
      orderId,
      userId: req.user!.userId,
      method: 'sslcommerz',
      amount: order.total,
      metadata: { tran_id: '' },
    },
  });

  if (!ssl.isSslConfigured()) {
    // #region agent log
    _dbg('ssl not configured', { orderId, txId: tx.id });
    // #endregion
    return res.status(503).json({
      error: 'SSLCommerz is not configured. Please set up store credentials or use COD.',
      transactionId: tx.id,
    });
  }

  try {
    await prisma.paymentTransaction.update({ where: { id: tx.id }, data: { metadata: { tran_id: tx.id } } });

    const gatewayUrl = await ssl.initiatePayment({
      transactionId: tx.id,
      orderNumber: order.orderNumber,
      amount: Number(order.total),
      customerName: user.name,
      customerEmail: user.email || '',
      customerPhone: user.phone || '',
    });

    // #region agent log
    _dbg('ssl initiate ok', { orderId, txId: tx.id, hasRedirect: !!gatewayUrl });
    // #endregion
    res.json({ transactionId: tx.id, redirectUrl: gatewayUrl });
  } catch (err: any) {
    // #region agent log
    _dbg('ssl initiate error', { orderId, error: String(err?.message || err) });
    // #endregion
    console.error('[SSLCommerz] initiate error:', err.message);
    res.status(502).json({ error: 'Failed to initiate payment. Please try again or use COD.' });
  }
});

// SSLCommerz success redirect
router.post('/sslcommerz/success', async (req: Request, res: Response) => {
  const { tran_id, val_id, status } = req.body as { tran_id: string; val_id: string; status: string };

  if (status !== 'VALID' && status !== 'VALIDATED') {
    return res.redirect(`${CLIENT_URL}/en/checkout?payment=failed`);
  }

  try {
    const validation = await ssl.validatePayment(val_id);
    const tx = await prisma.paymentTransaction.findUnique({ where: { id: tran_id } });
    if (!tx) { return res.redirect(`${CLIENT_URL}/en/checkout?payment=error`); }
    if (!sslValidationMatchesTransaction(validation, tx)) {
      appLog('warn', 'sslcommerz_validation_mismatch', {
        transactionId: tran_id,
        validationTranId: validation.tranId,
        validationAmount: validation.amount,
        validationCurrency: validation.currency,
      });
      return res.redirect(`${CLIENT_URL}/en/checkout?payment=invalid`);
    }
    await onPaymentSuccess(tx.id, val_id, 'sslcommerz');
    // #region agent log
    fetch(process.env.DEBUG_INGEST_URL || 'http://host.docker.internal:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a8d503' },
      body: JSON.stringify({
        sessionId: 'a8d503',
        runId: process.env.DEBUG_RUN_ID || 'pre-fix',
        hypothesisId: 'D',
        location: 'payments.ts:sslcommerz/success',
        message: 'ssl_success_redirect',
        data: { orderId: tx.orderId, userId: tx.userId, amount: Number(tx.amount) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    // Land on account order page (same auth shell as the rest of account)
    res.redirect(`${CLIENT_URL}/en/account/orders/${tx.orderId}?payment=success`);
  } catch (err: any) {
    console.error('[SSLCommerz] success error:', err.message);
    res.redirect(`${CLIENT_URL}/en/checkout?payment=error`);
  }
});

// SSLCommerz IPN webhook (no auth — verified by IPN hash + store credentials)
router.post('/sslcommerz/ipn', async (req: Request, res: Response) => {
  const body = req.body as Record<string, string>;
  const { tran_id, val_id, status } = body;

  if (ssl.isSslConfigured() && !ssl.verifyIpnHash(body)) {
    console.warn('[SSLCommerz] IPN hash mismatch — possible tampering');
    res.status(200).send('HASH_MISMATCH');
    return;
  }

  if (status !== 'VALID') { res.status(200).send('INVALID'); return; }

  try {
    const validation = await ssl.validatePayment(val_id);
    const tx = await prisma.paymentTransaction.findUnique({ where: { id: tran_id } });
    if (!tx || !sslValidationMatchesTransaction(validation, tx)) {
      res.status(200).send('VALIDATION_FAILED');
      return;
    }
    await onPaymentSuccess(tx.id, val_id, 'sslcommerz');
  } catch (err: any) {
    console.error('[SSLCommerz] IPN error:', err.message);
  }

  res.status(200).send('OK');
});

router.post('/sslcommerz/fail', async (_req, res) => {
  res.redirect(`${CLIENT_URL}/en/checkout?payment=failed`);
});

router.post('/sslcommerz/cancel', async (_req, res) => {
  res.redirect(`${CLIENT_URL}/en/checkout?payment=cancelled`);
});

// ─── Nagad ────────────────────────────────────────────────────────────────────

router.post('/nagad/initiate', requireAuth, async (req: Request, res: Response) => {
  const { orderId } = req.body as { orderId: string };
  const order = await prisma.order.findFirst({ where: { id: orderId, userId: req.user!.userId } });
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

  const tx = await prisma.paymentTransaction.create({
    data: { id: generateEntityId(), orderId, userId: req.user!.userId, method: 'nagad', amount: order.total },
  });

  if (!nagad.isNagadConfigured()) {
    return res.status(503).json({
      error: 'Nagad is not configured. Please set up Nagad credentials or use COD.',
      transactionId: tx.id,
    });
  }

  try {
    const result = await nagad.createPayment({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: Number(order.total),
    });
    res.json({ transactionId: tx.id, redirectUrl: result.callBackUrl });
  } catch (err: any) {
    console.error('[Nagad] initiate error:', err.message);
    res.status(502).json({ error: 'Failed to initiate Nagad payment. Please try again or use COD.' });
  }
});

router.post('/nagad/callback', async (req: Request, res: Response) => {
  const { orderId, payment_ref_id, status } = req.body as { orderId: string; payment_ref_id: string; status: string };
  if (status !== 'Success') { return res.redirect(`${CLIENT_URL}/en/checkout?payment=failed`); }

  const tx = await prisma.paymentTransaction.findFirst({
    where: { orderId, status: { in: ['pending', 'failed'] } },
    orderBy: { createdAt: 'desc' },
  });
  if (tx) { await onPaymentSuccess(tx.id, payment_ref_id, 'nagad'); }
  res.redirect(`${CLIENT_URL}/en/orders/${orderId}?payment=success`);
});

router.post('/nagad/confirm', requireAuth, async (req: Request, res: Response) => {
  const { transactionId, providerTxId } = req.body as { transactionId: string; providerTxId: string };
  await onPaymentSuccess(transactionId, providerTxId, 'nagad');
  res.json({ message: 'Payment confirmed' });
});

// ─── Rocket (DBBL Mobile Banking) ─────────────────────────────────────────────

router.post('/rocket/initiate', requireAuth, async (req: Request, res: Response) => {
  const { orderId } = req.body as { orderId: string };
  const order = await prisma.order.findFirst({ where: { id: orderId, userId: req.user!.userId } });
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }
  const tx = await prisma.paymentTransaction.create({
    data: { id: generateEntityId(), orderId, userId: req.user!.userId, method: 'rocket', amount: order.total },
  });
  // Rocket uses SSLCommerz gateway — configure SSLCOMMERZ creds to enable
  if (!ssl.isSslConfigured()) {
    return res.status(503).json({ error: 'Rocket payment requires SSLCommerz credentials. Please configure or use COD.', transactionId: tx.id });
  }
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  try {
    const gatewayUrl = await ssl.initiatePayment({
      transactionId: tx.id, orderNumber: order.orderNumber,
      amount: Number(order.total), customerName: user?.name || '', customerEmail: user?.email || '', customerPhone: user?.phone || '',
    });
    res.json({ transactionId: tx.id, redirectUrl: gatewayUrl });
  } catch (err: any) {
    res.status(502).json({ error: 'Failed to initiate Rocket payment.' });
  }
});

// ─── Upay ─────────────────────────────────────────────────────────────────────

router.post('/upay/initiate', requireAuth, async (req: Request, res: Response) => {
  const { orderId } = req.body as { orderId: string };
  const order = await prisma.order.findFirst({ where: { id: orderId, userId: req.user!.userId } });
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }
  const tx = await prisma.paymentTransaction.create({
    data: { id: generateEntityId(), orderId, userId: req.user!.userId, method: 'upay', amount: order.total },
  });
  // Upay uses SSLCommerz gateway
  if (!ssl.isSslConfigured()) {
    return res.status(503).json({ error: 'Upay payment requires SSLCommerz credentials. Please configure or use COD.', transactionId: tx.id });
  }
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  try {
    const gatewayUrl = await ssl.initiatePayment({
      transactionId: tx.id, orderNumber: order.orderNumber,
      amount: Number(order.total), customerName: user?.name || '', customerEmail: user?.email || '', customerPhone: user?.phone || '',
    });
    res.json({ transactionId: tx.id, redirectUrl: gatewayUrl });
  } catch (err: any) {
    res.status(502).json({ error: 'Failed to initiate Upay payment.' });
  }
});

export default router;
