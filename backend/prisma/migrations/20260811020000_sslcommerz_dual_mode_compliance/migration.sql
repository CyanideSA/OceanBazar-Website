-- Dual SSLCommerz sandbox/live credentials + compliance legal fields
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

-- Seed dual-mode columns from legacy single credential pair when present
UPDATE "site_settings"
SET
  "sslcommerz_sandbox_store_id" = COALESCE("sslcommerz_sandbox_store_id", "sslcommerz_store_id"),
  "sslcommerz_sandbox_store_password" = COALESCE("sslcommerz_sandbox_store_password", "sslcommerz_store_password"),
  "sslcommerz_mode" = COALESCE("sslcommerz_mode", 'sandbox')
WHERE "id" = 'default';
