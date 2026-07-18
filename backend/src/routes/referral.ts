/**
 * Referral / Affiliate System
 *
 * - GET  /api/referral/my-code      → get (or create) the current user's referral code
 * - GET  /api/referral/stats        → get referral stats (clicks, signups, points earned)
 * - POST /api/referral/track-click  → track a referral link click (public)
 * - POST /api/referral/claim        → called during registration — attribute sign-up to referrer
 */
import { prisma } from '../lib/prisma';

import { Router, Request, Response } from 'express';

import { requireAuth } from '../middleware/auth';
import { generateEntityId } from '../utils/hexId';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const REFERRAL_SIGNUP_POINTS = 200;   // points given to referrer when someone signs up
const REFERRAL_PURCHASE_POINTS = 500; // points given to referrer on referree's first purchase

function generateReferralCode(userId: string): string {
  return (userId.toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase()).slice(0, 10);
}

// GET /api/referral/my-code — get or create referral code
router.get('/my-code', requireAuth, async (req: Request, res: Response) => {
  let ref = await prisma.referral_codes.findUnique({ where: { userId: req.user!.userId } });
  if (!ref) {
    let code = generateReferralCode(req.user!.userId);
    let attempts = 0;
    while (attempts < 5) {
      const exists = await prisma.referral_codes.findUnique({ where: { code } });
      if (!exists) break;
      code = generateReferralCode(req.user!.userId);
      attempts++;
    }
    ref = await prisma.referral_codes.create({
      data: {
        id: generateEntityId(),
        userId: req.user!.userId,
        code,
      },
    });
  }

  const shareUrl = `${process.env.CLIENT_URL || 'https://oceanbazar.com'}/en/auth/register?ref=${ref.code}`;
  res.json({ code: ref.code, shareUrl, clickCount: ref.clickCount, signupCount: ref.signupCount, earnedPoints: ref.earnedPoints });
});

// GET /api/referral/stats — referral stats
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  const ref = await prisma.referral_codes.findUnique({ where: { userId: req.user!.userId } });
  if (!ref) { res.json({ code: null, clickCount: 0, signupCount: 0, earnedPoints: 0, events: [] }); return; }

  const events = await prisma.referral_events.findMany({
    where: { referrerId: req.user!.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.json({
    code: ref.code,
    shareUrl: `${process.env.CLIENT_URL || 'https://oceanbazar.com'}/en/auth/register?ref=${ref.code}`,
    clickCount: ref.clickCount,
    signupCount: ref.signupCount,
    earnedPoints: ref.earnedPoints,
    events: events.map((e) => ({
      event: e.event,
      pointsAwarded: e.pointsAwarded,
      createdAt: e.createdAt.toISOString(),
    })),
  });
});

// POST /api/referral/track-click — anonymous click tracking
router.post('/track-click', async (req: Request, res: Response) => {
  const { code } = req.body as { code: string };
  if (!code?.trim()) { res.status(400).json({ error: 'code required' }); return; }

  await prisma.referral_codes.updateMany({
    where: { code: code.trim().toUpperCase() },
    data: { clickCount: { increment: 1 } },
  });

  res.json({ ok: true });
});

// POST /api/referral/claim — called during or after registration with a ref code
router.post('/claim', requireAuth, async (req: Request, res: Response) => {
  const { code } = req.body as { code: string };
  if (!code?.trim()) { res.status(400).json({ error: 'code required' }); return; }

  const referrerCode = await prisma.referral_codes.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!referrerCode) { res.status(404).json({ error: 'Invalid referral code' }); return; }

  if (referrerCode.userId === req.user!.userId) {
    res.status(400).json({ error: 'Cannot use your own referral code' });
    return;
  }

  const existing = await prisma.referral_events.findFirst({
    where: { referredId: req.user!.userId },
  });
  if (existing) { res.status(409).json({ error: 'Already claimed a referral' }); return; }

  await Promise.all([
    prisma.referral_events.create({
      data: {
        id: uuidv4(),
        referrerId: referrerCode.userId,
        referredId: req.user!.userId,
        code: referrerCode.code,
        event: 'signup',
        pointsAwarded: REFERRAL_SIGNUP_POINTS,
      },
    }),
    prisma.referral_codes.update({
      where: { userId: referrerCode.userId },
      data: {
        signupCount: { increment: 1 },
        earnedPoints: { increment: REFERRAL_SIGNUP_POINTS },
      },
    }),
    prisma.obPointsLedger.create({
      data: {
        userId: referrerCode.userId,
        type: 'earn',
        points: REFERRAL_SIGNUP_POINTS,
        note: `Referral bonus — ${code.trim().toUpperCase()}`,
      },
    }),
  ]);

  res.json({ ok: true, pointsAwarded: REFERRAL_SIGNUP_POINTS });
});

export default router;
