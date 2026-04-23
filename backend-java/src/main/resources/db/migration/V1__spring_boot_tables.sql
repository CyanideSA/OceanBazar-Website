-- Flyway V1: Spring Boot-owned tables (not managed by Prisma)
-- These tables are exclusively used by the Spring Boot Core API.

CREATE TABLE IF NOT EXISTS notifications (
    id              VARCHAR(255) PRIMARY KEY,
    title           VARCHAR(255) NOT NULL,
    message         TEXT NOT NULL,
    image           VARCHAR(500),
    audience        VARCHAR(50) NOT NULL DEFAULT 'all',
    user_id         CHAR(8),
    kind            VARCHAR(50),
    entity_id       VARCHAR(255),
    read_status     BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_admin_id VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_audience ON notifications(audience);

CREATE TABLE IF NOT EXISTS site_settings (
    id                          VARCHAR(255) PRIMARY KEY,
    support_email               VARCHAR(255),
    support_phone               VARCHAR(50),
    facebook_url                VARCHAR(500),
    twitter_url                 VARCHAR(500),
    instagram_url               VARCHAR(500),
    youtube_url                 VARCHAR(500),
    hero_slides                 JSONB,
    product_banners             JSONB,
    featured_product_ids        JSONB,
    best_deals_product_ids      JSONB,
    new_arrivals_product_ids    JSONB,
    testimonials                JSONB,
    trust_badges                JSONB,
    default_banner_rotation_ms  INTEGER DEFAULT 6000,
    testimonial_carousel_ms     INTEGER,
    sslcommerz_store_id         VARCHAR(255),
    sslcommerz_store_password   VARCHAR(255),
    pathao_client_id            VARCHAR(255),
    pathao_client_secret        VARCHAR(255),
    steadfast_api_key           VARCHAR(255),
    redx_api_key                VARCHAR(255),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sellers (
    id                      VARCHAR(255) PRIMARY KEY,
    user_id                 CHAR(8),
    business_name           VARCHAR(255) NOT NULL,
    business_type           VARCHAR(100),
    description             TEXT,
    logo                    VARCHAR(500),
    banner                  VARCHAR(500),
    contact_email           VARCHAR(255),
    contact_phone           VARCHAR(50),
    website                 VARCHAR(500),
    address                 JSONB,
    tax_id                  VARCHAR(100),
    registration_number     VARCHAR(100),
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending',
    verification_status     VARCHAR(20) NOT NULL DEFAULT 'unverified',
    verification_documents  JSONB,
    commission_rate         DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    commission_type         VARCHAR(20) NOT NULL DEFAULT 'percentage',
    payout_account          JSONB,
    payout_schedule         VARCHAR(20) NOT NULL DEFAULT 'monthly',
    total_sales             DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    total_orders            INTEGER NOT NULL DEFAULT 0,
    average_rating          DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    total_reviews           INTEGER NOT NULL DEFAULT 0,
    categories              JSONB,
    settings                JSONB,
    approved_by_admin_id    VARCHAR(255),
    approved_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sellers_user_id ON sellers(user_id);

CREATE TABLE IF NOT EXISTS return_requests (
    id                      VARCHAR(255) PRIMARY KEY,
    order_id                VARCHAR(255) NOT NULL,
    user_id                 VARCHAR(255) NOT NULL,
    seller_id               VARCHAR(255),
    items                   JSONB,
    reason                  TEXT,
    reason_category         VARCHAR(50),
    description             TEXT,
    images                  JSONB,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending',
    refund_method           VARCHAR(30),
    refund_amount           DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    tracking_number         VARCHAR(255),
    shipping_carrier        VARCHAR(100),
    assigned_to_admin_id    VARCHAR(255),
    dispute_id              VARCHAR(255),
    admin_note              TEXT,
    timeline                JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_return_requests_user_id ON return_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_order_id ON return_requests(order_id);

CREATE TABLE IF NOT EXISTS disputes (
    id                      VARCHAR(255) PRIMARY KEY,
    order_id                VARCHAR(255) NOT NULL,
    user_id                 VARCHAR(255) NOT NULL,
    title                   VARCHAR(500) NOT NULL,
    description             TEXT,
    status                  VARCHAR(20) NOT NULL DEFAULT 'open',
    priority                VARCHAR(20) NOT NULL DEFAULT 'medium',
    assigned_to_admin_id    VARCHAR(255),
    resolution_note         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS domain_events (
    id                  VARCHAR(255) PRIMARY KEY,
    aggregate_type      VARCHAR(50) NOT NULL,
    aggregate_id        VARCHAR(255) NOT NULL,
    event_type          VARCHAR(100) NOT NULL,
    payload             JSONB,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    retry_count         INTEGER NOT NULL DEFAULT 0,
    processed_at        TIMESTAMPTZ,
    processing_error    TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_domain_events_status ON domain_events(status);

CREATE TABLE IF NOT EXISTS inventory_items (
    id                  VARCHAR(255) PRIMARY KEY,
    product_id          VARCHAR(255) NOT NULL,
    variant_id          VARCHAR(255),
    sku                 VARCHAR(100),
    warehouse_id        VARCHAR(255),
    warehouse_name      VARCHAR(255),
    quantity_on_hand    INTEGER NOT NULL DEFAULT 0,
    quantity_reserved   INTEGER NOT NULL DEFAULT 0,
    quantity_available  INTEGER NOT NULL DEFAULT 0,
    reorder_point       INTEGER NOT NULL DEFAULT 10,
    reorder_quantity    INTEGER NOT NULL DEFAULT 50,
    status              VARCHAR(20) NOT NULL DEFAULT 'in_stock',
    last_restocked_at   TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_product_id ON inventory_items(product_id);

CREATE TABLE IF NOT EXISTS inventory_reservations (
    id                  VARCHAR(255) PRIMARY KEY,
    inventory_item_id   VARCHAR(255) NOT NULL,
    product_id          VARCHAR(255) NOT NULL,
    variant_id          VARCHAR(255),
    order_id            VARCHAR(255),
    user_id             VARCHAR(255),
    quantity            INTEGER NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'held',
    expires_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
    id                  VARCHAR(255) PRIMARY KEY,
    inventory_item_id   VARCHAR(255) NOT NULL,
    product_id          VARCHAR(255) NOT NULL,
    variant_id          VARCHAR(255),
    order_id            VARCHAR(255),
    type                VARCHAR(30) NOT NULL,
    quantity            INTEGER NOT NULL,
    previous_on_hand    INTEGER,
    new_on_hand         INTEGER,
    note                TEXT,
    actor_id            VARCHAR(255),
    actor_type          VARCHAR(20),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_sessions (
    id                  VARCHAR(255) PRIMARY KEY,
    user_id             VARCHAR(255) NOT NULL,
    messages            JSONB,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    agent_engaged       BOOLEAN NOT NULL DEFAULT FALSE,
    closed_by_agent_at  TIMESTAMPTZ,
    last_message_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);

CREATE TABLE IF NOT EXISTS support_agents (
    id          VARCHAR(255) PRIMARY KEY,
    agent_id    VARCHAR(100) UNIQUE NOT NULL,
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255),
    role        VARCHAR(30) NOT NULL DEFAULT 'SUPPORT_AGENT',
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouses (
    id                  VARCHAR(255) PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,
    code                VARCHAR(50) UNIQUE,
    address             JSONB,
    contact_phone       VARCHAR(50),
    contact_email       VARCHAR(255),
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    is_primary          BOOLEAN NOT NULL DEFAULT FALSE,
    supported_carriers  JSONB,
    operating_hours     JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_payment_methods (
    id                  VARCHAR(255) PRIMARY KEY,
    user_id             VARCHAR(255) NOT NULL,
    type                VARCHAR(20) NOT NULL,
    nickname            VARCHAR(100),
    card_brand          VARCHAR(50),
    last4               VARCHAR(4),
    expiry_month        INTEGER,
    expiry_year         INTEGER,
    wallet_provider     VARCHAR(50),
    wallet_last4        VARCHAR(4),
    bank_name           VARCHAR(100),
    bank_account_last4  VARCHAR(4),
    default_method      BOOLEAN,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_payment_methods_user_id ON saved_payment_methods(user_id);

CREATE TABLE IF NOT EXISTS wholesale_applications (
    id                      VARCHAR(255) PRIMARY KEY,
    user_id                 VARCHAR(255) NOT NULL,
    business_name           VARCHAR(255) NOT NULL,
    business_type           VARCHAR(100),
    tax_id                  VARCHAR(100),
    contact_person          VARCHAR(255),
    email                   VARCHAR(255),
    phone                   VARCHAR(50),
    address                 TEXT,
    business_description    TEXT,
    expected_volume         VARCHAR(100),
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending',
    admin_notes             TEXT,
    reviewed_by_admin_id    VARCHAR(255),
    reviewed_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_inquiries (
    id                      VARCHAR(255) PRIMARY KEY,
    full_name               VARCHAR(255) NOT NULL,
    business_name           VARCHAR(255),
    email                   VARCHAR(255),
    phone                   VARCHAR(50),
    business_type           VARCHAR(100),
    country                 VARCHAR(100),
    message                 TEXT,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending',
    admin_notes             TEXT,
    reviewed_by_admin_id    VARCHAR(255),
    reviewed_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_feedback (
    id          VARCHAR(255) PRIMARY KEY,
    order_id    VARCHAR(255) NOT NULL,
    user_id     VARCHAR(255) NOT NULL,
    rating      INTEGER NOT NULL,
    comment     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_feedback_order_id ON order_feedback(order_id);
