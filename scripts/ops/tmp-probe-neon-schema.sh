#!/bin/bash
set -euo pipefail
cd /root/oceanbazar
NEON_URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2-)
echo "NEON_HOST=$(echo "$NEON_URL" | sed -E 's#.*@([^/]+)/.*#\1#')"
docker exec -e NEON_URL="$NEON_URL" oceanbazar_bff node <<'NODE'
const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient({ datasources: { db: { url: process.env.NEON_URL } } });
  const checks = [
    ['brand', 'SELECT brand FROM products LIMIT 1'],
    ['chat_greeting', 'SELECT chat_greeting FROM admin_users LIMIT 1'],
    ['pcm', 'SELECT 1 FROM product_category_map LIMIT 1'],
    ['delivery_fee_paid', 'SELECT delivery_fee_paid FROM orders LIMIT 1'],
    ['ssl_sandbox', 'SELECT sslcommerz_sandbox_store_id FROM site_settings LIMIT 1'],
    ['tag_groups', 'SELECT 1 FROM tag_groups LIMIT 1'],
  ];
  for (const [n, q] of checks) {
    try {
      await p.$queryRawUnsafe(q);
      console.log(n + '=yes');
    } catch (e) {
      console.log(n + '=no');
    }
  }
  await p.$disconnect();
})();
NODE
echo SCHEMA_PROBE_OK
