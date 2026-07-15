# Platform source of truth

## Runtimes

- **Next.js storefront** — UI, SEO, ISR/SSG where configured; talks to the BFF over `NEXT_PUBLIC_API_URL`.
- **Node BFF** (`backend/`) — Auth, cart, orders, payments (Prisma), admin routes implemented in TypeScript, proxy to Java for catalog-heavy admin and legacy core paths, optional Redis caching.
- **Java core** (`backend-java/`) — Catalog, orders, admin CRUD behind `JAVA_API_URL` (private/VPC only). BFF uses `internal-api-client.ts` + `/api/admin` proxy. Realtime: Java → Redis `ob:realtime` → BFF Socket.IO (STOMP disabled by default).
- **PostgreSQL** — Primary data store; **Prisma** schema in `backend/prisma/schema.prisma`. **Flyway** migrations under `backend-java/src/main/resources/db/migration` must stay aligned with production schema (avoid divergent DDL for the same tables).

## Domain ownership (high level)

| Domain | Source of truth | Notes |
|--------|-----------------|--------|
| **Catalog** (products, categories, brands, public listing) | Java (+ BFF proxy/cache) | Storefront product APIs typically go through the BFF, which may cache or forward to Java. |
| **Orders** (customer checkout, timelines) | Prisma / BFF | Order creation and payment state transitions are owned by Node unless explicitly migrated. |
| **Payments** | Prisma `payment_transactions` + gateways | Webhooks and redirects hit the BFF; idempotent settlement avoids double posts. |
| **Admin CRM** | BFF native routes first; then Java proxy | Anything not handled by `adminRouter` forwards to Java; expect **502** from the proxy if Java is down. |
| **Auth (customer)** | BFF | JWT + cookies as implemented in `backend/src/routes/auth`. |
| **Auth (admin)** | BFF for login; Java for some admin JWT validation on proxied routes | Admin UI should treat **502** on `/api/admin/*` as “core unavailable.” |

## Failure modes when Java is down

- **Proxied admin** — `GET/POST /api/admin/...` that only exist in Java return **502** with `Core API unavailable` from `springBootProxy`.
- **BFF-native admin** — Routes registered on `adminRouter` in Node (orders list, payments, uploads, etc.) continue to work if the process and DB are healthy.
- **Storefront** — Pages that only call BFF-native APIs (auth, cart, checkout, storefront settings) can still function for many flows; catalog reads that depend on Java may fail or serve stale cache depending on route.

Document operational playbooks (restart order, drain, feature flags) in your runbooks repo or `docs/` as you mature operations.

## Tooling (single repo)

| Concern | Where |
|--------|--------|
| Sentry + OTLP | `docs/OBSERVABILITY.md`, `backend/src/tracing.ts`, `frontend/sentry.*.config.ts`, `backend-java` `pom.xml` + `application.properties` |
| CSP / SRI inventory | `docs/CSP_INVENTORY.md`, `frontend/csp-headers.mjs` |
| Flyway vs Prisma overlap | `npm run check:migrations` in `backend/` |
| Load smoke | `tests/load/k6-smoke.js`, `npm run load:k6` in `frontend/` |
| CDN image transforms | `frontend/lib/cloudinaryImage.ts`, Next `images` in `next.config.mjs` |
