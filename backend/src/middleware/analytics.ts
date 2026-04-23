import { Request, Response, NextFunction } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type AnalyticsEventType =
  | 'product_view'
  | 'add_to_cart'
  | 'order_placed'
  | 'payment_success'
  | 'ob_points_earned'
  | 'ob_points_redeemed'
  | 'user_registered'
  | 'page_view';

export async function trackEvent(
  eventType: AnalyticsEventType,
  payload: Record<string, unknown>,
  userId?: string,
  sessionId?: string
): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: { eventType, userId, sessionId, payload: payload as Prisma.InputJsonValue },
    });
  } catch {
    // Non-blocking — never fail requests due to analytics
  }
}

/** Express middleware to auto-track page views */
export function analyticsMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (req.method === 'GET' && req.path.startsWith('/api/products/')) {
    const productId = req.path.split('/').pop();
    if (productId && productId !== 'compare') {
      trackEvent('product_view', { productId }, req.user?.userId).catch(() => {});
    }
  }
  next();
}
