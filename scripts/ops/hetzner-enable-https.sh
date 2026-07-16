#!/bin/bash
# Issue Let's Encrypt certs and wire them into Docker nginx (NOT system nginx).
# Run on the Hetzner host as root from the repo root (e.g. /root/oceanbazar).
set -euo pipefail

REPO_ROOT="${1:-/root/oceanbazar}"
EMAIL="${CERTBOT_EMAIL:-admin@oceanbazar.com.bd}"
DOMAINS=(
  api.oceanbazar.com.bd
  oceanbazar.com.bd
  www.oceanbazar.com.bd
  admin.oceanbazar.com.bd
  contentid.oceanbazar.com.bd
)

cd "$REPO_ROOT"

echo "==> Disable host nginx so it never fights Docker on :80/:443"
systemctl disable --now nginx 2>/dev/null || true
systemctl mask nginx 2>/dev/null || true

echo "==> Ensure certbot is installed (certonly only — do NOT use --nginx plugin)"
if ! command -v certbot >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y certbot
fi

echo "==> Briefly stop Docker nginx so certbot can bind :80"
docker stop oceanbazar_nginx

DOMAIN_ARGS=()
for d in "${DOMAINS[@]}"; do
  DOMAIN_ARGS+=(-d "$d")
done

certbot certonly --standalone --non-interactive --agree-tos \
  -m "$EMAIL" \
  --preferred-challenges http \
  "${DOMAIN_ARGS[@]}" \
  --cert-name oceanbazar.com.bd \
  || {
    echo "certbot failed — restarting nginx and exiting"
    docker start oceanbazar_nginx
    exit 1
  }

echo "==> Copy certs into nginx/ssl (mounted into the container)"
mkdir -p nginx/ssl
cp -L /etc/letsencrypt/live/oceanbazar.com.bd/fullchain.pem nginx/ssl/fullchain.pem
cp -L /etc/letsencrypt/live/oceanbazar.com.bd/privkey.pem nginx/ssl/privkey.pem
chmod 644 nginx/ssl/fullchain.pem
chmod 600 nginx/ssl/privkey.pem

echo "==> Start Docker nginx"
docker start oceanbazar_nginx
sleep 2
docker exec oceanbazar_nginx nginx -t
docker exec oceanbazar_nginx nginx -s reload

echo "==> Smoke HTTPS"
curl -sfI https://api.oceanbazar.com.bd/api/health | head -5
curl -sf "https://api.oceanbazar.com.bd/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=${META_VERIFY_TOKEN:-oceanbazar_meta_verify}&hub.challenge=12345" || true
echo
echo "Done. If META_VERIFY_TOKEN is set in .env, Meta verify should now work over HTTPS."
echo "Renewal tip: certbot renew --deploy-hook 'bash $REPO_ROOT/scripts/ops/hetzner-enable-https-renew.sh'"
