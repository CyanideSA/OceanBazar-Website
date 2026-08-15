/* Run inside oceanbazar_bff with cwd /app */
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

(async () => {
  const sqlPath = process.argv[2] || '/app/trust-badge-migration.sql';
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const prisma = new PrismaClient();
  try {
    // Split on semicolons carefully — migration uses DO $$ blocks
    await prisma.$executeRawUnsafe(sql);
  } catch (e) {
    // Some statements may be IF NOT EXISTS no-ops; retry statement-by-statement for simple creates
    console.error('bulk_sql_warn', String(e.message || e).slice(0, 200));
  }

  // Prefer simple ensures if bulk failed mid-way
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS trust_badge_catalog (
      id SERIAL PRIMARY KEY,
      slug VARCHAR(100) NOT NULL UNIQUE,
      name_en VARCHAR(120) NOT NULL,
      name_bn VARCHAR(120) NOT NULL,
      icon VARCHAR(50),
      description VARCHAR(255),
      sort_order INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS product_trust_badges (
      product_id CHAR(8) NOT NULL,
      badge_id INTEGER NOT NULL,
      PRIMARY KEY (product_id, badge_id)
    );
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO trust_badge_catalog (slug, name_en, name_bn, icon, description, sort_order, active)
    VALUES
      ('authentic', '100% authentic', '১০০% অথেন্টিক', 'shield', 'Verified genuine products', 0, true),
      ('verified-import', 'Verified import', 'যাচাইকৃত আমদানি', 'award', 'Sourced through OceanBazar channels', 1, true),
      ('quality-checked', 'Quality checked', 'কোয়ালিটি চেকড', 'check', 'Inspected before dispatch', 2, true),
      ('trusted-seller', 'OceanBazar trusted', 'OceanBazar ট্রাস্টেড', 'lock', 'Sold only by OceanBazar', 3, true)
    ON CONFLICT (slug) DO NOTHING;
  `);

  const badges = await prisma.$queryRawUnsafe('SELECT id FROM trust_badge_catalog WHERE active = true ORDER BY sort_order, id');
  const products = await prisma.$queryRawUnsafe("SELECT id FROM products WHERE status = 'active' ORDER BY updated_at DESC LIMIT 24");
  let assigned = 0;
  for (let i = 0; i < products.length; i++) {
    const badge = badges[i % Math.max(badges.length, 1)];
    if (!badge) continue;
    await prisma.$executeRawUnsafe(
      'INSERT INTO product_trust_badges (product_id, badge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      products[i].id,
      badge.id,
    );
    assigned += 1;
  }
  console.log(JSON.stringify({ badges: badges.length, assigned }));
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
