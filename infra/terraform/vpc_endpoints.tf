resource "aws_security_group" "vpc_endpoints" {
  count       = var.use_existing_vpc ? 1 : 0
  name        = "${local.name_prefix}-vpc-endpoints-sg"
  description = "VPC interface endpoint ingress from ECS tasks"
  vpc_id      = local.network_vpc_id

  ingress {
    description     = "HTTPS from ECS tasks"
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name_prefix}-vpc-endpoints-sg" }
}

locals {
  interface_endpoint_services = var.use_existing_vpc ? {
    secretsmanager = "com.amazonaws.${var.aws_region}.secretsmanager"
    kms            = "com.amazonaws.${var.aws_region}.kms"
    ecr_api        = "com.amazonaws.${var.aws_region}.ecr.api"
    ecr_dkr        = "com.amazonaws.${var.aws_region}.ecr.dkr"
    logs           = "com.amazonaws.${var.aws_region}.logs"
  } : {}
}

resource "aws_vpc_endpoint" "interface" {
  for_each = local.interface_endpoint_services

  vpc_id             = local.network_vpc_id
  service_name       = each.value
  vpc_endpoint_type  = "Interface"
  private_dns_enabled = true

  # ECS tasks run in private subnets; endpoints must exist there.
  subnet_ids = var.use_existing_vpc ? var.existing_private_subnet_ids : []

  # Allow inbound HTTPS from ECS tasks security group.
  security_group_ids = [aws_security_group.vpc_endpoints[0].id]

  tags = { Name = "${local.name_prefix}-vpce-${each.key}" }
}

