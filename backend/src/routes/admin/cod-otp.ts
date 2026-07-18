/**
 * COD OTP Confirmation — Before dispatching a COD order, the admin sends a
 * 6-digit OTP to the customer's phone. The customer must confirm receipt
 * of the OTP (either online or via call) before the parcel is handed to courier.
 *
 * This prevents fake/prank COD orders and reduces RTOs (return-to-origin).
 *
 * Flow:
 *   Admin panel → POST /api/admin/cod-otp/:orderId/send  (send OTP to customer)
 *   Customer confirms → POST /api/admin/cod-otp/:orderId/verify (admin inputs customer's OTP)
 *   On success → order moves to 'confirmed_cod' status → courier assignment unlocked
 */
import { prisma } from '../../lib/prisma';

import { Router, Request, Response } from 'express';

import { requireAdmin } from '../../middleware/auth';
import { sendOtpSms } from '../../services/smsService';
import { routeParam } from '../../utils/params';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const router = Router();

const OTP_EXPIRE_MS = 10 * 60 * 1000; // 10 minutes

function generateOtp(): string {
  return String(Math.floor(100000 + crypto.randomInt(900000)));
}

// ─── Send COD OTP to customer ─────────────────────────────────────────────────
// POST /api/admin/cod-otp/:orderId/send

router.post('/:orderId/send', requireAdmin, async (req: Request, res: Response) => {
  const orderId = routeParam(req.params.orderId);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: { select: { id: true, name: true, phone: true } } },
  });

  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  if (order.paymentMethod !== 'cod') {
    res.status(400).json({ error: 'Order is not a COD order' });
    return;
  }
  if (!['pending', 'processing'].includes(order.status)) {
    res.status(400).json({ error: `Cannot send OTP for order in status: ${order.status}` });
    return;
  }
  if (!order.user.phone) {
    res.status(400).json({ error: 'Customer has no phone number on file' });
    return;
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRE_MS);

  // Store OTP in cod_otp_logs table
  await prisma.$executeRaw`
    INSERT INTO cod_otp_logs (id, order_id, otp_hash, expires_at, created_at)
    VALUES (
      ${uuidv4()},
      ${orderId},
      ${crypto.createHash('sha256').update(otp).digest('hex')},
      ${expiresAt},
      NOW()
    )
    ON CONFLICT (order_id) DO UPDATE
      SET otp_hash = EXCLUDED.otp_hash,
          expires_at = EXCLUDED.expires_at,
          verified = FALSE,
          attempts = 0,
          created_at = NOW()
  `;

  // Send OTP to customer
  const smsSent = await sendOtpSms(order.user.phone, otp, 'COD confirmation');

  // Timeline entry
  await prisma.orderTimeline.create({
    data: {
      orderId,
      status: order.status,
      note: `COD OTP sent to customer phone ${order.user.phone.replace(/\d(?=\d{4})/g, '*')}. Expires in 10 min.`,
      actorType: 'admin',
    },
  });

  if (process.env.NODE_ENV !== 'production') {
    // In dev/staging, return OTP in response for easy testing
    console.log(`[cod-otp] DEV ONLY — OTP for order ${order.orderNumber}: ${otp}`);
  }

  res.json({
    ok: true,
    smsSent,
    phone: order.user.phone.replace(/\d(?=\d{4})/g, '*'),
    expiresAt: expiresAt.toISOString(),
    ...(process.env.NODE_ENV !== 'production' ? { _devOtp: otp } : {}),
  });
});

// ─── Verify COD OTP (admin inputs what customer said) ─────────────────────────
// POST /api/admin/cod-otp/:orderId/verify

router.post('/:orderId/verify', requireAdmin, async (req: Request, res: Response) => {
  const orderId = routeParam(req.params.orderId);
  const { otp } = req.body as { otp: string };

  if (!otp || !/^\d{6}$/.test(String(otp))) {
    res.status(400).json({ error: 'OTP must be a 6-digit number' });
    return;
  }

  const record = await prisma.$queryRaw<any[]>`
    SELECT * FROM cod_otp_logs WHERE order_id = ${orderId} LIMIT 1
  `;

  if (!record || record.length === 0) {
    res.status(404).json({ error: 'No OTP has been sent for this order. Send OTP first.' });
    return;
  }

  const row = record[0];

  if (row.verified) {
    res.json({ ok: true, alreadyVerified: true, message: 'OTP already verified — order ready for dispatch.' });
    return;
  }

  if (new Date(row.expires_at) < new Date()) {
    res.status(400).json({ error: 'OTP has expired. Please send a new OTP.' });
    return;
  }

  const MAX_ATTEMPTS = 5;
  if (row.attempts >= MAX_ATTEMPTS) {
    res.status(429).json({ error: 'Too many failed attempts. Send a new OTP.' });
    return;
  }

  const inputHash = crypto.createHash('sha256').update(String(otp)).digest('hex');
  if (inputHash !== row.otp_hash) {
    await prisma.$executeRaw`
      UPDATE cod_otp_logs SET attempts = attempts + 1 WHERE order_id = ${orderId}
    `;
    const remaining = MAX_ATTEMPTS - (row.attempts + 1);
    res.status(400).json({ error: `Invalid OTP. ${remaining} attempt(s) remaining.` });
    return;
  }

  // ✅ Valid OTP — mark verified and move order to confirmed_cod
  await prisma.$executeRaw`
    UPDATE cod_otp_logs SET verified = TRUE, verified_at = NOW() WHERE order_id = ${orderId}
  `;

  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'processing' as any },
  });

  const order = await prisma.order.findUnique({ where: { id: orderId } });

  await prisma.orderTimeline.create({
    data: {
      orderId,
      status: 'processing',
      note: 'COD OTP verified by customer — order confirmed for dispatch.',
      actorType: 'admin',
    },
  });

  res.json({
    ok: true,
    verified: true,
    orderNumber: order?.orderNumber,
    message: 'COD order confirmed. You may now assign a courier.',
  });
});

// ─── Get COD OTP status ───────────────────────────────────────────────────────
// GET /api/admin/cod-otp/:orderId/status

router.get('/:orderId/status', requireAdmin, async (req: Request, res: Response) => {
  const orderId = routeParam(req.params.orderId);
  const record = await prisma.$queryRaw<any[]>`
    SELECT order_id, verified, attempts, expires_at, created_at, verified_at
    FROM cod_otp_logs WHERE order_id = ${orderId} LIMIT 1
  `;

  if (!record || record.length === 0) {
    res.json({ sent: false });
    return;
  }
  const row = record[0];
  res.json({
    sent: true,
    verified: row.verified,
    attempts: row.attempts,
    expired: new Date(row.expires_at) < new Date(),
    expiresAt: row.expires_at,
    verifiedAt: row.verified_at,
    sentAt: row.created_at,
  });
});

export default router;
