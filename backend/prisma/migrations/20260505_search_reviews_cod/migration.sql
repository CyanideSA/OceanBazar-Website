-- ============================================================
-- OceanBazar Migration: 20260505_search_reviews_cod
-- Adds: search_logs, review photo/vote columns, COD fee tracking
-- Run with: npx prisma db push OR execute directly in psql
-- ============================================================

-- ── 1. Search analytics log ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS search_logs (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  query       VARCHAR(200) NOT NULL,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_logs_query      ON search_logs (query);
CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON search_logs (created_at DESC);

-- ── 2. Product reviews — photo URLs + helpful votes + verified purchase ──────
-- Uses ALTER TABLE ... ADD COLUMN IF NOT EXISTS (safe to run multiple times)

ALTER TABLE product_reviews
  ADD COLUMN IF NOT EXISTS image_urls     TEXT[]   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS helpful_count  INTEGER  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unhelpful_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verified_purchase BOOLEAN DEFAULT FALSE;

-- GIN index for fast full-text search on image_urls array (optional)
-- CREATE INDEX IF NOT EXISTS idx_product_reviews_images ON product_reviews USING GIN (image_urls);

-- ── 3. COD fee tracking in orders ────────────────────────────────────────────
-- Record the COD surcharge (৳40) separately so reports are clean
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cod_fee DECIMAL(12,2) DEFAULT 0;

-- ── 4. WhatsApp channel in sms_logs ──────────────────────────────────────────
ALTER TABLE sms_logs
  ADD COLUMN IF NOT EXISTS channel VARCHAR(20) DEFAULT 'sms';

-- ── 5. Full-text search index on products ────────────────────────────────────
-- `products` is created by Spring Flyway in many setups; skip if not present yet.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'products'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_products_title_en_fts
      ON products USING GIN (to_tsvector('english', COALESCE(title_en, '')));
  END IF;
END $$;

-- Composite ILIKE index (pg_trgm extension required)
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS idx_products_title_en_trgm ON products USING GIN (title_en gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_products_title_bn_trgm ON products USING GIN (title_bn gin_trgm_ops);

-- ── Done ─────────────────────────────────────────────────────────────────────
-- After running, do: npx prisma generate (to regenerate client if you added models)
