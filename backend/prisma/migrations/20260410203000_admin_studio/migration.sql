-- AlterTable
DO $$ BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_featured" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- AlterTable
DO $$ BEGIN
  IF to_regclass('public.tickets') IS NOT NULL THEN
    ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "product_id" CHAR(8);
    ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "payment_tx_id" CHAR(8);
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "tickets" ADD CONSTRAINT "tickets_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "tickets" ADD CONSTRAINT "tickets_payment_tx_id_fkey" FOREIGN KEY ("payment_tx_id") REFERENCES "payment_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL; END $$;
