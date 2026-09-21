@echo off
title Configurar Rotina Diaria (07:00 as 19:00)
cd /d "%~dp0"

echo.
echo ============================================================
echo   CONFIGURAR ROTINA DIARIA AUTOMATICA (07:00 as 19:00)
echo ============================================================
echo.

powershell -ExecutionPolicy Bypass -File "scripts\configurar-agendamento.ps1"

pause

