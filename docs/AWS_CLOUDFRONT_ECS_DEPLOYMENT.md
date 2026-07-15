# Oceanbazar on AWS: CloudFront → S3 → ALB → ECS → Redis / RDS PostgreSQL

This document maps the **current repo** to your target architecture and lists **exact configuration** you must set in AWS. The codebase is shaped so you can deploy without restructuring into different languages.

## How traffic should flow (correct mental model)

Browsers never “go through S3 to reach the API”. **Amazon CloudFront** is the single viewer-facing edge with **multiple origins**:

| Viewer path (examples) | CloudFront origin |
|------------------------|-------------------|
| `https://oceanbazar.com.bd/*`, static assets | **S3** (storefront build + admin build in one or two buckets) |
| `https://api.oceanbazar.com.bd/*` **or** `/api/*` on same distribution | **Application Load Balancer (ALB)** |

Optional: second CloudFront distribution for `admin.*` only — same idea.

## What counts as “microservices” in this repo today

You already have **two independently deployable backends**:

| Service | Path in repo | ECS task role |
|---------|----------------|----------------|
| Node.js BFF / gateway | `backend/` | Express, Prisma, Socket.IO, proxies to Java |
| Spring Boot core API | `backend-java/` | REST, admin/catalog, WebSocket/STOMP |

Data plane:

| Component | AWS mapping |
|-----------|-------------|
| PostgreSQL | **Amazon RDS for PostgreSQL** (same DB URL for Prisma + JDBC) |
| Redis | **Amazon ElastiCache for Redis** |

External SaaS (unchanged): **Firebase Auth**, **Cloudinary**, payment PSPs — they sit outside this diagram.

## Repository capabilities (already aligned)

- **Storefront** (`frontend/`): supports **static export to S3** via `NEXT_STATIC_EXPORT=1` and `npm run build`, or `node scripts/build-s3-static.mjs` (see script header). Use CloudFront **custom error responses** for SPA routes (`403/404` → `/index.html`) where needed.
- **Admin** (`admin-frontend-react/`): Vite **`npm run build`** → static files → S3.
- **BFF** (`backend/`): production **`Dockerfile`** builds `dist/` + **`GET /api/health`** for ALB target groups.
- **Java API** (`backend-java/`): **`GET /api/health`** for Compose; use the same for ECS health checks.
- **CORS / origins**: Java reads **`CORS_ALLOWED_ORIGINS`** (comma-separated). The BFF now merges **`CORS_ALLOWED_ORIGINS`** with **`CLIENT_URL`** / **`ADMIN_URL`** (`backend/src/app.ts`).
- **Reverse proxy**: BFF supports **`TRUST_PROXY=1`** behind ALB. Spring Boot uses **`SERVER_FORWARD_HEADERS_STRATEGY`** (default `framework`) for forwarded headers.
- **Next.js `next/image`**: `next.config.mjs` allows **`*.oceanbazar.com.bd`**, **`*.elb.amazonaws.com`**, **`*.cloudfront.net`** plus existing Oceanbazar / Cloudinary hosts.

## Required environment variables (production checklist)

### Node BFF (ECS)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | RDS PostgreSQL connection string (Prisma) |
| `REDIS_URL` | ElastiCache URL, e.g. `rediss://...` |
| `JAVA_API_URL` | Internal ALB URL or service discovery URL to Spring (**http://** inside VPC) |
| `CLIENT_URL` | Public storefront origin, e.g. `https://oceanbazar.com.bd` |
| `ADMIN_URL` | Public admin origin, e.g. `https://admin.oceanbazar.com.bd` |
| `CORS_ALLOWED_ORIGINS` | **Comma-separated** list of exact HTTPS origins (must include storefront + admin + `www` if used) |
| `TRUST_PROXY` | `1` behind ALB |
| `JWT_*`, OAuth callbacks | Point OAuth **`*_CALLBACK_URL`** at public **`https://api…/api/auth/...`** |
| `API_BASE_URL` / payment redirects | Public API hostname customers redirect back to |

### Spring Boot (ECS)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` / `DB_USER` / `DB_PASSWORD` | Same RDS as BFF |
| `REDIS_HOST` / `REDIS_PORT` | ElastiCache |
| `CORS_ALLOWED_ORIGINS` | Same comma-separated list as browsers use |
| `PUBLIC_BASE_URL` | External Java URL if clients hit Java directly (often internal only) |
| `WEBSOCKET_ALLOWED_ORIGIN_PATTERNS` | e.g. `https://*.oceanbazar.com.bd` patterns if you use pattern-based WS origin checks |

### Global maintenance (production)

| Layer | How to enable |
|-------|----------------|
| **Storefront (S3 + CloudFront)** | `npm run aws:deploy:maintenance` from repo root (builds maintenance-only static export, syncs S3, invalidates CloudFront). Or GitHub Actions **Deploy static sites** with **maintenance_only** checked. |
| **BFF + Java (ECS)** | Same script updates task definitions with `MAINTENANCE_MODE=true`, or set `maintenance_mode = true` in Terraform and apply. |
| **Staff bypass** | `https://oceanbazar.com.bd/en?bypass=<MAINTENANCE_BYPASS_TOKEN>` (token in `config/maintenance.env`, not committed). |

### Storefront build-time (S3 / CI)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Public BFF base URL |
| `NEXT_PUBLIC_WS_URL` | Public Java WS/SockJS base (**https://** / **wss://** in prod) |
| `NEXT_PUBLIC_SITE_URL` | Canonical storefront URL |
| Firebase `NEXT_PUBLIC_FIREBASE_*` | As today |

### Admin build-time (S3 / CI)

| Variable | Purpose |
|----------|---------|
| `VITE_ADMIN_API_URL` | Public BFF URL |
| `VITE_WS_URL` | Public Java WS URL if admin opens sockets directly |
| `VITE_STOREFRONT_URL` | Storefront origin for preview / external links |

## ALB and WebSockets

- SockJS/STOMP from the browser needs an ALB listener rule that forwards to the **Java service target group** (or a shared TG if you terminate WS on one service).
- Enable **sticky sessions** on the target group if you see intermittent disconnects during scale-out.
- API Gateway **HTTP API** is poor fit for arbitrary SockJS upgrades; **ALB → ECS** is the straightforward choice.

## Security notes

- Secrets: **AWS Secrets Manager** or **SSM Parameter Store**, injected as ECS task secrets — do not bake into images.
- **WAF** on CloudFront (and optionally on ALB).
- Restrict **`ADMIN_ALLOWED_IPS`** (BFF) if admin should not be world-accessible.

## Operational commands (already in repo)

| Goal | Command |
|------|---------|
| Static storefront output | `cd frontend && node scripts/build-s3-static.mjs` |
| Admin static bundle | `cd admin-frontend-react && npm run build` → `dist/` |
| Local full stack | `npm run docker:full` or `npm run docker:live` |

After AWS cutover, update **`CORS_ALLOWED_ORIGINS`** on **both** BFF and Java whenever you add a new public hostname (`www`, staging, etc.).
