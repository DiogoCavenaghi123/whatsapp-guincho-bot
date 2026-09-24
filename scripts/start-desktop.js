// =============================================================
//  Desktop App Launcher — Inicializa o executavel Electron
// =============================================================

const { spawn } = require('child_process');
const path = require('path');

const electronBin = path.join(__dirname, '../node_modules/electron/dist/electron.exe');
const mainJs = path.join(__dirname, '../src/desktop/main.js');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBin, [mainJs], {
  env,
  detached: true,
  stdio: 'ignore',
  windowsHide: false,
});

child.unref();

