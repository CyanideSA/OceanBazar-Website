output "aws_account_id" {
  value = data.aws_caller_identity.current.account_id
}

output "aws_region" {
  value = data.aws_region.current.region
}

output "vpc_id" {
  value = local.network_vpc_id
}

output "private_subnet_ids" {
  description = "Subnets used for ECS, RDS, Redis."
  value       = local.network_private_subnet_ids
}

output "public_subnet_ids" {
  description = "Subnets used for the public ALB."
  value       = local.network_public_subnet_ids
}

output "public_alb_dns_name" {
  description = "Public BFF endpoint (HTTP :80; optional HTTPS :443 when enable_alb_https)."
  value       = aws_lb.public.dns_name
}

output "ecr_bff_repository_url" {
  value = aws_ecr_repository.bff.repository_url
}

output "ecr_java_api_repository_url" {
  value = aws_ecr_repository.java_api.repository_url
}

output "ecr_ml_service_repository_url" {
  value = aws_ecr_repository.ml_service.repository_url
}

output "ml_service_private_dns_name" {
  description = "Internal hostname used by BFF (ML_SERVICE_URL)."
  value       = local.ml_discovery_hostname
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_cluster_arn" {
  value = aws_ecs_cluster.main.arn
}

output "java_private_dns_name" {
  description = "Internal hostname used by BFF (JAVA_API_URL)."
  value       = local.java_discovery_hostname
}

output "db_endpoint" {
  description = "RDS endpoint (private)."
  value       = aws_db_instance.main.address
  sensitive   = true
}

output "redis_primary_endpoint" {
  description = "Redis primary endpoint (private)."
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive   = true
}

output "app_runtime_secret_arn" {
  description = "Secrets Manager JSON consumed by ECS tasks (DB URLs + JWT keys)."
  value       = aws_secretsmanager_secret.app_runtime.arn
  sensitive   = false
}

output "github_actions_ecr_role_arn" {
  description = "GitHub secret AWS_ROLE_TO_ASSUME when OIDC is enabled (ECR + optional S3/CloudFront via enable_github_static_deploy)."
  value       = var.enable_github_oidc ? aws_iam_role.github_actions_ecr[0].arn : null
}

output "storefront_bucket_name" {
  description = "S3 bucket for `frontend/out/` (npm run build:s3)."
  value       = var.enable_static_hosting ? aws_s3_bucket.storefront[0].id : null
}

output "admin_bucket_name" {
  description = "S3 bucket for `admin-frontend-react/dist/`."
  value       = var.enable_static_hosting ? aws_s3_bucket.admin[0].id : null
}

output "storefront_cloudfront_domain_name" {
  description = "CloudFront domain (*.cloudfront.net) or custom if aliases set."
  value       = var.enable_static_hosting ? aws_cloudfront_distribution.storefront[0].domain_name : null
}

output "admin_cloudfront_domain_name" {
  description = "CloudFront domain for admin SPA."
  value       = var.enable_static_hosting ? aws_cloudfront_distribution.admin[0].domain_name : null
}

output "storefront_cloudfront_distribution_id" {
  description = "GitHub secret CLOUDFRONT_STOREFRONT_ID for invalidation workflow."
  value       = var.enable_static_hosting ? aws_cloudfront_distribution.storefront[0].id : null
}

output "admin_cloudfront_distribution_id" {
  description = "GitHub secret CLOUDFRONT_ADMIN_ID for invalidation workflow."
  value       = var.enable_static_hosting ? aws_cloudfront_distribution.admin[0].id : null
}

output "content_id_bucket_name" {
  description = "S3 bucket for `content-id-frontend/dist/`."
  value       = var.enable_static_hosting ? aws_s3_bucket.content_id[0].id : null
}

output "content_id_cloudfront_domain_name" {
  description = "CloudFront domain for content-id SPA."
  value       = var.enable_static_hosting ? aws_cloudfront_distribution.content_id[0].domain_name : null
}

output "content_id_cloudfront_distribution_id" {
  description = "CloudFront distribution ID for content-id invalidation."
  value       = var.enable_static_hosting ? aws_cloudfront_distribution.content_id[0].id : null
}

output "content_id_acm_certificate_arn" {
  description = "ACM cert ARN (us-east-1) for contentid subdomain when auto-provisioned."
  value       = length(aws_acm_certificate.content_id) > 0 ? aws_acm_certificate.content_id[0].arn : null
}
