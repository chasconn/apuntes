@echo off
title Fluid Solutions - Cotizador
cd /d "%~dp0"

rem --- Actualizacion automatica del diseno (plantillas y logos) desde GitHub ---
rem Si git esta instalado, baja las ultimas mejoras antes de arrancar. Solo toca
rem la carpeta "public" (disenos), nunca la carpeta "data" (tus cotizaciones).
where git >nul 2>nul
if %errorlevel%==0 (
  echo Buscando actualizaciones de diseno...
  git fetch origin >nul 2>nul
  git checkout origin/main -- public >nul 2>nul
)

if not exist node_modules (
  echo Instalando por primera vez, un momento...
  call npm install
)
echo.
echo Iniciando el cotizador...
echo No cierre esta ventana mientras la esten usando.
echo.
node server.js
pause
