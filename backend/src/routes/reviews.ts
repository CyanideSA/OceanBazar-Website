import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { generateEntityId } from '../utils/hexId';
import { routeParam } from '../utils/params';
const router = Router();
const prisma = new PrismaClient();

function formatReview(r: {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  createdAt: Date;
  user: { name: string };
}) {
  return {
    id: r.id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    authorName: r.user.name,
    createdAt: r.createdAt.toISOString(),
  };
}

// GET /api/reviews/product/:productId — approved reviews (public)
router.get('/product/:productId', async (req: Request, res: Response) => {
  const productId = routeParam(req.params.productId);
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));

  const [rows, total] = await Promise.all([
    prisma.productReview.findMany({
      where: { productId, status: 'approved' },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.productReview.count({ where: { productId, status: 'approved' } }),
  ]);

  res.json({
    reviews: rows.map((r) => formatReview(r)),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
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
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

// POST /api/reviews — submit (pending moderation)
router.post('/', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { productId, rating, title, body, orderId } = req.body as {
    productId: string;
    rating: number;
    title?: string;
    body?: string;
    orderId?: string;
  };

  if (!productId) {
    res.status(400).json({ error: 'productId required' });
    return;
  }
  const r = Math.round(Number(rating));
  if (!Number.isFinite(r) || r < 1 || r > 5) {
    res.status(400).json({ error: 'rating must be 1–5' });
    return;
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  if (orderId) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: { where: { productId } } },
    });
    if (!order) {
      res.status(400).json({ error: 'Order not found' });
      return;
    }
    if (order.status !== 'delivered' && order.status !== 'returned') {
      res.status(400).json({ error: 'Order must be delivered before reviewing' });
      return;
    }
    if (order.items.length === 0) {
      res.status(400).json({ error: 'Product was not part of this order' });
      return;
    }
  }

  const existing = await prisma.productReview.findUnique({
    where: { userId_productId: { userId, productId } },
  });
  if (existing) {
    res.status(409).json({ error: 'You already reviewed this product' });
    return;
  }

  const review = await prisma.productReview.create({
    data: {
      id: generateEntityId(),
      userId,
      productId,
      orderId: orderId ?? null,
      rating: r,
      title: title ? String(title).slice(0, 255) : null,
      body: body != null ? String(body).slice(0, 8000) : null,
      status: 'pending',
    },
  });

  res.status(201).json({ review: { id: review.id, status: review.status } });
});

export default router;
