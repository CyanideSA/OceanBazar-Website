-- Flash sales service columns required by list/sync/pricing lifecycle
ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20);
ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS discount_value DECIMAL(12,2);
ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS banner_text VARCHAR(500);
ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS banner_color VARCHAR(20);
ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE flash_sale_items ADD COLUMN IF NOT EXISTS flash_price NUMERIC(12,2);
ALTER TABLE flash_sale_items ADD COLUMN IF NOT EXISTS flash_compare_at NUMERIC(12,2);
ALTER TABLE flash_sale_items ADD COLUMN IF NOT EXISTS original_price NUMERIC(12,2);
ALTER TABLE flash_sale_items ADD COLUMN IF NOT EXISTS original_compare_at NUMERIC(12,2);
ALTER TABLE flash_sale_items ADD COLUMN IF NOT EXISTS include_delivery BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE flash_sale_items ADD COLUMN IF NOT EXISTS pricing_applied BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE flash_sale_items ADD COLUMN IF NOT EXISTS pricing_mode VARCHAR(20);
ALTER TABLE flash_sale_items ADD COLUMN IF NOT EXISTS original_pricing_snapshot JSONB;
ALTER TABLE flash_sale_items ADD COLUMN IF NOT EXISTS flash_pricing_snapshot JSONB;
ALTER TABLE flash_sale_items ADD COLUMN IF NOT EXISTS per_customer_limit INT NOT NULL DEFAULT 15;
ALTER TABLE flash_sale_items ADD COLUMN IF NOT EXISTS max_units INT NOT NULL DEFAULT 15;
ALTER TABLE flash_sale_items ADD COLUMN IF NOT EXISTS reserved INT NOT NULL DEFAULT 0;
ALTER TABLE flash_sale_items ADD COLUMN IF NOT EXISTS sold INT NOT NULL DEFAULT 0;
