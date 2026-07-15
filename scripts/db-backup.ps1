param(
  [string]$OutputDir = "",
  [string]$FilePrefix = "oceanbazar",
  [switch]$VerboseMode
)

$ErrorActionPreference = "Stop"

function Get-RequiredEnv([string]$Name) {
  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing required environment variable: $Name"
  }
  return $value
}

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
  $OutputDir = [Environment]::GetEnvironmentVariable("BACKUP_DIR")
}
if ([string]::IsNullOrWhiteSpace($OutputDir)) {
  $OutputDir = ".\backups"
}

$hostName = Get-RequiredEnv "PGHOST"
$port = [Environment]::GetEnvironmentVariable("PGPORT")
if ([string]::IsNullOrWhiteSpace($port)) { $port = "5432" }
$database = Get-RequiredEnv "PGDATABASE"
$user = Get-RequiredEnv "PGUSER"
$password = Get-RequiredEnv "PGPASSWORD"

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $OutputDir "$FilePrefix`_$database`_$timestamp.dump"

$env:PGPASSWORD = $password

$args = @(
  "-h", $hostName,
  "-p", $port,
  "-U", $user,
  "-d", $database,
  "-F", "c",
  "-f", $backupFile,
  "--no-owner",
  "--no-privileges"
)

if ($VerboseMode) {
  Write-Host "Running: pg_dump $($args -join ' ')"
}

& pg_dump @args
if ($LASTEXITCODE -ne 0) {
  throw "pg_dump failed with exit code $LASTEXITCODE"
}

if (-not (Test-Path $backupFile)) {
  throw "Backup file was not created: $backupFile"
}

$fileInfo = Get-Item $backupFile
if ($fileInfo.Length -lt 1024) {
  throw "Backup file is unexpectedly small: $($fileInfo.Length) bytes"
}

Write-Host "Backup created successfully: $backupFile"
