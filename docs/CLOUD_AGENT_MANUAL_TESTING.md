# Manual testing on a Cursor Cloud Agent

This guide explains how to bring up the full OceanBazar stack inside a Cursor Cloud Agent VM and test it manually — either the fast **dev** stack or the **production-built** stack that mirrors the Hetzner deployment.

## How manual testing works on a Cloud Agent

A Cloud Agent runs on its own Linux VM with a headless Chrome that the agent drives through its **computer-use** capability. You (the human) don't click inside the VM directly; instead you ask the agent to perform a flow, and it returns **screenshots** and **screen recordings** (saved to `/opt/cursor/artifacts/`, visible in the Cursor web app). So "manual testing" here means:

1. The agent brings the stack up on the VM.
2. You ask the agent to exercise a flow (e.g. "add a product to the cart and check out"), optionally naming the exact steps.
3. The agent opens Chrome via computer-use, performs the steps, and returns screenshots / a recording as evidence.

You can request specific flows, edge cases, credentials, or pages, and the agent will produce artifacts you can review.

## 1. Infrastructure (always required)

PostgreSQL (port **5433**) and Redis (port **6379**) must be running:

```bash
sudo pg_ctlcluster 16 main start
sudo redis-server /etc/redis/redis.conf --daemonize yes
```

The database is provisioned by `.cursor/install.sh` (extensions + `prisma db push` + seed). To reset it:

```bash
cd backend
npx prisma db push --accept-data-loss --skip-generate
psql "postgresql://oceanbazar:secret@127.0.0.1:5433/oceanbazar" -f prisma/dev-fix-updated-at-defaults.sql   # or: npx prisma db execute --file prisma/dev-fix-updated-at-defaults.sql
npm run db:seed
```

## 2a. Dev stack (fast, hot-reload)

Best for iterating. These are the four `terminals` in `.cursor/environment.json`:

```bash
(cd backend && npm run dev)                 # BFF        :4000
bash .cursor/run-java.sh                     # Core API   :8000
(cd frontend && npm run dev)                 # storefront :3000
(cd admin-frontend-react && npm run dev)     # admin CRM  :5173
```

## 2b. Production-built stack (mirrors Hetzner)

Runs the exact artifacts Hetzner serves (Next.js standalone server, admin static server + `/api` proxy, compiled BFF, Spring Boot jar). Use this to validate a production build.

```bash
# Build
(cd backend && npx tsc)                                   # -> dist/
(cd frontend && npm run build)                            # -> .next (standalone)
(cd admin-frontend-react && npm run build)                # -> dist/
(cd backend-java && mvn -q -DskipTests package)           # -> target/*.jar

# Frontend standalone needs static + public copied in (Docker does this too)
cd frontend && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/

# Run
(cd backend && node dist/app.js)                                             # BFF        :4000
bash .cursor/run-java.sh                                                      # Core API   :8000
(cd frontend && PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js)   # storefront :3000
(cd admin-frontend-react && ADMIN_BFF_PROXY_TARGET=http://127.0.0.1:4000 PORT=5173 node server.mjs)  # admin :5173
```

Notes:
- Over plain http on localhost, keep `NODE_ENV=development` for the BFF (via `backend/.env`) so the customer refresh cookie isn't marked `secure`. On Hetzner (https behind nginx) use `NODE_ENV=production`.
- To sign into the admin CRM without a TOTP app during testing, set `ADMIN_2FA_ONBOARDING_BYPASS=true` in `backend/.env` (only works when `NODE_ENV` is not `production`). Otherwise use the real flow: reveal **Emergency Access** on the admin login screen (click the footer 5×) and complete Google Authenticator enrolment.

## 3. Health checks

```bash
curl -s localhost:4000/api/health     # BFF   {"status":"ok"}
curl -s localhost:8000/api/health     # Java  {"status":"healthy"}
curl -s -o /dev/null -w '%{http_code}' localhost:3000/en    # storefront 200
curl -s -o /dev/null -w '%{http_code}' localhost:5173/      # admin 200
```

## 4. URLs & seeded credentials

| Surface | URL | Login |
| --- | --- | --- |
| Storefront | `http://127.0.0.1:3000/en` (or `/bn`) | Guest browsing needs no login; OTP is printed to the BFF terminal in dev |
| Admin CRM | `http://127.0.0.1:5173/` | `superadmin` / `Admin@1234` (or `rjsuvosa`) |
| E2E customer | storefront | `e2e.storefront@oceanbazar.test` / `Test@1234` |

Seeded demo product: **Samsung Galaxy A54** (`/en/product/1621B5EF`).

## 2c. Full Docker stack (the real Hetzner path) on a Cloud Agent

The `docker compose --profile full --profile production` stack (postgres, redis, java_api, api, ml, web, web_lite, admin, nginx) can run on a Cloud Agent, but nested Docker needs a few tweaks:

```bash
# Docker + fuse-overlayfs (overlay-on-overlay is unsupported nested)
sudo apt-get install -y docker.io docker-compose-v2 fuse-overlayfs
echo '{"storage-driver":"fuse-overlayfs","features":{"containerd-snapshotter":false}}' | sudo tee /etc/docker/daemon.json
sudo dockerd &                     # keep running; sudo chmod 666 /var/run/docker.sock

# Nested bridge fix: let same-bridge container-to-container traffic through
sudo sysctl -w net.bridge.bridge-nf-call-iptables=0

# Locally-trusted TLS so nginx boots and browsers/SSR trust it (no warnings)
mkcert -install && mkdir -p nginx/ssl
mkcert -cert-file nginx/ssl/fullchain.pem -key-file nginx/ssl/privkey.pem \
  oceanbazar.com.bd www.oceanbazar.com.bd admin.oceanbazar.com.bd api.oceanbazar.com.bd

# Resolve the prod domains to localhost so nginx routes by host
echo "127.0.0.1 oceanbazar.com.bd admin.oceanbazar.com.bd api.oceanbazar.com.bd" | sudo tee -a /etc/hosts

# Provision a fresh DB (db push + seed) and bring the stack up
node scripts/ops/fresh-postgres-docker.mjs --yes --seed
docker compose --profile full --profile production up -d --build
```

Then browse `https://oceanbazar.com.bd/en` and `https://admin.oceanbazar.com.bd/`. On a real Hetzner box none of the nested tweaks (fuse-overlayfs, bridge sysctl, mkcert) are needed — Docker bridge networking and real Let's Encrypt certs just work; use the flow in `docs/HETZNER_DEPLOYMENT.md`.

## 5. Suggested flows to ask the agent to test

- Storefront: browse home → open Samsung Galaxy A54 → add to cart → view cart → proceed to checkout.
- Bilingual: toggle EN/BN and confirm translated copy.
- Admin: sign in → Orders → open the seeded order → change status.
- API smoke: `GET /api/products`, `GET /api/categories`, `POST /api/admin/auth/login`.

Ask the agent for a **screen recording** of any flow to get a shareable artifact.
