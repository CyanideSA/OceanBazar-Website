#!/bin/bash
# Hotfix deploy: Lite flash/account/footer/hero + invoice print fix
set -euo pipefail
cd /root/oceanbazar

echo "==> Build web_lite + web (invoice)"
docker compose -f docker-compose.yml -f docker-compose.neon.yml --profile full --profile production build web_lite web

echo "==> Up web_lite + web"
docker compose -f docker-compose.yml -f docker-compose.neon.yml --profile full --profile production up -d web_lite web

sleep 5
echo "==> Health"
docker exec oceanbazar_web_lite node -e "fetch('http://127.0.0.1:3001/health').then(r=>r.text()).then(t=>console.log(t)).catch(e=>{console.error(e);process.exit(1)})"

echo "==> Probe home markers"
docker exec oceanbazar_web_lite node -e "
fetch('http://127.0.0.1:3001/en').then(r=>r.text()).then(h=>{
  const checks = {
    flashBar: h.includes('flash-bar'),
    flashSection: h.includes('flash-section'),
    footerSocial: h.includes('footer-social'),
    heroCta: h.includes('hero-cta'),
    smartLed: h.includes('Smart LED'),
  };
  console.log(JSON.stringify(checks));
  if (!checks.flashBar || !checks.flashSection || !checks.footerSocial || !checks.heroCta) process.exit(2);
}).catch(e=>{console.error(e);process.exit(1)})
"

echo "==> Probe flash-deals"
docker exec oceanbazar_web_lite node -e "
fetch('http://127.0.0.1:3001/en/flash-deals').then(r=>r.text()).then(h=>{
  console.log(JSON.stringify({ smartLed: h.includes('Smart LED'), noProducts: h.includes('No products') }));
  if (!h.includes('Smart LED')) process.exit(2);
}).catch(e=>{console.error(e);process.exit(1)})
"

echo "DONE"
