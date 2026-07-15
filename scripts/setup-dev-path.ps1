# Add Maven to user PATH (run once, no admin):
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup-dev-path.ps1

$mvnHome = Join-Path $env:LOCALAPPDATA 'Tools\apache-maven-3.9.6'
$mvnCmd = Join-Path $mvnHome 'bin\mvn.cmd'
if (-not (Test-Path $mvnCmd)) {
  Write-Host "Maven not found at $mvnHome - install apache-maven-3.9.6 to LocalAppData\Tools first."
  exit 1
}
[Environment]::SetEnvironmentVariable('MAVEN_HOME', $mvnHome, 'User')
$mvnBin = Join-Path $mvnHome 'bin'
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath -notlike "*$mvnBin*") {
  [Environment]::SetEnvironmentVariable('Path', "$userPath;$mvnBin", 'User')
}
Write-Host "MAVEN_HOME=$mvnHome added to user PATH. Open a new terminal."
