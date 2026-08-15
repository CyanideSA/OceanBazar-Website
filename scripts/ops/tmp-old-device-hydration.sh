#!/bin/bash
set -euo pipefail
docker cp /root/oceanbazar/scripts/ops/tmp-query-client-errors.js oceanbazar_bff:/app/tmp-query-client-errors.js 2>/dev/null || true
docker exec -w /app oceanbazar_bff node -e '
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const since = new Date(Date.now() - 12 * 3600 * 1000);
  const rows = await p.clientErrorReport.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  console.log("SINCE", since.toISOString(), "COUNT", rows.length);
  for (const r of rows) {
    const ua = r.userAgent || "";
    const old =
      /iPhone OS 15_|Android [4-9]_|Android 10|Pixel|CriOS\/|FxiOS/.test(ua) ||
      /iPhone OS 1[0-5]_/.test(ua);
    console.log(JSON.stringify({
      t: r.createdAt,
      old,
      msg: (r.message || "").slice(0, 220),
      url: (r.url || "").slice(0, 90),
      ua: ua.slice(0, 140),
      hyp: r.snapshot && r.snapshot.hypothesisId,
      loc: r.snapshot && r.snapshot.location,
      data: r.snapshot && r.snapshot.data,
    }));
  }
  await p.$disconnect();
})().catch((e) => { console.error(String(e)); process.exit(1); });
'

echo "=== BFF recent client_error ==="
docker logs --tail 120 oceanbazar_bff 2>&1 | grep -iE 'client_error|debug-078c95|TypeError|ReferenceError|SyntaxError' | tail -40 || true

echo "=== HOME JS REFS ==="
curl -sL https://oceanbazar.com.bd/bn | tr '"' '\n' | grep -E '_next/static/chunks/.*\.js' | head -40
