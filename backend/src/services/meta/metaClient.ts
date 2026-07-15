import axios from 'axios';
import crypto from 'crypto';

const GRAPH = 'https://graph.facebook.com/v19.0';

export function isMetaConfigured(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_PAGE_ACCESS_TOKEN);
}

export function metaAppSecret(): string {
  return process.env.META_APP_SECRET || '';
}

export function verifyWebhookSignature(rawBody: Buffer | string, signatureHeader?: string): boolean {
  const secret = metaAppSecret();
  if (!secret || !signatureHeader?.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = signatureHeader.slice(7);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

export async function sendMessengerText(recipientId: string, text: string, pageToken?: string): Promise<boolean> {
  const token = pageToken || process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) return false;
  try {
    await axios.post(
      `${GRAPH}/me/messages`,
      { recipient: { id: recipientId }, message: { text: text.slice(0, 2000) }, messaging_type: 'RESPONSE' },
      { params: { access_token: token }, timeout: 15_000 },
    );
    return true;
  } catch (err: any) {
    console.error('[meta] send message failed:', err?.response?.data || err?.message);
    return false;
  }
}

export async function publishPagePost(opts: {
  pageId: string;
  caption?: string;
  mediaUrl?: string;
  pageToken?: string;
}): Promise<{ ok: boolean; postId?: string; error?: string }> {
  const token = opts.pageToken || process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) return { ok: false, error: 'not_configured' };
  try {
    const body: Record<string, unknown> = {};
    if (opts.mediaUrl) {
      body.url = opts.mediaUrl;
      body.caption = opts.caption || '';
      const { data } = await axios.post(`${GRAPH}/${opts.pageId}/photos`, body, { params: { access_token: token } });
      return { ok: true, postId: data.id || data.post_id };
    }
    body.message = opts.caption || '';
    const { data } = await axios.post(`${GRAPH}/${opts.pageId}/feed`, body, { params: { access_token: token } });
    return { ok: true, postId: data.id };
  } catch (err: any) {
    return { ok: false, error: err?.response?.data?.error?.message || err?.message };
  }
}

export async function syncProductToCatalog(opts: {
  catalogId: string;
  retailerId: string;
  name: string;
  price: number;
  imageUrl?: string;
  pageToken?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const token = opts.pageToken || process.env.META_PAGE_ACCESS_TOKEN;
  if (!token || !opts.catalogId) return { ok: false, error: 'not_configured' };
  try {
    await axios.post(
      `${GRAPH}/${opts.catalogId}/products`,
      {
        retailer_id: opts.retailerId,
        name: opts.name,
        price: Math.round(opts.price * 100),
        currency: 'BDT',
        image_url: opts.imageUrl,
        availability: 'in stock',
      },
      { params: { access_token: token }, timeout: 20_000 },
    );
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.response?.data?.error?.message || err?.message };
  }
}

export async function createAdCampaignScaffold(opts: {
  adAccountId: string;
  name: string;
  objective: string;
  budget?: number;
  pageId?: string;
  pageToken?: string;
}): Promise<{ ok: boolean; campaignId?: string; adSetId?: string; creativeId?: string; error?: string }> {
  const token = opts.pageToken || process.env.META_PAGE_ACCESS_TOKEN;
  const actId = opts.adAccountId?.replace(/^act_/, '');
  if (!token || !actId) return { ok: false, error: 'not_configured' };
  try {
    const { data: campaign } = await axios.post(
      `${GRAPH}/act_${actId}/campaigns`,
      { name: opts.name, objective: opts.objective, status: 'PAUSED', special_ad_categories: [] },
      { params: { access_token: token }, timeout: 20_000 },
    );

    const dailyBudget = opts.budget ? Math.round(opts.budget * 100) : 50000;
    const { data: adSet } = await axios.post(
      `${GRAPH}/act_${actId}/adsets`,
      {
        name: `${opts.name} — Ad Set`,
        campaign_id: campaign.id,
        daily_budget: dailyBudget,
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LINK_CLICKS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        status: 'PAUSED',
        targeting: { geo_locations: { countries: ['BD'] } },
      },
      { params: { access_token: token }, timeout: 20_000 },
    );

    const pageId = opts.pageId || process.env.META_PAGE_ID;
    let creativeId: string | undefined;
    if (pageId) {
      const { data: creative } = await axios.post(
        `${GRAPH}/act_${actId}/adcreatives`,
        {
          name: `${opts.name} — Creative`,
          object_story_spec: {
            page_id: pageId,
            link_data: {
              message: opts.name,
              link: process.env.CLIENT_URL || 'https://oceanbazar.com.bd',
            },
          },
        },
        { params: { access_token: token }, timeout: 20_000 },
      );
      creativeId = creative.id;
    }

    return { ok: true, campaignId: campaign.id, adSetId: adSet.id, creativeId };
  } catch (err: any) {
    return { ok: false, error: err?.response?.data?.error?.message || err?.message };
  }
}

export async function publishMetaPost(opts: {
  postType: string;
  pageId: string;
  igId?: string;
  caption?: string;
  mediaUrl?: string;
  scheduledAt?: Date;
  pageToken?: string;
}): Promise<{ ok: boolean; postId?: string; error?: string }> {
  const token = opts.pageToken || process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) return { ok: false, error: 'not_configured' };

  const postType = (opts.postType || 'image').toLowerCase();
  const scheduledUnix = opts.scheduledAt ? Math.floor(opts.scheduledAt.getTime() / 1000) : undefined;
  const scheduleParams = scheduledUnix
    ? { published: false, scheduled_publish_time: scheduledUnix }
    : {};

  try {
    if (postType === 'reel' || postType === 'story' || (postType === 'image' && opts.igId)) {
      const igId = opts.igId || process.env.META_IG_ID;
      if (!igId) return publishPagePost({ ...opts, pageToken: token });

      const mediaBody: Record<string, unknown> = { caption: opts.caption || '' };
      if (postType === 'reel' || (postType as string) === 'video') {
        mediaBody.media_type = 'REELS';
        mediaBody.video_url = opts.mediaUrl;
      } else if (postType === 'story') {
        mediaBody.media_type = 'STORIES';
        if (opts.mediaUrl?.match(/\.(mp4|mov|webm)/i)) {
          mediaBody.video_url = opts.mediaUrl;
        } else {
          mediaBody.image_url = opts.mediaUrl;
        }
      } else {
        mediaBody.image_url = opts.mediaUrl;
      }

      const { data: container } = await axios.post(
        `${GRAPH}/${igId}/media`,
        mediaBody,
        { params: { access_token: token }, timeout: 30_000 },
      );
      const { data: published } = await axios.post(
        `${GRAPH}/${igId}/media_publish`,
        { creation_id: container.id },
        { params: { access_token: token }, timeout: 30_000 },
      );
      return { ok: true, postId: published.id };
    }

    if (opts.mediaUrl) {
      const body: Record<string, unknown> = { url: opts.mediaUrl, caption: opts.caption || '', ...scheduleParams };
      const { data } = await axios.post(`${GRAPH}/${opts.pageId}/photos`, body, {
        params: { access_token: token },
        timeout: 30_000,
      });
      return { ok: true, postId: data.id || data.post_id };
    }

    const body: Record<string, unknown> = { message: opts.caption || '', ...scheduleParams };
    const { data } = await axios.post(`${GRAPH}/${opts.pageId}/feed`, body, {
      params: { access_token: token },
      timeout: 30_000,
    });
    return { ok: true, postId: data.id };
  } catch (err: any) {
    return { ok: false, error: err?.response?.data?.error?.message || err?.message };
  }
}

export async function exchangeMetaLongLivedToken(shortToken: string): Promise<{ ok: boolean; token?: string; error?: string }> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return { ok: false, error: 'not_configured' };
  try {
    const { data } = await axios.get(`${GRAPH}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortToken,
      },
      timeout: 15_000,
    });
    return { ok: true, token: data.access_token };
  } catch (err: any) {
    return { ok: false, error: err?.response?.data?.error?.message || err?.message };
  }
}
