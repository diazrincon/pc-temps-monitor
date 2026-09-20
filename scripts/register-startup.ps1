# Registrar inicio automático de AeroPulse en el Registro de Windows (HKCU\Run)
# Este script NO requiere permisos de Administrador.
# Arranca el monitor silenciosamente en segundo plano (sin ventana negra de consola) al iniciar sesión.

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$vbsRunner = "$scriptDir\run-silent.vbs"
$wscriptExe = "$env:SystemRoot\System32\wscript.exe"
$regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$entryName = "AeroPulseTempsMonitor"
$command = "`"$wscriptExe`" `"$vbsRunner`""

try {
    Set-ItemProperty -Path $regPath -Name $entryName -Value $command -Force
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "  [OK] Inicio automático configurado con éxito            " -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "Clave del Registro: $regPath" -ForegroundColor Gray
    Write-Host "Nombre de entrada:  $entryName" -ForegroundColor Gray
    Write-Host "Comando asignado:   $command" -ForegroundColor Gray
    Write-Host "`nAl iniciar sesión en Windows, el monitor arrancará solo." -ForegroundColor Green
    Write-Host "Dashboard: http://localhost:8367" -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Cyan
} catch {
    Write-Error "Error al registrar en $($regPath): $_"
}
