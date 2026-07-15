import crypto from 'crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import type { Request } from 'express';
import { env } from '../config/env';

const prisma = new PrismaClient();
let ensured = false;

export type RefreshTokenPayload = { userId: string; sid: string; jti: string };

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function requestIp(req: Request): string | null {
  return (
    ((req.headers['x-forwarded-for'] as string) || '').split(',')[0]?.trim()
    || req.socket.remoteAddress
    || null
  );
}

function requestDevice(req: Request): string {
  const ua = req.headers['user-agent'] || '';
  const ip = requestIp(req) || '';
  return crypto.createHash('sha256').update(`${ua}|${ip}`).digest('hex').slice(0, 32);
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
  ensured = true;
}

export async function issueRefreshSession(userId: string, req: Request): Promise<string> {
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
    INSERT INTO user_sessions (sid, user_id, jti, refresh_token_hash, device_id, user_agent, ip_address, expires_at)
    VALUES (
      ${sid},
      ${userId},
      ${jti},
      ${hashToken(token)},
      ${requestDevice(req)},
      ${String(req.headers['user-agent'] || '').slice(0, 512)},
      ${requestIp(req)},
      ${expiresAt}
    )
  `;
  return token;
}

export async function rotateRefreshSession(token: string, req: Request): Promise<RefreshTokenPayload | null> {
  await ensureUserSessionSchema();
  let payload: RefreshTokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch {
    return null;
  }
  const rows = await prisma.$queryRaw<Array<{ sid: string; refresh_token_hash: string; user_id: string; revoked_at: Date | null; expires_at: Date }>>`
    SELECT sid, refresh_token_hash, user_id, revoked_at, expires_at
    FROM user_sessions
    WHERE sid = ${payload.sid}
    LIMIT 1
  `;
  const row = rows[0];
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

