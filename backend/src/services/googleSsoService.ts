import crypto from 'crypto';
import axios from 'axios';
import { getRedisClient } from '../cache/redisClient';

const SSO_STATE_PREFIX = 'admin:sso:google:state:';
const STATE_TTL_SEC = 600;

export interface GoogleIdTokenClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  hd?: string;
}

function ssoConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_GOOGLE_CLIENT_ID &&
    process.env.ADMIN_GOOGLE_CLIENT_SECRET &&
    process.env.ADMIN_GOOGLE_REDIRECT_URI,
  );
}

export function isGoogleSsoConfigured(): boolean {
  return ssoConfigured();
}

export async function buildGoogleAuthorizeUrl(): Promise<{ url: string } | { error: string }> {
  if (!ssoConfigured()) return { error: 'google_sso_not_configured' };

  const state = crypto.randomBytes(24).toString('hex');
  try {
    const redis = await getRedisClient();
    await redis.setEx(`${SSO_STATE_PREFIX}${state}`, STATE_TTL_SEC, '1');
  } catch {
    return { error: 'redis_unavailable' };
  }

  const params = new URLSearchParams({
    client_id: process.env.ADMIN_GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.ADMIN_GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
    hd: process.env.ADMIN_GOOGLE_HOSTED_DOMAIN || 'oceanbazar.com.bd',
  });

  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
}

export async function exchangeGoogleCode(
  code: string,
  state: string,
): Promise<{ claims: GoogleIdTokenClaims } | { error: string }> {
  if (!ssoConfigured()) return { error: 'google_sso_not_configured' };

  try {
    const redis = await getRedisClient();
    const ok = await redis.get(`${SSO_STATE_PREFIX}${state}`);
    if (!ok) return { error: 'invalid_state' };
    await redis.del(`${SSO_STATE_PREFIX}${state}`);
  } catch {
    return { error: 'redis_unavailable' };
  }

  try {
    const { data: tokenData } = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code,
        client_id: process.env.ADMIN_GOOGLE_CLIENT_ID!,
        client_secret: process.env.ADMIN_GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.ADMIN_GOOGLE_REDIRECT_URI!,
        grant_type: 'authorization_code',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15_000 },
    );

    const { data: userInfo } = await axios.get('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      timeout: 15_000,
    });

    if (!userInfo?.sub) return { error: 'missing_claims' };

    const allowedDomains = (process.env.ADMIN_SSO_ALLOWED_DOMAINS || 'oceanbazar.com.bd,oceanbazar.com')
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    const email = String(userInfo.email || '').toLowerCase();
    if (allowedDomains.length && email) {
      const domain = email.split('@')[1];
      if (!domain || !allowedDomains.some((d) => domain === d || domain.endsWith(`.${d}`))) {
        return { error: 'domain_not_allowed' };
      }
    }

    const hostedDomain = process.env.ADMIN_GOOGLE_HOSTED_DOMAIN;
    if (hostedDomain && userInfo.hd && userInfo.hd !== hostedDomain) {
      return { error: 'domain_not_allowed' };
    }

    return {
      claims: {
        sub: String(userInfo.sub),
        email: email || undefined,
        email_verified: Boolean(userInfo.email_verified),
        name: userInfo.name as string | undefined,
        hd: userInfo.hd as string | undefined,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'token_exchange_failed';
    console.error('[sso] Google token exchange failed:', msg);
    return { error: 'token_exchange_failed' };
  }
}
