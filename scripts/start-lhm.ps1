# Launch LibreHardwareMonitor as Administrator
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectRoot = Resolve-Path "$scriptDir\.."

# Resolve LHM executable path:
# 1. Environment variable LHM_PATH
# 2. Local untracked folder LibreHardwareMonitor.NET.10
# 3. Standard Program Files path
$lhmExe = $env:LHM_PATH

if (-not $lhmExe -or -not (Test-Path $lhmExe)) {
    $fallbackCandidates = @(
        "$projectRoot\LibreHardwareMonitor.NET.10\LibreHardwareMonitor.exe",
        "$projectRoot\LibreHardwareMonitor\LibreHardwareMonitor.exe",
        "C:\Program Files\LibreHardwareMonitor\LibreHardwareMonitor.exe"
    )

    foreach ($candidate in $fallbackCandidates) {
        if (Test-Path $candidate) {
            $lhmExe = $candidate
            break
        }
    }
}

if (-not $lhmExe -or -not (Test-Path $lhmExe)) {
    Write-Host "==========================================================" -ForegroundColor Red
    Write-Host "Error: LibreHardwareMonitor.exe was not found!" -ForegroundColor Red
    Write-Host "Please set the LHM_PATH environment variable to your LHM exe path:" -ForegroundColor Yellow
    Write-Host '  [System.Environment]::SetEnvironmentVariable("LHM_PATH", "C:\Path\To\LibreHardwareMonitor.exe", "User")' -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Red
    exit 1
}

$running = Get-Process -Name "LibreHardwareMonitor" -ErrorAction SilentlyContinue
if ($running) {
    Write-Host "LibreHardwareMonitor is already running (PID: $($running.Id))." -ForegroundColor Green
    exit 0
}

Write-Host "Launching LibreHardwareMonitor ($lhmExe) as Administrator..." -ForegroundColor Yellow
Start-Process -FilePath $lhmExe -Verb RunAs
Write-Host "LibreHardwareMonitor launched. Verify that Remote Web Server is running on port 8085." -ForegroundColor Green
