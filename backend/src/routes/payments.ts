import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

import { requireAuth } from '../middleware/auth';
import { generateEntityId } from '../utils/hexId';
import { earnPoints } from '../services/obPointsService';
import { emitAdminEvent } from '../lib/adminEvents';
import * as bkash from '../services/bkashService';
import * as ssl from '../services/sslcommerzService';
import * as nagad from '../services/nagadService';
import { sendToUser } from '../services/pushNotificationService';
import { notifyCustomer } from '../services/customerNotify';
import { appLog } from '../lib/appLog';
import { sendPaymentInvoice } from '../services/emailService';

const router = Router();

const CLIENT_URL = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
const API_BASE = process.env.API_BASE_URL || process.env.PUBLIC_BASE_URL || 'http://localhost:4000';

function sslForm(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  const src = { ...(req.query || {}), ...(typeof req.body === 'object' && req.body ? req.body : {}) } as Record<string, unknown>;
  for (const [k, v] of Object.entries(src)) {
    if (Array.isArray(v)) out[k] = String(v[0] ?? '');
    else if (v != null) out[k] = String(v);
  }
  return out;
}

/** 303 after gateway POST so the browser follows with GET (302 can replay POST and drop the session). */
function redirectSeeOther(res: Response, url: string): void {
  res.status(303);
  res.setHeader('Location', url);
  res.end();
}

/** SSLCommerz posts into an iframe/top window. 303 onto a Next.js page 500s if POST is replayed. */
function sendSslBrowserReturn(res: Response, dest: string, heading: string, detail: string): void {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${heading}</title>
<style>
body{font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center}
a{color:#0369a1;font-weight:600}
</style>
</head>
<body>
<p style="font-weight:700;font-size:1.2rem;margin:0 0 8px">${heading}</p>
<p style="margin:0 0 16px">${detail}</p>
<p><a href="${String(dest).replace(/"/g, '&quot;')}">Continue to OceanBazar</a></p>
<script>
(function(){
  var u = ${JSON.stringify(dest)};
  try { window.top.location.replace(u); }
  catch (e) { window.location.replace(u); }
})();
</script>
</body>
</html>`;
  res.status(200);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.removeHeader('X-Frame-Options');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors *",
  );
  res.send(html);
}

type PaymentPurpose = 'order_total' | 'delivery_fee';

function parsePurpose(raw: unknown): PaymentPurpose {
  return raw === 'delivery_fee' ? 'delivery_fee' : 'order_total';
}

function purposeFromMetadata(metadata: unknown): PaymentPurpose {
  if (metadata && typeof metadata === 'object' && (metadata as { purpose?: string }).purpose === 'delivery_fee') {
    return 'delivery_fee';
  }
  return 'order_total';
}

function resolveChargeAmount(
  order: { total: unknown; shippingFee: unknown; paymentMethod: string },
  purpose: PaymentPurpose,
): number {
  if (purpose === 'delivery_fee') {
    const fee = Number(order.shippingFee);
    if (!Number.isFinite(fee) || fee <= 0) {
      throw Object.assign(new Error('No delivery fee due for this order'), { status: 400 });
    }
    return fee;
  }
  return Number(order.total);
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function storefrontLocale(req?: Request): 'en' | 'bn' {
  const fromCookie = String(req?.cookies?.NEXT_LOCALE || req?.cookies?.ob_locale || '').toLowerCase();
  if (fromCookie === 'bn' || fromCookie === 'en') return fromCookie;
  const fromHeader = String(req?.headers?.['accept-language'] || '').toLowerCase();
  if (fromHeader.startsWith('bn')) return 'bn';
  return 'en';
}

function checkoutRecoveryUrl(
  payment: 'failed' | 'cancelled' | 'error' | 'invalid',
  transaction?: { orderId: string; method: string; purpose?: PaymentPurpose } | null,
  locale: 'en' | 'bn' = 'en',
): string {
  const params = new URLSearchParams({ payment });
  if (transaction?.orderId) params.set('orderId', transaction.orderId);
  if (transaction?.method) params.set('method', transaction.method);
  if (transaction?.purpose) params.set('purpose', transaction.purpose);
  return `${CLIENT_URL}/${locale}/checkout?${params.toString()}`;
}

async function recordPaymentFailure(
  transactionId: string | undefined,
  payment: 'failed' | 'cancelled' | 'error' | 'invalid',
  locale: 'en' | 'bn' = 'en',
): Promise<string> {
  if (!transactionId) return checkoutRecoveryUrl(payment, null, locale);
  const tx = await prisma.paymentTransaction.findUnique({ where: { id: transactionId } });
  if (!tx) return checkoutRecoveryUrl(payment, null, locale);
  if (tx.status === 'pending') {
    await prisma.paymentTransaction.update({
      where: { id: tx.id },
      data: { status: 'failed' },
    });
  }
  return checkoutRecoveryUrl(payment, {
    orderId: tx.orderId,
    method: tx.method,
    purpose: purposeFromMetadata(tx.metadata),
  }, locale);
}

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

async function clearUserCart(userId: string) {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (cart) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }
}

async function onPaymentSuccess(transactionId: string, providerTxId: string, method: string) {
  const outcome = await prisma.$transaction(async (txn) => {
    const row = await txn.paymentTransaction.findUnique({ where: { id: transactionId } });
    if (!row) return { kind: 'missing' as const };
    if (row.status === 'success') {
      return {
        kind: 'duplicate' as const,
        orderId: row.orderId,
        userId: row.userId,
        amount: row.amount,
        purpose: purposeFromMetadata(row.metadata),
      };
    }
    if (row.status === 'refunded') {
      return { kind: 'blocked' as const, reason: 'refunded' as const };
    }
    const purpose = purposeFromMetadata(row.metadata);
    const orderRow = await txn.order.findUnique({
      where: { id: row.orderId },
      select: { status: true, total: true, paymentMethod: true },
    });
    const tx = await txn.paymentTransaction.update({
      where: { id: transactionId },
      data: { status: 'success', providerTxId },
    });

    if (purpose === 'delivery_fee') {
      // Prepaid courier charge only — goods remain COD unpaid until delivery.
      await txn.order.update({
        where: { id: tx.orderId },
        data: {
          deliveryPaymentStatus: 'paid',
          deliveryFeePaid: tx.amount,
        },
      });
      await txn.orderTimeline.create({
        data: {
          orderId: tx.orderId,
          status: orderRow?.status || 'pending',
          note: `Delivery fee ৳${Number(tx.amount).toLocaleString()} paid via ${method}`,
          actorType: 'system',
        },
      });
    } else {
      await txn.order.update({
        where: { id: tx.orderId },
        data: { paymentStatus: 'paid' },
      });
      await txn.orderTimeline.create({
        data: {
          orderId: tx.orderId,
          status: orderRow?.status || 'pending',
          note: `Payment received via ${method}`,
          actorType: 'system',
        },
      });
    }

    return {
      kind: 'applied' as const,
      tx,
      purpose,
      orderTotal: Number(orderRow?.total || tx.amount),
      paymentMethod: orderRow?.paymentMethod || method,
    };
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
  try {
    const { persistGatewayFeeOnPayment } = await import('../services/taxVatSystem');
    await persistGatewayFeeOnPayment({
      orderId: tx.orderId,
      paymentTransactionId: tx.id,
      customerPayment: Number(tx.amount),
    });
  } catch { /* non-fatal gateway fee ledger */ }

  try {
    await clearUserCart(tx.userId);
  } catch (cartErr) {
    appLog('warn', 'payment_success_cart_clear_failed', {
      orderId: tx.orderId,
      detail: cartErr instanceof Error ? cartErr.message : String(cartErr),
    });
  }

  const earnAmount = outcome.purpose === 'delivery_fee' ? outcome.orderTotal : Number(tx.amount);
  try {
    const payer = await prisma.user.findUnique({
      where: { id: tx.userId },
      select: { userType: true },
    });
    if (payer?.userType !== 'guest') {
      await earnPoints(tx.userId, tx.orderId, earnAmount);
    }
  } catch (pointsErr) {
    appLog('warn', 'payment_success_points_failed', {
      orderId: tx.orderId,
      detail: pointsErr instanceof Error ? pointsErr.message : String(pointsErr),
    });
  }
  try {
    emitAdminEvent('admin:payment', {
      txId: tx.id,
      orderId: tx.orderId,
      amount: Number(tx.amount),
      status: 'success',
      method,
      purpose: outcome.purpose,
    });
  } catch { /* non-fatal */ }

  const paidOrder = await prisma.order.findUnique({
    where: { id: tx.orderId },
    include: { items: true, user: true },
  });

  try {
    await notifyCustomer({
      userId: tx.userId,
      event: 'payment_verification',
      vars: { orderNumber: paidOrder?.orderNumber || '' },
    });
  } catch { /* non-fatal */ }

  if (outcome.purpose !== 'delivery_fee' && paidOrder) {
    try {
      const { sendMetaCapiPurchase } = await import('../services/meta/metaCapiService');
      const { mergeCapiUserData } = await import('../lib/metaAttribution');
      const userData = await mergeCapiUserData(paidOrder.id, {
        email: paidOrder.user?.email,
        phone: paidOrder.user?.phone,
      });
      void sendMetaCapiPurchase({
        orderId: paidOrder.id,
        value: Number(paidOrder.total),
        contents: paidOrder.items.map((i) => ({
          id: i.productId,
          quantity: i.quantity,
          item_price: Number(i.unitPrice),
        })),
        userData,
      });
    } catch { /* non-fatal */ }
  }

  if (outcome.purpose === 'delivery_fee' && paidOrder) {
    try {
      const { sendOrderConfirmation } = await import('../services/emailService');
      const { sendOrderConfirmationSms, sendOrderConfirmationWhatsApp } = await import('../services/smsService');
      if (paidOrder.user.email) {
        sendOrderConfirmation(paidOrder.user.email, {
          orderNumber: paidOrder.orderNumber,
          total: Number(paidOrder.total),
          items: paidOrder.items.map((i) => ({
            productTitle: i.productTitle,
            quantity: i.quantity,
            unitPrice: Number(i.unitPrice),
          })),
        }).catch(() => {});
      }
      if (paidOrder.user.phone) {
        sendOrderConfirmationSms(paidOrder.user.phone, paidOrder.orderNumber).catch(() => {});
        sendOrderConfirmationWhatsApp(
          paidOrder.user.phone,
          paidOrder.orderNumber,
          Number(paidOrder.total),
          paidOrder.items.map((i) => ({ productTitle: i.productTitle, quantity: i.quantity })),
        ).catch(() => {});
      }
    } catch { /* non-fatal */ }
  } else if (paidOrder?.user.email) {
    try {
      await sendPaymentInvoice(paidOrder.user.email, {
        id: paidOrder.id,
        orderNumber: paidOrder.orderNumber,
        subtotal: Number(paidOrder.subtotal),
        discount: Number(paidOrder.discount),
        gst: Number(paidOrder.gst),
        shippingFee: Number(paidOrder.shippingFee),
        serviceFee: Number(paidOrder.serviceFee),
        obDiscount: Number(paidOrder.obDiscount),
        total: Number(paidOrder.total),
        paymentMethod: method,
        items: paidOrder.items.map((item) => ({
          productTitle: item.productTitle,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          lineTotal: Number(item.lineTotal),
        })),
      });
    } catch (invoiceError) {
      appLog('warn', 'payment_invoice_failed', {
        orderId: tx.orderId,
        detail: invoiceError instanceof Error ? invoiceError.message : String(invoiceError),
      });
    }
  }

  const amountLabel = Number(tx.amount).toLocaleString();
  sendToUser(tx.userId, {
    title: outcome.purpose === 'delivery_fee' ? 'Delivery fee received ⏳' : 'Payment Under Verification ⏳',
    body:
      outcome.purpose === 'delivery_fee'
        ? `Order #${paidOrder?.orderNumber} — delivery ৳${amountLabel} received. Goods payable on delivery.`
        : `Order #${paidOrder?.orderNumber} — ৳${amountLabel} received via ${method}. We'll confirm shortly.`,
    url: `/en/account/orders/${tx.orderId}`,
    tag: 'payment',
  }).catch(() => {});
}

// ─── bKash ────────────────────────────────────────────────────────────────────

router.post('/bkash/initiate', requireAuth, async (req: Request, res: Response) => {
  const { orderId } = req.body as { orderId: string; purpose?: string };
  const purpose = parsePurpose(req.body?.purpose);
  const order = await prisma.order.findFirst({ where: { id: orderId, userId: req.user!.userId } });
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

  let amount: number;
  try {
    amount = resolveChargeAmount(order, purpose);
  } catch (err: any) {
    res.status(err?.status || 400).json({ error: err?.message || 'Invalid payment amount' });
    return;
  }

  const tx = await prisma.paymentTransaction.create({
    data: {
      id: generateEntityId(),
      orderId,
      userId: req.user!.userId,
      method: 'bkash',
      amount,
      metadata: { purpose, initiatedAt: new Date().toISOString() },
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
      amount,
      orderId: order.id,
      orderNumber: order.orderNumber,
      callbackURL: `${API_BASE}/api/payments/bkash/callback`,
    });

    await prisma.paymentTransaction.update({
      where: { id: tx.id },
      data: { metadata: { purpose, paymentID: result.paymentID, initiatedAt: new Date().toISOString() } },
    });

    res.json({ transactionId: tx.id, paymentID: result.paymentID, redirectUrl: result.bkashURL, purpose });
  } catch (err: any) {
    console.error('[bKash] initiate error:', err.message);
    res.status(502).json({ error: 'Failed to initiate bKash payment. Please try again or use COD.' });
  }
});

// bKash callback — customer redirected back after payment
router.get('/bkash/callback', async (req: Request, res: Response) => {
  const { paymentID, status } = req.query as { paymentID: string; status: string };

  if (status === 'cancel' || status === 'failure') {
    const tx = await prisma.paymentTransaction.findFirst({
      where: { metadata: { path: ['paymentID'], equals: paymentID } },
      select: { id: true },
    });
    return redirectSeeOther(res,await recordPaymentFailure(tx?.id, status === 'cancel' ? 'cancelled' : 'failed'));
  }

  try {
    const tx = await prisma.paymentTransaction.findFirst({
      where: { metadata: { path: ['paymentID'], equals: paymentID } },
    });
    if (!tx) { return redirectSeeOther(res,`${CLIENT_URL}/en/checkout?payment=error`); }

    const result = await bkash.executePayment(paymentID);

    if (result.transactionStatus === 'Completed') {
      await onPaymentSuccess(tx.id, result.trxID, 'bkash');
      return redirectSeeOther(res,`${CLIENT_URL}/en/account/orders/${tx.orderId}?payment=success`);
    }

    redirectSeeOther(res,await recordPaymentFailure(tx.id, 'failed'));
  } catch (err: any) {
    console.error('[bKash] callback error:', err.message);
    redirectSeeOther(res,checkoutRecoveryUrl('error'));
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
  const { orderId } = req.body as { orderId: string; purpose?: string };
  const purpose: PaymentPurpose = 'order_total';
  const [order, user] = await Promise.all([
    prisma.order.findFirst({ where: { id: orderId, userId: req.user!.userId } }),
    prisma.user.findUnique({ where: { id: req.user!.userId } }),
  ]);
  if (!order || !user) { res.status(404).json({ error: 'Order not found' }); return; }

  let amount: number;
  try {
    amount = resolveChargeAmount(order, purpose);
  } catch (err: any) {
    res.status(err?.status || 400).json({ error: err?.message || 'Invalid payment amount' });
    return;
  }


  const tx = await prisma.paymentTransaction.create({
    data: {
      id: generateEntityId(),
      orderId,
      userId: req.user!.userId,
      method: 'sslcommerz',
      amount,
      metadata: { purpose, tran_id: '' },
    },
  });

  if (!ssl.isSslConfigured()) {
    return res.status(503).json({
      error: 'SSLCommerz is not configured. Please set up store credentials or use COD.',
      transactionId: tx.id,
    });
  }

  try {
    await prisma.paymentTransaction.update({
      where: { id: tx.id },
      data: { metadata: { purpose, tran_id: tx.id } },
    });

    const sslResult = await ssl.initiatePayment({
      transactionId: tx.id,
      orderNumber: order.orderNumber,
      amount,
      customerName: user.name,
      customerEmail: user.email || '',
      customerPhone: user.phone || '',
    });

    res.json({ transactionId: tx.id, redirectUrl: sslResult.gatewayPageURL, sessionkey: sslResult.sessionkey, purpose, amount });
  } catch (err: any) {
    const reason = String(err?.message || '').slice(0, 240);
    console.error('[SSLCommerz] initiate error:', reason);
    const publicReason = /store|url|credential|inactive|invalid|amount|sandbox|domain/i.test(reason)
      ? reason
      : 'Failed to initiate payment. Please try again.';
    res.status(502).json({ error: publicReason });
  }
});

/** Guest SSL initiate — orderId + guestEmail match (no JWT). */
router.post('/sslcommerz/initiate-guest', async (req: Request, res: Response) => {
  const { orderId, guestEmail } = req.body as { orderId?: string; guestEmail?: string };
  const email = String(guestEmail || '').trim().toLowerCase();
  if (!orderId || !email) {
    res.status(400).json({ error: 'orderId and guestEmail are required' });
    return;
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId },
    include: { user: true },
  });
  if (!order?.user) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  const orderEmail = String(order.user.email || '').trim().toLowerCase();
  if (!orderEmail || orderEmail !== email) {
    res.status(403).json({ error: 'Email does not match this order' });
    return;
  }
  if (order.user.userType !== 'guest' && order.paymentStatus === 'paid') {
    res.status(400).json({ error: 'Order already paid' });
    return;
  }

  const purpose: PaymentPurpose = 'order_total';
  let amount: number;
  try {
    amount = resolveChargeAmount(order, purpose);
  } catch (err: any) {
    res.status(err?.status || 400).json({ error: err?.message || 'Invalid payment amount' });
    return;
  }

  const tx = await prisma.paymentTransaction.create({
    data: {
      id: generateEntityId(),
      orderId,
      userId: order.userId,
      method: 'sslcommerz',
      amount,
      metadata: { purpose, tran_id: '', guest: true },
    },
  });

  if (!ssl.isSslConfigured()) {
    return res.status(503).json({
      error: 'SSLCommerz is not configured. Please set up store credentials or use COD.',
      transactionId: tx.id,
    });
  }

  try {
    await prisma.paymentTransaction.update({
      where: { id: tx.id },
      data: { metadata: { purpose, tran_id: tx.id, guest: true } },
    });

    const sslResult = await ssl.initiatePayment({
      transactionId: tx.id,
      orderNumber: order.orderNumber,
      amount,
      customerName: order.user.name,
      customerEmail: order.user.email || email,
      customerPhone: order.user.phone || '',
    });

    res.json({
      transactionId: tx.id,
      redirectUrl: sslResult.gatewayPageURL,
      sessionkey: sslResult.sessionkey,
      purpose,
      amount,
    });
  } catch (err: any) {
    const reason = String(err?.message || '').slice(0, 240);
    console.error('[SSLCommerz] guest initiate error:', reason);
    res.status(502).json({
      error: /store|url|credential|inactive|invalid|amount|sandbox|domain/i.test(reason)
        ? reason
        : 'Failed to initiate payment. Please try again.',
    });
  }
});

router.get('/sslcommerz/config', (_req: Request, res: Response) => {
  const info = ssl.sslRuntimeInfo();
  res.json({
    configured: ssl.isSslConfigured(),
    sandbox: info.sandbox,
    embedScriptUrl: info.sandbox
      ? 'https://sandbox.sslcommerz.com/embed.min.js'
      : 'https://seamless-epay.sslcommerz.com/embed.min.js',
    callbackOrigin: info.callbackBase,
  });
});

function paymentCompleteUrl(
  locale: 'en' | 'bn',
  status: 'success' | 'failed' | 'cancelled' | 'error' | 'invalid',
  orderId?: string,
  extras?: { risk?: boolean },
): string {
  const params = new URLSearchParams({ status });
  if (orderId) params.set('orderId', orderId);
  if (extras?.risk) params.set('risk', '1');
  return `${CLIENT_URL}/${locale}/payment/complete?${params.toString()}`;
}

async function handleSslSuccess(req: Request, res: Response) {
  const form = sslForm(req);
  const tran_id = form.tran_id || form.value_b || '';
  const val_id = form.val_id || '';
  const status = (form.status || '').toUpperCase();
  const locale = storefrontLocale(req);
  const risk = String(form.risk_level || '') === '1';
  const looksPaid = status === 'VALID' || status === 'VALIDATED' || Boolean(val_id);


  if (!looksPaid) {
    return sendSslBrowserReturn(
      res,
      await recordPaymentFailure(tran_id, 'failed', locale),
      'Payment was not completed',
      'You can try again from checkout.',
    );
  }

  try {
    const validation = await ssl.validatePayment(val_id);
    const validatedRisk = String((validation.raw as { risk_level?: unknown })?.risk_level ?? '') === '1' || risk;
    const tx = await prisma.paymentTransaction.findUnique({ where: { id: tran_id || validation.tranId } });
    if (!tx) {
      return sendSslBrowserReturn(
        res,
        paymentCompleteUrl(locale, 'error'),
        'Payment received',
        'We are confirming your order. Please check My Orders in a moment.',
      );
    }
    if (!sslValidationMatchesTransaction(validation, tx)) {
      appLog('warn', 'sslcommerz_validation_mismatch', {
        transactionId: tran_id,
        validationTranId: validation.tranId,
        validationAmount: validation.amount,
        validationCurrency: validation.currency,
      });
      return sendSslBrowserReturn(
        res,
        await recordPaymentFailure(tx.id, 'invalid', locale),
        'Payment could not be verified',
        'Please contact OceanBazar support with your order number.',
      );
    }
    await onPaymentSuccess(tx.id, val_id, 'sslcommerz');
    return sendSslBrowserReturn(
      res,
      paymentCompleteUrl(locale, 'success', tx.orderId, { risk: validatedRisk }),
      validatedRisk ? 'Payment received — verification needed' : 'Payment received',
      'Taking you back to OceanBazar…',
    );
  } catch (err: any) {
    console.error('[SSLCommerz] success error:', err.message);
    return sendSslBrowserReturn(
      res,
      paymentCompleteUrl(locale, 'error'),
      'Payment received',
      'We are confirming your order. Please check My Orders shortly.',
    );
  }
}

router.get('/sslcommerz/success', handleSslSuccess);
router.post('/sslcommerz/success', handleSslSuccess);

// SSLCommerz IPN webhook (no auth — verified by IPN hash + store credentials)
router.get('/sslcommerz/ipn', (_req: Request, res: Response) => {
  res.status(200).send('OK');
});

router.post('/sslcommerz/ipn', async (req: Request, res: Response) => {
  const body = sslForm(req);
  const { tran_id, val_id, status } = body;

  if (ssl.isSslConfigured() && body.verify_key && body.verify_sign && !ssl.verifyIpnHash(body)) {
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

async function handleSslFail(req: Request, res: Response) {
  const form = sslForm(req);
  const locale = storefrontLocale(req);
  const url = await recordPaymentFailure(form.tran_id || form.value_b || undefined, 'failed', locale);
  sendSslBrowserReturn(res, url, 'Payment failed', 'You can retry Secure Checkout from your order.');
}

async function handleSslCancel(req: Request, res: Response) {
  const form = sslForm(req);
  const locale = storefrontLocale(req);
  const url = await recordPaymentFailure(form.tran_id || form.value_b || undefined, 'cancelled', locale);
  sendSslBrowserReturn(res, url, 'Payment cancelled', 'Your order is saved. You can pay from checkout when ready.');
}

router.get('/sslcommerz/fail', handleSslFail);
router.post('/sslcommerz/fail', handleSslFail);
router.get('/sslcommerz/cancel', handleSslCancel);
router.post('/sslcommerz/cancel', handleSslCancel);

// ─── Nagad ────────────────────────────────────────────────────────────────────

router.post('/nagad/initiate', requireAuth, async (req: Request, res: Response) => {
  const { orderId } = req.body as { orderId: string; purpose?: string };
  const purpose = parsePurpose(req.body?.purpose);
  const order = await prisma.order.findFirst({ where: { id: orderId, userId: req.user!.userId } });
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

  let amount: number;
  try {
    amount = resolveChargeAmount(order, purpose);
  } catch (err: any) {
    res.status(err?.status || 400).json({ error: err?.message || 'Invalid payment amount' });
    return;
  }

  const tx = await prisma.paymentTransaction.create({
    data: {
      id: generateEntityId(),
      orderId,
      userId: req.user!.userId,
      method: 'nagad',
      amount,
      metadata: { purpose },
    },
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
      amount,
    });
    res.json({ transactionId: tx.id, redirectUrl: result.callBackUrl, purpose });
  } catch (err: any) {
    console.error('[Nagad] initiate error:', err.message);
    res.status(502).json({ error: 'Failed to initiate Nagad payment. Please try again or use COD.' });
  }
});

router.post('/nagad/callback', async (req: Request, res: Response) => {
  const { orderId, payment_ref_id, status } = req.body as { orderId: string; payment_ref_id: string; status: string };
  if (status !== 'Success') {
    const failedTx = await prisma.paymentTransaction.findFirst({
      where: { orderId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return redirectSeeOther(res,await recordPaymentFailure(failedTx?.id, 'failed'));
  }

  const tx = await prisma.paymentTransaction.findFirst({
    where: { orderId, status: { in: ['pending', 'failed'] } },
    orderBy: { createdAt: 'desc' },
  });
  if (tx) { await onPaymentSuccess(tx.id, payment_ref_id, 'nagad'); }
  redirectSeeOther(res,`${CLIENT_URL}/en/account/orders/${orderId}?payment=success`);
});

router.post('/nagad/confirm', requireAuth, async (req: Request, res: Response) => {
  const { transactionId, providerTxId } = req.body as { transactionId: string; providerTxId: string };
  await onPaymentSuccess(transactionId, providerTxId, 'nagad');
  res.json({ message: 'Payment confirmed' });
});

// ─── Rocket (DBBL Mobile Banking) ─────────────────────────────────────────────

router.post('/rocket/initiate', requireAuth, async (req: Request, res: Response) => {
  const { orderId } = req.body as { orderId: string; purpose?: string };
  const purpose = parsePurpose(req.body?.purpose);
  const order = await prisma.order.findFirst({ where: { id: orderId, userId: req.user!.userId } });
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

  let amount: number;
  try {
    amount = resolveChargeAmount(order, purpose);
  } catch (err: any) {
    res.status(err?.status || 400).json({ error: err?.message || 'Invalid payment amount' });
    return;
  }

  const tx = await prisma.paymentTransaction.create({
    data: {
      id: generateEntityId(),
      orderId,
      userId: req.user!.userId,
      method: 'rocket',
      amount,
      metadata: { purpose },
    },
  });
  // Rocket uses SSLCommerz gateway — configure SSLCOMMERZ creds to enable
  if (!ssl.isSslConfigured()) {
    return res.status(503).json({ error: 'Rocket payment requires SSLCommerz credentials. Please configure or use COD.', transactionId: tx.id });
  }
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  try {
    const sslResult = await ssl.initiatePayment({
      transactionId: tx.id, orderNumber: order.orderNumber,
      amount, customerName: user?.name || '', customerEmail: user?.email || '', customerPhone: user?.phone || '',
    });
    res.json({ transactionId: tx.id, redirectUrl: sslResult.gatewayPageURL, sessionkey: sslResult.sessionkey, purpose });
  } catch (err: any) {
    res.status(502).json({ error: 'Failed to initiate Rocket payment.' });
  }
});

// ─── Upay ─────────────────────────────────────────────────────────────────────

router.post('/upay/initiate', requireAuth, async (req: Request, res: Response) => {
  const { orderId } = req.body as { orderId: string; purpose?: string };
  const purpose = parsePurpose(req.body?.purpose);
  const order = await prisma.order.findFirst({ where: { id: orderId, userId: req.user!.userId } });
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

  let amount: number;
  try {
    amount = resolveChargeAmount(order, purpose);
  } catch (err: any) {
    res.status(err?.status || 400).json({ error: err?.message || 'Invalid payment amount' });
    return;
  }

  const tx = await prisma.paymentTransaction.create({
    data: {
      id: generateEntityId(),
      orderId,
      userId: req.user!.userId,
      method: 'upay',
      amount,
      metadata: { purpose },
    },
  });
  // Upay uses SSLCommerz gateway
  if (!ssl.isSslConfigured()) {
    return res.status(503).json({ error: 'Upay payment requires SSLCommerz credentials. Please configure or use COD.', transactionId: tx.id });
  }
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  try {
    const sslResult = await ssl.initiatePayment({
      transactionId: tx.id, orderNumber: order.orderNumber,
      amount, customerName: user?.name || '', customerEmail: user?.email || '', customerPhone: user?.phone || '',
    });
    res.json({ transactionId: tx.id, redirectUrl: sslResult.gatewayPageURL, sessionkey: sslResult.sessionkey, purpose });
  } catch (err: any) {
    res.status(502).json({ error: 'Failed to initiate Upay payment.' });
  }
});

export default router;
