#!/bin/bash
# Deploy SSLCommerz Easy Checkout + dual-mode credentials to Hetzner
set -euo pipefail
cd /root/oceanbazar
SRC=/tmp/sslcommerz-deploy
if [ ! -d "$SRC" ]; then
  echo "Missing $SRC — upload bundle first"
  exit 1
fi

setkv() {
  local key="$1" val="$2"
  if grep -q "^${key}=" .env 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  else
    echo "${key}=${val}" >> .env
  fi
}

echo "==> Sync backend payment + settings"
mkdir -p \
  backend/src/services \
  backend/src/routes/admin \
  backend/src/types \
  backend/prisma/migrations/20260811020000_sslcommerz_dual_mode_compliance

cp -f "$SRC/backend/src/services/sslcommerzService.ts" backend/src/services/sslcommerzService.ts
cp -f "$SRC/backend/src/services/paymentAdminService.ts" backend/src/services/paymentAdminService.ts
cp -f "$SRC/backend/src/routes/payments.ts" backend/src/routes/payments.ts
cp -f "$SRC/backend/src/routes/admin/global-settings.ts" backend/src/routes/admin/global-settings.ts
cp -f "$SRC/backend/src/routes/storefront.ts" backend/src/routes/storefront.ts
cp -f "$SRC/backend/src/types/sslcommerz-lts.d.ts" backend/src/types/sslcommerz-lts.d.ts
cp -f "$SRC/backend/prisma/schema.prisma" backend/prisma/schema.prisma
cp -f "$SRC/backend/prisma/migrations/20260811020000_sslcommerz_dual_mode_compliance/migration.sql" \
  backend/prisma/migrations/20260811020000_sslcommerz_dual_mode_compliance/migration.sql
if [ -f "$SRC/backend/prisma/seed.ts" ]; then
  cp -f "$SRC/backend/prisma/seed.ts" backend/prisma/seed.ts
fi
if [ -f "$SRC/docker-compose.yml" ]; then
  cp -f "$SRC/docker-compose.yml" docker-compose.yml
fi

echo "==> Sync admin CRM SSL settings UI"
mkdir -p admin-frontend-react/src/pages admin-frontend-react/src/lib
cp -f "$SRC/admin-frontend-react/src/pages/GlobalSettingsPage.jsx" admin-frontend-react/src/pages/GlobalSettingsPage.jsx
cp -f "$SRC/admin-frontend-react/src/lib/api.js" admin-frontend-react/src/lib/api.js

echo "==> Sync live storefront Easy Checkout"
mkdir -p \
  frontend/lib \
  "frontend/app/[locale]/(shop)/checkout" \
  frontend/components/orders \
  frontend/components/layout \
  frontend/components/checkout \
  frontend/public \
  frontend/messages
cp -f "$SRC/frontend/lib/sslcommerzEasyCheckout.ts" frontend/lib/sslcommerzEasyCheckout.ts
cp -f "$SRC/frontend/lib/orderPayment.ts" frontend/lib/orderPayment.ts
cp -f "$SRC/frontend/lib/api.ts" frontend/lib/api.ts
cp -f "$SRC/frontend/lib/policies.ts" frontend/lib/policies.ts
cp -f "$SRC/frontend/lib/fetchStorefrontCatalog.ts" frontend/lib/fetchStorefrontCatalog.ts
cp -f "$SRC/frontend/app/[locale]/(shop)/checkout/page.tsx" "frontend/app/[locale]/(shop)/checkout/page.tsx"
cp -f "$SRC/frontend/components/orders/OrderDetailClient.tsx" frontend/components/orders/OrderDetailClient.tsx
cp -f "$SRC/frontend/components/layout/Footer.tsx" frontend/components/layout/Footer.tsx
cp -f "$SRC/frontend/components/layout/PaymentLogos.tsx" frontend/components/layout/PaymentLogos.tsx
cp -f "$SRC/frontend/components/checkout/PaymentMethodSelector.tsx" frontend/components/checkout/PaymentMethodSelector.tsx
cp -f "$SRC/frontend/app/[locale]/(shop)/contact/ContactPageClient.tsx" "frontend/app/[locale]/(shop)/contact/ContactPageClient.tsx"
cp -f "$SRC/frontend/messages/en.json" frontend/messages/en.json
cp -f "$SRC/frontend/messages/bn.json" frontend/messages/bn.json
cp -f "$SRC/frontend/public/sslcommerz-payments.svg" frontend/public/sslcommerz-payments.svg 2>/dev/null || true
cp -f "$SRC/frontend/public/sslcommerz-payments.png" frontend/public/sslcommerz-payments.png 2>/dev/null || true

echo "==> Sync lite storefront Easy Checkout + compliance"
mkdir -p \
  frontend-lite/src/routes \
  frontend-lite/src/content \
  frontend-lite/views/partials \
  frontend-lite/views \
  frontend-lite/locales \
  frontend-lite/public
cp -f "$SRC/frontend-lite/src/routes/checkout.js" frontend-lite/src/routes/checkout.js
cp -f "$SRC/frontend-lite/src/content/policies.js" frontend-lite/src/content/policies.js
cp -f "$SRC/frontend-lite/views/checkout.ejs" frontend-lite/views/checkout.ejs
cp -f "$SRC/frontend-lite/views/checkout-ssl-pay.ejs" frontend-lite/views/checkout-ssl-pay.ejs
cp -f "$SRC/frontend-lite/views/contact.ejs" frontend-lite/views/contact.ejs
cp -f "$SRC/frontend-lite/views/product.ejs" frontend-lite/views/product.ejs
cp -f "$SRC/frontend-lite/views/partials/footer.ejs" frontend-lite/views/partials/footer.ejs
cp -f "$SRC/frontend-lite/locales/en.json" frontend-lite/locales/en.json
cp -f "$SRC/frontend-lite/locales/bn.json" frontend-lite/locales/bn.json
cp -f "$SRC/frontend-lite/public/sslcommerz-payments.svg" frontend-lite/public/sslcommerz-payments.svg 2>/dev/null || true

echo "==> Write dual SSLCommerz credentials (sandbox active for testing)"
# Prefer values already exported; else use bundle env file (never log passwords)
if [ -f "$SRC/ssl.env" ]; then
  # shellcheck disable=SC1090
  source "$SRC/ssl.env"
fi
MODE="${SSLCOMMERZ_MODE:-sandbox}"
SANDBOX_ID="${SSLCOMMERZ_SANDBOX_STORE_ID:-ocean6a27465f2ef57}"
SANDBOX_PW="${SSLCOMMERZ_SANDBOX_STORE_PASSWORD:-ocean6a27465f2ef57@ssl}"
LIVE_ID="${SSLCOMMERZ_LIVE_STORE_ID:-oceanbazarcombd0live}"
LIVE_PW="${SSLCOMMERZ_LIVE_STORE_PASSWORD:-}"
if [ -z "$LIVE_PW" ]; then
  echo "ERROR: SSLCOMMERZ_LIVE_STORE_PASSWORD missing in $SRC/ssl.env"
  exit 1
fi
setkv SSLCOMMERZ_MODE "$MODE"
setkv SSLCOMMERZ_SANDBOX "$([ "$MODE" = live ] && echo false || echo true)"
setkv SSLCOMMERZ_SANDBOX_STORE_ID "$SANDBOX_ID"
setkv SSLCOMMERZ_SANDBOX_STORE_PASSWORD "$SANDBOX_PW"
setkv SSLCOMMERZ_LIVE_STORE_ID "$LIVE_ID"
setkv SSLCOMMERZ_LIVE_STORE_PASSWORD "$LIVE_PW"
if [ "$MODE" = live ]; then
  setkv SSLCOMMERZ_STORE_ID "$LIVE_ID"
  setkv SSLCOMMERZ_STORE_PASSWORD "$LIVE_PW"
else
  setkv SSLCOMMERZ_STORE_ID "$SANDBOX_ID"
  setkv SSLCOMMERZ_STORE_PASSWORD "$SANDBOX_PW"
fi

# Ensure payment callback base URL stays on public API (already domain on this host)
setkv API_BASE_URL "${API_BASE_URL:-https://api.oceanbazar.com.bd}"
# Keep SSL origins in CORS
if ! grep -q 'sandbox.sslcommerz.com' .env; then
  cur=$(grep '^CORS_ALLOWED_ORIGINS=' .env | cut -d= -f2- || true)
  setkv CORS_ALLOWED_ORIGINS "${cur},https://sandbox.sslcommerz.com,https://securepay.sslcommerz.com,https://seamless-epay.sslcommerz.com"
fi

echo "==> Prisma migrate"
docker compose -f docker-compose.yml -f docker-compose.neon.yml run --rm --no-deps \
  -v "$(pwd)/backend:/app" api sh -c 'npx prisma@5.22.0 migrate deploy'

echo "==> Rebuild api admin web web_lite"
docker compose -f docker-compose.yml -f docker-compose.neon.yml --profile full --profile production \
  build api admin web web_lite

echo "==> Restart api admin web web_lite"
docker compose -f docker-compose.yml -f docker-compose.neon.yml --profile full --profile production \
  up -d api admin web web_lite

echo "==> Reload nginx"
docker exec oceanbazar_nginx nginx -t && docker exec oceanbazar_nginx nginx -s reload || true

sleep 10
echo "==> Verify"
curl -sf https://api.oceanbazar.com.bd/api/health && echo
curl -sf https://api.oceanbazar.com.bd/api/payments/sslcommerz/config && echo
curl -sS -o /dev/null -w 'web:%{http_code}\n' https://oceanbazar.com.bd/en || true
curl -sS -o /dev/null -w 'lite:%{http_code}\n' https://oceanbazar.com.bd/lite/en || true

echo "DONE — SSLCommerz mode=$MODE (sandbox store=$SANDBOX_ID, live store=$LIVE_ID)"
