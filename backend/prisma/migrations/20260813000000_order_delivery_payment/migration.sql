-- Pay-later delivery fee tracking (prepaid courier charge; goods remain COD unpaid)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cod_fee DECIMAL(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_payment_status VARCHAR(30) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS delivery_fee_paid DECIMAL(12, 2) DEFAULT 0;

ALTER TABLE saved_addresses
  ADD COLUMN IF NOT EXISTS pathao_city_id INTEGER,
  ADD COLUMN IF NOT EXISTS pathao_zone_id INTEGER,
  ADD COLUMN IF NOT EXISTS pathao_area_id INTEGER,
  ADD COLUMN IF NOT EXISTS pathao_city_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS pathao_zone_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS pathao_area_name VARCHAR(150);
