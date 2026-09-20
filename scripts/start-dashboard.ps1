# Start the PC Temperatures Monitoring Dashboard service
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectRoot = Resolve-Path "$scriptDir\.."

Set-Location $projectRoot

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Starting AeroPulse PC Temperature Monitor Dashboard...   " -ForegroundColor Cyan
Write-Host "  URL: http://localhost:8367                               " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

$nodeExe = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path $nodeExe)) {
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCmd) {
        $nodeExe = $nodeCmd.Source
    } else {
        Write-Error "Node.js was not found! Please install Node.js."
        exit 1
    }
}

& $nodeExe "src/server.js"
