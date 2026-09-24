Set FSO = CreateObject("Scripting.FileSystemObject")
ScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = ScriptDir

Cmd = "cmd.exe /c node scripts\start-desktop.js"
WshShell.Run Cmd, 0, False

