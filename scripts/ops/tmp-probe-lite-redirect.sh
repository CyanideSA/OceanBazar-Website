#!/bin/bash
set -euo pipefail
echo "=== iOS 18 (iPhone 14 Pro Max-like) UA on main ==="
curl -sI -A "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1" \
  "https://oceanbazar.com.bd/bn" | head -15

echo "=== iOS 15 (iPhone 7) UA on main ==="
curl -sI -A "Mozilla/5.0 (iPhone; CPU iPhone OS 15_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6.1 Mobile/15E148 Safari/604.1" \
  "https://oceanbazar.com.bd/bn" | head -15

echo "=== Lite public DNS/HTTPS ==="
dig +short lite.oceanbazar.com.bd A || true
curl -sI "https://lite.oceanbazar.com.bd/bn" | head -15 || true

echo "=== Device hint present in HTML? ==="
curl -sL "https://oceanbazar.com.bd/bn" | tr '"' '\n' | grep -E 'deviceMemory|hardwareConcurrency|lite.oceanbazar|prefer\?view=lite' | head -20
