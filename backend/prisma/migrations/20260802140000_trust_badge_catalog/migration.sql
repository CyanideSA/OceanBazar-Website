-- Product-linked trust badge catalog (separate from site_settings.trust_badges JSON)
CREATE TABLE IF NOT EXISTS "trust_badge_catalog" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(120) NOT NULL,
    "name_bn" VARCHAR(120) NOT NULL,
    "icon" VARCHAR(50),
    "description" VARCHAR(255),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "trust_badge_catalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "trust_badge_catalog_slug_key" ON "trust_badge_catalog"("slug");

CREATE TABLE IF NOT EXISTS "product_trust_badges" (
    "product_id" CHAR(8) NOT NULL,
    "badge_id" INTEGER NOT NULL,
    CONSTRAINT "product_trust_badges_pkey" PRIMARY KEY ("product_id", "badge_id")
);

CREATE INDEX IF NOT EXISTS "idx_product_trust_badges_badge" ON "product_trust_badges"("badge_id");

DO $$ BEGIN
  ALTER TABLE "product_trust_badges"
    ADD CONSTRAINT "product_trust_badges_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "product_trust_badges"
    ADD CONSTRAINT "product_trust_badges_badge_id_fkey"
    FOREIGN KEY ("badge_id") REFERENCES "trust_badge_catalog"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed default OceanBazar trust badges
INSERT INTO "trust_badge_catalog" ("slug", "name_en", "name_bn", "icon", "description", "sort_order", "active")
VALUES
  ('authentic', '100% authentic', '১০০% অথেন্টিক', 'shield', 'Verified genuine products', 0, true),
  ('verified-import', 'Verified import', 'যাচাইকৃত আমদানি', 'award', 'Sourced through OceanBazar channels', 1, true),
  ('quality-checked', 'Quality checked', 'কোয়ালিটি চেকড', 'check', 'Inspected before dispatch', 2, true),
  ('trusted-seller', 'OceanBazar trusted', 'OceanBazar ট্রাস্টেড', 'lock', 'Sold only by OceanBazar', 3, true)
ON CONFLICT ("slug") DO NOTHING;
