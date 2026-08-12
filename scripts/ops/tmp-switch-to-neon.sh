#!/bin/bash
set -euo pipefail
ROOT=/root/oceanbazar
cd "$ROOT"

# Ensure DIRECT_URL exists for Prisma (prefer non-pooler host if pooler URL is used)
if ! grep -qE '^DIRECT_URL=' .env; then
  DB_URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2-)
  DIRECT=$(echo "$DB_URL" | sed 's/-pooler//')
  echo "DIRECT_URL=$DIRECT" >> .env
  echo "Added DIRECT_URL to .env"
fi

echo "==> Effective URLs (redacted)"
grep -E '^(DATABASE_URL|DIRECT_URL|JAVA_DATABASE_URL)=' .env | sed 's/:[^:@]*@/:***@/'

echo "==> Apply schema repair against Neon"
NEON_URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2-)
# Use a throwaway postgres client container to run SQL against Neon
docker run --rm -v "$ROOT/backend/prisma/migrations/20260811190000_prod_schema_repair/migration.sql:/repair.sql:ro" postgres:16-alpine \
  sh -c "psql \"$NEON_URL\" -v ON_ERROR_STOP=1 -f /repair.sql"

echo "==> Recreate api + java_api with Neon overlay (DB_USER/DB_PASSWORD)"
# Always include docker-compose.neon.yml so java_api does not keep local
# oceanbazar/secret creds while JAVA_DATABASE_URL points at Neon.
docker compose -f docker-compose.yml -f docker-compose.neon.yml --profile production \
  up -d --force-recreate api java_api

echo "==> Wait and verify"
sleep 8
docker exec oceanbazar_bff printenv DATABASE_URL | sed 's/:[^:@]*@/:***@/'
docker exec oceanbazar_bff curl -fsS http://127.0.0.1:4000/api/health; echo
docker exec oceanbazar_bff node -e 'const {PrismaClient}=require("@prisma/client");(async()=>{const p=new PrismaClient(); const n=await p.product.count(); const a=await p.adminUser.count(); console.log(JSON.stringify({products:n,admins:a})); await p.$disconnect();})().catch(e=>{console.error(e.message); process.exit(1)})'
echo SWITCH_OK
