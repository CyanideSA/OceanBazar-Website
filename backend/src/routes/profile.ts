import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { routeParam } from '../utils/params';

const router = Router();
const prisma = new PrismaClient();

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
  const { label, line1, line2, city, district, postalCode, isDefault = false } = req.body as {
    label: string; line1: string; line2?: string; city: string; district: string; postalCode?: string; isDefault?: boolean;
  };

  if (isDefault) {
    await prisma.savedAddress.updateMany({
      where: { userId: req.user!.userId },
      data: { isDefault: false },
    });
  }

  const address = await prisma.savedAddress.create({
    data: { userId: req.user!.userId, label, line1, line2, city, district, postalCode, isDefault },
  });
  res.status(201).json({ address });
});

// PUT /api/profile/addresses/:id
router.put('/addresses/:id', async (req: Request, res: Response) => {
  const id = parseInt(routeParam(req.params.id), 10);
  const { label, line1, line2, city, district, postalCode, isDefault = false } = req.body as {
    label: string;
    line1: string;
    line2?: string;
    city: string;
    district: string;
    postalCode?: string;
    isDefault?: boolean;
  };

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
    data: { label, line1, line2, city, district, postalCode, isDefault },
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

export default router;
