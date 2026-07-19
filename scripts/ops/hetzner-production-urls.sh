#!/bin/bash
# Set production .com.bd URLs on Hetzner (run from /root/oceanbazar)
set -euo pipefail
cd "$(dirname "$0")/../.."
ROOT="$(pwd)"

setkv() {
  local key="$1" val="$2"
  if grep -q "^${key}=" .env 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  else
    echo "${key}=${val}" >> .env
  fi
}

BASE="${PROD_BASE:-https://oceanbazar.com.bd}"
API="${PROD_API:-https://api.oceanbazar.com.bd}"
ADMIN="${PROD_ADMIN:-https://admin.oceanbazar.com.bd}"
CONTENTID="${PROD_CONTENTID:-https://contentid.oceanbazar.com.bd}"

setkv CLIENT_URL "$BASE"
setkv ADMIN_URL "$ADMIN"
setkv BFF_PUBLIC_BASE_URL "$API"
setkv JAVA_PUBLIC_BASE_URL "$API"
# Payment gateways (SSLCommerz/Nagad) build their success/fail/IPN callback
# URLs from API_BASE_URL — it must be the public API origin, never localhost.
setkv API_BASE_URL "$API"
setkv PUBLIC_BASE_URL "$API"
# Include every hostname nginx serves (www + .com variants) — any origin missing
# here gets CORS-blocked in the browser (page loads but all API calls fail).
WWW_BASE="${BASE/https:\/\//https://www.}"
COM_ORIGINS="https://oceanbazar.com,https://www.oceanbazar.com,https://admin.oceanbazar.com,https://contentid.oceanbazar.com"
setkv CORS_ALLOWED_ORIGINS "${BASE},${WWW_BASE},${ADMIN},${CONTENTID},${COM_ORIGINS}"
setkv TRUST_PROXY 1

setkv NEXT_PUBLIC_SITE_URL "$BASE"
setkv NEXT_PUBLIC_API_URL "$API"
setkv NEXT_PUBLIC_ADMIN_CRM_URL "$ADMIN"

setkv VITE_ADMIN_API_URL "$ADMIN"
setkv VITE_MAINTENANCE_PAGE_URL "${BASE}/en/maintenance"
setkv VITE_MAINTENANCE_COOKIE_DOMAIN .oceanbazar.com.bd

setkv CONTENT_ID_APP_URL "$CONTENTID"
setkv MS_CONTENT_ID_REDIRECT_URI "${API}/api/content-id/auth/sso/microsoft/callback"
setkv MS_SSO_REDIRECT_URI "${API}/api/admin/auth/sso/microsoft/callback"

setkv MAINTENANCE_MODE false
setkv MAINTENANCE_COOKIE_DOMAIN .oceanbazar.com.bd

echo "production URLs written to .env"
echo "  storefront: $BASE"
echo "  admin:      $ADMIN"
echo "  api:        $API"
echo "  contentid:  $CONTENTID"
