# Reset forgotten PostgreSQL "postgres" superuser password on Windows.
# Run PowerShell AS ADMINISTRATOR from repo root:
#   powershell -ExecutionPolicy Bypass -File .\scripts\reset-postgres-password-windows.ps1
#
# Optional: -NewPassword "YourPassword123"

param(
  [string] $NewPassword = 'oceanbazar_admin_2026',
  [string] $PgData = 'C:\Program Files\PostgreSQL\16\data',
  [string] $ServiceName = 'postgresql-x64-16'
)

$ErrorActionPreference = 'Stop'

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw 'Run this script in an Administrator PowerShell window.' }

$pgHba = Join-Path $PgData 'pg_hba.conf'
$psql = 'C:\Program Files\PostgreSQL\16\bin\psql.exe'
if (-not (Test-Path $pgHba)) { throw "pg_hba.conf not found: $pgHba" }

$backup = "$pgHba.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $pgHba $backup -Force
Write-Host "[reset] Backup: $backup"

$hba = Get-Content $pgHba -Raw
$hbaTrust = $hba -replace 'scram-sha-256', 'trust'
Set-Content -Path $pgHba -Value $hbaTrust -Encoding ASCII -NoNewline

Restart-Service $ServiceName -Force
Start-Sleep 3

$escaped = $NewPassword.Replace("'", "''")
Write-Host '[reset] Setting postgres password (no prompt)...'
& $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -c "ALTER USER postgres PASSWORD '$escaped';"

Copy-Item $backup $pgHba -Force
Restart-Service $ServiceName -Force
Start-Sleep 2

Write-Host @"

[reset] Done. postgres password: $NewPassword

Next (normal window):
  cd `"D:\Desktop\Antigravity\OCEANBAZAR Website`"
  `$env:PGPASSWORD='$NewPassword'
  & `"$psql`" -h 127.0.0.1 -U postgres -f scripts\sql\create_oceanbazar_local.sql
  powershell -ExecutionPolicy Bypass -File .\scripts\setup-native-windows.ps1
  npm run stack:start

"@
