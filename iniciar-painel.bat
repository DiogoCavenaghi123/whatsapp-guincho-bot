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
:: 1. Verifica se a porta 3000 ja esta aberta
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %ERRORLEVEL% EQU 0 (
    echo [INFO] O Painel ja esta em execucao!
    echo Abrindo navegador em http://localhost:3000...
    echo [INFO] O Painel de Controle ja esta ativo na porta 3000!
    echo [ OK ] Abrindo navegador em http://localhost:3000...
    start "" http://localhost:3000
    timeout /t 3 >nul
    exit /b
)

echo [ OK ] Abrindo navegador em http://localhost:3000...
start "" http://localhost:3000
:: 2. Inicia o servidor do painel e abre navegador
echo [INFO] Iniciando servidor do Painel na porta 3000...
start "Painel Guincho" /min node src/dashboard/start-dashboard.js

echo [ OK ] Servidor do Painel ativo na porta 3000.
echo Mantenha esta janela minimizada para manter o painel online.
echo [ OK ] Servidor do Painel inicializado em segundo plano.
echo [ OK ] O navegador sera aberto automaticamente em http://localhost:3000
echo.
node src/dashboard/server.js
echo ============================================================
echo   Painel Online! (http://localhost:3000)
echo ============================================================
echo.
timeout /t 4 >nul
exit /b
