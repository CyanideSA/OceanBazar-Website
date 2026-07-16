import { Router, Request, Response } from 'express';
import { exchangeAndStoreMetaAccount } from '../../services/meta/metaOAuthService';
import { getValidatedMetaOAuthRedirectUri } from '../../services/meta/metaOAuthRedirect';

const router = Router();

router.get('/oauth/url', (_req: Request, res: Response) => {
  const appId = process.env.META_APP_ID;
  const redirectUri = getValidatedMetaOAuthRedirectUri();
  if (!appId || !redirectUri) {
    res.status(503).json({ error: 'meta_oauth_not_configured' });
    return;
  }
  const scopes = [
    'pages_show_list',
    'pages_messaging',
    'pages_manage_posts',
    'instagram_basic',
    'instagram_manage_messages',
    'business_management',
    'ads_management',
    'catalog_management',
    'whatsapp_business_management',
    'whatsapp_business_messaging',
  ].join(',');
  const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code`;
  res.json({ url });
});

router.post('/oauth/callback', async (req: Request, res: Response) => {
  const { code } = req.body as { code?: string };
  if (!code) {
    res.status(400).json({ error: 'missing_params' });
    return;
  }
  const result = await exchangeAndStoreMetaAccount(code, String((req as any).admin?.adminId || 'admin'));
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ success: true, pageId: result.pageId, igId: result.igId });
});

export default router;
