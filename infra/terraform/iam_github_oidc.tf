resource "aws_iam_openid_connect_provider" "github_actions" {
  count = var.enable_github_oidc ? 1 : 0

  url = "https://token.actions.githubusercontent.com"

  client_id_list = ["sts.amazonaws.com"]

  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
  ]
}

data "aws_iam_policy_document" "github_actions_assume" {
  count = var.enable_github_oidc ? 1 : 0

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github_actions[0].arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_organization}/${var.github_repository}:*"]
    }
  }
}

data "aws_iam_policy_document" "github_ecr_push_pull" {
  statement {
    sid    = "EcrGetAuthorizationToken"
    effect = "Allow"
    actions = [
      "ecr:GetAuthorizationToken",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "EcrPushPullTaggedRepos"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:PutImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
    ]
    resources = [
      aws_ecr_repository.bff.arn,
      aws_ecr_repository.java_api.arn,
      aws_ecr_repository.ml_service.arn,
    ]
  }
}

resource "aws_iam_role" "github_actions_ecr" {
  count = var.enable_github_oidc ? 1 : 0

  name               = substr("${local.name_prefix}-gha-ecr", 0, 64)
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume[0].json

  tags = { Name = "${local.name_prefix}-github-actions-ecr" }
}

resource "aws_iam_role_policy" "github_actions_ecr" {
  count = var.enable_github_oidc ? 1 : 0

  name   = "${local.name_prefix}-gha-ecr-inline"
  role   = aws_iam_role.github_actions_ecr[0].id
  policy = data.aws_iam_policy_document.github_ecr_push_pull.json
}

data "aws_iam_policy_document" "github_static_deploy" {
  count = var.enable_github_oidc && var.enable_github_static_deploy && var.enable_static_hosting ? 1 : 0

  statement {
    sid    = "ListStaticBuckets"
    effect = "Allow"
    actions = [
      "s3:ListBucket",
    ]
    resources = [
      aws_s3_bucket.storefront[0].arn,
      aws_s3_bucket.admin[0].arn,
      aws_s3_bucket.content_id[0].arn,
    ]
  }

  statement {
    sid    = "StaticObjectRw"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]
    resources = [
      "${aws_s3_bucket.storefront[0].arn}/*",
      "${aws_s3_bucket.admin[0].arn}/*",
      "${aws_s3_bucket.content_id[0].arn}/*",
    ]
  }

  statement {
    sid    = "InvalidateDistributions"
    effect = "Allow"
    actions = [
      "cloudfront:CreateInvalidation",
    ]
    resources = [
      aws_cloudfront_distribution.storefront[0].arn,
      aws_cloudfront_distribution.admin[0].arn,
      aws_cloudfront_distribution.content_id[0].arn,
    ]
  }
}

resource "aws_iam_role_policy" "github_actions_static" {
  count = var.enable_github_oidc && var.enable_github_static_deploy && var.enable_static_hosting ? 1 : 0

  name   = "${local.name_prefix}-gha-static-inline"
  role   = aws_iam_role.github_actions_ecr[0].id
  policy = data.aws_iam_policy_document.github_static_deploy[0].json
}
