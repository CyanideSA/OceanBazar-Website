# OceanBazar — Enterprise AWS implementation plan

This document breaks the target architecture (CloudFront → S3, ALB/API Gateway → ECS Fargate microservices, RDS PostgreSQL, ElastiCache Redis, CI/CD, WAF, observability) into **ordered phases**. Each phase has exit criteria before the next starts.

**Current codebase reality:** monorepo with Next.js storefront (`frontend`), Vite admin (`admin-frontend-react`), Node BFF (`backend`), Spring Boot API (`backend-java`), Prisma + Flyway migrations, Redis/Socket.IO/WebSockets in-process. **Microservices split (realtime-only, notifications, AI, search, analytics as separate ECS services) is future work** built on stable Phase 1–3.

---

## Phase 0 — Preconditions (account & governance)

| Task | Owner | Exit criteria |
|------|--------|----------------|
| AWS org / account, billing alarm | You | Active account |
| Domain `oceanbazar.com.bd` in Route 53 (or registrar + delegation) | You | NS delegated |
| Decide region(s) e.g. `ap-southeast-1` | You | Written in tfvars |
| **Secrets:** no secrets in Git; AWS Secrets Manager / SSM for prod | You | Policy documented |
| **Terraform remote state** (S3 + DynamoDB lock) | You | Backend configured |

**Repo deliverables:** `infra/terraform/` with `backend "s3"` block commented + README how to enable.

---

## Phase 1 — Network & registry (foundation)

| Task | Exit criteria |
|------|----------------|
| VPC (private subnets for ECS/RDS, public for ALB—or AWS VPC module) | Terraform applied |
| NAT Gateway(s) for private egress (pull images, RDS/ElastiCache if needed) | Working |
| **ECR repositories** per deployable image (min: `bff`, `java-api`; extend later) | Repos exist; lifecycle policies |
| IAM roles: ECS task execution, task role (Secrets Manager read) | Wired |

**Repo status:** `infra/terraform/` adds optional ALB HTTPS (ACM ARN in ALB region), S3 + CloudFront OAC for storefront/admin, optional OIDC for CI, BYO-VPC, and **`environment = "prod"` guardrails** (HTTPS on ALB, RDS Multi-AZ + deletion protection + no skip final snapshot + backup retention ≥7, CloudFront custom domains + `us-east-1` ACM when static hosting is on). Use `staging` until ACM/DNS and tfvars meet those rules. Still typically **outside this repo**: WAF, Route53/ACM DNS unless you extend Terraform, Prisma migrate job wiring, full observability.

---

## Phase 2 — Data plane (RDS + ElastiCache)

| Task | Exit criteria |
|------|----------------|
| **RDS PostgreSQL** Multi-AZ, automated backups, **PITR** enabled | Instance ready |
| Security groups: only BFF/Java (and future services) → RDS:5432 | Locked down |
| **ElastiCache Redis** (subnet group, replication group if HA) | Endpoint in SSM/Secrets |
| Run migrations against RDS **from CI or one-shot task** (never hand-edit prod) | Documented procedure |

**Schema governance:** Align Prisma vs Flyway ownership (overlap script already in repo context); production changes **versioned migrations only**.

---

## Phase 3 — Compute (ECS Fargate) — minimum viable

Deploy **two services** first (matches current repo):

1. **Java API** — Spring Boot container (`backend-java/Dockerfile`).
2. **BFF** — Node container (`backend/Dockerfile`), env: `DATABASE_URL`, `REDIS_URL`, `JAVA_API_URL` → Java service discovery / ALB internal hostname.

| Task | Exit criteria |
|------|----------------|
| ECS cluster + CloudWatch log groups | Done |
| Task definitions (CPU/mem, secrets from Secrets Manager) | Done |
| **ALB** (HTTPS), target groups, health checks (`/api/health`, BFF health path) | Green |
| Optional: internal-only ALB target for Java; public only BFF | Architecture decided |

**Do not** expose raw task IPs publicly — only ALB (or API GW in front later).

---

## Phase 4 — Frontends (S3 + CloudFront)

| App | Build | Upload |
|-----|--------|--------|
| Storefront | `cd frontend && npm run build:s3` | **Contents** of `frontend/out/` to S3 origin |
| Admin CRM | `cd admin-frontend-react && npm run build` | **Contents** of `admin-frontend-react/dist/` |

| Task | Exit criteria |
|------|----------------|
| Two origins or prefixes (`/admin/*`) + behaviours | Working |
| OAI/OAC, HTTPS cert (ACM us-east-1 for CloudFront if applicable) | Valid SSL |
| Env: `NEXT_PUBLIC_*` / `VITE_*` point to **public API** hostname | No secrets in bundle |

---

## Phase 5 — API domain & CORS

| Task | Exit criteria |
|------|----------------|
| `api.oceanbazar.com.bd` → ALB (or API Gateway → VPC Link → ALB) | DNS green |
| CORS / `CORS_ALLOWED_ORIGINS` / `CLIENT_URL` / `ADMIN_URL` updated | Browser OK |

---

## Phase 6 — Realtime & horizontal scale

**Today:** WebSockets/Socket.IO live inside BFF (and Java STOMP). **Target:** dedicated **Realtime** ECS service behind ALB sticky sessions **or** separate NLB, **Redis pub/sub** (or ElastiCache channels) so multiple tasks stay consistent.

| Task | Exit criteria |
|------|----------------|
| Extract or duplicate realtime boundary into a service (incremental) | Design doc + spike |
| Redis pub/sub between instances | Chat/admin live stable under scale |
| ALB stickiness / connection draining documented | Runbook |

---

## Phase 7 — Additional microservices (incremental)

Split only when SLO/clear boundaries demand:

| Service | Purpose |
|---------|---------|
| Notification | Email/push/SMS workers, queues |
| AI automation | Async inference, no AI in frontend bundles |
| Search/indexing | OpenSearch + ingest pipeline |
| Analytics | Aggregation, export to warehouse |

Each: own ECR repo, ECS service, IAM, autoscaling, alarms.

---

## Phase 8 — Security & compliance

| Task | Exit criteria |
|------|----------------|
| **AWS WAF** on CloudFront + ALB | Rulesets |
| Secrets rotation policy | Enabled |
| VPC endpoints (ECR, S3, Logs) optional cost optimization | As needed |

---

## Phase 9 — Observability & CI/CD

| Task | Exit criteria |
|------|----------------|
| CloudWatch dashboards / alarms (5xx, latency, ECS CPU/mem) | Done |
| GitHub Actions: build → test → push ECR → deploy ECS → sync S3 → **CloudFront `/*` invalidation** | Pipeline green |
| Staging env mirrors prod topology | Required before prod cut |

---

## Phase 10 — Launch checklist (abbrev.)

- No systematic 4xx/5xx on storefront/admin critical paths  
- Auth, checkout, tier pricing, OB points, coupons (as implemented) verified on **staging**  
- RDS backup + **restore drill**  
- Rollback procedure (previous task definition / image tag) documented  

---

## Deployment order (summary)

1. Route 53 + ACM SSL  
2. S3 + CloudFront (storefront + admin assets)  
3. VPC + ECR + ECS cluster  
4. RDS + ElastiCache  
5. ALB + ECS services (Java + BFF)  
6. DNS `api.*` → ALB  
7. CI/CD + WAF + monitoring  
8. Split realtime / extra microservices as needed  

---

## Repo map (implementation artifacts)

| Path | Purpose |
|------|---------|
| `infra/terraform/` | VPC, RDS, Redis, ECR, ECS/ALB, S3+CloudFront OAC, Secrets, optional OIDC |
| `.github/workflows/docker-images-ci.yml` | Build/push BFF + Java images (optional ECR push) |
| `.github/workflows/deploy-static-s3.yml` | Build + `aws s3 sync` + CloudFront invalidation (OIDC) |
| `frontend` — `npm run build:s3` | Static storefront → `out/` |
| `admin-frontend-react` — `npm run build` | Admin → `dist/` |

This plan is **living**: update phase exit criteria as decisions are made (single vs multi-account, API Gateway vs ALB-only, etc.).
