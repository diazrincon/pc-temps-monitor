# Unregister AeroPulse Dashboard from Windows Task Scheduler
$taskName = "AeroPulseTempsMonitor"

# Self-elevation check: Task Scheduler requires Administrator rights
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Requesting Administrator privileges to unregister Scheduled Task..." -ForegroundColor Yellow
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

Write-Host "Removing Scheduled Task '$taskName'..." -ForegroundColor Yellow
try {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop
    Write-Host "Task '$taskName' removed successfully." -ForegroundColor Green
} catch {
    Write-Host "Task '$taskName' was not found or could not be removed." -ForegroundColor Gray
}
