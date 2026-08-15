-- Align chat_sessions with Prisma schema used by live chat BFF routes.
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) NOT NULL DEFAULT 'bot';
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "agent_id" VARCHAR(255);
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "agent_name" VARCHAR(255);
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "agent_claimed_at" TIMESTAMPTZ(6);
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMPTZ(6);
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "customer_name" VARCHAR(255);
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "customer_issue" VARCHAR(500);
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "customer_email" VARCHAR(255);
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "customer_phone" VARCHAR(50);
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "customer_form" JSONB;
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "visitor_id" VARCHAR(255);
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "channel" VARCHAR(20) NOT NULL DEFAULT 'web';
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "bot_context" JSONB;

CREATE INDEX IF NOT EXISTS "idx_chat_sessions_status" ON "chat_sessions"("status");
CREATE INDEX IF NOT EXISTS "idx_chat_sessions_channel" ON "chat_sessions"("channel");
CREATE INDEX IF NOT EXISTS "idx_chat_sessions_visitor_id" ON "chat_sessions"("visitor_id");
