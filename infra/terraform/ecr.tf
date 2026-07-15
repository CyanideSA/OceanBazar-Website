resource "aws_ecr_repository" "bff" {
  name                 = "${local.name_prefix}-bff"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "java_api" {
  name                 = "${local.name_prefix}-java-api"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "ml_service" {
  name                 = "${local.name_prefix}-ml-service"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "bff" {
  repository = aws_ecr_repository.bff.name
  policy     = local.ecr_lifecycle_keep_last
}

resource "aws_ecr_lifecycle_policy" "java_api" {
  repository = aws_ecr_repository.java_api.name
  policy     = local.ecr_lifecycle_keep_last
}

resource "aws_ecr_lifecycle_policy" "ml_service" {
  repository = aws_ecr_repository.ml_service.name
  policy     = local.ecr_lifecycle_keep_last
}
