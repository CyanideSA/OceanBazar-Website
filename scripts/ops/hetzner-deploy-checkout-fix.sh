#!/bin/bash
# Deploy Pay now / Pay later checkout fix on Hetzner production.
# Run on the server as root from anywhere:
#   bash /root/oceanbazar/scripts/ops/hetzner-deploy-checkout-fix.sh
set -euo pipefail
cd /root/oceanbazar

REF="${1:-origin/master}"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.neon.yml --profile full --profile production)

echo "==> Fetch ${REF}"
git fetch origin
git checkout master
git reset --hard "${REF}"

echo "==> Prisma migrate"
"${COMPOSE[@]}" run --rm --no-deps \
  -v "$(pwd)/backend:/app" \
  api sh -c 'npx prisma@5.22.0 migrate deploy && npx prisma@5.22.0 generate'

echo "==> Rebuild payment path (api + live web + lite + admin)"
"${COMPOSE[@]}" build api web web_lite admin

echo "==> Recreate services"
"${COMPOSE[@]}" up -d api web web_lite admin
"${COMPOSE[@]}" up -d --no-deps --force-recreate nginx || true

echo "==> Reload nginx"
sleep 4
docker exec oceanbazar_nginx nginx -t
docker exec oceanbazar_nginx nginx -s reload || true

echo "==> Health"
sleep 8
curl -sf http://127.0.0.1/api/health && echo
curl -sI https://oceanbazar.com.bd/en/checkout | head -8 || true
curl -sI https://oceanbazar.com.bd/lite/en/checkout | head -8 || true

echo "==> Deployed"
git log -1 --oneline
echo "DONE. Test Pay now + Pay later on https://oceanbazar.com.bd/en/checkout and /lite/en/checkout"
