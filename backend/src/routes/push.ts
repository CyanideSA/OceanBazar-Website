import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

import { requireAuth, requireAdmin } from '../middleware/auth';
import { requireAdminReauth } from '../middleware/adminReauth';

import { generateEntityId } from '../utils/hexId';
import { isVapidConfigured, broadcast } from '../services/pushNotificationService';

const router = Router();

/** GET /api/push/vapid-key — public key for frontend subscription */
router.get('/vapid-key', (_req, res) => {
  res.json({
    publicKey: process.env.VAPID_PUBLIC_KEY || null,
    configured: isVapidConfigured(),
  });
});

/** POST /api/push/subscribe — save/update a push subscription */
router.post('/subscribe', requireAuth, async (req: Request, res: Response) => {
  const { endpoint, keys } = req.body as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: 'endpoint, keys.p256dh and keys.auth are required' });
    return;
  }

  await prisma.push_subscriptions.upsert({
    where: { endpoint },
    create: {
      id: generateEntityId(),
      userId: req.user!.userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    update: {
      userId: req.user!.userId,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
  });

  res.json({ ok: true, message: 'Subscribed to push notifications' });
});

/** DELETE /api/push/subscribe — unsubscribe */
router.delete('/subscribe', requireAuth, async (req: Request, res: Response) => {
  const { endpoint } = req.body as { endpoint: string };
  if (endpoint) {
    await prisma.push_subscriptions.deleteMany({
      where: { endpoint, userId: req.user!.userId },
    });
  }
  res.json({ ok: true });
});

/** POST /api/push/broadcast — admin: send to all users */
router.post('/broadcast', requireAdmin, requireAdminReauth(), async (req: Request, res: Response) => {
  const { title, body, url } = req.body as { title: string; body: string; url?: string };
  if (!title || !body) {
    res.status(400).json({ error: 'title and body required' });
    return;
  }
  const result = await broadcast({ title, body, url: url ?? '/', tag: 'admin-broadcast' });
  res.json({ ok: true, ...result });
});

export default router;
