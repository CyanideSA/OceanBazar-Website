#!/bin/bash
# Deploy-hook / manual renew: copy renewed certs into Docker nginx and reload.
set -euo pipefail
REPO_ROOT="${1:-/root/oceanbazar}"
CERT_NAME="${CERT_NAME:-oceanbazar.com.bd}"

mkdir -p "$REPO_ROOT/nginx/ssl"
cp -L "/etc/letsencrypt/live/${CERT_NAME}/fullchain.pem" "$REPO_ROOT/nginx/ssl/fullchain.pem"
cp -L "/etc/letsencrypt/live/${CERT_NAME}/privkey.pem" "$REPO_ROOT/nginx/ssl/privkey.pem"
chmod 644 "$REPO_ROOT/nginx/ssl/fullchain.pem"
chmod 600 "$REPO_ROOT/nginx/ssl/privkey.pem"

docker exec oceanbazar_nginx nginx -t
docker exec oceanbazar_nginx nginx -s reload
echo "nginx reloaded with renewed certs"
