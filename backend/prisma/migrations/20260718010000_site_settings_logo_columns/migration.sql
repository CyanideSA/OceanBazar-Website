-- Align site_settings table with Prisma schema (fixes P2022 on settings load)
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "logo_dark_url" VARCHAR(500);
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "logo_light_url" VARCHAR(500);
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "favicon_url" VARCHAR(500);
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "paperfly_username" VARCHAR(255);
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "paperfly_password" VARCHAR(255);
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "paperfly_key" VARCHAR(255);
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "steadfast_secret_key" VARCHAR(255);
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "pathao_store_id" VARCHAR(255);
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "default_courier" VARCHAR(50);
