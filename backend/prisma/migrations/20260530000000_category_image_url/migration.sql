-- Optional storefront/admin label image (emoji/icon stays in icon column)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
