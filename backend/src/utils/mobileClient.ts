import type { Request } from 'express';

/**
 * Native Expo / React Native clients cannot rely on HttpOnly cookies the way browsers do.
 * They send `X-Client-Platform: mobile` (or body.clientPlatform) and store refresh tokens
 * in secure device storage. Web browsers keep using the refreshToken cookie only.
 */
export function isMobileClient(req: Request): boolean {
  const header = String(req.headers['x-client-platform'] || '').trim().toLowerCase();
  const bodyPlatform = String(
    (req.body as { clientPlatform?: string } | undefined)?.clientPlatform || '',
  )
    .trim()
    .toLowerCase();
  return (
    header === 'mobile' ||
    header === 'expo' ||
    header === 'react-native' ||
    bodyPlatform === 'mobile' ||
    bodyPlatform === 'expo' ||
    bodyPlatform === 'react-native'
  );
}

/** Prefer cookie (web), then JSON body, then header — never log the raw token. */
export function readRefreshToken(req: Request): string | undefined {
  const fromCookie = req.cookies?.refreshToken;
  if (typeof fromCookie === 'string' && fromCookie.trim()) return fromCookie.trim();

  const fromBody = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
  if (typeof fromBody === 'string' && fromBody.trim()) return fromBody.trim();

  const fromHeader = req.headers['x-refresh-token'];
  if (typeof fromHeader === 'string' && fromHeader.trim()) return fromHeader.trim();
  if (Array.isArray(fromHeader) && fromHeader[0]?.trim()) return fromHeader[0].trim();

  return undefined;
}

export function refreshTokenSource(req: Request): 'cookie' | 'body' | 'header' | 'none' {
  if (typeof req.cookies?.refreshToken === 'string' && req.cookies.refreshToken.trim()) {
    return 'cookie';
  }
  const fromBody = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
  if (typeof fromBody === 'string' && fromBody.trim()) return 'body';
  const fromHeader = req.headers['x-refresh-token'];
  if (typeof fromHeader === 'string' && fromHeader.trim()) return 'header';
  if (Array.isArray(fromHeader) && fromHeader[0]?.trim()) return 'header';
  return 'none';
}
