# OceanBazar Startup Manager v2
# Handles port conflicts, dependency caching, and health checks

param(
    [switch]$SkipBackend,
    [switch]$SkipStorefront,
    [switch]$SkipAdmin,
    [switch]$DevMode,
    [string[]]$Only = @()  # @('backend', 'storefront', 'admin')
)

$ErrorActionPreference = "SilentlyContinue"
$ProgressPreference = "SilentlyContinue"

# Configuration
$ports = @{
    backend    = 8000
    storefront = 3000
    admin      = 5173
}

$paths = @{
    backend    = "c:\Users\akand\Desktop\Antigravity\OCEANBAZAR Website\backend-java"
    storefront = "c:\Users\akand\Desktop\Antigravity\OCEANBAZAR Website\frontend"
    admin      = "c:\Users\akand\Desktop\Antigravity\OCEANBAZAR Website\admin-frontend-react"
}

$urls = @{
    backend    = "https://localhost:8000/api/health"
    storefront = "https://localhost:3000"
    admin      = "https://localhost:5173"
}

# Process tracking
$processes = @{}

# ============================================================
# Helper Functions
# ============================================================

function Write-Status($message, $color = "White") {
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] $message" -ForegroundColor $color
}

function Get-PortProcess($port) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        return Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
    }
    return $null
}

function Clear-Port($port, $name) {
    $proc = Get-PortProcess $port
    if ($proc) {
        Write-Status "Stopping $name (PID $($proc.Id)) on port $port" "Yellow"
        Stop-Process -Id $proc.Id -Force
        Start-Sleep 1
        # Verify port is free
        $attempts = 0
        while ((Get-PortProcess $port) -and $attempts -lt 5) {
            Start-Sleep 1
            $attempts++
        }
    }
}

function Test-ServiceHealth($url, $maxAttempts = 30) {
    for ($i = 0; $i -lt $maxAttempts; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $url -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
            return $true
        } catch {
            Start-Sleep 1
        }
    }
    return $false
}

function Start-BackendService {
    if ($SkipBackend) { return }
    if ($Only -and 'backend' -notin $Only) { return }

    Write-Status "=== Starting Backend ===" "Cyan"

    # Clear port
    Clear-Port $ports.backend "Backend"

    # Check if dependencies are cached
    $m2Dir = "$env:USERPROFILE\.m2\repository"
    $hasDeps = Test-Path "$m2Dir\org\springframework\boot" -PathType Container

    if (-not $hasDeps) {
        Write-Status "First run: Maven dependencies will be downloaded (one-time)" "Yellow"
    }

    # Start backend with compiled classes (skip tests for speed)
    $pomPath = Join-Path $paths.backend "pom.xml"

    # Use mvn spring-boot:run with daemon mode
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "mvn"
    $psi.Arguments = "spring-boot:run -f `"$pomPath`" -DskipTests"
    $psi.WorkingDirectory = $paths.backend
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    $proc = [System.Diagnostics.Process]::Start($psi)
    $processes['backend'] = $proc

    Write-Status "Backend starting (PID: $($proc.Id))..." "Green"

    # Health check
    Write-Status "Waiting for backend to be ready..." "Gray"
    if (Test-ServiceHealth $urls.backend 60) {
        Write-Status "Backend ready at $($urls.backend)" "Green"
    } else {
        Write-Status "Backend health check timeout - may still be starting" "Yellow"
    }
}

function Start-StorefrontService {
    if ($SkipStorefront) { return }
    if ($Only -and 'storefront' -notin $Only) { return }

    Write-Status "=== Starting Storefront ===" "Cyan"

    # Clear port
    Clear-Port $ports.storefront "Storefront"

    # Clear Next.js cache for clean start
    $nextCache = Join-Path $paths.storefront ".next"
    if (Test-Path $nextCache) {
        Remove-Item -Path $nextCache -Recurse -Force -ErrorAction SilentlyContinue
        Write-Status "Cleared Next.js cache" "Gray"
    }

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "npm"
    $psi.Arguments = "run dev"
    $psi.WorkingDirectory = $paths.storefront
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    $psi.EnvironmentVariables["PORT"] = $ports.storefront.ToString()

    $proc = [System.Diagnostics.Process]::Start($psi)
    $processes['storefront'] = $proc

    Write-Status "Storefront starting (PID: $($proc.Id)) on port $($ports.storefront)..." "Green"

    # Wait for dev server
    Start-Sleep 8
    Write-Status "Storefront should be ready at http://localhost:$($ports.storefront)" "Green"
}

function Start-AdminService {
    if ($SkipAdmin) { return }
    if ($Only -and 'admin' -notin $Only) { return }

    Write-Status "=== Starting Admin CRM ===" "Cyan"

    # Clear port
    Clear-Port $ports.admin "Admin"

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "npm"
    $psi.Arguments = "run dev"
    $psi.WorkingDirectory = $paths.admin
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    $proc = [System.Diagnostics.Process]::Start($psi)
    $processes['admin'] = $proc

    Write-Status "Admin CRM starting (PID: $($proc.Id)) on port $($ports.admin)..." "Green"

    # Wait for Vite
    Start-Sleep 5
    Write-Status "Admin CRM should be ready at http://localhost:$($ports.admin)" "Green"
}

function Show-Summary {
    Write-Status "`n=== OceanBazar Services ===" "Cyan"
    Write-Host ""

    $services = @()
    if (-not $SkipBackend -and (-not $Only -or 'backend' -in $Only)) {
        $services += [PSCustomObject]@{ Service = "Backend"; URL = $urls.backend; Status = "Starting" }
    }
    if (-not $SkipStorefront -and (-not $Only -or 'storefront' -in $Only)) {
        $services += [PSCustomObject]@{ Service = "Storefront"; URL = "http://localhost:$($ports.storefront)"; Status = "Starting" }
    }
    if (-not $SkipAdmin -and (-not $Only -or 'admin' -in $Only)) {
        $services += [PSCustomObject]@{ Service = "Admin CRM"; URL = "http://localhost:$($ports.admin)"; Status = "Starting" }
    }

    $services | Format-Table -AutoSize | Out-String | Write-Host

    Write-Status "Use Ctrl+C to stop all services`n" "Yellow"
}

function Stop-AllServices {
    Write-Status "`nShutting down services..." "Yellow"
    foreach ($name in $processes.Keys) {
        $proc = $processes[$name]
        if ($proc -and -not $proc.HasExited) {
            Write-Status "Stopping $name (PID: $($proc.Id))..." "Gray"
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
    }

    # Cleanup any remaining zombie processes
    foreach ($name in $ports.Keys) {
        $port = $ports[$name]
        $proc = Get-PortProcess $port
        if ($proc) {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
    }

    Write-Status "All services stopped" "Green"
    exit 0
}

# ============================================================
# Main Execution
# ============================================================

# Register shutdown handler
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
    Stop-AllServices
}

# Handle Ctrl+C
[Console]::TreatControlCAsInput = $true

Write-Status "OceanBazar Startup Manager v2" "Cyan"
Write-Status "==========================`n" "Cyan"

# Verify prerequisites
$javaVersion = & java -version 2>&1 | Select-String -Pattern "version" | Select-Object -First 1
$mvnVersion = & mvn -version 2>&1 | Select-Object -First 1
$nodeVersion = & node --version 2>&1

Write-Status "Java: $javaVersion" "Gray"
Write-Status "Maven: $mvnVersion" "Gray"
Write-Status "Node: $nodeVersion`n" "Gray"

# Start services
Start-BackendService
Start-StorefrontService
Start-AdminService

# Show summary
Show-Summary

# Keep running and watch for Ctrl+C
while ($true) {
    if ([Console]::KeyAvailable) {
        $key = [Console]::ReadKey($true)
        if ($key.Key -eq "C" -and $key.Modifiers -eq "Control") {
            Stop-AllServices
        }
    }

    # Check if processes are still running
    $allExited = $true
    foreach ($name in $processes.Keys) {
        $proc = $processes[$name]
        if ($proc -and -not $proc.HasExited) {
            $allExited = $false
            break
        }
    }

    if ($allExited -and $processes.Count -gt 0) {
        Write-Status "All services have exited" "Yellow"
        break
    }

    Start-Sleep 2
}
