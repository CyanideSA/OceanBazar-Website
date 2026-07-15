# Content ID tool: `content-id-frontend/dist/` on S3 + CloudFront.
# Optional /api/* behavior proxies to the public ALB so the SPA can use same-origin API calls.

resource "aws_s3_bucket" "content_id" {
  count  = var.enable_static_hosting ? 1 : 0
  bucket = "${local.name_prefix}-content-id-${data.aws_caller_identity.current.account_id}"

  tags = { Name = "${local.name_prefix}-content-id-static" }
}

resource "aws_s3_bucket_public_access_block" "content_id" {
  count = var.enable_static_hosting ? 1 : 0

  bucket = aws_s3_bucket.content_id[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "content_id" {
  count  = var.enable_static_hosting ? 1 : 0
  bucket = aws_s3_bucket.content_id[0].id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }

  depends_on = [aws_s3_bucket_public_access_block.content_id]
}

resource "aws_cloudfront_origin_access_control" "content_id" {
  count                             = var.enable_static_hosting ? 1 : 0
  name                              = "${local.name_prefix}-content-id-oac"
  description                       = "OAC for content-id bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_distribution" "content_id" {
  count       = var.enable_static_hosting ? 1 : 0
  enabled     = true
  comment     = "${local.name_prefix} content-id"
  price_class = var.cloudfront_price_class

  aliases = var.content_id_cloudfront_aliases

  origin {
    domain_name              = aws_s3_bucket.content_id[0].bucket_regional_domain_name
    origin_id                = "s3-content-id"
    origin_access_control_id = aws_cloudfront_origin_access_control.content_id[0].id
  }

  dynamic "origin" {
    for_each = var.content_id_proxy_api_to_alb ? [1] : []
    content {
      # Use api.* when Route53 is managed so CloudFront HTTPS matches the ALB ACM cert.
      domain_name = var.enable_route53_api && var.route53_zone_id != "" ? "api.oceanbazar.com.bd" : aws_lb.public.dns_name
      origin_id   = "alb-bff"

      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = var.enable_alb_https ? "https-only" : "http-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  default_cache_behavior {
    allowed_methods        = ["HEAD", "DELETE", "POST", "GET", "OPTIONS", "PUT", "PATCH"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-content-id"
    viewer_protocol_policy = length(var.content_id_cloudfront_aliases) > 0 ? "redirect-to-https" : "allow-all"

    compress        = true
    cache_policy_id = data.aws_cloudfront_cache_policy.caching_optimized.id

    grpc_config {
      enabled = false
    }
  }

  dynamic "ordered_cache_behavior" {
    for_each = var.content_id_proxy_api_to_alb ? [1] : []
    content {
      path_pattern           = "/api/*"
      allowed_methods        = ["HEAD", "DELETE", "POST", "GET", "OPTIONS", "PUT", "PATCH"]
      cached_methods         = ["GET", "HEAD"]
      target_origin_id       = "alb-bff"
      viewer_protocol_policy = length(var.content_id_cloudfront_aliases) > 0 ? "redirect-to-https" : "allow-all"
      compress               = true
      cache_policy_id        = data.aws_cloudfront_cache_policy.caching_disabled.id
      origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id

      grpc_config {
        enabled = false
      }
    }
  }

  default_root_object = "index.html"

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = length(var.content_id_cloudfront_aliases) == 0
    acm_certificate_arn = length(var.content_id_cloudfront_aliases) > 0 ? (
      var.content_id_acm_certificate_arn_us_east_1 != "" ? var.content_id_acm_certificate_arn_us_east_1 : (
        length(aws_acm_certificate_validation.content_id) > 0 ? aws_acm_certificate_validation.content_id[0].certificate_arn : var.cloudfront_acm_certificate_arn_us_east_1
      )
    ) : null
    ssl_support_method       = length(var.content_id_cloudfront_aliases) > 0 ? "sni-only" : null
    minimum_protocol_version = length(var.content_id_cloudfront_aliases) > 0 ? "TLSv1.2_2021" : null
  }

  depends_on = [
    aws_s3_bucket_ownership_controls.content_id,
    aws_acm_certificate_validation.content_id,
  ]

  tags = { Name = "${local.name_prefix}-cf-content-id" }

  lifecycle {
    ignore_changes = [web_acl_id, price_class, is_ipv6_enabled]
  }
}

resource "aws_s3_bucket_policy" "content_id" {
  count  = var.enable_static_hosting ? 1 : 0
  bucket = aws_s3_bucket.content_id[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "AllowCloudFrontRead"
      Effect = "Allow"
      Principal = {
        Service = "cloudfront.amazonaws.com"
      }
      Action   = "s3:GetObject"
      Resource = "${aws_s3_bucket.content_id[0].arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.content_id[0].arn
        }
      }
    }]
  })

  depends_on = [
    aws_s3_bucket_ownership_controls.content_id,
    aws_cloudfront_distribution.content_id,
  ]
}

resource "aws_acm_certificate" "content_id" {
  count = var.enable_static_hosting && var.enable_route53_content_id && length(var.content_id_cloudfront_aliases) > 0 && var.route53_zone_id != "" ? 1 : 0

  provider          = aws.us_east_1
  domain_name       = var.content_id_cloudfront_aliases[0]
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "${local.name_prefix}-content-id-cert" }
}

resource "aws_route53_record" "content_id_cert_validation" {
  for_each = var.enable_static_hosting && var.enable_route53_content_id && var.route53_zone_id != "" ? {
    for dvo in aws_acm_certificate.content_id[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  zone_id         = var.route53_zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "content_id" {
  count = length(aws_acm_certificate.content_id) > 0 ? 1 : 0

  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.content_id[0].arn
  validation_record_fqdns = [for record in aws_route53_record.content_id_cert_validation : record.fqdn]
}

resource "aws_route53_record" "content_id" {
  count = var.enable_static_hosting && var.enable_route53_content_id && var.route53_zone_id != "" ? 1 : 0

  zone_id = var.route53_zone_id
  name    = var.content_id_cloudfront_aliases[0]
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.content_id[0].domain_name
    zone_id                = aws_cloudfront_distribution.content_id[0].hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "content_id_aaaa" {
  count = var.enable_static_hosting && var.enable_route53_content_id && var.route53_zone_id != "" ? 1 : 0

  zone_id = var.route53_zone_id
  name    = var.content_id_cloudfront_aliases[0]
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.content_id[0].domain_name
    zone_id                = aws_cloudfront_distribution.content_id[0].hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "api" {
  count = var.enable_route53_api && var.route53_zone_id != "" ? 1 : 0

  zone_id = var.route53_zone_id
  name    = "api.oceanbazar.com.bd"
  type    = "A"

  alias {
    name                   = aws_lb.public.dns_name
    zone_id                = aws_lb.public.zone_id
    evaluate_target_health = true
  }
}
