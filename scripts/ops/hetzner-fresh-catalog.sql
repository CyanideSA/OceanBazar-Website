-- Bootstrap catalog tables for fresh Hetzner deploy (no legacy data).
-- Flyway V3 legacy migration assumes old tables; this creates products/catalog on empty DB.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS categories (
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
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

CREATE TABLE IF NOT EXISTS products (
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
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

CREATE TABLE IF NOT EXISTS product_assets (
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

CREATE TABLE IF NOT EXISTS product_pricing (
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

CREATE TABLE IF NOT EXISTS product_variants (
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
