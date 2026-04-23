-- AlterTable: add seen_at column to ticket_messages
ALTER TABLE "ticket_messages" ADD COLUMN "seen_at" TIMESTAMPTZ;
