-- Idempotent catalog schema for Content-ID: categories, brands, content_drafts.
-- Safe on DBs where Flyway or partial Prisma baseline left gaps.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── categories ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "categories" (
    "id"          CHAR(8)        NOT NULL,
    "parent_id"   CHAR(8),
    "name_en"     VARCHAR(255)   NOT NULL,
    "name_bn"     VARCHAR(255)   NOT NULL,
    "slug"        VARCHAR(255)   NOT NULL,
    "icon"        VARCHAR(120),
    "image_url"   VARCHAR(500),
    "description" TEXT,
    "sort_order"  INTEGER        NOT NULL DEFAULT 0,
    "depth"       INTEGER        NOT NULL DEFAULT 0,
    "path"        TEXT           NOT NULL DEFAULT '',
    "is_leaf"     BOOLEAN        NOT NULL DEFAULT TRUE,
    "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "categories_pkey1" PRIMARY KEY ("id")
);

ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "parent_id"   CHAR(8);
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "name_en"     VARCHAR(255);
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "name_bn"     VARCHAR(255);
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "slug"        VARCHAR(255);
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "icon"        VARCHAR(120);
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "image_url"   VARCHAR(500);
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "sort_order"  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "depth"       INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "path"        TEXT NOT NULL DEFAULT '';
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "is_leaf"     BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "updated_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_key" ON "categories"("slug");
CREATE INDEX IF NOT EXISTS "idx_categories_parent" ON "categories"("parent_id");
CREATE INDEX IF NOT EXISTS "idx_categories_slug" ON "categories"("slug");

DO $$ BEGIN
  CREATE INDEX "idx_categories_path" ON "categories" USING gin("path" gin_trgm_ops);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "categories"
    ADD CONSTRAINT "fk_categories_parent"
    FOREIGN KEY ("parent_id") REFERENCES "categories"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── brands ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "brands" (
    "id"         CHAR(8)        NOT NULL,
    "name_en"    VARCHAR(255)   NOT NULL,
    "name_bn"    VARCHAR(255)   NOT NULL,
    "slug"       VARCHAR(255)   NOT NULL,
    "logo_url"   VARCHAR(500),
    "sort_order" INTEGER        NOT NULL DEFAULT 0,
    "active"     BOOLEAN        NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brands_pkey1" PRIMARY KEY ("id")
);

ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "name_en"    VARCHAR(255);
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "name_bn"    VARCHAR(255);
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "slug"       VARCHAR(255);
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "logo_url"   VARCHAR(500);
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "active"     BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "brands_slug_key1" ON "brands"("slug");

-- ─── content_drafts ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "content_drafts" (
    "id"                CHAR(8)        NOT NULL,
    "product_name"      VARCHAR(500)   NOT NULL,
    "brand_name"        VARCHAR(255)   NOT NULL,
    "category_name"     VARCHAR(255)   NOT NULL,
    "subcategory_name"  VARCHAR(255)   NOT NULL,
    "category_id"       CHAR(8),
    "subcategory_id"    CHAR(8),
    "brand_id"          CHAR(8),
    "created_by_email"  VARCHAR(255)   NOT NULL,
    "created_by_oid"    VARCHAR(128)   NOT NULL,
    "created_by_name"   VARCHAR(255),
    "status"            VARCHAR(20)    NOT NULL DEFAULT 'reserved',
    "social_ref"        VARCHAR(500),
    "created_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_drafts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "content_drafts" ADD COLUMN IF NOT EXISTS "subcategory_id" CHAR(8);
ALTER TABLE "content_drafts" ADD COLUMN IF NOT EXISTS "category_id"    CHAR(8);
ALTER TABLE "content_drafts" ADD COLUMN IF NOT EXISTS "brand_id"       CHAR(8);

CREATE INDEX IF NOT EXISTS "idx_content_drafts_created_by_email" ON "content_drafts"("created_by_email");
CREATE INDEX IF NOT EXISTS "idx_content_drafts_status" ON "content_drafts"("status");
