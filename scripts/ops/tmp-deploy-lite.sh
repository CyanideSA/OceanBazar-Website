#!/bin/bash
# Deploy OceanBazar Lite storefront + nginx routing on Hetzner.
set -euo pipefail
cd /root/oceanbazar

git fetch origin master
git checkout origin/master -- \
  frontend-lite \
  frontend/app/layout.tsx \
  frontend/components/layout/Footer.tsx \
  frontend/Dockerfile \
  docker-compose.yml \
  nginx/nginx.conf \
  scripts/ops/hetzner-enable-https.sh \
  scripts/ops/hetzner-production-urls.sh

bash scripts/ops/hetzner-production-urls.sh

echo "==> Build web_lite (+ web for device-hint + footer toggle)"
docker compose -f docker-compose.yml -f docker-compose.neon.yml --profile full --profile production build web_lite web

echo "==> Up web_lite + web + recreate nginx"
docker compose -f docker-compose.yml -f docker-compose.neon.yml --profile full --profile production up -d web_lite web
docker compose -f docker-compose.yml -f docker-compose.neon.yml --profile full --profile production up -d --force-recreate nginx

sleep 4
docker exec oceanbazar_nginx nginx -t
docker exec oceanbazar_nginx nginx -s reload || true
sleep 3

echo "==> Health"
docker exec oceanbazar_web_lite node -e "fetch('http://127.0.0.1:3001/health').then(r=>r.text()).then(t=>console.log(t)).catch(e=>{console.error(e);process.exit(1)})"

echo "==> Direct container home"
docker exec oceanbazar_web_lite node -e "fetch('http://127.0.0.1:3001/bn').then(r=>console.log('status',r.status)).catch(e=>{console.error(e);process.exit(1)})"

echo "==> Public lite (may fail until DNS + cert SAN)"
curl -sI "https://lite.oceanbazar.com.bd/bn" | head -15 || true

echo "==> UA redirect from main (iPhone OS 15)"
curl -sI -A "Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 Version/15.6 Mobile/15E148 Safari/604.1" \
  "https://oceanbazar.com.bd/bn" | head -15 || true

echo "DONE. If lite HTTPS fails: add DNS A lite.oceanbazar.com.bd → server IP, then:"
echo "  bash scripts/ops/hetzner-enable-https.sh"
git log -1 --oneline origin/master
