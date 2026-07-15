-- Align local Neon-restored DB with Prisma schema (safe to re-run).

-- Products (BFF admin catalog)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS pricing_mode VARCHAR(20) NOT NULL DEFAULT 'tiered';

-- Chat sessions (admin chat CRM)
ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'bot',
  ADD COLUMN IF NOT EXISTS agent_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS agent_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS agent_claimed_at TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS customer_issue VARCHAR(500),
  ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS customer_form JSONB,
  ADD COLUMN IF NOT EXISTS visitor_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions (status);

-- Analytics schema (cron / materialized views)
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
