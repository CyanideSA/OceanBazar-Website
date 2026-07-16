#!/bin/bash
set -euo pipefail
cd ~/oceanbazar

python3 <<'PY'
from pathlib import Path
p = Path(".env")
text = p.read_text() if p.exists() else ""
neon = {
  "DATABASE_URL": "postgresql://neondb_owner:npg_0Z1qOPKTzQWa@ep-small-sunset-aom3ownz-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
  "DIRECT_URL": "postgresql://neondb_owner:npg_0Z1qOPKTzQWa@ep-small-sunset-aom3ownz.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
  "DB_USER": "neondb_owner",
  "DB_PASSWORD": "npg_0Z1qOPKTzQWa",
  "JAVA_DATABASE_URL": "jdbc:postgresql://ep-small-sunset-aom3ownz.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
  "ML_DATABASE_URL": "postgresql+psycopg2://neondb_owner:npg_0Z1qOPKTzQWa@ep-small-sunset-aom3ownz-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
}
lines = []
seen = set()
for line in text.splitlines():
    if "=" in line and not line.strip().startswith("#"):
        key = line.split("=", 1)[0]
        if key in neon:
            lines.append(f"{key}={neon[key]}")
            seen.add(key)
            continue
    lines.append(line)
for k, v in neon.items():
    if k not in seen:
        lines.append(f"{k}={v}")
p.write_text("\n".join(lines) + "\n")
print("env updated")
PY

cp -f docker-compose.neon.yml docker-compose.neon.yml 2>/dev/null || true
if [ ! -f docker-compose.neon.yml ]; then
cat > docker-compose.neon.yml <<'EOF'
services:
  api:
    environment:
      DATABASE_URL: ${DATABASE_URL}
  java_api:
    environment:
      DATABASE_URL: ${JAVA_DATABASE_URL}
      SPRING_DATASOURCE_URL: ${JAVA_DATABASE_URL}
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
  ml_service:
    environment:
      DATABASE_URL: ${ML_DATABASE_URL}
EOF
fi

echo "neon config ready"
