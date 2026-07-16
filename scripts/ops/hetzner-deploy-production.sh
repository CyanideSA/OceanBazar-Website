#!/bin/bash
# Full production deploy on Hetzner: URLs, content-id build, migrate, stack up
set -euo pipefail
cd /root/oceanbazar

echo "==> Production URLs"
bash scripts/ops/hetzner-production-urls.sh

echo "==> Disable dev compose override"
mv docker-compose.override.yml docker-compose.override.yml.disabled 2>/dev/null || true

echo "==> Content-ID SPA"
if [ -d content-id-frontend ]; then
  cd content-id-frontend
  echo "VITE_CONTENT_ID_API_URL=https://api.oceanbazar.com.bd" > .env
  npm ci || npm install
  npm run build
  cd ..
else
  echo "WARN: content-id-frontend missing — skip build"
  mkdir -p content-id-frontend/dist
fi

echo "==> Prisma migrate (Neon)"
docker compose -f docker-compose.yml -f docker-compose.neon.yml run --rm --no-deps \
  -v "$(pwd)/backend:/app" api sh -c 'npx prisma@5.22.0 migrate deploy'

echo "==> Rebuild + start stack"
docker compose -f docker-compose.yml -f docker-compose.neon.yml \
  --profile full --profile production up -d --build

echo "==> Reload nginx"
docker exec oceanbazar_nginx nginx -t
docker exec oceanbazar_nginx nginx -s reload

echo "==> Health"
sleep 8
curl -sf http://127.0.0.1/api/health && echo
curl -sI http://127.0.0.1/ | head -3

echo "Done. Point DNS A records to this server, then run certbot for HTTPS."
