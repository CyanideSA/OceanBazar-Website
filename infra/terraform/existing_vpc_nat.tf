# When use_existing_vpc=true, private subnets may reference a deleted NAT (blackhole).
# ECS tasks need outbound HTTPS for Microsoft OAuth (login.microsoftonline.com), etc.

data "aws_route_table" "existing_private" {
  for_each  = var.use_existing_vpc && var.create_existing_vpc_nat ? toset(var.existing_private_subnet_ids) : toset([])
  subnet_id = each.value
}

resource "aws_eip" "existing_vpc_nat" {
  count  = var.use_existing_vpc && var.create_existing_vpc_nat ? 1 : 0
  domain = "vpc"

  tags = { Name = "${local.name_prefix}-nat-eip" }
}

resource "aws_nat_gateway" "existing_vpc" {
  count = var.use_existing_vpc && var.create_existing_vpc_nat ? 1 : 0

  allocation_id = aws_eip.existing_vpc_nat[0].id
  subnet_id     = var.existing_public_subnet_ids[0]

  tags = { Name = "${local.name_prefix}-nat" }

  depends_on = [data.aws_subnet.existing_public]
}

resource "aws_route" "existing_private_nat" {
  for_each = var.use_existing_vpc && var.create_existing_vpc_nat ? data.aws_route_table.existing_private : {}

  route_table_id         = each.value.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.existing_vpc[0].id
}
