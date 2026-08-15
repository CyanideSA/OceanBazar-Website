#!/bin/bash
set -euo pipefail
echo "=== LIVE 1567/1255 ==="
docker exec oceanbazar_web sh -c 'ls -la /app/.next/static/chunks/1567* /app/.next/static/chunks/1255* 2>&1; echo HISTORY; ls /var/ob-static-history/chunks/1567* 2>&1 | head -10; echo ENTRY; sed -n "1,50p" /docker-entrypoint.sh'
echo "=== CURL CHUNKS ==="
for f in \
  1567-3788270a3266b680.js \
  1567-5ce45a98efb3dffa.js \
  $(docker exec oceanbazar_web sh -c 'ls /app/.next/static/chunks/1567*.js | xargs -n1 basename'); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://oceanbazar.com.bd/_next/static/chunks/$f" || true)
  echo "$code $f"
done
echo "=== NGINX WWW ==="
grep -n "www.oceanbazar\|return 301" /root/oceanbazar/nginx/nginx.conf | head -30
docker exec oceanbazar_nginx sh -c 'grep -n "www.oceanbazar\|return 301" /etc/nginx/nginx.conf | head -30'
curl -sI https://www.oceanbazar.com.bd/bn | head -12
