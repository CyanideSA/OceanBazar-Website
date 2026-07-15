-- ============================================================
-- OceanBazar Manual Migration: New Tables
-- Run once against your PostgreSQL database:
--   psql $DATABASE_URL -f prisma/migrations/manual_new_tables.sql
-- Or via the Prisma migration tool:
--   npx prisma db push
-- ============================================================

-- Push Notification Subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          VARCHAR(255) PRIMARY KEY,
  user_id     CHAR(8)      NOT NULL,
  endpoint    TEXT         NOT NULL UNIQUE,
  p256dh      TEXT         NOT NULL,
  auth        VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);

-- Referral Codes (one per user)
CREATE TABLE IF NOT EXISTS referral_codes (
  id            CHAR(8)   PRIMARY KEY,
  user_id       CHAR(8)   NOT NULL UNIQUE,
  code          CHAR(10)  NOT NULL UNIQUE,
  click_count   INT       NOT NULL DEFAULT 0,
  signup_count  INT       NOT NULL DEFAULT 0,
  earned_points INT       NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes (code);

-- Referral Events (history of signups/purchases attributed to referrals)
CREATE TABLE IF NOT EXISTS referral_events (
  id              VARCHAR(255) PRIMARY KEY,
  referrer_id     CHAR(8)   NOT NULL,
  referred_id     CHAR(8)   NOT NULL,
  code            CHAR(10)  NOT NULL,
  event           VARCHAR(50) NOT NULL,  -- 'signup' | 'first_purchase'
  points_awarded  INT       NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_referral_events_referrer ON referral_events (referrer_id);

-- A/B Test Impressions & Conversions
CREATE TABLE IF NOT EXISTS ab_impressions (
  id          VARCHAR(255) PRIMARY KEY,
  test_id     VARCHAR(100) NOT NULL,
  variant     CHAR(1)      NOT NULL,   -- 'A' or 'B'
  user_id     CHAR(8)      NULL,
  session_id  VARCHAR(255) NULL,
  converted   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ab_impressions_test ON ab_impressions (test_id, variant);
CREATE INDEX IF NOT EXISTS idx_ab_impressions_user ON ab_impressions (test_id, user_id);
