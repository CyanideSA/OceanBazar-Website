#!/usr/bin/env bash
# OceanBazar — Cloud Agent start (per-boot service reconciliation).
# Brings up PostgreSQL (port 5433) and Redis, then returns. Application servers
# run as visible tmux terminals (see .cursor/environment.json).
set -euo pipefail

PG_PORT=5433
sudo sed -i "s/^#\?port = .*/port = ${PG_PORT}/" /etc/postgresql/16/main/postgresql.conf 2>/dev/null || true
sudo pg_ctlcluster 16 main start 2>/dev/null || true
sudo redis-server /etc/redis/redis.conf --daemonize yes 2>/dev/null || true

for _ in $(seq 1 30); do
  sudo -u postgres psql -p "$PG_PORT" -c "SELECT 1" >/dev/null 2>&1 && break
  sleep 1
done

echo "OceanBazar infrastructure ready (PostgreSQL :${PG_PORT}, Redis :6379)."
