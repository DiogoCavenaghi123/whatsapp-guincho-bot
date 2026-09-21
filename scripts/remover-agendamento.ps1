<#
.SYNOPSIS
  Remove as tarefas automáticas diárias do Agendador do Windows se o usuário quiser desativar.
#>

Unregister-ScheduledTask -TaskName "WhatsAppGuinchoBot_Iniciar_07h" -Confirm:$false -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "WhatsAppGuinchoBot_Encerrar_19h" -Confirm:$false -ErrorAction SilentlyContinue

Write-Host "[OK] Tarefas automaticas das 07:00 e 19:00 removidas do Agendador de Tarefas!"

