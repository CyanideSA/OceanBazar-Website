#!/usr/bin/env bash
# Run the Spring Boot Core API against the local PostgreSQL/Redis with Flyway
# disabled (Prisma owns DDL) and JPA validation off, mirroring docker-compose.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/backend-java"

JAR="$(ls -t target/backend-java-*.jar 2>/dev/null | head -1 || true)"
if [ -z "$JAR" ]; then
  echo "Building Spring Boot jar (first run)…"
  mvn -q -DskipTests package
  JAR="$(ls -t target/backend-java-*.jar | head -1)"
fi

export SERVER_PORT=8000
export SPRING_DATASOURCE_URL="jdbc:postgresql://127.0.0.1:5433/oceanbazar"
export SPRING_DATASOURCE_USERNAME=oceanbazar
export SPRING_DATASOURCE_PASSWORD=secret
export SPRING_DATA_REDIS_HOST=127.0.0.1
export SPRING_DATA_REDIS_PORT=6379
export SPRING_JPA_HIBERNATE_DDL_AUTO=none
export SPRING_FLYWAY_ENABLED=false
export MANAGEMENT_TRACING_ENABLED=false
export JWT_ACCESS_SECRET=oceanbazar_dev_access_secret_change_in_production_32chars
export CORS_ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:4000,http://127.0.0.1:4000"

exec java -jar "$JAR"
