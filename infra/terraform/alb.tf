resource "aws_lb" "public" {
  name               = substr("${local.name_prefix}-alb", 0, 32)
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = local.network_public_subnet_ids

  tags = { Name = "${local.name_prefix}-public-alb" }
}

resource "aws_lb_target_group" "bff" {
  name        = substr("${local.name_prefix}-bff-tg", 0, 32)
  port        = local.bff_container_port
  protocol    = "HTTP"
  vpc_id      = local.network_vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/api/health"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = { Name = "${local.name_prefix}-bff-tg" }
}

# Browser-facing SockJS/STOMP hits the ALB on `/ws` and is forwarded to Spring Boot (private otherwise).
resource "aws_lb_target_group" "java_api" {
  name        = substr("${local.name_prefix}-java-tg", 0, 32)
  port        = local.java_container_port
  protocol    = "HTTP"
  vpc_id      = local.network_vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/actuator/health"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = { Name = "${local.name_prefix}-java-tg" }
}

resource "aws_lb_listener" "http_forward" {
  count             = var.enable_alb_https ? 0 : 1
  load_balancer_arn = aws_lb.public.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.bff.arn
  }
}

resource "aws_lb_listener" "http_redirect_https" {
  count             = var.enable_alb_https ? 1 : 0
  load_balancer_arn = aws_lb.public.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  count             = var.enable_alb_https ? 1 : 0
  load_balancer_arn = aws_lb.public.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.alb_acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.bff.arn
  }
}

resource "aws_lb_listener_rule" "https_java_ws" {
  count        = var.enable_alb_https ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.java_api.arn
  }

  condition {
    path_pattern {
      values = ["/ws", "/ws/*"]
    }
  }
}
