-- Flyway V3: File-Explorer Product & Inventory Schema
-- Fresh tables for hierarchical category tree, product assets, banners, attributes, tags taxonomy.

-- ─── Enable trigram extension for path searches ─────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── 1. Rename old tables to _legacy ────────────────────────────────────────
ALTER TABLE IF EXISTS categories        RENAME TO categories_legacy;
ALTER TABLE IF EXISTS products          RENAME TO products_legacy;
ALTER TABLE IF EXISTS product_images    RENAME TO product_images_legacy;
ALTER TABLE IF EXISTS product_pricing   RENAME TO product_pricing_legacy;
ALTER TABLE IF EXISTS product_variants  RENAME TO product_variants_legacy;
ALTER TABLE IF EXISTS brands            RENAME TO brands_legacy;

-- Drop legacy FK constraints that may block new table creation
ALTER TABLE IF EXISTS products_legacy        DROP CONSTRAINT IF EXISTS products_category_id_fkey;
ALTER TABLE IF EXISTS products_legacy        DROP CONSTRAINT IF EXISTS products_brand_id_fkey;
ALTER TABLE IF EXISTS product_images_legacy  DROP CONSTRAINT IF EXISTS product_images_product_id_fkey;
ALTER TABLE IF EXISTS product_pricing_legacy DROP CONSTRAINT IF EXISTS product_pricing_product_id_fkey;
ALTER TABLE IF EXISTS product_variants_legacy DROP CONSTRAINT IF EXISTS product_variants_product_id_fkey;

-- ─── 2. Categories (self-referencing tree) ──────────────────────────────────
CREATE TABLE categories (
    id          CHAR(8) PRIMARY KEY,
    parent_id   CHAR(8),
    name_en     VARCHAR(255) NOT NULL,
    name_bn     VARCHAR(255) NOT NULL,
    slug        VARCHAR(255) NOT NULL UNIQUE,
    icon        VARCHAR(120),
    description TEXT,
    sort_order  INT NOT NULL DEFAULT 0,
    depth       INT NOT NULL DEFAULT 0,
    path        TEXT NOT NULL DEFAULT '',
    is_leaf     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
);
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_slug   ON categories(slug);
CREATE INDEX idx_categories_path   ON categories USING gin(path gin_trgm_ops);

-- ─── 3. Brands ──────────────────────────────────────────────────────────────
CREATE TABLE brands (
    id          CHAR(8) PRIMARY KEY,
    name_en     VARCHAR(255) NOT NULL,
    name_bn     VARCHAR(255) NOT NULL,
    slug        VARCHAR(255) NOT NULL UNIQUE,
    logo_url    VARCHAR(500),
    sort_order  INT NOT NULL DEFAULT 0,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 4. Products ────────────────────────────────────────────────────────────
CREATE TABLE products (
    id                  CHAR(8) PRIMARY KEY,
    category_id         CHAR(8) NOT NULL REFERENCES categories(id),
    brand_id            CHAR(8) REFERENCES brands(id),
    seller_id           CHAR(8),
    title_en            VARCHAR(500) NOT NULL,
    title_bn            VARCHAR(500) NOT NULL,
    description_en      TEXT,
    description_bn      TEXT,
    sku                 VARCHAR(100),
    status              VARCHAR(20) NOT NULL DEFAULT 'draft',
    weight              NUMERIC(8,3),
    weight_unit         VARCHAR(10),
    moq                 INT NOT NULL DEFAULT 1,
    stock               INT NOT NULL DEFAULT 0,
    seo_title           VARCHAR(255),
    seo_description     TEXT,
    import_source       TEXT,
    specifications      JSONB,
    attributes_extra    JSONB,
    rating_avg          NUMERIC(3,2),
    review_count        INT NOT NULL DEFAULT 0,
    brand_logo_url      VARCHAR(500),
    popularity_rank     INT,
    popularity_label_en VARCHAR(255),
    popularity_label_bn VARCHAR(255),
    reviews_snapshot    JSONB,
    is_featured         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_brand    ON products(brand_id);
CREATE INDEX idx_products_status   ON products(status);
CREATE INDEX idx_products_title    ON products USING gin(title_en gin_trgm_ops);

-- ─── 5. Product Assets (images + videos) ────────────────────────────────────
CREATE TABLE product_assets (
    id          SERIAL PRIMARY KEY,
    product_id  CHAR(8) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    asset_type  VARCHAR(10) NOT NULL DEFAULT 'image',
    url         TEXT NOT NULL,
    alt_en      VARCHAR(255),
    alt_bn      VARCHAR(255),
    sort_order  INT NOT NULL DEFAULT 0,
    is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
    color_key   VARCHAR(64),
    file_size   BIGINT,
    mime_type   VARCHAR(100),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_assets_product ON product_assets(product_id);

-- ─── 6. Product Banners ─────────────────────────────────────────────────────
CREATE TABLE product_banners (
    id          SERIAL PRIMARY KEY,
    product_id  CHAR(8) REFERENCES products(id) ON DELETE CASCADE,
    category_id CHAR(8) REFERENCES categories(id) ON DELETE SET NULL,
    image_url   TEXT NOT NULL,
    link_url    TEXT,
    title       VARCHAR(255),
    placement   VARCHAR(20) NOT NULL DEFAULT 'ALL',
    sort_order  INT NOT NULL DEFAULT 0,
    rotation_ms INT NOT NULL DEFAULT 6000,
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    starts_at   TIMESTAMPTZ,
    ends_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 7. Product Attributes ──────────────────────────────────────────────────
CREATE TABLE product_attributes (
    id          SERIAL PRIMARY KEY,
    product_id  CHAR(8) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    attr_key    VARCHAR(100) NOT NULL,
    attr_value  TEXT NOT NULL,
    sort_order  INT NOT NULL DEFAULT 0,
    UNIQUE(product_id, attr_key)
);

-- ─── 8. Product Pricing ─────────────────────────────────────────────────────
CREATE TABLE product_pricing (
    id              SERIAL PRIMARY KEY,
    product_id      CHAR(8) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    customer_type   VARCHAR(20) NOT NULL,
    price           NUMERIC(12,2) NOT NULL,
    compare_at      NUMERIC(12,2),
    tier1_min_qty   INT,
    tier1_discount  NUMERIC(5,2),
    tier2_min_qty   INT,
    tier2_discount  NUMERIC(5,2),
    tier3_min_qty   INT,
    tier3_discount  NUMERIC(5,2),
    sort_order      INT DEFAULT 0,
    UNIQUE(product_id, customer_type)
);

-- ─── 9. Product Variants (recreated identically) ────────────────────────────
CREATE TABLE product_variants (
    id              CHAR(8) PRIMARY KEY,
    product_id      CHAR(8) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku             VARCHAR(100),
    name_en         VARCHAR(255) NOT NULL,
    name_bn         VARCHAR(255) NOT NULL,
    attributes      JSONB NOT NULL,
    price_override  NUMERIC(12,2),
    stock           INT NOT NULL DEFAULT 0,
    weight          NUMERIC(8,3),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INT NOT NULL DEFAULT 0
);

-- ─── 10. Tag Groups + Tags + Junction ───────────────────────────────────────
CREATE TABLE tag_groups (
    id          SERIAL PRIMARY KEY,
    name_en     VARCHAR(100) NOT NULL,
    name_bn     VARCHAR(100) NOT NULL,
    slug        VARCHAR(100) NOT NULL UNIQUE,
    sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE tags (
    id          SERIAL PRIMARY KEY,
    group_id    INT REFERENCES tag_groups(id) ON DELETE SET NULL,
    name_en     VARCHAR(100) NOT NULL,
    name_bn     VARCHAR(100) NOT NULL,
    slug        VARCHAR(100) NOT NULL UNIQUE,
    sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE product_tags (
    product_id  CHAR(8) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    tag_id      INT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, tag_id)
);

-- ─── 11. Migrate data from legacy tables ────────────────────────────────────

-- 11a. Brands
INSERT INTO brands (id, name_en, name_bn, slug, logo_url, sort_order, active, created_at, updated_at)
SELECT id, name_en, name_bn, slug, logo_url, sort_order, active, created_at, updated_at
FROM brands_legacy
ON CONFLICT (id) DO NOTHING;

-- 11b. Categories (with generated slug, depth=0, path=slug for top-level)
INSERT INTO categories (id, parent_id, name_en, name_bn, slug, icon, sort_order, depth, path, is_leaf, created_at, updated_at)
SELECT
    id,
    parent_id,
    name_en,
    name_bn,
    LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name_en, '[^a-zA-Z0-9 ]', '', 'g'), '\s+', '-', 'g')),
    icon,
    COALESCE(sort_order, 0),
    0,
    LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name_en, '[^a-zA-Z0-9 ]', '', 'g'), '\s+', '-', 'g')),
    TRUE,
    COALESCE(created_at, now()),
    now()
FROM categories_legacy
WHERE parent_id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 11b2. Child categories (depth=1)
INSERT INTO categories (id, parent_id, name_en, name_bn, slug, icon, sort_order, depth, path, is_leaf, created_at, updated_at)
SELECT
    c.id,
    c.parent_id,
    c.name_en,
    c.name_bn,
    LOWER(REGEXP_REPLACE(REGEXP_REPLACE(c.name_en, '[^a-zA-Z0-9 ]', '', 'g'), '\s+', '-', 'g')) || '-' || SUBSTRING(c.id, 1, 4),
    c.icon,
    COALESCE(c.sort_order, 0),
    1,
    COALESCE(p.slug, '') || '/' || LOWER(REGEXP_REPLACE(REGEXP_REPLACE(c.name_en, '[^a-zA-Z0-9 ]', '', 'g'), '\s+', '-', 'g')),
    TRUE,
    COALESCE(c.created_at, now()),
    now()
FROM categories_legacy c
JOIN categories p ON p.id = c.parent_id
WHERE c.parent_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Mark parent categories as non-leaf
UPDATE categories SET is_leaf = FALSE
WHERE id IN (SELECT DISTINCT parent_id FROM categories WHERE parent_id IS NOT NULL);

-- 11c. Products
INSERT INTO products (id, category_id, brand_id, seller_id, title_en, title_bn,
    description_en, description_bn, sku, status, weight, weight_unit, moq, stock,
    seo_title, seo_description, import_source, specifications, attributes_extra,
    rating_avg, review_count, brand_logo_url, popularity_rank,
    popularity_label_en, popularity_label_bn, reviews_snapshot, is_featured,
    created_at, updated_at)
SELECT id, category_id, brand_id, seller_id, title_en, title_bn,
    description_en, description_bn, sku, status::VARCHAR, weight, weight_unit, moq, stock,
    seo_title, seo_description, import_source, specifications, attributes_extra,
    rating_avg, review_count, brand_logo_url, popularity_rank,
    popularity_label_en, popularity_label_bn, reviews_snapshot, is_featured,
    created_at, updated_at
FROM products_legacy
ON CONFLICT (id) DO NOTHING;

-- 11d. Product images → product_assets
INSERT INTO product_assets (product_id, asset_type, url, alt_en, alt_bn, sort_order, is_primary, color_key)
SELECT product_id, media_type::VARCHAR, url, alt_en, alt_bn, sort_order, is_primary, color_key
FROM product_images_legacy
WHERE EXISTS (SELECT 1 FROM products WHERE products.id = product_images_legacy.product_id);

-- 11e. Product pricing
INSERT INTO product_pricing (product_id, customer_type, price, compare_at,
    tier1_min_qty, tier1_discount, tier2_min_qty, tier2_discount, tier3_min_qty, tier3_discount)
SELECT product_id, customer_type::VARCHAR, price, compare_at,
    tier1_min_qty, tier1_discount, tier2_min_qty, tier2_discount, tier3_min_qty, tier3_discount
FROM product_pricing_legacy
WHERE EXISTS (SELECT 1 FROM products WHERE products.id = product_pricing_legacy.product_id)
ON CONFLICT (product_id, customer_type) DO NOTHING;

-- 11f. Product variants
INSERT INTO product_variants (id, product_id, sku, name_en, name_bn, attributes, price_override, stock, weight, is_active, sort_order)
SELECT id, product_id, sku, name_en, name_bn, attributes::JSONB, price_override, stock, weight, is_active, sort_order
FROM product_variants_legacy
WHERE EXISTS (SELECT 1 FROM products WHERE products.id = product_variants_legacy.product_id)
ON CONFLICT (id) DO NOTHING;

-- 11g. Seed default tag groups
INSERT INTO tag_groups (name_en, name_bn, slug, sort_order) VALUES
    ('Material',      'উপাদান',     'material',      0),
    ('Color',         'রঙ',         'color',         1),
    ('Season',        'মৌসুম',       'season',        2),
    ('Gender',        'লিঙ্গ',       'gender',        3),
    ('Certification', 'সনদপত্র',    'certification', 4),
    ('Use Case',      'ব্যবহারের ক্ষেত্র', 'use-case', 5)
ON CONFLICT (slug) DO NOTHING;
