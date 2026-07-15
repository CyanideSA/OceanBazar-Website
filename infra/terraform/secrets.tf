resource "aws_secretsmanager_secret" "app_runtime" {
  name                    = "${local.name_prefix}/app-runtime"
  recovery_window_in_days = var.environment == "prod" ? 30 : 0

  tags = { Name = "${local.name_prefix}-app-runtime" }
}

resource "aws_secretsmanager_secret_version" "app_runtime" {
  secret_id = aws_secretsmanager_secret.app_runtime.id
  secret_string = jsonencode({
    prisma_database_url = "postgresql://${var.db_username}:${random_password.db_master.result}@${aws_db_instance.main.address}:${aws_db_instance.main.port}/${var.db_name}?schema=public"
    jdbc_database_url   = "jdbc:postgresql://${aws_db_instance.main.address}:${aws_db_instance.main.port}/${var.db_name}"
    db_username         = var.db_username
    db_password         = random_password.db_master.result
    jwt_access_secret   = random_password.jwt_access.result
    jwt_refresh_secret  = random_password.jwt_refresh.result
    jwt_secret_key      = random_password.jwt_java.result

    # Enterprise intelligence layer
    ml_service_api_key = random_password.ml_service_api_key.result
    openai_api_key     = var.openai_api_key
    ms_tenant_id         = var.ms_tenant_id
    ms_client_id         = var.ms_client_id
    ms_client_secret     = var.ms_client_secret
    ms_sso_client_id     = var.ms_sso_client_id
    ms_sso_client_secret = var.ms_sso_client_secret
  })
}
