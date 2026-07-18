import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

import { requireAuth } from '../middleware/auth';
import { routeParam } from '../utils/params';

const router = Router();

router.use(requireAuth);

// GET /api/profile
router.get('/', async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    include: { savedAddresses: true },
  });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({ user });
});

// PUT /api/profile
router.put('/', async (req: Request, res: Response) => {
  const { name, preferredLang, profileImage } = req.body as {
    name?: string;
    preferredLang?: 'en' | 'bn';
    profileImage?: string | null;
  };

  const data: { name?: string; preferredLang?: 'en' | 'bn'; profileImage?: string | null } = {};
  if (name !== undefined && String(name).trim()) data.name = String(name).trim();
  if (preferredLang === 'en' || preferredLang === 'bn') data.preferredLang = preferredLang;

  if (profileImage !== undefined) {
    if (profileImage === null || profileImage === '') {
      data.profileImage = null;
    } else if (typeof profileImage === 'string') {
      const trimmed = profileImage.trim();
      if (trimmed.length > 2048) {
        res.status(400).json({ error: 'profileImage URL too long' });
        return;
      }
      if (!/^https?:\/\//i.test(trimmed)) {
        res.status(400).json({ error: 'profileImage must be an http(s) URL' });
        return;
      }
      data.profileImage = trimmed;
    }
  }

  if (Object.keys(data).length === 0) {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user });
    return;
  }

  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data,
  });
  res.json({ user });
});

// GET /api/profile/addresses
router.get('/addresses', async (req: Request, res: Response) => {
  const addresses = await prisma.savedAddress.findMany({ where: { userId: req.user!.userId } });
  res.json({ addresses });
});

// POST /api/profile/addresses
router.post('/addresses', async (req: Request, res: Response) => {
  const { label, line1, line2, city, district, area, postalCode, isDefault = false } = req.body as {
    label?: string;
    line1?: string;
    line2?: string;
    city?: string;
    district?: string;
    area?: string;
    postalCode?: string;
    isDefault?: boolean;
  };
  const resolvedDistrict = String(district ?? area ?? '').trim();
  if (!String(label ?? '').trim() || !String(line1 ?? '').trim() || !String(city ?? '').trim() || !resolvedDistrict) {
    res.status(400).json({ error: 'label, line1, city, and district (or area) are required' });
    return;
  }

  if (isDefault) {
    await prisma.savedAddress.updateMany({
      where: { userId: req.user!.userId },
      data: { isDefault: false },
    });
  }

  const address = await prisma.savedAddress.create({
    data: {
      userId: req.user!.userId,
      label: String(label).trim(),
      line1: String(line1).trim(),
      line2,
      city: String(city).trim(),
      district: resolvedDistrict,
      postalCode,
      isDefault,
    },
  });
  res.status(201).json({ address });
});

// PUT /api/profile/addresses/:id
router.put('/addresses/:id', async (req: Request, res: Response) => {
  const id = parseInt(routeParam(req.params.id), 10);
  const { label, line1, line2, city, district, area, postalCode, isDefault = false } = req.body as {
    label?: string;
    line1?: string;
    line2?: string;
    city?: string;
    district?: string;
    area?: string;
    postalCode?: string;
    isDefault?: boolean;
  };
  const resolvedDistrict = String(district ?? area ?? '').trim();
  if (!String(label ?? '').trim() || !String(line1 ?? '').trim() || !String(city ?? '').trim() || !resolvedDistrict) {
    res.status(400).json({ error: 'label, line1, city, and district (or area) are required' });
    return;
  }

  const existing = await prisma.savedAddress.findFirst({
    where: { id, userId: req.user!.userId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Address not found' });
    return;
  }

  if (isDefault) {
    await prisma.savedAddress.updateMany({
      where: { userId: req.user!.userId },
      data: { isDefault: false },
    });
  }

  const address = await prisma.savedAddress.update({
    where: { id },
    data: {
      label: String(label).trim(),
      line1: String(line1).trim(),
      line2,
      city: String(city).trim(),
      district: resolvedDistrict,
      postalCode,
      isDefault,
    },
  });
  res.json({ address });
});

// DELETE /api/profile/addresses/:id
router.delete('/addresses/:id', async (req: Request, res: Response) => {
  await prisma.savedAddress.deleteMany({
    where: { id: parseInt(routeParam(req.params.id), 10), userId: req.user!.userId },
  });
  res.json({ message: 'Address deleted' });
});

// GET /api/profile/gdpr-export — machine-readable export (authenticated user only)
router.get('/gdpr-export', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const [user, addresses, orders, paymentTxs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        preferredLang: true,
        accountStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.savedAddress.findMany({ where: { userId } }),
    prisma.order.findMany({
      where: { userId },
      take: 200,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        total: true,
        createdAt: true,
      },
    }),
    prisma.paymentTransaction.findMany({
      where: { userId },
      take: 200,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderId: true,
        method: true,
        status: true,
        amount: true,
        createdAt: true,
      },
    }),
  ]);

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="oceanbazar-export-${userId}.json"`);
  res.json({
    exportedAt: new Date().toISOString(),
    profile: user,
    addresses,
    orders,
    paymentTransactions: paymentTxs,
  });
});

// POST /api/profile/gdpr-delete — anonymize PII in place; orders retained for legal/audit
router.post('/gdpr-delete', async (req: Request, res: Response) => {
  const { confirm } = req.body as { confirm?: boolean };
  if (confirm !== true) {
    res.status(400).json({ error: 'Set confirm: true to delete your account data' });
    return;
  }
  const userId = req.user!.userId;

  try {
    await prisma.$executeRaw`DELETE FROM user_wishlists WHERE user_id = ${userId}`;
  } catch {
    /* optional legacy table */
  }

  await prisma.$transaction(async (txn) => {
    await txn.savedAddress.deleteMany({ where: { userId } });
    await txn.socialAccount.deleteMany({ where: { userId } });
    await txn.cart.deleteMany({ where: { userId } });
    await txn.user.update({
      where: { id: userId },
      data: {
        name: 'Deleted user',
        email: `deleted-${userId}@gdpr.invalid`,
        phone: null,
        passwordHash: null,
        profileImage: null,
        accountStatus: 'suspended',
      },
    });
  });

  res.json({ ok: true, message: 'Account anonymized. You have been signed out on other devices.' });
});

export default router;
