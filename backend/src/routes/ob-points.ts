import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getBalance, getUserTierInfo, redeemPoints, getLedger } from '../services/obPointsService';
import { REDEMPTION_TABLE, TIER_THRESHOLDS, POINTS_EXPIRY_DAYS } from '../utils/obPoints';

const router = Router();

router.use(requireAuth);

// GET /api/ob-points/tiers — public tier definitions
router.get('/tiers', async (_req, res: Response) => {
  res.json({
    tiers: [
      { name: 'Bronze', minSpend: TIER_THRESHOLDS.Bronze, maxSpend: TIER_THRESHOLDS.Silver - 1 },
      { name: 'Silver', minSpend: TIER_THRESHOLDS.Silver, maxSpend: TIER_THRESHOLDS.Gold - 1 },
      { name: 'Gold',   minSpend: TIER_THRESHOLDS.Gold,   maxSpend: null },
    ],
    redemptionRates: REDEMPTION_TABLE,
    expiryDays: POINTS_EXPIRY_DAYS,
  });
});

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

// POST /api/ob-points/redeem
router.post('/redeem', async (req: Request, res: Response) => {
  const { points } = req.body as { points: number };
  if (!points) { res.status(400).json({ error: 'points required' }); return; }
  try {
    const result = await redeemPoints(req.user!.userId, Number(points));
    res.json(result);
  } catch (e: unknown) {
    const err = e as Error & { status?: number };
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
