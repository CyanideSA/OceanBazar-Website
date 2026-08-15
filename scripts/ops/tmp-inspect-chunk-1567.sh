#!/bin/bash
set -euo pipefail
echo "=== HEAD chunk ==="
curl -sI "https://oceanbazar.com.bd/_next/static/chunks/1567-3788270a3266b680.js" | head -20
echo "=== FETCH STATUS FROM IPHONE-LIKE ==="
curl -s -o /tmp/c1567.js -w "http=%{http_code} size=%{size_download}\n" "https://oceanbazar.com.bd/_next/static/chunks/1567-3788270a3266b680.js"
echo "=== STRINGS ==="
# printable identifiers / package hints
tr -c 'A-Za-z0-9_./@-' '\n' < /tmp/c1567.js | grep -E '.{4,}' | sort -u | head -80
echo "=== FIRST 800 CHARS ==="
head -c 800 /tmp/c1567.js; echo
echo "=== WWW HEAD ==="
curl -sI "https://www.oceanbazar.com.bd/_next/static/chunks/1567-3788270a3266b680.js" | head -15
# nginx config for static
echo "=== NGINX STATIC ==="
grep -RIn "static\|_next\|cache" /root/oceanbazar/nginx 2>/dev/null | head -40 || true
