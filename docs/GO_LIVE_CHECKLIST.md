# Go-live checklist (Phase 11)

## Pre-launch

- [ ] `git tag v1-stable` on current production commit
- [ ] Run `scripts/ops/backup-all.ps1` — verify `postgres.dump` restores in staging
- [ ] `docker compose -f docker-compose.rollback.yml` drill completed
- [ ] `npx prisma migrate deploy` in `backend/` against production RDS
- [ ] Feature flags in `config/feature-flags.json` reviewed (all `true` for launch)
- [ ] `MAINTENANCE_MODE=false` on BFF, Java, storefront
- [ ] Sentry DSN + alerts configured (checkout 5xx, Java proxy 502)
- [ ] Prometheus/Grafana scraping BFF `/metrics` and Java `/actuator/prometheus`
- [ ] `node scripts/ops/staging-smoke.mjs` passes against staging ALB
- [ ] `npm run load:k6` in `frontend/` against staging (smoke thresholds)

## Launch sequence

1. Maintenance ON (storefront middleware + env)
2. Deploy Java → BFF → run migrations → static frontends
3. Smoke: health, login, product, checkout (test payment), admin login
4. Maintenance OFF
5. Watch error rate 2 hours

## Validation (Phase 10)

- [ ] User registration + OTP
- [ ] Login / logout / refresh token
- [ ] Product browse + search
- [ ] Cart + checkout + COD/payment test
- [ ] Order tracking + notifications (Socket.IO)
- [ ] Admin CRUD + file import
- [ ] Realtime: catalog refresh, admin dashboard ticks
- [ ] Analytics MV refresh (nightly job or manual `REFRESH`)

## Rollback

1. Set `ROLLBACK_IMAGE_TAG=v1-stable` and `docker compose -f docker-compose.rollback.yml up -d`
2. Restore DB if schema migration incompatible: `scripts/ops/restore-postgres.ps1`
3. Re-enable maintenance until stable
