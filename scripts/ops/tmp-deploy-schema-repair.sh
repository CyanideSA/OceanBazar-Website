#!/bin/bash
set -euo pipefail
ROOT=/root/oceanbazar
cd "$ROOT"

echo "==> Apply schema repair SQL"
docker cp "$ROOT/backend/prisma/migrations/20260811190000_prod_schema_repair/migration.sql" oceanbazar_postgres:/tmp/schema_repair.sql
docker exec oceanbazar_postgres psql -U oceanbazar -d oceanbazar -f /tmp/schema_repair.sql

echo "==> Sync updated admin products route + rebuild api"
docker compose --profile production build api
docker compose --profile production up -d api

echo "==> Post-check"
sleep 5
docker exec oceanbazar_bff curl -fsS http://127.0.0.1:4000/api/health || true
echo
docker exec oceanbazar_postgres psql -U oceanbazar -d oceanbazar -tAc "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='products' AND column_name='brand';"
docker exec oceanbazar_postgres psql -U oceanbazar -d oceanbazar -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='product_category_map';"
docker exec oceanbazar_postgres psql -U oceanbazar -d oceanbazar -tAc "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='admin_users' AND column_name='chat_greeting';"
docker exec oceanbazar_postgres psql -U oceanbazar -d oceanbazar -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='tag_groups';"
echo REPAIR_OK
