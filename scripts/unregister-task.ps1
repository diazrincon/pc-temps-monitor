# Unregister AeroPulse Dashboard from Windows Startup and Task Scheduler
$taskName = "AeroPulseTempsMonitor"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Eliminando Inicio Automático de AeroPulse Dashboard    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Remover de HKCU\Run
try {
    $regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
    $prop = Get-ItemProperty -Path $regPath -Name $taskName -ErrorAction SilentlyContinue
    if ($prop) {
        Remove-ItemProperty -Path $regPath -Name $taskName -ErrorAction Stop
        Write-Host "[OK] Entrada eliminada del inicio de usuario (HKCU\Run)." -ForegroundColor Green
    } else {
        Write-Host "[INFO] No se encontró entrada en HKCU\Run." -ForegroundColor Gray
    }
} catch {
    Write-Host "[WARN] Error al remover de HKCU\Run: $_" -ForegroundColor Yellow
}

# 2. Remover de Task Scheduler si existe
try {
    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($task) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop
        Write-Host "[OK] Tarea '$taskName' eliminada de Windows Task Scheduler." -ForegroundColor Green
    } else {
        Write-Host "[INFO] No se encontró tarea en Task Scheduler." -ForegroundColor Gray
    }
} catch {
    Write-Host "[WARN] Error al remover tarea de Task Scheduler: $_" -ForegroundColor Yellow
}

Write-Host "==========================================================" -ForegroundColor Cyan
