@echo off
title Iniciar Sistema - WhatsApp Guincho Bot
cd /d "%~dp0"

echo.
echo ============================================================
echo   Iniciando WhatsApp Guincho Bot + Painel de Controle
echo ============================================================
echo.

:: 1. Inicia o Painel de Controle (Dashboard) em segundo plano
start wscript.exe "%~dp0iniciar-painel.vbs"
echo [ OK ] Painel de Controle acionado (http://localhost:3000)
:: 1. Inicia o Painel de Controle (Dashboard) em segundo plano minimizado
start "Painel Guincho" /min cmd /c "node src/dashboard/server.js"
echo [ OK ] Servidor do Painel acionado na porta 3000
:: 1. Verifica se o painel ja esta rodando na porta 3000
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Iniciando servidor do Painel em segundo plano...
    start "Painel Guincho" /min node src/dashboard/start-dashboard.js
    timeout /t 2 /nobreak >nul
) else (
    echo [INFO] Servidor do Painel ja esta ativo na porta 3000.
    start "" http://localhost:3000
)

:: 2. Abre o navegador na pagina do Painel
start "" http://localhost:3000
echo [ OK ] Painel aberto no navegador (http://localhost:3000)
:: 2. Inicia o Bot no terminal interativo
echo.

:: 2. Inicia o Bot no terminal interativo
:: 3. Inicia o Bot no terminal interativo
echo [ OK ] Iniciando Bot do WhatsApp...
echo [ OK ] Iniciando Bot do WhatsApp no terminal...
echo ============================================================
echo.
npm start
node src/index.js

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [AVISO] O processo foi encerrado.
    echo [AVISO] O processo do bot foi encerrado.
    pause
)

