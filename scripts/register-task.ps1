# Register AeroPulse Dashboard in Windows Task Scheduler to start on logon
$taskName = "AeroPulseTempsMonitor"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectRoot = (Resolve-Path "$scriptDir\..").Path

# Self-elevation check: Task Scheduler requires Administrator rights
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Requesting Administrator privileges to register Scheduled Task..." -ForegroundColor Yellow
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$nodeExe = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path $nodeExe)) {
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCmd) { $nodeExe = $nodeCmd.Source }
}

# Dedicated port (8367 = T-E-M-P-S on keypad, unlikely to conflict with web servers or dev tools)
$port = 8367

Write-Host "Registering Scheduled Task '$taskName' on port $port..." -ForegroundColor Cyan

$action = New-ScheduledTaskAction -Execute $nodeExe -Argument "src/server.js" -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Days 0)

try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "PC Temperatures Monitoring Dashboard service for LibreHardwareMonitor" -Force -ErrorAction Stop
    Write-Host "`nTask '$taskName' registered successfully!" -ForegroundColor Green
    Write-Host "It will run automatically in the background when you log into Windows." -ForegroundColor Green
    Write-Host "Access URL: http://localhost:$port" -ForegroundColor Cyan
    Write-Host "`nTo start it now via Task Scheduler, run: Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor Yellow
} catch {
    Write-Error "Failed to register task: $_"
}
