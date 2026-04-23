import type { Request, Response, NextFunction } from 'express';
import { getRedisClient, isRedisConnected } from './redisClient';

interface CacheOptions {
  ttlSeconds: number;
  keyPrefix: string;
}

/**
 * Express middleware that caches GET responses in Redis.
 * On cache hit, returns the cached JSON immediately.
 * On cache miss, intercepts res.json() to store the response before sending.
 */
export function cacheResponse(options: CacheOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();
    if (!isRedisConnected()) return next();

    const key = `${options.keyPrefix}:${req.originalUrl}`;

    try {
      const redis = await getRedisClient();
      const cached = await redis.get(key);

      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(JSON.parse(cached));
      }
    } catch {
      // Redis unavailable, proceed without cache
    }

    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      res.setHeader('X-Cache', 'MISS');
      // Store in Redis asynchronously (fire and forget)
      getRedisClient()
        .then((redis) => redis.setEx(key, options.ttlSeconds, JSON.stringify(body)))
        .catch(() => {});
      return originalJson(body);
    } as any;

    next();
  };
}

/**
 * Invalidate cache entries by prefix pattern.
 */
export async function invalidateCache(keyPrefix: string): Promise<void> {
  if (!isRedisConnected()) return;
  try {
    const redis = await getRedisClient();
    const keys = await redis.keys(`${keyPrefix}:*`);
    if (keys.length > 0) {
      await redis.del(keys);
    }
  } catch {
    // ignore
  }
}
