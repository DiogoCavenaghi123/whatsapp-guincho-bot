@echo off
chcp 65001 > nul
title Instalador - WhatsApp Guincho Bot Grupo Hazul
set "ELECTRON_RUN_AS_NODE="

echo.
echo ============================================================
echo   🚛 INSTALADOR OFICIAL — GUINCHO BOT GRUPO HAZUL
echo ============================================================
echo.
echo Instalando aplicativo standalone...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-app.ps1"

echo.
echo Pressione qualquer tecla para sair do instalador...
pause > nul
