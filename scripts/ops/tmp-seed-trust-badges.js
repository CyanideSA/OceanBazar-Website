const { Client } = require('pg');
const fs = require('fs');

(async () => {
  const sqlPath = process.argv[2] || '/tmp/trust-badge-migration.sql';
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: String(process.env.DATABASE_URL || '').includes('neon')
      ? { rejectUnauthorized: false }
      : undefined,
  });
  await c.connect();
  await c.query(sql);
  const badges = await c.query(
    'SELECT id FROM trust_badge_catalog WHERE active = true ORDER BY sort_order, id',
  );
  const products = await c.query(
    "SELECT id FROM products WHERE status = 'active' ORDER BY updated_at DESC LIMIT 24",
  );
  let assigned = 0;
  for (let i = 0; i < products.rows.length; i++) {
    const badge = badges.rows[i % Math.max(badges.rows.length, 1)];
    if (!badge) continue;
    await c.query(
      'INSERT INTO product_trust_badges (product_id, badge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [products.rows[i].id, badge.id],
    );
    assigned += 1;
  }
  console.log(JSON.stringify({ badges: badges.rows.length, assigned }));
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
