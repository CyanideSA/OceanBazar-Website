#!/usr/bin/env bash
set -euo pipefail
ROOT=/root/oceanbazar
cd "$ROOT"

echo "==> Apply page_content migration"
docker compose --profile production exec -T api sh -c \
  'npx prisma db execute --file prisma/migrations/20260811220000_site_settings_page_content/migration.sql --schema prisma/schema.prisma' \
  || docker compose --profile production run --rm --no-deps api sh -c \
  'npx prisma db execute --file prisma/migrations/20260811220000_site_settings_page_content/migration.sql --schema prisma/schema.prisma' \
  || true

# Fallback: raw SQL via postgres if prisma execute unavailable
docker compose --profile production exec -T postgres \
  psql -U oceanbazar -d oceanbazar -c 'ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "page_content" JSONB;' \
  || true

echo "==> Rebuild api + admin + web"
docker compose --profile production build api admin web
docker compose --profile production up -d api admin web

echo "==> Reload nginx DNS for admin"
docker exec oceanbazar_nginx nginx -t
docker exec oceanbazar_nginx nginx -s reload || docker restart oceanbazar_nginx

echo "==> Health"
for i in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:4401/api/health >/dev/null 2>&1; then
    echo "api healthy"
    break
  fi
  sleep 2
done

# Clear settings cache so pageContent is visible
docker exec oceanbazar_redis redis-cli DEL storefront:settings >/dev/null 2>&1 || true

code=$(curl -sk -o /dev/null -w '%{http_code}' --resolve admin.oceanbazar.com.bd:443:127.0.0.1 https://admin.oceanbazar.com.bd/ || true)
echo "admin_https=$code"
sf=$(curl -fsS http://127.0.0.1:4401/api/storefront/settings | python3 -c 'import sys,json; d=json.load(sys.stdin); print("pageContent" in d, type(d.get("pageContent")).__name__)' || echo "settings_check_failed")
echo "settings_pageContent=$sf"
echo "DEPLOY_OK"
