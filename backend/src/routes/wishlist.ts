import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

import { requireAuth } from '../middleware/auth';

const router = Router();

/** Ensures the user_wishlists table exists on first use (safe no-op if already present). */
async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS user_wishlists (
      id          BIGSERIAL PRIMARY KEY,
      user_id     VARCHAR(255) NOT NULL,
      product_id  VARCHAR(255) NOT NULL,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, product_id)
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_user_wishlists_user ON user_wishlists(user_id);
  `);
}

// GET /api/wishlist — return all wishlist product IDs for the authenticated user
router.get('/', requireAuth, async (req: Request, res: Response) => {
  await ensureTable();
  const rows = await prisma.$queryRaw<Array<{ product_id: string }>>`
    SELECT product_id FROM user_wishlists WHERE user_id = ${req.user!.userId} ORDER BY created_at DESC
  `;
  res.json({ ids: rows.map((r) => r.product_id) });
});

// POST /api/wishlist/toggle — add if not present, remove if present
router.post('/toggle', requireAuth, async (req: Request, res: Response) => {
  const { productId } = req.body as { productId: string };
  if (!productId) { res.status(400).json({ error: 'productId required' }); return; }
  await ensureTable();
  const existing = await prisma.$queryRaw<Array<{ id: bigint }>>`
    SELECT id FROM user_wishlists WHERE user_id = ${req.user!.userId} AND product_id = ${productId}
  `;
  if (existing.length > 0) {
    await prisma.$executeRaw`
      DELETE FROM user_wishlists WHERE user_id = ${req.user!.userId} AND product_id = ${productId}
    `;
    res.json({ action: 'removed', productId });
  } else {
    await prisma.$executeRaw`
      INSERT INTO user_wishlists (user_id, product_id) VALUES (${req.user!.userId}, ${productId})
      ON CONFLICT (user_id, product_id) DO NOTHING
    `;
    res.json({ action: 'added', productId });
  }
});

// POST /api/wishlist/sync — bulk sync from localStorage (upsert all, returns server state)
router.post('/sync', requireAuth, async (req: Request, res: Response) => {
  const { ids } = req.body as { ids: string[] };
  if (!Array.isArray(ids)) { res.status(400).json({ error: 'ids must be an array' }); return; }
  await ensureTable();
  if (ids.length > 0) {
    for (const pid of ids.slice(0, 500)) {
      await prisma.$executeRaw`
        INSERT INTO user_wishlists (user_id, product_id) VALUES (${req.user!.userId}, ${pid})
        ON CONFLICT (user_id, product_id) DO NOTHING
      `;
    }
  }
  const rows = await prisma.$queryRaw<Array<{ product_id: string }>>`
    SELECT product_id FROM user_wishlists WHERE user_id = ${req.user!.userId} ORDER BY created_at DESC
  `;
  res.json({ ids: rows.map((r) => r.product_id) });
});

export default router;
