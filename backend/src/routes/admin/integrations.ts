import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

import { fetchGa4Overview, fetchSearchConsoleQueries, isGoogleInsightsConfigured } from '../../services/googleInsightsService';
import { isGoogleMerchantConfigured, syncProductToMerchantCenter } from '../../services/googleMerchantService';
import { listDirectoryUsers, createCalendarEvent, uploadDriveFile } from '../../services/microsoftGraphService';
import { isTeamsWebhookConfigured } from '../../services/teamsService';
import { isMicrosoftSsoConfigured } from '../../services/microsoftSsoService';
import { isGoogleSsoConfigured } from '../../services/googleSsoService';
import { isMetaConfigured } from '../../services/meta/metaClient';
import { isWhatsAppConfigured } from '../../services/meta/whatsappClient';
import { isConfigured as isGraphMailConfigured } from '../../services/microsoftGraphService';
import { isRecaptchaConfigured } from '../../services/recaptchaService';

const router = Router();

router.get('/status', (_req: Request, res: Response) => {
  res.json({
    microsoftSso: isMicrosoftSsoConfigured(),
    googleSso: isGoogleSsoConfigured(),
    graphMail: isGraphMailConfigured(),
    meta: isMetaConfigured(),
    whatsapp: isWhatsAppConfigured(),
    googleInsights: isGoogleInsightsConfigured(),
    googleMerchant: isGoogleMerchantConfigured(),
    recaptcha: isRecaptchaConfigured(),
    teamsWebhook: isTeamsWebhookConfigured(),
    whatsappTemplates: {
      order: process.env.WHATSAPP_TEMPLATE_ORDER || null,
      shipping: process.env.WHATSAPP_TEMPLATE_SHIPPING || null,
    },
  });
});

router.get('/google/analytics', async (req: Request, res: Response) => {
  const days = Number(req.query.days) || 7;
  const overview = await fetchGa4Overview(days);
  const queries = await fetchSearchConsoleQueries(days);
  res.json({ configured: isGoogleInsightsConfigured(), overview, searchQueries: queries });
});

router.post('/google/merchant/sync', async (_req: Request, res: Response) => {
  if (!isGoogleMerchantConfigured()) {
    res.status(503).json({ error: 'google_merchant_not_configured' });
    return;
  }

  const products = await prisma.product.findMany({
    where: { status: 'active', stock: { gt: 0 } },
    take: 50,
    include: { pricing: { where: { customerType: 'retail' }, take: 1 }, productAssets: { where: { isPrimary: true }, take: 1 } },
  });

  const clientUrl = process.env.CLIENT_URL || 'https://oceanbazar.com.bd';
  let synced = 0;
  const errors: string[] = [];

  for (const p of products) {
    const r = await syncProductToMerchantCenter({
      id: p.id,
      title: p.titleEn,
      description: p.descriptionEn || p.titleEn,
      link: `${clientUrl}/products/${p.id}`,
      imageLink: p.productAssets[0]?.url,
      price: Number(p.pricing[0]?.price || 0),
      availability: p.stock > 0 ? 'in stock' : 'out of stock',
      brand: p.brand || 'OceanBazar',
    });
    if (r.ok) synced++;
    else if (r.error) errors.push(`${p.id}: ${r.error}`);
  }

  res.json({ synced, total: products.length, errors: errors.slice(0, 10) });
});

router.get('/microsoft/directory', async (_req: Request, res: Response) => {
  const users = await listDirectoryUsers(100);
  res.json({ users });
});

router.post('/microsoft/calendar/events', async (req: Request, res: Response) => {
  const { subject, body, start, end, attendees, mailbox } = req.body;
  if (!subject || !start || !end) {
    res.status(400).json({ error: 'subject, start, end required' });
    return;
  }
  const result = await createCalendarEvent({ mailbox, subject, body, start, end, attendees });
  res.json(result);
});

router.post('/microsoft/drive/upload', async (req: Request, res: Response) => {
  const { fileName, contentBase64, folderPath, mailbox } = req.body as {
    fileName?: string;
    contentBase64?: string;
    folderPath?: string;
    mailbox?: string;
  };
  if (!fileName || !contentBase64) {
    res.status(400).json({ error: 'fileName and contentBase64 required' });
    return;
  }
  const result = await uploadDriveFile({
    mailbox,
    fileName,
    content: Buffer.from(contentBase64, 'base64'),
    folderPath,
  });
  res.json(result);
});

export default router;
