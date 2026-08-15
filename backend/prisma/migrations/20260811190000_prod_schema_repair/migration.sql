-- Production schema repair: Prisma client expects columns/tables that were never applied.
-- All statements are idempotent.

-- 1) Admin chat + 2FA flags
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "chat_greeting" VARCHAR(500);
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "chat_quick_replies" JSONB;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "must_reset_two_fa" BOOLEAN NOT NULL DEFAULT FALSE;

-- 2) Products.brand (Prisma scalar — without this, EVERY product findMany fails)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "brand" VARCHAR(255);
ALTER TABLE "products" ALTER COLUMN "category_id" DROP NOT NULL;

-- 3) Product category map + metrics (admin products list includes productCategories)
CREATE TABLE IF NOT EXISTS "product_category_map" (
    "product_id"  CHAR(8)        NOT NULL,
    "category_id" CHAR(8)        NOT NULL,
    "is_primary"  BOOLEAN        NOT NULL DEFAULT FALSE,
    "sort_order"  INTEGER        NOT NULL DEFAULT 0,
    "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_category_map_pkey" PRIMARY KEY ("product_id", "category_id")
);
CREATE INDEX IF NOT EXISTS "idx_pcm_category" ON "product_category_map"("category_id");
CREATE INDEX IF NOT EXISTS "idx_pcm_product" ON "product_category_map"("product_id");
DO $$ BEGIN
  ALTER TABLE "product_category_map"
    ADD CONSTRAINT "product_category_map_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "product_category_map"
    ADD CONSTRAINT "product_category_map_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO "product_category_map" ("product_id", "category_id", "is_primary", "sort_order")
SELECT p."id", p."category_id", TRUE, 0
FROM "products" p
WHERE p."category_id" IS NOT NULL
ON CONFLICT ("product_id", "category_id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "product_metrics" (
    "product_id"          CHAR(8)        NOT NULL,
    "total_clicks"        BIGINT         NOT NULL DEFAULT 0,
    "total_orders"        INTEGER        NOT NULL DEFAULT 0,
    "total_quantity_sold" BIGINT         NOT NULL DEFAULT 0,
    "last_updated"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_metrics_pkey" PRIMARY KEY ("product_id")
);
DO $$ BEGIN
  ALTER TABLE "product_metrics"
    ADD CONSTRAINT "product_metrics_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) Tags
CREATE TABLE IF NOT EXISTS "tag_groups" (
    "id" SERIAL PRIMARY KEY,
    "name_en" VARCHAR(100) NOT NULL,
    "name_bn" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL UNIQUE,
    "sort_order" INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS "tags" (
    "id" SERIAL PRIMARY KEY,
    "group_id" INTEGER,
    "name_en" VARCHAR(100) NOT NULL,
    "name_bn" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL UNIQUE,
    "sort_order" INTEGER NOT NULL DEFAULT 0
);
DO $$ BEGIN
  ALTER TABLE "tags"
    ADD CONSTRAINT "tags_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "tag_groups"("id") ON UPDATE NO ACTION ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "product_tags" (
    "product_id" CHAR(8) NOT NULL,
    "tag_id" INTEGER NOT NULL,
    CONSTRAINT "product_tags_pkey" PRIMARY KEY ("product_id", "tag_id")
);
DO $$ BEGIN
  ALTER TABLE "product_tags"
    ADD CONSTRAINT "product_tags_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "product_tags"
    ADD CONSTRAINT "product_tags_tag_id_fkey"
    FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5) Trust badges
CREATE TABLE IF NOT EXISTS "trust_badge_catalog" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(120) NOT NULL,
    "name_bn" VARCHAR(120) NOT NULL,
    "icon" VARCHAR(50),
    "description" VARCHAR(255),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "trust_badge_catalog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "trust_badge_catalog_slug_key" ON "trust_badge_catalog"("slug");
CREATE TABLE IF NOT EXISTS "product_trust_badges" (
    "product_id" CHAR(8) NOT NULL,
    "badge_id" INTEGER NOT NULL,
    CONSTRAINT "product_trust_badges_pkey" PRIMARY KEY ("product_id", "badge_id")
);
CREATE INDEX IF NOT EXISTS "idx_product_trust_badges_badge" ON "product_trust_badges"("badge_id");
DO $$ BEGIN
  ALTER TABLE "product_trust_badges"
    ADD CONSTRAINT "product_trust_badges_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "product_trust_badges"
    ADD CONSTRAINT "product_trust_badges_badge_id_fkey"
    FOREIGN KEY ("badge_id") REFERENCES "trust_badge_catalog"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
INSERT INTO "trust_badge_catalog" ("slug", "name_en", "name_bn", "icon", "description", "sort_order", "active")
VALUES
  ('authentic', '100% authentic', '১০০% অথেন্টিক', 'shield', 'Verified genuine products', 0, true),
  ('verified-import', 'Verified import', 'যাচাইকৃত আমদানি', 'award', 'Sourced through OceanBazar channels', 1, true),
  ('quality-checked', 'Quality checked', 'কোয়ালিটি চেকড', 'check', 'Inspected before dispatch', 2, true),
  ('trusted-seller', 'OceanBazar trusted', 'OceanBazar ট্রাস্টেড', 'lock', 'Sold only by OceanBazar', 3, true)
ON CONFLICT ("slug") DO NOTHING;

-- 6) Orders delivery fee tracking
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "delivery_fee_paid" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "delivery_payment_status" VARCHAR(30) NOT NULL DEFAULT 'none';

-- 7) Pathao address fields
ALTER TABLE "saved_addresses"
  ADD COLUMN IF NOT EXISTS "pathao_city_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "pathao_zone_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "pathao_area_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "pathao_city_name" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "pathao_zone_name" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "pathao_area_name" VARCHAR(120);

-- 8) SSL dual-mode + compliance
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "sslcommerz_sandbox_store_id" VARCHAR(255);
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "sslcommerz_sandbox_store_password" VARCHAR(255);
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "sslcommerz_live_store_id" VARCHAR(255);
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "sslcommerz_live_store_password" VARCHAR(255);
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "sslcommerz_mode" VARCHAR(20) DEFAULT 'sandbox';
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "legal_name" VARCHAR(255);
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "trade_license_no" VARCHAR(100);
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "tin_number" VARCHAR(100);
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "registered_address" VARCHAR(1000);
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "management_details" VARCHAR(2000);
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "company_vision" TEXT;
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "leadership_intro" TEXT;
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "leadership_team" JSONB;

UPDATE "site_settings"
SET
  "sslcommerz_sandbox_store_id" = COALESCE("sslcommerz_sandbox_store_id", "sslcommerz_store_id"),
  "sslcommerz_sandbox_store_password" = COALESCE("sslcommerz_sandbox_store_password", "sslcommerz_store_password"),
  "sslcommerz_mode" = COALESCE("sslcommerz_mode", 'sandbox')
WHERE "id" = 'default';
