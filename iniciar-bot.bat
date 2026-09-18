@echo off
title WhatsApp Guincho Bot
cd /d "%~dp0"

echo.
echo ============================================================
echo   Iniciando WhatsApp Guincho Bot...
echo ============================================================
echo.

npm start

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [AVISO] O bot encerrou.
    pause
)
