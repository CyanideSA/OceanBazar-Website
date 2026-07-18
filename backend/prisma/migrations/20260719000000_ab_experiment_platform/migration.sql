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
);

ALTER TABLE ab_impressions
  ADD COLUMN IF NOT EXISTS event_type VARCHAR(100) NOT NULL DEFAULT 'impression',
  ADD COLUMN IF NOT EXISTS event_value NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ab_event_idempotency
  ON ab_impressions(test_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ab_events_metric
  ON ab_impressions(test_id, variant, event_type, created_at);
