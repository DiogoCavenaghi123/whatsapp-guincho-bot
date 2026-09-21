// =============================================================
//  Start Dashboard Daemon — Inicia servidor em segundo plano e abre navegador
// =============================================================

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const PROJ_ROOT = path.resolve(__dirname, '../..');
const PID_FILE = path.join(PROJ_ROOT, '.dashboard.pid');
const LOG_DIR = path.join(PROJ_ROOT, 'logs');
const PORT = process.env.DASHBOARD_PORT || 3000;
const URL = `http://localhost:${PORT}`;

if (!fs.existsSync(LOG_DIR)) {
  try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch (_) {}
}

// Verifica se já está rodando
let isRunning = false;
if (fs.existsSync(PID_FILE)) {
  const oldPid = fs.readFileSync(PID_FILE, 'utf8').trim();
  if (oldPid && /^\d+$/.test(oldPid)) {
    try {
      process.kill(Number(oldPid), 0);
      isRunning = true;
    } catch (e) {
      try { fs.unlinkSync(PID_FILE); } catch (_) {}
    }
  }
}

if (!isRunning) {
  const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    cwd: PROJ_ROOT,
  });

  try {
    fs.writeFileSync(PID_FILE, String(child.pid), 'utf8');
  } catch (_) {}

  child.unref();
}

// Abre o navegador padrão
setTimeout(() => {
  const startCmd = process.platform === 'win32' ? `start "" "${URL}"` : `open "${URL}"`;
  exec(startCmd, () => {});
}, 300);
