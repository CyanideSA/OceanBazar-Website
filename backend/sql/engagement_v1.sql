-- Product Q&A for storefront and admin engagement moderation
CREATE TABLE IF NOT EXISTS product_qa (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  user_id TEXT,
  asker_name TEXT,
  asker_email TEXT,
  question TEXT NOT NULL,
  answer TEXT,
  asked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  is_approved BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_product_qa_product ON product_qa(product_id);
CREATE INDEX IF NOT EXISTS idx_product_qa_pending ON product_qa(is_approved, asked_at DESC);
