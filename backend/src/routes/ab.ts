/**
 * OceanBazar experimentation API.
 * Public: active config + exposure/outcome events.
 * Admin: lifecycle controls + statistically guarded results.
 */
import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';
import { requireAdmin } from '../middleware/auth';

const router = Router();
let schemaReady = false;

const EXPERIMENTS = [
  ['checkout-cta-v1', 'Checkout CTA', 1, 'checkout', 'payment_success', 'Place Order', 'Pay securely'],
  ['payment-order-v1', 'Payment method order', 1, 'checkout', 'payment_success', 'COD first', 'Online payment first'],
  ['price-display-v1', 'Product price display', 1, 'product', 'add_to_cart', 'Compact price', 'Savings emphasis'],
  ['ob-points-v1', 'OB Points redemption', 1, 'checkout', 'order_placed', 'Optional panel', 'Suggested savings'],
  ['hero-banner-v1', 'Homepage hero', 2, 'homepage', 'add_to_cart', 'Carousel', 'Focused authenticity'],
  ['shipping-badge-v1', 'Shipping promise', 2, 'storefront', 'begin_checkout', 'Free Shipping', 'Dhaka delivery promise'],
  ['flash-urgency-v1', 'Flash sale urgency', 2, 'flash_sale', 'add_to_cart', 'Standard countdown', 'Stock urgency'],
  ['coupon-discovery-v1', 'Coupon discovery', 2, 'checkout', 'order_placed', 'Coupon slider', 'Quiet coupon field'],
  ['pdp-audience-v1', 'PDP audience message', 3, 'product', 'add_to_cart', 'Retail-first', 'Retail + wholesale'],
  ['checkout-login-v1', 'Checkout login gate', 3, 'checkout', 'order_placed', 'Standard sign-in prompt', 'Benefit-led sign-in'],
  ['flash-scarcity-v1', 'Flash product scarcity', 3, 'flash_sale', 'add_to_cart', 'No unit count', 'Units-left message'],
] as const;

async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ab_tests (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      tier INT NOT NULL DEFAULT 1,
      surface VARCHAR(100) NOT NULL,
      primary_metric VARCHAR(100) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      traffic_allocation INT NOT NULL DEFAULT 100,
      variant_a JSONB NOT NULL DEFAULT '{}'::jsonb,
      variant_b JSONB NOT NULL DEFAULT '{}'::jsonb,
      started_at TIMESTAMPTZ,
      ended_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE ab_impressions ADD COLUMN IF NOT EXISTS event_type VARCHAR(100) NOT NULL DEFAULT 'impression'`);
  await prisma.$executeRawUnsafe(`ALTER TABLE ab_impressions ADD COLUMN IF NOT EXISTS event_value NUMERIC(14,2)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE ab_impressions ADD COLUMN IF NOT EXISTS metadata JSONB`);
  await prisma.$executeRawUnsafe(`ALTER TABLE ab_impressions ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255)`);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ab_event_idempotency
    ON ab_impressions(test_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_ab_events_metric
    ON ab_impressions(test_id, variant, event_type, created_at)
  `);
  for (const [id, name, tier, surface, metric, a, b] of EXPERIMENTS) {
    await prisma.$executeRaw`
      INSERT INTO ab_tests (id, name, tier, surface, primary_metric, variant_a, variant_b)
      VALUES (${id}, ${name}, ${tier}, ${surface}, ${metric},
        ${JSON.stringify({ label: a })}::jsonb, ${JSON.stringify({ label: b })}::jsonb)
      ON CONFLICT (id) DO NOTHING
    `;
  }
  schemaReady = true;
}

function variantValue(value: unknown): 'A' | 'B' | null {
  const normalized = String(value || '').toUpperCase();
  return normalized === 'A' || normalized === 'B' ? normalized : null;
}

function safeMetadata(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const entries = Object.entries(input as Record<string, unknown>).slice(0, 20);
  return Object.fromEntries(entries.map(([key, value]) => [
    key.slice(0, 50),
    typeof value === 'string' ? value.slice(0, 200) : value,
  ]));
}

async function isRunning(testId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ running: boolean }>>`
    SELECT (status = 'running') AS running FROM ab_tests WHERE id = ${testId} LIMIT 1
  `;
  return rows[0]?.running === true;
}

async function recordEvent(req: Request, body: {
  testId?: unknown;
  variant?: unknown;
  sessionId?: unknown;
  eventType?: unknown;
  value?: unknown;
  idempotencyKey?: unknown;
  metadata?: unknown;
}): Promise<{ accepted: boolean; reason?: string }> {
  await ensureSchema();
  const testId = String(body.testId || '').slice(0, 100);
  const variant = variantValue(body.variant);
  const eventType = String(body.eventType || 'conversion').slice(0, 100);
  if (!testId || !variant) return { accepted: false, reason: 'testId and A/B variant required' };
  if (!(await isRunning(testId))) return { accepted: false, reason: 'experiment_not_running' };

  const rawValue = Number(body.value);
  const value = Number.isFinite(rawValue) ? rawValue : null;
  const sessionId = String(body.sessionId || req.headers['x-session-id'] || '').slice(0, 255) || null;
  const idempotencyKey = String(body.idempotencyKey || '').slice(0, 255) || null;
  const metadata = safeMetadata(body.metadata);
  try {
    await prisma.$executeRaw`
      INSERT INTO ab_impressions (
        id, test_id, variant, user_id, session_id, converted,
        event_type, event_value, metadata, idempotency_key, created_at
      ) VALUES (
        ${uuidv4()}, ${testId}, ${variant}, ${req.user?.userId ?? null}, ${sessionId},
        ${eventType !== 'impression'}, ${eventType}, ${value},
        ${JSON.stringify(metadata)}::jsonb, ${idempotencyKey}, NOW()
      )
    `;
  } catch (error: any) {
    if (String(error?.message || '').includes('idx_ab_event_idempotency')) {
      return { accepted: false, reason: 'duplicate' };
    }
    throw error;
  }

  return { accepted: true };
}

router.get('/config', async (_req, res: Response) => {
  await ensureSchema();
  const rows = await prisma.$queryRaw<any[]>`
    SELECT id, name, tier, surface, primary_metric, traffic_allocation, variant_a, variant_b
    FROM ab_tests WHERE status = 'running' ORDER BY tier, id
  `;
  res.json({ experiments: rows });
});

router.post('/impression', async (req: Request, res: Response) => {
  try {
    const result = await recordEvent(req, { ...req.body, eventType: 'impression' });
    res.status(result.reason && result.reason !== 'duplicate' ? 202 : 200).json({ ok: true, ...result });
  } catch {
    res.json({ ok: true, accepted: false });
  }
});

router.post('/event', async (req: Request, res: Response) => {
  try {
    const result = await recordEvent(req, req.body || {});
    res.status(result.reason && result.reason !== 'duplicate' ? 202 : 200).json({ ok: true, ...result });
  } catch {
    res.json({ ok: true, accepted: false });
  }
});

router.post('/conversion', async (req: Request, res: Response) => {
  try {
    const result = await recordEvent(req, { ...req.body, eventType: req.body?.eventType || 'conversion' });
    res.status(result.reason && result.reason !== 'duplicate' ? 202 : 200).json({ ok: true, ...result });
  } catch {
    res.json({ ok: true, accepted: false });
  }
});

function normalCdf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

function significance(aConversions: number, aImpressions: number, bConversions: number, bImpressions: number) {
  if (!aImpressions || !bImpressions) return { pValue: null, confidence: 0, significant: false };
  const p1 = aConversions / aImpressions;
  const p2 = bConversions / bImpressions;
  const pooled = (aConversions + bConversions) / (aImpressions + bImpressions);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / aImpressions + 1 / bImpressions));
  if (!se) return { pValue: 1, confidence: 0, significant: false };
  const z = Math.abs(p2 - p1) / se;
  const pValue = 2 * (1 - normalCdf(z));
  return {
    pValue: Number(pValue.toFixed(4)),
    confidence: Number(((1 - pValue) * 100).toFixed(1)),
    significant: pValue < 0.05 && aImpressions >= 100 && bImpressions >= 100,
  };
}

router.get('/tests', requireAdmin, async (_req, res: Response) => {
  await ensureSchema();
  const tests = await prisma.$queryRaw<any[]>`SELECT * FROM ab_tests ORDER BY tier, created_at, id`;
  res.json({ tests });
});

router.patch('/tests/:id', requireAdmin, async (req: Request, res: Response) => {
  await ensureSchema();
  const id = String(req.params.id || '').slice(0, 100);
  const status = ['draft', 'running', 'paused', 'completed'].includes(req.body?.status)
    ? String(req.body.status)
    : null;
  const traffic = req.body?.trafficAllocation != null
    ? Math.min(100, Math.max(1, Number(req.body.trafficAllocation)))
    : null;
  const primaryMetric = req.body?.primaryMetric ? String(req.body.primaryMetric).slice(0, 100) : null;
  const variantA = req.body?.variantA ? safeMetadata(req.body.variantA) : null;
  const variantB = req.body?.variantB ? safeMetadata(req.body.variantB) : null;
  const rows = await prisma.$queryRaw<any[]>`
    UPDATE ab_tests SET
      status = COALESCE(${status}, status),
      traffic_allocation = COALESCE(${traffic}, traffic_allocation),
      primary_metric = COALESCE(${primaryMetric}, primary_metric),
      variant_a = COALESCE(${variantA ? JSON.stringify(variantA) : null}::jsonb, variant_a),
      variant_b = COALESCE(${variantB ? JSON.stringify(variantB) : null}::jsonb, variant_b),
      started_at = CASE WHEN ${status} = 'running' AND status != 'running' THEN NOW() ELSE started_at END,
      ended_at = CASE WHEN ${status} = 'completed' THEN NOW() ELSE ended_at END,
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  if (!rows.length) return res.status(404).json({ error: 'Experiment not found' });
  res.json({ test: rows[0] });
});

router.get('/stats', requireAdmin, async (_req, res: Response) => {
  await ensureSchema();
  const tests = await prisma.$queryRaw<any[]>`SELECT * FROM ab_tests ORDER BY tier, id`;
  const rows = await prisma.$queryRaw<any[]>`
    SELECT test_id, variant, event_type, COUNT(*)::int AS count,
      COALESCE(SUM(event_value), 0)::float AS value
    FROM ab_impressions GROUP BY test_id, variant, event_type
  `;
  const grouped: Record<string, any> = {};
  for (const test of tests) {
    const variants: Record<string, any> = {};
    for (const variant of ['A', 'B']) {
      const variantRows = rows.filter((row) => row.test_id === test.id && row.variant === variant);
      const impressions = Number(variantRows.find((row) => row.event_type === 'impression')?.count || 0);
      const outcomes = Number(variantRows.find((row) => row.event_type === test.primary_metric)?.count || 0);
      const revenue = variantRows.reduce((sum, row) => sum + Number(row.value || 0), 0);
      variants[variant] = {
        impressions,
        conversions: outcomes,
        rate: impressions ? `${((outcomes / impressions) * 100).toFixed(1)}%` : '0%',
        revenue,
        revenuePerVisitor: impressions ? Number((revenue / impressions).toFixed(2)) : 0,
      };
    }
    const stats = significance(variants.A.conversions, variants.A.impressions, variants.B.conversions, variants.B.impressions);
    const rateA = variants.A.impressions ? variants.A.conversions / variants.A.impressions : 0;
    const rateB = variants.B.impressions ? variants.B.conversions / variants.B.impressions : 0;
    grouped[test.id] = {
      ...test,
      A: variants.A,
      B: variants.B,
      ...stats,
      winner: stats.significant ? (rateB > rateA ? 'B' : rateA > rateB ? 'A' : null) : null,
      preliminaryLeader: rateB > rateA ? 'B' : rateA > rateB ? 'A' : null,
    };
  }
  res.json({ tests: grouped });
});

export default router;
