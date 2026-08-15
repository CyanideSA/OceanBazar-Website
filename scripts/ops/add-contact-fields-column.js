const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  await p.$executeRawUnsafe(
    'ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS contact_address VARCHAR(1000)'
  );
  await p.$executeRawUnsafe(
    'ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS business_inquiry_email VARCHAR(255)'
  );
  console.log('contact_address + business_inquiry_email columns ok');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
