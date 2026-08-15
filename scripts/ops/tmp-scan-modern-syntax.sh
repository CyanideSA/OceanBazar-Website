#!/bin/bash
set -euo pipefail
# Scan shipped chunks for syntax that can break iOS 15 / older engines
DIR=$(docker exec oceanbazar_web sh -c 'ls /app/.next/static/chunks/*.js | head -1 | xargs dirname')
echo "DIR=$DIR"
docker exec oceanbazar_web sh -c '
cd /app/.next/static/chunks
for f in main-app-*.js webpack-*.js 4bd1b696-*.js 1255-*.js 1567-*.js 9878-*.js 3039-*.js app/layout-*.js; do
  [ -f "$f" ] || continue
  echo "---- $f ----"
  # private fields / methods
  grep -oE "#[A-Za-z_][A-Za-z0-9_]*" "$f" | sort -u | head -20 || true
  # Object.hasOwn / Array.at / replaceAll as property access patterns
  grep -c "Object.hasOwn\|structuredClone\|Array\.fromAsync\|AbortSignal\.timeout" "$f" || true
done
echo "==== ANY private fields in top chunks ===="
grep -l "#[a-zA-Z_]" main-app-*.js 4bd1b696-*.js 1255-*.js 9878-*.js 3039-*.js 2619-*.js 2>/dev/null | head
echo "==== hasOwn ===="
grep -l "Object.hasOwn" *.js 2>/dev/null | head
'