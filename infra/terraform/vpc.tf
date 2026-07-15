locals {
  vpc_azs = slice(
    data.aws_availability_zones.available.names,
    0,
    min(var.az_count, length(data.aws_availability_zones.available.names))
  )

  network_vpc_id = var.use_existing_vpc ? var.existing_vpc_id : module.vpc[0].vpc_id

  network_private_subnet_ids = var.use_existing_vpc ? var.existing_private_subnet_ids : module.vpc[0].private_subnets

  network_public_subnet_ids = var.use_existing_vpc ? var.existing_public_subnet_ids : module.vpc[0].public_subnets
}

module "vpc" {
  count = var.use_existing_vpc ? 0 : 1

  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.21"

  name = "${local.name_prefix}-vpc"
  cidr = var.vpc_cidr

  azs             = local.vpc_azs
  private_subnets = [for i, az in local.vpc_azs : cidrsubnet(var.vpc_cidr, 8, i + 1)]
  public_subnets  = [for i, az in local.vpc_azs : cidrsubnet(var.vpc_cidr, 8, i + 100)]

  enable_nat_gateway   = var.enable_nat_gateway
  single_nat_gateway   = var.single_nat_gateway
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${local.name_prefix}-vpc"
  }
}
