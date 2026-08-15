import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { cacheResponse } from '../cache/cacheMiddleware';

const router = Router();
const prismaAny = prisma as any;

/**
 * GET /api/trust-badges
 * Public catalog with active-product counts for homepage + filter chips.
 */
router.get('/', cacheResponse({ ttlSeconds: 120, keyPrefix: 'bff:trust-badges' }), async (_req: Request, res: Response) => {
  try {
    const rows = await prismaAny.trustBadge.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        products: {
          where: { product: { status: 'active' } },
          select: { productId: true },
        },
      },
    });

    const badges = rows.map((r: any) => ({
      id: r.id,
      slug: r.slug,
      nameEn: r.nameEn,
      nameBn: r.nameBn,
      icon: r.icon || 'shield',
      description: r.description || '',
      sortOrder: r.sortOrder ?? 0,
      productCount: Array.isArray(r.products) ? r.products.length : 0,
    }));

    // #region agent log
    fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'078c95'},body:JSON.stringify({sessionId:'078c95',runId:'trust-badges',hypothesisId:'T1',location:'trust-badges.ts:list',message:'public trust badges served',data:{count:badges.length,withProducts:badges.filter((b:any)=>b.productCount>0).length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    res.json({ badges });
  } catch (err: any) {
    console.error('[trust-badges] public list failed', err);
    // #region agent log
    fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'078c95'},body:JSON.stringify({sessionId:'078c95',runId:'trust-badges',hypothesisId:'T2',location:'trust-badges.ts:catch',message:'public trust badges failed',data:{err:String(err?.message||err).slice(0,240),code:err?.code||null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    // Fallback: raw SQL so homepage still works if Prisma client/model lag the schema
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(`
        SELECT b.id, b.slug, b.name_en AS "nameEn", b.name_bn AS "nameBn",
               COALESCE(b.icon, 'shield') AS icon,
               COALESCE(b.description, '') AS description,
               b.sort_order AS "sortOrder",
               (
                 SELECT COUNT(*)::int FROM product_trust_badges ptb
                 INNER JOIN products p ON p.id = ptb.product_id
                 WHERE ptb.badge_id = b.id AND p.status = 'active'
               ) AS "productCount"
        FROM trust_badge_catalog b
        WHERE b.active = true
        ORDER BY b.sort_order ASC, b.id ASC
      `);
      const badges = (rows || []).map((r) => ({
        id: r.id,
        slug: r.slug,
        nameEn: r.nameEn,
        nameBn: r.nameBn,
        icon: r.icon || 'shield',
        description: r.description || '',
        sortOrder: r.sortOrder ?? 0,
        productCount: Number(r.productCount) || 0,
      }));
      // #region agent log
      fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'078c95'},body:JSON.stringify({sessionId:'078c95',runId:'trust-badges',hypothesisId:'T3',location:'trust-badges.ts:fallback',message:'raw SQL fallback used',data:{count:badges.length,withProducts:badges.filter((b)=>b.productCount>0).length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return res.json({ badges });
    } catch (fallbackErr: any) {
      console.error('[trust-badges] raw fallback failed', fallbackErr);
      res.json({ badges: [] });
    }
  }
});

export default router;
