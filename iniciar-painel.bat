@echo off
title Painel de Controle - WhatsApp Guincho Bot
cd /d "%~dp0"
start wscript.exe "%~dp0iniciar-painel.vbs"
exit /b

echo ============================================================
echo   Painel de Controle - WhatsApp Guincho Bot
echo ============================================================
echo.

:: Verifica se a porta 3000 ja esta aberta
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %ERRORLEVEL% EQU 0 (
    echo [INFO] O Painel ja esta em execucao!
    echo Abrindo navegador em http://localhost:3000...
    start "" http://localhost:3000
    exit /b
)

echo [ OK ] Abrindo navegador em http://localhost:3000...
start "" http://localhost:3000

echo [ OK ] Servidor do Painel ativo na porta 3000.
echo Mantenha esta janela minimizada para manter o painel online.
echo.
node src/dashboard/server.js
