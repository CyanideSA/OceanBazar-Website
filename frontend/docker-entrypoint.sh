#!/bin/sh
set -eu

HISTORY="${OB_STATIC_HISTORY:-/var/ob-static-history}"
STATIC_DIR="/app/.next/static"

mkdir -p "$HISTORY/chunks" "$STATIC_DIR/chunks"

# Keep prior deploy chunk filenames alive so open tabs / HTTP caches that still
# reference old contenthashes do not 404 into an error loop.
if [ -d "$HISTORY/chunks" ]; then
  cp -rn "$HISTORY/chunks/." "$STATIC_DIR/chunks/" 2>/dev/null || true
fi

# One-time aliases: content-identical chunks whose hashes changed when hashSalt
# was introduced. Old phones still request these exact URLs.
alias_chunk() {
  src="$1"
  dest="$2"
  if [ -f "$STATIC_DIR/chunks/$src" ] && [ ! -f "$STATIC_DIR/chunks/$dest" ]; then
    cp "$STATIC_DIR/chunks/$src" "$STATIC_DIR/chunks/$dest"
  fi
}
alias_chunk "1567-5ce45a98efb3dffa.js" "1567-3788270a3266b680.js"
alias_chunk "1255-cf8bb66324a2ede4.js" "1255-b950fb95701fdf96.js"
alias_chunk "4bd1b696-25094e0d1c4d6413.js" "4bd1b696-100b9d70ed4e49c1.js"

# Remember this build's assets for the next deploy.
cp -rn "$STATIC_DIR/." "$HISTORY/" 2>/dev/null || true

exec node server.js
