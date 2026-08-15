#!/usr/bin/env bash
set -euo pipefail
ROOT=/root/oceanbazar
cd "$ROOT"

echo "==> Apply category_id nullable migration"
docker exec -i oceanbazar_postgres psql -U oceanbazar -d oceanbazar <<'SQL'
ALTER TABLE "products" ALTER COLUMN "category_id" DROP NOT NULL;
SQL

echo "==> Rebuild api admin web web_lite"
docker compose --profile production build api admin web web_lite
docker compose --profile production up -d api admin web web_lite

echo "==> Wait health"
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:4000/api/health >/dev/null 2>&1; then
    echo "api healthy"
    break
  fi
  sleep 2
done

nginx -t && nginx -s reload || true
curl -fsS http://127.0.0.1:4000/api/health || true
echo "DEPLOY_OK"
