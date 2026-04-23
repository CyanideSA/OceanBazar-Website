import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getBalance, getLedger, adminAdjustPoints } from '../../services/obPointsService';
import { getTier, REDEMPTION_TABLE } from '../../utils/obPoints';
import { routeParam } from '../../utils/params';

const router = Router();
const prisma = new PrismaClient();

// PUT /api/admin/ob-points/adjust — must be before /:userId
router.put('/adjust', async (req: Request, res: Response) => {
  const { userId, points, note } = req.body as { userId: string; points: number; note: string };
  if (!userId || !points || !note) { res.status(400).json({ error: 'userId, points, note required' }); return; }
  const newBalance = await adminAdjustPoints(userId, points, note);
  res.json({ message: 'Points adjusted', newBalance });
});

// GET /api/admin/ob-points — all users with balances and tiers
router.get('/', async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = 20;
  const users = await prisma.user.findMany({
    orderBy: { lifetimeSpend: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  const withPoints = await Promise.all(
    users.map(async (u) => {
      const balance = await getBalance(u.id);
      const tier = getTier(Number(u.lifetimeSpend));
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        lifetimeSpend: Number(u.lifetimeSpend),
        tier,
        balance,
        redemptionRates: REDEMPTION_TABLE[tier],
      };
    })
  );

  res.json({ users: withPoints, page, limit });
});

// GET /api/admin/ob-points/:userId — individual user
router.get('/:userId', async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: routeParam(req.params.userId) } });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  const balance = await getBalance(user.id);
  const tier = getTier(Number(user.lifetimeSpend));
  const ledger = await getLedger(user.id);
  res.json({ user, balance, tier, redemptionRates: REDEMPTION_TABLE[tier], ledger });
});

export default router;
