import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getUserTierInfo, getLedger } from '../services/obPointsService';
import {
  TIER_THRESHOLDS,
  POINTS_EXPIRY_DAYS,
  SLAB_SIZE,
  SLAB_BASE_VALUE,
  SLAB_INCREMENT,
  MIN_REDEEMABLE_POINTS,
  calculateSlabRedemptionValue,
} from '../utils/obPoints';

const router = Router();

// GET /api/ob-points/tiers — public tier definitions (no auth required)
router.get('/tiers', (_req, res: Response) => {
  res.json({
    tiers: [
      { name: 'Bronze', minSpend: TIER_THRESHOLDS.Bronze, maxSpend: TIER_THRESHOLDS.Silver - 1 },
      { name: 'Silver', minSpend: TIER_THRESHOLDS.Silver, maxSpend: TIER_THRESHOLDS.Gold - 1 },
      { name: 'Gold',   minSpend: TIER_THRESHOLDS.Gold,   maxSpend: null },
    ],
    redemptionFormula: {
      slabSize: SLAB_SIZE,
      baseValue: SLAB_BASE_VALUE,
      increment: SLAB_INCREMENT,
      minRedeemable: MIN_REDEEMABLE_POINTS,
      examples: [
        { points: 10000, bdt: calculateSlabRedemptionValue(10000) },
        { points: 20000, bdt: calculateSlabRedemptionValue(20000) },
        { points: 30000, bdt: calculateSlabRedemptionValue(30000) },
      ],
    },
    expiryDays: POINTS_EXPIRY_DAYS,
  });
});

router.use(requireAuth);

// GET /api/ob-points/balance — balance + tier info + redemption options
router.get('/balance', async (req: Request, res: Response) => {
  const info = await getUserTierInfo(req.user!.userId);
  res.json(info);
});

// GET /api/ob-points/ledger
router.get('/ledger', async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = parseInt(String(req.query.limit || '20'));
  const data = await getLedger(req.user!.userId, page, limit);
  res.json(data);
});

// POST /api/ob-points/redeem — disabled; redeem only via checkout (order place).
router.post('/redeem', async (req: Request, res: Response) => {
  // #region agent log
  {
    const payload = {
      sessionId: '1eb282',
      runId: 'avatar-ob',
      hypothesisId: 'H-OB-REDEEM-GATE',
      location: 'ob-points.ts:POST/redeem',
      message: 'standalone redeem blocked',
      data: { points: Number((req.body as { points?: number })?.points) || 0 },
      timestamp: Date.now(),
    };
    fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '1eb282' },
      body: JSON.stringify(payload),
    }).catch(() => {});
    try {
      const fs = require('fs') as typeof import('fs');
      fs.appendFileSync('/tmp/ob-debug-1eb282.ndjson', `${JSON.stringify(payload)}\n`);
    } catch { /* ignore */ }
  }
  // #endregion
  res.status(400).json({
    error: 'OB Points can only be redeemed at checkout.',
    code: 'REDEEM_CHECKOUT_ONLY',
  });
});

export default router;
