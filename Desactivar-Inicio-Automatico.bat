@echo off
title Fluid Solutions - Desactivar inicio automatico

net session >nul 2>&1
if %errorLevel% NEQ 0 (
  echo Necesita permisos de administrador.
  echo Haga clic derecho sobre este archivo y elija "Ejecutar como administrador".
  pause
  exit /b 1
)

schtasks /Delete /TN "FluidSolutionsCotizador" /F
echo.
echo Inicio automatico desactivado. Ahora debe abrir Iniciar-Windows.bat
echo manualmente cada vez que quieran usar el cotizador.
pause
