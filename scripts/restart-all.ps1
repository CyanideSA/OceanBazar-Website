$base = "c:\Users\akand\Desktop\Antigravity\OCEANBAZAR Website"

Write-Host "=== Stopping all OceanBazar services ===" -ForegroundColor Cyan

foreach ($port in @(8000, 4000, 3000, 5173)) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        Write-Host "  Killing port $port (PID $($conn.OwningProcess))" -ForegroundColor Gray
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

Start-Sleep 3

Write-Host "`n[1/4] Starting Java Core API (port 8000)..." -ForegroundColor Yellow
Start-Process -FilePath "java" -ArgumentList "-jar `"$base\backend-java\target\backend-java-0.0.1-SNAPSHOT.jar`"" -WorkingDirectory "$base\backend-java" -WindowStyle Hidden -RedirectStandardOutput "$base\backend-java.log" -RedirectStandardError "$base\backend-java.err"

Write-Host "  Waiting for port 8000..." -NoNewline -ForegroundColor Gray
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep 2
    $t = Test-NetConnection -ComputerName 127.0.0.1 -Port 8000 -WarningAction SilentlyContinue
    if ($t.TcpTestSucceeded) { Write-Host " READY" -ForegroundColor Green; break }
    Write-Host "." -NoNewline -ForegroundColor Gray
}

Write-Host "`n[2/4] Starting Node BFF (port 4000)..." -ForegroundColor Yellow
Start-Process -FilePath "cmd" -ArgumentList "/c npm run dev" -WorkingDirectory "$base\backend" -WindowStyle Hidden -RedirectStandardOutput "$base\backend-bff.log" -RedirectStandardError "$base\backend-bff.err"

Write-Host "[3/4] Starting Storefront (port 3000)..." -ForegroundColor Yellow
$env:PORT = "3000"
Start-Process -FilePath "cmd" -ArgumentList "/c npm run dev" -WorkingDirectory "$base\frontend" -WindowStyle Hidden -RedirectStandardOutput "$base\frontend.log" -RedirectStandardError "$base\frontend.err"

Write-Host "[4/4] Starting Admin CRM (port 5173)..." -ForegroundColor Yellow
Start-Process -FilePath "cmd" -ArgumentList "/c npm run dev -- --port 5173" -WorkingDirectory "$base\admin-frontend-react" -WindowStyle Hidden -RedirectStandardOutput "$base\admin.log" -RedirectStandardError "$base\admin.err"

Write-Host "`n=== All services started ===" -ForegroundColor Green
Write-Host "  Storefront : http://127.0.0.1:3000"
Write-Host "  Admin CRM  : http://127.0.0.1:5173"
Write-Host "  Node BFF   : http://127.0.0.1:4000"
Write-Host "  Java API   : http://127.0.0.1:8000"
