# OceanBazar Diagnostic Tool
$ErrorActionPreference = "SilentlyContinue"

Write-Host "=== OceanBazar System Diagnostics ===" -ForegroundColor Cyan
Write-Host ""

# Check Java
Write-Host "[Java]" -ForegroundColor Yellow
$javaVersion = & java -version 2>&1 | Select-String -Pattern "version" | Select-Object -First 1
if ($javaVersion) {
    Write-Host "  $javaVersion" -ForegroundColor Green
} else {
    Write-Host "  NOT FOUND - Install Java 17+" -ForegroundColor Red
}

# Check Maven
Write-Host "`n[Maven]" -ForegroundColor Yellow
$mvnVersion = & mvn -version 2>&1 | Select-Object -First 1
if ($mvnVersion) {
    Write-Host "  $mvnVersion" -ForegroundColor Green
} else {
    Write-Host "  NOT FOUND - Install Maven or use IntelliJ bundled" -ForegroundColor Red
}

# Check Node
Write-Host "`n[Node.js]" -ForegroundColor Yellow
$nodeVersion = & node --version 2>&1
if ($nodeVersion) {
    Write-Host "  Node: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "  NOT FOUND - Install Node.js 18+" -ForegroundColor Red
}

$npmVersion = & npm --version 2>&1
if ($npmVersion) {
    Write-Host "  NPM: $npmVersion" -ForegroundColor Green
}

# Check PostgreSQL
Write-Host "`n[PostgreSQL]" -ForegroundColor Yellow
$pgConn = Test-NetConnection -ComputerName localhost -Port 5433 -WarningAction SilentlyContinue
if ($pgConn.TcpTestSucceeded) {
    Write-Host "  PostgreSQL: RUNNING on port 5433" -ForegroundColor Green
} else {
    Write-Host "  PostgreSQL: NOT RESPONDING on port 5433" -ForegroundColor Red
    Write-Host "  Make sure PostgreSQL service is running" -ForegroundColor Gray
}

# Check Redis
Write-Host "`n[Redis]" -ForegroundColor Yellow
$redisConn = Test-NetConnection -ComputerName localhost -Port 6379 -WarningAction SilentlyContinue
if ($redisConn.TcpTestSucceeded) {
    Write-Host "  Redis: RUNNING on port 6379" -ForegroundColor Green
} else {
    Write-Host "  Redis: NOT RESPONDING on port 6379" -ForegroundColor Yellow
    Write-Host "  (Optional - some features may be limited)" -ForegroundColor Gray
}

# Check port availability
Write-Host "`n[Port Status]" -ForegroundColor Yellow
$ports = @(8001, 3000, 5173, 3001, 5174)
foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        $procName = if ($proc) { $proc.ProcessName } else { "unknown" }
        Write-Host "  Port $port : IN USE by $procName (PID: $($conn.OwningProcess))" -ForegroundColor Yellow
    } else {
        Write-Host "  Port $port : FREE" -ForegroundColor Green
    }
}

# Check disk space
Write-Host "`n[Disk Space]" -ForegroundColor Yellow
$drive = Get-PSDrive C
$freeGB = [math]::Round($drive.Free / 1GB, 2)
$totalGB = [math]::Round(($drive.Free + $drive.Used) / 1GB, 2)
$percentFree = [math]::Round(($drive.Free / ($drive.Free + $drive.Used)) * 100, 1)

if ($percentFree -lt 10) {
    Write-Host "  C: Drive - $freeGB GB free of $totalGB GB ($percentFree%)" -ForegroundColor Red
    Write-Host "  WARNING: Low disk space may cause startup failures!" -ForegroundColor Red
} else {
    Write-Host "  C: Drive - $freeGB GB free of $totalGB GB ($percentFree%)" -ForegroundColor Green
}

# Check project structure
Write-Host "`n[Project Structure]" -ForegroundColor Yellow
$base = "c:\Users\akand\Desktop\Antigravity\OCEANBAZAR Website"
$folders = @(
    "backend-java\pom.xml",
    "frontend\package.json",
    "admin-frontend-react\package.json"
)

foreach ($folder in $folders) {
    $path = Join-Path $base $folder
    if (Test-Path $path) {
        Write-Host "  $folder : OK" -ForegroundColor Green
    } else {
        Write-Host "  $folder : MISSING" -ForegroundColor Red
    }
}

Write-Host "`n=== Diagnostics Complete ===" -ForegroundColor Cyan
