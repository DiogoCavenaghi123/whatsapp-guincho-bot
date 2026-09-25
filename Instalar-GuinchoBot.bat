@echo off
setlocal
cd /d "%~dp0"
set "ELECTRON_RUN_AS_NODE="
title Instalador - WhatsApp Guincho Bot Grupo Hazul

echo.
echo ============================================================
echo   INSTALADOR OFICIAL - GUINCHO BOT GRUPO HAZUL
echo ============================================================
echo.
echo Instalando aplicativo standalone...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-app.ps1"

echo.
echo Pressione qualquer tecla para sair do instalador...
pause > nul
endlocal
