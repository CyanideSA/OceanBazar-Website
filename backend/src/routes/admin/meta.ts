import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { generateEntityId } from '../../utils/hexId';
import { routeParam } from '../../utils/params';
import { isMetaConfigured, publishMetaPost, syncProductToCatalog, createAdCampaignScaffold } from '../../services/meta/metaClient';
import metaOAuthRouter from './meta-oauth';

const router = Router();
const prisma = new PrismaClient();
const prismaAny = prisma as any;

router.use(metaOAuthRouter);

router.get('/status', async (_req: Request, res: Response) => {
  const account = await prismaAny.meta_accounts.findFirst({ orderBy: { updated_at: 'desc' } });
  res.json({
    configured: isMetaConfigured(),
    account: account ? { ...account, page_access_token: account.page_access_token ? '***' : null } : null,
  });
});

router.post('/connect', async (req: Request, res: Response) => {
  const { pageId, igId, pageAccessToken, adAccountId, catalogId, verifyToken, wabaId, waPhoneNumberId } = req.body;
  if (!pageId || !pageAccessToken) {
    res.status(400).json({ error: 'pageId and pageAccessToken required' });
    return;
  }
  const existing = await prismaAny.meta_accounts.findFirst({ where: { page_id: pageId } });
  const data = {
    page_id: pageId,
    ig_id: igId || null,
    waba_id: wabaId || null,
    wa_phone_number_id: waPhoneNumberId || null,
    page_access_token: pageAccessToken,
    ad_account_id: adAccountId || null,
    catalog_id: catalogId || null,
    verify_token: verifyToken || process.env.META_VERIFY_TOKEN || null,
    status: 'connected',
    connected_by: String((req as any).admin?.adminId || 'admin'),
    updated_at: new Date(),
  };
  const account = existing
    ? await prismaAny.meta_accounts.update({ where: { id: existing.id }, data })
    : await prismaAny.meta_accounts.create({ data: { id: uuidv4(), ...data } });
  res.json({ account: { ...account, page_access_token: '***' } });
});

router.post('/catalog/sync', async (_req: Request, res: Response) => {
  const account = await prismaAny.meta_accounts.findFirst({ where: { status: 'connected' } });
  const catalogId = account?.catalog_id || process.env.META_CATALOG_ID;
  if (!catalogId) { res.status(400).json({ error: 'No catalog configured' }); return; }

  const products = await prisma.product.findMany({
    where: { status: 'active', stock: { gt: 0 } },
    take: 50,
    include: { pricing: { where: { customerType: 'retail' }, take: 1 }, productAssets: { where: { isPrimary: true }, take: 1 } },
  });

  let synced = 0;
  const errors: string[] = [];
  for (const p of products) {
    const r = await syncProductToCatalog({
      catalogId,
      retailerId: p.id,
      name: p.titleEn,
      price: Number(p.pricing[0]?.price || 0),
      imageUrl: p.productAssets[0]?.url,
      pageToken: account?.page_access_token,
    });
    if (r.ok) synced++;
    else if (r.error) errors.push(`${p.id}: ${r.error}`);
  }
  res.json({ synced, total: products.length, errors: errors.slice(0, 10) });
});

router.get('/posts', async (_req: Request, res: Response) => {
  const posts = await prismaAny.meta_posts.findMany({ orderBy: { created_at: 'desc' }, take: 50 });
  res.json({ posts });
});

router.post('/posts', async (req: Request, res: Response) => {
  const { postType, caption, mediaUrls, scheduledAt } = req.body;
  const post = await prismaAny.meta_posts.create({
    data: {
      id: generateEntityId(),
      post_type: postType || 'image',
      caption: caption || null,
      media_urls: mediaUrls || null,
      scheduled_at: scheduledAt ? new Date(scheduledAt) : null,
      status: scheduledAt ? 'scheduled' : 'draft',
      created_by: String((req as any).admin?.adminId || 'admin'),
    },
  });
  res.status(201).json({ post });
});

router.post('/posts/:id/publish', async (req: Request, res: Response) => {
  const post = await prismaAny.meta_posts.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!post) { res.status(404).json({ error: 'Not found' }); return; }
  const account = await prismaAny.meta_accounts.findFirst({ where: { status: 'connected' } });
  const pageId = account?.page_id || process.env.META_PAGE_ID;
  if (!pageId) { res.status(400).json({ error: 'No page connected' }); return; }

  const media = Array.isArray(post.media_urls) ? post.media_urls[0] : null;
  const result = await publishMetaPost({
    postType: post.post_type || 'image',
    pageId,
    igId: account?.ig_id || process.env.META_IG_ID,
    caption: post.caption,
    mediaUrl: typeof media === 'string' ? media : undefined,
    scheduledAt: post.scheduled_at ? new Date(post.scheduled_at) : undefined,
    pageToken: account?.page_access_token,
  });

  await prismaAny.meta_posts.update({
    where: { id: post.id },
    data: {
      status: result.ok ? 'published' : 'failed',
      external_post_id: result.postId || null,
      error: result.error || null,
      updated_at: new Date(),
    },
  });
  res.json(result);
});

router.get('/campaigns', async (_req: Request, res: Response) => {
  const campaigns = await prismaAny.meta_ad_campaigns.findMany({ orderBy: { created_at: 'desc' }, take: 50 });
  res.json({ campaigns });
});

router.post('/campaigns', async (req: Request, res: Response) => {
  const { name, objective, budget } = req.body;
  const account = await prismaAny.meta_accounts.findFirst({ where: { status: 'connected' } });
  const adAccountId = account?.ad_account_id || process.env.META_AD_ACCOUNT_ID;

  let externalId: string | null = null;
  let status = 'draft';
  if (adAccountId && name && objective) {
    const r = await createAdCampaignScaffold({
      adAccountId,
      name,
      objective,
      budget: budget != null ? Number(budget) : undefined,
      pageId: account?.page_id || process.env.META_PAGE_ID,
      pageToken: account?.page_access_token,
    });
    if (r.ok) { externalId = r.campaignId || null; status = 'created'; }
  }

  const campaign = await prismaAny.meta_ad_campaigns.create({
    data: {
      id: generateEntityId(),
      account_id: account?.id || null,
      name: name || 'Untitled',
      objective: objective || 'OUTCOME_TRAFFIC',
      budget: budget != null ? Number(budget) : null,
      status,
      external_campaign_id: externalId,
      created_by: String((req as any).admin?.adminId || 'admin'),
    },
  });
  res.status(201).json({ campaign });
});

export default router;
