-- Content ID drafts: lifetime-reserved product IDs for social posting before catalog merge

CREATE TABLE IF NOT EXISTS "content_drafts" (
    "id" CHAR(8) NOT NULL,
    "product_name" VARCHAR(500) NOT NULL,
    "brand_name" VARCHAR(255) NOT NULL,
    "category_name" VARCHAR(255) NOT NULL,
    "subcategory_name" VARCHAR(255) NOT NULL,
    "category_id" CHAR(8),
    "brand_id" CHAR(8),
    "created_by_email" VARCHAR(255) NOT NULL,
    "created_by_oid" VARCHAR(128) NOT NULL,
    "created_by_name" VARCHAR(255),
    "status" VARCHAR(20) NOT NULL DEFAULT 'reserved',
    "social_ref" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_drafts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_content_drafts_created_by_email" ON "content_drafts"("created_by_email");
CREATE INDEX IF NOT EXISTS "idx_content_drafts_status" ON "content_drafts"("status");
