# Bring up OceanBazar local stack for follow-up testing (products, cart, checkout).
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\ops\local-followup-ready.ps1

$ErrorActionPreference = 'Continue'
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

function Test-Port([int]$Port) {
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $c.Connect('127.0.0.1', $Port)
    $c.Close()
    return $true
  } catch { return $false }
}

function Wait-Port([int]$Port, [int]$Seconds = 90) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Port $Port) { return $true }
    Start-Sleep -Seconds 2
  }
  return $false
}

Write-Host "`n=== OceanBazar local follow-up setup ===" -ForegroundColor Cyan

# 1) Docker backend
Push-Location $Root
docker compose up -d postgres redis java_api api 2>&1 | Out-Null
Pop-Location

# 2) Storefront (3000)
if (-not (Test-Port 3000)) {
  Write-Host "Starting storefront on :3000..." -ForegroundColor Yellow
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd `"$Root\frontend`"; npm run dev"
  Wait-Port 3000 120 | Out-Null
}

# 3) Admin CRM (5173)
if (-not (Test-Port 5173)) {
  Write-Host "Starting admin CRM on :5173..." -ForegroundColor Yellow
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd `"$Root\admin-frontend-react`"; npm run dev"
  Wait-Port 5173 60 | Out-Null
}

# 4) Health checks
$results = @()
try {
  $h = Invoke-RestMethod -Uri 'http://127.0.0.1:4401/api/health' -TimeoutSec 10
  $results += "BFF API     : OK ($($h.status))"
} catch { $results += "BFF API     : FAIL" }

try {
  $p = Invoke-RestMethod -Uri 'http://127.0.0.1:4401/api/products?limit=1' -TimeoutSec 20
  $total = if ($p.total) { $p.total } elseif ($p.products) { $p.products.Count } else { '?' }
  $results += "Products    : OK (sample total=$total)"
} catch { $results += "Products    : FAIL" }

$results += "Storefront  : $(if (Test-Port 3000) { 'OK http://127.0.0.1:3000' } else { 'NOT LISTENING' })"
$results += "Admin CRM   : $(if (Test-Port 5173) { 'OK http://127.0.0.1:5173' } else { 'NOT LISTENING' })"

Write-Host ""
$results | ForEach-Object { Write-Host "  $_" }

Write-Host @"

--- Follow-up test flow ---
1. Products   : http://127.0.0.1:3000/bn/products
2. Login      : http://127.0.0.1:3000/bn/auth/login  (Password tab)
3. Add to cart: open any product -> কার্টে যোগ করুন
4. Checkout   : http://127.0.0.1:3000/bn/checkout

Test storefront user (if seeded):
  e2e.storefront@oceanbazar.test / Test@1234
  or browser.test@oceanbazar.test / Test@1234

Admin CRM:
  rjsuvosa / rjsuvosa420

Smoke test:
  node scripts/ops/staging-smoke.mjs http://127.0.0.1:4401

"@ -ForegroundColor Green
