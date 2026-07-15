import { Router, Request, Response } from 'express';
import { requireRole } from '../../middleware/auth';
import { aiGenerationLimiter } from '../../middleware/rateLimiter';
import {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  previewAudience,
  enrollAudience,
  generateCampaignCopy,
  type AudienceSpec,
} from '../../services/marketingService';
import { runCampaignJourney } from '../../jobs/campaignJourney';

const router = Router();

router.get('/campaigns', async (req: Request, res: Response) => {
  res.json({ campaigns: await listCampaigns({ status: (req.query.status as string) || undefined }) });
});

router.get('/campaigns/:id', async (req: Request, res: Response) => {
  const campaign = await getCampaign(String(req.params.id));
  if (!campaign) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ campaign });
});

router.post('/campaigns', requireRole('super_admin', 'admin', 'staff'), async (req: Request, res: Response) => {
  const body = req.body || {};
  if (!body.name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const campaign = await createCampaign({
    name: body.name,
    description: body.description,
    channel: body.channel,
    audience: body.audience,
    triggerType: body.triggerType,
    triggerConfig: body.triggerConfig,
    createdByAdminId: req.admin?.adminId,
    steps: body.steps,
  });
  res.status(201).json({ campaign });
});

router.patch('/campaigns/:id', requireRole('super_admin', 'admin', 'staff'), async (req: Request, res: Response) => {
  try {
    res.json({ campaign: await updateCampaign(String(req.params.id), req.body || {}) });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'update_failed' });
  }
});

router.delete('/campaigns/:id', requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    res.json(await deleteCampaign(String(req.params.id)));
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'delete_failed' });
  }
});

router.post('/audience/preview', aiGenerationLimiter, async (req: Request, res: Response) => {
  res.json(await previewAudience((req.body as AudienceSpec) || {}));
});

router.post('/campaigns/:id/enroll', aiGenerationLimiter, requireRole('super_admin', 'admin', 'staff'), async (req: Request, res: Response) => {
  try {
    const result = await enrollAudience(String(req.params.id));
    // Kick the journey processor so step 0 (delay 0) fires promptly.
    void runCampaignJourney();
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'enroll_failed' });
  }
});

router.post('/generate', aiGenerationLimiter, requireRole('super_admin', 'admin', 'staff'), async (req: Request, res: Response) => {
  const body = req.body || {};
  if (!body.topic) {
    res.status(400).json({ error: 'topic is required' });
    return;
  }
  res.json(
    await generateCampaignCopy({
      kind: body.kind || 'email',
      topic: body.topic,
      audience: body.audience,
      tone: body.tone,
      language: body.language,
      productName: body.productName,
      extraContext: body.extraContext,
    })
  );
});

export default router;
