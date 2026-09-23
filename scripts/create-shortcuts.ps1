$Wsh = New-Object -ComObject WScript.Shell
$Desktop = [System.Environment]::GetFolderPath('Desktop')
$ProjDir = (Get-Item $PSScriptRoot).Parent.FullName

$s1 = $Wsh.CreateShortcut("$Desktop\Painel de Controle Guincho.lnk")
$s1.TargetPath = "$ProjDir\iniciar-painel.bat"
$s1.WorkingDirectory = "$ProjDir"
$s1.Description = "Abre o Painel de Controle do WhatsApp Guincho Bot"
$s1.Save()

$s2 = $Wsh.CreateShortcut("$Desktop\Iniciar Bot + Painel.lnk")
$s2.TargetPath = "$ProjDir\iniciar-tudo.bat"
$s2.WorkingDirectory = "$ProjDir"
$s2.Description = "Inicia o WhatsApp Guincho Bot com Painel de Controle"
$s2.Save()

$s3 = $Wsh.CreateShortcut("$Desktop\Parar Bot.lnk")
$s3.TargetPath = "$ProjDir\parar-bot.bat"
$s3.WorkingDirectory = "$ProjDir"
$s3.Description = "Encerra os processos do WhatsApp Guincho Bot"
$s3.Save()

Write-Host "Atalhos criados com sucesso na Area de Trabalho!"

