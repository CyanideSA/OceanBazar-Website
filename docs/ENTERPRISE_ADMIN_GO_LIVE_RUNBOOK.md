# Enterprise Admin CRM Go-Live Runbook

## Scope
- Admin security architecture (session rotation, policy checks, immutable audit chain).
- Commerce operations (orders, multi-courier, returns, payments).
- Customer 360 and team-control governance.
- Dual dark/light theme support.

## Pre-Release Gates
1. `backend`: `npm run build`
2. `admin-frontend-react`: `npm run build`
3. Smoke checks (admin auth + products + orders + delivery + payments + team):
   - `POST /api/admin/auth/login`
   - `GET /api/admin/products`
   - `GET /api/admin/orders`
   - `GET /api/admin/delivery/health/summary`
   - `GET /api/admin/payments/reconciliation/mismatches`
   - `GET /api/admin/team/members`
4. Security checks:
   - Refresh token rotation works (`/api/auth/refresh` rotates cookie).
   - Replayed idempotency key returns same response for refund/courier assign endpoints.
   - Audit chain hash fields exist in `audit_logs.details`.
5. Observability checks:
   - `/metrics` exposed and scraping healthy.
   - Sentry error ingestion healthy.

## Production Rollout Steps
1. Deploy API and Admin CRM images.
2. Verify `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` are valid.
3. Warm up health endpoints:
   - `/api/health`
   - `/api/admin/overview`
4. Execute smoke journey:
   - login
   - customer 360
   - order status update
   - courier assign
   - refund flow with idempotency key
5. Monitor first 30 minutes:
   - 401/403 spikes
   - payment/refund failures
   - courier assignment failures
   - admin mutation audit entries

## Rollback Triggers
- Sustained 5xx > 2% over 10 minutes.
- Auth refresh failure > 3% over 10 minutes.
- Payment/refund mismatch growth after deployment.

## Rollback Plan
1. Roll back API + Admin image tags.
2. Keep database state (no destructive migration required for these changes).
3. Re-run smoke checks from previous stable release.

## Post-Go-Live Validation
- Validate role-based access matrix on live admin accounts.
- Confirm theme persistence across sessions for at least one account per role.
- Review `audit_logs` chain integrity (`prevHash`/`chainHash`) for mutation endpoints.

