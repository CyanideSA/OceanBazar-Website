import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { exchangeMetaLongLivedToken } from './metaClient';

const prisma = new PrismaClient();
const prismaAny = prisma as any;
const GRAPH = 'https://graph.facebook.com/v19.0';

export async function exchangeAndStoreMetaAccount(
  code: string,
  connectedBy = 'oauth',
): Promise<{ ok: true; pageId: string; igId: string | null } | { ok: false; error: string }> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_OAUTH_REDIRECT_URI;
  if (!code || !appId || !appSecret || !redirectUri) {
    return { ok: false, error: 'missing_params' };
  }

  try {
    const { data: tokenData } = await axios.get(`${GRAPH}/oauth/access_token`, {
      params: {
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      },
      timeout: 15_000,
    });

    const shortToken = tokenData.access_token as string;
    const longLived = await exchangeMetaLongLivedToken(shortToken);
    const userToken = longLived.ok ? longLived.token! : shortToken;

    const { data: pages } = await axios.get(`${GRAPH}/me/accounts`, {
      params: { access_token: userToken },
      timeout: 15_000,
    });

    const page = pages.data?.[0];
    if (!page) return { ok: false, error: 'no_pages_found' };

    let igId: string | null = null;
    try {
      const { data: ig } = await axios.get(`${GRAPH}/${page.id}`, {
        params: { fields: 'instagram_business_account', access_token: page.access_token || userToken },
        timeout: 15_000,
      });
      igId = ig.instagram_business_account?.id || null;
    } catch { /* optional */ }

    const existing = await prismaAny.meta_accounts.findFirst({ where: { page_id: page.id } });
    const data = {
      page_id: page.id,
      ig_id: igId,
      page_access_token: page.access_token || userToken,
      status: 'connected',
      connected_by: connectedBy,
      updated_at: new Date(),
    };
    if (existing) {
      await prismaAny.meta_accounts.update({ where: { id: existing.id }, data });
    } else {
      await prismaAny.meta_accounts.create({ data: { id: uuidv4(), ...data } });
    }

    return { ok: true, pageId: page.id, igId };
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: unknown }; message?: string })?.response?.data || (err as Error)?.message;
    return { ok: false, error: String(msg) };
  }
}
