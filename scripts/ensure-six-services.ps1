# OceanBazar — keep all six dev tiers reachable:
#   Docker: Postgres + Redis
#   Local processes (spawn missing): Node BFF :4000, Spring Boot :8000, Next storefront :3000, Vite admin :5173
#
# Repo root:
#   npm run stack:keep
#
# Optional:
#   -MigrateOnce    run prisma migrate deploy once before spawning apps

param([switch] $MigrateOnce)

$ErrorActionPreference = 'Continue'
# Single-quoted — avoids PS parsing `[ ... ]` inside double-quoted strings as type/index tokens.
$SixTag = '[six-services]'
$Root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path "$Root\backend\package.json")) {
  throw "Could not find backend under repo root: $Root"
}

function Test-TcpPort([string] $HostName, [int] $Port, [int] $WaitMs = 1200) {
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $c.ReceiveTimeout = $WaitMs
    $c.SendTimeout = $WaitMs
    $iar = $c.BeginConnect($HostName, $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne($WaitMs, $false)
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
    if ($line -match '@127\.0.0\.1:(\d+)/') { return @([int]$Matches[1]) }
    if ($line -match '@localhost:(\d+)/') { return @([int]$Matches[1]) }
  }
  return @(5433, 5432)
}

function Wait-Postgres {
  $ports = Get-PostgresPortsToProbe
  $deadline = (Get-Date).AddMinutes(3)
  while ((Get-Date) -lt $deadline) {
    foreach ($p in $ports) {
      if (Test-TcpPort '127.0.0.1' $p 1800) {
        Write-Host "$SixTag PostgreSQL accepting TCP on 127.0.0.1:$p"
        return $p
      }
    }
    Start-Sleep -Seconds 2
  }
  return $null
}

Write-Host "$SixTag Repo root: $Root"

$dockerOk = $false
try {
  docker info 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { $dockerOk = $true }
} catch {}

if ($dockerOk) {
  Write-Host "$SixTag Starting Postgres + Redis (Docker Compose)..."
  Push-Location $Root
  docker compose up -d postgres redis 2>&1 | Out-Host
  Pop-Location
} else {
  Write-Warning "$SixTag Docker not healthy - Postgres/Redis containers skipped (use native DB + REDIS_URL)."
}

$pgPort = Wait-Postgres
if (-not $pgPort) {
  Write-Warning "$SixTag PostgreSQL not reachable (checked ports from backend\.env + 5433/5432). Apps may fail until DB is up."
  $pgPort = 5432
}

if ($MigrateOnce) {
  Write-Host "$SixTag Prisma migrate deploy..."
  Push-Location "$Root\backend"
  npx prisma migrate deploy 2>&1 | Out-Host
  Pop-Location
}

$redis6399 = Test-TcpPort '127.0.0.1' 6399
$redis6379 = Test-TcpPort '127.0.0.1' 6379
$javaProfile = if ($redis6399 -or $redis6379) { 'default' } else { 'dockerless' }

$jdbcUrl = "jdbc:postgresql://127.0.0.1:$pgPort/oceanbazar"
$jdbcUrlEsc = $jdbcUrl -replace '"', '`"'
$javaCmd = if ($javaProfile -eq 'dockerless') {
  "cd `"$Root\backend-java`"; mvn spring-boot:run `"-Dspring-boot.run.profiles=dockerless`" `"-Dspring-boot.run.jvmArguments=-Dspring.datasource.url=$jdbcUrlEsc`""
} else {
  "cd `"$Root\backend-java`"; mvn spring-boot:run `"-Dspring-boot.run.jvmArguments=-Dspring.datasource.url=$jdbcUrlEsc`""
}

$checks = @(
  @{ Port = 4000; Label = 'BFF (Node)'; Cmd = "cd `"$Root\backend`"; npm.cmd run dev" },
  @{ Port = 8000; Label = 'Java API (Spring Boot)'; Cmd = $javaCmd },
  @{ Port = 3000; Label = 'Storefront (Next.js)'; Cmd = "cd `"$Root\frontend`"; npm.cmd run dev" },
  @{ Port = 5173; Label = 'Admin CRM (Vite)'; Cmd = "cd `"$Root\admin-frontend-react`"; npm.cmd run dev" }
)

Start-Sleep -Seconds 2

foreach ($c in $checks) {
  if (Test-TcpPort '127.0.0.1' $c.Port 800) {
    Write-Host "$SixTag OK $($c.Label) already listening on :$($c.Port)"
  } else {
    Write-Host "$SixTag Starting $($c.Label) -> new PowerShell window..."
    Start-Process powershell -ArgumentList '-NoExit', '-Command', $c.Cmd
  }
}

$redisNote = if ($redis6399 -or $redis6379) { '[listening]' } else { '[not detected on 6399/6379]' }
Write-Host ''
Write-Host ($SixTag + ' Summary:')
Write-Host '  Postgres: match backend\.env DATABASE_URL (Compose usually publishes host port 5433).'
Write-Host ('  Redis:    Compose publishes localhost:6399 when containers are up ' + $redisNote + '.')
Write-Host '  URLs:     Storefront http://localhost:3000  Admin http://localhost:5173  BFF http://localhost:4000  Java http://localhost:8000'
Write-Host ''
Write-Host 'Leave the spawned PowerShell windows open. Re-run anytime: npm run stack:keep'
Write-Host ''
