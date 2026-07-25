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

# Alias current shared chunks onto known legacy filenames still requested by
# iPhone 7 / Pixel clients stuck on older webpack runtimes.
alias_from_glob() {
  pattern="$1"
  shift
  src=$(ls -1 "$STATIC_DIR/chunks"/$pattern 2>/dev/null | head -n 1 || true)
  if [ -z "$src" ]; then
    return 0
  fi
  for dest in "$@"; do
    if [ ! -f "$STATIC_DIR/chunks/$dest" ]; then
      cp "$src" "$STATIC_DIR/chunks/$dest"
    fi
  done
}

alias_from_glob '1567-*.js' \
  '1567-3788270a3266b680.js' \
  '1567-5ce45a98efb3dffa.js' \
  '1567-8ac12a35dc68de50.js'

alias_from_glob '1255-*.js' \
  '1255-b950fb95701fdf96.js' \
  '1255-cf8bb66324a2ede4.js' \
  '1255-03236627ced341a2.js'

alias_from_glob '4bd1b696-*.js' \
  '4bd1b696-100b9d70ed4e49c1.js' \
  '4bd1b696-25094e0d1c4d6413.js' \
  '4bd1b696-6a297fd1cea462fe.js'

# Remember this build's assets for the next deploy.
cp -rn "$STATIC_DIR/." "$HISTORY/" 2>/dev/null || true

exec node server.js
