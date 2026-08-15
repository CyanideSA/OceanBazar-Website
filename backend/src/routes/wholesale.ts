import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

import { requireAuth } from '../middleware/auth';
import { generateEntityId } from '../utils/hexId';

const router = Router();

router.use(requireAuth);

// POST /api/wholesale/apply
router.post('/apply', async (req: Request, res: Response) => {
  try {
    const { businessName, tradeLicense, address, notes } = req.body as {
      businessName?: string;
      tradeLicense?: string;
      address?: string;
      notes?: string;
    };

    if (!String(businessName ?? '').trim() || !String(tradeLicense ?? '').trim() || !String(address ?? '').trim()) {
      res.status(400).json({ error: 'businessName, tradeLicense, and address are required' });
      return;
    }

    const prismaAny = prisma as any;
    const existing = await prismaAny.wholesale_applications.findFirst({
      where: {
        user_id: req.user!.userId,
        status: { in: ['pending', 'approved'] },
      },
      orderBy: { created_at: 'desc' },
    });

    if (existing) {
      res.status(409).json({
        error: existing.status === 'approved'
          ? 'Wholesale access is already approved for this account'
          : 'A wholesale application is already pending review',
        application: existing,
      });
      return;
    }

    const created = await prismaAny.wholesale_applications.create({
      data: {
        id: generateEntityId(),
        user_id: req.user!.userId,
        business_name: String(businessName).trim(),
        tax_id: String(tradeLicense).trim(),
        business_description: [
          notes ? String(notes) : '',
          address ? `Address: ${String(address).trim()}` : '',
        ].filter(Boolean).join('\n') || null,
        status: 'pending',
      },
    });

    try {
      const { emitAdminEvent } = await import('../lib/adminEvents');
      emitAdminEvent('admin:applications:wholesale', {
        id: created.id,
        userId: req.user!.userId,
        businessName: created.business_name,
        status: created.status,
      });
    } catch { /* non-fatal */ }

    res.status(201).json({ application: created, message: 'Wholesale application submitted' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to submit wholesale application' });
  }
});

// GET /api/wholesale/status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const prismaAny = prisma as any;
    const latest = await prismaAny.wholesale_applications.findFirst({
      where: { user_id: req.user!.userId },
      orderBy: { created_at: 'desc' },
    });

    res.json({
      userType: req.user!.userType,
      application: latest ?? null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch wholesale status' });
  }
});

export default router;
