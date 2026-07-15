# Run as Administrator (right-click PowerShell -> Run as administrator):
#   powershell -ExecutionPolicy Bypass -File .\scripts\fix-recreate-oceanbazar-db.ps1
#
# Recreates the oceanbazar database after a failed reset. Uses temporary trust auth on localhost.

$ErrorActionPreference = 'Stop'
$hba = 'C:\Program Files\PostgreSQL\16\data\pg_hba.conf'
$psql = 'C:\Program Files\PostgreSQL\16\bin\psql.exe'
$service = 'postgresql-x64-16'

if (-not (Test-Path $hba)) { throw "PostgreSQL 16 not found at $hba" }

$bak = "$hba.bak-oceanbazar-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $hba $bak -Force
Write-Host "[fix-db] Backed up pg_hba.conf to $bak"

$content = Get-Content $hba
$new = $content | ForEach-Object {
  if ($_ -match '^\s*host\s+all\s+all\s+127\.0\.0\.1') {
    'host    all             all             127.0.0.1/32            trust'
  } else { $_ }
}
Set-Content -Path $hba -Value $new -Encoding ascii

Restart-Service $service -Force
Start-Sleep -Seconds 3

& $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS oceanbazar WITH (FORCE);"
& $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE oceanbazar OWNER oceanbazar;"
& $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -c "GRANT ALL PRIVILEGES ON DATABASE oceanbazar TO oceanbazar;"

Copy-Item $bak $hba -Force
Restart-Service $service -Force

Write-Host "[fix-db] Database oceanbazar recreated. Next (repo root):"
Write-Host "  cd backend"
Write-Host "  npx prisma migrate deploy"
Write-Host "  npx prisma db seed"
Write-Host "  cd ..\backend-java"
Write-Host "  mvn spring-boot:run `"-Dspring-boot.run.profiles=dockerless`" `"-Dspring-boot.run.jvmArguments=-Dspring.datasource.url=jdbc:postgresql://127.0.0.1:5432/oceanbazar`""
