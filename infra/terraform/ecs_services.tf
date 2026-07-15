resource "aws_ecs_service" "java_api" {
  name            = "${local.name_prefix}-java-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.java_api.arn
  desired_count   = var.java_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = local.network_private_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  dynamic "load_balancer" {
    for_each = var.enable_alb_https ? [1] : []
    content {
      target_group_arn = aws_lb_target_group.java_api.arn
      container_name   = "java-api"
      container_port   = local.java_container_port
    }
  }

  service_registries {
    registry_arn = aws_service_discovery_service.java_api.arn
  }

  depends_on = [aws_lb_target_group.java_api]

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200
}

resource "aws_ecs_service" "ml_service" {
  name            = "${local.name_prefix}-ml-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.ml_service.arn
  desired_count   = var.ml_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = local.network_private_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  service_registries {
    registry_arn = aws_service_discovery_service.ml_service.arn
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200
}

resource "aws_ecs_service" "bff" {
  name            = "${local.name_prefix}-bff"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.bff.arn
  desired_count   = var.bff_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = local.network_private_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.bff.arn
    container_name   = "bff"
    container_port   = local.bff_container_port
  }

  depends_on = [
    aws_lb.public,
    aws_lb_target_group.bff,
    aws_ecs_service.java_api,
    aws_ecs_service.ml_service,
  ]

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200
}
