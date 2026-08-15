-- Contact page: editable company vision + structured leadership team
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "company_vision" TEXT;
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "leadership_intro" TEXT;
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "leadership_team" JSONB;
