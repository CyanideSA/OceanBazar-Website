-- Admin CRM overhaul: order item images, email design JSON, refund records, client error userId, flash sales tables

ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "product_image" VARCHAR(1000);

ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "design_json" JSONB;

ALTER TABLE "client_error_reports" ADD COLUMN IF NOT EXISTS "user_id" CHAR(8);
CREATE INDEX IF NOT EXISTS "idx_client_error_reports_user" ON "client_error_reports"("user_id");

CREATE TABLE IF NOT EXISTS "refund_records" (
  "id" VARCHAR(255) PRIMARY KEY,
  "order_id" CHAR(8) NOT NULL,
  "return_id" VARCHAR(255),
  "payment_tx_id" CHAR(8),
  "user_id" CHAR(8) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "method" VARCHAR(50),
  "reference" VARCHAR(255),
  "customer_account" JSONB,
  "notes" TEXT,
  "receipt_url" VARCHAR(1000),
  "status" VARCHAR(40) NOT NULL DEFAULT 'pending_info',
  "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "completed_at" TIMESTAMPTZ(6),
  "created_by" VARCHAR(100),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_refund_records_order" ON "refund_records"("order_id");
CREATE INDEX IF NOT EXISTS "idx_refund_records_user" ON "refund_records"("user_id");
CREATE INDEX IF NOT EXISTS "idx_refund_records_return" ON "refund_records"("return_id");

-- Flash sales base tables (CREATE if missing; ALTERs may already exist from v2/v3 scripts)
CREATE TABLE IF NOT EXISTS "flash_sales" (
  "id" VARCHAR(255) PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL,
  "slug" VARCHAR(255),
  "description" TEXT,
  "starts_at" TIMESTAMPTZ(6) NOT NULL,
  "ends_at" TIMESTAMPTZ(6) NOT NULL,
  "status" VARCHAR(40) NOT NULL DEFAULT 'draft',
  "campaign_status" VARCHAR(40) DEFAULT 'draft',
  "banner_url" VARCHAR(1000),
  "priority" INT DEFAULT 0,
  "created_by" VARCHAR(100),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "flash_sale_items" (
  "id" VARCHAR(255) PRIMARY KEY,
  "flash_sale_id" VARCHAR(255) NOT NULL REFERENCES "flash_sales"("id") ON DELETE CASCADE,
  "product_id" CHAR(8) NOT NULL,
  "variant_id" CHAR(8),
  "discount_type" VARCHAR(20) NOT NULL DEFAULT 'percent',
  "discount_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "sale_price" DECIMAL(12,2),
  "stock_limit" INT,
  "sold_count" INT NOT NULL DEFAULT 0,
  "sort_order" INT NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_flash_sale_items_sale" ON "flash_sale_items"("flash_sale_id");
CREATE INDEX IF NOT EXISTS "idx_flash_sale_items_product" ON "flash_sale_items"("product_id");
