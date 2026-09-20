# Register AeroPulse Dashboard for Automatic Startup on Windows Login
$taskName = "AeroPulseTempsMonitor"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectRoot = (Resolve-Path "$scriptDir\..").Path
$vbsRunner = "$scriptDir\run-silent.vbs"
$wscriptExe = "$env:SystemRoot\System32\wscript.exe"
$port = 8367

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Configurando Inicio Automático de AeroPulse Dashboard   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Registrar en el inicio de usuario de Windows (HKCU\Run)
# No requiere elevación UAC y garantiza que inicie de forma silenciosa e invisible en cada inicio de sesión.
try {
    $regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
    $regVal = "`"$wscriptExe`" `"$vbsRunner`""
    Set-ItemProperty -Path $regPath -Name $taskName -Value $regVal -Force
    Write-Host "[OK] Inicio de usuario registrado en Windows (HKCU\Run)" -ForegroundColor Green
    Write-Host "     Ejecutable: $regVal" -ForegroundColor Gray
} catch {
    Write-Host "[WARN] No se pudo escribir en HKCU\Run: $_" -ForegroundColor Yellow
}

# 2. Registrar en el Programador de Tareas (Task Scheduler)
# Si la sesión actual tiene privilegios de Administrador, crea la tarea programada en el sistema.
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) {
    try {
        $action = New-ScheduledTaskAction -Execute $wscriptExe -Argument "`"$vbsRunner`"" -WorkingDirectory $projectRoot
        $trigger = New-ScheduledTaskTrigger -AtLogOn
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Days 0) -Priority 7
        Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "PC Temperatures Monitoring Dashboard service for LibreHardwareMonitor" -Force -ErrorAction Stop
        Write-Host "[OK] Tarea programada '$taskName' registrada en Windows Task Scheduler" -ForegroundColor Green
    } catch {
        Write-Host "[WARN] No se pudo registrar en Task Scheduler: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "[INFO] Para registrar también en Windows Task Scheduler como Administrador," -ForegroundColor Gray
    Write-Host "       abre PowerShell como Administrador y ejecuta este mismo script." -ForegroundColor Gray
}

# 3. Verificar estado actual del servicio en el puerto 8367
Write-Host "`nComprobando estado del servicio..." -ForegroundColor Cyan
$conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
if ($conn) {
    Write-Host "[OK] El servicio ya está CORRIENDO y escuchando en el puerto $port" -ForegroundColor Green
    Write-Host "     URL: http://localhost:$port" -ForegroundColor Cyan
} else {
    Write-Host "Iniciando servicio en segundo plano..." -ForegroundColor Yellow
    Start-Process -FilePath $wscriptExe -ArgumentList "`"$vbsRunner`""
    Start-Sleep -Seconds 2
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
    if ($conn) {
        Write-Host "[OK] ¡Servicio iniciado con éxito en segundo plano!" -ForegroundColor Green
        Write-Host "     URL: http://localhost:$port" -ForegroundColor Cyan
    } else {
        Write-Host "[WARN] El servicio está arrancando. Verifica http://localhost:$port en unos segundos." -ForegroundColor Yellow
    }
}

Write-Host "==========================================================" -ForegroundColor Cyan
