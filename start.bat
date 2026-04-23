@echo off
echo Starting OceanBazar...
powershell -ExecutionPolicy Bypass -File "%~dp0start-oceanbazar.ps1" %*
pause
