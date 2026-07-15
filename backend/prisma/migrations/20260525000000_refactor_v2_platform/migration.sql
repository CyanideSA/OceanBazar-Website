-- Phase 4/6/7: platform refactor — RBAC, DLQ, analytics schema

ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'warehouse';
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'support';
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'finance';
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'viewer';

CREATE TABLE IF NOT EXISTS "admin_sessions" (
  "id" SERIAL PRIMARY KEY,
  "admin_id" INTEGER NOT NULL REFERENCES "admin_users"("id") ON DELETE CASCADE,
  "device_id" VARCHAR(128) NOT NULL,
  "user_agent" TEXT,
  "ip_address" VARCHAR(64),
  "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMPTZ(6),
  UNIQUE ("admin_id", "device_id")
);

CREATE INDEX IF NOT EXISTS "admin_sessions_admin_id_last_seen_at_idx"
  ON "admin_sessions" ("admin_id", "last_seen_at");

CREATE TABLE IF NOT EXISTS "failed_events" (
  "id" SERIAL PRIMARY KEY,
  "event_id" VARCHAR(64) NOT NULL UNIQUE,
  "event_type" VARCHAR(64) NOT NULL,
  "payload" JSONB NOT NULL,
  "error_message" TEXT NOT NULL,
  "error_stack" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "next_retry_at" TIMESTAMPTZ(6) NOT NULL,
  "resolved_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "failed_events_resolved_next_retry_idx"
  ON "failed_events" ("resolved_at", "next_retry_at");

CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.event_log (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(64) NOT NULL,
  aggregate_id VARCHAR(64),
  user_id CHAR(8),
  payload JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.sales_daily AS
SELECT
  DATE(o.created_at) AS day,
  COUNT(*)::bigint AS order_count,
  COALESCE(SUM(o.total), 0)::numeric(14,2) AS revenue
FROM orders o
WHERE o.status NOT IN ('cancelled', 'failed')
GROUP BY DATE(o.created_at)
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS sales_daily_day_uidx ON analytics.sales_daily (day);

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.top_products AS
SELECT
  oi.product_id,
  SUM(oi.quantity)::bigint AS units_sold,
  COALESCE(SUM(oi.line_total), 0)::numeric(14,2) AS revenue
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE o.status NOT IN ('cancelled', 'failed')
GROUP BY oi.product_id
WITH NO DATA;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.customer_segments AS
SELECT
  u.user_type,
  COUNT(*)::bigint AS customers,
  COALESCE(SUM(u.lifetime_spend), 0)::numeric(14,2) AS lifetime_spend
FROM users u
GROUP BY u.user_type
WITH NO DATA;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.inventory_velocity AS
SELECT
  p.id AS product_id,
  p.stock AS stock_qty,
  COALESCE(SUM(oi.quantity), 0)::bigint AS sold_30d
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
LEFT JOIN orders o ON o.id = oi.order_id AND o.created_at >= NOW() - INTERVAL '30 days'
GROUP BY p.id, p.stock
WITH NO DATA;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.ob_points_report AS
SELECT
  DATE(l.created_at) AS day,
  l.type,
  COUNT(*)::bigint AS entries,
  COALESCE(SUM(l.points), 0)::bigint AS points_sum
FROM ob_points_ledger l
GROUP BY DATE(l.created_at), l.type
WITH NO DATA;
