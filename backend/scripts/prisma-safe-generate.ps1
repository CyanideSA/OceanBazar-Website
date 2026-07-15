# prisma-safe-generate.ps1
# 
# Safely runs `prisma generate` on Windows by first releasing any
# DLL locks held by ts-node-dev / node processes on the Prisma engine.
#
# Usage: pwsh -File scripts/prisma-safe-generate.ps1
#        or:  npm run db:generate

param(
  [switch]$Force = $false,
  [int]$WaitMs   = 800
)

$ErrorActionPreference = 'SilentlyContinue'

Write-Host "[prisma-safe-generate] Looking for Prisma engine locks..." -ForegroundColor Cyan

# -- 1. Try SysInternals handle64 for precise detection --------------------
$handleFound = $false
foreach ($handleExe in @('handle64', 'handle')) {
  $result = & $handleExe -accepteula '.prisma' 2>$null
  if ($LASTEXITCODE -eq 0 -and $result) {
    $pids = ($result | Select-String 'pid:\s*(\d+)' | ForEach-Object {
      $_.Matches[0].Groups[1].Value
    } | Sort-Object -Unique)

    if ($pids) {
      foreach ($pid in $pids) {
        Write-Host "[prisma-safe-generate] Killing PID $pid (Prisma lock)" -ForegroundColor Yellow
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
      }
      $handleFound = $true
      break
    }
  }
}

# -- 2. Fallback: kill ts-node-dev node.exe processes ----------------------
if (-not $handleFound) {
  $nodeProcs = Get-Process -Name 'node' -ErrorAction SilentlyContinue

  if (-not $nodeProcs) {
    Write-Host "[prisma-safe-generate] No node processes running — nothing to kill." -ForegroundColor Green
  } else {
    Write-Host "[prisma-safe-generate] Terminating $($nodeProcs.Count) node.exe process(es)..." -ForegroundColor Yellow
    $nodeProcs | ForEach-Object {
      try { $_.Kill() } catch { }
    }
    Write-Host "[prisma-safe-generate] node.exe processes terminated." -ForegroundColor Green
    Write-Host "[prisma-safe-generate] Remember to restart dev server after generate." -ForegroundColor DarkYellow
  }
}

# -- 3. Wait for OS to release handles -------------------------------------
Write-Host "[prisma-safe-generate] Waiting ${WaitMs}ms for OS handle release..." -ForegroundColor Cyan
Start-Sleep -Milliseconds $WaitMs

# -- 4. Run prisma generate ------------------------------------------------
Write-Host "[prisma-safe-generate] Running prisma generate..." -ForegroundColor Cyan
$ErrorActionPreference = 'Continue'

npx prisma generate

if ($LASTEXITCODE -eq 0) {
  Write-Host "[prisma-safe-generate] ✅ prisma generate succeeded." -ForegroundColor Green
} else {
  Write-Host "[prisma-safe-generate] ❌ prisma generate failed (exit $LASTEXITCODE)." -ForegroundColor Red
  exit $LASTEXITCODE
}
