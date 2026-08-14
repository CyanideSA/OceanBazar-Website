-- Dev bootstrap patch: add DEFAULT now() to every NOT NULL `updated_at` column
-- that lacks a database-level default.
--
-- Prisma's @updatedAt manages these columns from the application on Prisma writes,
-- so `prisma db push` creates them NOT NULL without a DB default. However, several
-- routes create/populate tables via raw SQL and rely on a DB-level default that
-- matches their own `CREATE TABLE ... updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
-- (for example src/routes/ab.ts `ensureSchema`). Without the default, those raw
-- INSERTs fail with a NOT NULL violation (SQLSTATE 23502).
--
-- This script is idempotent and safe to run after every `prisma db push`.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'updated_at'
      AND is_nullable = 'NO'
      AND column_default IS NULL
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN updated_at SET DEFAULT now()', r.table_name);
  END LOOP;
END $$;
