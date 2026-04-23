import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { routeParam } from '../utils/params';
import { cacheResponse } from '../cache/cacheMiddleware';

const router = Router();
const prisma = new PrismaClient();
const categoryCache = cacheResponse({ ttlSeconds: 1800, keyPrefix: 'bff:categories' });

// GET /api/categories — full two-level tree (cached 30 min)
router.get('/', categoryCache, async (_req: Request, res: Response) => {
  const categories = await prisma.category.findMany({
    where: { parentId: null },
    include: {
      children: { orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { sortOrder: 'asc' },
  });
  res.json({ categories });
});

// GET /api/categories/:id
router.get('/:id', async (req: Request, res: Response) => {
  const category = await prisma.category.findUnique({
    where: { id: routeParam(req.params.id) },
    include: { children: true, parent: true },
  });
  if (!category) { res.status(404).json({ error: 'Category not found' }); return; }
  res.json({ category });
});

export default router;
