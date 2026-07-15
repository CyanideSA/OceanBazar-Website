# OceanBazar production safety backup (Phase 0)
# Usage: .\scripts\ops\backup-all.ps1 [-OutDir backups\2026-05-25]

param(
  [string]$OutDir = (Join-Path $PSScriptRoot "..\..\backups" (Get-Date -Format "yyyy-MM-dd_HHmmss"))
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$pgUrl = $env:DATABASE_URL
if (-not $pgUrl) {
  $pgUrl = "postgresql://oceanbazar:secret@127.0.0.1:5433/oceanbazar"
}

$dumpPath = Join-Path $OutDir "postgres.dump"
Write-Host "PostgreSQL dump -> $dumpPath"
& pg_dump $pgUrl -Fc -f $dumpPath
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed (is PostgreSQL client installed?)" }

$redisContainer = "oceanbazar_redis"
$redisRunning = docker ps --format "{{.Names}}" | Select-String -Pattern "^${redisContainer}$" -Quiet
if ($redisRunning) {
  $rdbPath = Join-Path $OutDir "redis.rdb"
  Write-Host "Redis SAVE via docker exec"
  docker exec $redisContainer redis-cli SAVE | Out-Null
  docker cp "${redisContainer}:/data/dump.rdb" $rdbPath
} else {
  Write-Warning "Redis container '$redisContainer' not running — skip Redis snapshot"
}

$flagsPath = Join-Path $OutDir "feature-flags.json"
Copy-Item (Join-Path $PSScriptRoot "..\..\config\feature-flags.json") $flagsPath -ErrorAction SilentlyContinue

Write-Host "Backup complete: $OutDir"
