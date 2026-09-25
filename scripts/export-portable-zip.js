// =============================================================
//  Export Portable ZIP — Gera arquivo ZIP pronto para distribuição
//  Grupo Hazul — WhatsApp Guincho Bot
// =============================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const appDesktop = path.join(rootDir, 'app-desktop');
const distZip = path.join(rootDir, 'GuinchoBot-Instalador-GrupoHazul.zip');
const tempDir = path.join(rootDir, 'temp-dist');

console.log('\n============================================================');
console.log('  📦 Criando Pacote Instalador ZIP para Outras Máquinas');
console.log('============================================================\n');

// 1. Garante que app-desktop existe
if (!fs.existsSync(path.join(appDesktop, 'GuinchoBot.exe'))) {
  console.log('Gerando aplicativo standalone primeiro...');
  execSync(`node "${path.join(__dirname, 'build-desktop-exe.js')}"`, { stdio: 'inherit', cwd: rootDir });
}

// 2. Prepara pasta temporária de distribuição
if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir, { recursive: true });

// Copia app-desktop renomeando para GuinchoBot
console.log('Copiando arquivos para o pacote de distribuição...');
const targetAppFolder = path.join(tempDir, 'GuinchoBot');
fs.cpSync(appDesktop, targetAppFolder, { recursive: true });

// Cria instalador .bat dentro do pacote de distribuição
const installerBatContent = `@echo off
chcp 65001 > nul
title Instalador - WhatsApp Guincho Bot Grupo Hazul
set "ELECTRON_RUN_AS_NODE="

echo.
echo ============================================================
echo   🚛 INSTALADOR OFICIAL — GUINCHO BOT GRUPO HAZUL
echo ============================================================
echo.
echo Instalando aplicativo standalone nesta máquina...
echo.

set "TARGET_DIR=%LOCALAPPDATA%\\Programs\\GuinchoBot"

taskkill /F /IM GuinchoBot.exe > nul 2>&1
timeout /t 1 > nul

if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"
xcopy /E /I /Y /Q "%~dp0GuinchoBot\\*" "%TARGET_DIR%\\" > nul

echo ✓ Arquivos copiados com sucesso!

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $d = [Environment]::GetFolderPath('Desktop'); $s = $ws.CreateShortcut(\\"$d\\Guincho Bot - Grupo Hazul.lnk\\"); $s.TargetPath = \\"$env:LOCALAPPDATA\\Programs\\GuinchoBot\\GuinchoBot.exe\\"; $s.WorkingDirectory = \\"$env:LOCALAPPDATA\\Programs\\GuinchoBot\\"; $s.IconLocation = \\"$env:LOCALAPPDATA\\Programs\\GuinchoBot\\icon.ico,0\\"; $s.Description = 'Bot WhatsApp Guincho e Cegonha - Grupo Hazul'; $s.Save(); Write-Host '✓ Atalho na Área de Trabalho criado!'"

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $sm = \\"$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Grupo Hazul\\"; if (!(Test-Path $sm)) { New-Item -ItemType Directory -Path $sm -Force | Out-Null }; $s = $ws.CreateShortcut(\\"$sm\\Guincho Bot - Grupo Hazul.lnk\\"); $s.TargetPath = \\"$env:LOCALAPPDATA\\Programs\\GuinchoBot\\GuinchoBot.exe\\"; $s.WorkingDirectory = \\"$env:LOCALAPPDATA\\Programs\\GuinchoBot\\"; $s.IconLocation = \\"$env:LOCALAPPDATA\\Programs\\GuinchoBot\\icon.ico,0\\"; $s.Save(); Write-Host '✓ Atalho no Menu Iniciar criado!'"

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $st = [Environment]::GetFolderPath('Startup'); $s = $ws.CreateShortcut(\\"$st\\Guincho Bot - Grupo Hazul.lnk\\"); $s.TargetPath = \\"$env:LOCALAPPDATA\\Programs\\GuinchoBot\\GuinchoBot.exe\\"; $s.WorkingDirectory = \\"$env:LOCALAPPDATA\\Programs\\GuinchoBot\\"; $s.IconLocation = \\"$env:LOCALAPPDATA\\Programs\\GuinchoBot\\icon.ico,0\\"; $s.Description = 'Inicialização Automática com o Windows'; $s.Save(); Write-Host '✓ Inicialização automática com o Windows ativada!'"

echo.
echo ============================================================
echo   🎉 INSTALAÇÃO CONCLUÍDA COM SUCESSO!
echo ============================================================
echo.
echo Iniciando aplicativo...
start "" "%LOCALAPPDATA%\\Programs\\GuinchoBot\\GuinchoBot.exe"

echo.
echo Pronto! Você já pode fechar esta janela.
timeout /t 3 > nul
`;

fs.writeFileSync(path.join(tempDir, 'Instalar-GuinchoBot.bat'), installerBatContent, 'utf8');

// Cria README com instruções amigáveis
const readmeContent = `============================================================
  GUINCHO BOT GRUPO HAZUL — INSTRUÇÕES DE INSTALAÇÃO
============================================================

Para instalar o aplicativo nesta máquina (não precisa de Node.js nem VS Code):

1. Descompacte todo o conteúdo deste arquivo .zip.
2. Dê dois cliques no arquivo:
   👉 "Instalar-GuinchoBot.bat"
3. O instalador irá:
   ✓ Instalar o aplicativo em seu computador
   ✓ Criar o atalho oficial com o logo do Grupo Hazul na Área de Trabalho
   ✓ Criar o atalho no Menu Iniciar
   ✓ Configurar inicialização automática junto com o Windows
   ✓ Abrir o aplicativo imediatamente pronto para uso!

Dúvidas ou suporte:
Equipe de Tecnologia / Logística do Grupo Hazul.
`;

fs.writeFileSync(path.join(tempDir, 'README_COMO_INSTALAR.txt'), readmeContent, 'utf8');

// 3. Compacta para .zip usando tar.exe nativo do Windows
if (fs.existsSync(distZip)) fs.unlinkSync(distZip);

console.log('Compactando pacote final em GuinchoBot-Instalador-GrupoHazul.zip...');
try {
  execSync(`tar.exe -a -c -f "${distZip}" -C "${tempDir}" .`, {
    stdio: 'inherit',
    cwd: rootDir,
  });
  console.log(`\n✓ Pacote ZIP gerado com sucesso: "${distZip}"`);
} catch (err) {
  console.error('Falha ao compactar zip:', err.message);
} finally {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (_) {}
}
