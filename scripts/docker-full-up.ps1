# Start full OceanBazar stack in Docker.
#
# Usage (repo root):
#   powershell -ExecutionPolicy Bypass -File .\scripts\docker-full-up.ps1
#   powershell -ExecutionPolicy Bypass -File .\scripts\docker-full-up.ps1 -Build
#   powershell -ExecutionPolicy Bypass -File .\scripts\docker-full-up.ps1 -RebuildNoCache   # fresh images (fixes stale storefront/admin UI in Docker)
#   powershell -ExecutionPolicy Bypass -File .\scripts\docker-full-up.ps1 -LiveDev           # bind-mount storefront + admin (editor changes without rebuild)
#   powershell -ExecutionPolicy Bypass -File .\scripts\docker-full-up.ps1 -LiveDev -Build
#
# -Repair        Gentle: start service + Docker Desktop + wake docker-desktop WSL (no wsl --shutdown).
# -RepairDeep    Aggressive: wsl --shutdown + restart com.docker.service (use only if gentle repair fails).

param(
  [switch] $Build,
  [switch] $RebuildNoCache,
  [switch] $Repair,
  [switch] $RepairDeep,
  [switch] $RepairOnly,
  [switch] $LiveDev
)

$ErrorActionPreference = 'Continue'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

function Get-DockerComposeFilePrefixArgs {
  $prefix = @('compose', '-f', 'docker-compose.yml')
  if ($LiveDev) {
    $livePath = Join-Path $Root 'docker-compose.live-dev.yml'
    if (-not (Test-Path $livePath)) {
      Write-Host 'docker-full-up: -LiveDev requires docker-compose.live-dev.yml in repo root.' -ForegroundColor Red
      exit 1
    }
    $prefix += @('-f', 'docker-compose.live-dev.yml')
  }
  return $prefix
}

if ($LiveDev) {
  Write-Host 'docker-full-up: Live dev - storefront + admin bind-mount repo files (npm dev inside containers). Use npm run docker:live.'
}

$script:DdUiRestartCount = 0
$script:LastDdUiRestart = $null

if ($env:DOCKER_HOST) {
  Write-Host ('docker-full-up: Removing DOCKER_HOST for this session (was: {0}). Use Docker contexts instead.' -f $env:DOCKER_HOST)
  Remove-Item -Path 'Env:DOCKER_HOST' -ErrorAction SilentlyContinue
}

function Test-DockerPipe([string] $PipeName) {
  return (Test-Path -LiteralPath "\\.\pipe\$PipeName")
}

# Stream docker through this only when you need exit code alone. If docker stdout is not redirected,
# PowerShell captures it as function output and callers get [Object[]] instead of an int exit code.
function Invoke-DockerQuiet {
  param([string[]] $CliArgs)

  $null = & docker @CliArgs 2>$null
  return [int]$LASTEXITCODE
}

function Test-DockerInfoOk {
  $exit = Invoke-DockerQuiet -CliArgs @('info')
  return ($exit -eq 0)
}

function Get-CurrentDockerContextLabel {
  $out = & docker context show 2>$null
  if ($LASTEXITCODE -ne 0) { return 'unknown' }
  $line = if ($out -is [array]) { $out[0] } else { $out }
  return "$line".Trim()
}

function Wake-DockerEngineWsl {
  # After wsl --shutdown or service restarts, the docker-desktop distro must run before npipe appears.
  # Do not use Start-Process -WindowStyle with -NoNewWindow (PowerShell rejects that combination).
  $distros = @('docker-desktop')
  foreach ($d in $distros) {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    $null = & wsl.exe -d $d -e sh -c 'exit 0' 2>$null
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prevEap
    if ($code -eq 0) {
      Write-Host ('docker-full-up: WSL distro "{0}" is up (helps engine pipes).' -f $d)
      return $true
    }
  }
  return $false
}

function Restore-WorkingDockerContext {
  Ensure-ComDockerService

  $envCtx = $env:DOCKER_CONTEXT
  if ($envCtx) {
    $null = Invoke-DockerQuiet -CliArgs @('context', 'use', $envCtx)
    if (Test-DockerInfoOk) { return $true }
    Write-Host ('docker-full-up: DOCKER_CONTEXT={0} is not reachable; trying desktop-linux / default.' -f $envCtx)
    Remove-Item -Path 'Env:DOCKER_CONTEXT' -ErrorAction SilentlyContinue
  }

  $tryOrder = @()
  if (Test-DockerPipe 'dockerDesktopLinuxEngine') { $tryOrder += 'desktop-linux' }
  if (Test-DockerPipe 'docker_engine') { $tryOrder += 'default' }
  foreach ($c in @('desktop-linux', 'default')) {
    if ($tryOrder -notcontains $c) { $tryOrder += $c }
  }

  foreach ($c in $tryOrder) {
    $null = Invoke-DockerQuiet -CliArgs @('context', 'use', $c)
    if (Test-DockerInfoOk) { return $true }
  }
  return $false
}

function Test-DockerEngineStableProbe {
  param([int] $Passes = 3, [int] $DelaySec = 3)

  for ($i = 0; $i -lt $Passes; $i++) {
    if (-not (Test-DockerInfoOk)) { return $false }
    if ($i -lt $Passes - 1) { Start-Sleep -Seconds $DelaySec }
  }
  return $true
}

function Show-DockerHubDnsHelp {
  Write-Host ''
  Write-Host '=== Docker cannot resolve registry-1.docker.io (Docker Hub) ===' -ForegroundColor Red
  Write-Host 'Docker Desktop: Settings - Docker Engine - merge into JSON, then Apply & Restart:'
  Write-Host '  "dns": ["8.8.8.8", "8.8.4.4"]'
  Write-Host 'If you use VPN or corporate DNS, align Docker with that network or disable split DNS.'
  Write-Host ''
}

function Merge-WslMirroredNetworkingForDockerHub {
  $path = Join-Path $env:USERPROFILE '.wslconfig'
  if (Test-Path $path) {
    $t = Get-Content $path -Raw
    if ($t -match '(?m)^\s*networkingMode\s*=\s*mirrored\s*$') { return $false }
  }
  if (-not (Test-Path $path)) {
    Set-Content -Path $path -Value "[wsl2]`r`nnetworkingMode=mirrored`r`n" -Encoding ASCII
    return $true
  }
  $t = Get-Content $path -Raw
  if ($t -match '(?m)\[wsl2\]') {
    $t = $t.TrimEnd() + "`r`nnetworkingMode=mirrored`r`n"
  } else {
    $t = $t.TrimEnd() + "`r`n[wsl2]`r`nnetworkingMode=mirrored`r`n"
  }
  Set-Content -Path $path -Value $t -Encoding ASCII
  return $true
}

function Invoke-DockerHubPreflight {
  Write-Host 'docker-full-up: Preflight: docker pull alpine:3.20 (validates Docker Hub DNS from engine)...'
  $pull = Invoke-DockerQuiet -CliArgs @('pull', 'alpine:3.20')
  if ($pull -eq 0) { return }

  Show-DockerHubDnsHelp

  if ($Repair -or $RepairDeep) {
    Write-Host 'docker-full-up: -Repair: updating ~\.wslconfig with networkingMode=mirrored (often fixes Hub DNS on Win11)...'
    if (Merge-WslMirroredNetworkingForDockerHub) {
      Write-Host 'docker-full-up: Running wsl --shutdown so WSL picks up the change...'
      wsl.exe --shutdown 2>$null
      Start-Sleep -Seconds 10
      Ensure-ComDockerService
      $dd = Get-DockerDesktopPath
      if ($dd -and -not (Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue)) {
        Start-Process -FilePath $dd
        Start-Sleep -Seconds 25
      }
      Wake-DockerEngineWsl | Out-Null
      if (-not (Wait-DockerEngine -TimeoutSec 240)) {
        Write-Host 'docker-full-up: Engine did not return after WSL config change.' -ForegroundColor Red
        exit 1
      }
      Write-Host 'docker-full-up: Retrying alpine pull...'
      $pull2 = Invoke-DockerQuiet -CliArgs @('pull', 'alpine:3.20')
      if ($pull2 -eq 0) { return }
    }
  } else {
    Write-Host 'docker-full-up: Tip: run  npm run docker:full:repair-build  to apply the WSL mirrored-networking fix automatically.'
  }

  Write-Host 'docker-full-up: Still cannot pull base images; fix DNS (see above) then retry.' -ForegroundColor Red
  exit 1
}

function Get-DockerDesktopPath {
  $candidates = @(
    (Join-Path ${env:ProgramFiles} 'Docker\Docker\Docker Desktop.exe'),
    'C:\Program Files\Docker\Docker\Docker Desktop.exe'
  )
  foreach ($p in $candidates) {
    if (Test-Path -LiteralPath $p) { return $p }
  }
  return $null
}

function Ensure-ComDockerService {
  $svc = Get-Service -Name 'com.docker.service' -ErrorAction SilentlyContinue
  if (-not $svc) {
    Write-Host 'docker-full-up: com.docker.service not found - is Docker Desktop installed?'
    return
  }
  if ($svc.Status -ne 'Running') {
    Write-Host ('docker-full-up: Starting com.docker.service (was: {0})...' -f $svc.Status)
    try {
      Start-Service -Name 'com.docker.service' -ErrorAction Stop
      Start-Sleep -Seconds 4
    } catch {
      Write-Host ('docker-full-up: Could not start service (try Admin PowerShell once): {0}' -f $_.Exception.Message)
    }
  }
}

function Repair-DockerBackend {
  param([switch] $Deep)

  if ($Deep) {
    Write-Host 'docker-full-up: -RepairDeep: wsl --shutdown (pipes may take 1-2 min; prefer -Repair if this keeps failing)...'
    $null = wsl.exe --shutdown 2>&1
    Start-Sleep -Seconds 6
  } else {
    Write-Host 'docker-full-up: -Repair: gentle (no WSL shutdown) - starting service + Docker Desktop + WSL wake...'
  }

  Ensure-ComDockerService

  $svc = Get-Service -Name 'com.docker.service' -ErrorAction SilentlyContinue
  if ($Deep -and $svc -and $svc.Status -eq 'Running') {
    Write-Host 'docker-full-up: -RepairDeep: restarting com.docker.service...'
    try {
      Restart-Service -Name 'com.docker.service' -Force -ErrorAction Stop
      Start-Sleep -Seconds 10
    } catch {
      Write-Host ('docker-full-up: Restart-Service failed (try elevated PowerShell): {0}' -f $_.Exception.Message)
    }
  }

  $dd = Get-DockerDesktopPath
  if ($dd) {
    $running = Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue
    if (-not $running) {
      Write-Host 'docker-full-up: Launching Docker Desktop...'
      Start-Process -FilePath $dd
    } elseif ($Deep) {
      Write-Host 'docker-full-up: -RepairDeep: Docker Desktop already running.'
    }
  }

  Start-Sleep -Seconds 15
  $woken = Wake-DockerEngineWsl
  if (-not $woken) {
    Write-Host 'docker-full-up: Hint: if docker-desktop WSL distro is missing, open Docker Desktop / Settings / Resources / WSL integration.'
  }
  Start-Sleep -Seconds 8
}

function Restart-DockerDesktopUi {
  param([int] $MaxRestarts = 2)

  if ($script:DdUiRestartCount -ge $MaxRestarts) { return $false }
  $script:DdUiRestartCount++

  $dd = Get-DockerDesktopPath
  Write-Host 'docker-full-up: No engine pipes for a long time - restarting Docker Desktop UI once...'
  Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 5
  Ensure-ComDockerService
  if ($dd) { Start-Process -FilePath $dd }
  Start-Sleep -Seconds 25
  Wake-DockerEngineWsl | Out-Null
  return $true
}

function Test-IsDockerOwnedListenerProcess([int] $ProcessId) {
  if ($ProcessId -le 0) { return $false }
  try {
    $p = Get-Process -Id $ProcessId -ErrorAction Stop
  } catch {
    return $false
  }
  $skip = @(
    'docker-proxy',
    'com.docker.backend',
    'Docker Desktop',
    'vpnkit',
    'wslrelay'
  )
  if ($skip -contains $p.ProcessName) { return $true }
  try {
    $path = $p.Path
    if ($path) {
      $dockerRoot = Join-Path ${env:ProgramFiles} 'Docker'
      if ($path.StartsWith($dockerRoot, [StringComparison]::OrdinalIgnoreCase)) { return $true }
    }
  } catch { }
  return $false
}

function Assert-DockerEngineReady {
  param([int] $Attempts = 15, [int] $SleepSec = 2)

  for ($i = 0; $i -lt $Attempts; $i++) {
    if ((Restore-WorkingDockerContext) -and (Test-DockerInfoOk)) { return $true }
    Start-Sleep -Seconds $SleepSec
  }
  return $false
}

function Wait-DockerEngine {
  param([int] $TimeoutSec = 600)

  Ensure-ComDockerService

  $dd = Get-DockerDesktopPath
  $launchedDd = $false
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $waitStart = Get-Date
  $lastProgressMsg = Get-Date
  $lastWake = [DateTime]::MinValue

  while ((Get-Date) -lt $deadline) {
    if ((Restore-WorkingDockerContext) -and (Test-DockerEngineStableProbe -Passes 3 -DelaySec 4)) {
      $label = Get-CurrentDockerContextLabel
      Write-Host ('docker-full-up: Docker Engine stable (context: {0}).' -f $label)
      return $true
    }

    $pipes = (Test-DockerPipe 'dockerDesktopLinuxEngine') -or (Test-DockerPipe 'docker_engine')
    $warm = ((Get-Date) - $waitStart).TotalSeconds -ge 90
    if ($warm -and -not $pipes -and $script:DdUiRestartCount -lt 2) {
      $sinceUi = if ($script:LastDdUiRestart) { ((Get-Date) - $script:LastDdUiRestart).TotalSeconds } else { 9999 }
      if ($sinceUi -ge 150) {
        $script:LastDdUiRestart = Get-Date
        Restart-DockerDesktopUi | Out-Null
      }
    }

    if (((Get-Date) - $lastWake).TotalSeconds -ge 45) {
      Wake-DockerEngineWsl | Out-Null
      $lastWake = Get-Date
    }

    if (-not $launchedDd -and $dd) {
      $proc = Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue
      if (-not $proc) {
        Write-Host 'docker-full-up: Docker Desktop not running - starting it (GUI may appear)...'
        Start-Process -FilePath $dd
        $launchedDd = $true
        Start-Sleep -Seconds 15
        continue
      }
    }

    if (((Get-Date) - $lastProgressMsg).TotalSeconds -ge 30) {
      $left = [math]::Max(0, [int]($deadline - (Get-Date)).TotalSeconds)
      $linux = Test-DockerPipe 'dockerDesktopLinuxEngine'
      $def = Test-DockerPipe 'docker_engine'
      Write-Host ('docker-full-up: Waiting for engine (pipes linux={0} default={1}) ... {2}s left' -f $linux, $def, $left)
      $lastProgressMsg = Get-Date
    }

    Start-Sleep -Seconds 4
  }

  return $false
}

if ($Repair -or $RepairDeep) {
  Repair-DockerBackend -Deep:$RepairDeep
}

if (-not (Wait-DockerEngine)) {
  Write-Host ''
  Write-Host '=== Docker Engine still not reachable ===' -ForegroundColor Red
  Write-Host 'No named pipes (dockerDesktopLinuxEngine / docker_engine) usually means the Linux backend never started.'
  Write-Host ''
  Write-Host 'Try in order:'
  Write-Host '  1) Open Docker Desktop and wait until it shows Engine running (whale icon steady).'
  Write-Host '  2) Docker Desktop / Troubleshoot / Restart (or Reset Kubernetes only if you use it).'
  Write-Host '  3) Gentle repair again:  npm run docker:full:repair-build'
  Write-Host '  4) Deep repair (WSL shutdown):  npm run docker:full:repair-deep-build'
  Write-Host '  5) Windows: ensure WSL2 + virtualization enabled; update Docker Desktop.'
  Write-Host ''
  Write-Host 'Remove stale env vars (new terminal after): System Properties / Environment / delete DOCKER_HOST if set.'
  Write-Host ''
  Write-Host '--- wsl -l -v (distros) ---'
  cmd /c "wsl.exe -l -v 2>&1"
  Write-Host ''
  Write-Host '--- docker context ---'
  & docker context ls
  Write-Host ''
  Write-Host '--- docker info ---'
  & docker info
  exit 1
}

if ($RepairOnly) {
  Write-Host 'docker-full-up: Engine is reachable. Skipping compose (-RepairOnly). Run: npm run docker:full'
  exit 0
}

$ports = @(3000, 4000, 5173, 8000)
foreach ($port in $ports) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    $procId = $_.OwningProcess
    if ($procId -gt 0) {
      if (Test-IsDockerOwnedListenerProcess $procId) {
        Write-Host ('docker-full-up: Port {0} held by Docker (PID {1}) - not killing (avoids engine disconnect).' -f $port, $procId)
      } else {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        Write-Host ('docker-full-up: Freed port {0} (PID {1})' -f $port, $procId)
      }
    }
  }
}

if (-not (Assert-DockerEngineReady)) {
  Write-Host 'docker-full-up: Engine not ready after freeing ports - waiting again...'
  if (-not (Wait-DockerEngine -TimeoutSec 180)) {
    Write-Host 'docker-full-up: Docker Engine lost after port cleanup; aborting.' -ForegroundColor Red
    exit 1
  }
}

Invoke-DockerHubPreflight

if ($RebuildNoCache) {
  Write-Host 'docker-full-up: docker compose build --no-cache web admin api java_api'
  $buildArgs = (Get-DockerComposeFilePrefixArgs) + @('build', '--no-cache', 'web', 'admin', 'api', 'java_api')
  & docker @buildArgs
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'docker-full-up: docker compose build --no-cache failed.' -ForegroundColor Red
    exit [int]$LASTEXITCODE
  }
}

$waitFlags = @()
$helpText = (& docker compose up --help 2>&1 | Out-String)
if ($helpText -match '--wait-timeout') {
  $waitFlags = @('--wait', '--wait-timeout', '900')
} elseif ($helpText -match '(^|\s)--wait(\s|$)') {
  $waitFlags = @('--wait')
}

$progressFlags = @()
if ($helpText -match '(^|\s)--progress(\s|$)') {
  $progressFlags = @('--progress', 'plain')
}

# Full-profile frontends keep a Docker network ID on the container. After engine/WSL restarts or
# manual network prune, "docker compose up" fails with: network <id> not found. Recreating web/admin fixes it.
function Remove-OceanbazarWebAdminContainers {
  foreach ($name in @('oceanbazar_web', 'oceanbazar_admin')) {
    $null = & docker rm -f $name 2>&1 | Out-Null
  }
}

Write-Host 'docker-full-up: Dropping web/admin containers if present (recovers stale Docker network references)...'
Remove-OceanbazarWebAdminContainers

$dcArgs = (Get-DockerComposeFilePrefixArgs) + @('--profile', 'full', 'up') + $progressFlags + @('-d') + $waitFlags
if ($Build -and -not $RebuildNoCache) { $dcArgs += '--build' }
Write-Host ('docker-full-up: docker {0}' -f ($dcArgs -join ' '))
if ($waitFlags.Count -gt 0) {
  Write-Host 'docker-full-up: Using --wait so containers pass healthchecks before this script exits (first build can take several minutes).'
}

$composeOk = $false
$lastComposeExit = 1
for ($attempt = 1; $attempt -le 5; $attempt++) {
  $null = Restore-WorkingDockerContext
  if (-not (Test-DockerEngineStableProbe -Passes 2 -DelaySec 3)) {
    Write-Host ('docker-full-up: compose attempt {0}: engine not stable; re-waiting...' -f $attempt)
    if (-not (Wait-DockerEngine -TimeoutSec 120)) {
      Write-Host 'docker-full-up: Docker Engine still not reachable; aborting.' -ForegroundColor Red
      exit 1
    }
  }
  & docker @dcArgs
  $lastComposeExit = [int]$LASTEXITCODE
  if ($lastComposeExit -eq 0) {
    $composeOk = $true
    break
  }
  Write-Host ('docker-full-up: compose failed (exit {0}); attempt {1}/5 - retrying in 8s...' -f $lastComposeExit, $attempt)
  if ($attempt -lt 5) {
    Write-Host 'docker-full-up: Removing web/admin before retry (orphaned-network workaround)...'
    Remove-OceanbazarWebAdminContainers
  }
  Start-Sleep -Seconds 8
}

if (-not $composeOk) { exit $lastComposeExit }

Write-Host ''
Write-Host 'docker-full-up: Stack status (full profile):'
$psArgs = (Get-DockerComposeFilePrefixArgs) + @('--profile', 'full', 'ps', '-a')
& docker @psArgs

$liveHint = if ($LiveDev) { "`n  Live dev: storefront + admin reflect ./frontend and ./admin-frontend-react on disk (no image rebuild for UI edits).`n" } else { "`n  Prod-like Docker UI: rebuild after edits with: npm run docker:full:build  (or use npm run docker:live).`n" }

Write-Host @"

docker-full-up: Services (host ports):
  Storefront   http://localhost:3000
  Admin CRM    http://localhost:5173
  BFF (Node)   http://localhost:4000/api/health
  Java API     http://localhost:8000/api/health
  Postgres     localhost:5433
  Redis        localhost:6399
$liveHint
Logs:   docker compose -f docker-compose.yml$(if ($LiveDev) { ' -f docker-compose.live-dev.yml' }) --profile full logs -f web
"@
