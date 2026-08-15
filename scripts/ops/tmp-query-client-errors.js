const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const n = await p.clientErrorReport.count();
    console.log('COUNT', n);
    const rows = await p.clientErrorReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    for (const r of rows) {
      console.log(
        JSON.stringify({
          id: r.id,
          message: r.message,
          url: r.url,
          ua: (r.userAgent || '').slice(0, 140),
          createdAt: r.createdAt,
          snapshot: r.snapshot,
        }),
      );
    }
  } catch (e) {
    console.error('ERR', String(e));
    if (e && e.message) console.error(e.message);
  } finally {
    await p.$disconnect();
  }
})();
