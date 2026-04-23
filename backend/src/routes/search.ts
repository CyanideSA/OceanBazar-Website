import { Router, Request, Response } from 'express';
import axios from 'axios';
import { getRedisClient, isRedisConnected } from '../cache/redisClient';

const router = Router();
const CORE_API_URL = process.env.JAVA_API_URL || 'https://localhost:8000';
const SEARCH_CACHE_TTL = 120; // 2 minutes

/**
 * GET /api/search?q=...&category=...&minPrice=...&maxPrice=...&sort=...&page=...&limit=...
 *
 * BFF search endpoint: checks Redis cache first, then queries Spring Boot Core API.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const cacheKey = `bff:search:${req.originalUrl}`;

    if (isRedisConnected()) {
      try {
        const redis = await getRedisClient();
        const cached = await redis.get(cacheKey);
        if (cached) {
          res.setHeader('X-Cache', 'HIT');
          return res.json(JSON.parse(cached));
        }
      } catch {
        // Redis unavailable, proceed without cache
      }
    }

    const { data } = await axios.get(`${CORE_API_URL}/api/products`, {
      params: req.query,
      timeout: 10_000,
    });

    if (isRedisConnected()) {
      getRedisClient()
        .then((redis) => redis.setEx(cacheKey, SEARCH_CACHE_TTL, JSON.stringify(data)))
        .catch(() => {});
    }

    res.setHeader('X-Cache', 'MISS');
    res.json(data);
  } catch (err: any) {
    console.error('[search] Proxy to Spring Boot failed:', err.message);
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    res.status(502).json({ error: 'Search service unavailable' });
  }
});

export default router;
