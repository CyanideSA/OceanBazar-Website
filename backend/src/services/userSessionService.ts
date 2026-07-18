import crypto from 'crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

import type { Request } from 'express';
import { env } from '../config/env';

let ensured = false;

export type RefreshTokenPayload = { userId: string; sid: string; jti: string };

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function requestIp(req: Request): string | null {
  return (
    ((req.headers['x-forwarded-for'] as string) || '').split(',')[0]?.trim()
    || req.socket.remoteAddress
    || null
  );
}

function locationKey(ip: string | null): string {
  if (!ip) return 'unknown';
  const normalized = ip.replace(/^::ffff:/, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(normalized)) {
    return normalized.split('.').slice(0, 3).join('.');
  }
  return normalized.split(':').slice(0, 4).join(':');
}

export function requestDevice(req: Request): string {
  const supplied = String(req.headers['x-device-id'] || '').trim().slice(0, 128);
  const ua = req.headers['user-agent'] || '';
  return crypto.createHash('sha256').update(supplied || String(ua)).digest('hex').slice(0, 32);
}

async function ensureUserSessionSchema() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      sid TEXT PRIMARY KEY,
      user_id CHAR(8) NOT NULL,
      jti TEXT NOT NULL,
      refresh_token_hash TEXT NOT NULL,
      device_id TEXT NOT NULL,
      user_agent TEXT,
      ip_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      rotated_from TEXT
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, revoked_at, expires_at)
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_user_sessions_trust
    ON user_sessions(user_id, device_id, verified_at DESC)
  `);
  ensured = true;
}

export type LoginVerificationReason = 'new_device' | 'new_location' | 'periodic_7_day';

export async function getLoginVerificationDecision(
  userId: string,
  req: Request,
): Promise<{ required: boolean; reason: LoginVerificationReason | null }> {
  await ensureUserSessionSchema();
  const deviceId = requestDevice(req);
  const ip = requestIp(req);
  const rows = await prisma.$queryRaw<Array<{
    device_id: string;
    ip_address: string | null;
    verified_at: Date | null;
  }>>`
    SELECT device_id, ip_address, verified_at
    FROM user_sessions
    WHERE user_id = ${userId}
      AND verified_at IS NOT NULL
    ORDER BY verified_at DESC
    LIMIT 100
  `;
  const deviceRows = rows.filter((row) => row.device_id === deviceId);
  if (deviceRows.length === 0) return { required: true, reason: 'new_device' };
  const locationRows = deviceRows.filter(
    (row) => locationKey(row.ip_address) === locationKey(ip),
  );
  if (locationRows.length === 0) return { required: true, reason: 'new_location' };
  const lastVerified = locationRows[0]?.verified_at;
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  if (!lastVerified || lastVerified.getTime() <= sevenDaysAgo) {
    return { required: true, reason: 'periodic_7_day' };
  }
  return { required: false, reason: null };
}

export async function issueRefreshSession(
  userId: string,
  req: Request,
  options?: { verified?: boolean },
): Promise<string> {
  await ensureUserSessionSchema();
  const sid = crypto.randomUUID();
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const token = jwt.sign(
    { userId, sid, jti },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES } as SignOptions,
  );
  await prisma.$executeRaw`
    INSERT INTO user_sessions (
      sid, user_id, jti, refresh_token_hash, device_id, user_agent, ip_address, expires_at, verified_at
    )
    VALUES (
      ${sid},
      ${userId},
      ${jti},
      ${hashToken(token)},
      ${requestDevice(req)},
      ${String(req.headers['user-agent'] || '').slice(0, 512)},
      ${requestIp(req)},
      ${expiresAt},
      ${options?.verified ? new Date() : null}
    )
  `;
  // #region agent log
  fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7c9155'},body:JSON.stringify({sessionId:'7c9155',runId:'pre-fix',hypothesisId:'B,C',location:'backend/src/services/userSessionService.ts:issueRefreshSession',message:'Refresh session issued',data:{verified:Boolean(options?.verified),expiresInMs:expiresAt.getTime()-Date.now()},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return token;
}

export async function rotateRefreshSession(token: string, req: Request): Promise<RefreshTokenPayload | null> {
  await ensureUserSessionSchema();
  let payload: RefreshTokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch {
    // #region agent log
    fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7c9155'},body:JSON.stringify({sessionId:'7c9155',runId:'pre-fix',hypothesisId:'B,C',location:'backend/src/services/userSessionService.ts:rotate-token-invalid',message:'Refresh JWT verification failed',data:{tokenPresent:Boolean(token)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return null;
  }
  const rows = await prisma.$queryRaw<Array<{ sid: string; refresh_token_hash: string; user_id: string; revoked_at: Date | null; expires_at: Date }>>`
    SELECT sid, refresh_token_hash, user_id, revoked_at, expires_at
    FROM user_sessions
    WHERE sid = ${payload.sid}
    LIMIT 1
  `;
  const row = rows[0];
  // #region agent log
  fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7c9155'},body:JSON.stringify({sessionId:'7c9155',runId:'pre-fix',hypothesisId:'A,B,C',location:'backend/src/services/userSessionService.ts:rotate-session-state',message:'Refresh session lookup completed',data:{rowFound:Boolean(row),revoked:Boolean(row?.revoked_at),expired:Boolean(row&&row.expires_at<=new Date()),hashMatches:Boolean(row&&row.refresh_token_hash===hashToken(token))},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!row) return null;
  if (row.revoked_at || row.expires_at <= new Date()) return null;
  if (row.refresh_token_hash !== hashToken(token)) return null;

  await prisma.$executeRaw`
    UPDATE user_sessions SET revoked_at = NOW() WHERE sid = ${payload.sid}
  `;
  return payload;
}

export async function revokeRefreshSessionByToken(token: string): Promise<void> {
  await ensureUserSessionSchema();
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
    await prisma.$executeRaw`UPDATE user_sessions SET revoked_at = NOW() WHERE sid = ${payload.sid}`;
  } catch {
    /* ignore invalid token */
  }
}

