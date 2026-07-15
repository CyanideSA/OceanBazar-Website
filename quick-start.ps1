# Quick start - assumes dependencies are already cached
param(
    [string[]]$Only = @()
)

$ErrorActionPreference = "Stop"

$base = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }

# Kill any existing processes on ports
function Clear-Port($port) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        Start-Sleep 1
    }
}

Write-Host "Clearing ports..." -ForegroundColor Gray
Clear-Port 8000
Clear-Port 3000
Clear-Port 5173

# Start Backend (in background)
if (-not $Only -or 'backend' -in $Only) {
    Write-Host "Starting Backend..." -ForegroundColor Green
    $backend = Start-Process -FilePath "mvn" -ArgumentList "spring-boot:run", "-f", "$base\backend-java\pom.xml", "-DskipTests" -WorkingDirectory "$base\backend-java" -PassThru -WindowStyle Hidden
}

# Wait for backend
if (-not $Only -or 'backend' -in $Only) {
    Write-Host "Waiting for backend (port 8000)..." -ForegroundColor Gray -NoNewline
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep 1
        $test = Test-NetConnection -ComputerName localhost -Port 8000 -WarningAction SilentlyContinue
        if ($test.TcpTestSucceeded) {
            Write-Host " READY!" -ForegroundColor Green
            break
        }
        Write-Host "." -ForegroundColor Gray -NoNewline
    }
    Write-Host ""
}

# Start Storefront
if (-not $Only -or 'storefront' -in $Only) {
    Write-Host "Starting Storefront..." -ForegroundColor Green
    # Clear .next cache
    if (Test-Path "$base\frontend\.next") {
        Remove-Item "$base\frontend\.next" -Recurse -Force -ErrorAction SilentlyContinue
    }
    $env:PORT = "3000"
    $storefront = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory "$base\frontend" -PassThru -WindowStyle Hidden
    Start-Sleep 8
}

# Start Admin
if (-not $Only -or 'admin' -in $Only) {
    Write-Host "Starting Admin CRM..." -ForegroundColor Green
    $admin = Start-Process -FilePath "npm" -ArgumentList "run", "dev", "--", "--port", "5173" -WorkingDirectory "$base\admin-frontend-react" -PassThru -WindowStyle Hidden
    Start-Sleep 5
}

Write-Host "`n=== OceanBazar Running ===" -ForegroundColor Cyan
Write-Host "Backend:    https://localhost:8000" -ForegroundColor White
Write-Host "Storefront: https://localhost:3000" -ForegroundColor White
Write-Host "Admin CRM:  https://localhost:5173" -ForegroundColor White
Write-Host ""
Write-Host "Press Enter to stop all services..." -ForegroundColor Yellow
$null = Read-Host

# Cleanup
Write-Host "Stopping services..." -ForegroundColor Gray
if ($backend -and -not $backend.HasExited) { Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue }
if ($storefront -and -not $storefront.HasExited) { Stop-Process -Id $storefront.Id -Force -ErrorAction SilentlyContinue }
if ($admin -and -not $admin.HasExited) { Stop-Process -Id $admin.Id -Force -ErrorAction SilentlyContinue }

Clear-Port 8000
Clear-Port 3000
Clear-Port 5173

Write-Host "All services stopped." -ForegroundColor Green
