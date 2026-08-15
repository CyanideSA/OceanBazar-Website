#!/bin/bash
set -euo pipefail
docker exec oceanbazar_web sh -c '
f=/app/.next/static/chunks/9878-a58b9df3cc1c874d.js
wc -c "$f"
# unique strings
tr -c "A-Za-z0-9_@./-" "\n" < "$f" | grep -E ".{5,}" | sort -u | grep -iE "firebase|framer|sentry|motion|socket|cloudinary|recaptcha|zustand|tanstack|axios" | head -40
echo "--- private field samples ---"
grep -oE ".{0,40}#[a-zA-Z_][A-Za-z0-9_].{0,40}" "$f" | head -15
echo "--- Object.hasOwn context ---"
grep -oE ".{0,50}Object\.hasOwn.{0,50}" "$f" | head -10
echo "--- who imports 9878 from home html? ---"
'
curl -sL https://oceanbazar.com.bd/bn | tr '"' '\n' | grep 9878 || echo "9878 not in home HTML directly"
# Check shop layout chunk references
docker exec oceanbazar_web sh -c 'grep -l "9878" /app/.next/static/chunks/app/%5Blocale%5D/\(shop\)/layout-*.js /app/.next/static/chunks/807-*.js 2>/dev/null; ls /app/.next/static/chunks/app/%5Blocale%5D/\(shop\)/layout-*.js'
