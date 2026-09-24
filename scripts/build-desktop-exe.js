// =============================================================
//  Build Desktop EXE — Cria o executável standalone do aplicativo
// =============================================================

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const srcDist = path.join(rootDir, 'node_modules/electron/dist');
const destDir = path.join(rootDir, 'app-desktop');

console.log('Criando pasta do aplicativo standalone em app-desktop...');

if (!fs.existsSync(destDir)) {
  fs.cpSync(srcDist, destDir, { recursive: true });
  console.log('✓ Binários base copiados.');
}

// Renomeia electron.exe para GuinchoBot.exe
const origExe = path.join(destDir, 'electron.exe');
const targetExe = path.join(destDir, 'GuinchoBot.exe');
if (fs.existsSync(origExe)) {
  fs.renameSync(origExe, targetExe);
  console.log('✓ Executável renomeado para GuinchoBot.exe.');
}

// Remove o default_app.asar de demonstração do Electron
const defaultApp = path.join(destDir, 'resources/default_app.asar');
if (fs.existsSync(defaultApp)) {
  fs.unlinkSync(defaultApp);
}

// Cria resources/app
const appDir = path.join(destDir, 'resources/app');
if (!fs.existsSync(appDir)) {
  fs.mkdirSync(appDir, { recursive: true });
}

// Cria o package.json do app
fs.writeFileSync(
  path.join(appDir, 'package.json'),
  JSON.stringify(
    {
      name: 'grupo-hazul-guincho-bot',
      version: '1.0.0',
      description: 'Aplicativo Desktop Oficial do Grupo Hazul',
      main: 'main.js',
    },
    null,
    2
  ),
  'utf8'
);

// Cria o entry point do app
const rootPathNormalized = rootDir.replace(/\\/g, '/');
const mainContent = `// Entry point do executável GuinchoBot.exe
delete process.env.ELECTRON_RUN_AS_NODE;
require('${rootPathNormalized}/src/desktop/main.js');
`;

fs.writeFileSync(path.join(appDir, 'main.js'), mainContent, 'utf8');

console.log('✓ Executável configurado com sucesso!');
console.log(`Localização do .exe: "${targetExe}"`);
// Aplica o ícone e informações oficiais ao GuinchoBot.exe
async function applyMetadata() {
  try {
    const { rcedit } = require('rcedit');
    const iconFile = path.join(destDir, 'icon.ico');
    if (fs.existsSync(iconFile) && fs.existsSync(targetExe)) {
      await rcedit(targetExe, {
        icon: iconFile,
        'version-string': {
          FileDescription: 'Grupo Hazul - Bot WhatsApp Guincho',
          ProductName: 'Guincho Bot Grupo Hazul',
          CompanyName: 'Grupo Hazul',
          OriginalFilename: 'GuinchoBot.exe',
        },
      });
      console.log('✓ Ícone e metadados oficiais do Grupo Hazul incorporados ao GuinchoBot.exe.');
    }
  } catch (err) {
    console.warn('! Aviso ao gravar metadados com rcedit:', err.message);
  }
}

applyMetadata().then(() => {
  console.log('✓ Executável configurado com sucesso!');
  console.log(`Localização do .exe: "${targetExe}"`);
});

