# Oceanbazar — Full-Stack Bangladesh E-Commerce Platform

A complete retail + wholesale e-commerce platform for Bangladesh, similar to Amazon and Alibaba.

---

## Architecture Overview

```
┌─────────────────┐                          ┌─────────────────────┐
│  Next.js 14     │──────────────────────────▶│  Node.js BFF        │
│  Storefront     │   (all API calls)         │  (Port 4000)        │
│  (Port 3000)    │                           │  Search, Cache,     │
└─────────────────┘                           │  Realtime, Auth     │
                                              └────────┬────────────┘
                                                       │ proxy
┌─────────────────┐                           ┌────────▼────────────┐
│  Vite + React   │──────────────────────────▶│  Spring Boot 3.2    │
│  Admin Panel    │   (direct)                │  Core API           │
│  (Port 5173)    │                           │  (Port 8000)        │
└─────────────────┘                           │  Orders, Payments,  │
                                              │  Delivery, Customers│
                                              └────────┬────────────┘
                                                       │
                              ┌─────────────┬──────────┴──────────┐
                              ▼             ▼                     ▼
                        PostgreSQL        Redis             File Storage
                        (Primary DB)     (Cache)            (uploads/)
                        Port 5433        Port 6379
```

### Service Roles

| Service | Port | Role |
|---------|------|------|
| **Next.js Storefront** | 3000 | SSR React storefront (bilingual BN/EN) |
| **Vite Admin Panel** | 5173 | Fast admin SPA |
| **Node.js BFF** | 4000 | Backend-for-Frontend: auth, search, caching, realtime (Socket.IO) |
| **Spring Boot Core API** | 8000 | Core business logic: orders, payments, delivery, customers, admin CRUD |
| **PostgreSQL** | 5433 | Primary database (shared by Prisma + JPA) |
| **Redis** | 6379 | Response caching, session data, pub/sub |

---

## Quick Start

### Prerequisites
- Node.js 20+, npm 10+
- Docker Desktop (for PostgreSQL + Redis)
- Java 17+ (for Spring Boot Core API)

### 1. Start the database services
```bash
docker compose up postgres redis -d
```

PostgreSQL is exposed on **localhost:5433** (not 5432) so it does not clash with a local Postgres install. Set `DATABASE_URL` in `backend/.env` to use port **5433** (see `backend/.env.example`).

### 2. Set up the Node.js API
```bash
cd backend
cp .env.example .env       # Fill in your credentials
npm install
npx prisma migrate dev     # Run all migrations
npx prisma db seed         # Seed admin + sample data
npm run dev                # Starts on http://localhost:4000
```

### 3. Start the Next.js storefront
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev                # Starts on http://localhost:3000
```

### 4. Start the Admin dashboard
```bash
cd admin-frontend-react
npm install
npm run dev                # Starts on http://localhost:5173
```

### Default Admin Login

The admin CRM calls the **Node.js BFF** (port 4000), which proxies admin routes to the Spring Boot Core API. Start both `backend` and `backend-java` before signing in.

**Primary account** (created/updated by `backend/prisma/seed.ts` and ensured on each Spring Boot startup in `DataSeeder`):

- **URL**: http://localhost:5173  
- **Username**: `rjsuvosa`  
- **Password**: `rjsuvosa420`  

**Alternate** (from Prisma seed if you have not removed it):

- **Username**: `superadmin`  
- **Password**: `Admin@1234`  

If login fails, run Prisma seed against your DB: `cd backend && npx prisma db seed`, then restart Spring Boot so `admin_users` has the expected rows and password hashes.

---

## 📁 Repository Structure

```
OCEAN BAZAR website/
├── frontend/               ← Next.js 14 storefront (TypeScript)
│   ├── app/[locale]/       ← i18n routing (en / bn)
│   ├── components/         ← UI components
│   ├── stores/             ← Zustand state management
│   ├── lib/                ← API client, pricing, OB Points logic
│   └── messages/           ← en.json, bn.json translations
├── admin-frontend-react/   ← React 18 + Vite admin dashboard
│   └── src/pages/          ← Including new FileImportPage, OBPointsPage, TicketsPage
├── backend/                ← Node.js Express + TypeScript API (NEW)
│   ├── prisma/schema.prisma← Full PostgreSQL schema
│   ├── src/routes/         ← All API endpoints
│   ├── src/services/       ← Business logic
│   └── src/utils/          ← hexId, pricing, OB Points utilities
├── backend-java/           ← Spring Boot 3.2 (existing, kept for migration)
└── docker-compose.yml      ← PostgreSQL, Redis, API, Web containers
```

---

## ✨ Key Features

### 🌐 Multi-Language
- **Bangla (default)** and **English** — toggle in header
- All UI strings in `messages/en.json` and `messages/bn.json`
- URL-based locale: `/bn/...` and `/en/...`

### 💰 Pricing Engine
| Customer | Qty 1 | Tier 1 | Tier 2 | Tier 3 |
|----------|-------|--------|--------|--------|
| **Retail** | 0% | 5% off | 10% off | 15% off |
| **Wholesale** (below MOQ) | Retail pricing applies | | | |
| **Wholesale** (meets MOQ) | 0% | 2% off | 5% off | 8% off |

### ⭐ OB Points System
| Tier | Lifetime Spend | 1,000 OB | 5,000 OB | 10,000 OB |
|------|---------------|----------|----------|-----------|
| 🥉 Bronze | < 10,000 BDT | 10 Tk | 75 Tk | 180 Tk |
| 🥈 Silver | ≥ 10,000 BDT | 15 Tk | 100 Tk | 250 Tk |
| 🥇 Gold | ≥ 50,000 BDT | 20 Tk | 125 Tk | 300 Tk |

### 🔐 Authentication
- Email OTP (6-digit, printed to terminal in dev)
- Phone OTP (6-digit, printed to terminal in dev)
- Password login (uppercase + lowercase + number + symbol required)
- Social OAuth: Google, Facebook (via Firebase popup sign-in)
- Firebase Auth: popup-based social login with server-side token verification
- JWT: 15min access token + 7-day httpOnly refresh cookie
- Forgot password: OTP → reset → email + SMS notification

### 🆔 ID System
- **Entity IDs**: `A3F2B1C9` (8-digit uppercase HEX)
- **Order numbers**: `OB-A3F2B1C9`
- **Tracking numbers**: `A3F2B1C9D4E5F6A7` (16-digit HEX)

### 💳 Payment Methods
- Cash on Delivery (COD) — disabled above 5,000 BDT, always visible
- bKash, Nagad, SSLCommerz — real API integration stubs
- Installment — visible but disabled ("Coming Soon")

### 📁 File-Based Product Import
Admin → File Import → Enter path (e.g. `C:\Users\akand\Desktop\All Categories (Demo)`) → Scan → Preview → Import

Folder convention:
```
All Categories (Demo)/
├── Electronics/           ← Category
│   ├── Smartphones/       ← Subcategory
│   │   ├── Samsung A54/   ← Product (folder name = title)
│   │   │   ├── front.jpg
│   │   │   └── back.jpg
```

---

## 📡 API Endpoints

| Route | Description |
|-------|-------------|
| `POST /api/auth/send-otp` | Send 6-digit OTP (prints to terminal in dev) |
| `POST /api/auth/verify-otp` | Verify OTP → issue JWT |
| `POST /api/auth/social/google` | Google OAuth |
| `GET /api/products` | Product list (filters, pagination, lang) |
| `GET /api/products/:id` | Product detail |
| `POST /api/cart/add` | Add to cart (server-side pricing) |
| `POST /api/orders/place` | Place order (COD gate enforced) |
| `GET /api/ob-points/balance` | OB Points balance + tier |
| `POST /api/ob-points/redeem` | Redeem points for BDT discount |
| `POST /api/payments/bkash/initiate` | Initiate bKash payment |
| `POST /api/payments/sslcommerz/ipn` | SSLCommerz webhook |
| `POST /api/tickets` | Create support ticket |
| `POST /api/admin/file-import/scan` | Scan folder structure |
| `POST /api/admin/file-import/execute` | Import products from folder |

---

## 🛠 Development Commands

```bash
# Backend
npm run dev          # Dev server with hot reload
npx prisma studio    # Visual DB browser
npx prisma migrate dev --name "your_migration"

# Frontend
npm run dev          # Next.js dev server
npm run type-check   # TypeScript validation
npm run build        # Production build

# Docker
docker compose up postgres redis        # Just DB + cache
docker compose up                       # Full stack (infra + BFF + Java)
docker compose --profile full up -d     # + Storefront + Admin CRM
docker compose --profile full --profile production up -d  # + Nginx
docker compose --profile tools up       # + pgAdmin at :5050
```

---

## 🚀 Production Deployment

### Docker Compose (recommended)

1. Copy the production env template:
   ```bash
   cp .env.production.example .env
   ```
2. Edit `.env` — set strong passwords for `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and fill in payment/courier credentials.

3. Place SSL certificates in `nginx/ssl/` (or use Let's Encrypt).

4. Build and start all services:
   ```bash
   docker compose --profile full --profile production up -d --build
   ```

5. Run database migrations:
   ```bash
   docker compose exec api npx prisma migrate deploy
   docker compose exec api npx prisma db seed
   ```

### Services

| URL | Service |
|-----|--------|
| `https://oceanbazar.com` | Storefront (Next.js via Nginx) |
| `https://admin.oceanbazar.com` | Admin CRM (Vite via Nginx) |
| Internal `:4000` | Node.js BFF |
| Internal `:8000` | Spring Boot Core API |

### Health Checks

- **BFF**: `GET /api/health`
- **Java**: `GET /actuator/health`
- **Storefront**: HTTP 200 on `/`

---

## 📋 Build Phases Status

- [x] **Phase 1** — Foundation: Next.js 14, Prisma schema, i18n, Docker
- [x] **Phase 2** — Auth: OTP, Social OAuth, password rules
- [x] **Phase 3** — Catalog: Bilingual products, file import
- [x] **Phase 4** — Pricing: Retail/wholesale tier engine
- [x] **Phase 5** — Cart & Orders: COD gate, HEX IDs
- [x] **Phase 6** — OB Points: Ledger, tiers, redemption
- [x] **Phase 7** — Payments: bKash, Nagad, SSLCommerz
- [x] **Phase 8** — Delivery: Shipments, tracking, carriers
- [x] **Phase 9** — Tickets: Complaint system, real-time replies
- [x] **Phase 10** — Admin: FileImport, OBPoints, Tickets, RBAC
- [x] **Phase 11** — Production: Sitemap, Docker, rate limiting
- [x] **Phase 12** — Firebase Auth, delivery tracking, real-time notifications, chat
- [x] **Phase 13** — Deploy readiness: Dockerfiles, Nginx, env configs, healthchecks

---

Made with ❤️ for Bangladesh 🇧🇩
