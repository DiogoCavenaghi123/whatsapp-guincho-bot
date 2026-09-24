const { execSync } = require('child_process');
const fs = require('fs');

const vbsContent = [
  'Set w = CreateObject("WScript.Shell")',
  'Set fso = CreateObject("Scripting.FileSystemObject")',
  'Set folder = fso.GetFolder("C:\\Users\\Grupo Hazul\\Desktop\\BOT DO WHATSAPP")',
  'For Each f In folder.Files',
  '  If LCase(fso.GetExtensionName(f.Name)) = "lnk" Then',
  '    Set s = w.CreateShortcut(f.Path)',
  '    WScript.Echo f.Name & " ---> " & s.TargetPath & " [args: " & s.Arguments & "] [dir: " & s.WorkingDirectory & "]"',
  '  End If',
  'Next',
].join('\r\n');

fs.writeFileSync('temp_inspect.vbs', vbsContent);
try {
  const out = execSync('cscript //nologo temp_inspect.vbs').toString();
  console.log(out);
} finally {
  fs.unlinkSync('temp_inspect.vbs');
}

