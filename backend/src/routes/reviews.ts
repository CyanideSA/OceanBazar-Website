import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

import { requireAuth, optionalAuth } from '../middleware/auth';
import { generateEntityId } from '../utils/hexId';
import { routeParam } from '../utils/params';
import { ReviewListResponseSchema } from '../contracts/review.contract';
import { parseContract } from '../lib/contractValidate';
import { emitAdminEvent, emitBroadcast } from '../lib/adminEvents';
const router = Router();

function formatReview(r: {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  imageUrls: string[];
  helpfulCount: number;
  unhelpfulCount: number;
  verifiedPurchase: boolean;
  createdAt: Date;
  status?: string;
  user: { name: string; profileImage?: string | null };
}) {
  return {
    id: r.id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    imageUrls: r.imageUrls ?? [],
    helpfulCount: r.helpfulCount ?? 0,
    unhelpfulCount: r.unhelpfulCount ?? 0,
    verifiedPurchase: r.verifiedPurchase ?? false,
    authorName: r.user.name,
    authorAvatar: r.user.profileImage ?? null,
    status: r.status || 'approved',
    pending: r.status === 'pending',
    createdAt: r.createdAt.toISOString(),
  };
}

// GET /api/reviews/product/:productId — approved reviews (public) + caller's pending
router.get('/product/:productId', optionalAuth, async (req: Request, res: Response) => {
  const productId = routeParam(req.params.productId);
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
  const filterRating = parseInt(String(req.query.rating || '0'), 10) || 0;
  const sortBy = String(req.query.sort || 'newest');

  const orderBy = sortBy === 'helpful'
    ? [{ helpfulCount: 'desc' as const }, { createdAt: 'desc' as const }]
    : sortBy === 'highest' ? [{ rating: 'desc' as const }, { createdAt: 'desc' as const }]
    : sortBy === 'lowest'  ? [{ rating: 'asc'  as const }, { createdAt: 'desc' as const }]
    : [{ createdAt: 'desc' as const }];

  const where: Record<string, unknown> = { productId, status: 'approved' };
  if (filterRating >= 1 && filterRating <= 5) where.rating = filterRating;

  const [rows, total, ratingDist, myReviewRow] = await Promise.all([
    prisma.productReview.findMany({
      where,
      include: { user: { select: { name: true, profileImage: true } } },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.productReview.count({ where: { productId, status: 'approved' } }),
    prisma.productReview.groupBy({
      by: ['rating'],
      where: { productId, status: 'approved' },
      _count: { id: true },
    }),
    req.user?.userId
      ? prisma.productReview.findFirst({
          where: { productId, userId: req.user.userId },
          include: { user: { select: { name: true, profileImage: true } } },
        })
      : Promise.resolve(null),
  ]);

  // Build rating distribution { 5: 24, 4: 12, ... }
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of ratingDist) { dist[r.rating] = r._count.id; }

  const approved = rows.map((r) => formatReview(r as never));
  const myReview = myReviewRow
    ? formatReview({ ...(myReviewRow as object), status: myReviewRow.status } as never)
    : null;
  const seen = new Set(approved.map((r) => r.id));
  const reviews =
    myReview && myReview.status === 'pending' && !seen.has(myReview.id)
      ? [myReview, ...approved]
      : approved;

  const avg =
    total > 0
      ? Object.entries(dist).reduce((sum, [star, count]) => sum + Number(star) * count, 0) / total
      : 0;

  res.json(
    parseContract(
      ReviewListResponseSchema,
      {
        reviews,
        myReview,
        ratingDistribution: dist,
        averageRating: Math.round(avg * 10) / 10,
        totalReviews: total,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
      'reviews.product'
    )
  );
});

router.use(requireAuth);

// GET /api/reviews/me — current user's reviews
router.get('/me', async (req: Request, res: Response) => {
  const rows = await prisma.productReview.findMany({
    where: { userId: req.user!.userId },
    include: { product: { select: { id: true, titleEn: true, titleBn: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({
    reviews: rows.map((r) => ({
      id: r.id,
      productId: r.productId,
      productTitleEn: r.product.titleEn,
      productTitleBn: r.product.titleBn,
      rating: r.rating,
      title: r.title,
      body: r.body,
      imageUrls: (r as any).imageUrls ?? [],
      verifiedPurchase: (r as any).verifiedPurchase ?? false,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

// POST /api/reviews — submit (pending moderation)
router.post('/', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { productId, rating, title, body, orderId, imageUrls } = req.body as {
    productId: string;
    rating: number;
    title?: string;
    body?: string;
    orderId?: string;
    imageUrls?: string[];
  };

  if (!productId) { res.status(400).json({ error: 'productId required' }); return; }
  const r = Math.round(Number(rating));
  if (!Number.isFinite(r) || r < 1 || r > 5) { res.status(400).json({ error: 'rating must be 1–5' }); return; }

  // Validate image URLs (max 5, must be http/https)
  const safeImageUrls = (Array.isArray(imageUrls) ? imageUrls : [])
    .filter((u) => typeof u === 'string' && /^https?:\/\//.test(u))
    .slice(0, 5);

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) { res.status(404).json({ error: 'Product not found' }); return; }

  let verifiedPurchase = false;
  if (orderId) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: { where: { productId } } },
    });
    if (!order) { res.status(400).json({ error: 'Order not found' }); return; }
    if (order.status !== 'delivered' && order.status !== 'returned') {
      res.status(400).json({ error: 'Order must be delivered before reviewing' }); return;
    }
    if (order.items.length === 0) { res.status(400).json({ error: 'Product was not part of this order' }); return; }
    verifiedPurchase = true;
  }

  const existing = await prisma.productReview.findUnique({
    where: { userId_productId: { userId, productId } },
  });

  const titleVal = title ? String(title).slice(0, 255) : null;
  const bodyVal = body != null ? String(body).slice(0, 8000) : null;
  const imagePayload =
    Array.isArray(imageUrls)
      ? { imageUrls: safeImageUrls }
      : {};

  let review;
  let edited = false;
  if (existing) {
    // One review per product — allow edits (e.g. after reorder). Re-enter moderation.
    edited = true;
    review = await prisma.productReview.update({
      where: { id: existing.id },
      data: {
        rating: r,
        title: titleVal,
        body: bodyVal,
        ...(orderId ? { orderId } : {}),
        ...(verifiedPurchase ? { verifiedPurchase: true } : {}),
        ...imagePayload,
        status: 'pending',
      } as any,
    });
  } else {
    review = await prisma.productReview.create({
      data: {
        id: generateEntityId(),
        userId,
        productId,
        orderId: orderId ?? null,
        rating: r,
        title: titleVal,
        body: bodyVal,
        ...(safeImageUrls.length > 0 ? { imageUrls: safeImageUrls } : {}),
        ...(verifiedPurchase ? { verifiedPurchase: true } : {}),
        status: 'pending',
      } as any,
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, profileImage: true },
  });
  const mainImage =
    (await prisma.productAsset.findFirst({
      where: { productId, assetType: 'image' },
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
      select: { url: true },
    }))?.url ?? null;

  let bonus = { awarded: false, points: 0 };
  try {
    const { maybeAwardReviewBonus } = await import('../services/orderSurveyService');
    // Edit after survey+delivered reorder still earns +5 once per order survey.
    bonus = await maybeAwardReviewBonus(userId, orderId);
  } catch { /* non-fatal */ }

  // #region agent log
  {
    const payload = {
      sessionId: '1eb282',
      runId: 'review-edit',
      hypothesisId: 'H-REVIEW-UPSERT',
      location: 'reviews.ts:POST/',
      message: edited ? 'review updated' : 'review created',
      data: {
        edited,
        hasOrderId: Boolean(orderId),
        bonusAwarded: bonus.awarded,
        bonusPoints: bonus.points,
        productId: String(productId).slice(0, 12),
      },
      timestamp: Date.now(),
    };
    fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '1eb282' },
      body: JSON.stringify(payload),
    }).catch(() => {});
    try {
      const fs = require('fs') as typeof import('fs');
      fs.appendFileSync('/tmp/ob-debug-1eb282.ndjson', `${JSON.stringify(payload)}\n`);
    } catch { /* ignore */ }
  }
  // #endregion

  const finalImageUrls =
    safeImageUrls.length > 0
      ? safeImageUrls
      : ((review as any).imageUrls as string[] | undefined) ?? [];

  const snapshot = {
    id: review.id,
    status: review.status,
    rating: r,
    title: review.title,
    body: review.body,
    imageUrls: finalImageUrls,
    verifiedPurchase: Boolean((review as any).verifiedPurchase || verifiedPurchase),
    edited,
    createdAt: review.createdAt.toISOString(),
    customer: {
      id: userId,
      name: user?.name ?? 'Customer',
      email: user?.email ?? null,
      avatar: user?.profileImage ?? null,
    },
    product: {
      id: product.id,
      titleEn: product.titleEn,
      titleBn: product.titleBn,
      sku: (product as any).sku ?? null,
      imageUrl: mainImage,
      ratingAvg: product.ratingAvg != null ? Number(product.ratingAvg) : null,
      reviewCount: product.reviewCount ?? 0,
    },
  };
  try { emitAdminEvent(edited ? 'admin:reviews:updated' : 'admin:reviews:new', snapshot); } catch { /* non-fatal */ }
  try { emitBroadcast('storefront:reviews:updated', { productId }); } catch { /* non-fatal */ }

  res.status(edited ? 200 : 201).json({
    review: {
      id: review.id,
      status: review.status,
      authorName: user?.name ?? 'You',
      authorAvatar: user?.profileImage ?? null,
      rating: r,
      title: review.title,
      body: review.body,
      imageUrls: finalImageUrls,
      pending: true,
      edited,
    },
    snapshot,
    obPointsBonus: bonus,
  });
});

// POST /api/reviews/:id/helpful — vote helpful
router.post('/:id/helpful', async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  try {
    await prisma.productReview.update({
      where: { id },
      data: { helpfulCount: { increment: 1 } } as any,
    });
    res.json({ ok: true });
  } catch { res.status(404).json({ error: 'Review not found' }); }
});

// POST /api/reviews/:id/unhelpful — vote unhelpful
router.post('/:id/unhelpful', async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  try {
    await prisma.productReview.update({
      where: { id },
      data: { unhelpfulCount: { increment: 1 } } as any,
    });
    res.json({ ok: true });
  } catch { res.status(404).json({ error: 'Review not found' }); }
});

export default router;
