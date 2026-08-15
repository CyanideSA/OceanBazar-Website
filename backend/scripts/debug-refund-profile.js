const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  console.log('refund_records=' + typeof p.refund_records);
  console.log('return_requests=' + typeof p.return_requests);
  const keys = Object.keys(p).filter((k) => /refund|return/i.test(k));
  console.log('keys=' + keys.join(','));
  try {
    const cols = await p.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'admin_users' ORDER BY ordinal_position`;
    console.log('admin_users_cols=' + cols.map((c) => c.column_name).join(','));
  } catch (e) {
    console.log('admin_cols_err=' + e.message);
  }
  try {
    const cols = await p.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name LIKE '%profile%'`;
    console.log('users_profile_cols=' + cols.map((c) => c.column_name).join(','));
  } catch (e) {
    console.log('users_cols_err=' + e.message);
  }
  try {
    const t = await p.$queryRaw`SELECT to_regclass('public.refund_records') AS t`;
    console.log('refund_table=' + JSON.stringify(t));
  } catch (e) {
    console.log('refund_table_err=' + e.message);
  }
  await p.$disconnect();
})();
