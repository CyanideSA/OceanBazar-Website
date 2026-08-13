#!/usr/bin/env bash
# OceanBazar — Cloud Agent install (idempotent repository bootstrap).
# Prepares durable state: system packages, local PostgreSQL + Redis, database
# schema/seed, JS dependencies, and the Spring Boot jar. Safe to re-run.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PG_PORT=5433
PG_CONF="/etc/postgresql/16/main/postgresql.conf"
DB_URL="postgresql://oceanbazar:secret@127.0.0.1:${PG_PORT}/oceanbazar?schema=public"

echo "== [1/7] System packages =="
if ! command -v psql >/dev/null 2>&1 || ! command -v redis-server >/dev/null 2>&1 || ! command -v mvn >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  sudo apt-get update -qq
  sudo apt-get install -y -qq postgresql postgresql-contrib redis-server maven
fi

echo "== [2/7] Start PostgreSQL (port ${PG_PORT}) + Redis =="
sudo sed -i "s/^#\?port = .*/port = ${PG_PORT}/" "$PG_CONF"
sudo pg_ctlcluster 16 main start 2>/dev/null || sudo pg_ctlcluster 16 main restart
sudo redis-server /etc/redis/redis.conf --daemonize yes 2>/dev/null || true
for _ in $(seq 1 30); do
  sudo -u postgres psql -p "$PG_PORT" -c "SELECT 1" >/dev/null 2>&1 && break
  sleep 1
done

echo "== [3/7] Database role, database, extensions =="
sudo -u postgres psql -p "$PG_PORT" -tc "SELECT 1 FROM pg_roles WHERE rolname='oceanbazar'" | grep -q 1 \
  || sudo -u postgres psql -p "$PG_PORT" -c "CREATE ROLE oceanbazar LOGIN PASSWORD 'secret' SUPERUSER"
sudo -u postgres psql -p "$PG_PORT" -tc "SELECT 1 FROM pg_database WHERE datname='oceanbazar'" | grep -q 1 \
  || sudo -u postgres createdb -p "$PG_PORT" -O oceanbazar oceanbazar
PGPASSWORD=secret psql -h 127.0.0.1 -p "$PG_PORT" -U oceanbazar -d oceanbazar \
  -c "CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS btree_gin;"

echo "== [4/7] Local env files (created only if missing) =="
if [ ! -f backend/.env ]; then
  cat > backend/.env <<EOF
NODE_ENV=development
PORT=4000
CLIENT_URL=http://localhost:3000
ADMIN_URL=http://localhost:5173
JAVA_API_URL=http://127.0.0.1:8000
DATABASE_URL="${DB_URL}"
DIRECT_URL="${DB_URL}"
REDIS_URL=redis://127.0.0.1:6379
JWT_ACCESS_SECRET=oceanbazar_dev_access_secret_change_in_production_32chars
JWT_REFRESH_SECRET=oceanbazar_dev_refresh_secret_change_in_production_32chars
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
OTP_EXPIRE_MINUTES=10
OTP_TERMINAL_ONLY=true
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=50
PUBLIC_BASE_URL=http://127.0.0.1:8000
API_BASE_URL=http://127.0.0.1:4000
EOF
fi
if [ ! -f frontend/.env.local ]; then
  cat > frontend/.env.local <<'EOF'
NEXT_PUBLIC_API_URL=http://127.0.0.1:4000
NEXT_PUBLIC_ADMIN_CRM_URL=http://127.0.0.1:5173
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
NEXT_PUBLIC_LIVE_CHAT_ENABLED=true
EOF
fi
if [ ! -f admin-frontend-react/.env.local ]; then
  cat > admin-frontend-react/.env.local <<'EOF'
VITE_ADMIN_API_URL=http://127.0.0.1:4000
ADMIN_DEV_PROXY_API=http://127.0.0.1:4000
VITE_WS_URL=http://127.0.0.1:8000
VITE_STOREFRONT_URL=http://127.0.0.1:3000
EOF
fi

echo "== [5/7] Install JS dependencies =="
(cd backend && npm install)
(cd frontend && npm install --legacy-peer-deps)
(cd admin-frontend-react && npm install)

echo "== [6/7] Prisma generate + schema push + seed =="
cd backend
npx prisma generate
# The Prisma migration history is interleaved with Java/Flyway-owned tables and
# cannot run standalone on an empty DB; the schema is a complete superset, so we
# push it directly for local development.
npx prisma db push --skip-generate --accept-data-loss
PGPASSWORD=secret psql -h 127.0.0.1 -p "$PG_PORT" -U oceanbazar -d oceanbazar -f prisma/dev-fix-updated-at-defaults.sql
# seed uses transpile-only to avoid an unrelated tsconfig lib type-check issue.
TS_NODE_TRANSPILE_ONLY=1 npx ts-node prisma/seed.ts
cd "$ROOT"

echo "== [7/7] Build Spring Boot Core API jar =="
(cd backend-java && mvn -q -DskipTests package)

echo "OceanBazar install complete."
