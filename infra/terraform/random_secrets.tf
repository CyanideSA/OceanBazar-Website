resource "random_password" "jwt_access" {
  length  = 48
  special = false
}

resource "random_password" "jwt_refresh" {
  length  = 48
  special = false
}

resource "random_password" "jwt_java" {
  length  = 48
  special = false
}

resource "random_password" "ml_service_api_key" {
  length  = 48
  special = false
}
