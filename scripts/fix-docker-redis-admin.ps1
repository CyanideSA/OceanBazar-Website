# Fix Docker Engine + Redis on Windows (requires Administrator).
#
# 1) Repairs Docker Desktop service + waits for the Linux engine.
# 2) Starts Redis via docker compose on host port 6399 when Docker works.
# 3) If Docker never becomes healthy, installs Redis as a proper Windows Service using WinSW (no Docker).
#
# Usage (elevated PowerShell):
#   cd <repo-root>
#   powershell -ExecutionPolicy Bypass -File .\scripts\fix-docker-redis-admin.ps1
#
# From a normal shell (UAC prompt):
#   powershell -ExecutionPolicy Bypass -File .\scripts\fix-docker-redis-admin.ps1 -Elevate
#
# Skip Docker and only install / refresh the Windows Redis service:
#   powershell -ExecutionPolicy Bypass -File .\scripts\fix-docker-redis-admin.ps1 -RedisServiceOnly

param(
  [switch] $Elevate,
  [switch] $RedisServiceOnly
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent

function Test-IsAdmin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Ensure-PortableRedis {
  $redisDir = Join-Path $Root '.dev\redis-win'
  $zipPath = Join-Path $redisDir 'Redis-x64-5.0.14.1.zip'
  $exePath = Join-Path $redisDir 'redis-server.exe'
  $url = 'https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.zip'
  if (-not (Test-Path $exePath)) {
    Write-Host "[redis] Downloading portable Redis to $redisDir ..."
    New-Item -ItemType Directory -Force -Path $redisDir | Out-Null
    Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing
    Expand-Archive -LiteralPath $zipPath -DestinationPath $redisDir -Force
    Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
  }
  if (-not (Test-Path $exePath)) {
    throw "[redis] redis-server.exe missing: $exePath"
  }
  return @{ Dir = $redisDir; Exe = $exePath }
}

function Install-RedisWindowsServiceWinSW {
  $redis = Ensure-PortableRedis
  $svcDir = Join-Path $Root '.dev\redis-service'
  New-Item -ItemType Directory -Force -Path $svcDir | Out-Null

  $wrapperExe = Join-Path $svcDir 'OceanBazarRedis.exe'
  $wrapperXml = Join-Path $svcDir 'OceanBazarRedis.xml'
  $winswUrl = 'https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe'

  if (-not (Test-Path $wrapperExe)) {
    Write-Host '[redis] Downloading WinSW (Windows Service Wrapper)...'
    Invoke-WebRequest -Uri $winswUrl -OutFile $wrapperExe -UseBasicParsing
  }

  $confPath = Join-Path $PSScriptRoot 'redis-oceanbazar-6399.conf'
  if (-not (Test-Path $confPath)) {
    throw "[redis] Config missing: $confPath"
  }

  # Absolute paths — required because redis.exe lives outside the WinSW folder.
  $exeAbs = $redis.Exe
  $confAbs = (Resolve-Path $confPath).Path
  $workAbs = $redis.Dir

  function Escape-XmlText([string] $t) {
    if ([string]::IsNullOrEmpty($t)) { return '' }
    return ($t -replace '&', '&amp;' -replace '<', '&lt;' -replace '>', '&gt;')
  }

  $exeEsc = Escape-XmlText $exeAbs
  $confEsc = Escape-XmlText $confAbs
  $workEsc = Escape-XmlText $workAbs

  $xml = @"
<service>
  <id>OceanBazarRedis</id>
  <name>OceanBazar Redis (6399)</name>
  <description>Local Redis for OceanBazar development on 127.0.0.1:6399 (matches docker-compose / backend/.env).</description>
  <executable>$exeEsc</executable>
  <arguments>&quot;$confEsc&quot;</arguments>
  <workingdirectory>$workEsc</workingdirectory>
</service>
"@

  Set-Content -LiteralPath $wrapperXml -Value $xml -Encoding UTF8

  Write-Host '[redis] Registering Windows Service (WinSW) OceanBazarRedis...'
  Push-Location $svcDir
  try {
    & .\OceanBazarRedis.exe stop 2>$null
    & .\OceanBazarRedis.exe uninstall 2>$null
    Start-Sleep -Seconds 2
    & .\OceanBazarRedis.exe install
    & .\OceanBazarRedis.exe start
  } finally {
    Pop-Location
  }

  $svc = Get-Service -Name 'OceanBazarRedis' -ErrorAction SilentlyContinue
  if (-not $svc) {
    throw '[redis] Service OceanBazarRedis was not registered.'
  }
  Write-Host "[redis] Service status: $($svc.Status)"
  Write-Host '[redis] Verify: Get-Service OceanBazarRedis; Test-NetConnection 127.0.0.1 -Port 6399'
}

if (-not (Test-IsAdmin)) {
  if ($Elevate) {
    $elevArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath)
    if ($RedisServiceOnly) { $elevArgs += '-RedisServiceOnly' }
    Start-Process -FilePath powershell.exe -Verb RunAs -ArgumentList $elevArgs
    exit 0
  }
  Write-Host @"
This script must run as Administrator.

Re-run with elevation:
  powershell -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Elevate

Docker-only help (no admin): use .\scripts\start-redis-windows.ps1 for a user process on port 6399.
"@
  exit 1
}

if ($RedisServiceOnly) {
  Install-RedisWindowsServiceWinSW
  Write-Host '[fix-docker-redis] RedisServiceOnly complete.'
  exit 0
}

Write-Host '[fix-docker-redis] Running as Administrator — resetting WSL (helps Docker pipe errors)...'
wsl --shutdown 2>$null
Start-Sleep -Seconds 3

Write-Host '[fix-docker-redis] Starting Docker Desktop service...'
$svc = Get-Service -Name 'com.docker.service' -ErrorAction SilentlyContinue
if ($svc) {
  Set-Service -Name 'com.docker.service' -StartupType Automatic -ErrorAction SilentlyContinue
  if ($svc.Status -ne 'Running') {
    Start-Service -Name 'com.docker.service'
  }
  Write-Host "[fix-docker-redis] com.docker.service status: $((Get-Service com.docker.service).Status)"
} else {
  Write-Warning '[fix-docker-redis] com.docker.service not found — is Docker Desktop installed?'
}

$dd = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
if (Test-Path $dd) {
  Write-Host '[fix-docker-redis] Launching Docker Desktop UI...'
  Start-Process $dd
}

Write-Host '[fix-docker-redis] Waiting for Docker engine (up to 120s)...'
$engineOk = $false
for ($i = 1; $i -le 24; $i++) {
  Start-Sleep -Seconds 5
  try {
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $engineOk = $true; break }
  } catch {}
  Write-Host "  ... $([int]($i * 5))s"
}

if (-not $engineOk) {
  Write-Warning '[fix-docker-redis] Docker engine not responding — installing Redis as a Windows Service (WinSW) instead.'
  Install-RedisWindowsServiceWinSW
  Write-Host @'

[fix-docker-redis] Redis is running as Windows Service "OceanBazarRedis" on 127.0.0.1:6399.
When Docker works again: stop this service ( Stop-Service OceanBazarRedis ) before starting docker compose redis (same port).

'@
  exit 0
}

Write-Host '[fix-docker-redis] Starting Redis via docker compose...'
Push-Location $Root
try {
  docker compose up -d redis
  docker compose ps redis
} finally {
  Pop-Location
}

Write-Host @'

[fix-docker-redis] Done. Redis (Docker): 127.0.0.1:6399 — verify: docker exec oceanbazar_redis redis-cli ping

'@
