# OceanBazar — full local dev stack WITHOUT Docker Desktop.
# Run from repo root (Admin PowerShell recommended for winget installs):
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup-native-windows.ps1
#
# After setup: npm run stack:start   (or stack:keep to respawn missing services)

param(
  [switch] $SkipWinget,
  [switch] $SkipNpmInstall,
  [switch] $Launch
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent

function Write-Step([string] $Msg) { Write-Host "`n[setup] $Msg" -ForegroundColor Cyan }
function Write-Ok([string] $Msg) { Write-Host "[setup] $Msg" -ForegroundColor Green }
function Write-Warn2([string] $Msg) { Write-Host "[setup] $Msg" -ForegroundColor Yellow }

function Test-TcpPort([string] $HostName, [int] $Port) {
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $iar = $c.BeginConnect($HostName, $Port, $null, $null)
    if (-not $iar.AsyncWaitHandle.WaitOne(2000, $false)) { $c.Close(); return $false }
    $c.EndConnect($iar)
    $c.Close()
    return $true
  } catch { return $false }
}

function Refresh-PathFromRegistry {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  if ($machine -or $user) {
    $env:Path = (@($machine, $user) | Where-Object { $_ }) -join ';'
  }
}

function Find-Exe([string] $Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $patterns = switch ($Name) {
    'node' { @('C:\Program Files\nodejs\node.exe') }
    'java' { @(
        'C:\Program Files\Microsoft\jdk-*\bin\java.exe',
        'C:\Program Files\Eclipse Adoptium\jdk-*\bin\java.exe'
      ) }
    'mvn' { @(
        'C:\Program Files\Apache\maven\bin\mvn.cmd',
        (Join-Path $Root '.dev\maven-win\apache-maven-3.9.6\bin\mvn.cmd')
      ) }
    'psql' { @('C:\Program Files\PostgreSQL\16\bin\psql.exe') }
    default { @() }
  }
  foreach ($pattern in $patterns) {
    $hit = Get-Item $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($hit) { return $hit.FullName }
  }
  return $null
}

function Ensure-WingetPackage([string] $Id, [string] $Label) {
  $q = winget list --id $Id --accept-source-agreements 2>&1 | Out-String
  if ($q -match [regex]::Escape($Id)) {
    Write-Ok "$Label already installed ($Id)"
    return
  }
  Write-Step "Installing $Label via winget ($Id)..."
  winget install -e --id $Id --accept-package-agreements --accept-source-agreements
  Refresh-PathFromRegistry
}

function Ensure-PortableMaven {
  $mavenDir = Join-Path $Root '.dev\maven-win'
  $mvnCmd = Join-Path $mavenDir 'apache-maven-3.9.6\bin\mvn.cmd'
  if (Test-Path $mvnCmd) {
    $env:Path = "$(Split-Path $mvnCmd -Parent);$env:Path"
    Write-Ok 'Portable Maven already present'
    return
  }
  $zipUrl = 'https://archive.apache.org/dist/maven/maven-3/3.9.6/binaries/apache-maven-3.9.6-bin.zip'
  $zipPath = Join-Path $mavenDir 'apache-maven-3.9.6-bin.zip'
  Write-Step 'Downloading portable Apache Maven 3.9.6...'
  New-Item -ItemType Directory -Force -Path $mavenDir | Out-Null
  Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing
  Expand-Archive -LiteralPath $zipPath -DestinationPath $mavenDir -Force
  Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
  if (-not (Test-Path $mvnCmd)) { throw "Maven extract failed: $mvnCmd" }
  $env:Path = "$(Split-Path $mvnCmd -Parent);$env:Path"
  Write-Ok "Maven ready at $mvnCmd"
}

function Get-NpmCmd {
  $node = Find-Exe 'node'
  if ($node) {
    $npmCmd = Join-Path (Split-Path $node -Parent) 'npm.cmd'
    if (Test-Path $npmCmd) { return $npmCmd }
  }
  $fallback = 'C:\Program Files\nodejs\npm.cmd'
  if (Test-Path $fallback) { return $fallback }
  throw 'npm.cmd not found. Install Node.js LTS and open a new terminal.'
}

Write-Step "OceanBazar native setup (no Docker)"
Write-Host "Repo: $Root"

if (-not $SkipWinget) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw 'winget is required. Install "App Installer" from the Microsoft Store, then re-run.'
  }
  Ensure-WingetPackage 'OpenJS.NodeJS.LTS' 'Node.js LTS'
  Ensure-WingetPackage 'Microsoft.OpenJDK.17' 'OpenJDK 17'
  Ensure-WingetPackage 'PostgreSQL.PostgreSQL.16' 'PostgreSQL 16'
  Ensure-PortableMaven
  Refresh-PathFromRegistry
}

Refresh-PathFromRegistry
$node = Find-Exe 'node'
if (-not $node -or $node -match 'cursor\\resources\\helpers') {
  $node = 'C:\Program Files\nodejs\node.exe'
}
$npm = Get-NpmCmd
$java = Find-Exe 'java'
$mvn = Find-Exe 'mvn'
$psql = Find-Exe 'psql'

if (-not $node) { throw 'node not found. Install Node.js LTS, open a NEW terminal, re-run this script.' }
if (-not $java) { throw 'java not found. Install OpenJDK 17, open a NEW terminal, re-run.' }
if (-not $mvn) {
  Ensure-PortableMaven
  $mvn = Find-Exe 'mvn'
}
if (-not $mvn) { throw 'mvn not found. Re-run setup or add Maven to PATH.' }

Write-Ok "node: $node"
Write-Ok "npm:  $npm"
Write-Ok "java: $java"
Write-Ok "mvn:  $mvn"

# ─── backend/.env (local, no Docker) ─────────────────────────────────────────
$envFile = Join-Path $Root 'backend\.env'
$envExample = Join-Path $Root 'backend\.env.example'
if (-not (Test-Path $envFile)) {
  Write-Step 'Creating backend\.env for native PostgreSQL (port 5432) + Redis (6399)...'
  if (-not (Test-Path $envExample)) { throw "Missing $envExample" }
  $content = Get-Content $envExample -Raw
  $localDb = 'postgresql://oceanbazar:secret@127.0.0.1:5432/oceanbazar?schema=public'
  $content = $content -replace '(?m)^DATABASE_URL=.*$', "DATABASE_URL=`"$localDb`""
  if ($content -notmatch '(?m)^DIRECT_URL=') {
    $content = $content -replace '(?m)^DATABASE_URL=.*$', "`$0`nDIRECT_URL=`"$localDb`""
  } else {
    $content = $content -replace '(?m)^DIRECT_URL=.*$', "DIRECT_URL=`"$localDb`""
  }
  $content = $content -replace '(?m)^REDIS_URL=.*$', 'REDIS_URL=redis://127.0.0.1:6399'
  $content = $content -replace '(?m)^JAVA_API_URL=.*$', 'JAVA_API_URL=http://localhost:8000'
  $content = $content -replace '(?m)^PUBLIC_BASE_URL=.*$', 'PUBLIC_BASE_URL=http://localhost:8000'
  Set-Content -Path $envFile -Value $content -Encoding UTF8
  Write-Ok 'Wrote backend\.env'
} else {
  Write-Warn2 'backend\.env already exists — not overwritten'
}

# ─── PostgreSQL ───────────────────────────────────────────────────────────────
$pgPort = if (Test-TcpPort '127.0.0.1' 5432) { 5432 } elseif (Test-TcpPort '127.0.0.1' 5433) { 5433 } else { $null }
if (-not $pgPort) {
  Write-Warn2 @'
PostgreSQL is not listening on 5432 or 5433.

After installing PostgreSQL 16:
  1. Start service "postgresql-x64-16" in services.msc (or reboot).
  2. Run as superuser (replace postgres password if prompted):
       psql -U postgres -f scripts/sql/create_oceanbazar_local.sql
  3. If you use port 5433, edit backend\.env DATABASE_URL and DIRECT_URL to :5433
  4. Re-run: powershell -ExecutionPolicy Bypass -File .\scripts\setup-native-windows.ps1

'@
} else {
  Write-Ok "PostgreSQL reachable on port $pgPort"
  if ($pgPort -ne 5432) {
    Write-Warn2 'Using non-default port — ensure backend\.env DATABASE_URL matches'
  }
  if ($psql -and $env:PGPASSWORD) {
    $sqlFile = Join-Path $Root 'scripts\sql\create_oceanbazar_local.sql'
    Write-Step 'Creating role/database oceanbazar (errors if already exist are OK)...'
    & $psql -h 127.0.0.1 -p $pgPort -U postgres -f $sqlFile 2>&1 | Out-Host
  }
}

# ─── Redis (portable, no Docker) ─────────────────────────────────────────────
Write-Step 'Starting portable Redis on 6399...'
& powershell -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\start-redis-windows.ps1')

# ─── npm dependencies + Prisma ───────────────────────────────────────────────
if (-not $SkipNpmInstall) {
  foreach ($dir in @('backend', 'frontend', 'admin-frontend-react')) {
    $pkg = Join-Path $Root "$dir\package.json"
    if (-not (Test-Path $pkg)) { continue }
    Write-Step "npm install in $dir..."
    Push-Location (Join-Path $Root $dir)
    if ($dir -eq 'frontend') {
      & $npm install --legacy-peer-deps
    } else {
      & $npm install
    }
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "npm install failed in $dir" }
    Pop-Location
  }

  if ($pgPort) {
    Write-Step 'Flyway (Spring Boot) — creates products/catalog tables before Prisma...'
    & powershell -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\run-flyway-via-spring.ps1')

    Write-Step 'Prisma migrate deploy...'
    Push-Location (Join-Path $Root 'backend')
    & $npm exec prisma migrate deploy
  if ($LASTEXITCODE -ne 0) {
      Pop-Location
      throw 'prisma migrate deploy failed — fix DATABASE_URL / Postgres, then re-run'
    }
    Write-Step 'Prisma seed (admin user)...'
    & $npm exec prisma db seed
    Pop-Location
  }
}

Write-Host @'

══════════════════════════════════════════════════════════════
  Native setup pass complete.

  Start all apps (four PowerShell windows):
    npm.cmd run stack:start

  Or prepare DB only, then start manually:
    npm run stack:prepare
    npm run stack:keep

  URLs:
    Storefront  http://localhost:3000
    Admin CRM   http://localhost:5173
    Node BFF    http://localhost:4000
    Java API    http://localhost:8000

  Admin login (after seed): rjsuvosa / rjsuvosa420

  Docker Desktop is NOT required. Enable virtualization only if you
  want Docker later (BIOS: Intel VT-x / AMD-V, then Windows Features:
  Virtual Machine Platform + Windows Subsystem for Linux).
══════════════════════════════════════════════════════════════

'@ -ForegroundColor White

if ($Launch) {
  Push-Location $Root
  & (Get-NpmCmd) run stack:start
  Pop-Location
}
