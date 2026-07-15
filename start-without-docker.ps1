# OceanBazar — start without Docker Desktop (repo root).
# First time: powershell -ExecutionPolicy Bypass -File .\scripts\setup-native-windows.ps1
powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'scripts\dev-stack-windows.ps1') -SkipDocker -Launch
