# Stop OceanBazar dev processes: Docker Compose project + optional local listeners on dev ports.
#
# Repo root:
#   npm run stack:stop

$ErrorActionPreference = 'Continue'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

function Test-IsDockerOwnedListenerProcess([int] $ProcessId) {
  if ($ProcessId -le 0) { return $false }
  try {
    $p = Get-Process -Id $ProcessId -ErrorAction Stop
  } catch {
    return $false
  }
  $skip = @('docker-proxy', 'com.docker.backend', 'Docker Desktop', 'vpnkit', 'wslrelay')
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

Write-Host 'stack-stop: docker compose down (full/tools/production profiles)...'
$downArgs = @('compose', '-f', 'docker-compose.yml')
$liveDevCompose = Join-Path $Root 'docker-compose.live-dev.yml'
if (Test-Path $liveDevCompose) {
  $downArgs += @('-f', 'docker-compose.live-dev.yml')
}
$downArgs += @('--profile', 'full', '--profile', 'tools', '--profile', 'production', 'down', '--remove-orphans')
$null = & docker @downArgs 2>&1

Write-Host 'stack-stop: freeing host ports 3000, 4000, 5173, 8000 from non-Docker listeners...'
foreach ($port in @(3000, 4000, 5173, 8000)) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    $procId = $_.OwningProcess
    if ($procId -gt 0) {
      if (Test-IsDockerOwnedListenerProcess $procId) {
        Write-Host ("stack-stop: port {0} still Docker-owned (PID {1}) - leaving engine alone." -f $port, $procId)
      } else {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        Write-Host ("stack-stop: stopped PID {0} on port {1}" -f $procId, $port)
      }
    }
  }
}

Write-Host 'stack-stop: done. Postgres/Redis data volumes are kept; start again with npm run docker:full, npm run docker:live, or npm run stack:keep'
