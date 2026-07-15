# When using an existing VPC, verify subnets span enough AZs for ALB and HA data plane.

data "aws_subnet" "existing_public" {
  for_each = var.use_existing_vpc ? toset(var.existing_public_subnet_ids) : toset([])
  id       = each.value
}

data "aws_subnet" "existing_private" {
  for_each = var.use_existing_vpc ? toset(var.existing_private_subnet_ids) : toset([])
  id       = each.value
}
