-- Contact page editable fields (address + business inquiry email)
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS contact_address VARCHAR(1000);
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS business_inquiry_email VARCHAR(255);
