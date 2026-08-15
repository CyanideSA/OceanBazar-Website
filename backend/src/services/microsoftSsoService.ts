import crypto from 'crypto';
import { ConfidentialClientApplication, type AuthorizationCodeRequest } from '@azure/msal-node';
import { getRedisClient } from '../cache/redisClient';

const SSO_STATE_PREFIX = 'admin:sso:state:';
const SSO_HANDOFF_PREFIX = 'admin:sso:handoff:';
const CONTENT_ID_HANDOFF_PREFIX = 'content-id:sso:handoff:';
const STATE_TTL_SEC = 600;
const HANDOFF_TTL_SEC = 60;

export interface MicrosoftIdTokenClaims {
  oid: string;
  tid: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  upn?: string;
}

function resolveRedirectUri(override?: string): string | undefined {
  return override?.trim() || process.env.MS_SSO_REDIRECT_URI?.trim() || undefined;
}

function ssoConfigured(redirectUriOverride?: string): boolean {
  const redirectUri = resolveRedirectUri(redirectUriOverride);
  return Boolean(
    process.env.MS_SSO_CLIENT_ID &&
    process.env.MS_SSO_CLIENT_SECRET &&
    process.env.MS_TENANT_ID &&
    redirectUri,
  );
}

function getMsalClient(): ConfidentialClientApplication {
  return new ConfidentialClientApplication({
    auth: {
      clientId: process.env.MS_SSO_CLIENT_ID!,
      clientSecret: process.env.MS_SSO_CLIENT_SECRET!,
      authority: `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}`,
    },
  });
}

function generatePkce(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function isMicrosoftSsoConfigured(): boolean {
  return ssoConfigured();
}

export async function buildMicrosoftAuthorizeUrl(
  redirectUriOverride?: string,
): Promise<{ url: string } | { error: string }> {
  const redirectUri = resolveRedirectUri(redirectUriOverride);
  if (!ssoConfigured(redirectUri)) return { error: 'microsoft_sso_not_configured' };

  const state = crypto.randomBytes(24).toString('hex');
  const { verifier, challenge } = generatePkce();

  try {
    const redis = await getRedisClient();
    await redis.setEx(
      `${SSO_STATE_PREFIX}${state}`,
      STATE_TTL_SEC,
      JSON.stringify({ verifier, createdAt: Date.now(), redirectUri }),
    );
  } catch {
    return { error: 'redis_unavailable' };
  }

  const client = getMsalClient();
  const url = await client.getAuthCodeUrl({
    scopes: ['openid', 'profile', 'email', 'User.Read'],
    redirectUri: redirectUri!,
    state,
    codeChallenge: challenge,
    codeChallengeMethod: 'S256',
    prompt: 'select_account',
  });

  return { url };
}

export async function exchangeMicrosoftCode(
  code: string,
  state: string,
  redirectUriOverride?: string,
): Promise<{ claims: MicrosoftIdTokenClaims } | { error: string }> {
  let verifier: string;
  let redirectUri = resolveRedirectUri(redirectUriOverride);
  try {
    const redis = await getRedisClient();
    const raw = await redis.get(`${SSO_STATE_PREFIX}${state}`);
    if (!raw) return { error: 'invalid_state' };
    await redis.del(`${SSO_STATE_PREFIX}${state}`);
    const parsed = JSON.parse(raw) as { verifier: string; redirectUri?: string };
    verifier = parsed.verifier;
    if (parsed.redirectUri) redirectUri = parsed.redirectUri;
  } catch {
    return { error: 'redis_unavailable' };
  }

  if (!ssoConfigured(redirectUri)) return { error: 'microsoft_sso_not_configured' };

  const client = getMsalClient();
  const tokenRequest: AuthorizationCodeRequest = {
    code,
    scopes: ['openid', 'profile', 'email', 'User.Read'],
    redirectUri: redirectUri!,
    codeVerifier: verifier,
  };

  try {
    const result = await client.acquireTokenByCode(tokenRequest);
    const claims = result.idTokenClaims as Record<string, unknown> | undefined;
    if (!claims?.oid || !claims?.tid) return { error: 'missing_claims' };

    const tenantId = process.env.MS_TENANT_ID;
    if (tenantId && String(claims.tid) !== tenantId) {
      return { error: 'tenant_mismatch' };
    }

    const allowedDomains = (process.env.ADMIN_SSO_ALLOWED_DOMAINS || 'oceanbazar.com.bd,oceanbazar.com')
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    const email = String(claims.email || claims.preferred_username || claims.upn || '').toLowerCase();
    if (allowedDomains.length && email) {
      const domain = email.split('@')[1];
      if (!domain || !allowedDomains.some((d) => domain === d || domain.endsWith(`.${d}`))) {
        return { error: 'domain_not_allowed' };
      }
    }

    return {
      claims: {
        oid: String(claims.oid),
        tid: String(claims.tid),
        email: email || undefined,
        preferred_username: claims.preferred_username as string | undefined,
        name: claims.name as string | undefined,
        upn: claims.upn as string | undefined,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'token_exchange_failed';
    console.error('[sso] Microsoft token exchange failed:', msg);
    return { error: 'token_exchange_failed' };
  }
}

export async function createSsoHandoffCode(payload: {
  adminId: number;
  role: string;
}): Promise<string | null> {
  const code = crypto.randomBytes(24).toString('hex');
  try {
    const redis = await getRedisClient();
    await redis.setEx(`${SSO_HANDOFF_PREFIX}${code}`, HANDOFF_TTL_SEC, JSON.stringify(payload));
    return code;
  } catch {
    return null;
  }
}

export async function consumeSsoHandoffCode(
  code: string,
): Promise<{ adminId: number; role: string } | null> {
  try {
    const redis = await getRedisClient();
    const raw = await redis.get(`${SSO_HANDOFF_PREFIX}${code}`);
    if (!raw) return null;
    await redis.del(`${SSO_HANDOFF_PREFIX}${code}`);
    return JSON.parse(raw) as { adminId: number; role: string };
  } catch {
    return null;
  }
}

export interface ContentIdUserClaims {
  email: string;
  oid: string;
  name?: string;
}

export async function createContentIdHandoffCode(
  payload: ContentIdUserClaims,
): Promise<string | null> {
  const code = crypto.randomBytes(24).toString('hex');
  try {
    const redis = await getRedisClient();
    await redis.setEx(`${CONTENT_ID_HANDOFF_PREFIX}${code}`, HANDOFF_TTL_SEC, JSON.stringify(payload));
    return code;
  } catch {
    return null;
  }
}

export async function consumeContentIdHandoffCode(
  code: string,
): Promise<ContentIdUserClaims | null> {
  try {
    const redis = await getRedisClient();
    const raw = await redis.get(`${CONTENT_ID_HANDOFF_PREFIX}${code}`);
    if (!raw) return null;
    await redis.del(`${CONTENT_ID_HANDOFF_PREFIX}${code}`);
    return JSON.parse(raw) as ContentIdUserClaims;
  } catch {
    return null;
  }
}
