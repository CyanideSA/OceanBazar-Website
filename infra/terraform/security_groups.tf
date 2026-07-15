resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "Public ALB - HTTP/HTTPS from allowed CIDR (443 only when enable_alb_https)"
  vpc_id      = local.network_vpc_id

  dynamic "ingress" {
    for_each = toset(concat([80], var.enable_alb_https ? [443] : []))
    content {
      description = ingress.value == 443 ? "HTTPS" : "HTTP"
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = [var.alb_allowed_cidr_ipv4]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name_prefix}-alb-sg" }
}

resource "aws_security_group" "ecs_tasks" {
  name        = "${local.name_prefix}-ecs-tasks-sg"
  description = "Fargate tasks (BFF + Java)"
  vpc_id      = local.network_vpc_id

  ingress {
    description     = "BFF from ALB"
    from_port       = local.bff_container_port
    to_port         = local.bff_container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  dynamic "ingress" {
    for_each = var.enable_alb_https ? [1] : []
    content {
      description     = "Java API from ALB (SockJS /ws)"
      from_port       = local.java_container_port
      to_port         = local.java_container_port
      protocol        = "tcp"
      security_groups = [aws_security_group.alb.id]
    }
  }

  ingress {
    description = "Java API from peer ECS tasks (BFF)"
    from_port   = local.java_container_port
    to_port     = local.java_container_port
    protocol    = "tcp"
    self        = true
  }

  ingress {
    description = "ML service from peer ECS tasks (BFF)"
    from_port   = local.ml_container_port
    to_port     = local.ml_container_port
    protocol    = "tcp"
    self        = true
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name_prefix}-ecs-tasks-sg" }
}

resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds-sg"
  description = "PostgreSQL from ECS tasks only"
  vpc_id      = local.network_vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name_prefix}-rds-sg" }
}

resource "aws_security_group" "redis" {
  name        = "${local.name_prefix}-redis-sg"
  description = "Redis from ECS tasks only"
  vpc_id      = local.network_vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name_prefix}-redis-sg" }
}
