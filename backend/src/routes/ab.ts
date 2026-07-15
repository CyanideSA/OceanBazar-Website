/**
 * A/B Test impression + conversion tracking
 * POST /api/ab/impression — record a test exposure (view)
 * POST /api/ab/conversion — record a conversion for a test variant
 * GET  /api/ab/stats      — admin: get A/B test results
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../middleware/auth';

import { v4 as uuidv4 } from 'uuid';

const router = Router();
const prisma = new PrismaClient();

/** POST /api/ab/impression — record a test view (dedup happens client-side via sessionStorage) */
router.post('/impression', async (req: Request, res: Response) => {
  const { testId, variant, sessionId } = req.body as { testId: string; variant: string; sessionId?: string };
  if (!testId || !variant) { res.status(400).json({ error: 'testId and variant required' }); return; }

  try {
    await prisma.ab_impressions.create({
      data: {
        id: uuidv4(),
        testId: String(testId).slice(0, 100),
        variant: String(variant).slice(0, 1).toUpperCase(),
        userId: req.user?.userId ?? null,
        sessionId: (sessionId as string) ?? req.headers['x-session-id'] as string ?? null,
        converted: false,
      },
    });
  } catch { /* non-fatal */ }

  res.json({ ok: true });
});

/** POST /api/ab/conversion — record a conversion event */
router.post('/conversion', async (req: Request, res: Response) => {
  const { testId, variant } = req.body as { testId: string; variant: string };
  if (!testId || !variant) { res.status(400).json({ error: 'testId and variant required' }); return; }

  try {
    await prisma.ab_impressions.create({
      data: {
        id: uuidv4(),
        testId: String(testId).slice(0, 100),
        variant: String(variant).slice(0, 1).toUpperCase(),
        userId: req.user?.userId ?? null,
        sessionId: req.headers['x-session-id'] as string ?? null,
        converted: true,
      },
    });
  } catch { /* non-fatal */ }

  res.json({ ok: true });
});

/** GET /api/ab/stats — admin summary grouped by testId + variant */
router.get('/stats', requireAdmin, async (_req, res: Response) => {
  const rows = await prisma.ab_impressions.findMany({
    select: { testId: true, variant: true, converted: true },
  });

  const grouped: Record<string, { A: any; B: any }> = {};
  for (const r of rows) {
    if (!grouped[r.testId]) grouped[r.testId] = { A: null, B: null };
    const slot = (r.variant as 'A' | 'B');
    const prev = grouped[r.testId][slot] ?? { impressions: 0, conversions: 0, rate: '0%' };
    const impressions = prev.impressions + 1;
    const conversions = prev.conversions + (r.converted ? 1 : 0);
    grouped[r.testId][slot] = {
      impressions,
      conversions,
      rate: impressions > 0 ? ((conversions / impressions) * 100).toFixed(1) + '%' : '0%',
    };
  }

  res.json({ tests: grouped });
});

export default router;
