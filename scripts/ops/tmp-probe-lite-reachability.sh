#!/bin/bash
set -euo pipefail
echo "=== DNS A ==="
dig +short lite.oceanbazar.com.bd A || true
dig +short lite.oceanbazar.com.bd AAAA || true
echo "=== SERVER IPv4 ==="
curl -4 -s ifconfig.me; echo
echo "=== Public HTTPS lite ==="
curl -sI --max-time 8 https://lite.oceanbazar.com.bd/bn 2>&1 | head -20 || true
echo "=== Local Host header (nginx→web_lite) ==="
curl -skI --max-time 8 -H "Host: lite.oceanbazar.com.bd" https://127.0.0.1/bn | head -12
echo "=== Container health ==="
docker exec oceanbazar_web_lite node -e 'fetch("http://127.0.0.1:3001/health").then(r=>r.text()).then(console.log).catch(e=>{console.error(e);process.exit(1)})'
echo "=== Cert SANs ==="
openssl x509 -in /root/oceanbazar/nginx/ssl/fullchain.pem -noout -text 2>/dev/null | grep -A1 "Subject Alternative Name" || true
