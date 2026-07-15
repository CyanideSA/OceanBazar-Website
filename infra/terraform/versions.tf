terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.50"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.6"
    }
  }

  # Uncomment after creating the bucket + DynamoDB table for locks:
  # backend "s3" {
  #   bucket         = "oceanbazar-terraform-state"
  #   key            = "prod/terraform.tfstate"
  #   region         = "ap-southeast-1"
  #   dynamodb_table = "oceanbazar-terraform-locks"
  #   encrypt        = true
  # }
}
