#!/bin/bash
set -euo pipefail
echo "=== BUILD ==="
git -C /root/oceanbazar log -1 --oneline origin/master
echo "=== LIVE 1567 ==="
docker exec oceanbazar_web sh -c 'ls -la /app/.next/static/chunks/1567* 2>/dev/null || echo none'
echo "=== RECENT CLIENT ERRORS ==="
docker cp /root/oceanbazar/scripts/ops/tmp-query-client-errors.js oceanbazar_bff:/app/tmp-query-client-errors.js
docker exec -w /app oceanbazar_bff node /app/tmp-query-client-errors.js | head -n 60
echo "=== HOME HTML CHUNK REFS ==="
curl -sL https://oceanbazar.com.bd/bn | tr '"' '\n' | grep -E 'static/chunks/1567|static/chunks/1255|static/chunks/4bd1' | head -20
echo "=== SAMPLE NEW CHUNK HEAD ==="
NEW=$(docker exec oceanbazar_web sh -c 'ls /app/.next/static/chunks/1567*.js | head -1')
echo "file=$NEW"
curl -sI "https://oceanbazar.com.bd/_next/static/chunks/$(basename "$NEW")" | head -15
