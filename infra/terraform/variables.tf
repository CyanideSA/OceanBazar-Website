variable "aws_region" {
  type        = string
  description = "AWS region (e.g. ap-southeast-1)."
  default     = "ap-southeast-1"
}

variable "project_name" {
  type        = string
  description = "Short name for resource prefixes."
  default     = "oceanbazar"
}

variable "environment" {
  type        = string
  description = "Environment slug (e.g. staging, prod)."
  default     = "staging"
}

# ─── Network ────────────────────────────────────────────────────────────────
variable "use_existing_vpc" {
  type        = bool
  description = "If true, use existing_vpc_id and subnet lists; skip creating the terraform-aws-modules/vpc module."
  default     = false
}

variable "existing_vpc_id" {
  type        = string
  description = "Required when use_existing_vpc = true. VPC where ALB, ECS, RDS, Redis, and new security groups live."
  default     = ""
}

variable "existing_private_subnet_ids" {
  type        = list(string)
  description = "Private subnets for ECS tasks, RDS subnet group, ElastiCache subnet group (≥2 AZs recommended)."
  default     = []
}

variable "existing_public_subnet_ids" {
  type        = list(string)
  description = "Public subnets for the internet-facing ALB (AWS requires ≥2 subnets in different AZs)."
  default     = []
}

variable "create_existing_vpc_nat" {
  type        = bool
  description = "When use_existing_vpc=true, provision NAT in the first public subnet and route private subnets for outbound internet (Microsoft OAuth, etc.)."
  default     = true
}

variable "vpc_cidr" {
  type        = string
  description = "VPC IPv4 CIDR (only used when use_existing_vpc = false)."
  default     = "10.20.0.0/16"
}

variable "az_count" {
  type        = number
  description = "Number of AZs to span (max available in region)."
  default     = 2
}

variable "enable_nat_gateway" {
  type        = bool
  description = "NAT for private subnet egress (required for Fargate pulls unless using public subnets)."
  default     = true
}

variable "single_nat_gateway" {
  type        = bool
  description = "Use one NAT gateway (cheaper staging; less HA)."
  default     = true
}

variable "alb_allowed_cidr_ipv4" {
  type        = string
  description = "CIDR allowed to reach the public ALB on HTTP."
  default     = "0.0.0.0/0"
}

# ─── RDS ─────────────────────────────────────────────────────────────────────
variable "db_name" {
  type        = string
  description = "PostgreSQL database name."
  default     = "oceanbazar"
}

variable "db_username" {
  type        = string
  description = "PostgreSQL master username."
  default     = "oceanbazar"
}

variable "db_instance_class" {
  type        = string
  description = "RDS instance class."
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  type        = number
  description = "RDS allocated storage (GiB)."
  default     = 20
}

variable "db_engine_version" {
  type        = string
  description = "PostgreSQL engine version."
  default     = "16.4"
}

variable "db_multi_az" {
  type        = bool
  description = "RDS Multi-AZ."
  default     = false
}

variable "db_backup_retention_days" {
  type        = number
  description = "Automated backup retention (days). Use >= 7 for production."
  default     = 7
}

variable "db_deletion_protection" {
  type    = bool
  default = false
}

variable "db_skip_final_snapshot" {
  type        = bool
  description = "If true, no final snapshot on destroy (staging only). Must be false when environment=prod (enforced by check)."
  default     = true
}

variable "db_storage_encrypted" {
  type        = bool
  description = "Encrypt RDS storage at rest (recommended always; required for compliance)."
  default     = true
}

# ─── Redis ────────────────────────────────────────────────────────────────────
variable "redis_node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "redis_engine_version" {
  type        = string
  description = "Redis engine version string supported in your region (ElastiCache console). Use e.g. 7.1 if 7.2 is unavailable."
  default     = "7.1"
}

variable "redis_snapshot_retention_days" {
  type    = number
  default = 1
}

# ─── ECS images ───────────────────────────────────────────────────────────────
variable "container_image_tag" {
  type        = string
  description = "Image tag for all ECR repos (BFF, Java API, ML service). Push images before scaling services up."
  default     = "latest"
}

variable "bff_desired_count" {
  type        = number
  description = "Fargate desired tasks for BFF. Use 0 until images exist in ECR."
  default     = 0
}

variable "java_desired_count" {
  type        = number
  description = "Fargate desired tasks for Java API. Use 0 until images exist in ECR."
  default     = 0
}

variable "bff_cpu" {
  type    = number
  default = 512
}

variable "bff_memory" {
  type    = number
  default = 2048
}

variable "java_cpu" {
  type    = number
  default = 512
}

variable "java_memory" {
  type    = number
  default = 2048
}

# ─── ML service (FastAPI) ─────────────────────────────────────────────────────
variable "ml_desired_count" {
  type        = number
  description = "Fargate desired tasks for the Python ML service. Use 0 until an image exists in ECR."
  default     = 0
}

variable "ml_cpu" {
  type    = number
  default = 512
}

variable "ml_memory" {
  type    = number
  default = 1024
}

variable "ml_model_version" {
  type        = string
  description = "Version tag recorded alongside ML predictions."
  default     = "v1"
}

variable "openai_api_key" {
  type        = string
  description = "OpenAI API key for ML content generation. Leave empty to use deterministic heuristic fallbacks."
  default     = ""
  sensitive   = true
}

# ─── Microsoft 365 Graph (transactional + marketing email) ─────────────────────
variable "ms_tenant_id" {
  type        = string
  description = "Azure AD tenant ID for Microsoft 365 Graph email. Leave empty to use SMTP fallback."
  default     = ""
  sensitive   = true
}

variable "ms_client_id" {
  type        = string
  description = "Azure AD app (client) ID for Microsoft 365 Graph."
  default     = ""
  sensitive   = true
}

variable "ms_client_secret" {
  type        = string
  description = "Azure AD client secret for Microsoft 365 Graph."
  default     = ""
  sensitive   = true
}

variable "ms_sender_addresses" {
  type        = string
  description = "Comma-separated allowed Graph sender mailboxes (e.g. admin@,sales@,support@,no-reply@)."
  default     = ""
}

variable "ms_default_sender" {
  type        = string
  description = "Default From address for transactional email via Graph."
  default     = ""
}

variable "bff_trust_proxy" {
  type        = bool
  description = "When true, set TRUST_PROXY=1 on the BFF so Express honors X-Forwarded-* behind the ALB."
  default     = true
}

variable "bff_client_url" {
  type        = string
  description = "Public storefront origin for cookies/CORS (e.g. https://oceanbazar.com.bd). Leave empty to omit."
  default     = ""
}

variable "bff_admin_url" {
  type        = string
  description = "Public admin CRM origin for CORS (e.g. https://admin.oceanbazar.com.bd). Leave empty to omit."
  default     = ""
}

variable "bff_cors_allowed_origins_extra" {
  type        = string
  description = "Comma-separated extra browser origins for BFF CORS (e.g. https://www.oceanbazar.com.bd). Mapped to CORS_ALLOWED_ORIGINS."
  default     = ""
}

variable "bff_background_jobs" {
  type        = bool
  description = "When false, disables analytics/campaign/DLQ/ML recompute crons on BFF (useful when RDS schema is not fully migrated)."
  default     = true
}

# ─── GitHub Actions OIDC (optional) ───────────────────────────────────────────
variable "enable_github_oidc" {
  type        = bool
  description = "Create/update IAM OIDC provider for github.com + deploy role for CI push to ECR. One OIDC provider per AWS account for token.actions.githubusercontent.com."
  default     = false
}

variable "github_organization" {
  type        = string
  description = "GitHub org or username owning the repo."
  default     = ""
}

variable "github_repository" {
  type        = string
  description = "Repository name only (no org)."
  default     = ""
}

variable "enable_github_static_deploy" {
  type        = bool
  description = "Attach S3 sync + CloudFront invalidation policy to the GitHub OIDC role (requires enable_github_oidc)."
  default     = false
}

# ─── ALB TLS (ACM cert must exist in var.aws_region) ───────────────────────────
variable "enable_alb_https" {
  type        = bool
  description = "Terminate HTTPS on the public ALB and redirect HTTP→HTTPS. Set alb_acm_certificate_arn (validated in same region as the ALB)."
  default     = false
}

variable "alb_acm_certificate_arn" {
  type        = string
  description = "ACM certificate ARN for the ALB (regional). Leave empty when enable_alb_https is false."
  default     = ""
}

# ─── Static hosting (S3 + CloudFront OAC) ────────────────────────────────────
variable "enable_static_hosting" {
  type        = bool
  description = "Create S3 buckets + CloudFront distributions for storefront (Next export out/) and admin (Vite dist/)."
  default     = true
}

variable "cloudfront_price_class" {
  type        = string
  description = "CloudFront price class (e.g. PriceClass_100)."
  default     = "PriceClass_100"
}

variable "storefront_cloudfront_aliases" {
  type        = list(string)
  description = "Optional alternate domain names (must match ACM in us-east-1 when non-empty)."
  default     = []
}

variable "admin_cloudfront_aliases" {
  type        = list(string)
  description = "Optional alternate domain names for admin distribution (must match ACM in us-east-1 when non-empty)."
  default     = []
}

variable "content_id_cloudfront_aliases" {
  type        = list(string)
  description = "Optional alternate domain names for content-id distribution (must match content_id_acm_certificate_arn_us_east_1 when non-empty)."
  default     = []
}

variable "content_id_acm_certificate_arn_us_east_1" {
  type        = string
  description = "ACM cert ARN in us-east-1 for content-id CloudFront (can be a cert covering contentid subdomain only)."
  default     = ""
}

variable "content_id_proxy_api_to_alb" {
  type        = bool
  description = "When true, content-id CloudFront forwards /api/* to the public ALB (same-origin API for the SPA)."
  default     = true
}

variable "route53_zone_id" {
  type        = string
  description = "Route53 hosted zone ID for oceanbazar.com.bd (optional). When set with enable_route53_records, creates contentid + api aliases."
  default     = ""
}

variable "enable_route53_content_id" {
  type        = bool
  description = "Create Route53 alias contentid.oceanbazar.com.bd → content-id CloudFront."
  default     = false
}

variable "enable_route53_api" {
  type        = bool
  description = "Create Route53 alias api.oceanbazar.com.bd → public ALB."
  default     = false
}

variable "bff_content_id_app_url" {
  type        = string
  description = "Public content-id tool origin (CONTENT_ID_APP_URL)."
  default     = ""
}

variable "bff_ms_content_id_redirect_uri" {
  type        = string
  description = "Microsoft SSO redirect URI for content-id (MS_CONTENT_ID_REDIRECT_URI)."
  default     = ""
}

variable "bff_admin_sso_allowed_domains" {
  type        = string
  description = "Comma-separated email domains allowed for Microsoft SSO (ADMIN_SSO_ALLOWED_DOMAINS)."
  default     = "oceanbazar.com.bd,oceanbazar.com"
}

variable "ms_sso_client_id" {
  type        = string
  description = "Entra ID app registration client ID for admin/content-id SSO (MS_SSO_CLIENT_ID)."
  default     = ""
  sensitive   = true
}

variable "ms_sso_client_secret" {
  type        = string
  description = "Entra ID client secret for SSO (MS_SSO_CLIENT_SECRET)."
  default     = ""
  sensitive   = true
}

variable "cloudfront_acm_certificate_arn_us_east_1" {
  type        = string
  description = "ACM cert ARN in us-east-1 for custom CloudFront domains (Viewer certificates). Required when any aliases list is non-empty."
  default     = ""
}

# ─── Global maintenance lock ─────────────────────────────────────────────────
variable "maintenance_mode" {
  type        = bool
  description = "When true, BFF + Java API return 503 for public traffic (health probes may bypass if MAINTENANCE_ALLOW_HEALTH_PROBE=true)."
  default     = false
}

variable "maintenance_bypass_token" {
  type        = string
  description = "Secret staff bypass token (store in tfvars / CI secret, not in git)."
  default     = ""
  sensitive   = true
}

variable "maintenance_cookie_domain" {
  type        = string
  description = "Cookie domain for storefront bypass, e.g. .oceanbazar.com.bd"
  default     = ""
}

variable "maintenance_retry_after" {
  type        = string
  description = "Retry-After header value (seconds) for 503 responses."
  default     = "3600"
}
