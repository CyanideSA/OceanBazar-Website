# Apply Java/Flyway schema by starting Spring Boot briefly (products table, etc.).
# Run from repo root after Postgres + oceanbazar DB exist:
#   powershell -ExecutionPolicy Bypass -File .\scripts\run-flyway-via-spring.ps1

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
$javaDir = Join-Path $Root 'backend-java'
$mavenDir = Join-Path $Root '.dev\maven-win'
$mvn = Join-Path $mavenDir 'apache-maven-3.9.6\bin\mvn.cmd'

if (-not (Test-Path $mvn)) {
  Write-Host '[flyway] Downloading portable Maven...'
  New-Item -ItemType Directory -Force -Path $mavenDir | Out-Null
  $zip = Join-Path $mavenDir 'maven.zip'
  Invoke-WebRequest -Uri 'https://archive.apache.org/dist/maven/maven-3/3.9.6/binaries/apache-maven-3.9.6-bin.zip' -OutFile $zip -UseBasicParsing
  Expand-Archive -LiteralPath $zip -DestinationPath $mavenDir -Force
  Remove-Item $zip -Force
}

$jdbc = 'jdbc:postgresql://127.0.0.1:5432/oceanbazar'
Write-Host '[flyway] Starting Spring Boot (Flyway runs on startup)...'
$proc = Start-Process -FilePath $mvn -ArgumentList @(
  'spring-boot:run',
  "-Dspring-boot.run.jvmArguments=-Dspring.datasource.url=$jdbc",
  '-DskipTests'
) -WorkingDirectory $javaDir -PassThru -WindowStyle Hidden

$deadline = (Get-Date).AddMinutes(5)
$ready = $false
while ((Get-Date) -lt $deadline) {
  Start-Sleep 3
  try {
    $t = New-Object System.Net.Sockets.TcpClient
    $iar = $t.BeginConnect('127.0.0.1', 8000, $null, $null)
    if ($iar.AsyncWaitHandle.WaitOne(1000, $false)) {
      $t.EndConnect($iar)
      $t.Close()
      $ready = $true
      break
    }
    $t.Close()
  } catch {}
  if ($proc.HasExited) { break }
}

if ($ready) {
  Write-Host '[flyway] Java API up on :8000 — Flyway migrations applied.'
} else {
  Write-Warning '[flyway] Timed out waiting for :8000. Check backend-java logs; Flyway may still have run.'
}

if (-not $proc.HasExited) {
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  Write-Host '[flyway] Stopped temporary Spring Boot process.'
}
