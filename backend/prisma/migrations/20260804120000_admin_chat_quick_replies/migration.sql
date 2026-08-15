-- Admin CRM live-chat quick replies (unlimited per agent)
ALTER TABLE "admin_users"
  ADD COLUMN IF NOT EXISTS "chat_quick_replies" JSONB;
