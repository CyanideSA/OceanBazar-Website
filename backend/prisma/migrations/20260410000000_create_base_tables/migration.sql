-- Baseline: Create all Prisma-owned core tables that are NOT managed by Flyway.
-- All statements use IF NOT EXISTS / EXCEPTION WHEN duplicate_object so this is
-- safe to run against a DB that was previously set up via prisma db push.

-- ─── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN CREATE TYPE "UserType"        AS ENUM ('retail', 'wholesale'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AccountStatus"   AS ENUM ('active', 'suspended', 'pending'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "Lang"            AS ENUM ('en', 'bn'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "OtpType"         AS ENUM ('login', 'forgot_password', 'verify_email', 'reset_password'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SocialProvider"  AS ENUM ('google', 'facebook', 'instagram'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CustomerType"    AS ENUM ('retail', 'wholesale'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ActorType"       AS ENUM ('system', 'admin', 'customer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ObPointsType"    AS ENUM ('earn', 'redeem', 'expire', 'adjust'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PaymentMethod"   AS ENUM ('cod', 'bkash', 'nagad', 'rocket', 'upay', 'sslcommerz', 'installment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PaymentTxStatus" AS ENUM ('pending', 'success', 'failed', 'refunded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ShipmentStatus"  AS ENUM ('pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'returned'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "TicketStatus"    AS ENUM ('open', 'in_progress', 'resolved', 'closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "TicketPriority"  AS ENUM ('low', 'medium', 'high', 'urgent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "TicketCategory"  AS ENUM ('payment', 'delivery', 'product', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SenderType"      AS ENUM ('customer', 'admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AdminRole"       AS ENUM ('super_admin', 'admin', 'staff'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CouponType"      AS ENUM ('percent', 'fixed', 'free_shipping'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ReviewStatus"    AS ENUM ('pending', 'approved', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── users ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "users" (
    "id"             CHAR(8)         NOT NULL,
    "name"           VARCHAR(255)    NOT NULL,
    "email"          VARCHAR(255)    UNIQUE,
    "phone"          VARCHAR(20)     UNIQUE,
    "password_hash"  TEXT,
    "user_type"      "UserType"      NOT NULL DEFAULT 'retail',
    "account_status" "AccountStatus" NOT NULL DEFAULT 'active',
    "preferred_lang" "Lang"          NOT NULL DEFAULT 'en',
    "email_verified" BOOLEAN         NOT NULL DEFAULT false,
    "profile_image"  TEXT,
    "lifetime_spend" DECIMAL(12,2)   NOT NULL DEFAULT 0,
    "created_at"     TIMESTAMPTZ(6)  NOT NULL DEFAULT NOW(),
    "updated_at"     TIMESTAMPTZ(6)  NOT NULL DEFAULT NOW(),
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- ─── admin_users ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "admin_users" (
    "id"            SERIAL        PRIMARY KEY,
    "name"          VARCHAR(255)  NOT NULL,
    "username"      VARCHAR(100)  NOT NULL UNIQUE,
    "email"         VARCHAR(255)  NOT NULL UNIQUE,
    "password_hash" VARCHAR(255)  NOT NULL,
    "role"          "AdminRole"   NOT NULL DEFAULT 'staff',
    "active"        BOOLEAN       NOT NULL DEFAULT TRUE,
    "created_at"    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── otp_codes ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "otp_codes" (
    "id"         SERIAL         PRIMARY KEY,
    "target"     VARCHAR(255)   NOT NULL,
    "code"       CHAR(6)        NOT NULL,
    "type"       "OtpType"      NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used"       BOOLEAN        NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "otp_codes_target_type_idx" ON "otp_codes" ("target", "type");

-- ─── social_accounts ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "social_accounts" (
    "id"           SERIAL            PRIMARY KEY,
    "user_id"      CHAR(8)           NOT NULL,
    "provider"     "SocialProvider"  NOT NULL,
    "provider_id"  VARCHAR(255)      NOT NULL,
    "access_token" TEXT,
    "created_at"   TIMESTAMPTZ(6)    NOT NULL DEFAULT NOW(),
    CONSTRAINT "social_accounts_provider_provider_id_key" UNIQUE ("provider", "provider_id")
);

-- ─── saved_addresses ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "saved_addresses" (
    "id"          SERIAL       PRIMARY KEY,
    "user_id"     CHAR(8)      NOT NULL,
    "label"       VARCHAR(100) NOT NULL,
    "line1"       TEXT         NOT NULL,
    "line2"       TEXT,
    "city"        VARCHAR(100) NOT NULL,
    "district"    VARCHAR(100) NOT NULL,
    "postal_code" VARCHAR(20),
    "is_default"  BOOLEAN      NOT NULL DEFAULT false
);

-- ─── coupons ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "coupons" (
    "id"          SERIAL         PRIMARY KEY,
    "code"        VARCHAR(50)    NOT NULL UNIQUE,
    "type"        "CouponType"   NOT NULL,
    "value"       DECIMAL(10,2)  NOT NULL,
    "min_order"   DECIMAL(12,2)  NOT NULL DEFAULT 0,
    "max_uses"    INT,
    "used_count"  INT            NOT NULL DEFAULT 0,
    "starts_at"   TIMESTAMPTZ(6) NOT NULL,
    "expires_at"  TIMESTAMPTZ(6),
    "active"      BOOLEAN        NOT NULL DEFAULT true
);

-- ─── orders ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "orders" (
    "id"                  CHAR(8)        NOT NULL,
    "order_number"        VARCHAR(20)    NOT NULL UNIQUE,
    "user_id"             CHAR(8)        NOT NULL,
    "status"              VARCHAR(20)    NOT NULL DEFAULT 'pending',
    "customer_type"       VARCHAR(20)    NOT NULL,
    "subtotal"            DECIMAL(12,2)  NOT NULL,
    "discount"            DECIMAL(12,2)  NOT NULL DEFAULT 0,
    "gst"                 DECIMAL(12,2)  NOT NULL,
    "shipping_fee"        DECIMAL(12,2)  NOT NULL,
    "service_fee"         DECIMAL(12,2)  NOT NULL,
    "ob_points_used"      INT            NOT NULL DEFAULT 0,
    "ob_discount"         DECIMAL(12,2)  NOT NULL DEFAULT 0,
    "coupon_id"           INT,
    "total"               DECIMAL(12,2)  NOT NULL,
    "payment_method"      VARCHAR(20)    NOT NULL,
    "payment_status"      VARCHAR(20)    NOT NULL DEFAULT 'unpaid',
    "shipping_address_id" INT,
    "tracking_number"     CHAR(16),
    "notes"               TEXT,
    "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- ─── order_items ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "order_items" (
    "id"            SERIAL        PRIMARY KEY,
    "order_id"      CHAR(8)       NOT NULL,
    "product_id"    CHAR(8)       NOT NULL,
    "variant_id"    CHAR(8),
    "product_title" VARCHAR(500)  NOT NULL,
    "unit_price"    DECIMAL(12,2) NOT NULL,
    "quantity"      INT           NOT NULL,
    "line_total"    DECIMAL(12,2) NOT NULL,
    "discount_pct"  DECIMAL(5,2)  NOT NULL DEFAULT 0
);

-- ─── order_timeline ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "order_timeline" (
    "id"         SERIAL         PRIMARY KEY,
    "order_id"   CHAR(8)        NOT NULL,
    "status"     VARCHAR(100)   NOT NULL,
    "note"       TEXT,
    "actor_id"   VARCHAR(50),
    "actor_type" "ActorType"    NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

-- ─── ob_points_ledger ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ob_points_ledger" (
    "id"         SERIAL         PRIMARY KEY,
    "user_id"    CHAR(8)        NOT NULL,
    "type"       "ObPointsType" NOT NULL,
    "points"     INT            NOT NULL,
    "order_id"   CHAR(8),
    "note"       TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

-- ─── payment_transactions ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "payment_transactions" (
    "id"             CHAR(8)           NOT NULL,
    "order_id"       CHAR(8)           NOT NULL,
    "user_id"        CHAR(8)           NOT NULL,
    "method"         "PaymentMethod"   NOT NULL,
    "status"         "PaymentTxStatus" NOT NULL DEFAULT 'pending',
    "provider_tx_id" VARCHAR(255),
    "amount"         DECIMAL(12,2)     NOT NULL,
    "currency"       CHAR(3)           NOT NULL DEFAULT 'BDT',
    "metadata"       JSONB,
    "created_at"     TIMESTAMPTZ(6)    NOT NULL DEFAULT NOW(),
    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- ─── shipments ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "shipments" (
    "id"                 CHAR(8)          NOT NULL,
    "order_id"           CHAR(8)          NOT NULL,
    "carrier"            VARCHAR(100)     NOT NULL,
    "tracking_number"    CHAR(16)         NOT NULL,
    "status"             "ShipmentStatus" NOT NULL DEFAULT 'pending',
    "estimated_delivery" DATE,
    "events"             JSONB,
    "created_at"         TIMESTAMPTZ(6)   NOT NULL DEFAULT NOW(),
    "updated_at"         TIMESTAMPTZ(6)   NOT NULL DEFAULT NOW(),
    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- ─── tickets ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "tickets" (
    "id"            CHAR(8)          NOT NULL,
    "user_id"       CHAR(8)          NOT NULL,
    "order_id"      CHAR(8),
    "product_id"    CHAR(8),
    "payment_tx_id" CHAR(8),
    "subject"       VARCHAR(500)     NOT NULL,
    "status"        "TicketStatus"   NOT NULL DEFAULT 'open',
    "priority"      "TicketPriority" NOT NULL DEFAULT 'medium',
    "category"      "TicketCategory" NOT NULL,
    "assigned_to"   INT,
    "created_at"    TIMESTAMPTZ(6)   NOT NULL DEFAULT NOW(),
    "updated_at"    TIMESTAMPTZ(6)   NOT NULL DEFAULT NOW(),
    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- ─── ticket_messages ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ticket_messages" (
    "id"          SERIAL         PRIMARY KEY,
    "ticket_id"   CHAR(8)        NOT NULL,
    "sender_type" "SenderType"   NOT NULL,
    "sender_id"   VARCHAR(50)    NOT NULL,
    "message"     TEXT           NOT NULL,
    "attachments" TEXT[]         NOT NULL DEFAULT '{}',
    "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "seen_at"     TIMESTAMPTZ(6)
);

-- ─── carts ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "carts" (
    "id"         SERIAL         PRIMARY KEY,
    "user_id"    CHAR(8)        NOT NULL UNIQUE,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

-- ─── cart_items ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "cart_items" (
    "id"            SERIAL         PRIMARY KEY,
    "cart_id"       INT            NOT NULL,
    "product_id"    CHAR(8)        NOT NULL,
    "variant_id"    CHAR(8),
    "quantity"      INT            NOT NULL,
    "unit_price"    DECIMAL(12,2)  NOT NULL,
    "customer_type" "CustomerType" NOT NULL
);

-- ─── customers ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "customers" (
    "user_id"      CHAR(8)       NOT NULL,
    "company_name" VARCHAR(255),
    "tax_id"       VARCHAR(100),
    "segment"      VARCHAR(64),
    "notes"        TEXT,
    "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customers_pkey" PRIMARY KEY ("user_id")
);

-- ─── audit_logs ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id"          SERIAL         PRIMARY KEY,
    "admin_id"    INT            NOT NULL,
    "action"      VARCHAR(255)   NOT NULL,
    "target_type" VARCHAR(100)   NOT NULL,
    "target_id"   VARCHAR(50)    NOT NULL,
    "details"     JSONB,
    "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

-- ─── analytics_events ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "analytics_events" (
    "id"         SERIAL         PRIMARY KEY,
    "event_type" VARCHAR(100)   NOT NULL,
    "user_id"    CHAR(8),
    "session_id" VARCHAR(100),
    "payload"    JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "analytics_events_event_type_created_at_idx" ON "analytics_events" ("event_type", "created_at");

-- ─── courier_tokens ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "courier_tokens" (
    "id"            VARCHAR(255)   NOT NULL PRIMARY KEY,
    "provider"      VARCHAR(50)    NOT NULL UNIQUE,
    "access_token"  TEXT           NOT NULL,
    "refresh_token" TEXT,
    "expires_at"    TIMESTAMPTZ(6) NOT NULL,
    "created_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updated_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

-- ─── courier_shipments ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "courier_shipments" (
    "id"                VARCHAR(255)   NOT NULL PRIMARY KEY,
    "order_id"          CHAR(8)        NOT NULL,
    "courier_provider"  VARCHAR(50)    NOT NULL,
    "consignment_id"    VARCHAR(255),
    "tracking_code"     VARCHAR(255),
    "courier_status"    VARCHAR(100),
    "internal_status"   VARCHAR(30)    NOT NULL DEFAULT 'pending',
    "delivery_fee"      DECIMAL(10,2),
    "cod_amount"        DECIMAL(12,2),
    "recipient_name"    VARCHAR(255),
    "recipient_phone"   VARCHAR(50),
    "recipient_address" TEXT,
    "recipient_city"    VARCHAR(100),
    "recipient_zone"    VARCHAR(100),
    "recipient_area"    VARCHAR(100),
    "weight"            DECIMAL(8,3),
    "note"              TEXT,
    "courier_response"  JSONB,
    "webhook_events"    JSONB,
    "created_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updated_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_courier_shipments_order"       ON "courier_shipments" ("order_id");
CREATE INDEX IF NOT EXISTS "idx_courier_shipments_consignment" ON "courier_shipments" ("consignment_id");
CREATE INDEX IF NOT EXISTS "idx_courier_shipments_tracking"    ON "courier_shipments" ("tracking_code");

-- ─── email_logs ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "email_logs" (
    "id"         VARCHAR(255)   NOT NULL PRIMARY KEY,
    "to_address" VARCHAR(255)   NOT NULL,
    "subject"    VARCHAR(500)   NOT NULL,
    "template"   VARCHAR(100),
    "status"     VARCHAR(20)    NOT NULL DEFAULT 'sent',
    "error"      TEXT,
    "metadata"   JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

-- ─── sms_logs ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "sms_logs" (
    "id"           VARCHAR(255)   NOT NULL PRIMARY KEY,
    "to_phone"     VARCHAR(50)    NOT NULL,
    "message_type" VARCHAR(50)    NOT NULL,
    "status"       VARCHAR(20)    NOT NULL DEFAULT 'sent',
    "error"        TEXT,
    "metadata"     JSONB,
    "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

-- ─── cart_abandonment_reminders ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "cart_abandonment_reminders" (
    "id"            VARCHAR(255)   NOT NULL PRIMARY KEY,
    "user_id"       CHAR(8)        NOT NULL,
    "cart_id"       INT            NOT NULL,
    "reminder_type" VARCHAR(30)    NOT NULL,
    "sent_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_cart_abandon_user" ON "cart_abandonment_reminders" ("user_id");
