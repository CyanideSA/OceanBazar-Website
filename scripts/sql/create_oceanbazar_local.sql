-- One-time: create app role + database for local dev (matches backend/.env.example defaults).
-- Run as PostgreSQL superuser (commonly "postgres"), adjust -p if needed:
--   psql -h 127.0.0.1 -p 5432 -U postgres -f scripts/sql/create_oceanbazar_local.sql
--
-- If USER or DATABASE already exists, you will see errors — that is OK.

CREATE USER oceanbazar WITH PASSWORD 'secret';
CREATE DATABASE oceanbazar OWNER oceanbazar;
GRANT ALL PRIVILEGES ON DATABASE oceanbazar TO oceanbazar;
