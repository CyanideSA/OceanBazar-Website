-- Admin governance: custom role permissions, approval queue, admin avatars
CREATE TABLE IF NOT EXISTS admin_role_permissions (
  role VARCHAR(30) PRIMARY KEY,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS admin_pending_changes (
  id TEXT PRIMARY KEY,
  module VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  resource_id TEXT,
  resource_label TEXT,
  payload JSONB NOT NULL,
  summary TEXT NOT NULL,
  detail JSONB,
  requested_by TEXT NOT NULL,
  requested_by_name TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reviewed_by TEXT,
  review_note TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_pending_status ON admin_pending_changes(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_pending_module ON admin_pending_changes(module);

ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS profile_image TEXT;

-- Search logs are append-only (no DELETE policy enforced in app layer)
