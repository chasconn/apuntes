@echo off
title Fluid Solutions - Cotizador
cd /d "%~dp0"
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
