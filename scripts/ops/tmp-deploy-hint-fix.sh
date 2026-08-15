#!/bin/bash
set -euo pipefail
cd /root/oceanbazar
git fetch origin master
git checkout origin/master -- frontend/app/layout.tsx
docker compose -f docker-compose.yml -f docker-compose.neon.yml --profile full --profile production build web
docker compose -f docker-compose.yml -f docker-compose.neon.yml --profile full --profile production up -d --force-recreate web
sleep 8
echo "=== hint snippet ==="
curl -sL https://oceanbazar.com.bd/bn | grep -o 'willRedirect[^,]*,' | head -5 || true
curl -sL https://oceanbazar.com.bd/bn | grep -c 'hardwareConcurrency' || true
curl -sL https://oceanbazar.com.bd/bn | grep -c 'willRedirect' || true
echo "=== iOS18 still 200 ==="
curl -sI -A "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Version/26 Mobile/15E148 Safari/604.1" https://oceanbazar.com.bd/bn | head -8
git log -1 --oneline origin/master
