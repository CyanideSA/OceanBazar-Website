import { Router, type Request, type Response } from 'express';
import { apiLimiter } from '../middleware/rateLimiter';
import { appLog } from '../lib/appLog';

const router = Router();

/** POST /api/analytics/pwa — beacon-friendly PWA / install / push funnel (no auth). */
router.post('/pwa', apiLimiter, (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  appLog('info', 'pwa_client_event', {
    requestId: req.requestId,
    event: body?.event,
    payload: body,
  });
  res.status(204).end();
});

export default router;
