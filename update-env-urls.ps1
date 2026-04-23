# OceanBazar Environment URL Updater
# Updates all .env files to use the new standardized HTTPS URLs

$ErrorActionPreference = "Stop"
$base = "c:\Users\akand\Desktop\Antigravity\OCEANBAZAR Website"

Write-Host "=== OceanBazar Environment URL Updater ===" -ForegroundColor Cyan
Write-Host "Updating .env files to use new HTTPS URLs..." -ForegroundColor Gray
Write-Host ""

# Function to update or add env variable
function Update-EnvVar($filePath, $varName, $newValue) {
    if (-not (Test-Path $filePath)) {
        Write-Host "  Creating new file: $filePath" -ForegroundColor Yellow
        "$varName=$newValue" | Out-File -FilePath $filePath -Encoding UTF8
        return
    }

    $content = Get-Content $filePath -Raw
    $lines = Get-Content $filePath
    $updated = $false
    $newLines = @()

    foreach ($line in $lines) {
        if ($line -match "^$varName\s*=\s*(.*)$") {
            $oldValue = $matches[1]
            if ($oldValue -ne $newValue) {
                Write-Host "  Updating $varName`: $oldValue -> $newValue" -ForegroundColor Green
                $newLines += "$varName=$newValue"
                $updated = $true
            } else {
                $newLines += $line
                Write-Host "  $varName already correct: $newValue" -ForegroundColor Gray
            }
        } else {
            $newLines += $line
        }
    }

    # If variable wasn't found, add it
    if (-not $updated -and -not ($lines | Where-Object { $_ -match "^$varName\s*=" })) {
        Write-Host "  Adding $varName=$newValue" -ForegroundColor Green
        $newLines += "$varName=$newValue"
    }

    $newLines | Out-File -FilePath $filePath -Encoding UTF8
}

# Update frontend .env.local
Write-Host "`n1. Updating frontend/.env.local..." -ForegroundColor Cyan
$frontendEnv = "$base\frontend\.env.local"
Update-EnvVar $frontendEnv "NEXT_PUBLIC_API_URL" "http://127.0.0.1:4000"

# Update frontend .env.development
Write-Host "`n2. Updating frontend/.env.development..." -ForegroundColor Cyan
$frontendEnvDev = "$base\frontend\.env.development"
Update-EnvVar $frontendEnvDev "NEXT_PUBLIC_API_URL" "http://127.0.0.1:4000"

# Update backend .env
Write-Host "`n3. Updating backend/.env..." -ForegroundColor Cyan
$backendEnv = "$base\backend\.env"
if (Test-Path $backendEnv) {
    Update-EnvVar $backendEnv "JAVA_API_URL" "http://127.0.0.1:8000"
    Update-EnvVar $backendEnv "PUBLIC_BASE_URL" "http://127.0.0.1:4000"
    Update-EnvVar $backendEnv "CLIENT_URL" "http://127.0.0.1:3000"
    Update-EnvVar $backendEnv "ADMIN_URL" "http://127.0.0.1:5173"
} else {
    Update-EnvVar $backendEnv "JAVA_API_URL" "http://127.0.0.1:8000"
    Update-EnvVar $backendEnv "PUBLIC_BASE_URL" "http://127.0.0.1:4000"
    Update-EnvVar $backendEnv "CLIENT_URL" "http://127.0.0.1:3000"
    Update-EnvVar $backendEnv "ADMIN_URL" "http://127.0.0.1:5173"
}

# Update admin .env.local
Write-Host "`n4. Updating admin-frontend-react/.env.local..." -ForegroundColor Cyan
$adminEnv = "$base\admin-frontend-react\.env.local"
Update-EnvVar $adminEnv "VITE_ADMIN_API_URL" "http://127.0.0.1:8000"

Write-Host "`n=== All .env files updated! ===" -ForegroundColor Green
Write-Host "`nNew standardized URLs:" -ForegroundColor Cyan
Write-Host "  Storefront: http://127.0.0.1:3000" -ForegroundColor White
Write-Host "  Admin CRM:  http://127.0.0.1:5173" -ForegroundColor White
Write-Host "  Backend:    http://127.0.0.1:4000 (BFF)" -ForegroundColor White
Write-Host "  Core API:   http://127.0.0.1:8000" -ForegroundColor White
Write-Host "`nRun the following to start services:" -ForegroundColor Yellow
Write-Host "  .\quick-start.ps1" -ForegroundColor White
