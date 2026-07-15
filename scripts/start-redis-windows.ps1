# Start Redis on host port 6399 (matches backend/.env REDIS_URL default) when Docker is unavailable.
# Usage (repo root): powershell -ExecutionPolicy Bypass -File .\scripts\start-redis-windows.ps1

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
$RedisDir = Join-Path $Root '.dev\redis-win'
$ZipPath = Join-Path $RedisDir 'Redis-x64-5.0.14.1.zip'
$ExePath = Join-Path $RedisDir 'redis-server.exe'
$RedisUrl = 'https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.zip'
$Port = 6399

function Test-TcpPort([string] $HostName, [int] $Port) {
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $iar = $c.BeginConnect($HostName, $Port, $null, $null)
    if (-not $iar.AsyncWaitHandle.WaitOne(1500, $false)) { $c.Close(); return $false }
    $c.EndConnect($iar)
    $c.Close()
    return $true
  } catch {
    return $false
  }
}

if (Test-TcpPort '127.0.0.1' $Port) {
  Write-Host "[redis] Already listening on 127.0.0.1:$Port"
  exit 0
}

if (-not (Test-Path $ExePath)) {
  Write-Host "[redis] Installing portable Redis 5.0.14.1 to $RedisDir ..."
  New-Item -ItemType Directory -Force -Path $RedisDir | Out-Null
  Invoke-WebRequest -Uri $RedisUrl -OutFile $ZipPath -UseBasicParsing
  Expand-Archive -LiteralPath $ZipPath -DestinationPath $RedisDir -Force
  Remove-Item $ZipPath -Force -ErrorAction SilentlyContinue
}

if (-not (Test-Path $ExePath)) {
  throw "[redis] redis-server.exe not found after extract: $ExePath"
}

Write-Host "[redis] Starting on port $Port ..."
Start-Process -FilePath $ExePath -ArgumentList '--port', "$Port" -WorkingDirectory $RedisDir -WindowStyle Hidden

$deadline = (Get-Date).AddSeconds(15)
while ((Get-Date) -lt $deadline) {
  if (Test-TcpPort '127.0.0.1' $Port) {
    Write-Host "[redis] Ready at redis://127.0.0.1:$Port"
    exit 0
  }
  Start-Sleep -Milliseconds 400
}

throw "[redis] Timed out waiting for 127.0.0.1:$Port"
