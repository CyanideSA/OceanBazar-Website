-- AlterTable: add seen_at column to ticket_messages
DO $$ BEGIN
  IF to_regclass('public.ticket_messages') IS NOT NULL THEN
    ALTER TABLE "ticket_messages" ADD COLUMN IF NOT EXISTS "seen_at" TIMESTAMPTZ;
  END IF;
END $$;
