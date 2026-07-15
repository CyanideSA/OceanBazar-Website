import { Router, Request, Response } from 'express';
import { requireRole } from '../../middleware/auth';
import { aiGenerationLimiter } from '../../middleware/rateLimiter';
import { recompute as mlRecompute, isMlConfigured } from '../../services/mlClient';
import {
  getChurnList,
  getSegments,
  getClv,
  getCohorts,
  getForecast,
  getAbandonedCarts,
  getRestockSuggestions,
  getInsights,
  getCustomerTimeline,
} from '../../services/intelligenceService';
import {
  listPipelines,
  createPipeline,
  listDeals,
  createDeal,
  updateDeal,
} from '../../services/pipelineService';

const router = Router();

/** GET /api/admin/intelligence/overview */
router.get('/overview', async (_req: Request, res: Response) => {
  const [segments, clv] = await Promise.all([getSegments(), getClv({ limit: 5 })]);
  const totalCustomers = segments.reduce((s, g) => s + g.customers, 0);
  res.json({
    mlConfigured: isMlConfigured(),
    totalScoredCustomers: totalCustomers,
    segments,
    avgPredictedLtv: clv.avgLtv,
    totalPredictedLtv: clv.totalPredictedLtv,
  });
});

router.get('/churn', async (req: Request, res: Response) => {
  res.json({
    customers: await getChurnList({
      limit: req.query.limit ? parseInt(String(req.query.limit)) : 50,
      minScore: req.query.minScore ? Number(req.query.minScore) : undefined,
    }),
  });
});

router.get('/segments', async (_req: Request, res: Response) => {
  res.json({ segments: await getSegments() });
});

router.get('/clv', async (req: Request, res: Response) => {
  res.json(await getClv({ limit: req.query.limit ? parseInt(String(req.query.limit)) : 20 }));
});

router.get('/cohorts', async (_req: Request, res: Response) => {
  res.json({ cohorts: await getCohorts() });
});

router.get('/forecast', async (req: Request, res: Response) => {
  res.json(await getForecast(req.query.days ? parseInt(String(req.query.days)) : 30));
});

router.get('/abandoned-carts', async (_req: Request, res: Response) => {
  res.json({ carts: await getAbandonedCarts(50) });
});

router.get('/restock', async (_req: Request, res: Response) => {
  res.json({ products: await getRestockSuggestions(20) });
});

router.get('/insights', async (_req: Request, res: Response) => {
  res.json(await getInsights());
});

router.get('/customers/:id/timeline', async (req: Request, res: Response) => {
  res.json(await getCustomerTimeline(String(req.params.id)));
});

/** POST /api/admin/intelligence/recompute — trigger ML batch recompute */
router.post('/recompute', aiGenerationLimiter, requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  if (!isMlConfigured()) {
    res.status(409).json({ error: 'ml_not_configured' });
    return;
  }
  try {
    const result = await mlRecompute({
      churn: req.body?.churn !== false,
      demand: req.body?.demand !== false,
      window_days: req.body?.windowDays ?? 30,
    });
    res.json(result);
  } catch (err: any) {
    res.status(502).json({ error: 'recompute_failed', detail: err?.message });
  }
});

// ─── Sales pipeline CRM ──────────────────────────────────────────────────────

router.get('/pipelines', async (_req: Request, res: Response) => {
  res.json({ pipelines: await listPipelines() });
});

router.post('/pipelines', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const { name, description, stages } = req.body || {};
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  res.status(201).json({ pipeline: await createPipeline({ name, description, stages }) });
});

router.get('/deals', async (req: Request, res: Response) => {
  res.json(await listDeals({
    pipelineId: (req.query.pipelineId as string) || undefined,
    status: (req.query.status as string) || undefined,
  }));
});

router.post('/deals', requireRole('super_admin', 'admin', 'staff'), async (req: Request, res: Response) => {
  const body = req.body || {};
  if (!body.title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }
  try {
    res.status(201).json({ deal: await createDeal({ ...body, ownerAdminId: req.admin?.adminId }) });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'create_failed' });
  }
});

router.patch('/deals/:id', requireRole('super_admin', 'admin', 'staff'), async (req: Request, res: Response) => {
  try {
    res.json({ deal: await updateDeal(String(req.params.id), req.body || {}) });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'update_failed' });
  }
});

export default router;
