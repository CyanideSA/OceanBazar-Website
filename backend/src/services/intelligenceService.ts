import { Prisma } from '@prisma/client';
import { forecastSales, isMlConfigured, type ForecastResponse } from './mlClient';
import { prisma } from '../lib/prisma';


// ─── Churn / LTV ──────────────────────────────────────────────────────────────

export async function getChurnList(opts: { limit?: number; minScore?: number } = {}) {
  const take = Math.min(opts.limit ?? 50, 200);
  const preds = await prisma.mlPrediction.findMany({
    where: {
      subjectType: 'customer',
      ...(opts.minScore != null ? { churnScore: { gte: new Prisma.Decimal(opts.minScore) } } : {}),
    },
    orderBy: { churnScore: 'desc' },
    take,
  });
  const ids = preds.map((p) => p.subjectId);
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true, lifetimeSpend: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));
  return preds.map((p) => ({
    customerId: p.subjectId,
    name: userMap.get(p.subjectId)?.name ?? '—',
    email: userMap.get(p.subjectId)?.email ?? null,
    churnScore: Number(p.churnScore ?? 0),
    predictedLtv: Number(p.predictedLtv ?? 0),
    segment: p.segment,
    lifetimeSpend: Number(userMap.get(p.subjectId)?.lifetimeSpend ?? 0),
    computedAt: p.computedAt,
  }));
}

export async function getSegments() {
  const groups = await prisma.mlPrediction.groupBy({
    by: ['segment'],
    where: { subjectType: 'customer' },
    _count: { _all: true },
    _avg: { churnScore: true, predictedLtv: true },
  });
  return groups
    .map((g) => ({
      segment: g.segment ?? 'unknown',
      customers: g._count._all,
      avgChurn: Number(g._avg.churnScore ?? 0),
      avgPredictedLtv: Number(g._avg.predictedLtv ?? 0),
    }))
    .sort((a, b) => b.customers - a.customers);
}

export async function getClv(opts: { limit?: number } = {}) {
  const take = Math.min(opts.limit ?? 20, 100);
  const preds = await prisma.mlPrediction.findMany({
    where: { subjectType: 'customer', predictedLtv: { not: null } },
    orderBy: { predictedLtv: 'desc' },
    take,
  });
  const ids = preds.map((p) => p.subjectId);
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } });
  const userMap = new Map(users.map((u) => [u.id, u]));
  const agg = await prisma.mlPrediction.aggregate({
    where: { subjectType: 'customer', predictedLtv: { not: null } },
    _avg: { predictedLtv: true },
    _sum: { predictedLtv: true },
    _count: { _all: true },
  });
  return {
    avgLtv: Number(agg._avg.predictedLtv ?? 0),
    totalPredictedLtv: Number(agg._sum.predictedLtv ?? 0),
    scoredCustomers: agg._count._all,
    top: preds.map((p) => ({
      customerId: p.subjectId,
      name: userMap.get(p.subjectId)?.name ?? '—',
      predictedLtv: Number(p.predictedLtv ?? 0),
      churnScore: Number(p.churnScore ?? 0),
      segment: p.segment,
    })),
  };
}

// ─── Cohorts (monthly signup retention) ────────────────────────────────────────

export async function getCohorts() {
  const rows = await prisma.$queryRaw<Array<{
    cohort: string; customers: bigint; purchasers: bigint; revenue: Prisma.Decimal;
  }>>`
    SELECT to_char(date_trunc('month', u.created_at), 'YYYY-MM') AS cohort,
           COUNT(DISTINCT u.id) AS customers,
           COUNT(DISTINCT o.user_id) FILTER (WHERE o.payment_status = 'paid') AS purchasers,
           COALESCE(SUM(o.total) FILTER (WHERE o.payment_status = 'paid'), 0) AS revenue
    FROM users u
    LEFT JOIN orders o ON o.user_id = u.id
    GROUP BY 1
    ORDER BY 1 DESC
    LIMIT 12
  `;
  return rows
    .map((r) => {
      const customers = Number(r.customers);
      const purchasers = Number(r.purchasers);
      return {
        cohort: r.cohort,
        customers,
        purchasers,
        conversionRate: customers ? Math.round((purchasers / customers) * 1000) / 10 : 0,
        revenue: Number(r.revenue),
      };
    })
    .reverse();
}

// ─── Sales forecast (ML with local fallback) ───────────────────────────────────

async function localForecast(horizon: number): Promise<ForecastResponse> {
  const rows = await prisma.$queryRaw<Array<{ ds: Date; y: Prisma.Decimal }>>`
    SELECT DATE(created_at) AS ds, COALESCE(SUM(total), 0) AS y
    FROM orders
    WHERE payment_status = 'paid' AND created_at >= NOW() - INTERVAL '90 days'
    GROUP BY DATE(created_at)
    ORDER BY ds
  `;
  const values = rows.map((r) => Number(r.y));
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const variance = values.length
    ? values.reduce((a, b) => a + (b - avg) ** 2, 0) / values.length
    : 0;
  const sigma = Math.sqrt(variance);
  const points = Array.from({ length: horizon }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return {
      date: d.toISOString().slice(0, 10),
      predicted_revenue: Math.round(avg * 100) / 100,
      lower: Math.round(Math.max(0, avg - 1.96 * sigma) * 100) / 100,
      upper: Math.round((avg + 1.96 * sigma) * 100) / 100,
    };
  });
  return {
    method: 'local_moving_average',
    horizon_days: horizon,
    history_points: values.length,
    total_predicted: Math.round(avg * horizon * 100) / 100,
    points,
  };
}

export async function getForecast(horizon = 30): Promise<ForecastResponse> {
  if (isMlConfigured()) {
    try {
      return await forecastSales({ horizon_days: horizon, history_days: 180 });
    } catch {
      return localForecast(horizon);
    }
  }
  return localForecast(horizon);
}

// ─── Abandoned carts ────────────────────────────────────────────────────────

export async function getAbandonedCarts(limit = 50) {
  const rows = await prisma.cart_abandonment_reminders.findMany({
    orderBy: { sent_at: 'desc' },
    take: Math.min(limit, 200),
  });
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } });
  const userMap = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: userMap.get(r.user_id)?.name ?? '—',
    email: userMap.get(r.user_id)?.email ?? null,
    reminderType: r.reminder_type,
    sentAt: r.sent_at,
  }));
}

// ─── Demand / restock (from ml_predictions products) ───────────────────────────

export async function getRestockSuggestions(limit = 20) {
  const preds = await prisma.mlPrediction.findMany({
    where: { subjectType: 'product', demandScore: { not: null } },
    orderBy: { demandScore: 'desc' },
    take: Math.min(limit, 100),
  });
  const ids = preds.map((p) => p.subjectId);
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, titleEn: true, stock: true },
  });
  const pmap = new Map(products.map((p) => [p.id, p]));
  return preds.map((p) => ({
    productId: p.subjectId,
    title: pmap.get(p.subjectId)?.titleEn ?? '—',
    stock: pmap.get(p.subjectId)?.stock ?? 0,
    demandScore: Number(p.demandScore ?? 0),
    dailyRate: Number((p.features as any)?.daily_rate ?? 0),
  }));
}

// ─── Dashboard insights panel ───────────────────────────────────────────────

export async function getInsights() {
  const settled = await Promise.allSettled([
    getChurnList({ limit: 5, minScore: 0.6 }),
    getSegments(),
    getForecast(7),
    getRestockSuggestions(5),
    getAbandonedCarts(5),
  ]);
  const churn = settled[0].status === 'fulfilled' ? settled[0].value : [];
  const segments = settled[1].status === 'fulfilled' ? settled[1].value : [];
  const forecast = settled[2].status === 'fulfilled' ? settled[2].value : { points: [], method: 'unavailable' as const };
  const restock = settled[3].status === 'fulfilled' ? settled[3].value : [];
  const abandoned = settled[4].status === 'fulfilled' ? settled[4].value : [];
  const next7 = (forecast.points || []).reduce((s: number, p: { predicted_revenue: number }) => s + p.predicted_revenue, 0);
  return {
    atRiskCustomers: churn,
    segments,
    forecastNext7Days: Math.round(next7 * 100) / 100,
    forecastMethod: forecast.method,
    restockSuggestions: (restock || []).filter((r: { stock: number; demandScore: number }) => r.stock <= 10 || r.demandScore >= 60),
    recentAbandonedCarts: abandoned,
    mlConfigured: isMlConfigured(),
    partialErrors: settled
      .map((r, i) => (r.status === 'rejected' ? { index: i, error: String((r.reason as Error)?.message || r.reason).slice(0, 120) } : null))
      .filter(Boolean),
  };
}

// ─── Customer communication timeline ───────────────────────────────────────────

export async function getCustomerTimeline(customerId: string) {
  const logs = await prisma.communicationLog.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const prediction = await prisma.mlPrediction.findUnique({
    where: { subjectType_subjectId: { subjectType: 'customer', subjectId: customerId } },
  });
  return {
    prediction: prediction
      ? {
          churnScore: Number(prediction.churnScore ?? 0),
          predictedLtv: Number(prediction.predictedLtv ?? 0),
          segment: prediction.segment,
          computedAt: prediction.computedAt,
        }
      : null,
    timeline: logs,
  };
}
