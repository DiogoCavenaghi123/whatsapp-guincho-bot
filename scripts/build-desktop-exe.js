// =============================================================
//  Build Desktop EXE — Cria o executável standalone do aplicativo
//  Grupo Hazul — WhatsApp Guincho Bot
// =============================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const srcDist = path.join(rootDir, 'node_modules/electron/dist');
const destDir = path.join(rootDir, 'app-desktop');
const appDir = path.join(destDir, 'resources/app');

console.log('\n============================================================');
console.log('  🛠️  Gerando Aplicativo Standalone Oficial do Grupo Hazul');
console.log('============================================================\n');

// 1. Encerra qualquer processo antigo do GuinchoBot para liberar arquivos
try {
  execSync('taskkill /F /IM GuinchoBot.exe', { stdio: 'ignore' });
  console.log('✓ Processos anteriores de GuinchoBot finalizados.');
} catch (_) {}

// 2. Cria pasta app-desktop e copia binários do Electron
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Copia arquivos do dist (apenas se ainda não copiados ou se atualizados)
const distFiles = fs.readdirSync(srcDist);
for (const file of distFiles) {
  const srcFile = path.join(srcDist, file);
  const dstFile = path.join(destDir, file === 'electron.exe' ? 'GuinchoBot.exe' : file);
  if (!fs.existsSync(dstFile)) {
    fs.cpSync(srcFile, dstFile, { recursive: true });
  }
}
console.log('✓ Binários base do Electron configurados.');

// Renomeia electron.exe se ainda existir
const origExe = path.join(destDir, 'electron.exe');
const targetExe = path.join(destDir, 'GuinchoBot.exe');
if (fs.existsSync(origExe)) {
  if (fs.existsSync(targetExe)) fs.unlinkSync(targetExe);
  fs.renameSync(origExe, targetExe);
}

// Remove o default_app.asar de demonstração do Electron
const defaultApp = path.join(destDir, 'resources/default_app.asar');
if (fs.existsSync(defaultApp)) {
  fs.unlinkSync(defaultApp);
}

// 3. Prepara a pasta resources/app
if (!fs.existsSync(appDir)) {
  fs.mkdirSync(appDir, { recursive: true });
}

// 4. Copia src/ completamente para resources/app/src
console.log('Copiando arquivos de código-fonte (src)...');
const destSrc = path.join(appDir, 'src');
fs.cpSync(path.join(rootDir, 'src'), destSrc, { recursive: true });
console.log('✓ Código-fonte copiado com sucesso.');

// 5. Copia .env e credentials.json (para resources/app e tambem na raiz do app)
if (fs.existsSync(path.join(rootDir, '.env'))) {
  fs.copyFileSync(path.join(rootDir, '.env'), path.join(appDir, '.env'));
  fs.copyFileSync(path.join(rootDir, '.env'), path.join(destDir, '.env'));
  console.log('✓ Arquivo .env copiado.');
}
if (fs.existsSync(path.join(rootDir, 'credentials.json'))) {
  fs.copyFileSync(path.join(rootDir, 'credentials.json'), path.join(appDir, 'credentials.json'));
  fs.copyFileSync(path.join(rootDir, 'credentials.json'), path.join(destDir, 'credentials.json'));
  console.log('✓ Arquivo credentials.json copiado.');
}
const authSrc = path.join(rootDir, '.wwebjs_auth');
const authDst = path.join(destDir, '.wwebjs_auth');
if (fs.existsSync(authSrc) && !fs.existsSync(authDst)) {
  console.log('Copiando sessão autenticada do WhatsApp (.wwebjs_auth)...');
  try {
    fs.cpSync(authSrc, authDst, { recursive: true });
    console.log('✓ Sessão autenticada do WhatsApp copiada.');
  } catch (e) {
    console.warn('Aviso ao copiar sessão do WhatsApp:', e.message);
  }
}

// 6. Garante diretório de logs
const appLogsDir = path.join(appDir, 'logs');
if (!fs.existsSync(appLogsDir)) fs.mkdirSync(appLogsDir, { recursive: true });

// 7. Cria package.json do app standalone
fs.writeFileSync(
  path.join(appDir, 'package.json'),
  JSON.stringify(
    {
      name: 'grupo-hazul-guincho-bot',
      version: '1.0.0',
      description: 'Aplicativo Desktop Oficial do Grupo Hazul — Bot WhatsApp Guincho & Cegonha',
      main: 'main.js',
    },
    null,
    2
  ),
  'utf8'
);

// 8. Cria o main.js com caminho relativo portátil
const mainContent = `// =============================================================
//  Grupo Hazul — Bot WhatsApp Guincho & Cegonha
//  Entry Point Portátil do Executável Standalone
// =============================================================
require('./src/desktop/main.js');
`;
fs.writeFileSync(path.join(appDir, 'main.js'), mainContent, 'utf8');
console.log('✓ Entry point relativo (portátil) configurado.');

// 9. Copia dependências (node_modules), excluindo electron e rcedit para economizar ~370MB
console.log('Copiando dependências de produção para o executável (isso pode levar alguns segundos)...');
const srcNodeModules = path.join(rootDir, 'node_modules');
const dstNodeModules = path.join(appDir, 'node_modules');

if (!fs.existsSync(dstNodeModules)) {
  fs.mkdirSync(dstNodeModules, { recursive: true });
}

const modules = fs.readdirSync(srcNodeModules);
let copiedCount = 0;
for (const mod of modules) {
  // Pula electron, rcedit e .bin no app final empacotado
  if (mod === 'electron' || mod === 'rcedit' || mod === '.bin') continue;

  const srcMod = path.join(srcNodeModules, mod);
  const dstMod = path.join(dstNodeModules, mod);

  if (!fs.existsSync(dstMod)) {
    fs.cpSync(srcMod, dstMod, { recursive: true });
    copiedCount++;
  }
}
console.log(`✓ Dependências de produção copiadas (${copiedCount} módulos empacotados).`);

// 10. Copia o ícone oficial
const iconSrc = path.join(rootDir, 'src/dashboard/public/assets/logo.ico');
const iconDst = path.join(destDir, 'icon.ico');
if (fs.existsSync(iconSrc)) {
  fs.copyFileSync(iconSrc, iconDst);
  fs.copyFileSync(iconSrc, path.join(appDir, 'icon.ico'));
}

// 11. Aplica ícone e metadados oficiais com rcedit
async function applyMetadata() {
  try {
    const { rcedit } = require('rcedit');
    if (fs.existsSync(iconDst) && fs.existsSync(targetExe)) {
      await rcedit(targetExe, {
        icon: iconDst,
        'version-string': {
          FileDescription: 'Grupo Hazul - Bot WhatsApp Guincho',
          ProductName: 'Guincho Bot Grupo Hazul',
          CompanyName: 'Grupo Hazul',
          OriginalFilename: 'GuinchoBot.exe',
          LegalCopyright: '© Grupo Hazul - Todos os direitos reservados',
        },
      });
      console.log('✓ Ícone e metadados oficiais do Grupo Hazul incorporados ao GuinchoBot.exe.');
    }
  } catch (err) {
    console.warn('! Aviso ao gravar metadados com rcedit:', err.message);
  }
}

applyMetadata().then(() => {
  console.log('\n============================================================');
  console.log('  🎉 Executável Standalone 100% Pronto!');
  console.log(`  Pasta do aplicativo: "${destDir}"`);
  console.log(`  Executável oficial:  "${targetExe}"`);
  console.log('============================================================\n');
});
