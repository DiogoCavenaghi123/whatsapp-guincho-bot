const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const appDir = path.resolve(__dirname, '..');
const desktopDir = path.join(process.env.USERPROFILE, 'Desktop');
const botFolder = path.join(desktopDir, 'BOT DO WHATSAPP');

const targetExe = path.join(appDir, 'app-desktop', 'GuinchoBot.exe');
const workDir = path.join(appDir, 'app-desktop');
const iconFile = path.join(appDir, 'app-desktop', 'icon.ico');

function createShortcut(shortcutPath, target, workingDir, icon, desc) {
  const psScript = `
    $sh = New-Object -ComObject WScript.Shell
    $shortcut = $sh.CreateShortcut('${shortcutPath.replace(/'/g, "''")}')
    $shortcut.TargetPath = '${target.replace(/'/g, "''")}'
    $shortcut.WorkingDirectory = '${workingDir.replace(/'/g, "''")}'
    $shortcut.IconLocation = '${icon.replace(/'/g, "''")},0'
    $shortcut.Description = '${desc.replace(/'/g, "''")}'
    $shortcut.Save()
  `;
  execSync(`powershell -NoProfile -Command "${psScript.replace(/\r?\n/g, '; ')}"`, { stdio: 'inherit' });
const mainScript = path.join(appDir, 'src', 'desktop', 'main.js');

function createShortcut(shortcutPath, target, workingDir, icon, desc, args = '') {
  const psScript = [
    '$sh = New-Object -ComObject WScript.Shell',
    `$shortcut = $sh.CreateShortcut(@'\n${shortcutPath}\n'@)`,
    `$shortcut.TargetPath = @'\n${target}\n'@`,
    args ? `$shortcut.Arguments = '\"' + @'\n${args}\n'@ + '\"'` : `$shortcut.Arguments = ''`,
    `$shortcut.WorkingDirectory = @'\n${workingDir}\n'@`,
    `$shortcut.IconLocation = @'\n${icon},0\n'@`,
    `$shortcut.Description = @'\n${desc}\n'@`,
    '$shortcut.Save()',
  ].join('\n');

  const tmpScript = path.join(appDir, 'logs', 'create_shortcut.ps1');
  fs.writeFileSync(tmpScript, psScript, 'utf8');
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpScript}"`, { stdio: 'inherit' });
  try { fs.unlinkSync(tmpScript); } catch (_) {}
}

console.log('Criando atalhos desktop com ícone nativo...');
const desktopLnk = path.join(desktopDir, 'Guincho Bot - Grupo Hazul.lnk');
createShortcut(desktopLnk, targetExe, workDir, iconFile, 'Aplicativo Desktop do Guincho Bot (Grupo Hazul)');
createShortcut(desktopLnk, targetExe, appDir, iconFile, 'Aplicativo Desktop do Guincho Bot (Grupo Hazul)', mainScript);
console.log(`✅ Atalho criado: "${desktopLnk}"`);

if (fs.existsSync(botFolder)) {
  const folderLnk = path.join(botFolder, 'Abrir Aplicativo Desktop.lnk');
  createShortcut(folderLnk, targetExe, workDir, iconFile, 'Aplicativo Desktop do Guincho Bot (Grupo Hazul)');
  createShortcut(folderLnk, targetExe, appDir, iconFile, 'Aplicativo Desktop do Guincho Bot (Grupo Hazul)', mainScript);
  console.log(`✅ Atalho criado: "${folderLnk}"`);
}
