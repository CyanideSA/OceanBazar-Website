-- Tier bandsJson for product_pricing; promotional best-rated flag.

ALTER TABLE product_pricing
  ADD COLUMN IF NOT EXISTS tier_bands JSONB;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_best_rated BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE products SET is_best_rated = true WHERE is_best_seller = true AND is_best_rated = false;
