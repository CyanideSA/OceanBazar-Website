# Observability

## Request correlation

- **Storefront (axios)** — Sends `X-Request-Id` per request (`frontend/lib/api.ts`).
- **Admin CRM (axios)** — Same (`admin-frontend-react/src/lib/api.js`).
- **BFF** — `requestIdMiddleware` normalizes/generates the id, sets the response header, and attaches `req.requestId`.
- **Java** — `RequestIdCorrelationFilter` echoes incoming `X-Request-Id` or creates one; stores it in **SLF4J MDC** as `requestId` for log appenders.
- **Proxy** — `springBootProxy` forwards `X-Request-Id` to Java on proxied admin traffic.

Add `%X{requestId}` (or your layout’s MDC placeholder) to **logback** patterns so Java logs include the same id as Node.

## Structured logs (BFF)

- Use `appLog` from `backend/src/lib/appLog.ts` for JSON lines (`level`, `msg`, `ts`, arbitrary fields).
- Payment idempotent skips emit `payment_success_idempotent_skip`.
- Proxy errors emit a JSON line with `spring_boot_proxy_error` and `requestId`.
- PWA funnel beacons log as `pwa_client_event` (`POST /api/analytics/pwa`).

## Sentry (implemented)

| Runtime | Package / integration | Env |
|--------|------------------------|-----|
| Storefront | `@sentry/nextjs` | `NEXT_PUBLIC_SENTRY_DSN`, optional `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` / `SENTRY_PROJECT` for source maps |
| BFF | `@sentry/node` | `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE` |
| Java | `sentry-spring-boot-starter-jakarta` | `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE` |

Storefront: `instrumentation.ts`, `sentry.*.config.ts`, conditional `withSentryConfig` in `next.config.mjs` when `NEXT_PUBLIC_SENTRY_DSN` is set.

## OpenTelemetry / OTLP (implemented)

| Runtime | Behavior |
|---------|----------|
| **BFF** | `backend/src/tracing.ts` starts `NodeSDK` + OTLP HTTP when `OTEL_EXPORTER_OTLP_ENDPOINT` is set (base URL only; `/v1/traces` appended). **Disabled when `SENTRY_DSN` is set** to avoid duplicate HTTP instrumentation. |
| **Java** | `micrometer-tracing-bridge-otel` + `opentelemetry-exporter-otlp`; `management.otlp.tracing.endpoint` (default `http://127.0.0.1:4318/v1/traces`), `management.tracing.sampling.probability`. |

Point both at an OpenTelemetry Collector or vendor OTLP ingest.

## DB / N+1 diagnostics

- **Prisma** — Prefer explicit `include` / `select` on hot list endpoints; avoid `findMany` + per-row `findUnique` in loops. Enable `DEBUG=prisma:query` locally for query traces.
- **Hibernate (Java)** — Set `HIBERNATE_GENERATE_STATISTICS=true` in staging; watch `org.hibernate.stat` logs for high statement / entity loads per session (symptom of N+1).

## Metrics

- **Java** — Actuator Prometheus (`/actuator/prometheus`) already exposed.
- **BFF** — Add `prom-client` middleware when you wire a scrape target.

## Dashboards

- Track: p95 BFF latency, Java proxy 502 rate, payment webhook error rate, DB connection saturation, Redis hit rate (if enabled).

## Alert rules baseline

- **API availability**: alert when `/api/health` failure rate is above 5% for 5 minutes.
- **Checkout degradation**: alert when checkout endpoint p95 latency is above 2.5s for 10 minutes.
- **Payment failures**: alert when payment webhook 5xx count is above threshold for 5 minutes.
- **Auth spike**: alert when admin login failures surge above normal baseline.
- **Database stress**: alert when connection pool utilization remains above 85% for 10 minutes.

## Incident response runbook

1. Detect and classify severity (SEV1/SEV2/SEV3).
2. Assign incident commander and comms owner.
3. Capture scope: impacted journeys (login, checkout, admin ops).
4. Use `X-Request-Id` from failing client request to trace BFF and Java logs.
5. Apply short-term mitigation (rollback, feature flag, traffic shed, provider fallback).
6. Confirm recovery via synthetic checks and E2E smoke.
7. Publish post-incident notes and corrective actions.

## Load testing

- **k6** script: `tests/load/k6-smoke.js`. From `frontend`: `npm run load:k6` (requires [k6](https://k6.io/) on PATH). Override `BASE_URL`, `BFF_URL`, `VUS`, `DURATION`.
