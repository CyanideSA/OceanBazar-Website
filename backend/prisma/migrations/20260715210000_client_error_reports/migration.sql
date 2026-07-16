-- Client error reports from storefront (admin investigation)
CREATE TABLE IF NOT EXISTS client_error_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  digest VARCHAR(128),
  message TEXT,
  stack TEXT,
  url VARCHAR(2048),
  user_agent VARCHAR(512),
  locale VARCHAR(8),
  snapshot JSONB,
  ip_hash VARCHAR(64),
  reviewed_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS client_error_reports_created_at_idx ON client_error_reports (created_at DESC);
