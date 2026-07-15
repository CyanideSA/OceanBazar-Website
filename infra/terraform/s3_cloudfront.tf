# Storefront: `frontend/out/` (npm run build:s3). Admin: `admin-frontend-react/dist/` (npm run build).

resource "aws_s3_bucket" "storefront" {
  count  = var.enable_static_hosting ? 1 : 0
  bucket = "${local.name_prefix}-storefront-${data.aws_caller_identity.current.account_id}"
  force_destroy = true

  tags = { Name = "${local.name_prefix}-storefront-static" }
}

resource "aws_s3_bucket" "admin" {
  count  = var.enable_static_hosting ? 1 : 0
  bucket = "${local.name_prefix}-admin-${data.aws_caller_identity.current.account_id}"
  force_destroy = true

  tags = { Name = "${local.name_prefix}-admin-static" }
}

resource "aws_s3_bucket_public_access_block" "storefront" {
  count = var.enable_static_hosting ? 1 : 0

  bucket = aws_s3_bucket.storefront[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "admin" {
  count = var.enable_static_hosting ? 1 : 0

  bucket = aws_s3_bucket.admin[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "storefront" {
  count  = var.enable_static_hosting ? 1 : 0
  bucket = aws_s3_bucket.storefront[0].id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }

  depends_on = [aws_s3_bucket_public_access_block.storefront]
}

resource "aws_s3_bucket_ownership_controls" "admin" {
  count  = var.enable_static_hosting ? 1 : 0
  bucket = aws_s3_bucket.admin[0].id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }

  depends_on = [aws_s3_bucket_public_access_block.admin]
}

resource "aws_cloudfront_origin_access_control" "storefront" {
  count                             = var.enable_static_hosting ? 1 : 0
  name                              = "${local.name_prefix}-storefront-oac"
  description                       = "OAC for storefront bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_origin_access_control" "admin" {
  count                             = var.enable_static_hosting ? 1 : 0
  name                              = "${local.name_prefix}-admin-oac"
  description                       = "OAC for admin bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "storefront" {
  count       = var.enable_static_hosting ? 1 : 0
  enabled     = true
  comment     = "${local.name_prefix} storefront"
  price_class = var.cloudfront_price_class

  aliases = var.storefront_cloudfront_aliases

  origin {
    domain_name              = aws_s3_bucket.storefront[0].bucket_regional_domain_name
    origin_id                = "s3-storefront"
    origin_access_control_id = aws_cloudfront_origin_access_control.storefront[0].id
  }

  default_cache_behavior {
    # CloudFront only allows discrete AllowedMethods presets; including POST requires the full
    # non-GET-only set: HEAD, DELETE, POST, GET, OPTIONS, PUT, PATCH (see UpdateDistribution API).
    allowed_methods        = ["HEAD", "DELETE", "POST", "GET", "OPTIONS", "PUT", "PATCH"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-storefront"
    viewer_protocol_policy = length(var.storefront_cloudfront_aliases) > 0 ? "redirect-to-https" : "allow-all"

    compress        = true
    cache_policy_id = data.aws_cloudfront_cache_policy.caching_optimized.id

    grpc_config {
      enabled = false
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
    cloudfront_default_certificate = length(var.storefront_cloudfront_aliases) == 0
    acm_certificate_arn            = length(var.storefront_cloudfront_aliases) > 0 ? var.cloudfront_acm_certificate_arn_us_east_1 : null
    ssl_support_method             = length(var.storefront_cloudfront_aliases) > 0 ? "sni-only" : null
    minimum_protocol_version       = length(var.storefront_cloudfront_aliases) > 0 ? "TLSv1.2_2021" : null
  }

  depends_on = [
    aws_s3_bucket_ownership_controls.storefront,
  ]

  tags = { Name = "${local.name_prefix}-cf-storefront" }

  lifecycle {
    # Imported / legacy distributions on CloudFront Free pricing reject in-place updates
    # that set price_class or toggle IPv6; keep AWS-side values and manage the rest in TF.
    ignore_changes = [web_acl_id, price_class, is_ipv6_enabled]
  }
}

resource "aws_cloudfront_distribution" "admin" {
  count       = var.enable_static_hosting ? 1 : 0
  enabled     = true
  comment     = "${local.name_prefix} admin"
  price_class = var.cloudfront_price_class

  aliases = var.admin_cloudfront_aliases

  origin {
    domain_name              = aws_s3_bucket.admin[0].bucket_regional_domain_name
    origin_id                = "s3-admin"
    origin_access_control_id = aws_cloudfront_origin_access_control.admin[0].id
  }

  default_cache_behavior {
    allowed_methods        = ["HEAD", "DELETE", "POST", "GET", "OPTIONS", "PUT", "PATCH"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-admin"
    viewer_protocol_policy = length(var.admin_cloudfront_aliases) > 0 ? "redirect-to-https" : "allow-all"

    compress        = true
    cache_policy_id = data.aws_cloudfront_cache_policy.caching_optimized.id

    grpc_config {
      enabled = false
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
    cloudfront_default_certificate = length(var.admin_cloudfront_aliases) == 0
    acm_certificate_arn            = length(var.admin_cloudfront_aliases) > 0 ? var.cloudfront_acm_certificate_arn_us_east_1 : null
    ssl_support_method             = length(var.admin_cloudfront_aliases) > 0 ? "sni-only" : null
    minimum_protocol_version       = length(var.admin_cloudfront_aliases) > 0 ? "TLSv1.2_2021" : null
  }

  depends_on = [
    aws_s3_bucket_ownership_controls.admin,
  ]

  tags = { Name = "${local.name_prefix}-cf-admin" }

  lifecycle {
    ignore_changes = [web_acl_id, price_class, is_ipv6_enabled]
  }
}

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

resource "aws_s3_bucket_policy" "storefront" {
  count  = var.enable_static_hosting ? 1 : 0
  bucket = aws_s3_bucket.storefront[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "AllowCloudFrontRead"
      Effect = "Allow"
      Principal = {
        Service = "cloudfront.amazonaws.com"
      }
      Action   = "s3:GetObject"
      Resource = "${aws_s3_bucket.storefront[0].arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.storefront[0].arn
        }
      }
    }]
  })

  depends_on = [
    aws_s3_bucket_ownership_controls.storefront,
    aws_cloudfront_distribution.storefront,
  ]
}

resource "aws_s3_bucket_policy" "admin" {
  count  = var.enable_static_hosting ? 1 : 0
  bucket = aws_s3_bucket.admin[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "AllowCloudFrontRead"
      Effect = "Allow"
      Principal = {
        Service = "cloudfront.amazonaws.com"
      }
      Action   = "s3:GetObject"
      Resource = "${aws_s3_bucket.admin[0].arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.admin[0].arn
        }
      }
    }]
  })

  depends_on = [
    aws_s3_bucket_ownership_controls.admin,
    aws_cloudfront_distribution.admin,
  ]
}
