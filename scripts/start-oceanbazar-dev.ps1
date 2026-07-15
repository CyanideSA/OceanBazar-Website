# Start full OceanBazar dev stack (4 terminals). Run after DB is ready.
#   powershell -ExecutionPolicy Bypass -File .\scripts\start-oceanbazar-dev.ps1

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
$mvnHome = Join-Path $env:LOCALAPPDATA 'Tools\apache-maven-3.9.6'
$pgPort = 5432
if (Test-Path "$Root\backend\.env") {
  $ln = Get-Content "$Root\backend\.env" | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
  if ($ln -match '@127\.0\.0\.1:(\d+)/') { $pgPort = [int]$Matches[1] }
}

$psql = 'C:\Program Files\PostgreSQL\16\bin\psql.exe'
if (Test-Path $psql) {
  $env:PGPASSWORD = 'secret'
  & $psql -h 127.0.0.1 -p $pgPort -U oceanbazar -d oceanbazar -tAc 'SELECT 1' 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host @"

Database oceanbazar is not reachable on 127.0.0.1:$pgPort.
Run as Administrator first:
  powershell -ExecutionPolicy Bypass -File .\scripts\fix-recreate-oceanbazar-db.ps1
Then:
  cd backend && npx prisma migrate deploy && npx prisma db seed

"@
    exit 1
  }
}

$redis6399 = $false
try {
  $c = New-Object System.Net.Sockets.TcpClient
  $c.Connect('127.0.0.1', 6399)
  $redis6399 = $true
  $c.Close()
} catch {}

$javaProfile = if ($redis6399) { 'default' } else { 'dockerless' }
$jdbc = "jdbc:postgresql://127.0.0.1:${pgPort}/oceanbazar"
$mvnBin = if (Test-Path "$mvnHome\bin") { "$mvnHome\bin;" } else { '' }

Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd `"$Root\backend-java`"; `$env:Path='$mvnBin' + `$env:Path; mvn spring-boot:run `"-Dspring-boot.run.profiles=$javaProfile`" `"-Dspring-boot.run.jvmArguments=-Dspring.datasource.url=$jdbc`""
Start-Sleep -Seconds 3
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd `"$Root\backend`"; npm run dev"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd `"$Root\frontend`"; npm run dev"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd `"$Root\admin-frontend-react`"; npm run dev"

Write-Host @"

Started 4 terminals (Java profile: $javaProfile).
  Storefront: http://127.0.0.1:3000
  Admin CRM:  http://127.0.0.1:5173
  BFF:        http://127.0.0.1:4000/api/health
  Java API:   http://127.0.0.1:8000/api/health  (wait ~60s after Java window opens)

"@
