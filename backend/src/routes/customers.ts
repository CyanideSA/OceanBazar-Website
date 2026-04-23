import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { getUserTierInfo } from '../services/obPointsService';
import { ensureCustomerForUser } from '../services/customerService';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAuth);

// GET /api/customers/me — user + customer profile + OB tier snapshot
router.get('/me', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  await ensureCustomerForUser(userId);
  const [user, customer, ob] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        userType: true,
        accountStatus: true,
        preferredLang: true,
        profileImage: true,
        lifetimeSpend: true,
        createdAt: true,
      },
    }),
    prisma.customer.findUnique({ where: { userId } }),
    getUserTierInfo(userId),
  ]);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({
    user: {
      ...user,
      lifetimeSpend: Number(user.lifetimeSpend),
    },
    customer,
    tier: ob.tier,
    obPointsBalance: ob.balance,
    lifetimeSpend: ob.lifetimeSpend,
    redemptionOptions: ob.options,
  });
});

// PUT /api/customers/me — B2B / segment fields on Customer
router.put('/me', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { companyName, taxId, segment } = req.body as {
    companyName?: string | null;
    taxId?: string | null;
    segment?: string | null;
  };

  await ensureCustomerForUser(userId);

  const data: {
    companyName?: string | null;
    taxId?: string | null;
    segment?: string | null;
  } = {};
  if (companyName !== undefined) data.companyName = companyName === '' ? null : String(companyName).slice(0, 255);
  if (taxId !== undefined) data.taxId = taxId === '' ? null : String(taxId).slice(0, 100);
  if (segment !== undefined) data.segment = segment === '' ? null : String(segment).slice(0, 64);

  const customer = await prisma.customer.update({
    where: { userId },
    data,
  });
  res.json({ customer });
});

export default router;
