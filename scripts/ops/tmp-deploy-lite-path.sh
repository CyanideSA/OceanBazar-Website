#!/bin/bash
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
  scripts/ops/hetzner-production-urls.sh

bash scripts/ops/hetzner-production-urls.sh

docker compose -f docker-compose.yml -f docker-compose.neon.yml --profile full --profile production build web_lite web
docker compose -f docker-compose.yml -f docker-compose.neon.yml --profile full --profile production up -d web_lite web
docker compose -f docker-compose.yml -f docker-compose.neon.yml --profile full --profile production up -d --force-recreate nginx
sleep 4
docker exec oceanbazar_nginx nginx -t
docker exec oceanbazar_nginx nginx -s reload || true
sleep 3

echo "=== health ==="
docker exec oceanbazar_web_lite node -e 'fetch("http://127.0.0.1:3001/health").then(r=>r.json()).then(console.log)'

echo "=== public /lite/bn ==="
curl -sI "https://oceanbazar.com.bd/lite/bn" | head -15
curl -sL "https://oceanbazar.com.bd/lite/bn" | head -c 400; echo

echo "=== iOS15 UA redirect target ==="
curl -sI -A "Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 Version/15.6 Mobile/15E148 Safari/604.1" \
  "https://oceanbazar.com.bd/bn" | head -12

git log -1 --oneline origin/master
