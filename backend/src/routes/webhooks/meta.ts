import { Router, Request, Response } from 'express';
import { verifyWebhookSignature } from '../../services/meta/metaClient';
import { handleMetaMessagingEvent, handleWhatsAppMessagingEvent, logWebhookEvent } from '../../services/meta/metaService';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const verifyToken = process.env.META_VERIFY_TOKEN || 'oceanbazar_meta_verify';
  if (mode === 'subscribe' && token === verifyToken) {
    res.status(200).send(challenge);
    return;
  }
  res.sendStatus(403);
});

router.post('/', async (req: Request, res: Response) => {
  const raw = (req as any).rawBody as Buffer | undefined;
  const sig = req.headers['x-hub-signature-256'] as string | undefined;
  if (process.env.META_APP_SECRET && raw && !verifyWebhookSignature(raw, sig)) {
    res.sendStatus(403);
    return;
  }

  const body = req.body;
  res.sendStatus(200);

  try {
    if (body?.object === 'page' || body?.object === 'instagram') {
      for (const entry of body.entry || []) {
        await logWebhookEvent(body.object, entry);
        await handleMetaMessagingEvent(entry, body.object);
      }
    }
    if (body?.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        await logWebhookEvent('whatsapp', entry);
        await handleWhatsAppMessagingEvent(entry);
      }
    }
  } catch (err) {
    console.error('[meta/webhook]', err);
  }
});

export default router;
