@echo off
title Fluid Solutions - Activar inicio automatico
cd /d "%~dp0"

net session >nul 2>&1
if %errorLevel% NEQ 0 (
  echo ============================================================
  echo   Este instalador necesita permisos de administrador.
  echo   Haga CLIC DERECHO sobre este archivo y elija:
  echo   "Ejecutar como administrador"
  echo ============================================================
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Antes de activar el inicio automatico, abra primero
  echo Iniciar-Windows.bat una vez para completar la instalacion inicial.
  pause
  exit /b 1
)

schtasks /Delete /TN "FluidSolutionsCotizador" /F >nul 2>&1

schtasks /Create /TN "FluidSolutionsCotizador" /TR "wscript.exe \"%~dp0Iniciar-Oculto.vbs\"" /SC ONSTART /RU "NT AUTHORITY\SYSTEM" /RL HIGHEST /F
if %errorLevel% NEQ 0 (
  echo.
  echo ============================================================
  echo   No se pudo crear la tarea programada. Revise que este
  echo   ejecutando este archivo como administrador.
  echo ============================================================
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   Listo. El cotizador arrancara solo cada vez que este
echo   notebook ENCIENDA (no depende de con que usuario inicien
echo   sesion), sin mostrar ninguna ventana.
echo.
echo   Para probarlo ahora sin reiniciar el equipo, ejecute:
echo   schtasks /Run /TN "FluidSolutionsCotizador"
echo   Despues revise data\inicio-automatico.log para confirmar
echo   que arranco bien.
echo.
echo   Para desactivarlo mas adelante, use
echo   Desactivar-Inicio-Automatico.bat
echo ============================================================
pause
