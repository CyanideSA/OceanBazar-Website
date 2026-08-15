#!/usr/bin/env bash
set -euo pipefail
ROOT=/root/oceanbazar
cd "$ROOT"

echo "==> Rebuild api + admin"
docker compose --profile production build api admin
docker compose --profile production up -d api admin

echo "==> Reload nginx (refresh upstream DNS + new conf)"
docker cp "$ROOT/nginx/nginx.conf" oceanbazar_nginx:/etc/nginx/nginx.conf
docker exec oceanbazar_nginx nginx -t
docker exec oceanbazar_nginx nginx -s reload || docker restart oceanbazar_nginx

echo "==> Health checks"
for i in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:4401/api/health >/dev/null 2>&1 || curl -fsS http://127.0.0.1:4000/api/health >/dev/null 2>&1; then
    echo "api healthy"
    break
  fi
  sleep 2
done

code=$(curl -sk -o /dev/null -w '%{http_code}' --resolve admin.oceanbazar.com.bd:443:127.0.0.1 https://admin.oceanbazar.com.bd/ || true)
echo "admin_https=$code"
echo "DEPLOY_OK"
