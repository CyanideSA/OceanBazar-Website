# Shuts down WSL — often clears Docker Desktop "500" / pipe errors after a bad update.
# Run as Administrator if Docker services refuse to stop.
# After this: open Docker Desktop, wait until it says "Running", then: docker compose up -d postgres redis
# Full repair (Docker service + Redis): run elevated — .\scripts\fix-docker-redis-admin.ps1 -Elevate

Write-Host "[repair-docker-wsl] Stopping WSL..."
wsl --shutdown 2>$null
Start-Sleep -Seconds 3
Write-Host "[repair-docker-wsl] Done. Start Docker Desktop, then verify: docker version"
