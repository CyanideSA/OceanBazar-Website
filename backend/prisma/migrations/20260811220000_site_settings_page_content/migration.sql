-- Editable storefront page content (policies, support, marketing, wholesale, OB points, business inquiries)
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "page_content" JSONB;

UPDATE "site_settings"
SET "page_content" = '{}'::jsonb
WHERE "page_content" IS NULL;
