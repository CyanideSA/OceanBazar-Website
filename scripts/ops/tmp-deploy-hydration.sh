#!/bin/bash
set -euo pipefail
cd /root/oceanbazar
git fetch origin master
git checkout origin/master -- \
  frontend/components/layout/ShopShell.tsx \
  frontend/components/layout/Header.tsx \
  frontend/components/shared/NavigationLoadingOverlay.tsx \
  frontend/components/shared/NavigationLoadingContext.tsx \
  frontend/components/shared/HydrationProbe.tsx \
  frontend/lib/legacyDevice.ts \
  frontend/components/product/ProductCard.tsx
git log -1 --oneline origin/master
docker compose -f docker-compose.yml -f docker-compose.neon.yml --profile full --profile production build web
docker compose -f docker-compose.yml -f docker-compose.neon.yml --profile full --profile production up -d web
docker exec oceanbazar_nginx nginx -s reload
sleep 7
echo "=== HOME SCRIPT CHUNKS (should not require 9878 framer for first paint) ==="
curl -sL https://oceanbazar.com.bd/bn | tr '"' '\n' | grep -E '_next/static/chunks/.*\.js' | grep -v '\\' | sort -u | head -40
echo "=== 9878 present in initial HTML? ==="
curl -sL https://oceanbazar.com.bd/bn | tr '"' '\n' | grep 9878 || echo "NO_9878_IN_INITIAL_HTML"
echo "=== HYDRATION PROBE IN BUILD? ==="
docker exec oceanbazar_web sh -c 'grep -Rsl "shop shell hydrated\|HydrationProbe\|legacyStorefront" /app/.next/static/chunks 2>/dev/null | head -8'
curl -sI https://oceanbazar.com.bd/bn | head -5
docker logs --tail 8 oceanbazar_web
