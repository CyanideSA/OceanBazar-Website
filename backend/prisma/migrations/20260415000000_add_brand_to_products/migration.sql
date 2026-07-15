-- Flyway V3 created the products table without the plain-text `brand` column
-- that the Prisma schema expects. Add it idempotently.

DO $$ BEGIN
  ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "brand" VARCHAR(255);
EXCEPTION WHEN undefined_table THEN NULL; END $$;
