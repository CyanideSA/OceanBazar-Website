-- Flash sales v3: campaign lifecycle, full pricing snapshots, per-customer limits
ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS campaign_status VARCHAR(20) NOT NULL DEFAULT 'draft';

ALTER TABLE flash_sale_items ADD COLUMN IF NOT EXISTS pricing_mode VARCHAR(20);
ALTER TABLE flash_sale_items ADD COLUMN IF NOT EXISTS original_pricing_snapshot JSONB;
ALTER TABLE flash_sale_items ADD COLUMN IF NOT EXISTS flash_pricing_snapshot JSONB;
ALTER TABLE flash_sale_items ADD COLUMN IF NOT EXISTS per_customer_limit INT NOT NULL DEFAULT 15;

UPDATE flash_sales SET campaign_status = 'completed' WHERE ends_at < NOW() AND campaign_status NOT IN ('draft');
UPDATE flash_sales SET campaign_status = 'running'
  WHERE is_active = TRUE AND starts_at <= NOW() AND ends_at >= NOW();
UPDATE flash_sales SET campaign_status = 'scheduled'
  WHERE is_active = TRUE AND starts_at > NOW();
UPDATE flash_sales SET campaign_status = 'draft' WHERE is_active = FALSE AND campaign_status IS NULL;
