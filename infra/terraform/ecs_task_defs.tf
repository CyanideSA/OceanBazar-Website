resource "aws_ecs_task_definition" "bff" {
  family                   = "${local.name_prefix}-bff"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = tostring(var.bff_cpu)
  memory                   = tostring(var.bff_memory)
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "bff"
    image     = "${aws_ecr_repository.bff.repository_url}:${var.container_image_tag}"
    essential = true
    portMappings = [{
      containerPort = local.bff_container_port
      protocol      = "tcp"
    }]
    environment = concat(
      [
        { name = "NODE_ENV", value = "production" },
        { name = "JAVA_API_URL", value = "http://${local.java_discovery_hostname}:${local.java_container_port}" },
        { name = "ML_SERVICE_URL", value = "http://${local.ml_discovery_hostname}:${local.ml_container_port}" },
        {
          name  = "REDIS_URL"
          value = "redis://${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379"
        },
      ],
      var.bff_trust_proxy ? [{ name = "TRUST_PROXY", value = "1" }] : [],
      var.ms_sender_addresses != "" ? [{ name = "MS_SENDER_ADDRESSES", value = var.ms_sender_addresses }] : [],
      var.ms_default_sender != "" ? [{ name = "MS_DEFAULT_SENDER", value = var.ms_default_sender }] : [],
      var.bff_client_url != "" ? [{ name = "CLIENT_URL", value = var.bff_client_url }] : [],
      var.bff_admin_url != "" ? [{ name = "ADMIN_URL", value = var.bff_admin_url }] : [],
      var.bff_cors_allowed_origins_extra != "" ? [{ name = "CORS_ALLOWED_ORIGINS", value = var.bff_cors_allowed_origins_extra }] : [],
      var.bff_content_id_app_url != "" ? [{ name = "CONTENT_ID_APP_URL", value = var.bff_content_id_app_url }] : [],
      var.bff_ms_content_id_redirect_uri != "" ? [{ name = "MS_CONTENT_ID_REDIRECT_URI", value = var.bff_ms_content_id_redirect_uri }] : [],
      var.bff_admin_sso_allowed_domains != "" ? [{ name = "ADMIN_SSO_ALLOWED_DOMAINS", value = var.bff_admin_sso_allowed_domains }] : [],
      !var.bff_background_jobs ? [{ name = "BFF_BACKGROUND_JOBS", value = "false" }] : [],
      var.maintenance_mode ? [
        { name = "MAINTENANCE_MODE", value = "true" },
        { name = "MAINTENANCE_BYPASS_TOKEN", value = var.maintenance_bypass_token },
        { name = "MAINTENANCE_RETRY_AFTER", value = var.maintenance_retry_after },
        { name = "MAINTENANCE_ALLOW_HEALTH_PROBE", value = "true" },
      ] : [],
      var.maintenance_mode && var.maintenance_cookie_domain != "" ? [
        { name = "MAINTENANCE_COOKIE_DOMAIN", value = var.maintenance_cookie_domain },
      ] : [],
    )
    secrets = [
      {
        name      = "DATABASE_URL"
        valueFrom = "${aws_secretsmanager_secret.app_runtime.arn}:prisma_database_url::"
      },
      {
        name      = "DIRECT_URL"
        valueFrom = "${aws_secretsmanager_secret.app_runtime.arn}:prisma_database_url::"
      },
      {
        name      = "JWT_ACCESS_SECRET"
        valueFrom = "${aws_secretsmanager_secret.app_runtime.arn}:jwt_access_secret::"
      },
      {
        name      = "JWT_REFRESH_SECRET"
        valueFrom = "${aws_secretsmanager_secret.app_runtime.arn}:jwt_refresh_secret::"
      },
      {
        name      = "JWT_SECRET_KEY"
        valueFrom = "${aws_secretsmanager_secret.app_runtime.arn}:jwt_secret_key::"
      },
      {
        name      = "ML_SERVICE_API_KEY"
        valueFrom = "${aws_secretsmanager_secret.app_runtime.arn}:ml_service_api_key::"
      },
      {
        name      = "OPENAI_API_KEY"
        valueFrom = "${aws_secretsmanager_secret.app_runtime.arn}:openai_api_key::"
      },
      {
        name      = "MS_TENANT_ID"
        valueFrom = "${aws_secretsmanager_secret.app_runtime.arn}:ms_tenant_id::"
      },
      {
        name      = "MS_CLIENT_ID"
        valueFrom = "${aws_secretsmanager_secret.app_runtime.arn}:ms_client_id::"
      },
      {
        name      = "MS_CLIENT_SECRET"
        valueFrom = "${aws_secretsmanager_secret.app_runtime.arn}:ms_client_secret::"
      },
      {
        name      = "MS_SSO_CLIENT_ID"
        valueFrom = "${aws_secretsmanager_secret.app_runtime.arn}:ms_sso_client_id::"
      },
      {
        name      = "MS_SSO_CLIENT_SECRET"
        valueFrom = "${aws_secretsmanager_secret.app_runtime.arn}:ms_sso_client_secret::"
      },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.ecs_bff.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "bff"
      }
    }
  }])
}

resource "aws_ecs_task_definition" "java_api" {
  family                   = "${local.name_prefix}-java-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = tostring(var.java_cpu)
  memory                   = tostring(var.java_memory)
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "java-api"
    image     = "${aws_ecr_repository.java_api.repository_url}:${var.container_image_tag}"
    essential = true
    portMappings = [{
      containerPort = local.java_container_port
      protocol      = "tcp"
    }]
    environment = concat(
      [
        { name = "PORT", value = tostring(local.java_container_port) },
        { name = "SERVER_PORT", value = tostring(local.java_container_port) },
        { name = "SERVER_FORWARD_HEADERS_STRATEGY", value = "framework" },
        {
          name  = "REDIS_HOST"
          value = aws_elasticache_replication_group.redis.primary_endpoint_address
        },
        { name = "REDIS_PORT", value = "6379" },
      ],
      var.maintenance_mode ? [
        { name = "MAINTENANCE_MODE", value = "true" },
        { name = "MAINTENANCE_BYPASS_TOKEN", value = var.maintenance_bypass_token },
        { name = "MAINTENANCE_RETRY_AFTER", value = var.maintenance_retry_after },
        { name = "MAINTENANCE_ALLOW_HEALTH_PROBE", value = "true" },
      ] : [],
      var.maintenance_mode && var.maintenance_cookie_domain != "" ? [
        { name = "MAINTENANCE_COOKIE_DOMAIN", value = var.maintenance_cookie_domain },
      ] : [],
    )
    secrets = [
      {
        name      = "DATABASE_URL"
        valueFrom = "${aws_secretsmanager_secret.app_runtime.arn}:jdbc_database_url::"
      },
      {
        name      = "DB_USER"
        valueFrom = "${aws_secretsmanager_secret.app_runtime.arn}:db_username::"
      },
      {
        name      = "DB_PASSWORD"
        valueFrom = "${aws_secretsmanager_secret.app_runtime.arn}:db_password::"
      },
      {
        name      = "JWT_SECRET_KEY"
        valueFrom = "${aws_secretsmanager_secret.app_runtime.arn}:jwt_secret_key::"
      },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.ecs_java.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "java-api"
      }
    }
  }])
}

resource "aws_ecs_task_definition" "ml_service" {
  family                   = "${local.name_prefix}-ml-service"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = tostring(var.ml_cpu)
  memory                   = tostring(var.ml_memory)
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "ml-service"
    image     = "${aws_ecr_repository.ml_service.repository_url}:${var.container_image_tag}"
    essential = true
    portMappings = [{
      containerPort = local.ml_container_port
      protocol      = "tcp"
    }]
    environment = [
      { name = "PORT", value = tostring(local.ml_container_port) },
      { name = "LOG_LEVEL", value = "info" },
      { name = "MODEL_VERSION", value = var.ml_model_version },
      { name = "OPENAI_MODEL", value = "gpt-4o-mini" },
    ]
    secrets = [
      {
        name      = "DATABASE_URL"
        valueFrom = "${aws_secretsmanager_secret.app_runtime.arn}:prisma_database_url::"
      },
      {
        name      = "ML_SERVICE_API_KEY"
        valueFrom = "${aws_secretsmanager_secret.app_runtime.arn}:ml_service_api_key::"
      },
      {
        name      = "OPENAI_API_KEY"
        valueFrom = "${aws_secretsmanager_secret.app_runtime.arn}:openai_api_key::"
      },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.ecs_ml.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ml-service"
      }
    }
  }])
}
