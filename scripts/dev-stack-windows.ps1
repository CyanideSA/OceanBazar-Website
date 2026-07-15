# OceanBazar — prepare local stack on Windows when Docker Desktop is unreliable.
# Usage (repo root):
#   powershell -ExecutionPolicy Bypass -File .\scripts\dev-stack-windows.ps1
# Optional:
#   -Launch          spawn four PowerShell windows (backend, java, storefront, admin)
#   -SkipDocker      do not run docker compose
#   -SkipMigrate     skip Prisma migrate deploy

param(
  [switch] $Launch,
  [switch] $SkipDocker,
  [switch] $SkipMigrate
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path "$Root\backend\package.json")) {
  throw "Run this script from the repo: scripts\dev-stack-windows.ps1 (could not find backend\package.json under $Root)"
}

function Test-TcpPort([string] $HostName, [int] $Port) {
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $c.ReceiveTimeout = 2000
    $c.SendTimeout = 2000
    $iar = $c.BeginConnect($HostName, $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(2000, $false)
    if (-not $ok) { $c.Close(); return $false }
    $c.EndConnect($iar)
    $c.Close()
    return $true
  } catch {
    return $false
  }
}

function Get-PostgresPortsToProbe {
  $envFile = Join-Path $Root 'backend\.env'
  if (Test-Path $envFile) {
    $line = Get-Content $envFile -ErrorAction SilentlyContinue | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
    if ($line -match '@127\.0\.0\.1:(\d+)/') { return @([int]$Matches[1]) }
    if ($line -match '@localhost:(\d+)/') { return @([int]$Matches[1]) }
  }
  return @(5433, 5432)
}

function Wait-Postgres {
  $ports = Get-PostgresPortsToProbe
  $deadline = (Get-Date).AddMinutes(3)
  while ((Get-Date) -lt $deadline) {
    foreach ($p in $ports) {
      if (Test-TcpPort '127.0.0.1' $p) {
        Write-Host "[dev-stack] PostgreSQL accepting TCP on 127.0.0.1:$p"
        return $p
      }
    }
    Start-Sleep -Seconds 2
  }
  return $null
}

Write-Host "[dev-stack] Repo root: $Root"

if (-not $SkipDocker) {
  $dockerOk = $false
  try {
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $dockerOk = $true }
  } catch {}
  if ($dockerOk) {
    Write-Host "[dev-stack] Docker OK — starting postgres + redis via compose..."
    Push-Location $Root
    docker compose up -d postgres redis
    Pop-Location
  } else {
    Write-Warning "[dev-stack] Docker CLI/engine not healthy — skipping compose. Use native Postgres + scripts\start-redis-windows.ps1 (see NO-DOCKER-WINDOWS.md)."
    $redisScript = Join-Path $Root 'scripts\start-redis-windows.ps1'
    if (Test-Path $redisScript) {
      try { & powershell -ExecutionPolicy Bypass -File $redisScript } catch {}
    }
  }
}

$pgPort = Wait-Postgres
if (-not $pgPort) {
  $envFile = Join-Path $Root 'backend\.env'
  $uses5433 = $false
  if (Test-Path $envFile) {
    $ln = Get-Content $envFile -ErrorAction SilentlyContinue | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
    if ($ln -match ':5433/') { $uses5433 = $true }
  }
  if ($uses5433 -and (Test-TcpPort '127.0.0.1' 5432) -and -not (Test-TcpPort '127.0.0.1' 5433)) {
    Write-Host "[dev-stack] Hint: PostgreSQL is responding on 127.0.0.1:5432 but DATABASE_URL uses 5433."
    Write-Host "          Update DATABASE_URL and DIRECT_URL in backend\.env to port 5432 (native install), then re-run."
  }
  Write-Host @"

[dev-stack] PostgreSQL not reachable on 127.0.0.1:5433 or :5432.

Option A — fix Docker, then re-run this script:
  powershell -ExecutionPolicy Bypass -File .\scripts\repair-docker-wsl.ps1
  (start Docker Desktop, wait until Running)
  docker compose up -d postgres redis

Option B — native PostgreSQL 16 (example):
  winget install -e --id PostgreSQL.PostgreSQL.16 --accept-package-agreements --accept-source-agreements
  Create database/user matching backend\.env (default: db oceanbazar, user oceanbazar, password secret).
  Use port 5432 in DATABASE_URL and spring.datasource.url, or map 5433 if you prefer.

"@
  exit 1
}

if (-not $SkipMigrate) {
  Write-Host "[dev-stack] Prisma migrate deploy..."
  Push-Location "$Root\backend"
  npx prisma migrate deploy
  $prismaCode = $LASTEXITCODE
  Pop-Location
  if ($prismaCode -ne 0) {
    Write-Host @"

[dev-stack] Prisma migrate failed. Typical fixes:
  - P1000 auth: create role/db once (superuser), see scripts\sql\create_oceanbazar_local.sql
  - Wrong port: DATABASE_URL / DIRECT_URL must match Postgres (Docker host port 5433 vs native 5432)

"@
    exit $prismaCode
  }
}

$redis6399 = Test-TcpPort '127.0.0.1' 6399
$redis6379 = Test-TcpPort '127.0.0.1' 6379
$javaProfile = if ($redis6399 -or $redis6379) { 'default' } else { 'dockerless' }

$jdbcUrl = "jdbc:postgresql://127.0.0.1:$pgPort/oceanbazar"
$jvmDb = "-Dspring.datasource.url=$jdbcUrl"
$profileArg = if ($javaProfile -eq 'dockerless') { '-Dspring-boot.run.profiles=dockerless' } else { '' }

Write-Host @"

[dev-stack] Ready.
  PostgreSQL: 127.0.0.1:$pgPort
  Redis (6399/6379): 6399=$redis6399  6379=$redis6379
  Spring Boot profile: $javaProfile  (dockerless when Redis is down; admin unread count cache disabled)

Start commands:
  1) cd backend && npm run dev
  2) cd backend-java && mvn spring-boot:run $profileArg "-Dspring-boot.run.jvmArguments=$jvmDb"
  3) cd frontend && npm run dev
  4) cd admin-frontend-react && npm run dev

If JAVA_API / login fails, ensure (2) is running on http://127.0.0.1:8000 and DATABASE_URL matches your Postgres port.

"@

if ($Launch) {
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd `"$Root\backend`"; npm.cmd run dev"
  $jdbcUrlEsc = $jdbcUrl -replace '"', '`"'
  $javaCmd = if ($javaProfile -eq 'dockerless') {
    "cd `"$Root\backend-java`"; mvn spring-boot:run `"-Dspring-boot.run.profiles=dockerless`" `"-Dspring-boot.run.jvmArguments=-Dspring.datasource.url=$jdbcUrlEsc`""
  } else {
    "cd `"$Root\backend-java`"; mvn spring-boot:run `"-Dspring-boot.run.jvmArguments=-Dspring.datasource.url=$jdbcUrlEsc`""
  }
  Start-Process powershell -ArgumentList '-NoExit', '-Command', $javaCmd
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd `"$Root\frontend`"; npm.cmd run dev"
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd `"$Root\admin-frontend-react`"; npm.cmd run dev"
}
