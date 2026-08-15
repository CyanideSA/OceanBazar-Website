#!/usr/bin/env bash
set -euo pipefail
ROOT=/root/oceanbazar
cd "$ROOT"

echo "==> Rebuild api admin web web_lite (PDP options / attrs / locale batch)"
docker compose --profile production build api admin web web_lite
docker compose --profile production up -d api admin web web_lite

echo "==> Wait health"
for i in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:4000/api/health >/dev/null 2>&1; then
    echo "api healthy"
    break
  fi
  sleep 2
done

nginx -t && nginx -s reload || true
curl -fsS http://127.0.0.1:4000/api/health || true
curl -fsS "http://127.0.0.1:4000/api/products/8BCADD3D?lang=en" | head -c 400 || true
echo ""
echo "DEPLOY_OK"
