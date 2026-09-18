Set FSO = CreateObject("Scripting.FileSystemObject")
ScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = ScriptDir

' Garante criacao da pasta logs
If Not FSO.FolderExists(ScriptDir & "\logs") Then
    FSO.CreateFolder(ScriptDir & "\logs")
End If

' Verifica se processo ja esta ativo
Set Wmi = GetObject("winmgmts:\\.\root\cimv2")
Set Procs = Wmi.ExecQuery("SELECT * FROM Win32_Process WHERE Name = 'node.exe' AND (CommandLine LIKE '%src/index.js%' OR CommandLine LIKE '%src\\index.js%')")
If Procs.Count > 0 Then
    WshShell.Popup "O WhatsApp Guincho Bot já está rodando em segundo plano!", 4, "Bot em Execução", 48
    WScript.Quit
End If

' Inicia o node com janela oculta (0)
Cmd = "cmd.exe /c node src/index.js"
WshShell.Run Cmd, 0, False

WshShell.Popup "WhatsApp Guincho Bot foi iniciado em segundo plano!", 3, "Bot Iniciado", 64
