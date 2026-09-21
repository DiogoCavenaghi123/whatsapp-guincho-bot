@echo off
title Teste do Aviso de Desligamento
cd /d "%~dp0"

echo.
echo ============================================================
echo   TESTE: Abrindo Janela de Aviso de Desligamento (Modo Teste)
echo   * O computador NAO sera desligado no modo teste ao cancelar.
echo ============================================================
echo.

powershell -ExecutionPolicy Bypass -File "scripts\aviso-desligamento.ps1" -TimeoutSeconds 300

pause

