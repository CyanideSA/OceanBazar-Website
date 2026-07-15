-- Prisma/explorer schema drift: products may lack category_id while JPA still maps it.
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id CHAR(8);

UPDATE products p
SET category_id = (
    SELECT c.id FROM categories c ORDER BY c.id LIMIT 1
)
WHERE p.category_id IS NULL
  AND EXISTS (SELECT 1 FROM categories LIMIT 1);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
