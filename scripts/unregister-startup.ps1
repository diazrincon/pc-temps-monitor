# Desactivar inicio automático de AeroPulse en el Registro de Windows (HKCU\Run)

$regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$entryName = "AeroPulseTempsMonitor"

try {
    $exists = Get-ItemProperty -Path $regPath -Name $entryName -ErrorAction SilentlyContinue
    if ($exists) {
        Remove-ItemProperty -Path $regPath -Name $entryName -ErrorAction Stop
        Write-Host "==========================================================" -ForegroundColor Cyan
        Write-Host "  [OK] Inicio automático eliminado de Windows (HKCU\Run)   " -ForegroundColor Yellow
        Write-Host "==========================================================" -ForegroundColor Cyan
    } else {
        Write-Host "No se encontró ninguna entrada activa para '$entryName' en $regPath." -ForegroundColor Gray
    }
} catch {
    Write-Error "Error al eliminar de $($regPath): $_"
}
