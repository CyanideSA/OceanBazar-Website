<#
.SYNOPSIS
  Build BFF + Java API Docker images, push :latest to staging ECR, then scale ECS via Terraform.

.DESCRIPTION
  Requires Docker Desktop running and AWS CLI credentials for account 537595753814 (or your current profile).
  Run from any directory. Fails fast if Docker engine is not reachable.

.PARAMETER Region
  AWS region (default ap-southeast-1).

.PARAMETER Tag
  Image tag to push (default latest — must match terraform.tfvars container_image_tag).

.PARAMETER SkipTerraformApply
  If set, only build+push; do not run terraform apply.

.PARAMETER CheckOnly
  No Docker — only print ECR image presence, ECS counts, and ALB /api/health (exit 1 if not ready).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File infra/scripts/push-staging-ecs-images.ps1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File infra/scripts/push-staging-ecs-images.ps1 -CheckOnly
#>
[CmdletBinding()]
param(
  [string] $Region = "ap-southeast-1",
  [string] $Tag = "latest",
  [switch] $SkipTerraformApply,
  [switch] $CheckOnly
)

$ErrorActionPreference = "Stop"

if ($CheckOnly) {
  $ErrorActionPreference = "Continue"
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
  $TfDir    = Join-Path $RepoRoot "infra\terraform"
  $ready = $true
  Write-Host "=== Staging ECS readiness ($Region) ===" -ForegroundColor Cyan
  foreach ($repo in @("oceanbazar-staging-bff", "oceanbazar-staging-java-api")) {
    $null = aws ecr describe-images --repository-name $repo --region $Region --image-ids "imageTag=$Tag" --query "imageDetails[0].imagePushedAt" --output text 2>$null
    if ($LASTEXITCODE -ne 0) {
      Write-Host "[ECR] MISSING: $repo`:$Tag" -ForegroundColor Red
      $ready = $false
    } else {
      Write-Host "[ECR] OK: $repo`:$Tag" -ForegroundColor Green
    }
  }
  $svc = aws ecs describe-services --cluster oceanbazar-staging-cluster --services oceanbazar-staging-bff oceanbazar-staging-java-api --region $Region --output json | ConvertFrom-Json
  foreach ($s in $svc.services) {
    $line = "[ECS] $($s.serviceName) desired=$($s.desiredCount) running=$($s.runningCount)"
    if ($s.runningCount -lt 1 -or $s.desiredCount -lt 1) {
      Write-Host "$line" -ForegroundColor Yellow
      $ready = $false
    } else {
      Write-Host "$line" -ForegroundColor Green
    }
  }
  Push-Location $TfDir
  try {
    $alb = (terraform output -raw public_alb_dns_name 2>$null).Trim()
  } finally {
    Pop-Location
  }
  if ($alb) {
    $url = "https://$alb/api/health"
    $curl = & curl.exe -skI -m 15 $url 2>&1 | Out-String
    if ($curl -match "HTTP/\S+\s+200") {
      Write-Host "[ALB] $url -> 200" -ForegroundColor Green
    } else {
      Write-Host "[ALB] $url -> not 200`n$curl" -ForegroundColor Red
      $ready = $false
    }
  } else {
    Write-Host "[ALB] Could not read terraform output public_alb_dns_name" -ForegroundColor Red
    $ready = $false
  }
  if (-not $ready) {
    Write-Host "`nNot ready. Start Docker Desktop, then: npm run aws:staging:ecs:push" -ForegroundColor Yellow
    exit 1
  }
  Write-Host "`nReady." -ForegroundColor Green
  exit 0
}

function Test-DockerEngine {
  docker ps 1>$null 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "Docker engine is not running. Start Docker Desktop, wait until it is healthy, then re-run this script."
  }
}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TfDir    = Join-Path $RepoRoot "infra\terraform"

Write-Host "Repo root: $RepoRoot" -ForegroundColor Cyan

Test-DockerEngine

$Account = (aws sts get-caller-identity --query Account --output text).Trim()
if (-not $Account) { throw "Could not resolve AWS account (aws sts get-caller-identity)." }

$EcrRegistry = "$Account.dkr.ecr.$Region.amazonaws.com"
$BffImage    = "$EcrRegistry/oceanbazar-staging-bff`:$Tag"
$JavaImage   = "$EcrRegistry/oceanbazar-staging-java-api`:$Tag"

Write-Host "Logging in to ECR $EcrRegistry ..." -ForegroundColor Cyan
aws ecr get-login-password --region $Region |
  docker login --username AWS --password-stdin $EcrRegistry

Write-Host "Building BFF image -> $BffImage" -ForegroundColor Cyan
docker build -f (Join-Path $RepoRoot "backend\Dockerfile") -t $BffImage (Join-Path $RepoRoot "backend")
docker push $BffImage

Write-Host "Building Java API image -> $JavaImage" -ForegroundColor Cyan
docker build -f (Join-Path $RepoRoot "backend-java\Dockerfile") -t $JavaImage (Join-Path $RepoRoot "backend-java")
docker push $JavaImage

if ($SkipTerraformApply) {
  Write-Host "SkipTerraformApply: not running terraform. Set bff_desired_count/java_desired_count to >=1 and apply, or re-run without -SkipTerraformApply." -ForegroundColor Yellow
  exit 0
}

Write-Host "Running terraform apply (scale BFF/Java to 1) in $TfDir ..." -ForegroundColor Cyan
Push-Location $TfDir
try {
  terraform apply -auto-approve -no-color `
    -var="bff_desired_count=1" `
    -var="java_desired_count=1"
} finally {
  Pop-Location
}

Push-Location $TfDir
try {
  $alb = (terraform output -raw public_alb_dns_name 2>$null).Trim()
} finally {
  Pop-Location
}
if ($alb) {
  Write-Host "Done. Check BFF health: https://$alb/api/health" -ForegroundColor Green
} else {
  Write-Host "Done. Run: cd infra/terraform && terraform output public_alb_dns_name" -ForegroundColor Green
}

Write-Host @"

Tip: Terraform state now has bff/java desired_count=1, but terraform.tfvars may still say 0.
     Update infra/terraform/terraform.tfvars (bff_desired_count / java_desired_count) to 1
     so a future plain 'terraform apply' does not scale the services back down to 0.
"@ -ForegroundColor Yellow
