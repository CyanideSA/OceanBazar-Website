#!/bin/bash
set -euo pipefail
cd /root/oceanbazar
git fetch origin master
git checkout origin/master -- \
  frontend/lib/chunkLoadRecovery.ts \
  frontend/components/shared/ChunkLoadRecovery.tsx \
  frontend/docker-entrypoint.sh \
  frontend/Dockerfile \
  frontend/next.config.mjs \
  frontend/app/global-error.tsx \
  docker-compose.yml \
  nginx/nginx.conf
git log -1 --oneline origin/master

docker compose -f docker-compose.yml -f docker-compose.neon.yml --profile full --profile production build web
docker compose -f docker-compose.yml -f docker-compose.neon.yml --profile full --profile production up -d web
docker compose -f docker-compose.yml -f docker-compose.neon.yml --profile full --profile production up -d --force-recreate nginx
sleep 3
docker exec oceanbazar_nginx nginx -t
docker exec oceanbazar_nginx nginx -s reload || true
sleep 6

echo "=== CHUNKS IN CONTAINER ==="
docker exec oceanbazar_web sh -c 'ls /app/.next/static/chunks/1567* /app/.next/static/chunks/1255* 2>&1 | head -20'

echo "=== HTTP CHECKS ==="
for f in \
  1567-3788270a3266b680.js \
  1567-5ce45a98efb3dffa.js \
  1567-8ac12a35dc68de50.js \
  $(docker exec oceanbazar_web sh -c 'ls /app/.next/static/chunks/1567*.js | xargs -n1 basename'); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://oceanbazar.com.bd/_next/static/chunks/$f" || true)
  echo "$code $f"
done

echo "=== WWW REDIRECT ==="
curl -sI https://www.oceanbazar.com.bd/bn | head -12
docker exec oceanbazar_nginx sh -c 'grep -n "server_name www" /etc/nginx/nginx.conf | head'
docker logs --tail 8 oceanbazar_web
