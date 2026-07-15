-- Unified Integrations: SSO identity fields, WhatsApp channel, Meta WABA fields

-- AdminUser SSO identity
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "microsoft_oid" VARCHAR(128);
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "google_sub" VARCHAR(128);
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "auth_provider" VARCHAR(30) NOT NULL DEFAULT 'local';

CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_microsoft_oid_key" ON "admin_users"("microsoft_oid") WHERE "microsoft_oid" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_google_sub_key" ON "admin_users"("google_sub") WHERE "google_sub" IS NOT NULL;

-- Meta WhatsApp Business fields
ALTER TABLE "meta_accounts" ADD COLUMN IF NOT EXISTS "waba_id" VARCHAR(100);
ALTER TABLE "meta_accounts" ADD COLUMN IF NOT EXISTS "wa_phone_number_id" VARCHAR(100);

-- SMS logs channel
ALTER TABLE "sms_logs" ADD COLUMN IF NOT EXISTS "channel" VARCHAR(20) NOT NULL DEFAULT 'sms';

-- CommChannel enum: add whatsapp
DO $$ BEGIN
  ALTER TYPE "CommChannel" ADD VALUE IF NOT EXISTS 'whatsapp';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
