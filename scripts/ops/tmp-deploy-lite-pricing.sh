#!/bin/bash
set -euo pipefail
cd /root/oceanbazar

echo "==> Build web_lite"
docker compose -f docker-compose.yml -f docker-compose.neon.yml --profile full --profile production build web_lite

echo "==> Up web_lite"
docker compose -f docker-compose.yml -f docker-compose.neon.yml --profile full --profile production up -d web_lite
sleep 4

echo "==> Probe PDP caps"
python3 - <<'PY'
import json, re, urllib.request
checks = []
for pid, expect_max in [("A1B2C3D4", 25), ("E5F6A7B8", 5), ("D4E5F6A7", 10)]:
    url = f"http://127.0.0.1:3001/lite/en/product/{pid}"
    html = urllib.request.urlopen(url, timeout=30).read().decode("utf-8", "ignore")
    m = re.search(r'id="obPricingCfg">([^<]+)', html)
    cfg = json.loads(m.group(1)) if m else {}
    ok = cfg.get("maxQty") == expect_max and "pricing-panel" in html and "tier-table" in html
    checks.append({"id": pid, "maxQty": cfg.get("maxQty"), "expect": expect_max, "ok": ok})
print(json.dumps(checks, indent=2))
if not all(c["ok"] for c in checks):
    raise SystemExit(2)
print("DONE")
PY
