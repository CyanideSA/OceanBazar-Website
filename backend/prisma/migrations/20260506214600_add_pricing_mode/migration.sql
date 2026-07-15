-- Add pricing_mode column to products table
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "pricing_mode" VARCHAR(20) NOT NULL DEFAULT 'tiered';

-- Backfill: products that have only retail pricing rows and no wholesale → non_tiered
UPDATE "products" p
  SET "pricing_mode" = 'non_tiered'
  WHERE NOT EXISTS (
    SELECT 1 FROM "product_pricing" pp
    WHERE pp."product_id" = p."id" AND pp."customer_type" = 'wholesale'
  )
  AND EXISTS (
    SELECT 1 FROM "product_pricing" pp
    WHERE pp."product_id" = p."id" AND pp."customer_type" = 'retail'
  );
