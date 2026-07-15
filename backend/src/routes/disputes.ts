import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { generateEntityId } from '../utils/hexId';
import { routeParam } from '../utils/params';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAuth);

// GET /api/disputes
router.get('/', async (req: Request, res: Response) => {
  try {
    const prismaAny = prisma as any;
    const disputes = await prismaAny.disputes.findMany({
      where: { user_id: req.user!.userId },
      orderBy: { created_at: 'desc' },
    });
    res.json({ disputes });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load disputes' });
  }
});

// GET /api/disputes/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const prismaAny = prisma as any;
    const dispute = await prismaAny.disputes.findFirst({
      where: { id: routeParam(req.params.id), user_id: req.user!.userId },
    });
    if (!dispute) {
      res.status(404).json({ error: 'Dispute not found' });
      return;
    }
    res.json({ dispute });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load dispute' });
  }
});

// POST /api/disputes
router.post('/', async (req: Request, res: Response) => {
  try {
    const { orderId, title, reason, description, priority } = req.body as {
      orderId?: string;
      title?: string;
      reason?: string;
      description?: string;
      priority?: 'low' | 'medium' | 'high';
    };

    const normalizedTitle = String(title ?? reason ?? '').trim();
    if (!normalizedTitle) {
      res.status(400).json({ error: 'title or reason is required' });
      return;
    }

    const prismaAny = prisma as any;
    if (orderId) {
      const order = await prisma.order.findFirst({
        where: { id: String(orderId), userId: req.user!.userId },
        select: { id: true },
      });
      if (!order) {
        res.status(400).json({ error: 'Invalid orderId for this user' });
        return;
      }
    }

    const dispute = await prismaAny.disputes.create({
      data: {
        id: generateEntityId(),
        order_id: orderId ? String(orderId) : 'general',
        user_id: req.user!.userId,
        title: normalizedTitle,
        description: description ? String(description) : null,
        status: 'open',
        priority: priority ?? 'medium',
      },
    });

    res.status(201).json({ dispute });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to create dispute' });
  }
});

export default router;
