import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { generateEntityId } from '../utils/hexId';
import { routeParam } from '../utils/params';
import { ReviewListResponseSchema } from '../contracts/review.contract';
import { parseContract } from '../lib/contractValidate';
const router = Router();
const prisma = new PrismaClient();

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
  user: { name: string };
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
    createdAt: r.createdAt.toISOString(),
  };
}

// GET /api/reviews/product/:productId — approved reviews (public)
router.get('/product/:productId', async (req: Request, res: Response) => {
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

  const [rows, total, ratingDist] = await Promise.all([
    prisma.productReview.findMany({
      where,
      include: { user: { select: { name: true } } },
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
  ]);

  // Build rating distribution { 5: 24, 4: 12, ... }
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of ratingDist) { dist[r.rating] = r._count.id; }

  res.json(
    parseContract(
      ReviewListResponseSchema,
      {
        reviews: rows.map((r) => formatReview(r as never)),
        ratingDistribution: dist,
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
  if (existing) { res.status(409).json({ error: 'You already reviewed this product' }); return; }

  const review = await prisma.productReview.create({
    data: {
      id: generateEntityId(),
      userId,
      productId,
      orderId: orderId ?? null,
      rating: r,
      title: title ? String(title).slice(0, 255) : null,
      body: body != null ? String(body).slice(0, 8000) : null,
      // imageUrls and verifiedPurchase stored via JSON column (graceful if column doesn't exist)
      ...(safeImageUrls.length > 0 ? { imageUrls: safeImageUrls } : {}),
      ...(verifiedPurchase ? { verifiedPurchase: true } : {}),
      status: 'pending',
    } as any,
  });

  res.status(201).json({ review: { id: review.id, status: review.status } });
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
