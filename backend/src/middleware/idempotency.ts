import type { NextFunction, Request, Response } from 'express';
import { getRedisClient } from '../cache/redisClient';

const memory = new Map<string, { status: number; body: unknown; expiresAt: number }>();

async function getCached(key: string): Promise<{ status: number; body: unknown } | null> {
  const inMem = memory.get(key);
  if (inMem && inMem.expiresAt > Date.now()) return { status: inMem.status, body: inMem.body };
  if (inMem) memory.delete(key);
  try {
    const redis = await getRedisClient();
    const raw = await redis.get(`idem:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { status: number; body: unknown };
    return parsed;
  } catch {
    return null;
  }
}

async function putCached(key: string, status: number, body: unknown): Promise<void> {
  const payload = { status, body };
  memory.set(key, { ...payload, expiresAt: Date.now() + 5 * 60 * 1000 });
  try {
    const redis = await getRedisClient();
    await redis.setEx(`idem:${key}`, 300, JSON.stringify(payload));
  } catch {
    /* ignore redis failures */
  }
}

export function requireIdempotencyKey() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = String(req.headers['x-idempotency-key'] || '').trim();
    if (!key) {
      res.status(400).json({ error: 'x-idempotency-key header required for this endpoint' });
      return;
    }
    const routeKey = `${req.method}:${req.originalUrl}:${key}`;
    const hit = await getCached(routeKey);
    if (hit) {
      res.status(hit.status).json(hit.body);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      void putCached(routeKey, res.statusCode || 200, body);
      return originalJson(body);
    }) as typeof res.json;
    next();
  };
}

