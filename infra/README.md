# OceanBazar infrastructure

## Terraform (`terraform/`)

Delivers **Phase 1–4 core infra** on AWS (everything codifiable without clicking the console; ACM issuance/DNS validation still happens outside Terraform unless you add Route53):

- VPC: either **create** via `terraform-aws-modules/vpc/aws` or **bring your own** (`use_existing_vpc` + subnet IDs)
- ECR repositories (BFF + Java API + **ML service**) with lifecycle policies
- ECS Fargate cluster, task definitions, services (defaults **desired count 0** until images exist)
- Public ALB → BFF only; **Java API and ML service are internal** via Cloud Map (`java-api.{project}-{env}.local`, `ml-service.{project}-{env}.local`)
- Optional **ALB HTTPS** (`enable_alb_https` + regional `alb_acm_certificate_arn`) with HTTP→HTTPS redirect
- RDS PostgreSQL + ElastiCache Redis (private subnets)
- Secrets Manager secret `{project}-{env}/app-runtime` (Prisma URL, JDBC URL, DB creds, JWT keys, **ML API key**, optional OpenAI + Microsoft 365)
- **S3 + CloudFront (OAC)** for storefront (`frontend/out/`) and admin (`admin-frontend-react/dist/`), SPA fallback to `index.html`
- Optional **GitHub Actions OIDC** IAM role: ECR push/pull + optional **S3 deploy + CloudFront invalidation**

Full roadmap: `docs/AWS_ENTERPRISE_IMPLEMENTATION_PLAN.md`.

### Prerequisites

- AWS CLI configured (`aws configure` or SSO).
- Terraform >= 1.5 (uses `check` blocks).
- Docker (optional) for `terraform validate` via the official image if Terraform is not installed locally.

### Bring your own VPC

Set in `terraform.tfvars`:

- `use_existing_vpc = true`
- `existing_vpc_id` — VPC console → **Your VPCs** → **VPC ID** column
- `existing_private_subnet_ids` — **Subnets** → filter by VPC → private subnets (copy **Subnet ID**), ≥2 in different AZs
- `existing_public_subnet_ids` — same for **public** subnets where the ALB will live (≥2 AZs)

Private subnets must reach the internet for Fargate image pulls (NAT) unless you add **VPC endpoints** for ECR/S3/Logs.

### Configure & apply

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # edit — especially github_* if using OIDC
terraform init
terraform plan
terraform apply
```

After apply:

1. Note **`ecr_*` URLs** (BFF, Java API, **ML service**), **`public_alb_dns_name`**, **`ml_service_private_dns_name`**, **`storefront_*` / `admin_*` bucket + CloudFront outputs**, **`github_actions_ecr_role_arn`** (if OIDC enabled).
2. Build and push images (example tags must match `container_image_tag`, default `latest`):

```bash
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com

docker build -t bff:latest -f backend/Dockerfile backend
docker tag bff:latest <ecr_bff_repository_url>:latest
docker push <ecr_bff_repository_url>:latest

docker build -t java-api:latest -f backend-java/Dockerfile backend-java
docker tag java-api:latest <ecr_java_api_repository_url>:latest
docker push <ecr_java_api_repository_url>:latest

docker build -t ml-service:latest -f ml-service/Dockerfile ml-service
docker tag ml-service:latest <ecr_ml_service_repository_url>:latest
docker push <ecr_ml_service_repository_url>:latest
```

3. Run **Prisma migrations** against RDS (bastion/VPN, ECS one-shot task, or CI) — do not rely on uncontrolled manual DDL in production.

4. Bump **`bff_desired_count`**, **`java_desired_count`**, and **`ml_desired_count`** in `terraform.tfvars` and run **`terraform apply`** again (Java + ML services should run before BFF; Terraform `depends_on` enforces order).

### GitHub Actions (optional push to ECR)

1. In `terraform.tfvars`: `enable_github_oidc = true`, plus **`github_organization`** and **`github_repository`** (short repo name, no org prefix).

2. If apply fails because an OIDC provider for `token.actions.githubusercontent.com` already exists in the account, **import** it:

   ```bash
   terraform import 'aws_iam_openid_connect_provider.github_actions[0]' arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com
   ```

   Or manage OIDC outside Terraform and only attach ECR policies — keep `enable_github_oidc = false` and wire CI manually.

3. Copy **`github_actions_ecr_role_arn`** → GitHub repo secret **`AWS_ROLE_TO_ASSUME`**.

4. Set repo secrets **`ECR_BFF_REPOSITORY`**, **`ECR_JAVA_API_REPOSITORY`**, and **`ECR_ML_SERVICE_REPOSITORY`** to the **repository URLs without tags** (same as `terraform output` URLs).

5. Set repo variable **`ENABLE_DOCKER_ECR_PUSH`** = `true` for pushes from `main` (see `.github/workflows/docker-images-ci.yml`).

### Static sites → S3 + CloudFront (Phase 4)

1. Keep **`enable_static_hosting = true`** (default) or set `false` to omit buckets/distributions entirely.

2. Optional **custom domains**: set **`storefront_cloudfront_aliases`** / **`admin_cloudfront_aliases`** and **`cloudfront_acm_certificate_arn_us_east_1`** (ACM **must be in us-east-1** for CloudFront). SANs on one cert can cover both behaviors.

3. To let GitHub Actions upload builds: **`enable_github_oidc = true`**, **`enable_github_static_deploy = true`**, apply Terraform, then set repo variable **`ENABLE_STATIC_S3_DEPLOY`** = `true` and secrets **`S3_BUCKET_STOREFRONT`**, **`S3_BUCKET_ADMIN`**, **`CLOUDFRONT_STOREFRONT_ID`**, **`CLOUDFRONT_ADMIN_ID`** from `terraform output` (same **`AWS_ROLE_TO_ASSUME`** as ECR).

4. Workflow: `.github/workflows/deploy-static-s3.yml` — wire **`NEXT_PUBLIC_*` / `VITE_*`** at build time to **`public_alb_dns_name`** or your future API hostname (Phase 5).

### Remote state

Enable S3 backend in `versions.tf` once the state bucket and DynamoDB lock table exist.

### Cost note

NAT gateways, RDS, Redis, and CloudFront incur ongoing charges even at small sizes. Use `bff_desired_count = 0` / `java_desired_count = 0` when idle; set **`enable_static_hosting = false`** if you are not using static hosting yet.
