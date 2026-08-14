/**
 * Post-delivery order survey + review-prompt service.
 *
 * Backs GET/POST /api/orders/:id/survey. Survey responses are stored in the
 * `order_feedback` table (one row per submission, latest wins). The state also
 * surfaces the order's products so the storefront can prompt for product reviews.
 */
import { prisma } from '../lib/prisma';

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export interface OrderSurveyState {
  orderId: string;
  orderNumber: string;
  status: string;
  delivered: boolean;
  submitted: boolean;
  canReview: boolean;
  feedback: { rating: number; comment: string | null; createdAt: Date } | null;
  products: Array<{ productId: string; title: string | null }>;
}

export async function getOrderSurveyState(
  orderId: string,
  userId: string,
): Promise<OrderSurveyState | null> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { items: { select: { productId: true, productTitle: true } } },
  });
  if (!order) return null;

  const feedback = await prisma.order_feedback.findFirst({
    where: { order_id: orderId, user_id: userId },
    orderBy: { created_at: 'desc' },
  });

  const status = String(order.status || '').toLowerCase();
  const delivered = status === 'delivered';

  // De-duplicate products (an order can contain multiple items per product).
  const seen = new Set<string>();
  const products: Array<{ productId: string; title: string | null }> = [];
  for (const item of order.items) {
    if (seen.has(item.productId)) continue;
    seen.add(item.productId);
    products.push({ productId: item.productId, title: item.productTitle ?? null });
  }

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status,
    delivered,
    submitted: Boolean(feedback),
    canReview: delivered,
    feedback: feedback
      ? { rating: feedback.rating, comment: feedback.comment ?? null, createdAt: feedback.created_at }
      : null,
    products,
  };
}

export async function submitOrderSurvey(
  orderId: string,
  userId: string,
  body: unknown,
): Promise<OrderSurveyState> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: { id: true },
  });
  if (!order) {
    const err: any = new Error('Order not found');
    err.status = 404;
    throw err;
  }

  const payload = (body ?? {}) as { rating?: unknown; comment?: unknown };
  const rating = Number(payload.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    const err: any = new Error('Rating must be an integer between 1 and 5');
    err.status = 400;
    throw err;
  }
  const comment =
    typeof payload.comment === 'string' ? payload.comment.trim().slice(0, 2000) || null : null;

  const existing = await prisma.order_feedback.findFirst({
    where: { order_id: orderId, user_id: userId },
  });
  if (existing) {
    await prisma.order_feedback.update({ where: { id: existing.id }, data: { rating, comment } });
  } else {
    await prisma.order_feedback.create({
      data: { id: generateId(), order_id: orderId, user_id: userId, rating, comment },
    });
  }

  const state = await getOrderSurveyState(orderId, userId);
  if (!state) {
    const err: any = new Error('Order not found');
    err.status = 404;
    throw err;
  }
  return state;
}
