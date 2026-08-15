const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.$executeRawUnsafe(
  'ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS threads_url VARCHAR(500)'
)
  .then(() => {
    console.log('threads_url column ok');
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
