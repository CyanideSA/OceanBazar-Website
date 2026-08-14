# Hetzner deployment (fresh Postgres)

AWS staging Postgres held dummy data only. On Hetzner you start with an **empty** database and apply Prisma migrations — **do not** restore the RDS snapshot `oceanbazar-staging-teardown-20260714`.

## Server requirements

- Ubuntu 22.04+ (or Debian 12+)
- Docker Engine + Docker Compose v2
- 4 GB+ RAM recommended for full stack (postgres, redis, java_api, api, web, admin, nginx)
- Ports **80** and **443** open (nginx production profile)

## 1. Clone and configure env

```bash
git clone <your-repo-url> oceanbazar
cd oceanbazar
cp .env.production.example .env
```

Edit `.env`:

| Variable | Hetzner value |
|----------|----------------|
| `POSTGRES_PASSWORD` | Strong random password |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Random 32+ char strings |
| `CLIENT_URL` | `https://oceanbazar.com.bd` |
| `ADMIN_URL` | `https://admin.oceanbazar.com.bd` |
| `BFF_PUBLIC_BASE_URL` | `https://api.oceanbazar.com.bd` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated production origins |
| `TRUST_PROXY` | `1` (behind nginx) |
| `NEXT_PUBLIC_API_URL` | `https://api.oceanbazar.com.bd` |
| `NEXT_PUBLIC_SITE_URL` | `https://oceanbazar.com.bd` |
| `NEXT_PUBLIC_ADMIN_CRM_URL` | `https://admin.oceanbazar.com.bd` |
| `CONTENT_ID_APP_URL` | `https://contentid.oceanbazar.com.bd` |
| `MS_CONTENT_ID_REDIRECT_URI` | `https://api.oceanbazar.com.bd/api/content-id/auth/sso/microsoft/callback` |
| `MS_SSO_REDIRECT_URI` | Admin SSO callback on your API host |
| `MAINTENANCE_MODE` | `false` when going live |

Set Microsoft SSO app redirect URIs in Azure to match the Hetzner API URLs above.

## 2. Fresh database (no AWS data)

From repo root on the Hetzner server:

```bash
node scripts/ops/fresh-postgres-docker.mjs --yes --seed --up
```

This:

1. Stops compose services
2. Deletes the `postgres_data` Docker volume
3. Starts Postgres
4. Enables the `pg_trgm` / `btree_gin` extensions, applies the full Prisma schema with `prisma db push`, and restores DB-level `updated_at` defaults
5. Optionally seeds default admin users (`--seed`)
6. Optionally starts the full stack (`--up`)

> The schema is applied with `prisma db push` rather than `prisma migrate deploy`: the Prisma migration history is interleaved with Java/Flyway-owned catalog tables and cannot run standalone on an empty database, whereas `schema.prisma` is a complete superset.

**Do not** run `scripts/ops/baseline-prisma-docker.mjs` on a fresh volume — that script is only for legacy databases that already had tables before Prisma history existed.

### Default seeded admins

See `backend/prisma/seed.ts`:

- `superadmin` / `Admin@1234`
- `rjsuvosa` / (password from seed)

Change passwords immediately after first login.

## 3. Production stack + TLS

The nginx `production` profile listens on 443 and **fails to start unless `nginx/ssl/fullchain.pem` and `nginx/ssl/privkey.pem` exist**. On a brand-new server you don't have Let's Encrypt certs yet (certbot's HTTP-01 challenge needs nginx already running), so seed a self-signed placeholder first, bring the stack up, then replace it with a real cert:

```bash
# 1. Placeholder cert so nginx can boot
mkdir -p nginx/ssl
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout nginx/ssl/privkey.pem -out nginx/ssl/fullchain.pem \
  -subj "/CN=oceanbazar.com.bd"

# 2. Build + start the full production stack
docker compose --profile full --profile production up -d --build

# 3. Issue real certs (Let's Encrypt) once DNS points at this server, then reload
bash scripts/ops/hetzner-enable-https.sh   # or run certbot, then: docker exec oceanbazar_nginx nginx -s reload
```

Update `nginx/nginx.conf` `server_name` entries for `.com.bd` hosts if needed, then reload nginx.

> The web (storefront) image bakes `NEXT_PUBLIC_*` and prerenders the homepage catalog **at build time**. Build it with the API reachable (or rebuild after seeding) so the homepage product sections are populated; product detail, listing, and category pages fetch dynamically and work immediately. Set `NEXT_PUBLIC_API_URL=https://api.oceanbazar.com.bd` (the public API domain) so both server-side rendering and the browser use the same URL.

## 4. DNS (Route53 or your registrar)

Point A records to the Hetzner server IP:

| Host | Purpose |
|------|---------|
| `oceanbazar.com.bd` | Storefront (nginx → web) |
| `admin.oceanbazar.com.bd` | Admin CRM (nginx → admin) |
| `api.oceanbazar.com.bd` | BFF + `/api/content-id/*` |
| `contentid.oceanbazar.com.bd` | Content-ID SPA (static build or separate nginx vhost) |

Remove stale AWS CloudFront aliases when DNS propagates.

## 5. Content-ID frontend

Build and serve the SPA (not in default `docker-compose.yml` yet):

```bash
cd content-id-frontend
cp .env.example .env
# VITE_CONTENT_ID_API_URL=https://api.oceanbazar.com.bd
npm ci && npm run build
# Serve dist/ via nginx vhost for contentid.oceanbazar.com.bd
```

Catalog data (categories, brands, product IDs) lives in the same Postgres as the main storefront — a fresh DB means an empty catalog until you add entries in the Content-ID tool.

## 6. Verify

```bash
npm run ops:smoke:local   # against http://127.0.0.1:4001 if BFF port mapped
curl -sf https://api.oceanbazar.com.bd/api/health
```

Content-ID: open `https://contentid.oceanbazar.com.bd` → SSO → empty catalog info banner → add category → generate ID → reload to confirm persistence.

## AWS cleanup (optional)

Since data was dummy, you can delete without exporting:

- RDS snapshot `oceanbazar-staging-teardown-20260714`
- RDS instance `oceanbazar-prod-bd` if unused

## Re-run fresh reset later

```bash
node scripts/ops/fresh-postgres-docker.mjs --yes --seed
docker compose --profile full --profile production up -d
```

This wipes **all** Postgres data on the server (orders, catalog, users). Use only when you intentionally want a clean slate.
