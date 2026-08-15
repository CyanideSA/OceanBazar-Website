#!/bin/bash
set -euo pipefail
docker cp /root/oceanbazar/scripts/ops/tmp-query-client-errors.js oceanbazar_bff:/app/tmp-query-client-errors.js
docker exec -w /app oceanbazar_bff node -e '
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const since = new Date(Date.now() - 6 * 3600 * 1000);
  const rows = await p.clientErrorReport.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  console.log("SINCE", since.toISOString(), "COUNT", rows.length);
  for (const r of rows) {
    console.log(JSON.stringify({
      createdAt: r.createdAt,
      message: (r.message || "").slice(0, 180),
      url: (r.url || "").slice(0, 100),
      ua: (r.userAgent || "").slice(0, 120),
      hyp: r.snapshot && r.snapshot.hypothesisId,
      runId: r.snapshot && r.snapshot.runId,
      loc: r.snapshot && r.snapshot.location,
    }));
  }
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
'
echo "=== PRODUCT CHUNK ==="
curl -sI https://oceanbazar.com.bd/_next/static/chunks/1567-3788270a3266b680.js | head -8
curl -sL https://oceanbazar.com.bd/bn | tr '"' '\n' | grep -E 'static/chunks/1567' | head -5
