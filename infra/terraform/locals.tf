locals {
  name_prefix = "${var.project_name}-${var.environment}"

  ecr_lifecycle_keep_last = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 20 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 20
      }
      action = { type = "expire" }
    }]
  })

  bff_container_port  = 4000
  java_container_port = 8000
  ml_container_port   = 8100

  java_discovery_hostname = "java-api.${aws_service_discovery_private_dns_namespace.main.name}"
  ml_discovery_hostname   = "ml-service.${aws_service_discovery_private_dns_namespace.main.name}"
}
