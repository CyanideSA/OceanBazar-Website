-- Pathao-synced customer addresses + delivery-fee payment tracking on orders

ALTER TABLE "saved_addresses"
  ADD COLUMN IF NOT EXISTS "pathao_city_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "pathao_zone_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "pathao_area_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "pathao_city_name" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "pathao_zone_name" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "pathao_area_name" VARCHAR(120);

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "delivery_fee_paid" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "delivery_payment_status" VARCHAR(30) NOT NULL DEFAULT 'none';
