# OceanBazar FAST Startup Script
# Uses pre-built JAR for Java and runs services concurrently

$ErrorActionPreference = "Stop"
$base = "c:\Users\akand\Desktop\Antigravity\OCEANBAZAR Website"

Write-Host "=== OceanBazar Fast Startup ===" -ForegroundColor Cyan

# 1. Kill existing processes on ports
function Clear-Port($port) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        Write-Host "  Clearing port $port..." -ForegroundColor Gray
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        Start-Sleep 1
    }
}

Clear-Port 8000
Clear-Port 4000
Clear-Port 3000
Clear-Port 5173

# 2. Start Java Backend (Core API) - Port 8000
Write-Host "`n[1/4] Starting Java Core API..." -ForegroundColor Yellow
$jarPath = "$base\backend-java\target\backend-java-0.0.1-SNAPSHOT.jar"
if (-not (Test-Path $jarPath)) {
    Write-Host "  JAR not found! Building first..." -ForegroundColor Red
    Set-Location "$base\backend-java"
    mvn package -DskipTests
}
$javaProc = Start-Process -FilePath "java" -ArgumentList "-jar `"$jarPath`"" -WorkingDirectory "$base\backend-java" -PassThru -WindowStyle Hidden -RedirectStandardOutput "$base\backend-java.log" -RedirectStandardError "$base\backend-java.err"

# 3. Wait for port 8000
Write-Host "  Waiting for port 8000..." -ForegroundColor Gray -NoNewline
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep 1
    $test = Test-NetConnection -ComputerName 127.0.0.1 -Port 8000 -WarningAction SilentlyContinue
    if ($test.TcpTestSucceeded) {
        Write-Host " READY!" -ForegroundColor Green
        break
    }
    Write-Host "." -ForegroundColor Gray -NoNewline
}

# 4. Start Node BFF - Port 4000
Write-Host "`n[2/4] Starting Node BFF..." -ForegroundColor Yellow
$bffProc = Start-Process -FilePath "cmd" -ArgumentList "/c npm run dev" -WorkingDirectory "$base\backend" -PassThru -WindowStyle Hidden -RedirectStandardOutput "$base\backend-bff.log" -RedirectStandardError "$base\backend-bff.err"

# 5. Start Storefront - Port 3000
Write-Host "`n[3/4] Starting Storefront..." -ForegroundColor Yellow
$env:PORT = "3000"
$webProc = Start-Process -FilePath "cmd" -ArgumentList "/c npm run dev" -WorkingDirectory "$base\frontend" -PassThru -WindowStyle Hidden -RedirectStandardOutput "$base\frontend.log" -RedirectStandardError "$base\frontend.err"

# 6. Start Admin CRM - Port 5173
Write-Host "`n[4/4] Starting Admin CRM..." -ForegroundColor Yellow
$adminProc = Start-Process -FilePath "cmd" -ArgumentList "/c npm run dev -- --port 5173" -WorkingDirectory "$base\admin-frontend-react" -PassThru -WindowStyle Hidden -RedirectStandardOutput "$base\admin.log" -RedirectStandardError "$base\admin.err"

Write-Host "`n=== All Services Started! ===" -ForegroundColor Green
Write-Host "Storefront: http://127.0.0.1:3000" -ForegroundColor White
Write-Host "Admin CRM:  http://127.0.0.1:5173" -ForegroundColor White
Write-Host "Node BFF:   http://127.0.0.1:4000" -ForegroundColor White
Write-Host "Core API:   http://127.0.0.1:8000" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C in this terminal to keep them running in background,"
Write-Host "or press Enter to stop all services." -ForegroundColor Yellow

$null = Read-Host

Write-Host "`nStopping all services..." -ForegroundColor Gray
Stop-Process -Id $javaProc.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Id $bffProc.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Id $webProc.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Id $adminProc.Id -Force -ErrorAction SilentlyContinue

Write-Host "Done." -ForegroundColor Green
