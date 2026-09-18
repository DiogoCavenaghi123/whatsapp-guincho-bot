@echo off
title Enviar Atualizações para o GitHub
cd /d "%~dp0"

echo ============================================================
echo   ENVIAR ATUALIZACOES PARA O GITHUB
echo ============================================================
echo.

set "PATH=C:\Users\Grupo Hazul\AppData\Local\Programs\Git\cmd;C:\Users\Grupo Hazul\AppData\Local\Microsoft\WinGet\Packages\GitHub.cli_Microsoft.Winget.Source_8wekyb3d8bbwe\bin;%PATH%"

:: 1. Verificar se ja esta logado no GitHub
gh auth status >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Voce precisa autorizar o acesso a sua conta GitHub (apenas na 1a vez).
    echo [INFO] Uma janela do navegador sera aberta com um codigo de confirmacao.
    echo.
    gh auth login --web -h github.com -p https --skip-ssh-key
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERRO] Autenticacao cancelada ou nao concluida.
        pause
        exit /b 1
    )
)

:: 2. Configura o git para usar o token do gh
gh auth setup-git

echo.
echo [1/3] Preparando arquivos alterados...
git add .

echo [2/3] Registrando commit...
git commit -m "feat: atualizacoes completas do bot e scripts de execucao" >nul 2>&1

echo [3/3] Enviando para o repositorio (git push)...
git push origin master

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================
    echo   [ OK ] SUCESSO! O GitHub foi atualizado com sucesso!
    echo   https://github.com/DiogoCavenaghi123/whatsapp-guincho-bot
    echo ============================================================
) else (
    echo.
    echo [ERRO] Nao foi possivel concluir o envio. Verifique a conexao e tente novamente.
)

echo.
pause

