-- Add Threads social URL to site settings
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS threads_url VARCHAR(500);
