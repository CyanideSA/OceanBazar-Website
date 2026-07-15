# Enable WSL2 + start Docker Desktop (run as Administrator).
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\enable-wsl-docker.ps1

$ErrorActionPreference = 'Stop'

function Test-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = [Security.Principal.WindowsPrincipal]$id
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Admin)) {
  Write-Host '[wsl-docker] Re-launching elevated...'
  Start-Process powershell -Verb RunAs -ArgumentList @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass',
    '-File', $PSCommandPath
  ) -Wait
  exit $LASTEXITCODE
}

Write-Host '[wsl-docker] Enabling Windows features (WSL + Virtual Machine Platform)...'
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart | Out-Host
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart | Out-Host

Write-Host '[wsl-docker] Setting WSL 2 as default...'
wsl --set-default-version 2 2>&1 | Out-Host

Write-Host '[wsl-docker] Installing WSL (no distro download if already present)...'
wsl --install --no-distribution 2>&1 | Out-Host

Write-Host '[wsl-docker] Starting Docker service...'
Set-Service com.docker.service -StartupType Automatic -ErrorAction SilentlyContinue
Start-Service com.docker.service -ErrorAction SilentlyContinue

$dd = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
if (Test-Path $dd) {
  Write-Host '[wsl-docker] Launching Docker Desktop...'
  Start-Process $dd
}

Write-Host @'

[wsl-docker] If virtualization is disabled in BIOS, enable Intel VT-x / AMD-V and reboot.

After reboot (if DISM asked for one):
  1. Open Docker Desktop — wait until "Engine running"
  2. docker version
  3. cd to repo: docker compose up -d postgres redis java_api api
     OR: npm run docker:live

'@
