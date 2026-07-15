-- ============================================================
-- OceanBazar Prisma Migration: 20260505000000_push_referral_ab
-- Adds push_subscriptions, referral_codes, referral_events,
-- and ab_impressions tables (Tasks 1, 8, 9 / Task 10c).
--
-- Apply options:
--   Option A (Prisma managed):  npx prisma migrate dev --name push_referral_ab
--   Option B (direct SQL):      psql $DATABASE_URL -f this_file.sql
--   Option C (Prisma push):     npx prisma db push
-- ============================================================

-- ─── Push Notification Subscriptions (Task 1) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          VARCHAR(255) PRIMARY KEY,
  user_id     CHAR(8)      NOT NULL,
  endpoint    TEXT         NOT NULL UNIQUE,
  p256dh      TEXT         NOT NULL,
  auth        VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON push_subscriptions (user_id);

-- ─── Referral / Affiliate System (Task 8) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_codes (
  id            CHAR(8)      PRIMARY KEY,
  user_id       CHAR(8)      NOT NULL UNIQUE,
  code          CHAR(10)     NOT NULL UNIQUE,
  click_count   INT          NOT NULL DEFAULT 0,
  signup_count  INT          NOT NULL DEFAULT 0,
  earned_points INT          NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_code
  ON referral_codes (code);

CREATE TABLE IF NOT EXISTS referral_events (
  id              VARCHAR(255) PRIMARY KEY,
  referrer_id     CHAR(8)      NOT NULL,
  referred_id     CHAR(8)      NOT NULL,
  code            CHAR(10)     NOT NULL,
  event           VARCHAR(50)  NOT NULL,   -- 'signup' | 'first_purchase'
  points_awarded  INT          NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_events_referrer
  ON referral_events (referrer_id);

-- ─── A/B Test Impressions & Conversions (Task 9) ──────────────────────────────
CREATE TABLE IF NOT EXISTS ab_impressions (
  id          VARCHAR(255) PRIMARY KEY,
  test_id     VARCHAR(100) NOT NULL,
  variant     CHAR(1)      NOT NULL,        -- 'A' or 'B'
  user_id     CHAR(8)      NULL,
  session_id  VARCHAR(255) NULL,
  converted   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ab_impressions_test
  ON ab_impressions (test_id, variant);

CREATE INDEX IF NOT EXISTS idx_ab_impressions_user
  ON ab_impressions (test_id, user_id);
