Set FSO = CreateObject("Scripting.FileSystemObject")
ScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = ScriptDir

' Encontra o executavel do Node.js
NodeExe = "node.exe"
If FSO.FileExists("C:\Program Files\nodejs\node.exe") Then
    NodeExe = "C:\Program Files\nodejs\node.exe"
End If

' Verifica se processo do servidor do painel ja esta rodando
Set Wmi = GetObject("winmgmts:\\.\root\cimv2")
Set Procs = Wmi.ExecQuery("SELECT * FROM Win32_Process WHERE Name = 'node.exe' AND (CommandLine LIKE '%start-dashboard.js%' OR CommandLine LIKE '%server.js%')")

If Procs.Count = 0 Then
    ' Inicia o servidor do painel em segundo plano (janela oculta = 0)
    Cmd = "cmd.exe /c node src/dashboard/start-dashboard.js"
    WshShell.Run Cmd, 0, False
Else
    ' Se ja esta rodando, apenas abre o navegador
    WshShell.Run "cmd.exe /c start http://localhost:3000", 0, False
End If
