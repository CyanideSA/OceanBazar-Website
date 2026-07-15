# Data, security, PWA, and CI

## GDPR / account data

- **Export** — `GET /api/profile/gdpr-export` (authenticated) returns JSON attachment with profile, addresses, recent orders, and payment transaction summaries.
- **Delete / anonymize** — `POST /api/profile/gdpr-delete` with `{ "confirm": true }` clears addresses, social links, cart, wishlist (if table exists), and anonymizes the user row (orders retained for legal/audit). Clients should call `POST /api/auth/logout` afterward.

Admin CSV/exports that contain phone/email should follow your **retention policy** (time-bounded storage, access controls, and deletion procedures).

## Security controls

- **Admin IP allowlist** — Optional `ADMIN_ALLOWED_IPS` on the BFF; requires a trusted proxy and correct `X-Forwarded-For`.
- **Admin mutation rate limit** — Extra throttle on `POST`/`PUT`/`PATCH`/`DELETE` under `/api/admin` (login paths excluded).
- **Storefront headers** — `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and CSP (see `docs/CSP_INVENTORY.md`, `frontend/csp-headers.mjs`) via `next.config.mjs`.
- **CSP / SRI** — Inventory in `docs/CSP_INVENTORY.md`. Default `CSP_MODE=report-only`; set `CSP_MODE=enforce` when violations are clean. Add SRI hashes for any new external `<script>` tags.
- **Scans** — Run `npm audit`, dependency review on PRs, and container image scanning in CI; pin base images.

## PWA / mobile webview

- Storefront: `viewportFit: cover` and safe-area padding in `globals.css`.
- Cart: Zustand `persist` for offline-friendly draft until server sync.
- Admin: `index.html` meta; `index.css` scroll on narrow viewports.

### Install / push analytics (implemented)

- **Client** — `trackPwaEvent` in `frontend/lib/pwaAnalytics.ts` fires `CustomEvent('ob-pwa')` and `sendBeacon`/`fetch` to `POST /api/analytics/pwa` on the BFF.
- **Events** — `pwa_beforeinstallprompt`, `pwa_install_banner_shown`, `pwa_native_install_prompt`, `pwa_install_banner_dismissed`, `pwa_push_subscribed`, `pwa_sw_message` (from service worker).
- **GTM** — Listen for `ob-pwa` in a tag bridge and push to `dataLayer`.

## CI reality

- Full E2E (wizard, Cloudinary, catalog) may require **secrets** and optionally **`CI_RUN_JAVA`** so Spring Boot serves catalog routes.
- For fast PR checks, use workflow **dispatch** to skip the heavy wizard until secrets and Java are configured in CI.
- **Migration authority** — `npm run check:migrations` in `backend/` runs `scripts/check-migration-overlap.mjs` (Prisma `@@map` vs Flyway `CREATE/ALTER` heuristic). Set `MIGRATION_OVERLAP_STRICT=1` to fail the job when overlaps exist.

## Migrations and backups

- **Prisma** owns the Node/BFF schema (`backend/prisma/schema.prisma`). **Flyway** runs in Java (`backend-java/.../db/migration`). Do not `ALTER` the same logical table in both without a single owner; use the overlap script in CI.
- Backup and restore runbook: `docs/BACKUP_RESTORE_RUNBOOK.md`
- Operational scripts:
  - `scripts/db-backup.ps1`
  - `scripts/db-restore.ps1`

## CDN / images

- Next `images.deviceSizes` / `imageSizes` tuned in `next.config.mjs`.
- Helpers: `frontend/lib/cloudinaryImage.ts` for Cloudinary transformation segments and URL optimization.
