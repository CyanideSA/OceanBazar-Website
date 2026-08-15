const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const s = await p.site_settings.findFirst({ where: { id: 'default' } });
  const tok = await p.courier_tokens.findFirst({ where: { provider: 'pathao' } });
  console.log(JSON.stringify({
    hasClientId: Boolean(s?.pathao_client_id),
    clientIdLen: String(s?.pathao_client_id || '').length,
    hasClientSecret: Boolean(s?.pathao_client_secret),
    hasStoreId: Boolean(s?.pathao_store_id),
    storeId: s?.pathao_store_id || null,
    hasToken: Boolean(tok?.access_token),
    tokenExpires: tok?.expires_at || null,
  }));
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
