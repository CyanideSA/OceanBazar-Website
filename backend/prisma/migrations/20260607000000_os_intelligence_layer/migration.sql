-- OceanBazar OS v1.0 — Enterprise Intelligence Layer (Phase A)
-- SEO automation, ML predictions, sales pipeline CRM, unified communication log,
-- marketing automation journeys, and predictive customer columns.

-- ─── Enums ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "DealStatus" AS ENUM ('open', 'won', 'lost');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CommChannel" AS ENUM ('email', 'sms', 'chat', 'call', 'push', 'note');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CommDirection" AS ENUM ('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'active', 'paused', 'completed', 'archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "EnrollmentStatus" AS ENUM ('active', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── Customer predictive columns ─────────────────────────────────────────────
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "churn_risk_score" NUMERIC(5, 4);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "predicted_ltv" NUMERIC(12, 2);

-- ─── SEO metadata ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "seo_metadata" (
  "id" VARCHAR(255) PRIMARY KEY,
  "entity_type" VARCHAR(32) NOT NULL,
  "entity_id" VARCHAR(64) NOT NULL,
  "locale" VARCHAR(8) NOT NULL DEFAULT 'en',
  "meta_title" VARCHAR(255),
  "meta_description" VARCHAR(500),
  "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "canonical_url" VARCHAR(500),
  "og_title" VARCHAR(255),
  "og_description" VARCHAR(500),
  "og_image" VARCHAR(500),
  "schema_json" JSONB,
  "faq" JSONB,
  "content_blocks" JSONB,
  "internal_links" JSONB,
  "seo_score" INTEGER,
  "source" VARCHAR(20) NOT NULL DEFAULT 'manual',
  "generated_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "seo_metadata_entity_type_entity_id_locale_key"
  ON "seo_metadata" ("entity_type", "entity_id", "locale");
CREATE INDEX IF NOT EXISTS "seo_metadata_entity_type_entity_id_idx"
  ON "seo_metadata" ("entity_type", "entity_id");

-- ─── ML predictions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ml_predictions" (
  "id" VARCHAR(255) PRIMARY KEY,
  "subject_type" VARCHAR(32) NOT NULL,
  "subject_id" VARCHAR(64) NOT NULL,
  "churn_score" NUMERIC(5, 4),
  "predicted_ltv" NUMERIC(12, 2),
  "demand_score" NUMERIC(10, 4),
  "segment" VARCHAR(64),
  "features" JSONB,
  "model_version" VARCHAR(40) NOT NULL,
  "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ml_predictions_subject_type_subject_id_key"
  ON "ml_predictions" ("subject_type", "subject_id");
CREATE INDEX IF NOT EXISTS "ml_predictions_subject_type_churn_score_idx"
  ON "ml_predictions" ("subject_type", "churn_score");

-- ─── Sales pipeline CRM ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "sales_pipelines" (
  "id" VARCHAR(255) PRIMARY KEY,
  "name" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "pipeline_stages" (
  "id" VARCHAR(255) PRIMARY KEY,
  "pipeline_id" VARCHAR(255) NOT NULL REFERENCES "sales_pipelines"("id") ON DELETE CASCADE,
  "name" VARCHAR(120) NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "win_probability" INTEGER NOT NULL DEFAULT 0,
  "is_won" BOOLEAN NOT NULL DEFAULT false,
  "is_lost" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "pipeline_stages_pipeline_id_position_idx"
  ON "pipeline_stages" ("pipeline_id", "position");

CREATE TABLE IF NOT EXISTS "deals" (
  "id" VARCHAR(255) PRIMARY KEY,
  "pipeline_id" VARCHAR(255) NOT NULL REFERENCES "sales_pipelines"("id"),
  "stage_id" VARCHAR(255) NOT NULL REFERENCES "pipeline_stages"("id"),
  "customer_id" CHAR(8),
  "title" VARCHAR(255) NOT NULL,
  "value" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "currency" VARCHAR(8) NOT NULL DEFAULT 'BDT',
  "status" "DealStatus" NOT NULL DEFAULT 'open',
  "owner_admin_id" INTEGER,
  "expected_close_at" TIMESTAMPTZ(6),
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "deals_pipeline_id_stage_id_idx" ON "deals" ("pipeline_id", "stage_id");
CREATE INDEX IF NOT EXISTS "deals_customer_id_idx" ON "deals" ("customer_id");

-- ─── Unified communication log ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "communication_logs" (
  "id" VARCHAR(255) PRIMARY KEY,
  "customer_id" CHAR(8),
  "channel" "CommChannel" NOT NULL,
  "direction" "CommDirection" NOT NULL DEFAULT 'outbound',
  "subject" VARCHAR(500),
  "body" TEXT,
  "from_address" VARCHAR(255),
  "to_address" VARCHAR(255),
  "status" VARCHAR(30) NOT NULL DEFAULT 'sent',
  "provider" VARCHAR(40),
  "external_id" VARCHAR(255),
  "ref_type" VARCHAR(40),
  "ref_id" VARCHAR(64),
  "admin_id" INTEGER,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "communication_logs_customer_id_created_at_idx"
  ON "communication_logs" ("customer_id", "created_at");
CREATE INDEX IF NOT EXISTS "communication_logs_channel_created_at_idx"
  ON "communication_logs" ("channel", "created_at");

-- ─── Marketing automation ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "marketing_campaigns" (
  "id" VARCHAR(255) PRIMARY KEY,
  "name" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "channel" "CommChannel" NOT NULL DEFAULT 'email',
  "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
  "audience" JSONB,
  "trigger_type" VARCHAR(40) NOT NULL,
  "trigger_config" JSONB,
  "created_by_admin_id" INTEGER,
  "starts_at" TIMESTAMPTZ(6),
  "ends_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "marketing_campaigns_status_idx" ON "marketing_campaigns" ("status");

CREATE TABLE IF NOT EXISTS "campaign_steps" (
  "id" VARCHAR(255) PRIMARY KEY,
  "campaign_id" VARCHAR(255) NOT NULL REFERENCES "marketing_campaigns"("id") ON DELETE CASCADE,
  "position" INTEGER NOT NULL DEFAULT 0,
  "channel" "CommChannel" NOT NULL DEFAULT 'email',
  "delay_hours" INTEGER NOT NULL DEFAULT 0,
  "subject" VARCHAR(500),
  "body" TEXT,
  "metadata" JSONB
);
CREATE INDEX IF NOT EXISTS "campaign_steps_campaign_id_position_idx"
  ON "campaign_steps" ("campaign_id", "position");

CREATE TABLE IF NOT EXISTS "campaign_enrollments" (
  "id" VARCHAR(255) PRIMARY KEY,
  "campaign_id" VARCHAR(255) NOT NULL REFERENCES "marketing_campaigns"("id") ON DELETE CASCADE,
  "customer_id" CHAR(8) NOT NULL,
  "current_step" INTEGER NOT NULL DEFAULT 0,
  "status" "EnrollmentStatus" NOT NULL DEFAULT 'active',
  "next_run_at" TIMESTAMPTZ(6),
  "enrolled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(6)
);
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_enrollments_campaign_id_customer_id_key"
  ON "campaign_enrollments" ("campaign_id", "customer_id");
CREATE INDEX IF NOT EXISTS "campaign_enrollments_status_next_run_at_idx"
  ON "campaign_enrollments" ("status", "next_run_at");
