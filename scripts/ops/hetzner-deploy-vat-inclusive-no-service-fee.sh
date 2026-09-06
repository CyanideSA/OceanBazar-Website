#!/bin/bash
# Deploy VAT-inclusive checkout (7.5% backed out of listed prices), no service fee,
# invoice parity + one-page print, and system-wide email/invoice branding.
# Builds api/admin/web_lite first (critical path), then web separately (can hang on Google Fonts).
set -euo pipefail
cd /root/oceanbazar

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.neon.yml --profile full --profile production)

echo "==> Verify key files and changed lines are present"
test -f backend/src/services/taxVatSystem.ts
test -f admin-frontend-react/src/pages/FinanceVatPage.jsx
grep -q 'GST_RATE = 0.075' backend/src/utils/pricing.ts
grep -q 'BASE_SERVICE_FEE = 0' backend/src/utils/pricing.ts
grep -q 'BASE_SERVICE_FEE = 0' frontend/lib/pricing.ts
grep -q 'BASE_SERVICE_FEE = 0' frontend-lite/src/helpers.js
grep -q "priceInclusive: true" frontend/lib/checkoutTotals.ts
grep -q "priceInclusive: true" frontend-lite/src/helpers.js
grep -q 'vatInclusive: true' frontend/lib/checkoutTotals.ts
grep -q 'priceInclusive: true' backend/src/services/taxVatSystem.ts
grep -qi 'OceanBazar standard inclusive VAT' backend/src/services/taxVatSystem.ts
grep -q 'contact@oceanbazar.com.bd' backend/src/services/emailService.ts
grep -q '+880 1349 358 825' backend/src/services/emailService.ts
grep -q 'ob-brand-logo.png' backend/src/services/emailService.ts
grep -q 'print-scale' frontend-lite/views/invoice.ejs
# Service fee row must be gone from every customer-facing surface
! grep -q "t('lineService')" frontend/app/'[locale]'/'(shop)'/checkout/page.tsx
! grep -q "t('lineService')" frontend/components/checkout/GuestCheckoutPanel.tsx
! grep -q "lineService" frontend-lite/views/checkout.ejs
! grep -q "lineService" frontend-lite/views/checkout-guest.ejs
# Leftover debug telemetry must not ship
! grep -rq '127.0.0.1:7896' backend/src frontend/app frontend/lib frontend/components frontend-lite/src frontend-lite/views admin-frontend-react/src
echo "files ok"

echo "==> Stop any stuck buildx/next from prior deploy"
pkill -f 'next build' 2>/dev/null || true
docker builder prune -f --filter until=1h >/dev/null 2>&1 || true

echo "==> Rebuild critical path: api + web_lite + admin"
"${COMPOSE[@]}" build --pull=false api web_lite admin
"${COMPOSE[@]}" up -d --no-deps --force-recreate api web_lite admin

echo "==> Re-seed tax policy (price_inclusive = TRUE) and verify live policy"
sleep 8
"${COMPOSE[@]}" exec -T api node -e "
const { ensureTaxVatSchema, getActiveTaxPolicy, getActiveGatewayFeePolicy } = require('./dist/services/taxVatSystem');
const { calculateOrderTotals } = require('./dist/utils/pricing');
(async () => {
  await ensureTaxVatSchema();
  const tax = await getActiveTaxPolicy();
  const fee = await getActiveGatewayFeePolicy();
  // Worked example: advertised 1750 (VAT-inclusive) + 80 shipping = 1830 due.
  const totals = calculateOrderTotals(1750, 0, 0, {
    vatRate: tax.vatRate,
    priceInclusive: tax.priceInclusive,
    retailQuantityOrder: true,
  });
  console.log(JSON.stringify({ tax, gatewayPassThrough: fee.passThroughToCustomer, totals }));
  if (!tax.priceInclusive) { console.error('FAIL: tax policy is not price-inclusive'); process.exit(1); }
  if (totals.serviceFee !== 0) { console.error('FAIL: service fee is not zero'); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
"

echo "==> Enforce business contact + logo in site_settings (single source of truth)"
"${COMPOSE[@]}" exec -T api node -e "
const { prisma } = require('./dist/lib/prisma');
(async () => {
  const row = await prisma.site_settings.findFirst();
  const data = {
    support_email: 'contact@oceanbazar.com.bd',
    support_phone: '+880 1349 358 825',
    logo_light_url: '/ob-brand-logo.png?v=10',
    logo_dark_url: '/ob-brand-logo.png?v=10',
  };
  if (row) await prisma.site_settings.update({ where: { id: row.id }, data });
  else await prisma.site_settings.create({ data: { id: 'default', ...data } });
  const after = await prisma.site_settings.findFirst();
  console.log(JSON.stringify({
    supportEmail: after.support_email,
    supportPhone: after.support_phone,
    logoLight: after.logo_light_url,
  }));
})().catch((e) => { console.error(e); process.exit(1); });
" || echo "site_settings_update:check_logs"

echo "==> Rebuild web (may take longer; Google Fonts retries)"
if timeout 15m "${COMPOSE[@]}" build --pull=false web; then
  "${COMPOSE[@]}" up -d --no-deps --force-recreate web
else
  echo "WARN: web image build timed out or failed — lite/api/admin still updated"
fi

echo "==> Rebuild java_api (cart preview pricing constants)"
if timeout 12m "${COMPOSE[@]}" build --pull=false java_api; then
  "${COMPOSE[@]}" up -d --no-deps --force-recreate java_api
else
  echo "WARN: java_api build skipped/failed — Node checkout path is authoritative"
fi

echo "==> Refresh nginx"
"${COMPOSE[@]}" up -d --force-recreate --no-deps nginx || true
sleep 4
docker exec oceanbazar_nginx nginx -t
docker exec oceanbazar_nginx nginx -s reload || true

echo "==> Smoke"
sleep 10
curl -sf http://127.0.0.1/api/health && echo
curl -sk -o /dev/null -w "live_checkout:%{http_code}\n" --resolve oceanbazar.com.bd:443:127.0.0.1 https://oceanbazar.com.bd/en/checkout || true
curl -sk -o /dev/null -w "lite_checkout:%{http_code}\n" --resolve oceanbazar.com.bd:443:127.0.0.1 https://oceanbazar.com.bd/lite/en/checkout || true
curl -sk -o /dev/null -w "storefront_settings:%{http_code}\n" --resolve oceanbazar.com.bd:443:127.0.0.1 https://oceanbazar.com.bd/api/storefront/settings || true

echo ""
echo "VAT_INCLUSIVE_NO_SERVICE_FEE_DEPLOY_DONE"
echo "Manual checks:"
echo "  Checkout: Subtotal (excl. VAT) + VAT (7.5%) + Shipping = Total due (= listed price + shipping)"
echo "  Checkout: no Service fee row; VAT hint reads 7.5% (not 8%)"
echo "  Product page / homepage / ads feed prices unchanged"
echo "  Invoice (live + lite): Subtotal (excl. VAT), VAT (7.5%), no Service Fee, one page on phone/tablet/desktop"
echo "  Invoice + emails: OceanBazar logo, contact@oceanbazar.com.bd, +880 1349 358 825"
