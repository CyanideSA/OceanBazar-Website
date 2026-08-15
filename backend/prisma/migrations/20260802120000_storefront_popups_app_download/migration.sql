-- Storefront multi-popup config + app download links + default hero animation
ALTER TABLE "site_settings"
  ADD COLUMN IF NOT EXISTS "storefront_popups" JSONB,
  ADD COLUMN IF NOT EXISTS "app_download" JSONB,
  ADD COLUMN IF NOT EXISTS "default_hero_animation" VARCHAR(64) DEFAULT 'fade';

-- Seed a default welcome popup when none exist yet
UPDATE "site_settings"
SET "storefront_popups" = '[
  {
    "id": "welcome-default",
    "enabled": true,
    "type": "welcome",
    "title": "Welcome to OceanBazar",
    "body": "Authentic products delivered across Bangladesh. Enjoy a special welcome offer.",
    "imageUrl": "/welcome-popup-banner.png?v=5",
    "buttonLabel": "Shop now",
    "buttonAction": "link",
    "buttonUrl": "/en/products",
    "buttonCloseMessage": "",
    "sortOrder": 0,
    "animation": "zoom-in",
    "showToLoggedIn": false,
    "dismissHours": 24,
    "delayMs": 1200
  }
]'::jsonb
WHERE ("storefront_popups" IS NULL OR "storefront_popups"::text IN ('null', '[]'));

UPDATE "site_settings"
SET "app_download" = '{
  "enabled": true,
  "androidUrl": "",
  "iosUrl": "",
  "windowsUrl": "",
  "macUrl": "",
  "bannerText": "Get the OceanBazar app for a faster shopping experience",
  "animation": "slide-down"
}'::jsonb
WHERE ("app_download" IS NULL OR "app_download"::text IN ('null', '{}'));
