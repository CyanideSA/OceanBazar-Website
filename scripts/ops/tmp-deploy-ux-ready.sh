#!/bin/bash
set -euo pipefail
ROOT=/root/oceanbazar
cd "$ROOT"

echo "== unpack if present =="
if [ -f /tmp/ob-ux-ready.tar.gz ]; then
  tar -xzf /tmp/ob-ux-ready.tar.gz -C "$ROOT"
  echo UNPACKED
else
  echo "NO_TARBALL — using existing tree"
fi

echo "== ensure Neon DATABASE_URL =="
python3 - <<'PY'
from pathlib import Path
import re
env = Path('/root/oceanbazar/.env').read_text(encoding='utf-8', errors='ignore')
m = re.search(r'^DATABASE_URL=(.*)$', env, flags=re.M)
val = (m.group(1).strip().strip('"').strip("'") if m else '')
host = 'MISSING'
if val:
  hm = re.search(r'@([^/:?]+)', val)
  host = hm.group(1) if hm else 'parse-fail'
print('DATABASE_URL_host=' + host)
if 'neon.tech' not in host:
  raise SystemExit('FATAL: .env DATABASE_URL is not Neon')
PY

echo "== rebuild with neon overlay =="
docker compose -f docker-compose.yml -f docker-compose.neon.yml --profile full --profile production build api web_lite admin web 2>&1 | tee /tmp/ux-build.log | tail -n 60
docker compose -f docker-compose.yml -f docker-compose.neon.yml --profile full --profile production up -d api java_api web_lite admin web
docker compose up -d nginx 2>/dev/null || true

for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  st=$(docker inspect -f '{{.State.Health.Status}}' oceanbazar_bff 2>/dev/null || echo starting)
  echo "bff_health=$st"
  [ "$st" = "healthy" ] && break
  sleep 4
done

echo "== runtime DATABASE_URL =="
DBHOST=$(docker exec oceanbazar_bff sh -c 'printenv DATABASE_URL' | sed -E 's#://([^:/]+):([^@]+)@#://\1:***@#; s/\?.*/?redacted/')
echo "$DBHOST"
if echo "$DBHOST" | grep -q '@postgres:5432'; then
  echo "FATAL: BFF still on local postgres"
  exit 1
fi

echo "== migrate chat_quick_replies =="
docker cp "$ROOT/backend/prisma/migrations/20260804120000_admin_chat_quick_replies/migration.sql" oceanbazar_bff:/app/mig-chat-qr.sql
docker exec -w /app oceanbazar_bff node <<'NODE'
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const sql = fs.readFileSync('/app/mig-chat-qr.sql', 'utf8');
  for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
    try {
      await p.$executeRawUnsafe(stmt);
      console.log('ok', stmt.slice(0, 60).replace(/\s+/g, ' '));
    } catch (e) {
      console.log('warn', String(e.message || e).slice(0, 160));
    }
  }
  try {
    const cols = await p.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'admin_users' AND column_name = 'chat_quick_replies'
    `);
    console.log(JSON.stringify({ chat_quick_replies_col: cols.length > 0 }));
  } catch (e) {
    console.log(JSON.stringify({ colCheckErr: String(e.message || e).slice(0, 160) }));
  }
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
NODE

echo "== seed email templates =="
docker cp "$ROOT/scripts/ops/seed-email-templates.js" oceanbazar_bff:/app/seed-email-templates.js
docker cp "$ROOT/backend/src/data/oceanbazarEmailTemplates.ts" oceanbazar_bff:/app/src/data/oceanbazarEmailTemplates.ts
# ensure dir exists in image
docker exec oceanbazar_bff sh -c 'mkdir -p /app/src/data'
docker cp "$ROOT/backend/src/data/oceanbazarEmailTemplates.ts" oceanbazar_bff:/app/src/data/oceanbazarEmailTemplates.ts
docker exec -w /app oceanbazar_bff node /app/seed-email-templates.js 2>&1 | tail -n 40 || true

docker exec oceanbazar_redis redis-cli DEL storefront:settings || true
docker exec oceanbazar_redis sh -c "redis-cli KEYS 'bff:trust-badges*' | xargs -r redis-cli DEL" || true

echo "== probes =="
python3 - <<'PY'
import json, re, urllib.request

def get(url, headers=None):
  req = urllib.request.Request(url, headers=headers or {})
  with urllib.request.urlopen(req, timeout=30) as r:
    body = r.read()
    return r.status, dict(r.headers), body

results = {}

# trust badges still healthy
st, hdr, body = get('https://oceanbazar.com.bd/api/trust-badges?nocache=1')
d = json.loads(body.decode())
b = d.get('badges') or []
results['trustBadges'] = {
  'status': st,
  'count': len(b),
  'withProducts': sum(1 for x in b if (x.get('productCount') or 0) > 0),
}

# lite login redesign
st, hdr, body = get('https://oceanbazar.com.bd/lite/en/auth/login')
h = body.decode('utf-8', 'ignore')
results['liteLogin'] = {
  'status': st,
  'authShell': 'auth-shell' in h,
  'authCard': 'auth-card' in h,
  'brandLogo': 'ob-brand-logo' in h or 'logoLightUrl' in h or 'auth-logo' in h,
  'tabPassword': 'tabPassword' in h or 'Password' in h,
}

# lite register
st, hdr, body = get('https://oceanbazar.com.bd/lite/en/auth/register')
h = body.decode('utf-8', 'ignore')
results['liteRegister'] = {
  'status': st,
  'authShell': 'auth-shell' in h,
  'authCard': 'auth-card' in h,
}

# lite home icons / theme
st, hdr, body = get('https://oceanbazar.com.bd/lite/en')
h = body.decode('utf-8', 'ignore')
results['liteHome'] = {
  'status': st,
  'themeColor': '#2E7CF6' in h,
  'trustProduct': 'data-ob-trust="product-linked"' in h,
  'testimonialsPremium': 'testimonials-premium' in h,
}

# admin icon / manifest
for path, key in [
  ('https://admin.oceanbazar.com.bd/manifest.webmanifest', 'adminManifest'),
  ('https://admin.oceanbazar.com.bd/icons/icon-192x192.png', 'adminIcon192'),
  ('https://oceanbazar.com.bd/icons/ios/apple-touch-icon.png', 'storeIosIcon'),
  ('https://oceanbazar.com.bd/icons/android/icon-512.png', 'storeAndroid512'),
  ('https://oceanbazar.com.bd/manifest.webmanifest', 'storeManifestAlt'),
  ('https://oceanbazar.com.bd/manifest.json', 'storeManifestJson'),
]:
  try:
    st, hdr, body = get(path)
    results[key] = {'status': st, 'bytes': len(body), 'ctype': hdr.get('Content-Type') or hdr.get('content-type')}
  except Exception as e:
    results[key] = {'error': str(e)[:160]}

# BFF quick-replies route exists (expect 401 without auth)
try:
  st, hdr, body = get('https://oceanbazar.com.bd/api/admin/chat/quick-replies')
  results['quickRepliesRoute'] = {'status': st, 'body': body.decode('utf-8', 'ignore')[:120]}
except urllib.error.HTTPError as e:
  results['quickRepliesRoute'] = {'status': e.code, 'authProtected': e.code in (401, 403)}
except Exception as e:
  results['quickRepliesRoute'] = {'error': str(e)[:160]}

# email templates count via prisma
print(json.dumps(results, indent=2))
open('/tmp/ux-probe.json','w').write(json.dumps(results, indent=2))
PY

docker exec -w /app oceanbazar_bff node <<'NODE'
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const n = await p.emailTemplate.count();
    const cats = await p.emailTemplate.findMany({ select: { id: true, category: true, name: true }, take: 20 });
    console.log(JSON.stringify({ emailTemplateCount: n, sample: cats }));
  } catch (e) {
    console.log(JSON.stringify({ emailErr: String(e.message || e).slice(0, 200) }));
  } finally {
    await p.$disconnect();
  }
})();
NODE

# confirm chat route in dist
docker exec oceanbazar_bff sh -c 'grep -n "quick-replies" /app/dist/routes/admin/chat.js | head -5'
docker exec oceanbazar_web_lite sh -c 'grep -n "auth-shell\|checkout-page" /app/views/login.ejs /app/views/checkout.ejs | head -10'
docker exec oceanbazar_admin sh -c 'ls -la /usr/share/nginx/html/icons 2>/dev/null || ls -la /app/dist/icons 2>/dev/null || find / -path "*icons/icon-192*" 2>/dev/null | head -5'
docker ps --format '{{.Names}} {{.Status}}' | grep -E 'oceanbazar_(bff|admin|web_lite|web)\b' || true
echo UX_DEPLOY_READY_DONE
