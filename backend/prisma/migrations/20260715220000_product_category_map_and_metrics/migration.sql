-- M:N product categories + metrics (Prisma models missing from earlier migrations).
-- Backfill primary category links from legacy products.category_id.

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
