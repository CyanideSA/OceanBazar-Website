-- Flash sale v2: pricing snapshots + delivery toggle + pricing lifecycle
ALTER TABLE flash_sale_items ADD COLUMN IF NOT EXISTS original_price NUMERIC(12,2);
ALTER TABLE flash_sale_items ADD COLUMN IF NOT EXISTS original_compare_at NUMERIC(12,2);
ALTER TABLE flash_sale_items ADD COLUMN IF NOT EXISTS flash_compare_at NUMERIC(12,2);
ALTER TABLE flash_sale_items ADD COLUMN IF NOT EXISTS include_delivery BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE flash_sale_items ADD COLUMN IF NOT EXISTS pricing_applied BOOLEAN NOT NULL DEFAULT FALSE;
