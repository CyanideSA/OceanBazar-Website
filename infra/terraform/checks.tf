check "existing_vpc_inputs" {
  assert {
    condition = !var.use_existing_vpc || (
      var.existing_vpc_id != ""
      && length(var.existing_private_subnet_ids) >= 2
      && length(var.existing_public_subnet_ids) >= 2
    )
    error_message = "When use_existing_vpc is true, set existing_vpc_id and at least two private and two public subnet IDs (ALB requires multiple AZs)."
  }
}

check "existing_public_subnets_multi_az" {
  assert {
    condition = !var.use_existing_vpc || length(distinct([
      for s in data.aws_subnet.existing_public : s.availability_zone
    ])) >= 2
    error_message = "Public subnets for the ALB must span at least two different Availability Zones (pick one subnet per AZ)."
  }
}

check "existing_private_subnets_multi_az" {
  assert {
    condition = !var.use_existing_vpc || length(distinct([
      for s in data.aws_subnet.existing_private : s.availability_zone
    ])) >= 2
    error_message = "Private subnets for ECS/RDS/Redis should span at least two different Availability Zones for production resilience."
  }
}

check "github_oidc_repo" {
  assert {
    condition     = !var.enable_github_oidc || (var.github_organization != "" && var.github_repository != "")
    error_message = "When enable_github_oidc is true, set github_organization and github_repository (repository name without org)."
  }
}

check "github_static_deploy_requires_oidc" {
  assert {
    condition     = !var.enable_github_static_deploy || var.enable_github_oidc
    error_message = "enable_github_static_deploy requires enable_github_oidc (same IAM role gets ECR + static policies)."
  }
}

check "github_static_deploy_requires_hosting" {
  assert {
    condition     = !var.enable_github_static_deploy || var.enable_static_hosting
    error_message = "enable_github_static_deploy requires enable_static_hosting (S3/CloudFront resources)."
  }
}

check "alb_https_requires_cert" {
  assert {
    condition     = !var.enable_alb_https || var.alb_acm_certificate_arn != ""
    error_message = "enable_alb_https requires alb_acm_certificate_arn (ACM in the ALB region)."
  }
}

check "cloudfront_custom_domains_require_acm_us_east_1" {
  assert {
    condition = (
      (length(var.storefront_cloudfront_aliases) == 0 && length(var.admin_cloudfront_aliases) == 0)
      || var.cloudfront_acm_certificate_arn_us_east_1 != ""
    )
    error_message = "Custom CloudFront aliases for storefront/admin require cloudfront_acm_certificate_arn_us_east_1 (ACM in us-east-1)."
  }
}

check "content_id_custom_domain_requires_cert" {
  assert {
    condition = (
      length(var.content_id_cloudfront_aliases) == 0
      || var.content_id_acm_certificate_arn_us_east_1 != ""
      || var.cloudfront_acm_certificate_arn_us_east_1 != ""
      || (var.enable_route53_content_id && var.route53_zone_id != "")
    )
    error_message = "content_id_cloudfront_aliases requires content_id_acm_certificate_arn_us_east_1, cloudfront_acm_certificate_arn_us_east_1, or enable_route53_content_id with route53_zone_id for auto ACM."
  }
}

# ─── Production guards (environment must literally be "prod") ───────────────
check "prod_alb_https_required" {
  assert {
    condition     = var.environment != "prod" || (var.enable_alb_https && var.alb_acm_certificate_arn != "")
    error_message = "For environment=prod: enable TLS on the ALB (enable_alb_https=true and alb_acm_certificate_arn set in the ALB region). Public HTTP-only APIs are not accepted for this stack's prod profile."
  }
}

check "prod_rds_hardening" {
  assert {
    condition = var.environment != "prod" || (
      var.db_deletion_protection
      && !var.db_skip_final_snapshot
      && var.db_multi_az
      && var.db_backup_retention_days >= 7
    )
    error_message = "For environment=prod: set db_deletion_protection=true, db_skip_final_snapshot=false, db_multi_az=true, db_backup_retention_days>=7."
  }
}

check "prod_cloudfront_custom_domains" {
  assert {
    condition = var.environment != "prod" || !var.enable_static_hosting || (
      length(var.storefront_cloudfront_aliases) > 0
      && length(var.admin_cloudfront_aliases) > 0
      && var.cloudfront_acm_certificate_arn_us_east_1 != ""
    )
    error_message = "For environment=prod with enable_static_hosting=true: set storefront_cloudfront_aliases, admin_cloudfront_aliases, and cloudfront_acm_certificate_arn_us_east_1 (ACM must be in us-east-1). Or set enable_static_hosting=false for an API-only prod phase."
  }
}
