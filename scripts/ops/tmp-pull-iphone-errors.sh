#!/bin/bash
set -euo pipefail
echo "=== ORIGIN MASTER ==="
cd /root/oceanbazar
git log -1 --oneline origin/master
echo "=== CACHE HEADERS ==="
curl -sI https://oceanbazar.com.bd/bn | grep -iE 'HTTP|cache-control|x-nextjs' || true
echo "=== FIX MARKERS IN BUILD ==="
docker exec oceanbazar_web sh -c 'grep -Rsl "_obcb\|isIosWebKit\|debug-078c95\|hard cache-bust" /app/.next/static/chunks 2>/dev/null | head -10' || true
echo "=== CHUNK 1567 ==="
docker exec oceanbazar_web sh -c 'ls -la /app/.next/static/chunks/1567* 2>/dev/null || echo NO_1567'
echo "=== CLIENT ERRORS VIA PRISMA ==="
docker cp /root/oceanbazar/scripts/ops/tmp-query-client-errors.js oceanbazar_bff:/app/tmp-query-client-errors.js
docker exec -w /app oceanbazar_bff node /app/tmp-query-client-errors.js | tail -n 80
echo "=== BFF DEBUG LOGS ==="
docker logs --tail 200 oceanbazar_bff 2>&1 | grep -iE 'debug-078c95|client.error|Loading chunk' | tail -30 || true
