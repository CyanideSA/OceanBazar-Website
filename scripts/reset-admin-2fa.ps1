# Reset admin 2FA in Docker Postgres (fresh Google Authenticator enrollment).
# Usage: .\scripts\reset-admin-2fa.ps1
#        .\scripts\reset-admin-2fa.ps1 -Username rjsuvosa

param(
  [string]$Username = "rjsuvosa"
)

$ErrorActionPreference = "Stop"

Write-Host "Resetting 2FA for admin: $Username" -ForegroundColor Cyan

docker exec oceanbazar_postgres psql -U oceanbazar -d oceanbazar -c `
  "UPDATE admin_users SET two_fa_enabled=FALSE, two_fa_secret=NULL, two_fa_last_counter=NULL WHERE username='$Username' RETURNING username, two_fa_enabled;"

if ($LASTEXITCODE -ne 0) {
  Write-Host "Docker Postgres reset failed. Is oceanbazar_postgres running?" -ForegroundColor Red
  exit 1
}

Write-Host "Restarting BFF to clear pending setup cache..." -ForegroundColor Cyan
docker restart oceanbazar_bff | Out-Null
Start-Sleep -Seconds 12

Write-Host "Done. Log in at http://localhost:4000 — you should see Set Up 2FA." -ForegroundColor Green
Write-Host "Ensure ADMIN_2FA_ONBOARDING_BYPASS=false (default in docker-compose.yml)." -ForegroundColor Yellow
