# Restore PostgreSQL from pg_dump custom format (-Fc)
# Usage: .\scripts\ops\restore-postgres.ps1 -DumpFile backups\2026-05-25\postgres.dump

param(
  [Parameter(Mandatory = $true)]
  [string]$DumpFile,
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path $DumpFile)) { throw "Dump not found: $DumpFile" }
if (-not $DatabaseUrl) {
  $DatabaseUrl = "postgresql://oceanbazar:secret@127.0.0.1:5433/oceanbazar"
}

if (-not $Force) {
  $confirm = Read-Host "This will overwrite data in $DatabaseUrl. Type RESTORE to continue"
  if ($confirm -ne "RESTORE") { Write-Host "Aborted."; exit 1 }
}

Write-Host "Restoring $DumpFile ..."
& pg_restore --clean --if-exists --no-owner --dbname $DatabaseUrl $DumpFile
if ($LASTEXITCODE -ne 0) { throw "pg_restore failed" }
Write-Host "Restore complete."
