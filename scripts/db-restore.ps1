param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [string]$TargetDb = "",
  [switch]$DropExisting = $false,
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

if (-not (Test-Path $BackupFile)) {
  throw "Backup file not found: $BackupFile"
}

$hostName = Get-RequiredEnv "PGHOST"
$port = [Environment]::GetEnvironmentVariable("PGPORT")
if ([string]::IsNullOrWhiteSpace($port)) { $port = "5432" }
$user = Get-RequiredEnv "PGUSER"
$password = Get-RequiredEnv "PGPASSWORD"

if ([string]::IsNullOrWhiteSpace($TargetDb)) {
  $TargetDb = Get-RequiredEnv "PGDATABASE"
}

$env:PGPASSWORD = $password

if ($DropExisting) {
  $dropSql = "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
  $dropArgs = @("-h", $hostName, "-p", $port, "-U", $user, "-d", $TargetDb, "-v", "ON_ERROR_STOP=1", "-c", $dropSql)
  if ($VerboseMode) {
    Write-Host "Running schema reset on database: $TargetDb"
  }
  & psql @dropArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Schema reset failed with exit code $LASTEXITCODE"
  }
}

$restoreArgs = @(
  "-h", $hostName,
  "-p", $port,
  "-U", $user,
  "-d", $TargetDb,
  "--no-owner",
  "--no-privileges",
  "--clean",
  "--if-exists",
  $BackupFile
)

if ($VerboseMode) {
  Write-Host "Running: pg_restore $($restoreArgs -join ' ')"
}

& pg_restore @restoreArgs
if ($LASTEXITCODE -ne 0) {
  throw "pg_restore failed with exit code $LASTEXITCODE"
}

Write-Host "Restore completed successfully into database: $TargetDb"
