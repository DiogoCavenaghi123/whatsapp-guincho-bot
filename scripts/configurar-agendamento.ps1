<#
.SYNOPSIS
  Configura as tarefas automáticas diárias (07:00 e 19:00) no Agendador do Windows.
#>

$projDir = Split-Path -Parent $PSScriptRoot
$vbsLauncher = Join-Path $projDir "iniciar-segundo-plano.vbs"
$shutdownScript = Join-Path $projDir "scripts\aviso-desligamento.ps1"

Write-Host "============================================================"
Write-Host "  Configurando Rotina Diaria Automatica (07:00 as 19:00)"
Write-Host "============================================================"
Write-Host ""

# 1. Tarefa das 07:00: Iniciar Bot e Sincronizar Mensagens
$taskNameStart = "WhatsAppGuinchoBot_Iniciar_07h"
Write-Host "[1/2] Configurando tarefa das 07:00 ($taskNameStart)..."

# Criar a ação
$actionStart = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsLauncher`"" -WorkingDirectory "$projDir"

# Gatilho: Diariamente às 07:00
$triggerStart = New-ScheduledTaskTrigger -Daily -At "07:00"

# Configurações: Acordar o computador (WakeToRun) e permitir execução com bateria
$settingsStart = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -WakeToRun -Priority 4

# Registrar a tarefa
try {
    Unregister-ScheduledTask -TaskName $taskNameStart -Confirm:$false -ErrorAction SilentlyContinue
    Register-ScheduledTask -TaskName $taskNameStart -Action $actionStart -Trigger $triggerStart -Settings $settingsStart -Description "Inicia o WhatsApp Guincho Bot diariamente as 07:00 e sincroniza agendamentos." | Out-Null
    Write-Host "  [OK] Tarefa das 07:00 criada com sucesso (WakeToRun ativado)!" -ForegroundColor Green
} catch {
    Write-Host "  [AVISO] Tentando fallback via schtasks..."
    & schtasks /create /tn "$taskNameStart" /tr "wscript.exe `"$vbsLauncher`"" /sc daily /st 07:00 /f | Out-Null
}

# 2. Tarefa das 19:00: Encerrar Bot e Exibir Aviso de 5 Minutos
$taskNameStop = "WhatsAppGuinchoBot_Encerrar_19h"
Write-Host "[2/2] Configurando tarefa das 19:00 ($taskNameStop)..."

$actionStop = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$shutdownScript`"" -WorkingDirectory "$projDir"
$triggerStop = New-ScheduledTaskTrigger -Daily -At "19:00"
$settingsStop = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -Priority 4

try {
    Unregister-ScheduledTask -TaskName $taskNameStop -Confirm:$false -ErrorAction SilentlyContinue
    Register-ScheduledTask -TaskName $taskNameStop -Action $actionStop -Trigger $triggerStop -Settings $settingsStop -Description "Para o bot as 19:00 e exibe aviso com contagem regressiva de 5 minutos antes do desligamento." | Out-Null
    Write-Host "  [OK] Tarefa das 19:00 criada com sucesso!" -ForegroundColor Green
} catch {
    Write-Host "  [AVISO] Tentando fallback via schtasks..."
    & schtasks /create /tn "$taskNameStop" /tr "powershell.exe -ExecutionPolicy Bypass -File `"$shutdownScript`"" /sc daily /st 19:00 /f | Out-Null
}

Write-Host ""
Write-Host "============================================================"
Write-Host "  [SUCESSO] Agendamento diario configurado com exito!"
Write-Host "  - 07:00: O PC acorda e o bot inicia os trabalhos sozinho."
Write-Host "  - 19:00: O bot encerra e solicita autorizacao de 5 min."
Write-Host "============================================================"
Write-Host ""

