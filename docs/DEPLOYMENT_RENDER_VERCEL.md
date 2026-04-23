# OceanBazar Deployment Guide (Render + Vercel)

This guide covers production deployment for:
- Storefront (`frontend`) on Vercel
- Admin CRM (`admin-frontend-react`) on Render Static Site
- Backend BFF (`backend`) on Render Web Service
- Java API (`backend-java`) on Render Web Service
- Neon PostgreSQL (external) + optional Redis

---

## 1) Service Topology

- Vercel (Storefront): `https://<storefront-domain>`
- Render (Admin CRM): `https://<admin-domain>`
- Render (BFF): `https://<bff-domain>`
- Render (Java API): `https://<java-domain>`
- Neon PostgreSQL (managed externally)

---

## 2) Render Blueprint

A starter blueprint is provided at repo root:
- `render.yaml`

### Import steps
1. Render Dashboard → **Blueprints** → **New Blueprint Instance**
2. Select repo and branch
3. Confirm `render.yaml`
4. Fill all placeholder values and secret env vars
5. Deploy

---

## 3) Vercel Setup (Storefront)

Project:
- Repo: `OCEANBAZAR-Frontend`
- Root Directory: `frontend`
- Framework: Next.js

Build:
- Install: auto
- Build command: `npm run build`

### Required Vercel env vars

```env
NEXT_PUBLIC_API_URL=https://<bff-domain>
NEXT_PUBLIC_WS_URL=https://<java-domain>
NEXT_PUBLIC_SITE_URL=https://<storefront-domain>

NEXT_PUBLIC_FIREBASE_API_KEY=<firebase_api_key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<firebase_auth_domain>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<firebase_project_id>
NEXT_PUBLIC_FIREBASE_APP_ID=<firebase_app_id>
```

---

## 4) Render Setup (Admin CRM)

Project:
- Type: Static Site
- Repo: `OCEANBAZAR-Frontend-Admin`
- Root Directory: `admin-frontend-react`
- Build Command: `npm ci && npm run build`
- Publish Directory: `dist`

### Required env vars

```env
VITE_ADMIN_API_URL=https://<bff-domain>
VITE_WS_URL=https://<java-domain>
```

---

## 5) Render Setup (Node BFF)

Project:
- Type: Web Service
- Repo: `OCEANBAZAR-Backend`
- Root Directory: `backend`
- Build Command: `npm ci && npm run db:generate && npm run build`
- Start Command: `npx prisma migrate deploy && npm run start`

### Required env vars (minimum)

```env
NODE_ENV=production
PORT=10000
CLIENT_URL=https://<storefront-domain>
ADMIN_URL=https://<admin-domain>
JAVA_API_URL=https://<java-domain>

DATABASE_URL=postgresql://neondb_owner:<NEON_PASSWORD>@ep-small-sunset-aom3ownz-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
REDIS_URL=<optional_redis_url>

JWT_ACCESS_SECRET=<strong_secret>
JWT_REFRESH_SECRET=<strong_secret>
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

OTP_EXPIRE_MINUTES=10
OTP_TERMINAL_ONLY=true

UPLOAD_DIR=/tmp/uploads
PUBLIC_BASE_URL=https://<bff-domain>

CLOUDINARY_CLOUD_NAME=<cloudinary_name>
CLOUDINARY_API_KEY=<cloudinary_key>
CLOUDINARY_API_SECRET=<cloudinary_secret>
```

### Optional BFF env vars (enable as needed)

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=Oceanbazar <noreply@oceanbazar.com>

FIREBASE_API_KEY=
FIREBASE_PROJECT_ID=

RECAPTCHA_SITE_KEY=
RECAPTCHA_PROJECT_ID=

PATHAO_BASE_URL=
PATHAO_CLIENT_ID=
PATHAO_CLIENT_SECRET=
PATHAO_USERNAME=
PATHAO_PASSWORD=
PATHAO_STORE_ID=

STEADFAST_BASE_URL=
STEADFAST_API_KEY=
STEADFAST_SECRET_KEY=

PAPERFLY_USERNAME=
PAPERFLY_PASSWORD=
PAPERFLY_KEY=
PAPERFLY_WEBHOOK_SECRET=
```

---

## 6) Render Setup (Java API)

Project:
- Type: Web Service (Docker)
- Repo: `OCEANBAZAR-Backend`
- Root Directory: `backend-java`
- Health Check: `/actuator/health`

### Required env vars (minimum)

```env
SERVER_PORT=10000
DATABASE_URL=jdbc:postgresql://ep-small-sunset-aom3ownz.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
DB_USER=neondb_owner
DB_PASSWORD=<NEON_PASSWORD>

CACHE_TYPE=simple

JWT_SECRET_KEY=<strong_secret>

PUBLIC_BASE_URL=https://<java-domain>
UPLOAD_DIR=/tmp/uploads

CORS_ALLOWED_ORIGINS=https://<storefront-domain>,https://<admin-domain>
WEBSOCKET_ALLOWED_ORIGINS=https://<storefront-domain>,https://<admin-domain>
WEBSOCKET_ALLOWED_ORIGIN_PATTERNS=https://*.vercel.app,https://*.onrender.com

CLOUDINARY_CLOUD_NAME=<cloudinary_name>
CLOUDINARY_API_KEY=<cloudinary_key>
CLOUDINARY_API_SECRET=<cloudinary_secret>
```

---

## 7) Database + Migration

After BFF deploy succeeds:
1. Open Render Shell for BFF
2. Run:

```bash
npx prisma migrate deploy
npx prisma db seed
```

Use this only for controlled initial data.

---

## 8) Domain + CORS Checklist

- Add custom domains in Vercel and Render
- Update:
  - `CLIENT_URL`, `ADMIN_URL` in BFF
  - `CORS_ALLOWED_ORIGINS` in Java API
  - `WEBSOCKET_ALLOWED_ORIGINS` in Java API
- Re-deploy Java API + BFF after URL changes

---

## 9) Security Checklist (Mandatory)

- Rotate all secrets before public launch
- Never commit `.env` files
- Keep production secrets only in platform env settings
- Restrict DB/Redis to internal network where possible
- Enable HTTPS custom domains

---

## 10) Quick Smoke Test

1. Open storefront homepage
2. Verify API data loads (products/categories/settings)
3. Admin login and dashboard loads
4. Upload media from admin
5. Checkout flow and coupon fetch works
6. Live chat/realtime endpoint health checks pass

