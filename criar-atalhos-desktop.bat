@echo off
title Criar Atalhos na Area de Trabalho
cd /d "%~dp0"

echo ============================================================
echo   Criando atalhos na Area de Trabalho...
echo ============================================================

set SCRIPT_DIR=%~dp0
set DESKTOP_DIR=%USERPROFILE%\Desktop

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$s1 = $ws.CreateShortcut('%DESKTOP_DIR%\Painel de Controle Guincho.lnk'); " ^
  "$s1.TargetPath = '%SCRIPT_DIR%iniciar-painel.bat'; " ^
  "$s1.WorkingDirectory = '%SCRIPT_DIR%'; " ^
  "$s1.Description = 'Abre o Painel de Controle do WhatsApp Guincho Bot'; " ^
  "$s1.Save(); " ^
  "$s2 = $ws.CreateShortcut('%DESKTOP_DIR%\Iniciar Bot + Painel.lnk'); " ^
  "$s2.TargetPath = '%SCRIPT_DIR%iniciar-tudo.bat'; " ^
  "$s2.WorkingDirectory = '%SCRIPT_DIR%'; " ^
  "$s2.Description = 'Inicia o Bot e abre o Painel de Controle'; " ^
  "$s2.Save(); " ^
  "$s3 = $ws.CreateShortcut('%DESKTOP_DIR%\Parar Bot.lnk'); " ^
  "$s3.TargetPath = '%SCRIPT_DIR%parar-bot.bat'; " ^
  "$s3.WorkingDirectory = '%SCRIPT_DIR%'; " ^
  "$s3.Description = 'Finaliza o processo do Bot'; " ^
  "$s3.Save();"

echo.
echo [ OK ] Atalhos criados com sucesso na sua Area de Trabalho:
echo   - Painel de Controle Guincho.lnk
echo   - Iniciar Bot + Painel.lnk
echo   - Parar Bot.lnk
echo.
pause

