# OceanBazar Dependency Setup - Run once to cache all dependencies
$ErrorActionPreference = "Stop"

$base = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }

Write-Host "=== OceanBazar Dependency Setup ===" -ForegroundColor Cyan
Write-Host "This will download all dependencies once for fast future startups`n" -ForegroundColor Gray

# 1. Backend Maven dependencies
Write-Host "[1/4] Downloading Maven dependencies (backend)..." -ForegroundColor Yellow
Set-Location "$base\backend-java"
& mvn dependency:go-offline -q
if ($LASTEXITCODE -ne 0) {
    Write-Host "Maven dependencies downloaded (some artifacts may have been resolved during build)" -ForegroundColor Gray
} else {
    Write-Host "Maven dependencies cached!" -ForegroundColor Green
}

# 2. Frontend npm dependencies
Write-Host "`n[2/4] Installing npm dependencies (storefront)..." -ForegroundColor Yellow
Set-Location "$base\frontend"
& npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "Storefront dependencies installed!" -ForegroundColor Green
} else {
    Write-Host "Warning: Some issues with storefront dependencies" -ForegroundColor Yellow
}

# 3. Admin npm dependencies
Write-Host "`n[3/4] Installing npm dependencies (admin CRM)..." -ForegroundColor Yellow
Set-Location "$base\admin-frontend-react"
& npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "Admin CRM dependencies installed!" -ForegroundColor Green
} else {
    Write-Host "Warning: Some issues with admin dependencies" -ForegroundColor Yellow
}

# 4. Pre-compile backend for faster startup
Write-Host "`n[4/4] Pre-compiling backend classes..." -ForegroundColor Yellow
Set-Location "$base\backend-java"
& mvn compile -q
if ($LASTEXITCODE -eq 0) {
    Write-Host "Backend pre-compiled!" -ForegroundColor Green
} else {
    Write-Host "Warning: Backend compilation had issues" -ForegroundColor Yellow
}

Write-Host "`n=== Setup Complete! ===" -ForegroundColor Cyan
Write-Host "You can now use quick-start.ps1 for fast service startup" -ForegroundColor Green
Write-Host ""
Write-Host "Usage:" -ForegroundColor Yellow
Write-Host "  .\quick-start.ps1         # Start all services" -ForegroundColor White
Write-Host "  .\quick-start.ps1 -Only backend,storefront  # Start specific services" -ForegroundColor White
Write-Host "  .\start.bat               # Alternative with auto-cleanup" -ForegroundColor White
