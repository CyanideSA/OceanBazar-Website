resource "aws_cloudwatch_log_group" "ecs_bff" {
  name              = "/ecs/${local.name_prefix}/bff"
  retention_in_days = 30

  tags = { Name = "${local.name_prefix}-ecs-bff-logs" }
}

resource "aws_cloudwatch_log_group" "ecs_java" {
  name              = "/ecs/${local.name_prefix}/java-api"
  retention_in_days = 30

  tags = { Name = "${local.name_prefix}-ecs-java-logs" }
}

resource "aws_cloudwatch_log_group" "ecs_ml" {
  name              = "/ecs/${local.name_prefix}/ml-service"
  retention_in_days = 30

  tags = { Name = "${local.name_prefix}-ecs-ml-logs" }
}
