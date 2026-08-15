#!/bin/bash
set -euo pipefail
echo "=== DNS ==="
dig +short lite.oceanbazar.com.bd A || true
getent hosts lite.oceanbazar.com.bd || true
echo "=== SERVER IP ==="
curl -s ifconfig.me; echo
echo "=== CERT SANs ==="
openssl x509 -in /root/oceanbazar/nginx/ssl/fullchain.pem -noout -text 2>/dev/null | grep -A1 "Subject Alternative Name" || true
echo "=== Host header via nginx ==="
curl -skI -H "Host: lite.oceanbazar.com.bd" https://127.0.0.1/bn | head -12
echo "=== Lite home via docker ==="
docker exec oceanbazar_web_lite node -e 'fetch("http://127.0.0.1:3001/bn").then(r=>r.text()).then(t=>console.log("len="+t.length,"hasBrand="+t.includes("OceanBazar"),"hasLite="+t.includes("Lite"),"hasCard="+t.includes("card")))'
echo "=== Public curl ==="
curl -sI https://lite.oceanbazar.com.bd/bn | head -15 || true
