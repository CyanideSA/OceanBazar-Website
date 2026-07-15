-- OceanBazar Unified Commerce System schema additions

ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "channel" VARCHAR(20) NOT NULL DEFAULT 'web';
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "bot_context" JSONB;

CREATE INDEX IF NOT EXISTS "idx_chat_sessions_channel" ON "chat_sessions"("channel");

CREATE TABLE IF NOT EXISTS "email_templates" (
    "id" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(500) NOT NULL,
    "body_html" TEXT NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "variables" JSONB,
    "updated_by" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_email_templates_category" ON "email_templates"("category");

CREATE TABLE IF NOT EXISTS "email_drafts" (
    "id" VARCHAR(255) NOT NULL,
    "mailbox" VARCHAR(255) NOT NULL,
    "to_address" VARCHAR(500) NOT NULL,
    "cc" VARCHAR(500),
    "bcc" VARCHAR(500),
    "subject" VARCHAR(500),
    "body_html" TEXT,
    "attachments" JSONB,
    "created_by" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_drafts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_email_drafts_mailbox" ON "email_drafts"("mailbox");
CREATE INDEX IF NOT EXISTS "idx_email_drafts_created_by" ON "email_drafts"("created_by");

CREATE TABLE IF NOT EXISTS "meta_accounts" (
    "id" VARCHAR(255) NOT NULL,
    "page_id" VARCHAR(100) NOT NULL,
    "ig_id" VARCHAR(100),
    "page_access_token" TEXT,
    "ad_account_id" VARCHAR(100),
    "catalog_id" VARCHAR(100),
    "verify_token" VARCHAR(255),
    "status" VARCHAR(30) NOT NULL DEFAULT 'disconnected',
    "connected_by" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meta_accounts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_meta_accounts_page_id" ON "meta_accounts"("page_id");
CREATE INDEX IF NOT EXISTS "idx_meta_accounts_status" ON "meta_accounts"("status");

CREATE TABLE IF NOT EXISTS "meta_threads" (
    "id" VARCHAR(255) NOT NULL,
    "platform" VARCHAR(20) NOT NULL,
    "platform_user_id" VARCHAR(255) NOT NULL,
    "chat_session_id" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meta_threads_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "meta_threads_chat_session_id_fkey" FOREIGN KEY ("chat_session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_meta_threads_platform_user" ON "meta_threads"("platform", "platform_user_id");
CREATE INDEX IF NOT EXISTS "idx_meta_threads_session" ON "meta_threads"("chat_session_id");

CREATE TABLE IF NOT EXISTS "meta_webhook_events" (
    "id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meta_webhook_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_meta_webhook_events_type" ON "meta_webhook_events"("event_type");
CREATE INDEX IF NOT EXISTS "idx_meta_webhook_events_processed" ON "meta_webhook_events"("processed");

CREATE TABLE IF NOT EXISTS "meta_posts" (
    "id" VARCHAR(255) NOT NULL,
    "account_id" VARCHAR(255),
    "post_type" VARCHAR(20) NOT NULL,
    "caption" TEXT,
    "media_urls" JSONB,
    "scheduled_at" TIMESTAMPTZ(6),
    "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
    "external_post_id" VARCHAR(255),
    "error" TEXT,
    "created_by" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meta_posts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_meta_posts_status" ON "meta_posts"("status");
CREATE INDEX IF NOT EXISTS "idx_meta_posts_scheduled" ON "meta_posts"("scheduled_at");

CREATE TABLE IF NOT EXISTS "meta_ad_campaigns" (
    "id" VARCHAR(255) NOT NULL,
    "account_id" VARCHAR(255),
    "name" VARCHAR(255) NOT NULL,
    "objective" VARCHAR(100) NOT NULL,
    "budget" DECIMAL(12,2),
    "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
    "external_campaign_id" VARCHAR(255),
    "created_by" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meta_ad_campaigns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_meta_ad_campaigns_status" ON "meta_ad_campaigns"("status");
