# =============================================================
#  Instalador Oficial - WhatsApp Guincho Bot Grupo Hazul
#  Instala o aplicativo de forma 100% standalone e cria atalhos
# =============================================================

param (
    [switch]$NoLaunch
)

$ErrorActionPreference = "Stop"
$env:ELECTRON_RUN_AS_NODE = $null
[System.Environment]::SetEnvironmentVariable('ELECTRON_RUN_AS_NODE', $null, 'Process')

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  INSTALADOR OFICIAL - GUINCHO BOT GRUPO HAZUL" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path "$ScriptDir\.."

# Diretorio de origem dos binarios empacotados
$SourceDir = "$ProjectRoot\app-desktop"
if (-not (Test-Path "$SourceDir\GuinchoBot.exe")) {
    if (Test-Path "$ScriptDir\GuinchoBot\GuinchoBot.exe") {
        $SourceDir = "$ScriptDir\GuinchoBot"
    } elseif (Test-Path "$ScriptDir\app-desktop\GuinchoBot.exe") {
        $SourceDir = "$ScriptDir\app-desktop"
    } else {
        Write-Host "Executavel standalone nao encontrado. Gerando binarios agora..." -ForegroundColor Yellow
        node "$ProjectRoot\scripts\build-desktop-exe.js"
        $SourceDir = "$ProjectRoot\app-desktop"
    }
}

# Destino padrao: pasta Programs do usuario local (dispensa privilegios de Administrador)
$InstallDir = "$env:LOCALAPPDATA\Programs\GuinchoBot"
Write-Host "Diretorio de Instalacao: $InstallDir" -ForegroundColor Gray

# 1. Encerra instancias em execucao
Write-Host "1/5 Verificando processos anteriores..." -ForegroundColor Yellow
try {
    Get-Process -Name "GuinchoBot" -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Milliseconds 800
} catch {}

# 2. Copia os arquivos do aplicativo
Write-Host "2/5 Instalando arquivos do aplicativo..." -ForegroundColor Yellow
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

robocopy "$SourceDir" "$InstallDir" /E /R:1 /W:1 /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) {
    Copy-Item -Path "$SourceDir\*" -Destination $InstallDir -Recurse -Force
}
Write-Host "[OK] Arquivos instalados com sucesso!" -ForegroundColor Green

# 3. Cria atalho na Area de Trabalho (Desktop)
Write-Host "3/5 Criando atalho na Area de Trabalho..." -ForegroundColor Yellow
$WshShell = New-Object -ComObject WScript.Shell

$TargetExe = "$InstallDir\GuinchoBot.exe"
$IconPath = "$InstallDir\icon.ico"

$DesktopPath = [Environment]::GetFolderPath("Desktop")
$DesktopShortcut = $WshShell.CreateShortcut("$DesktopPath\Guincho Bot - Grupo Hazul.lnk")
$DesktopShortcut.TargetPath = $TargetExe
$DesktopShortcut.WorkingDirectory = $InstallDir
if (Test-Path $IconPath) {
    $DesktopShortcut.IconLocation = "$IconPath,0"
}
$DesktopShortcut.Description = "Aplicativo Oficial de Agendamento de Guincho e Cegonha - Grupo Hazul"
$DesktopShortcut.Save()
Write-Host "[OK] Atalho na Area de Trabalho criado!" -ForegroundColor Green

# 4. Cria atalho no Menu Iniciar
Write-Host "4/5 Criando atalho no Menu Iniciar..." -ForegroundColor Yellow
$StartMenuDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Grupo Hazul"
if (-not (Test-Path $StartMenuDir)) {
    New-Item -ItemType Directory -Path $StartMenuDir -Force | Out-Null
}
$StartMenuShortcut = $WshShell.CreateShortcut("$StartMenuDir\Guincho Bot - Grupo Hazul.lnk")
$StartMenuShortcut.TargetPath = $TargetExe
$StartMenuShortcut.WorkingDirectory = $InstallDir
if (Test-Path $IconPath) {
    $StartMenuShortcut.IconLocation = "$IconPath,0"
}
$StartMenuShortcut.Description = "Aplicativo Oficial de Agendamento de Guincho e Cegonha - Grupo Hazul"
$StartMenuShortcut.Save()
Write-Host "[OK] Atalho no Menu Iniciar criado!" -ForegroundColor Green

# 5. Configura Inicializacao Automatica com o Windows (Startup)
Write-Host "5/5 Configurando inicializacao automatica com o Windows..." -ForegroundColor Yellow
$StartupFolder = [Environment]::GetFolderPath("Startup")
$StartupShortcut = $WshShell.CreateShortcut("$StartupFolder\Guincho Bot - Grupo Hazul.lnk")
$StartupShortcut.TargetPath = $TargetExe
$StartupShortcut.WorkingDirectory = $InstallDir
if (Test-Path $IconPath) {
    $StartupShortcut.IconLocation = "$IconPath,0"
}
$StartupShortcut.Description = "Inicializacao automatica do Bot Guincho em segundo plano"
$StartupShortcut.Save()
Write-Host "[OK] Inicializacao automatica ativada!" -ForegroundColor Green

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  INSTALACAO CONCLUIDA COM SUCESSO!" -ForegroundColor Green
Write-Host "  O aplicativo agora e independente e roda sem o VS Code." -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

if (-not $NoLaunch) {
    Write-Host "Iniciando o aplicativo..." -ForegroundColor Cyan
    Start-Process -FilePath $TargetExe -WorkingDirectory $InstallDir
}
