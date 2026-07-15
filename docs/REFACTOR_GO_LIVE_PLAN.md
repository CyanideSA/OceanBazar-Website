# OCEANBAZAR Refactor + Production Go-Live Plan

Implementation status: **v2 refactor artifacts in repo** (branch `refactor/oceanbazar-v2` recommended).

## Phase 0 — Safety

| Item | Location |
|------|----------|
| Feature flags | `config/feature-flags.json`, `backend/src/config/featureFlags.ts` |
| Rollback Compose | `docker-compose.rollback.yml` |
| DB backup | `scripts/ops/backup-all.ps1` |
| DB restore | `scripts/ops/restore-postgres.ps1` |
| Tag release | `git tag v1-stable` (manual) |

## Phase 1 — BFF lock

| Item | Location |
|------|----------|
| Internal Java client | `backend/src/clients/internal-api-client.ts` |
| Contracts | `backend/contracts/*.contract.ts` |
| Search uses client | `backend/src/routes/search.ts` |

**Env rule:** Frontends use `NEXT_PUBLIC_API_URL` / `VITE_ADMIN_API_URL` only — no `NEXT_PUBLIC_WS_URL`.

## Phase 2 — Java modules

See `docs/JAVA_MODULE_MAP.md`. STOMP disabled unless `oceanbazar.websocket.stomp.enabled=true`.

## Phase 3 — Realtime

| Item | Location |
|------|----------|
| Java Redis publish | `backend-java/.../realtime/RealtimeRedisPublisher.java` |
| BFF bridge | `backend/src/realtime/redisEventBridge.ts` |
| Storefront catalog | `frontend/components/shared/CatalogSyncProvider.tsx` |
| Admin realtime | `admin-frontend-react/src/hooks/useAdminRealtimeSocket.js` |

## Phase 4 — Events

| Item | Location |
|------|----------|
| Domain events (Node) | `backend/src/events/` |
| DLQ table | `failed_events` migration |
| Java publisher | `backend-java/.../events/DomainEventPublisher.java` |

## Phase 5 — Observability

| Item | Location |
|------|----------|
| BFF Prometheus | `GET /metrics`, `backend/src/metrics/prometheus.ts` |
| Docs | `docs/OBSERVABILITY.md` |

## Phase 6 — Analytics

| Item | Location |
|------|----------|
| Schema + MVs | `backend/prisma/migrations/20260525000000_refactor_v2_platform/` |
| Cron | `backend/src/jobs/analyticsAggregation.ts` |

## Phase 7 — Security

| Item | Location |
|------|----------|
| RBAC roles | Prisma `AdminRole` + `backend/src/middleware/rbac.ts` |
| Admin sessions | `admin_sessions`, `adminSessionService.ts` |
| Audit logs | Existing `audit_logs` (append-only by convention) |

## Phase 8–11

| Item | Location |
|------|----------|
| Staging smoke | `scripts/ops/staging-smoke.mjs` |
| Go-live checklist | `docs/GO_LIVE_CHECKLIST.md` |
| CI | `.github/workflows/refactor-ci.yml` |

## Deploy order

1. PostgreSQL migration `20260525000000_refactor_v2_platform`
2. Java API (Redis publisher)
3. BFF (bridge + flags)
4. Storefront + Admin static builds
5. Enable traffic; monitor `/metrics` and Sentry
