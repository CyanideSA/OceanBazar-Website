import { prisma } from '../lib/prisma';
import { adminAdjustPoints } from './obPointsService';

async function ensureOrderSurveyTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS order_surveys (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      product_satisfaction INT,
      service_satisfaction INT,
      payment_convenience INT,
      cod_experience INT,
      delivery_experience INT,
      comments TEXT,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      review_bonus_awarded BOOLEAN NOT NULL DEFAULT FALSE
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_order_surveys_user ON order_surveys(user_id)
  `);
}

let ready: Promise<void> | null = null;
function ensureReady() {
  if (!ready) {
    ready = ensureOrderSurveyTable().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export type SurveyPayload = {
  productSatisfaction: number;
  serviceSatisfaction: number;
  paymentConvenience: number;
  codExperience?: number | null;
  deliveryExperience: number;
  comments?: string;
};

function clampScore(n: unknown) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v) || v < 1 || v > 5) return null;
  return v;
}

export async function getOrderSurveyState(orderId: string, userId: string) {
  await ensureReady();
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: {
      items: {
        select: {
          productId: true,
          productTitle: true,
          quantity: true,
          unitPrice: true,
        },
      },
    },
  });
  if (!order) return null;

  const surveyRows = await prisma.$queryRaw<Array<{ id: string; review_bonus_awarded: boolean }>>`
    SELECT id, review_bonus_awarded FROM order_surveys WHERE order_id = ${orderId} LIMIT 1
  `;
  const survey = surveyRows[0] || null;

  const productIds = [...new Set(order.items.map((i) => i.productId))];
  const reviews = productIds.length
    ? await prisma.productReview.findMany({
        where: { userId, productId: { in: productIds } },
        select: {
          productId: true,
          id: true,
          status: true,
          rating: true,
          title: true,
          body: true,
          orderId: true,
          imageUrls: true,
        },
      })
    : [];
  const byProduct = new Map(reviews.map((r) => [r.productId, r]));

  const items = order.items.map((i) => {
    const rev = byProduct.get(i.productId);
    const updatedForThisOrder = Boolean(rev && rev.orderId === orderId);
    return {
      productId: i.productId,
      productTitle: i.productTitle,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      reviewed: Boolean(rev),
      updatedForThisOrder,
      canEdit: true,
      reviewStatus: rev?.status ?? null,
      existingReview: rev
        ? {
            id: rev.id,
            rating: rev.rating,
            title: rev.title,
            body: rev.body,
            imageUrls: (rev as { imageUrls?: string[] }).imageUrls ?? [],
            status: rev.status,
          }
        : null,
    };
  });

  // Still needs action if never reviewed, or not yet updated for this delivered order.
  const pendingReviewCount = productIds.filter((id) => {
    const rev = byProduct.get(id);
    return !rev || rev.orderId !== orderId;
  }).length;

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    isDelivered: order.status === 'delivered' || order.status === 'returned',
    surveyCompleted: Boolean(survey),
    reviewBonusAwarded: Boolean(survey?.review_bonus_awarded),
    items,
    pendingReviewCount,
  };
}

export async function submitOrderSurvey(orderId: string, userId: string, payload: SurveyPayload) {
  await ensureReady();
  const order = await prisma.order.findFirst({ where: { id: orderId, userId } });
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (order.status !== 'delivered' && order.status !== 'returned') {
    throw Object.assign(new Error('Survey available after delivery'), { status: 400 });
  }

  const productSatisfaction = clampScore(payload.productSatisfaction);
  const serviceSatisfaction = clampScore(payload.serviceSatisfaction);
  const paymentConvenience = clampScore(payload.paymentConvenience);
  const deliveryExperience = clampScore(payload.deliveryExperience);
  const codExperience =
    String(order.paymentMethod || '').toLowerCase() === 'cod'
      ? clampScore(payload.codExperience)
      : null;

  if (!productSatisfaction || !serviceSatisfaction || !paymentConvenience || !deliveryExperience) {
    throw Object.assign(new Error('All required ratings must be 1–5'), { status: 400 });
  }
  if (String(order.paymentMethod || '').toLowerCase() === 'cod' && !codExperience) {
    throw Object.assign(new Error('COD experience rating required'), { status: 400 });
  }

  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM order_surveys WHERE order_id = ${orderId} LIMIT 1
  `;
  if (existing[0]) {
    return getOrderSurveyState(orderId, userId);
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO order_surveys
      (id, order_id, user_id, product_satisfaction, service_satisfaction, payment_convenience,
       cod_experience, delivery_experience, comments, completed_at, review_bonus_awarded)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),FALSE)`,
    generateId(),
    orderId,
    userId,
    productSatisfaction,
    serviceSatisfaction,
    paymentConvenience,
    codExperience,
    deliveryExperience,
    payload.comments ? String(payload.comments).slice(0, 2000) : null,
  );

  return getOrderSurveyState(orderId, userId);
}

/** Award +5 OB once when customer reviews/edits a product from a surveyed delivered order. */
export async function maybeAwardReviewBonus(userId: string, orderId: string | null | undefined) {
  if (!orderId) return { awarded: false, points: 0 };
  await ensureReady();
  const rows = await prisma.$queryRaw<Array<{ id: string; review_bonus_awarded: boolean }>>`
    SELECT id, review_bonus_awarded FROM order_surveys WHERE order_id = ${orderId} AND user_id = ${userId} LIMIT 1
  `;
  const survey = rows[0];
  if (!survey || survey.review_bonus_awarded) {
    // #region agent log
    {
      const payload = {
        sessionId: '1eb282',
        runId: 'review-edit',
        hypothesisId: 'H-BONUS-GATE',
        location: 'orderSurveyService.ts:maybeAwardReviewBonus',
        message: 'bonus skipped',
        data: {
          hasSurvey: Boolean(survey),
          alreadyAwarded: Boolean(survey?.review_bonus_awarded),
          hasOrderId: Boolean(orderId),
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
    return { awarded: false, points: 0 };
  }

  await adminAdjustPoints(userId, 5, `Product review bonus for order ${orderId}`);
  await prisma.$executeRaw`
    UPDATE order_surveys SET review_bonus_awarded = TRUE WHERE id = ${survey.id}
  `;
  // #region agent log
  {
    const payload = {
      sessionId: '1eb282',
      runId: 'review-edit',
      hypothesisId: 'H-BONUS-GATE',
      location: 'orderSurveyService.ts:maybeAwardReviewBonus',
      message: 'bonus awarded',
      data: { points: 5, hasOrderId: true },
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
  return { awarded: true, points: 5 };
}
